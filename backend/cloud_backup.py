"""Cloud backup for EyeClinic EMR — Google Drive + Dropbox.

Drive OAuth (free Gmail): GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN + GOOGLE_DRIVE_FOLDER_ID
Dropbox (simplest): DROPBOX_APP_KEY + DROPBOX_APP_SECRET + DROPBOX_REFRESH_TOKEN
  (+ optional DROPBOX_FOLDER, default /EMR Backup)
"""
import io
import json
import os
import sqlite3
import shutil
import tempfile
import zipfile
import datetime


def _load_service_info():
    raw = (os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    if raw:
        try:
            return json.loads(raw)
        except Exception as e:
            return {"_error": "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: " + str(e)}
    path = (os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE") or "").strip()
    if path and os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"_error": "cannot read service account file: " + str(e)}
    return None


def _load_oauth_creds():
    cid = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    csec = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
    rtok = (os.environ.get("GOOGLE_REFRESH_TOKEN") or "").strip()
    if cid and csec and rtok:
        return {"client_id": cid, "client_secret": csec, "refresh_token": rtok}
    return None


def gdrive_status():
    folder = (os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or "").strip()
    oauth = _load_oauth_creds()
    if oauth:
        return {"configured": True, "mode": "oauth (your quota)",
                "has_service_account": False, "folder_set": bool(folder),
                "service_email": "your Google account"}
    info = _load_service_info()
    if isinstance(info, dict) and info.get("_error"):
        return {"configured": False, "mode": "service-account",
                "error": info["_error"] + " — TIP: free Gmail needs OAuth (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN), service accounts have no quota.",
                "folder_set": bool(folder)}
    return {
        "configured": bool(info and folder),
        "mode": "service-account (Workspace only)",
        "has_service_account": bool(info),
        "folder_set": bool(folder),
        "service_email": (info or {}).get("client_email", "") if isinstance(info, dict) else "",
    }


def build_backup_zip(db_path, here_dir):
    """Create timestamped .zip with emr.db snapshot + data/uploads. Returns zip path."""
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    tmpdir = tempfile.mkdtemp(prefix="emr_backup_")
    zpath = os.path.join(tmpdir, "emr_backup_" + stamp + ".zip")
    tmpdb = os.path.join(tmpdir, "snapshot_emr.db")
    try:
        src = sqlite3.connect(db_path)
        src.execute("VACUUM INTO " + json.dumps(tmpdb))
        src.close()
    except Exception:
        shutil.copy2(db_path, tmpdb)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(tmpdb, "emr.db")
        uploads = os.path.join(here_dir, "data", "uploads")
        if os.path.isdir(uploads):
            for root, _, files in os.walk(uploads):
                for fn in files:
                    fp = os.path.join(root, fn)
                    z.write(fp, os.path.relpath(fp, here_dir))
    try:
        os.remove(tmpdb)
    except Exception:
        pass
    return zpath


def upload_backup_zip(zpath):
    """Upload a .zip file to the configured Google Drive folder. Returns dict."""
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    folder = (os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or "").strip()
    if not folder:
        return {"error": "Google Drive not linked: set GOOGLE_DRIVE_FOLDER_ID env var"}
    name = os.path.basename(zpath)
    meta = {"name": name, "parents": [folder]}

    # 1) OAuth user mode — works on free Gmail (uses YOUR quota)
    oauth = _load_oauth_creds()
    if oauth:
        from google.oauth2.credentials import Credentials
        creds = Credentials(
            None, refresh_token=oauth["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=oauth["client_id"], client_secret=oauth["client_secret"],
            scopes=["https://www.googleapis.com/auth/drive.file"])
        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        media = MediaFileUpload(zpath, mimetype="application/zip", resumable=False)
        created = service.files().create(body=meta, media_body=media,
                                         fields="id, name, webViewLink").execute()
        return {"ok": True, "file_id": created.get("id"),
                "name": created.get("name"), "link": created.get("webViewLink", "")}

    # 2) Service-account fallback — only works on paid Workspace Shared Drives
    from google.oauth2 import service_account
    info = _load_service_info()
    if not info or (isinstance(info, dict) and info.get("_error")):
        return {"error": "Free Gmail blocks service accounts (no quota). Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN instead."}

    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.file"])
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    media = MediaFileUpload(zpath, mimetype="application/zip", resumable=True)
    created = service.files().create(body=meta, media_body=media, fields="id, name, webViewLink").execute()
    return {"ok": True, "file_id": created.get("id"),
            "name": created.get("name"), "link": created.get("webViewLink", "")}


# ── DROPBOX (simplest, 1 app + refresh token, no test users) ──────────

def _dropbox_creds():
    key = (os.environ.get("DROPBOX_APP_KEY") or "").strip()
    sec = (os.environ.get("DROPBOX_APP_SECRET") or "").strip()
    rtok = (os.environ.get("DROPBOX_REFRESH_TOKEN") or "").strip()
    # Legacy long-lived token fallback
    legacy = (os.environ.get("DROPBOX_ACCESS_TOKEN") or "").strip()
    if key and sec and rtok:
        return {"key": key, "secret": sec, "refresh": rtok}
    if legacy:
        return {"legacy_token": legacy}
    return None


def dropbox_status():
    c = _dropbox_creds()
    folder = (os.environ.get("DROPBOX_FOLDER") or "/EMR Backup").strip() or "/EMR Backup"
    if not c:
        return {"configured": False, "folder": folder}
    return {"configured": True, "folder": folder,
            "mode": "refresh-token" if "refresh" in c else "access-token"}


def _dropbox_access_token():
    import requests
    c = _dropbox_creds()
    if not c:
        return None, "Dropbox not linked: set DROPBOX_APP_KEY/SECRET/REFRESH_TOKEN"
    if "legacy_token" in c:
        return c["legacy_token"], None
    try:
        r = requests.post("https://api.dropbox.com/oauth2/token",
                          data={"grant_type": "refresh_token",
                                "refresh_token": c["refresh"],
                                "client_id": c["key"],
                                "client_secret": c["secret"]}, timeout=30)
        j = r.json()
        if "access_token" not in j:
            return None, "Dropbox refresh failed: " + r.text[:300]
        return j["access_token"], None
    except Exception as e:
        return None, "Dropbox token error: " + str(e)


def upload_to_dropbox(zpath):
    """Upload zip to Dropbox /EMR Backup. Returns dict."""
    import requests
    tok, err = _dropbox_access_token()
    if err:
        return {"error": err}
    folder = (os.environ.get("DROPBOX_FOLDER") or "/EMR Backup").strip() or "/EMR Backup"
    if not folder.startswith("/"):
        folder = "/" + folder
    dest = folder.rstrip("/") + "/" + os.path.basename(zpath)
    try:
        with open(zpath, "rb") as f:
            data = f.read()
        r = requests.post("https://content.dropboxapi.com/2/files/upload",
                          headers={"Authorization": "Bearer " + tok,
                                   "Content-Type": "application/octet-stream",
                                   "Dropbox-API-Arg": json.dumps(
                                       {"path": dest, "mode": "add", "autorename": True})},
                          data=data, timeout=120)
        if r.status_code not in (200, 201):
            return {"error": "Dropbox upload failed: " + r.text[:500]}
        j = r.json()
        return {"ok": True, "name": os.path.basename(j.get("path_display", dest)),
                "path": j.get("path_display", dest), "size": j.get("size")}
    except Exception as e:
        return {"error": "Dropbox upload error: " + str(e)}

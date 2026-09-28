"""Google Drive cloud backup for EyeClinic EMR.

Reads credentials from Render env vars (no secrets in git):
  GOOGLE_SERVICE_ACCOUNT_JSON — full JSON content of a Google service account key
    (or set GOOGLE_SERVICE_ACCOUNT_FILE to a file path containing it)
  GOOGLE_DRIVE_FOLDER_ID — Drive folder ID to upload into (service account must
    be added as Editor on that folder via Share)
  AUTO_CLOUD_BACKUP — "1" to enable daily auto-upload (can also be toggled in UI)

Usage from app.py:
  from cloud_backup import gdrive_status, upload_backup_zip
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


def gdrive_status():
    info = _load_service_info()
    folder = (os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or "").strip()
    if isinstance(info, dict) and info.get("_error"):
        return {"configured": False, "error": info["_error"], "folder_set": bool(folder)}
    return {
        "configured": bool(info and folder),
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
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    info = _load_service_info()
    if not info or (isinstance(info, dict) and info.get("_error")):
        err = (info or {}).get("_error") if isinstance(info, dict) else None
        return {"error": err or "Google Drive not linked: set GOOGLE_SERVICE_ACCOUNT_JSON env var"}
    folder = (os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or "").strip()
    if not folder:
        return {"error": "Google Drive not linked: set GOOGLE_DRIVE_FOLDER_ID env var"}

    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.file"])
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    name = os.path.basename(zpath)
    meta = {"name": name, "parents": [folder]}
    media = MediaFileUpload(zpath, mimetype="application/zip", resumable=True)
    created = service.files().create(body=meta, media_body=media, fields="id, name, webViewLink").execute()
    return {"ok": True, "file_id": created.get("id"),
            "name": created.get("name"), "link": created.get("webViewLink", "")}

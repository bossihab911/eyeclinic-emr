"""Ophthalmology EMR — Flask backend API."""
import os
import json
import hashlib
import secrets
import sqlite3
import shutil
import time
import zipfile
import threading
import datetime
from functools import wraps

from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "data", "emr.db")
STATIC = os.path.join(HERE, "static")
UPLOAD_ROOT = os.path.join(HERE, "data", "uploads")
try:
    from werkzeug.utils import secure_filename
except Exception:
    def secure_filename(s):
        return "".join(c if c.isalnum() or c in "._-" else "_" for c in s) or "file"

app = Flask(__name__, static_folder=STATIC, static_url_path="/static")
CORS(app)

# ── Database helpers ──────────────────────────────────────────────

def get_db():
    db = getattr(g, "_db", None)
    if db is None:
        db = g._db = sqlite3.connect(DB)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("PRAGMA journal_mode = WAL")
    return db

@app.teardown_appcontext
def close_db(exc):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()

def rows(sql, params=()):
    return [dict(r) for r in get_db().execute(sql, params).fetchall()]

def row(sql, params=()):
    r = get_db().execute(sql, params).fetchone()
    return dict(r) if r else None

def run(sql, params=()):
    db = get_db()
    cur = db.execute(sql, params)
    db.commit()
    return cur.lastrowid

# ── Audit ─────────────────────────────────────────────────────────

def audit(action, resource, resource_id=None, details=None):
    try:
        uid = g.user["id"] if g.get("user") else None
        db = get_db()
        prev = db.execute("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
        prev_hash = prev["hash"] if prev else "GENESIS"
        payload = json.dumps({"ts": datetime.datetime.utcnow().isoformat(),
                              "user": uid, "action": action, "resource": resource,
                              "resource_id": resource_id, "details": details or {},
                              "prev": prev_hash}, ensure_ascii=False)
        h = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        # we store details separately + hash over (action, resource, id, details, prev)
        db.execute("INSERT INTO audit_log(ts, user_id, action, resource, resource_id, details, ip, prev_hash, hash)"
                   " VALUES(?,?,?,?,?,?,?,?,?)",
                   (datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), uid, action, resource,
                    str(resource_id) if resource_id else None,
                    json.dumps(details or {}, ensure_ascii=False), request.remote_addr, prev_hash, h))
        db.commit()
    except Exception:
        pass

# ── Auth ──────────────────────────────────────────────────────────

def hash_pw(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120000).hex()

def current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = request.args.get("token") or request.form.get("token") or ""
    if not token:
        return None
    db = get_db()
    r = db.execute(
        "SELECT u.*, r.name AS role, r.label_en AS role_en, r.label_ar AS role_ar, r.permissions AS perms"
        " FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id"
        " WHERE s.token=? AND s.expires_at > datetime('now') AND u.active=1", (token,)).fetchone()
    return dict(r) if r else None

def require_auth(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        u = current_user()
        if not u:
            return jsonify({"error": "unauthorized"}), 401
        g.user = u
        return fn(*a, **kw)
    return wrapper

def require_role(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            u = current_user()
            if not u:
                return jsonify({"error": "unauthorized"}), 401
            if u["role"] not in roles and u["role"] != "admin":
                return jsonify({"error": "forbidden"}), 403
            g.user = u
            return fn(*a, **kw)
        return wrapper
    return deco

# ── AUTH ROUTES ───────────────────────────────────────────────────

@app.post("/api/login")
def login():
    body = request.get_json(force=True, silent=True) or {}
    username = (body.get("username") or "").strip().lower()
    password = body.get("password") or ""
    db = get_db()
    r = db.execute("SELECT * FROM users WHERE lower(username)=? AND active=1", (username,)).fetchone()
    if not r:
        return jsonify({"error": "invalid_credentials"}), 401
    calc = hash_pw(password, r["salt"])
    if calc != r["password_hash"]:
        return jsonify({"error": "invalid_credentials"}), 401
    token = secrets.token_urlsafe(32)
    exp = datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    db.execute("DELETE FROM sessions WHERE expires_at < datetime('now')")
    db.execute("INSERT INTO sessions(user_id, token, expires_at) VALUES(?,?,?)",
               (r["id"], token, exp.strftime("%Y-%m-%d %H:%M:%S")))
    db.commit()
    audit("login", "session")
    role = db.execute("SELECT name, label_en, label_ar, permissions FROM roles WHERE id=?", (r["role_id"],)).fetchone()
    return jsonify({
        "token": token,
        "user": {
            "id": r["id"], "username": r["username"], "name_en": r["name_en"], "name_ar": r["name_ar"],
            "role": role["name"], "role_en": role["label_en"], "role_ar": role["label_ar"],
            "permissions": json.loads(role["permissions"]),
        }
    })

@app.post("/api/logout")
@require_auth
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    db = get_db()
    db.execute("DELETE FROM sessions WHERE token=?", (token,))
    db.commit()
    audit("logout", "session")
    return jsonify({"ok": True})

@app.get("/api/me")
@require_auth
def me():
    return jsonify({"user": g.user})

# ── HELPER: patient serializer ────────────────────────────────────

def patient_summary(p):
    if p is None:
        return None
    p = dict(p)
    p["full_name_en"] = " ".join([x for x in [p.get("name_given_en"), p.get("name_family_en")] if x])
    p["full_name_ar"] = " ".join([x for x in [p.get("name_family_ar"), p.get("name_given_ar")] if x])
    p["age"] = _age(p.get("dob"))
    return p

def _age(dob):
    if not dob:
        return None
    try:
        d = datetime.date.fromisoformat(dob)
        today = datetime.date.today()
        return today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    except Exception:
        return None

def _isodate(ds):
    return ds or ""

# ── REFERENCE DATA ────────────────────────────────────────────────

@app.get("/api/icd10")
@require_auth
def icd10_search():
    q = (request.args.get("q") or "").strip()
    rows_ = rows("SELECT code, short_desc, category FROM icd10_codes WHERE code LIKE ? OR short_desc LIKE ? LIMIT 40",
                 (f"%{q}%", f"%{q}%"))
    return jsonify(rows_)

# ── PATIENTS ──────────────────────────────────────────────────────

@app.get("/api/patients")
@require_auth
def list_patients():
    q = (request.args.get("q") or "").strip()
    page = max(int(request.args.get("page", 1)), 1)
    per = min(max(int(request.args.get("per", 20)), 5), 100)
    where, params = "", []
    if q:
        where = (" WHERE (lower(name_given_en) LIKE ? OR lower(name_family_en) LIKE ?"
                 " OR lower(name_given_ar) LIKE ? OR lower(name_family_ar) LIKE ?"
                 " OR mrn LIKE ? OR phone LIKE ?)")
        like = f"%{q}%".lower()
        params = [like] * 6
    total = row(f"SELECT COUNT(*) c FROM patients{where}", params)["c"]
    data = rows(f"SELECT * FROM patients{where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                params + [per, (page - 1) * per])
    return jsonify({"total": total, "page": page, "per": per, "patients": [patient_summary(p) for p in data]})

@app.post("/api/patients")
@require_role("ophthalmologist", "receptionist", "admin")
def create_patient():
    body = request.get_json(force=True, silent=True) or {}
    require = ["mrn", "name_given_en", "name_family_en"]
    if not all(body.get(k) for k in require):
        return jsonify({"error": "missing_fields", "fields": require}), 400
    existing = row("SELECT id FROM patients WHERE mrn=?", (body.get("mrn"),))
    if existing:
        return jsonify({"error": "duplicate_mrn"}), 409
    pid = run("""INSERT INTO patients(mrn, name_given_en, name_family_en, name_given_ar, name_family_ar,
                 dob, sex, phone, phone_secondary, email, address, city, preferred_language,
                 insurance_provider, insurance_policy, insurance_expiry, referring_physician)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (body.get("mrn"), body.get("name_given_en"), body.get("name_family_en"),
               body.get("name_given_ar"), body.get("name_family_ar"), body.get("dob"), body.get("sex"),
               body.get("phone"), body.get("phone_secondary"), body.get("email"), body.get("address"),
               body.get("city"), body.get("preferred_language") or "en",
               body.get("insurance_provider"), body.get("insurance_policy"), body.get("insurance_expiry"),
               body.get("referring_physician")))
    for al in (body.get("allergies") or []):
        if al.get("allergen"):
            run("INSERT INTO allergies(patient_id,allergen,reaction,severity) VALUES(?,?,?,?)",
                (pid, al["allergen"], al.get("reaction"), al.get("severity") or "moderate"))
    audit("create", "patient", pid, {"mrn": body.get("mrn")})
    return jsonify({"id": pid, "patient": patient_summary(row("SELECT * FROM patients WHERE id=?", (pid,)))}), 201

@app.put("/api/patients/<int:pid>")
@require_role("ophthalmologist", "receptionist", "admin")
def update_patient(pid):
    body = request.get_json(force=True, silent=True) or {}
    fields = ["name_given_en", "name_family_en", "name_given_ar", "name_family_ar", "dob", "sex", "phone",
              "phone_secondary", "email", "address", "city", "preferred_language", "insurance_provider",
              "insurance_policy", "insurance_expiry", "referring_physician", "status"]
    sets, params = [], []
    for f in fields:
        if f in body:
            sets.append(f" {f}=?")
            params.append(body.get(f))
    if not sets:
        return jsonify({"error": "no_fields"}), 400
    sets.append(" updated_at=datetime('now')")
    params.append(pid)
    cur = get_db().execute(f"UPDATE patients SET{','.join(sets)} WHERE id=?", params)
    get_db().commit()
    if cur.rowcount == 0:
        return jsonify({"error": "not_found"}), 404
    audit("update", "patient", pid)
    return jsonify({"patient": patient_summary(row("SELECT * FROM patients WHERE id=?", (pid,)))})

@app.delete("/api/patients/<int:pid>")
@require_role("admin")
def delete_patient(pid):
    db = get_db()
    db.execute("DELETE FROM inventory_movements WHERE ref_patient_id=?", (pid,))
    cur = db.execute("DELETE FROM patients WHERE id=?", (pid,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "not_found"}), 404
    audit("delete", "patient", pid)
    return jsonify({"ok": True})

@app.get("/api/patients/<int:pid>")
@require_auth
def get_patient(pid):
    p = patient_summary(row("SELECT * FROM patients WHERE id=?", (pid,)))
    if not p:
        return jsonify({"error": "not_found"}), 404
    p.update({
        "allergies": rows("SELECT * FROM allergies WHERE patient_id=? AND active=1", (pid,)),
        "systemic_medications": rows("SELECT * FROM systemic_medications WHERE patient_id=? AND active=1", (pid,)),
        "medical_history": rows("SELECT * FROM medical_history WHERE patient_id=? ORDER BY onset_date", (pid,)),
        "diagnoses": rows("SELECT * FROM diagnoses WHERE patient_id=? AND status!='resolved' ORDER BY is_primary DESC, created_at DESC", (pid,)),
        "mrn": p["mrn"],
    })
    audit("view", "patient", pid)
    return jsonify({"patient": p})

@app.get("/api/patients/<int:pid>/chart")
@require_auth
def patient_chart(pid):
    """Full clinical timeline for the chart view."""
    p = patient_summary(row("SELECT * FROM patients WHERE id=?", (pid,)))
    if not p:
        return jsonify({"error": "not_found"}), 404
    enc_list = rows("SELECT * FROM encounters WHERE patient_id=? ORDER BY encounter_date DESC, id DESC", (pid,))
    encounters = []
    for e in enc_list:
        e["eyes"] = rows("SELECT * FROM eye_findings WHERE encounter_id=?", (e["id"],))
        e["diagnoses"] = rows("SELECT * FROM diagnoses WHERE encounter_id=?", (e["id"],))
        e["medications"] = rows("SELECT * FROM medications WHERE encounter_id=?", (e["id"],))
        e["injections"] = rows("SELECT * FROM injections WHERE encounter_id=?", (e["id"],))
        e["lasers"] = rows("SELECT * FROM lasers WHERE encounter_id=?", (e["id"],))
        e["imaging"] = rows("SELECT * FROM imaging WHERE encounter_id=?", (e["id"],))
        e["follow_ups"] = rows("SELECT * FROM follow_ups WHERE encounter_id=?", (e["id"],))
        encounters.append(e)
    injections = rows("""SELECT i.*, p.name_given_en, p.name_family_en, p.mrn FROM injections i
                         JOIN patients p ON p.id=i.patient_id WHERE i.patient_id=? ORDER BY i.procedure_date""", (pid,))
    imaging = rows("""SELECT im.*, p.name_given_en, p.name_family_en FROM imaging im
                      JOIN patients p ON p.id=im.patient_id WHERE im.patient_id=? ORDER BY im.test_date""", (pid,))
    vf = rows("""SELECT test_date, metrics FROM imaging WHERE patient_id=? AND test_type='vf'
                 ORDER BY test_date""", (pid,))
    octs = rows("""SELECT test_date, laterality, metrics FROM imaging WHERE patient_id=? AND test_type='oct'
                   ORDER BY test_date""", (pid,))
    iops = rows("""SELECT e.encounter_date, ef.laterality, ef.iop FROM eye_findings ef
                   JOIN encounters e ON e.id=ef.encounter_id WHERE e.patient_id=? AND ef.iop IS NOT NULL
                   ORDER BY e.encounter_date""", (pid,))
    data = {
        "patient": p,
        "encounters": encounters,
        "injections": injections,
        "imaging": imaging,
        "vf": vf,
        "octs": octs,
        "iops": iops,
        "follow_ups": rows("SELECT * FROM follow_ups WHERE patient_id=? ORDER BY next_due_date", (pid,)),
    }
    audit("view", "chart", pid)
    return jsonify(data)

# ── ENCOUNTERS ────────────────────────────────────────────────────

def _eye_row(eval_):
    """Build eye_findings insert row from nested dict."""
    f = eval_ or {}
    return (
        f.get("ucva_dist"), f.get("ucva_near"), f.get("bcva_dist"), f.get("bcva_near"), f.get("pinhole"),
        f.get("sph"), f.get("cyl"), f.get("axis"), f.get("add"), f.get("pd"),
        f.get("refraction_type") or "manifest",
        f.get("iop"), f.get("iop_method") or "Goldmann", f.get("cct"),
        f.get("eyelids"), f.get("conjunctiva"), f.get("cornea"), f.get("ac_depth"), f.get("ac_cells"),
        f.get("ac_flare"), f.get("iris"), f.get("pupil_mm"), f.get("rapd"),
        f.get("lens_status"), f.get("cataract_type"), f.get("cataract_grade"), f.get("iol_type"),
        f.get("vitreous"), f.get("macula"), f.get("cst_um"), f.get("srf"), f.get("irf"),
        f.get("cdr"), f.get("rim"), f.get("rnfl_um"), f.get("retina"), f.get("hemorrhage"),
        f.get("exudates"), f.get("neovascularization"), f.get("laser_scars"),
        f.get("anterior_notes"), f.get("posterior_notes"),
    )

@app.post("/api/encounters")
@require_role("ophthalmologist", "resident", "optometrist")
def create_encounter():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid:
        return jsonify({"error": "patient_id required"}), 400
    eid = run("""INSERT INTO encounters(patient_id, encounter_date, encounter_type, specialty, attending_id,
                 reason, chief_complaint, vitals_bp, vitals_pulse, vitals_weight, plan, follow_up_days, notes,
                 created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_date") or datetime.date.today().isoformat(),
               body.get("encounter_type") or "follow_up", body.get("specialty"),
               body.get("attending_id") or g.user["id"], body.get("reason"), body.get("chief_complaint"),
               body.get("vitals_bp"), body.get("vitals_pulse"), body.get("vitals_weight"),
               body.get("plan"), body.get("follow_up_days"), body.get("notes"), g.user["id"]))
    for lat in ("OD", "OS"):
        f = body.get("eyes", {}).get(lat)
        if f and any(v is not None and v != "" for v in f.values()):
            vals = _eye_row(f)
            run("INSERT INTO eye_findings(encounter_id, laterality, ucva_dist, ucva_near, bcva_dist, bcva_near,"
                " pinhole, sph, cyl, axis, \"add\", pd, refraction_type, iop, iop_method, cct,"
                " eyelids, conjunctiva, cornea, ac_depth, ac_cells, ac_flare, iris, pupil_mm, rapd,"
                " lens_status, cataract_type, cataract_grade, iol_type,"
                " vitreous, macula, cst_um, srf, irf, cdr, rim, rnfl_um, retina, hemorrhage, exudates,"
                " neovascularization, laser_scars, anterior_notes, posterior_notes)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (eid, lat) + vals)
    for dx in (body.get("diagnoses") or []):
        if dx.get("icd10"):
            run("INSERT INTO diagnoses(patient_id, encounter_id, icd10, description, laterality, stage, is_primary)"
                " VALUES(?,?,?,?,?,?,0)",
                (pid, eid, dx["icd10"], dx.get("description"), dx.get("laterality") or "OU", dx.get("stage")))
    for med in (body.get("medications") or []):
        if med.get("drug"):
            run("INSERT INTO medications(patient_id, encounter_id, medication_type, drug, strength, route, frequency,"
                " eye, indication) VALUES(?,?,?,?,?,?,?,?,?)",
                (pid, eid, med.get("medication_type") or "ocular", med["drug"], med.get("strength"),
                 med.get("route"), med.get("frequency"), med.get("eye") or "OU", med.get("indication")))
    if body.get("follow_up_days"):
        run("INSERT INTO follow_ups(patient_id, encounter_id, follow_up_type, laterality, interval_days, next_due_date,"
            " urgency, instructions, created_by) VALUES(?,?,?,?,?,?,?,?,?)",
            (pid, eid, body.get("follow_up_type") or "routine", "OU", body["follow_up_days"],
             (datetime.date.today() + datetime.timedelta(days=body["follow_up_days"])).isoformat(),
             body.get("urgency") or "routine", body.get("follow_up_instructions"), g.user["id"]))
    audit("create", "encounter", eid, {"patient": pid})
    return jsonify({"id": eid}), 201

@app.get("/api/encounters/<int:eid>")
@require_auth
def get_encounter(eid):
    e = row("SELECT * FROM encounters WHERE id=?", (eid,))
    if not e:
        return jsonify({"error": "not_found"}), 404
    e["eyes"] = rows("SELECT * FROM eye_findings WHERE encounter_id=? ORDER BY laterality", (eid,))
    e["diagnoses"] = rows("SELECT * FROM diagnoses WHERE encounter_id=?", (eid,))
    e["medications"] = rows("SELECT * FROM medications WHERE encounter_id=?", (eid,))
    e["injections"] = rows("SELECT * FROM injections WHERE encounter_id=?", (eid,))
    e["lasers"] = rows("SELECT * FROM lasers WHERE encounter_id=?", (eid,))
    e["imaging"] = rows("SELECT * FROM imaging WHERE encounter_id=?", (eid,))
    return jsonify({"encounter": e})

@app.delete("/api/encounters/<int:eid>")
@require_role("ophthalmologist", "resident", "admin")
def delete_encounter(eid):
    db = get_db()
    cur = db.execute("SELECT patient_id FROM encounters WHERE id=?", (eid,))
    enc = cur.fetchone()
    if not enc:
        return jsonify({"error": "not_found"}), 404
    db.execute("DELETE FROM eye_findings WHERE encounter_id=?", (eid,))
    db.execute("DELETE FROM diagnoses WHERE encounter_id=?", (eid,))
    db.execute("DELETE FROM medications WHERE encounter_id=?", (eid,))
    db.execute("DELETE FROM billing_items WHERE encounter_id=?", (eid,))
    db.execute("DELETE FROM encounters WHERE id=?", (eid,))
    db.commit()
    audit("delete", "encounter", eid, {"patient_id": enc["patient_id"]})
    return jsonify({"ok": True})

# ── INJECTIONS ────────────────────────────────────────────────────

@app.post("/api/injections")
@require_role("ophthalmologist", "resident")
def create_injection():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("drug"):
        return jsonify({"error": "patient_id and drug required"}), 400
    # decrement inventory
    db = get_db()
    inv = db.execute("SELECT * FROM inventory_items WHERE lower(generic_name)=lower(?) AND category='drug' LIMIT 1",
                     (body["drug"],)).fetchone()
    if inv:
        qty = float(body.get("volume_units") or inv["unit_of_measure"])
        new_stock = max(0.0, inv["current_stock"] - qty)
        db.execute("UPDATE inventory_items SET current_stock=? WHERE id=?", (new_stock, inv["id"]))
        db.execute("INSERT INTO inventory_movements(item_id, change_qty, reason, ref_patient_id, ref_type, user_id,"
                   " balance_after) VALUES(?,?, 'injection', ?, 'injection', ?, ?)",
                   (inv["id"], -qty, pid, g.user["id"], new_stock))
    iid = run("""INSERT INTO injections(patient_id, encounter_id, procedure_date, laterality, drug, dose_mg,
                 volume_ml, lot_number, manufacturer, expiry_date, consent, pre_iop, pre_va, preop_antiseptic,
                 site, gauge, technique, post_drops, performed_by, post_iop, post_va, complications,
                 complication_notes, series_number, treatment_line, interval_days, indication, response,
                 next_due_date, next_interval_days) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_id"), body.get("procedure_date") or datetime.date.today().isoformat(),
               body.get("laterality") or "OD", body.get("drug"), body.get("dose_mg"), body.get("volume_ml"),
               body.get("lot_number"), body.get("manufacturer"), body.get("expiry_date"),
               1 if body.get("consent") else 0, body.get("pre_iop"), body.get("pre_va"),
               body.get("preop_antiseptic"), body.get("site"), body.get("gauge"), body.get("technique"),
               body.get("post_drops"), body.get("performed_by") or g.user["id"],
               body.get("post_iop"), body.get("post_va"), body.get("complications") or "None",
               body.get("complication_notes"), body.get("series_number"), body.get("treatment_line"),
               body.get("interval_days"), body.get("indication"), body.get("response"),
               body.get("next_due_date"), body.get("next_interval_days")))
    db.commit()
    audit("create", "injection", iid, {"patient": pid, "drug": body.get("drug")})
    return jsonify({"id": iid}), 201

@app.get("/api/injections")
@require_auth
def list_injections():
    q = (request.args.get("q") or "").strip()
    where, params = "", []
    if q:
        where = " WHERE (p.name_given_en LIKE ? OR p.name_family_en LIKE ? OR p.mrn LIKE ? OR i.drug LIKE ?)"
        params = [f"%{q}%"] * 4
    data = rows(f"""SELECT i.*, p.name_given_en, p.name_family_en, p.mrn, u.name_en AS dr_name
                    FROM injections i JOIN patients p ON p.id=i.patient_id
                    LEFT JOIN users u ON u.id=i.performed_by
                    {where} ORDER BY i.procedure_date DESC LIMIT 200""", params)
    return jsonify({"injections": data})

@app.get("/api/injections/series/<int:pid>")
@require_auth
def injection_series(pid):
    data = rows("""SELECT i.*, p.name_given_en, p.name_family_en, p.mrn, u.name_en AS dr_name
                   FROM injections i JOIN patients p ON p.id=i.patient_id
                   LEFT JOIN users u ON u.id=i.performed_by
                   WHERE i.patient_id=? ORDER BY i.procedure_date""", (pid,))
    return jsonify({"injections": data})

# ── LASERS / SURGERIES ────────────────────────────────────────────

@app.post("/api/lasers")
@require_role("ophthalmologist", "resident")
def create_laser():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("laser_type"):
        return jsonify({"error": "patient_id and laser_type required"}), 400
    lid = run("""INSERT INTO lasers(patient_id, encounter_id, procedure_date, laterality, laser_type, indication,
                 power_mw, duration_ms, spot_size_um, num_spots, pattern, anesthesia, pre_iop, post_iop, pre_va,
                 post_va, complications, sessions_total, sessions_completed, consent, performed_by)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_id"), body.get("procedure_date") or datetime.date.today().isoformat(),
               body.get("laterality") or "OD", body.get("laser_type"), body.get("indication"),
               body.get("power_mw"), body.get("duration_ms"), body.get("spot_size_um"), body.get("num_spots"),
               body.get("pattern"), body.get("anesthesia"),
               body.get("pre_iop"), body.get("post_iop"), body.get("pre_va"), body.get("post_va"),
               body.get("complications"), body.get("sessions_total"), body.get("sessions_completed"),
               1 if body.get("consent") else 0, body.get("performed_by") or g.user["id"]))
    audit("create", "laser", lid, {"patient": pid})
    return jsonify({"id": lid}), 201

@app.get("/api/lasers")
@require_auth
def list_lasers():
    data = rows("""SELECT l.*, p.name_given_en, p.name_family_en, p.mrn
                   FROM lasers l JOIN patients p ON p.id=l.patient_id
                   ORDER BY l.procedure_date DESC LIMIT 200""")
    return jsonify({"lasers": data})

@app.post("/api/surgeries")
@require_role("ophthalmologist")
def create_surgery():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid:
        return jsonify({"error": "patient_id required"}), 400
    sid = run("""INSERT INTO surgeries(patient_id, surgery_type, laterality, scheduled_date, actual_date, surgeon_id,
                 status, al_mm, k1, k2, acd_mm, lt_mm, wtw_mm, iol_formula, target_refraction, iol_power, iol_model,
                 iol_type, technique, anesthesia, risk_notes)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("surgery_type"), body.get("laterality") or "OD",
               body.get("scheduled_date"), body.get("actual_date"), body.get("surgeon_id") or g.user["id"],
               body.get("status") or "scheduled", body.get("al_mm"), body.get("k1"), body.get("k2"),
               body.get("acd_mm"), body.get("lt_mm"), body.get("wtw_mm"), body.get("iol_formula"),
               body.get("target_refraction"), body.get("iol_power"), body.get("iol_model"),
               body.get("iol_type"), body.get("technique"), body.get("anesthesia"), body.get("risk_notes")))
    audit("create", "surgery", sid, {"patient": pid})
    return jsonify({"id": sid}), 201

@app.get("/api/surgeries")
@require_auth
def list_surgeries():
    data = rows("""SELECT s.*, p.name_given_en, p.name_family_en, p.mrn
                   FROM surgeries s JOIN patients p ON p.id=s.patient_id
                   ORDER BY s.scheduled_date DESC LIMIT 200""")
    return jsonify({"surgeries": data})

# ── IMAGING ───────────────────────────────────────────────────────

@app.post("/api/imaging")
@require_role("ophthalmologist", "technician", "optometrist")
def create_imaging():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("test_type"):
        return jsonify({"error": "patient_id and test_type required"}), 400
    iid = run("""INSERT INTO imaging(patient_id, encounter_id, test_type, test_date, laterality, device,
                 file_path, thumbnail_path, dicom_uid, metrics, report_text, ai_flag, ai_summary, created_by)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_id"), body.get("test_type"),
               body.get("test_date") or datetime.date.today().isoformat(),
               body.get("laterality") or "OU", body.get("device"), body.get("file_path"),
               body.get("thumbnail_path"), body.get("dicom_uid"),
               json.dumps(body.get("metrics") or {}), body.get("report_text"),
               1 if body.get("ai_flag") else 0, body.get("ai_summary"), g.user["id"]))
    audit("create", "imaging", iid, {"patient": pid, "test": body.get("test_type")})
    return jsonify({"id": iid}), 201

@app.get("/api/imaging")
@require_auth
def list_imaging():
    q = (request.args.get("q") or "").strip()
    where, params = "", []
    if q:
        where = " WHERE (p.name_given_en LIKE ? OR p.mrn LIKE ?)"
        params = [f"%{q}%", f"%{q}%"]
    data = rows(f"""SELECT im.*, p.name_given_en, p.name_family_en, p.mrn
                    FROM imaging im JOIN patients p ON p.id=im.patient_id
                    {where} ORDER BY im.test_date DESC LIMIT 200""", params)
    return jsonify({"imaging": data})

# ── MEDICATIONS ───────────────────────────────────────────────────

@app.post("/api/medications")
@require_role("ophthalmologist", "resident")
def create_medication():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("drug"):
        return jsonify({"error": "patient_id and drug required"}), 400
    mid = run("""INSERT INTO medications(patient_id, encounter_id, medication_type, drug, strength, route, frequency,
                 eye, indication, adherence) VALUES(?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_id"), body.get("medication_type") or "ocular",
               body.get("drug"), body.get("strength"), body.get("route"), body.get("frequency"),
               body.get("eye") or "OU", body.get("indication"), body.get("adherence")))
    audit("create", "medication", mid, {"patient": pid})
    return jsonify({"id": mid}), 201

# ── FOLLOW-UPS ────────────────────────────────────────────────────

@app.get("/api/follow-ups")
@require_auth
def list_followups():
    scope = request.args.get("scope", "all")
    today = datetime.date.today().isoformat()
    overdue_sql = "f.next_due_date < ? AND f.status IN ('pending','confirmed')"
    where = overdue_sql if scope == "overdue" else "1=1"
    params = [today] if scope == "overdue" else []
    data = rows(f"""SELECT f.*, p.name_given_en, p.name_family_en, p.phone, p.mrn, d.name_en AS dr_name
                    FROM follow_ups f JOIN patients p ON p.id=f.patient_id
                    LEFT JOIN encounters e ON e.id=f.encounter_id
                    LEFT JOIN users d ON d.id=e.attending_id
                    WHERE {where} ORDER BY f.next_due_date LIMIT 200""", params)
    return jsonify({"follow_ups": data})

@app.post("/api/follow-ups")
@require_role("ophthalmologist", "resident", "admin")
def create_followup():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("next_due_date"):
        return jsonify({"error": "patient_id and next_due_date required"}), 400
    fid = run("""INSERT INTO follow_ups(patient_id, encounter_id, diagnosis_id, follow_up_type, laterality,
                 interval_days, next_due_date, urgency, instructions, recall_method, created_by)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
              (pid, body.get("encounter_id"), body.get("diagnosis_id"),
               body.get("follow_up_type") or "routine", body.get("laterality") or "OU",
               body.get("interval_days"), body.get("next_due_date"), body.get("urgency") or "routine",
               body.get("instructions"), body.get("recall_method") or "none", g.user["id"]))
    audit("create", "follow_up", fid, {"patient": pid})
    return jsonify({"id": fid}), 201

@app.put("/api/follow-ups/<int:fid>")
@require_auth
def update_followup(fid):
    body = request.get_json(force=True, silent=True) or {}
    sets, params = [], []
    for f in ["status", "recall_response", "instructions", "next_due_date"]:
        if f in body:
            sets.append(f" {f}=?")
            params.append(body.get(f))
    if not sets:
        return jsonify({"error": "no_fields"}), 400
    params.append(fid)
    get_db().execute(f"UPDATE follow_ups SET{','.join(sets)} WHERE id=?", params)
    get_db().commit()
    audit("update", "follow_up", fid)
    return jsonify({"ok": True})

# ── BILLING ───────────────────────────────────────────────────────

BILLING_TEMPLATES = [
    {"name": "Comprehensive exam", "cpt": "92004", "price": 60.0},
    {"name": "Follow-up exam", "cpt": "92012", "price": 40.0},
    {"name": "OCT macula (per eye)", "cpt": "92134", "price": 45.0},
    {"name": "OCT optic nerve (per eye)", "cpt": "92133", "price": 45.0},
    {"name": "Visual field 24-2", "cpt": "92083", "price": 50.0},
    {"name": "Fundus photography", "cpt": "92250", "price": 35.0},
    {"name": "Intravitreal injection", "cpt": "67028", "price": 120.0},
    {"name": "Intravitreal dexamethasone implant", "cpt": "67027", "price": 220.0},
    {"name": "Panretinal photocoagulation", "cpt": "67210", "price": 180.0},
    {"name": "Focal laser", "cpt": "67228", "price": 150.0},
    {"name": "YAG capsulotomy", "cpt": "66821", "price": 130.0},
    {"name": "SLT", "cpt": "65855", "price": 160.0},
    {"name": "Phacoemulsification + IOL", "cpt": "66984", "price": 750.0},
    {"name": "Gonioscopy", "cpt": "92020", "price": 25.0},
]

@app.get("/api/billing/templates")
@require_auth
def billing_templates():
    return jsonify({"templates": BILLING_TEMPLATES})

@app.post("/api/billing/items")
@require_role("ophthalmologist", "billing", "admin")
def add_billing_item():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    if not pid or not body.get("item_name"):
        return jsonify({"error": "patient_id and item_name required"}), 400
    qty = float(body.get("quantity") or 1)
    price = float(body.get("unit_price") or 0)
    run("INSERT INTO billing_items(patient_id, encounter_id, item_name, cpt_code, quantity, unit_price, total)"
        " VALUES(?,?,?,?,?,?,?)",
        (pid, body.get("encounter_id"), body["item_name"], body.get("cpt_code"), qty, price, qty * price))
    return jsonify({"ok": True}), 201

@app.get("/api/billing")
@require_auth
def billing_summary():
    items = rows("""SELECT bi.*, p.name_given_en, p.name_family_en, p.mrn
                    FROM billing_items bi JOIN patients p ON p.id=bi.patient_id
                    ORDER BY bi.id DESC LIMIT 200""")
    return jsonify({"items": items})

@app.get("/api/invoices")
@require_auth
def list_invoices():
    data = rows("""SELECT iv.*, p.name_given_en, p.name_family_en, p.mrn
                   FROM invoices iv JOIN patients p ON p.id=iv.patient_id
                   ORDER BY iv.date DESC LIMIT 200""")
    out = []
    for i in data:
        i["items"] = rows("SELECT * FROM invoice_items WHERE invoice_id=?", (i["id"],))
        i["balance"] = max(0.0, float(i["total"]) - float(i["paid"]))
        out.append(i)
    return jsonify({"invoices": out})

@app.post("/api/invoices")
@require_role("billing", "admin")
def create_invoice():
    body = request.get_json(force=True, silent=True) or {}
    pid = body.get("patient_id")
    items = body.get("items") or []
    if not pid or not items:
        return jsonify({"error": "patient_id and items required"}), 400
    db = get_db()
    subtotal = sum(float(i.get("quantity") or 1) * float(i.get("unit_price") or 0) for i in items)
    discount = float(body.get("discount") or 0)
    tax = float(body.get("tax") or 0)
    total = subtotal - discount + tax
    no = "INV-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S") + secrets.token_hex(2).upper()
    iv = db.execute("INSERT INTO invoices(invoice_no, patient_id, encounter_id, date, subtotal, discount, tax, total,"
                    " status, created_by) VALUES(?,?,?,?,?,?,?,?, 'unpaid', ?)",
                    (no, pid, body.get("encounter_id"), body.get("date") or datetime.date.today().isoformat(),
                     subtotal, discount, tax, total, g.user["id"])).lastrowid
    for i in items:
        qty = float(i.get("quantity") or 1)
        price = float(i.get("unit_price") or 0)
        db.execute("INSERT INTO invoice_items(invoice_id, item_name, cpt_code, quantity, unit_price, total)"
                   " VALUES(?,?,?,?,?,?)", (iv, i.get("item_name"), i.get("cpt_code"), qty, price, qty * price))
    # link billing items if encounter given
    if body.get("encounter_id"):
        db.execute("DELETE FROM billing_items WHERE encounter_id=? AND patient_id=?",
                   (body["encounter_id"], pid))
    db.commit()
    audit("create", "invoice", iv, {"patient": pid, "total": total})
    return jsonify({"id": iv, "invoice_no": no}), 201

@app.post("/api/invoices/<int:iv>/pay")
@require_role("billing", "admin")
def pay_invoice(iv):
    body = request.get_json(force=True, silent=True) or {}
    amount = float(body.get("amount") or 0)
    inv = row("SELECT * FROM invoices WHERE id=?", (iv,))
    if not inv:
        return jsonify({"error": "not_found"}), 404
    new_paid = float(inv["paid"]) + amount
    status = "paid" if new_paid >= float(inv["total"]) - 0.001 else "partial"
    run("UPDATE invoices SET paid=?, status=?, payment_method=? WHERE id=?",
        (new_paid, status, body.get("payment_method"), iv))
    audit("update", "invoice", iv, {"payment": amount})
    return jsonify({"ok": True, "paid": new_paid, "status": status})

# ── INVENTORY ─────────────────────────────────────────────────────

@app.get("/api/inventory")
@require_auth
def list_inventory():
    data = rows("SELECT * FROM inventory_items ORDER BY category, name")
    for it in data:
        it["low_stock"] = float(it["current_stock"]) <= float(it["minimum_stock"])
    return jsonify({"items": data})

@app.post("/api/inventory")
@require_role("billing", "admin")
def create_inventory():
    body = request.get_json(force=True, silent=True) or {}
    if not body.get("name") or not body.get("category"):
        return jsonify({"error": "name and category required"}), 400
    iid = run("""INSERT INTO inventory_items(category, name, generic_name, manufacturer, sku, unit_of_measure,
                 current_stock, minimum_stock, unit_cost, selling_price, lot_number, expiry_date)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
              (body["category"], body["name"], body.get("generic_name"), body.get("manufacturer"),
               body.get("sku"), body.get("unit_of_measure"), body.get("current_stock") or 0,
               body.get("minimum_stock") or 5, body.get("unit_cost") or 0, body.get("selling_price") or 0,
               body.get("lot_number"), body.get("expiry_date")))
    run("INSERT INTO inventory_movements(item_id, change_qty, reason, user_id, balance_after)"
        " VALUES(?,?, 'initial', ?, ?)",
        (iid, body.get("current_stock") or 0, g.user["id"], body.get("current_stock") or 0))
    audit("create", "inventory", iid)
    return jsonify({"id": iid}), 201

@app.post("/api/inventory/<int:iid>/movement")
@require_role("billing", "admin", "nurse")
def inventory_movement(iid):
    body = request.get_json(force=True, silent=True) or {}
    change = float(body.get("change_qty") or 0)
    inv = row("SELECT * FROM inventory_items WHERE id=?", (iid,))
    if not inv:
        return jsonify({"error": "not_found"}), 404
    new_stock = max(0.0, float(inv["current_stock"]) + change)
    run("UPDATE inventory_items SET current_stock=? WHERE id=?", (new_stock, iid))
    run("INSERT INTO inventory_movements(item_id, change_qty, reason, ref_patient_id, user_id, balance_after)"
        " VALUES(?,?,?,?,?,?)", (iid, change, body.get("reason") or "adjust", body.get("ref_patient_id"),
                                 g.user["id"], new_stock))
    audit("update", "inventory", iid, {"change": change})
    return jsonify({"ok": True, "current_stock": new_stock})

@app.get("/api/inventory/movements")
@require_auth
def inventory_movements_list():
    data = rows("""SELECT m.*, it.name AS item_name, p.name_given_en, p.name_family_en, u.name_en AS user_name
                   FROM inventory_movements m JOIN inventory_items it ON it.id=m.item_id
                   LEFT JOIN patients p ON p.id=m.ref_patient_id
                   LEFT JOIN users u ON u.id=m.user_id
                   ORDER BY m.id DESC LIMIT 200""")
    return jsonify({"movements": data})

# ── REPORTS ───────────────────────────────────────────────────────

@app.get("/api/reports/overview")
@require_auth
def report_overview():
    db = get_db()
    today = datetime.date.today().isoformat()
    month_start = (datetime.date.today().replace(day=1)).isoformat()
    out = {
        "patients_total": row("SELECT COUNT(*) c FROM patients")["c"],
        "encounters_month": row("SELECT COUNT(*) c FROM encounters WHERE encounter_date >= ?", (month_start,))["c"],
        "injections_month": row("SELECT COUNT(*) c FROM injections WHERE procedure_date >= ?", (month_start,))["c"],
        "injections_total": row("SELECT COUNT(*) c FROM injections")["c"],
        "injections_today": row("SELECT COUNT(*) c FROM injections WHERE procedure_date=?", (today,))["c"],
        "overdue_recalls": row("SELECT COUNT(*) c FROM follow_ups WHERE next_due_date < ? AND status IN ('pending','confirmed')", (today,))["c"],
        "due_this_week": row("SELECT COUNT(*) c FROM follow_ups WHERE next_due_date BETWEEN ? AND date(?, '+7 days')", (today, today))["c"],
        "invoices_unpaid": row("SELECT IFNULL(SUM(total-paid),0) s FROM invoices WHERE status IN ('unpaid','partial')")["s"],
        "surgeries_scheduled": row("SELECT COUNT(*) c FROM surgeries WHERE status IN ('planned','scheduled')")["c"],
        "pending_billing": row("SELECT IFNULL(SUM(total),0) s FROM billing_items WHERE encounter_id NOT IN (SELECT encounter_id FROM invoices WHERE encounter_id IS NOT NULL)")["s"],
    }
    out["drug_usage"] = rows("""SELECT drug, COUNT(*) n FROM injections GROUP BY drug ORDER BY n DESC""")
    out["injection_volume_30d"] = rows("""SELECT date(procedure_date) d, COUNT(*) n FROM injections
                                          WHERE procedure_date >= date('now','-30 days')
                                          GROUP BY d ORDER BY d""")
    out["icd_volume"] = rows("""SELECT d.icd10, d.description, COUNT(*) n FROM diagnoses d
                                WHERE d.encounter_id IS NOT NULL GROUP BY d.icd10 ORDER BY n DESC LIMIT 10""")
    return jsonify(out)

@app.get("/api/reports/registry/<kind>")
@require_auth
def registry(kind):
    today = datetime.date.today().isoformat()
    rows_ = []
    if kind == "dr":
        rows_ = get_db().execute("""
            SELECT p.id AS patient_id, p.name_given_en, p.name_family_en, p.mrn, p.phone, p.city,
                   d.icd10, d.description, d.stage, d.laterality, d.status AS dx_status,
                   (SELECT MAX(e.encounter_date) FROM encounters e WHERE e.patient_id=p.id) AS last_visit,
                   (SELECT MAX(f.next_due_date) FROM follow_ups f WHERE f.patient_id=p.id
                     AND (f.follow_up_type='routine')) AS next_due
            FROM patients p
            JOIN diagnoses d ON d.patient_id=p.id AND d.status!='resolved'
            WHERE d.icd10 LIKE 'E11%'
            ORDER BY p.name_family_en
        """).fetchall()
    elif kind == "glaucoma":
        rows_ = get_db().execute("""
            SELECT p.id AS patient_id, p.name_given_en, p.name_family_en, p.mrn, p.phone,
                   d.icd10, d.description, d.laterality,
                   (SELECT MAX(e.encounter_date) FROM encounters e WHERE e.patient_id=p.id) AS last_visit,
                   (SELECT MAX(f.next_due_date) FROM follow_ups f WHERE f.patient_id=p.id) AS next_due,
                   (SELECT MAX(ef.iop) FROM eye_findings ef JOIN encounters e ON e.id=ef.encounter_id
                        WHERE e.patient_id=p.id) AS last_iop
            FROM patients p
            JOIN diagnoses d ON d.patient_id=p.id AND d.status!='resolved'
            WHERE d.icd10 LIKE 'H40%'
            ORDER BY p.name_family_en
        """).fetchall()
    elif kind == "amd":
        rows_ = get_db().execute("""
            SELECT p.id AS patient_id, p.name_given_en, p.name_family_en, p.mrn, p.phone,
                   d.icd10, d.description, d.laterality,
                   (SELECT MAX(e.encounter_date) FROM encounters e WHERE e.patient_id=p.id) AS last_visit,
                   (SELECT COUNT(*) FROM injections i WHERE i.patient_id=p.id) AS total_injections,
                   (SELECT MAX(f.next_due_date) FROM follow_ups f WHERE f.patient_id=p.id) AS next_due
            FROM patients p
            JOIN diagnoses d ON d.patient_id=p.id AND d.status!='resolved'
            WHERE d.icd10 LIKE 'H35.3%'
            ORDER BY p.name_family_en
        """).fetchall()
    else:
        return jsonify({"error": "unknown registry"}), 400
    return jsonify({"rows": [dict(r) for r in rows_],
                    "overdue": row("SELECT COUNT(*) c FROM follow_ups WHERE next_due_date < ?", (today,))["c"]})

@app.get("/api/reports/revenue")
@require_auth
def report_revenue():
    db = get_db()
    out = rows("""SELECT date, SUM(total) AS revenue, SUM(paid) AS collected, COUNT(*) AS invoices
                  FROM invoices GROUP BY date ORDER BY date DESC LIMIT 30""")
    totals = row("SELECT IFNULL(SUM(total),0) revenue, IFNULL(SUM(paid),0) collected,"
                 " IFNULL(SUM(total-paid),0) outstanding FROM invoices")
    return jsonify({"daily": out, "totals": totals})

@app.get("/api/reports/injections")
@require_auth
def report_injections():
    by_drug = rows("SELECT drug, COUNT(*) n, MIN(procedure_date) first, MAX(procedure_date) last"
                   " FROM injections GROUP BY drug ORDER BY n DESC")
    by_eye = rows("SELECT laterality, COUNT(*) n FROM injections GROUP BY laterality")
    by_month = rows("""SELECT strftime('%Y-%m', procedure_date) m, COUNT(*) n FROM injections
                       GROUP BY m ORDER BY m DESC LIMIT 12""")
    return jsonify({"by_drug": by_drug, "by_eye": by_eye, "by_month": by_month})

@app.get("/api/reports/ops")
@require_role("ophthalmologist", "billing", "admin")
def report_ops():
    data = {
        "encounters_by_type": rows("SELECT encounter_type, COUNT(*) n FROM encounters GROUP BY encounter_type"),
        "encounters_by_specialty": rows("SELECT IFNULL(specialty,'general') specialty, COUNT(*) n FROM encounters GROUP BY specialty"),
        "no_show_proxy": None,
    }
    return jsonify(data)

# ── AUDIT ─────────────────────────────────────────────────────────

@app.get("/api/audit")
@require_role("admin")
def audits():
    data = rows("""SELECT a.*, u.name_en AS user_name, u.username FROM audit_log a
                   LEFT JOIN users u ON u.id=a.user_id
                   ORDER BY a.id DESC LIMIT 200""")
    return jsonify({"audits": data})

# ── STATIC FRONTEND ───────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")

@app.get("/<path:path>")
def static_files(path):
    try:
        return send_from_directory(STATIC, path)
    except Exception:
        return "Not found", 404

# ── PATIENT FILES (photos / OCT) ──────────────────────────────────

def ensure_files_table():
    try:
        get_db().execute("""CREATE TABLE IF NOT EXISTS patient_files(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            file_name TEXT,
            stored_name TEXT,
            mime TEXT,
            kind TEXT,
            size INTEGER,
            uploaded_by INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )""")
        get_db().commit()
    except Exception:
        pass

@app.get("/api/patients/<int:pid>/files")
@require_auth
def list_patient_files(pid):
    ensure_files_table()
    p = row("SELECT id FROM patients WHERE id=?", (pid,))
    if not p:
        return jsonify({"error": "not_found"}), 404
    files = rows("SELECT id, patient_id, file_name, mime, kind, size, created_at FROM patient_files WHERE patient_id=? ORDER BY id DESC", (pid,))
    return jsonify({"files": files})

@app.post("/api/patients/<int:pid>/files")
@require_role("ophthalmologist", "resident", "optometrist", "technician", "nurse", "receptionist", "admin")
def upload_patient_file(pid):
    ensure_files_table()
    p = row("SELECT id FROM patients WHERE id=?", (pid,))
    if not p:
        return jsonify({"error": "not_found"}), 404
    kind = (request.form.get("kind") or "photo").strip().lower()
    if kind not in ("photo", "oct"):
        kind = "photo"
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "no_file"}), 400
    orig = secure_filename(f.filename) or "file"
    # insert row first to get id
    fid = run("INSERT INTO patient_files(patient_id, file_name, mime, kind, size, uploaded_by) VALUES(?,?,?,?,?,?)",
              (pid, orig, f.mimetype or "", kind, 0, g.user["id"]))
    ext = os.path.splitext(orig)[1] or ""
    stored = f"{fid}_{orig}"
    # ensure dir
    dest_dir = os.path.join(UPLOAD_ROOT, str(pid))
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, stored)
    f.save(dest)
    size = os.path.getsize(dest) if os.path.exists(dest) else 0
    get_db().execute("UPDATE patient_files SET stored_name=?, size=? WHERE id=?", (stored, size, fid))
    get_db().commit()
    audit("upload", "patient_file", fid, {"patient_id": pid, "kind": kind, "file": orig})
    return jsonify({"ok": True, "file": dict(row("SELECT id, patient_id, file_name, mime, kind, size, created_at FROM patient_files WHERE id=?", (fid,)))}), 201

@app.get("/api/patients/<int:pid>/files/<int:fid>/raw")
@require_auth
def raw_patient_file(pid, fid):
    ensure_files_table()
    rec = row("SELECT * FROM patient_files WHERE id=? AND patient_id=?", (fid, pid))
    if not rec:
        return jsonify({"error": "not_found"}), 404
    stored = rec["stored_name"] or rec["file_name"]
    dest_dir = os.path.join(UPLOAD_ROOT, str(pid))
    return send_from_directory(dest_dir, stored)

@app.delete("/api/patients/<int:pid>/files/<int:fid>")
@require_role("ophthalmologist", "resident", "admin")
def delete_patient_file(pid, fid):
    ensure_files_table()
    rec = row("SELECT * FROM patient_files WHERE id=? AND patient_id=?", (fid, pid))
    if not rec:
        return jsonify({"error": "not_found"}), 404
    stored = rec["stored_name"] or rec["file_name"]
    dest = os.path.join(UPLOAD_ROOT, str(pid), stored)
    try:
        if os.path.exists(dest):
            os.remove(dest)
    except Exception:
        pass
    get_db().execute("DELETE FROM patient_files WHERE id=?", (fid,))
    get_db().commit()
    audit("delete", "patient_file", fid, {"patient_id": pid})
    return jsonify({"ok": True})

# ── BACKUP / GOOGLE DRIVE SYNC ────────────────────────────────────
# Backs up the SQLite database + uploads into a local folder that the
# free Google Drive desktop app auto-syncs to the cloud.

CFG = os.path.join(HERE, "data", "config.json")

def get_config():
    try:
        with open(CFG, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def set_config(**kw):
    cfg = get_config()
    cfg.update(kw)
    try:
        with open(CFG, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass
    return cfg

def backup_now():
    cfg = get_config()
    folder = (cfg.get("backup_folder") or "").strip()
    if not folder:
        return {"error": "no_backup_folder"}
    folder = os.path.abspath(os.path.expandvars(os.path.expanduser(folder)))
    if not os.path.isdir(folder):
        try:
            os.makedirs(folder, exist_ok=True)
        except Exception as e:
            return {"error": "mkdir:" + str(e)}
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zpath = os.path.join(folder, "emr_backup_" + stamp + ".zip")
    tmpdb = os.path.join(folder, ".snapshot_emr.db")
    try:
        if os.path.exists(tmpdb):
            os.remove(tmpdb)
        src = sqlite3.connect(DB)
        src.execute("VACUUM INTO " + json.dumps(tmpdb))
        src.close()
    except Exception as e:
        try:
            shutil.copy2(DB, tmpdb)
        except Exception as e2:
            return {"error": str(e) + " / " + str(e2)}
    try:
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(tmpdb, "emr.db")
            uploads = os.path.join(HERE, "data", "uploads")
            if os.path.isdir(uploads):
                for root, _, files in os.walk(uploads):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        z.write(fp, os.path.relpath(fp, HERE))
        try:
            os.remove(tmpdb)
        except Exception:
            pass
    except Exception as e:
        return {"error": "zip:" + str(e)}
    cfg = set_config(last_backup=stamp, last_backup_file=os.path.basename(zpath))
    return {"ok": True, "file": os.path.basename(zpath), "folder": folder, "last_backup": stamp}

@app.route("/api/settings/backup", methods=["GET"])
@require_role("admin")
def backup_conf():
    cfg = get_config()
    return jsonify({"backup_folder": cfg.get("backup_folder", ""),
                    "last_backup": cfg.get("last_backup"),
                    "last_backup_file": cfg.get("last_backup_file")})

@app.route("/api/settings/backup", methods=["POST"])
@require_role("admin")
def set_backup_conf():
    body = request.get_json(force=True, silent=True) or {}
    folder = (body.get("backup_folder") or "").strip()
    set_config(backup_folder=folder)
    return jsonify({"ok": True, "backup_folder": folder})

@app.post("/api/backup/run")
@require_role("admin")
def run_backup_endpoint():
    res = backup_now()
    if res.get("error"):
        return jsonify({"error": res["error"]}), 500
    audit("backup", "system", details={"file": res.get("file"), "folder": res.get("folder")})
    return jsonify(res)

@app.post("/api/backup/restore")
@require_role("admin")
def restore_backup():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "no_file"}), 400
    if not f.filename.lower().endswith(".zip"):
        return jsonify({"error": "need_zip"}), 400
    tmpzip = os.path.join(HERE, "data", "_restore_upload.zip")
    try:
        f.save(tmpzip)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    try:
        with zipfile.ZipFile(tmpzip, "r") as z:
            names = z.namelist()
            if "emr.db" not in names:
                return jsonify({"error": "zip_no_emr.db"}), 400
            tmpdb = os.path.join(HERE, "data", "_restore_emr.db")
            if os.path.exists(tmpdb):
                try: os.remove(tmpdb)
                except: pass
            with z.open("emr.db") as src, open(tmpdb, "wb") as dst:
                shutil.copyfileobj(src, dst)
            # validate
            try:
                ck = sqlite3.connect(tmpdb)
                ck.execute("SELECT count(*) FROM sqlite_master").fetchone()
                ck.close()
            except Exception as e:
                return jsonify({"error": "invalid_db: " + str(e)}), 400
            # close current request DB
            db = getattr(g, "_db", None)
            if db is not None:
                try: db.close()
                except: pass
                g._db = None
            for suf in ["", "-wal", "-shm"]:
                p = DB + suf
                if os.path.exists(p) and os.path.abspath(p) != os.path.abspath(tmpdb):
                    try: os.remove(p)
                    except: pass
            shutil.move(tmpdb, DB)
            # restore uploads
            uploads_root = os.path.join(HERE, "data", "uploads")
            # clear existing uploads
            if os.path.exists(uploads_root):
                try: shutil.rmtree(uploads_root)
                except: pass
            for name in names:
                if name.startswith("data/uploads/") and not name.endswith("/"):
                    dest = os.path.join(HERE, name)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with z.open(name) as src, open(dest, "wb") as dst:
                        shutil.copyfileobj(src, dst)
        try: os.remove(tmpzip)
        except: pass
        audit("restore", "system", details={"file": f.filename})
        return jsonify({"ok": True})
    except zipfile.BadZipFile:
        return jsonify({"error": "bad_zip"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _auto_backup_loop():
    time.sleep(15)
    while True:
        cfg = get_config()
        if cfg.get("backup_folder"):
            try:
                backup_now()
            except Exception:
                pass
        time.sleep(24 * 3600)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    threading.Thread(target=_auto_backup_loop, daemon=True).start()
    print(f"\n  Ophthalmology EMR  —  http://{host}:{port}  (LAN: http://<your-laptop-IP>:{port})\n  Logins: admin/admin123, dr.ihab/demo123")
    app.run(host=host, port=port, debug=False, threaded=True)
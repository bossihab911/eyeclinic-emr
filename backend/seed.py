"""Seed the ophthalmic EMR database with reference data and demo patients."""
import os, sqlite3, hashlib, secrets, datetime, json

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "data", "emr.db")

def connect():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    return sqlite3.connect(DB)

def hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120000).hex()
    return h, salt

def d(day_offset):
    return (datetime.date.today() - datetime.timedelta(days=day_offset)).strftime("%Y-%m-%d")

ROLES = [
    ("ophthalmologist", "Ophthalmologist", "طبيب عيون",
     {"view_all": True, "notes": "full", "diagnoses": True, "orders": True,
      "procedures": True, "billing_view": True, "reports": True, "admin": False}),
    ("resident", "Resident", "مقيم",
     {"view_all": False, "notes": "create", "diagnoses": True, "orders": True,
      "procedures": True, "billing_view": True, "reports": False, "admin": False}),
    ("optometrist", "Optometrist", "أخصائي بصريات",
     {"view_all": True, "notes": "limited", "diagnoses": True, "orders": False,
      "procedures": False, "billing_view": False, "reports": False, "admin": False}),
    ("technician", "Technician", "فني",
     {"view_all": True, "notes": False, "diagnoses": False, "orders": False,
      "procedures": False, "billing_view": False, "reports": False, "admin": False}),
    ("nurse", "Nurse", "ممرض/ة",
     {"view_all": True, "notes": False, "diagnoses": False, "orders": False,
      "procedures": True, "billing_view": False, "reports": False, "admin": False}),
    ("receptionist", "Receptionist", "موظف استقبال",
     {"view_all": False, "notes": False, "diagnoses": False, "orders": False,
      "procedures": False, "billing_view": False, "reports": False, "admin": False}),
    ("billing", "Billing Staff", "موظف حسابات",
     {"view_all": False, "notes": False, "diagnoses": False, "orders": False,
      "procedures": False, "billing_view": True, "reports": True, "admin": False}),
    ("admin", "Administrator", "مدير النظام",
     {"view_all": True, "notes": "full", "diagnoses": True, "orders": True,
      "procedures": True, "billing_view": True, "reports": True, "admin": True}),
]

USERS = [
    ("dr.ihab", "Ihab Haj Hassan", "إيهاب حاج حسن", "ophthalmologist", "demo123"),
    ("dr.karim", "Karim Haddad", "كريم حداد", "ophthalmologist", "demo123"),
    ("dr.nadia", "Nadia Azar", "ناديا عازر", "ophthalmologist", "demo123"),
    ("dr.omar", "Omar Farhat", "عمر فرحات", "resident", "demo123"),
    ("r.rana", "Rana Kfoury", "رنا خوري", "receptionist", "demo123"),
    ("t.eleni", "Eleni Mansour", "إيليني منصور", "technician", "demo123"),
    ("n.shahin", "Rita Shahin", "ريتا شاهين", "nurse", "demo123"),
    ("o.bassam", "Bassam Tawil", "بسام طويل", "optometrist", "demo123"),
    ("b.sara", "Sara Mrad", "سارة مراد", "billing", "demo123"),
    ("admin", "System Admin", "مدير النظام", "admin", "admin123"),
]

ICD10 = [
    ("E11.311", "Type 2 DM with unspecified diabetic retinopathy", "Type 2 diabetes mellitus with unspecified diabetic retinopathy", "retina"),
    ("E11.319", "T2DM without diabetic retinopathy", "Type 2 diabetes mellitus without diabetic retinopathy", "retina"),
    ("E11.321", "T2DM with mild/moderate NPDR", "Type 2 diabetes mellitus with mild or moderate nonproliferative diabetic retinopathy with macular edema", "retina"),
    ("E11.341", "T2DM with severe NPDR", "Type 2 diabetes mellitus with severe nonproliferative diabetic retinopathy", "retina"),
    ("E11.351", "T2DM with PDR", "Type 2 diabetes mellitus with proliferative diabetic retinopathy", "retina"),
    ("E11.345", "T2DM with CSME", "Type 2 diabetes mellitus with clinically significant macular edema", "retina"),
    ("H35.311", "Non-exudative AMD", "Nonexudative age-related macular degeneration", "retina"),
    ("H35.321", "Exudative AMD, OD", "Exudative age-related macular degeneration, right eye", "retina"),
    ("H35.322", "Exudative AMD, OS", "Exudative age-related macular degeneration, left eye", "retina"),
    ("H35.051", "Retinal vein occlusion OD", "Retinal vein occlusion, right eye", "retina"),
    ("H40.111", "POAG, mild stage", "Primary open-angle glaucoma, mild stage, right eye", "glaucoma"),
    ("H40.112", "POAG, moderate stage", "Primary open-angle glaucoma, moderate stage", "glaucoma"),
    ("H40.113", "POAG, severe stage", "Primary open-angle glaucoma, severe stage", "glaucoma"),
    ("H40.021", "Ocular hypertension OD", "Ocular hypertension, right eye", "glaucoma"),
    ("H40.22", "Chronic angle-closure glaucoma", "Chronic angle-closure glaucoma", "glaucoma"),
    ("H40.8322", "Pseudoexfoliation glaucoma OS", "Pseudoexfoliation glaucoma, left eye", "glaucoma"),
    ("H25.11", "Age-related nuclear cataract OD", "Age-related nuclear cataract, right eye", "cataract"),
    ("H25.32", "Age-related nuclear cataract OS", "Age-related nuclear cataract, left eye", "cataract"),
    ("H25.041", "Posterior subcapsular cataract OD", "Age-related posterior subcapsular cataract, right eye", "cataract"),
    ("H26.011", "Immature senile cataract", "Immature senile cataract", "cataract"),
    ("H20.011", "Anterior uveitis OD", "Acute and subacute iridocyclitis, right eye", "uveitis"),
    ("H30.65", "Macular scar", "Macular scar", "retina"),
    ("Z96.1", "Intraocular lens status", "Presence of intraocular lens", "general"),
    ("H52.011", "Hypermetropia, right eye", "Hypermetropia, right eye", "refraction"),
    ("H52.111", "Myopia, right eye", "Myopia, right eye", "refraction"),
    ("H18.601", "Bullous keratopathy", "Bullous keratopathy", "cornea"),
    ("H17.013", "Corneal leukemia", "Central corneal opacity", "cornea"),
    ("H00.02", "Chalazion", "Chalazion", "eyelid"),
    ("H01.003", "Blepharitis", "Unspecified blepharitis", "eyelid"),
    ("H02.401", "Ptosis, right eyelid", "Unspecified ptosis of right eyelid", "eyelid"),
    ("H04.121", "Chronic dacryoadenitis", "Chronic dacryoadenitis, right lacrimal gland", "lacrimal"),
    ("H10.023", "Mucopurulent conjunctivitis", "Other mucopurulent conjunctivitis, bilateral", "conjunctiva"),
    ("H11.001", "Pterygium, right eye", "Pterygium of right eye", "conjunctiva"),
    ("H15.012", "Episcleritis, left eye", "Episcleritis, left eye", "sclera"),
    ("H16.122", "Keratoconjunctivitis", "Keratoconjunctivitis", "cornea"),
    ("H18.611", "Keratoconus, right eye", "Keratoconus, right eye", "cornea"),
    ("H21.001", "Hyphema, right eye", "Hyphema, right eye", "anterior"),
    ("H25.12", "Senile nuclear cataract", "Age-related nuclear cataract", "cataract"),
    ("H26.21", "Neovascular cataract", "Cataract with neovascularization", "cataract"),
    ("H27.10", "Aphakia", "Aphakia", "lens"),
    ("H30.03", "Posterior cyclitis", "Posterior cyclitis, bilateral", "uveitis"),
    ("H31.02", "Choroidal dystrophy", "Hereditary choroidal dystrophy", "retina"),
    ("H33.011", "Retinal detachment, right eye", "Retinal detachment with single break, right eye", "retina"),
    ("H33.20", "Serous retinal detachment", "Serous retinal detachment", "retina"),
    ("H34.812", "Central retinal vein occlusion", "Central retinal vein occlusion, left eye", "retina"),
    ("H35.30", "Macular degeneration", "Unspecified macular degeneration", "retina"),
    ("H35.32", "Drusen, macula", "Drusen (degenerative) of macula", "retina"),
    ("H35.81", "Retinal edema", "Retinal edema", "retina"),
    ("H40.003", "Glaucoma suspect", "Preglaucoma, unspecified", "glaucoma"),
    ("H40.10", "Ocular hypertension", "Ocular hypertension", "glaucoma"),
    ("H40.221", "Acute angle-closure glaucoma", "Acute angle-closure glaucoma, right eye", "glaucoma"),
    ("H43.11", "Vitreous hemorrhage, right", "Vitreous hemorrhage, right eye", "vitreous"),
    ("H43.311", "Vitreous detachment, right", "Vitreous detachment, right eye", "vitreous"),
    ("H44.20", "Degenerative myopia", "Degenerative myopia, bilateral", "refraction"),
    ("H46.01", "Optic papillitis, right", "Optic papillitis, right eye", "optic nerve"),
    ("H47.213", "Optic atrophy, bilateral", "Optic atrophy, bilateral", "optic nerve"),
    ("H49.01", "Third nerve palsy, right", "Third [oculomotor] nerve palsy, right eye", "strabismus"),
    ("H50.00", "Strabismus", "Unspecified strabismus", "strabismus"),
    ("H52.00", "Hypermetropia", "Hypermetropia", "refraction"),
    ("H52.10", "Myopia", "Myopia", "refraction"),
    ("H52.20", "Astigmatism", "Astigmatism", "refraction"),
    ("H52.40", "Presbyopia", "Presbyopia", "refraction"),
    ("H53.02", "Diplopia", "Diplopia", "visual"),
    ("H53.041", "Amblyopia, right eye", "Amblyopia, right eye", "visual"),
    ("H54.0", "Blindness, both eyes", "Blindness, both eyes", "visual"),
    ("Z01.00", "Eye examination", "Encounter for examination of eyes and vision without abnormal findings", "general"),
]

INVENTORY = [
    ("drug", "Bevacizumab 100mg/4ml", "Bevacizumab", "Roche", "AVE-BEV-100", "vial", 24, 8, 55.0, 180.0, "BEV23071", "2026-12-31"),
    ("drug", "Ranibizumab 0.5mg/0.05ml", "Ranibizumab", "Novartis", "AVE-RANI-05", "vial", 10, 4, 850.0, 1350.0, "RAN23112", "2027-03-31"),
    ("drug", "Aflibercept 2mg", "Aflibercept", "Bayer", "AVE-AFL-02", "vial", 15, 5, 700.0, 1150.0, "AFL23458", "2027-06-30"),
    ("drug", "Faricimab 6mg", "Faricimab", "Roche", "AVE-FAR-06", "vial", 8, 3, 950.0, 1480.0, "FAR23089", "2027-01-31"),
    ("drug", "Dexamethasone implant 0.7mg", "Dexamethasone", "AbbVie", "AVE-DEX-07", "implant", 5, 2, 1100.0, 1600.0, "DEX23412", "2027-05-31"),
    ("drug", "Triamcinolone 40mg/ml", "Triamcinolone", "Bristol", "AVE-TRI-40", "vial", 6, 2, 35.0, 90.0, "TRI23110", "2027-02-28"),
    ("drug", "Moxifloxacin 0.5% drops", "Moxifloxacin", "Alcon", "TOP-MOX-05", "bottle", 60, 20, 8.0, 15.0, "MOX23122", "2027-01-31"),
    ("drug", "Povidone iodine 5%", "Povidone iodine", "Medicom", "DIS-PVP5", "bottle", 30, 10, 4.0, 8.0, "PVP23055", "2027-08-31"),
    ("drug", "Prednisolone acetate 1%", "Prednisolone", "Allergan", "TOP-PRED-1", "bottle", 40, 15, 9.0, 18.0, "PRED23098", "2027-04-30"),
    ("drug", "Latanoprost 0.005%", "Latanoprost", "Pfizer", "TOP-LAT-005", "bottle", 50, 15, 10.0, 20.0, "LAT23077", "2027-03-31"),
    ("iol", "Alcon AcrySof IQ", "AcrySof IQ", "Alcon", "IOL-ACSQ", "piece", 40, 10, 95.0, 320.0, "IOL23031", "2028-12-31"),
    ("iol", "Alcon AcrySof IQ Toric", "AcrySof IQ Toric", "Alcon", "IOL-ACST", "piece", 12, 4, 135.0, 420.0, "IOL23115", "2028-09-30"),
    ("iol", "AMO Tecnis ZCB00", "Tecnis", "AMO", "IOL-TEC", "piece", 15, 5, 90.0, 300.0, "IOL23088", "2028-06-30"),
    ("disposable", "30G needle 12mm", "30G needle", "BD", "DIS-N30", "box", 100, 30, 3.0, 6.0, "", ""),
    ("disposable", "27G needle 25mm", "27G needle", "BD", "DIS-N27", "box", 80, 25, 3.5, 7.0, "", ""),
    ("disposable", "Lid speculum", "Wire speculum", "Medicom", "DIS-SPEC", "piece", 50, 15, 4.0, 8.0, "", ""),
]

def add_enc(cur, pid, days_ago, etype, specialty, reason, findings, dx=None, follow_days=None, plan="", by=1):
    eid = cur.execute(
        "INSERT INTO encounters(patient_id, encounter_date, encounter_type, specialty, attending_id, reason,"
        " chief_complaint, plan, follow_up_days, created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (pid, d(days_ago), etype, specialty, by, reason, reason, plan, follow_days, by)).lastrowid
    for lat in ("OD", "OS"):
        f = (findings or {}).get(lat)
        if not f:
            continue
        cur.execute(
            "INSERT INTO eye_findings("
            "encounter_id, laterality, ucva_dist, ucva_near, bcva_dist, bcva_near, pinhole,"
            "sph, cyl, axis, \"add\", pd, refraction_type, iop, iop_method, cct,"
            "eyelids, conjunctiva, cornea, ac_depth, ac_cells, ac_flare, iris, pupil_mm, rapd,"
            "lens_status, cataract_type, cataract_grade, iol_type,"
            "vitreous, macula, cst_um, srf, irf, cdr, rim, rnfl_um, retina, hemorrhage, exudates,"
            "neovascularization, laser_scars, anterior_notes, posterior_notes)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, lat, f.get("ucva"), f.get("ucva_near"), f.get("bcva"), f.get("bcva_near"), f.get("pinhole"),
             f.get("sph"), f.get("cyl"), f.get("axis"), f.get("add"), f.get("pd"), f.get("refraction_type") or "manifest",
             f.get("iop"), f.get("iop_method") or "Goldmann", f.get("cct"),
             f.get("eyelids"), f.get("conjunctiva"), f.get("cornea"), f.get("ac_depth"), f.get("ac_cells"),
             f.get("ac_flare"), f.get("iris"), f.get("pupil"), f.get("rapd"),
             f.get("lens_status"), f.get("cataract_type"), f.get("cataract_grade"), f.get("iol_type"),
             f.get("vitreous"), f.get("macula"), f.get("cst"), f.get("srf"), f.get("irf"),
             f.get("cdr"), f.get("rim"), f.get("rnfl"), f.get("retina"), f.get("hemorrhage"), f.get("exudates"),
             f.get("nv"), f.get("laser"), f.get("an_notes"), f.get("post_notes")))
    for x in (dx or []):
        cur.execute("INSERT INTO diagnoses(patient_id, encounter_id, icd10, description, laterality, stage, status, is_primary)"
                    " VALUES(?,?,?,?,?,?, 'active', 0)", (pid, eid, x[0], x[1], x[2], x[3]))
    if follow_days:
        cur.execute("INSERT INTO follow_ups(patient_id, encounter_id, follow_up_type, interval_days, next_due_date,"
                    " urgency, status, created_by) VALUES(?,?, 'routine',?,?, 'routine','done',?)",
                    (pid, eid, follow_days, d(follow_days - days_ago), by))
    return eid

def add_inj(cur, pid, eid, days_ago, eye, drug, dose, lot, pre_iop, pre_va, post_iop, post_va, series_no,
            treatment_line, interval_days, indication, response, next_interval, complications="None", performed_by=1):
    cur.execute("INSERT INTO injections(patient_id, encounter_id, procedure_date, laterality, drug, dose_mg, volume_ml,"
                " lot_number, consent, pre_iop, pre_va, site, gauge, performed_by, post_iop, post_va, complications,"
                " series_number, treatment_line, interval_days, indication, response, next_due_date, next_interval_days)"
                " VALUES(?,?,?,?,?,?,?,?,1,?,?, 'ST', '30G', ?,?,?,?,?,?,?,?,?,?,?)",
                (pid, eid, d(days_ago), eye, drug, dose, "0.05ml", lot, pre_iop, pre_va, performed_by,
                 post_iop, post_va, complications, series_no, treatment_line, interval_days, indication, response,
                 d(days_ago - next_interval), next_interval))

def seed():
    with connect() as db:
        cur = db.cursor()
        for block in open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read().split(";"):
            if block.strip():
                cur.execute(block)
        # clean slate
        for t in ["eye_findings","encounters","diagnoses","injections","lasers","surgeries","imaging",
                   "medications","follow_ups","allergies","systemic_medications","medical_history","patients",
                   "patient_files",
                   "inventory_items","inventory_movements","billing_items","invoices","invoice_items","audit_log",
                   "sessions","icd10_codes","users","roles"]:
            cur.execute("DELETE FROM " + t)
        for r in ROLES:
            cur.execute("INSERT INTO roles(name,label_en,label_ar,permissions) VALUES(?,?,?,?)",
                        (r[0], r[1], r[2], json.dumps(r[3])))
        role_id = dict(cur.execute("SELECT name, id FROM roles").fetchall())
        for u in USERS:
            h, salt = hash_pw(u[4])
            cur.execute("INSERT INTO users(username,password_hash,salt,role_id,name_en,name_ar) VALUES(?,?,?,?,?,?)",
                        (u[0], h, salt, role_id[u[3]], u[1], u[2]))
        cur.executemany("INSERT INTO icd10_codes(code,short_desc,full_desc,category) VALUES(?,?,?,?)", ICD10)
        cur.executemany("INSERT INTO inventory_items(category,name,generic_name,manufacturer,sku,unit_of_measure,"
                        "current_stock,minimum_stock,unit_cost,selling_price,lot_number,expiry_date)"
                        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", INVENTORY)
        user_ids = dict(cur.execute("SELECT username, id FROM users").fetchall())
        dr = user_ids["dr.karim"]

        def _new_patient(mrn, given_en, fam_en, given_ar, fam_ar, dob, sex, phone, city, insurance, lang,
                         allo=(), sys=(), hist=(), dx=(None, "", "OU", "")):
            pid = cur.execute("INSERT INTO patients(mrn,name_given_en,name_family_en,name_given_ar,name_family_ar,"
                              "dob,sex,phone,city,insurance_provider,preferred_language) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                              (mrn, given_en, fam_en, given_ar, fam_ar, dob, sex, phone, city, insurance, lang)).lastrowid
            for a in allo:
                cur.execute("INSERT INTO allergies(patient_id,allergen,reaction,severity) VALUES(?,?,?,?)", (pid, *a))
            for s in sys:
                cur.execute("INSERT INTO systemic_medications(patient_id,drug,dose,frequency,indication) VALUES(?,?,?,?,?)",
                            (pid, s[0], s[1], s[2], s[3]))
            for h in hist:
                cur.execute("INSERT INTO medical_history(patient_id,condition_name,icd10,onset_date) VALUES(?,?,?,?)",
                            (pid, h[0], h[1], h[2]))
            if dx[0]:
                cur.execute("INSERT INTO diagnoses(patient_id,icd10,description,laterality,stage,status,is_primary,onset_date)"
                            " VALUES(?,?,?,?,?, 'active',1,?)", (pid, dx[0], dx[1], dx[2], dx[3], d(150)))
            return pid

        # ---------- Patient 1: Ahmad Khalil — DR / CSME ----------
        p1 = _new_patient("OI0001", "Ahmad", "Khalil", "أحمد", "خليل", "1954-03-12", "M", "03 456 789", "Beirut",
                          "NSSF", "ar", hist=[("Diabetes mellitus type 2", "E11.9", d(4000)),
                                               ("Hypertension", "I10", d(5000))],
                          dx=("E11.345", "Type 2 DM with CSME", "OU", "Moderate NPDR with CSME"))
        e = add_enc(cur, p1, 0, "follow_up", "retina", "Routine injection visit",
                    {"OD": dict(ucva="20/80", bcva="20/50", sph=-1.5, cyl=-1.0, axis=95, iop=15, cct=545,
                                lens_status="Phakic", cataract_type="Nuclear", macula="Edema", cst=330, srf="No",
                                irf="Yes", retina="Attached", hemorrhage="Dot-blot", exudates="Hard"),
                     "OS": dict(ucva="20/30", bcva="20/25", sph=-1.0, cyl=-0.75, axis=88, iop=14, cct=550,
                                lens_status="Phakic", cataract_type="Nuclear", macula="Mild", cst=290, srf="No",
                                irf="No", retina="Attached", hemorrhage="Dot-blot", exudates="Hard")},
                    dx=[("E11.345", "Type 2 DM with CSME", "OD", "Moderate NPDR")], follow_days=28,
                    plan="Continue anti-VEGF OD series (visit 7)", by=dr)
        add_inj(cur, p1, e, 0, "OD", "Aflibercept", "2mg", "AFL23458", 15, "20/80", 16, "20/50", 7, "1st line", 28,
                "DME", "Improved", 28, performed_by=dr)
        e = add_enc(cur, p1, 28, "follow_up", "retina", "Injection visit",
                    {"OD": dict(ucva="20/80", bcva="20/50", iop=15, cst=320, srf="No", irf="Yes", macula="Edema"),
                     "OS": dict(ucva="20/30", bcva="20/25", iop=14, cst=290)},
                    dx=None, follow_days=30, plan="Continue series", by=dr)
        add_inj(cur, p1, e, 28, "OD", "Bevacizumab", "1.25mg", "BEV23071", 15, "20/80", 14, "20/60", 6, "1st line", 28,
                "DME", "Stable", 28, performed_by=dr)

        # ---------- Patient 2: Layla Mansour — wet AMD OD ----------
        p2 = _new_patient("OI0002", "Layla", "Mansour", "ليلى", "منصور", "1962-07-25", "F", "03 112 233", "Jounieh",
                          "Private AXA", "ar", allo=[("Penicillin", "rash", "moderate")],
                          sys=[("Metformin", "850mg", "BID", "Diabetes")],
                          hist=[("Exudative AMD OD", "H35.321", d(600))],
                          dx=("H35.321", "Exudative age-related macular degeneration", "OD", "Wet AMD"))
        for i, days in enumerate([0, 21, 42, 63]):
            e = add_enc(cur, p2, days, "follow_up", "retina", "AMD injection visit",
                        {"OD": dict(ucva="20/60", bcva="20/40", sph=0.5, cyl=-0.75, axis=78, iop=13, cct=548,
                                    lens_status="Phakic", macula="Edema + CNV", cst=380 - i * 15, srf="Yes", irf="Yes",
                                    retina="Attached", neovascularization="CNV"),
                         "OS": dict(ucva="20/25", bcva="20/20", iop=12, cct=552, lens_status="Phakic",
                                    macula="Normal", cst=260)},
                        dx=[("H35.321", "Exudative AMD, OD", "OD", "Wet AMD")], follow_days=21,
                        plan="Continue aflibercept OD", by=dr)
            if i >= 1:
                add_inj(cur, p2, e, days, "OD", "Aflibercept", "2mg", "AFL23458", 13, "20/60", 14, "20/40",
                        i, "1st line", 21, "Wet AMD", "Improved", 21, performed_by=dr)

        # ---------- Patient 3: Georges Rahme — POAG ----------
        p3 = _new_patient("OI0003", "Georges", "Rahme", "جورج", "رحمة", "1949-11-02", "M", "03 889 900", "Zahle",
                          None, "en", allo=[("Iodine contrast", "hypotension", "severe")],
                          sys=[("Aspirin", "81mg", "QD", "Cardiac")],
                          hist=[("POAG", "H40.111", d(2250)), ("Hypertension", "I10", d(2800))],
                          dx=("H40.112", "POAG, moderate stage", "OU", "Moderate POAG"))
        for i, days in enumerate([0, 90, 180, 270, 365]):
            e = add_enc(cur, p3, days, "new" if i == 0 else "follow_up", "glaucoma", "Glaucoma review",
                        {"OD": dict(ucva="20/40", bcva="20/30", sph=-2.0, cyl=-1.0, axis=90, iop=21 - i,
                                    iop_method="Goldmann", cct=525, lens_status="Phakic", macula="Normal",
                                    cdr="0.7", rim="Thin", rnfl=72 - i * 2, retina="Attached", pallor="None"),
                         "OS": dict(ucva="20/50", bcva="20/35", sph=-2.5, cyl=-1.25, axis=95, iop=22 - i,
                                    iop_method="Goldmann", cct=520, lens_status="Phakic", macula="Normal",
                                    cdr="0.8", rim="Thin", rnfl=68 - i * 2, retina="Attached", pallor="None")},
                        dx=[("H40.112", "POAG, moderate", "OU", "Moderate POAG")], follow_days=90,
                        plan="Continue latanoprost; target IOP < 18", by=dr)
            cur.execute("INSERT INTO imaging(patient_id,test_type,test_date,laterality,device,metrics)"
                        " VALUES(?, 'vf', ?, 'OU', 'Humphrey HFA II', ?)",
                        (p3, d(days), json.dumps(dict(md=-3.5 - i, psd=2.8 + i * 0.3, vfi=88 - i * 2,
                                                      fp=2, fn=1, ght="Borderline", field="24-2"))))
            cur.execute("INSERT INTO imaging(patient_id,test_type,test_date,laterality,device,metrics)"
                        " VALUES(?, 'oct', ?, 'OD', 'Zeiss Cirrus 5000', ?)",
                        (p3, d(days), json.dumps(dict(cst=255, rnfl_avg=72 - i * 2, gcc=78 - i, cdr=0.7))))
            if i == 0:
                cur.execute("INSERT INTO medications(patient_id,encounter_id,medication_type,drug,strength,route,"
                            "frequency,eye,indication) VALUES(?,?, 'ocular','Latanoprost','0.005%','topical','QHS','OU','POAG')",
                            (p3, 0 if False else e))

        # ---------- Patient 4: Mariam Haddad — PDR ----------
        p4 = _new_patient("OI0004", "Mariam", "Haddad", "مريم", "حداد", "1968-01-19", "F", "70 554 412", "Tripoli",
                          "MedGulf", "ar", sys=[("Insulin glargine", "20U", "QHS", "Diabetes")],
                          hist=[("PDR", "E11.351", d(800))],
                          dx=("E11.351", "Proliferative diabetic retinopathy", "OU", "PDR treated"))
        e = add_enc(cur, p4, 30, "follow_up", "retina", "DR screening",
                    {"OD": dict(ucva="20/25", bcva="20/20", iop=16, cct=550, lens_status="Phakic", macula="Normal",
                                cst=280, retina="Attached", hemorrhage="Dot-blot", laser="PRP scars",
                                neovascularization="NVE"),
                     "OS": dict(ucva="20/20", bcva="20/20", iop=15, cct=548, lens_status="Phakic", macula="Normal",
                                cst=275, retina="Attached", hemorrhage="Dot-blot", laser="PRP scars",
                                neovascularization="NVD")},
                    dx=[("E11.351", "PDR", "OU", "PDR treated")], follow_days=180,
                    plan="Glycemic control; rescreen 6 months", by=dr)
        cur.execute("INSERT INTO lasers(patient_id,procedure_date,laterality,laser_type,indication,power_mw,"
                    "duration_ms,spot_size_um,num_spots,pattern,anesthesia,complications,consent,performed_by)"
                    " VALUES(?,?,'OU','PRP','PDR',450,100,300,1200,'Barrage','Topical','None',1,?)",
                    (p4, d(380), dr))

        # ---------- Patient 5: Youssef Sabbagh — wet AMD OS ----------
        p5 = _new_patient("OI0005", "Youssef", "Sabbagh", "يوسف", "صباغ", "1975-09-30", "M", "03 909 808", "Beirut",
                          "GIG", "en", allo=[("Sulfa", "anaphylaxis", "severe")],
                          hist=[("Macular hole surgery OS", "H35.34", d(400))],
                          dx=("H35.322", "Exudative AMD, left eye", "OS", "Wet AMD"))
        for i, days in enumerate([0, 42]):
            e = add_enc(cur, p5, days, "follow_up", "retina", "AMD OS injection",
                        {"OD": dict(ucva="20/20", bcva="20/20", iop=14, lens_status="Pseudophakic", iol_type="Monofocal",
                                    macula="Normal", cst=255),
                         "OS": dict(ucva="20/80", bcva="20/50", sph=0.25, cyl=-0.5, axis=120, iop=15,
                                    lens_status="Pseudophakic", iol_type="Monofocal", macula="Edema", cst=345,
                                    srf="Yes", irf="Yes", retina="Attached")},
                        dx=[("H35.322", "Exudative AMD, OS", "OS", "Wet AMD")], follow_days=42,
                        plan="Faricimab OS 6-weekly", by=dr)
            if i == 1:
                add_inj(cur, p5, e, days, "OS", "Faricimab", "6mg", "FAR23089", 15, "20/80", 16, "20/80",
                        1, "1st line", 42, "Wet AMD", "Improved", 42, performed_by=dr)

        # ---------- Patient 6: Nadine Mourad — uveitis ----------
        p6 = _new_patient("OI0006", "Nadine", "Mourad", "نادين", "مراد", "1981-04-14", "F", "70 223 344", "Byblos",
                          None, "ar", allo=[("Latex", "contact dermatitis", "mild")],
                          hist=[("Recurrent anterior uveitis", "H20.9", d(900))],
                          dx=("H20.011", "Anterior uveitis", "OD", "Acute anterior uveitis"))
        e = add_enc(cur, p6, 14, "new", "uveitis", "Red eye OD, photophobia",
                    {"OD": dict(ucva="20/60", bcva="20/40", iop=18, cct=545, conjunctiva="Injection", ac_depth="Deep",
                                ac_cells="2+", ac_flare="1+", iris="Normal", lens_status="Phakic", macula="Normal",
                                vitreous="Cells 1+", anterior_notes="Keratic precipitates"),
                     "OS": dict(ucva="20/20", bcva="20/20", iop=15, cct=550, lens_status="Phakic", macula="Normal")},
                    dx=[("H20.011", "Anterior uveitis", "OD", "Acute")], follow_days=14,
                    plan="Prednisolone acetate OD QID; cycloplegic; workup", by=dr)
        cur.execute("INSERT INTO medications(patient_id,encounter_id,medication_type,drug,strength,route,frequency,"
                    "eye,indication) VALUES(?,?, 'ocular','Prednisolone acetate','1%','topical','QID','OD','Uveitis')",
                    (p6, e))

        # ---------- Patient 7: Fadi Chami — cataract OS pre-op ----------
        p7 = _new_patient("OI0007", "Fadi", "Chami", "فادي", "شامي", "1958-12-05", "M", "03 667 778", "Saida",
                          "MedNet", "en", allo=[("Aspirin", "gastric upset", "mild")],
                          sys=[("Atorvastatin", "20mg", "QPM", "Hyperlipidemia")],
                          hist=[("Cataract surgery OD", "Z96.1", d(300))],
                          dx=("H25.32", "Age-related nuclear cataract OS", "OS", "NS 3+ Fuchs"))
        e = add_enc(cur, p7, 7, "pre_op", "cornea", "Cataract OS — biometry",
                    {"OD": dict(ucva="20/40", bcva="20/25", sph=-1.25, cyl=-0.75, axis=100, iop=15, cct=555,
                                lens_status="Pseudophakic", iol_type="Monofocal", macula="Normal", cst=250),
                     "OS": dict(ucva="20/100", bcva="20/60", sph=-4.0, cyl=-1.5, axis=80, iop=16, cct=548,
                                lens_status="Phakic", cataract_type="Nuclear", cataract_grade="3+", macula="Normal",
                                cst=265, cornea="Fuchs dystrophy", retina="Attached")},
                    dx=[("H25.32", "Nuclear cataract OS", "OS", "NS 3+")], follow_days=30,
                    plan="Phaco+IOL OS; biometry + topography ordered", by=dr)
        cur.execute("INSERT INTO surgeries(patient_id,surgery_type,laterality,status,al_mm,k1,k2,acd_mm,lt_mm,wtw_mm,"
                    "iol_formula,target_refraction,iol_power,iol_model,iol_type,technique,anesthesia,risk_notes)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (p7, "Phacoemulsification + IOL", "OS", "scheduled", 24.10, 43.20, 44.10, 3.20, 4.60, 11.80,
                     "Barrett II", -0.50, 20.50, "Alcon AcrySof IQ", "Monofocal", "Phaco chop", "Topical",
                     "Fuchs dystrophy G1"))

        # ---------- Patient 8: Salwa Tannous — CRVO OS ----------
        p8 = _new_patient("OI0008", "Salwa", "Tannous", "سلوى", "طنوس", "1965-06-21", "F", "03 401 250", "Jbeil",
                          "Al Ahli Farouk", "ar", allo=[("Morphine", "pruritus", "mild")],
                          sys=[("Metformin", "500mg", "BID", "Diabetes")],
                          hist=[("CRVO OS", "H35.051", d(200))],
                          dx=("H35.051", "Retinal vein occlusion, left eye", "OS", "CRVO with macular edema"))
        for i, days in enumerate([0, 56]):
            e = add_enc(cur, p8, days, "follow_up", "retina", "CRVO review",
                        {"OD": dict(ucva="20/20", bcva="20/20", iop=13, lens_status="Phakic", macula="Normal"),
                         "OS": dict(ucva="20/120", bcva="20/70", iop=14, lens_status="Phakic", macula="Edema",
                                    cst=420 - i * 90, srf="No", irf="Yes", hemorrhage="Flame", retina="Attached")},
                        dx=[("H35.051", "CRVO OS", "OS", "With CME")], follow_days=56,
                        plan="Dexamethasone implant OS", by=dr)
            cur.execute("INSERT INTO imaging(patient_id,test_type,test_date,laterality,device,metrics)"
                        " VALUES(?, 'oct', ?, 'OS', 'Topcon Triton', ?)",
                        (p8, d(days), json.dumps(dict(cst=420 - i * 90, srf=False, irf=True, mac_vol=9.1))))

        # ---------- Patient 9: Hassan Zreik — corneal scar ----------
        p9 = _new_patient("OI0009", "Hassan", "Zreik", "حسن", "زريق", "1970-08-08", "M", "71 903 201", "Baalbek",
                          None, "ar", sys=[("Omeprazole", "20mg", "QD", "GERD")],
                          hist=[("Keratitis OS", "H16", d(150))],
                          dx=("H17.013", "Corneal leukemia", "OS", "Leukoma"))
        add_enc(cur, p9, 20, "follow_up", "cornea", "Corneal graft review",
                {"OD": dict(ucva="20/40", bcva="20/30", iop=14, cct=560, lens_status="Phakic", macula="Normal",
                            cornea="Clear graft"),
                 "OS": dict(ucva="20/200", bcva="20/150", iop=17, cct=610, lens_status="Phakic", macula="Normal",
                            cornea="Central scar", anterior_notes="Post-herpetic leukoma")},
                dx=[("H17.013", "Corneal opacity OS", "OS", "Leukoma")], follow_days=90,
                plan="PKP OS on waitlist", by=dr)

        # ---------- Patient 10: Mona Fakhoury — PXF glaucoma ----------
        p10 = _new_patient("OI0010", "Mona", "Fakhoury", "منى", "فاخوري", "1951-02-17", "F", "03 774 466", "Beirut",
                           "GIG", "ar", allo=[("Penicillin", "hives", "moderate")],
                           sys=[("Warfarin", "3mg", "QD", "AF")],
                           hist=[("PXF glaucoma", "H40.8322", d(1200)), ("Cataract", "H26.011", d(200))],
                           dx=("H40.8322", "Pseudoexfoliation glaucoma", "OS", "PXF glaucoma"))
        for i, days in enumerate([0, 120, 240]):
            e = add_enc(cur, p10, days, "follow_up", "glaucoma", "PXF glaucoma review",
                        {"OD": dict(ucva="20/30", bcva="20/25", iop=18 + i * (-1), cct=535, lens_status="Phakic",
                                    cataract_type="Nuclear", cdr="0.5", rim="Thin", rnfl=88 - i * 4, macula="Normal"),
                         "OS": dict(ucva="20/40", bcva="20/30", iop=23 - i * 2, cct=530, lens_status="Phakic",
                                    cataract_type="Nuclear", cdr="0.8", rim="Notched", rnfl=70 - i * 5,
                                    macula="Normal", disc_edema="No")},
                        dx=[("H40.8322", "PXF glaucoma OS", "OS", "PXF")], follow_days=120,
                        plan="Latanoprost + brimonidine OS; consider SLT", by=dr)
            if i == 0:
                cur.execute("INSERT INTO imaging(patient_id,test_type,test_date,laterality,device,metrics)"
                            " VALUES(?, 'vf', ?, 'OU', 'Humphrey HFA II', ?)",
                            (p10, d(days), json.dumps(dict(md=-2.1, psd=2.2, vfi=95, field="24-2", ght="Borderline"))))
                cur.execute("INSERT INTO imaging(patient_id,test_type,test_date,laterality,device,metrics)"
                            " VALUES(?, 'oct', ?, 'OS', 'Heidelberg Spectralis', ?)",
                            (p10, d(days), json.dumps(dict(cst=270, rnfl_avg=70, gcc=75, cdr=0.8))))

        # Billing records
        import random as _r
        def add_invoice(pid, total, paid, status):
            no = "INV-%04d" % _r.randint(1000, 9999)
            iv = cur.execute("INSERT INTO invoices(invoice_no,patient_id,date,subtotal,discount,tax,total,paid,status)"
                             " VALUES(?,?,?,?,?,?,?,?,?)",
                             (no, pid, d(5), total, 0, 0, total, paid, status)).lastrowid
            cur.execute("INSERT INTO invoice_items(invoice_id,item_name,quantity,unit_price,total)"
                        " VALUES(?,?,1,?,?)", (iv, "Comprehensive exam", total, total))
        add_invoice(1, 180, 0, "unpaid")
        add_invoice(2, 180, 180, "paid")
        add_invoice(3, 260, 100, "partial")

        # default views
        for t in ["eye_findings","encounters","diagnoses","injections","lasers","surgeries","imaging",
                  "medications","follow_ups","billing_items","invoices","invoice_items"]:
            cur.execute("SELECT COUNT(*) FROM " + t)
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Seed complete ->", DB)
    print("Logins: admin/admin123; staff users demo123 (dr.karim, t.eleni, ...)")

if __name__ == "__main__":
    seed()
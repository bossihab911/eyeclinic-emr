-- Ophthalmology EMR - Core Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users & roles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,          -- ophthalmologist | resident | optometrist | technician | nurse | receptionist | billing | admin
  label_en    TEXT NOT NULL,
  label_ar    TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '{}'     -- JSON capabilities
);

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt         TEXT NOT NULL,
  role_id      INTEGER NOT NULL REFERENCES roles(id),
  name_en      TEXT NOT NULL,
  name_ar      TEXT,
  email        TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  token       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

-- ── Audit log (append-only, tamper-evident via hash chain) ───────
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,                  -- create | update | delete | view | login | logout
  resource   TEXT NOT NULL,
  resource_id TEXT,
  details    TEXT,                           -- JSON: {old:{},new:{}}
  ip         TEXT,
  prev_hash  TEXT,
  hash       TEXT
);

-- ── Patients ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn                TEXT NOT NULL UNIQUE,
  name_given_en      TEXT,
  name_family_en     TEXT,
  name_given_ar      TEXT,
  name_family_ar     TEXT,
  dob                TEXT,                   -- YYYY-MM-DD
  sex                TEXT,                   -- M | F
  phone              TEXT,
  phone_secondary    TEXT,
  email              TEXT,
  address            TEXT,
  city               TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',   -- en | ar
  insurance_provider TEXT,
  insurance_policy   TEXT,
  insurance_expiry   TEXT,
  referring_physician TEXT,
  status             TEXT NOT NULL DEFAULT 'active',  -- active | inactive | deceased
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS allergies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen   TEXT NOT NULL,
  reaction   TEXT,
  severity   TEXT DEFAULT 'moderate',        -- mild | moderate | severe
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS systemic_medications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  drug       TEXT NOT NULL,
  dose       TEXT,
  frequency  TEXT,
  indication TEXT,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medical_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  icd10      TEXT,
  onset_date TEXT,
  status     TEXT DEFAULT 'active'
);

-- ── Encounters ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encounters (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_date  TEXT NOT NULL DEFAULT (date('now')),
  encounter_type  TEXT NOT NULL DEFAULT 'follow_up',
  specialty       TEXT,                      -- retina | glaucoma | cornea | comprehensive | uveitis
  attending_id    INTEGER REFERENCES users(id),
  reason          TEXT,
  chief_complaint TEXT,
  vitals_bp       TEXT,
  vitals_pulse    TEXT,
  vitals_weight   TEXT,
  plan            TEXT,
  follow_up_days  INTEGER,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Per-eye findings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eye_findings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  encounter_id INTEGER NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  laterality   TEXT NOT NULL,                -- OD | OS | OU
  -- Visual acuity
  ucva_dist    TEXT, ucva_near TEXT, bcva_dist TEXT, bcva_near TEXT,
  pinhole      TEXT,                          -- improved | no | partial
  va_method    TEXT,                          -- snellen | logmar
  -- Refraction
  sph REAL, cyl REAL, axis REAL, "add" REAL, pd REAL,
  prism TEXT,
  refraction_type TEXT,                       -- manifest | cycloplegic | over-refraction
  -- IOP
  iop REAL, iop_method TEXT, iop_time TEXT, cct REAL, cct_corrected INTEGER DEFAULT 0,
  -- Anterior segment
  eyelids TEXT, conjunctiva TEXT, cornea TEXT, cornea_notes TEXT,
  ac_depth TEXT, ac_cells TEXT, ac_flare TEXT, hyphema TEXT, iris TEXT,
  pupil_mm TEXT, rapd TEXT,
  lens_status TEXT, cataract_type TEXT, cataract_grade TEXT,
  iol_type TEXT, iol_power TEXT, iol_position TEXT,
  -- Posterior segment
  vitreous TEXT, macula TEXT, cst_um INTEGER, macular_volume_mm3 REAL,
  srf TEXT, irf TEXT,
  cdr TEXT, rim TEXT, rnfl_um INTEGER, disc_edema TEXT, pallor TEXT,
  retina TEXT, hemorrhage TEXT, exudates TEXT, neovascularization TEXT,
  laser_scars TEXT,
  anterior_notes TEXT, posterior_notes TEXT,
  ophthalmoscopy_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (laterality IN ('OD','OS','OU'))
);

CREATE INDEX IF NOT EXISTS idx_eyes_encounter ON eye_findings(encounter_id);
CREATE INDEX IF NOT EXISTS idx_enc_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_enc_date ON encounters(encounter_date);

-- ── Diagnoses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnoses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  icd10       TEXT,
  description TEXT,
  laterality  TEXT DEFAULT 'OU',             -- OD | OS | OU
  stage       TEXT,                          -- e.g. mild NPDR, wet AMD...
  status      TEXT DEFAULT 'active',         -- active | resolved | chronic
  is_primary  INTEGER DEFAULT 0,
  onset_date  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dx_patient ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_dx_enc ON diagnoses(encounter_id);

-- ── Procedures: injections ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS injections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id  INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  procedure_date TEXT NOT NULL DEFAULT (date('now')),
  laterality    TEXT NOT NULL DEFAULT 'OD',
  drug          TEXT NOT NULL,
  dose_mg       TEXT,
  volume_ml     TEXT,
  lot_number    TEXT,
  manufacturer  TEXT,
  expiry_date   TEXT,
  consent       INTEGER DEFAULT 0,
  pre_iop REAL, pre_va TEXT,
  preop_antiseptic TEXT,
  site TEXT, gauge TEXT, technique TEXT, post_drops TEXT,
  performed_by  INTEGER REFERENCES users(id),
  post_iop REAL, post_va TEXT,
  complications TEXT,
  complication_notes TEXT,
  series_id     TEXT,
  series_number INTEGER,
  treatment_line TEXT,
  interval_days INTEGER,
  indication    TEXT,
  response      TEXT,                        -- improved | stable | worse | insufficient
  ioclosure_status TEXT,
  next_due_date TEXT,
  next_interval_days INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inj_patient ON injections(patient_id);
CREATE INDEX IF NOT EXISTS idx_inj_date ON injections(procedure_date);

-- ── Procedures: lasers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lasers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  procedure_date TEXT NOT NULL DEFAULT (date('now')),
  laterality   TEXT NOT NULL DEFAULT 'OD',
  laser_type   TEXT NOT NULL,
  indication   TEXT,
  power_mw REAL, duration_ms REAL, spot_size_um REAL,
  num_spots INTEGER, pattern TEXT, anesthesia TEXT,
  pre_iop REAL, post_iop REAL, pre_va TEXT, post_va TEXT,
  complications TEXT,
  sessions_total INTEGER, sessions_completed INTEGER,
  consent INTEGER DEFAULT 0,
  performed_by INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_laser_patient ON lasers(patient_id);

-- ── Procedures: surgeries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surgeries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  surgery_type TEXT NOT NULL,
  laterality   TEXT NOT NULL DEFAULT 'OD',
  scheduled_date TEXT, actual_date TEXT,
  surgeon_id   INTEGER REFERENCES users(id),
  status       TEXT DEFAULT 'scheduled',     -- planned | scheduled | completed | cancelled
  -- Pre-op
  al_mm REAL, k1 REAL, k2 REAL, acd_mm REAL, lt_mm REAL, wtw_mm REAL,
  iol_formula TEXT, target_refraction REAL, iol_power REAL,
  iol_model TEXT, iol_type TEXT, iol_manufacturer TEXT,
  mit_calc_pre TEXT,
  risk_notes TEXT,
  -- Intra-op
  technique TEXT, phaco_seconds REAL, phaco_power REAL,
  intraop_complications TEXT,
  iol_implanted_model TEXT, iol_implanted_power TEXT,
  iol_position TEXT, iol_material TEXT,
  anesthesia TEXT,
  -- Post-op
  postop_notes TEXT,
  final_refraction REAL, final_bcva TEXT, target_met TEXT,
  complications TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_surg_patient ON surgeries(patient_id);

-- ── Imaging / tests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imaging (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  test_type    TEXT NOT NULL,                -- oct | octa | vf | fundus_photo | fa | icg | biometry | topography | pachymetry | b_scan | slit_lamp
  test_date    TEXT NOT NULL DEFAULT (date('now')),
  laterality   TEXT DEFAULT 'OU',
  device       TEXT,
  file_path    TEXT,
  thumbnail_path TEXT,
  dicom_uid    TEXT,
  -- Structured metrics (JSON blob per test type, plus a few col-known ones)
  metrics      TEXT,                         -- JSON
  report_text  TEXT,
  ai_flag      INTEGER DEFAULT 0,
  ai_summary   TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_img_patient ON imaging(patient_id);

-- ── Medications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  medication_type TEXT DEFAULT 'ocular',     -- ocular | systemic
  drug       TEXT NOT NULL,
  strength   TEXT,
  route      TEXT,
  frequency  TEXT,
  duration_days INTEGER,
  eye        TEXT,                           -- OD | OS | OU | n/a
  indication TEXT,
  adherence  TEXT,
  status     TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_med_patient ON medications(patient_id);

-- ── Follow-up plans & recalls ────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  diagnosis_id INTEGER REFERENCES diagnoses(id) ON DELETE SET NULL,
  follow_up_type TEXT NOT NULL DEFAULT 'routine',
  laterality   TEXT DEFAULT 'OU',
  interval_days INTEGER,
  next_due_date TEXT,
  urgency      TEXT DEFAULT 'routine',
  instructions TEXT,
  recall_method TEXT,                         -- sms | whatsapp | phone | portal | none
  recall_sent  TEXT,
  recall_response TEXT,
  status       TEXT DEFAULT 'pending',        -- pending | confirmed | done | cancelled
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fu_patient ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_fu_due ON follow_ups(next_due_date);

-- ── Billing ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id  INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  item_name     TEXT NOT NULL,
  cpt_code      TEXT,
  quantity      REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id INTEGER REFERENCES encounters(id) ON DELETE SET NULL,
  date       TEXT NOT NULL DEFAULT (date('now')),
  subtotal   REAL NOT NULL DEFAULT 0,
  discount   REAL NOT NULL DEFAULT 0,
  tax        REAL NOT NULL DEFAULT 0,
  total      REAL NOT NULL DEFAULT 0,
  paid      REAL NOT NULL DEFAULT 0,
  status     TEXT DEFAULT 'unpaid',           -- unpaid | partial | paid | void | overdue
  payment_method TEXT,
  notes      TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_patient ON invoices(patient_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_name  TEXT NOT NULL,
  cpt_code   TEXT,
  quantity   REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total      REAL NOT NULL DEFAULT 0
);

-- ── Inventory ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category         TEXT NOT NULL,             -- drug | iol | disposable | optical
  name             TEXT NOT NULL,
  generic_name     TEXT,
  manufacturer     TEXT,
  sku              TEXT,
  unit_of_measure  TEXT,
  current_stock    REAL NOT NULL DEFAULT 0,
  minimum_stock    REAL DEFAULT 5,
  unit_cost        REAL DEFAULT 0,
  selling_price    REAL DEFAULT 0,
  lot_number       TEXT,
  expiry_date      TEXT,
  status           TEXT DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_inv_cat ON inventory_items(category);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_ts  TEXT NOT NULL DEFAULT (datetime('now')),
  change_qty   REAL NOT NULL,                 -- + receive, - consume
  reason       TEXT,                          -- purchase | injection | surgery | adjust
  ref_patient_id INTEGER REFERENCES patients(id),
  ref_type     TEXT,
  ref_id       TEXT,
  user_id      INTEGER REFERENCES users(id),
  balance_after REAL
);
CREATE INDEX IF NOT EXISTS idx_mov_item ON inventory_movements(item_id);

-- ── Reference data ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS icd10_codes (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL UNIQUE,
  short_desc TEXT,
  full_desc TEXT,
  category TEXT                              -- retina | glaucoma | cornea | lens | uveitis | general
);
CREATE INDEX IF NOT EXISTS idx_icd_code ON icd10_codes(code);
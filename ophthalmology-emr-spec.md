# Ophthalmology EMR Software — Detailed Product Specification

**Version:** 1.0  
**Date:** September 2026  
**Setting:** Private ophthalmology clinic / eye hospital (OPD + minor OT), Lebanon  
**Primary Focus:** Comprehensive ophthalmology + medical retina, intravitreal injections, cataract surgery planning  
**Languages:** Arabic (RTL) and English (LTR), with per-user language preference  

---

## Table of Contents

1. [User Roles and Permissions](#1-user-roles-and-permissions)
2. [Core Clinical Data Model](#2-core-clinical-data-model)
3. [Clinical Workflows](#3-clinical-workflows)
4. [UI/UX Requirements](#4-uiux-requirements)
5. [Device and Systems Integration](#5-device-and-systems-integration)
6. [Billing, Coding, and Inventory](#6-billing-coding-and-inventory)
7. [Reporting and Analytics](#7-reporting-and-analytics)
8. [Security, Privacy, and Compliance](#8-security-privacy-and-compliance)
9. [Implementation and Training Plan](#9-implementation-and-training-plan)
10. [Future-Proofing and AI Features](#10-future-proofing-and-ai-features)

---

## 1. User Roles and Permissions

### 1.1 Role Definitions

| Role | Description |
|------|-------------|
| **Ophthalmologist** | Physician — full clinical access, ordering, procedures, surgical planning |
| **Resident / Fellow** | Trainee physician — supervised clinical access, note co-signing required |
| **Optometrist** | Refraction, contact lens fitting, pre/post-op screening, some clinical documentation |
| **Technician** | Diagnostic testing (OCT, VF, biometry, topography), VA/IOP measurement, patient prep |
| **Nurse** | Injection prep/dispensing, vital signs, post-injection monitoring, medication administration |
| **Receptionist / Front Desk** | Scheduling, registration, check-in/out, appointment management |
| **Billing Staff** | Invoice generation, coding, insurance claims, payment processing, inventory orders |
| **Admin / IT** | System configuration, user management, audit logs, backup oversight |

### 1.2 Permissions Matrix

| Capability | Ophthalmologist | Resident | Optometrist | Technician | Nurse | Receptionist | Billing | Admin |
|---|---|---|---|---|---|---|---|---|
| Patient registration / demographics | View/Edit | View/Edit | View/Edit | View/Edit | View | Create/Edit | View | Full |
| Clinical notes — create | Full | Create (needs co-sign) | Template-limited | None | None | None | None | None |
| Clinical notes — edit own | Yes | Yes (until co-signed) | Yes | No | No | No | No | No |
| Clinical notes — edit others | No | No | No | No | No | No | No | Audit only |
| Clinical notes — delete | No | No | No | No | No | No | No | Audit-only soft-delete |
| View all patient records | Yes (own clinic) | Yes (assigned) | Yes (own clinic) | Yes (own sessions) | Yes (own clinic) | Yes (demographics only) | Yes (demographics + billing) | Full |
| Diagnoses — add/edit | Yes | Yes (with co-sign) | Limited (non-surgical) | No | No | No | View | No |
| Orders — imaging/labs | Yes | Yes (with co-sign) | Limited (refraction, topography) | No | No | No | View | No |
| Orders — medications | Yes | Yes (with co-sign) | No | No | Dispense only | No | View | No |
| Procedure documentation | Yes | Yes (with co-sign) | No | Record device data | Record injection data | No | View (for billing) | No |
| Surgical scheduling | Yes | Request | No | No | View (prep list) | Schedule | View | Full |
| Billing — create invoice | View | No | No | No | No | Create | Full | Full |
| Billing — modify payment | No | No | No | No | No | No | Full | Full |
| Inventory — view | View | View | View | View | View | No | Full | Full |
| Inventory — add/deduct | No | No | No | No | Dispense (drugs) | No | Full | Full |
| Reports / analytics | Dashboard | No | Basic | No | No | No | Financial | Full |
| User management | No | No | No | No | No | No | No | Full |
| Audit log review | View (own) | No | No | No | No | No | No | Full |
| System configuration | No | No | No | No | No | No | No | Full |

### 1.3 Audit Trail Requirements

- **Every** create, edit, delete, and view of a clinical record must log: user ID, timestamp, action type, field changed (old value → new value), IP/device identifier.
- Audit logs are immutable and retained for a minimum of 10 years.
- Ophthalmologists can view the audit trail on their own notes.
- Admin can view and export all audit trails.
- Audit logs must be queryable by patient, user, date range, and action type.
- Any access to a patient record from outside the user's assigned clinic requires a documented reason and is flagged for admin review.

---

## 2. Core Clinical Data Model

### 2.1 Patient Demographics and Identifiers

```
Patient
├── patient_id (system-generated UUID)
├── national_id / civil_registry_number
├── medical_record_number (MRN, configurable prefix)
├── insurance_id / policy_number
├── name_given (English)
├── name_family (English)
├── name_given (Arabic)
├── name_family (Arabic)
├── date_of_birth
├── sex
├── preferred_language (ar / en)
├── phone_primary
├── phone_secondary
├── email
├── address (structured: street, city, governorate, country)
├── emergency_contact (name, phone, relationship)
├── referring_physician (name, specialty, contact)
├── insurance_info (provider, policy, expiry, coverage_type)
├── allergies (list: allergen, reaction, severity)
├── systemic_medications (list: drug, dose, frequency, indication)
├── medical_history (list: condition, ICD-10, onset_date, status)
├── family_history (eye_diseases, systemic_diseases)
├── created_at, created_by
├── updated_at, updated_by
└── status (active, inactive, deceased)
```

### 2.2 Per-Eye Structured Data

All clinical findings are stored **per-eye** (laterality: OD / OS / OU). Each encounter generates one or more eye-level records.

```
Encounter
├── encounter_id
├── patient_id (FK)
├── encounter_date
├── encounter_type (new, follow_up, injection, pre_op, post_op, emergency, teleconsult)
├── clinic / specialty
├── attending_physician (FK → User)
├── reason_for_visit (free text + structured picklist)
├── vitals (BP, pulse, temperature, weight)
├── EyeFindings_OD { ... }
├── EyeFindings_OS { ... }
├── diagnoses (list with laterality, ICD-10, stage/severity, onset, status)
├── procedures_performed (list)
├── imaging_ordered (list)
├── medications_prescribed (list)
├── plan / notes (free text + structured follow-up)
├── follow_up_interval
├── created_at, created_by
├── updated_at, updated_by
└── co_sign_required, co_sign_by, co_sign_date (for residents)
```

```
EyeFindings
├── laterality (OD / OS)
│
├── VisualAcuity
│   ├── UCVA_distance (Snellen 20/__ or logMAR or NLP/CF/HM/PL)
│   ├── UCVA_near (Jaeger or N notation)
│   ├── BCVA_distance (Snellen/logMAR)
│   ├── BCVA_near
│   ├── pinhole_improvement (yes/no/partial)
│   ├── best_corrected_with (glasses / contact_lens / pinhole)
│   └── fixing (yes/no, which eye — for pediatric/amblyopia)
│
├── Refraction
│   ├── sphere (SPH)
│   ├── cylinder (CYL)
│   ├── axis (degrees)
│   ├── add (addition for near, +0.00 to +4.00)
│   ├── prism (value + base direction)
│   ├── PD (pupillary distance, mm)
│   ├── vertex_distance (mm)
│   ├── refraction_type (cycloplegic / manifest / over-refraction)
│   ├── performed_by (FK → User)
│   └── date
│
├── IntraocularPressure
│   ├── iop_value (mmHg)
│   ├── method (Goldmann_applanation / non_contact / tonopen / Perkins / digital)
│   ├── time_of_measurement
│   ├── corneal_thickness_corrected (yes/no, CCT value if available)
│   └── medication_hold (if applicable — e.g., held drops for measurement)
│
├── AnteriorSegment
│   ├── eyelids (normal / blepharitis / ptosis / chalazion / other notes)
│   ├── conjunctiva (normal / injection / pterygium / other)
│   ├── cornea
│   │   ├── clarity (clear / haze grade 1-4 / scar / edema)
│   │   ├── keratometry_K1 / K2 (from topography if auto-imported)
│   │   ├── pachymetry (CCT in microns)
│   │   ├── endothelial_cell_count (if available)
│   │   └── notes (dystrophy, Fuchs, VKC, etc.)
│   ├── anterior_chamber (depth: deep / shallow / flat; cells: 0 to 4+; flare: 0 to 4+; hyphema: grade; pseudophakic/phakic/aphakic)
│   ├── iris (normal / synechiae / rubeosis / coloboma / other)
│   ├── pupil (size_mm, shape, RAPD yes/no, reaction)
│   ├── lens
│   │   ├── status (phakic / pseudophakic / aphakic)
│   │   ├── cataract_type (nuclear / cortical / posterior_subcapsular / mixed)
│   │   ├── cataract_grade (LOCS III: nuclear opacity 0-6, nuclear color 0-6, cortical 0-5, PSC 0-5)
│   │   └── IOL_type / IOL_power / IOL_model (if pseudophakic)
│   └── anterior_notes (free text)
│
├── PosteriorSegment
│   ├── vitreous (clear / cells grade / haze / hemorrhage / syneresis / detachment)
│   ├── macula
│   │   ├── appearance (normal / edema / exudates / hemorrhage / scar / CNV / atrophy)
│   │   ├── central_subfield_thickness_um (from OCT, auto-imported)
│   │   ├── macular_volume_mm3
│   │   ├── subretinal_fluid (yes/no/amount)
│   │   ├── intraretinal_fluid (yes/no/location)
│   │   └── notes
│   ├── optic_nerve
│   │   ├── cup_to_disc_ratio (vertical and horizontal)
│   │   ├── rim (normal / thin / notched / hemorrhage)
│   │   ├── RNFL_thickness_avg_um (from OCT, auto-imported)
│   │   ├── pallor (none / partial / total)
│   │   ├── disc_edema (yes/no, grade)
│   │   └── notes
│   ├── retina
│   │   ├── attached / detached (with location and extent)
│   │   ├── hemorrhages (none / dot-blot / flame / pre-retinal / vitreous)
│   │   ├── exudates (none / hard / cotton-wool spots)
│   │   ├── neovascularization (NVD / NVE, location)
│   │   ├── laser_scars (pattern, extent)
│   │   ├── ROP_stage (if applicable)
│   │   └── peripheral_retina_notes
│   ├── vitreoretinal_notes (free text)
│
├── Additional Findings
│   ├── uveitis_grading (anterior: cells/flare standard 0-4+, vitreous cells 0-4+)
│   ├── procedures_at_slit_lamp (YAG capsulotomy, needling, etc.)
│   └── specialty_specific_notes (free text, tagged by specialty)
```

### 2.3 Diagnoses

```
Diagnosis
├── diagnosis_id
├── encounter_id (FK)
├── patient_id (FK)
├── laterality (OD / OS / OU / bilateral / systemic)
├── icd10_code
├── icd10_description
├── clinical_stage / severity (condition-specific: e.g., ETDRS grade, glaucoma stage, cataract grade)
├── onset_date
├── status (active / resolved / chronic / inactive)
├── is_primary (boolean)
├── notes
├── created_by, created_at
```

**Pre-loaded diagnosis picklists (common in ophthalmology):**

- Diabetic retinopathy: no DR, mild NPDR, moderate NPDR, severe NPDR, PDR, CSME
- Glaucoma: ocular hypertension, pre-perimetric, early/moderate/advanced/endpoint, acute angle closure
- AMD: dry (early/intermediate/advanced), wet (classic/occult/mixed), PCV
- Cataract: nuclear grade, cortical, PSC, traumatic, congenital
- Keratoconus: stage (Amsler-Krumeich)
- Uveitis: anterior / intermediate / posterior / panuveitis, infectious vs autoimmune

### 2.4 Procedure Data

#### 2.4.1 Intravitreal Injections

```
Injection
├── injection_id
├── encounter_id (FK)
├── patient_id (FK)
├── laterality (OD / OS)
├── drug
│   ├── drug_name (bevacizumab / ranibizumab / aflibercept / brolucizumab / faricimab / dexamethasone_implant / triamcinolone / other)
│   ├── dose_mg
│   ├── volume_ml
│   ├── batch_number / lot_number
│   ├── manufacturer
│   ├── expiry_date
│   └── prep_location (clinic / pharmacy)
├── consent_documented (boolean)
├── consent_date
├── pre_injection
│   ├── iop_mmHg
│   ├── visual_acuity (Snellen/logMAR)
│   ├── pupil_dilation (yes/no)
│   └── preop_antiseptic (povidone_iodine_concentration, other)
├── injection_details
│   ├── site (quadrant: superotemporal / superonasal / inferotemporal / inferonasal / other)
│   ├── gauge (30G / 31G / other)
│   ├── technique (pars_plana_3.5mm / pars_plana_4.0mm / other)
│   ├── eye_drops_post (antibiotic type)
│   └── performed_by (FK → User)
├── post_injection
│   ├── immediate_complications (none / subconjunctival_hemorrhage / iop_elevation / pain / visual_loss / endophthalmitis_suspected / other)
│   ├── complication_notes
│   ├── post_iop_mmHg (if measured)
│   ├── post_visual_acuity (if measured same day)
│   └── observation_time_minutes
├── injection_series_id (FK — links to the ongoing series tracking)
├── treatment_line (1st / 2nd / 3rd / switch_from_...)
├── interval_since_last_injection_days
├── next_injection_due_date
├── next_injection_interval_days (protocol-based: 4 weeks, 6 weeks, 8 weeks, PRN, T&E)
├── indication (wet_AMD / DME / RVO / myopic_CNV / PDR / uveitic_macular_edema / other)
├── response_assessment (improved / stable / worse / insufficient_response)
├── ioclosure_status (complete / partial / active — for anti-VEGF)
├── created_by, created_at
```

#### 2.4.2 Laser Procedures

```
Laser
├── laser_id
├── encounter_id (FK)
├── patient_id (FK)
├── laterality (OD / OS)
├── laser_type (PRP / focal_grid / panretinal / photodynamic / SLT / YAG_iridotomy / YAG_capsulotomy / ALT / micropulse / other)
├── indication (DR / CSR / macular_edema / angle_closure / capsular_opacification / other)
├── settings
│   ├── power_mW
│   ├── duration_ms
│   ├── spot_size_um
│   ├── number_of_spots
│   ├── pattern (single / grid / barrage / circle)
│   └── filter / wavelength
├── anesthesia (topical / retrobulbar / none)
├── complications (none / burns / pain / vision_loss / other)
├── pre_iop / post_iop
├── pre_va / post_va
├── sessions_total / sessions_completed (for multi-session PRP)
├── performed_by (FK → User)
├── consent_documented (boolean)
├── created_by, created_at
```

#### 2.4.3 Surgical Planning and Outcomes

```
Surgery
├── surgery_id
├── patient_id (FK)
├── surgery_type (cataract_phaco / SICS / vitrectomy / trabeculectomy / DSEK / pterygium / other)
├── laterality (OD / OS)
├── scheduled_date
├── actual_date
├── surgeon (FK → User)
├── assistant / anesthesiologist
├── status (planned / scheduled / completed / cancelled)
│
├── PreOp_Assessment
│   ├── biometry
│   │   ├── axial_length_mm
│   │   ├── K1 / K2 (diopters)
│   │   ├── ACD_mm
│   │   ├── lens_thickness_mm
│   │   ├── white_to_white_mm
│   │   └── device_used
│   ├── iol_calculation
│   │   ├── formula_used (Haigis / Hoffer-Q / SRK/T / Barrett / Kane / other)
│   │   ├── target_refraction (SE diopters)
│   │   ├── iol_power_recommended
│   │   ├── iol_model_options (list of candidates with predicted outcomes)
│   │   └── calculated_postop_refraction
│   ├── corneal_topography (imported or linked)
│   ├── risk_assessment
│   │   ├── hard_cataract (yes/no, grade)
│   │   ├── small_pupil (yes/no)
│   │   ├── pseudoexfoliation (yes/no)
│   │   ├──zonular_weakness (yes/no)
│   │   ├── vitreous_face_status (intact / posterior_vitreous_detachment)
│   │   └── other_risk_factors (notes)
│   └── anesthesia_plan (topical / retrobulbar / general)
│
├── IntraOp_Record
│   ├── procedure_details
│   │   ├── technique (phaco_chop / divide_and_conquer / SICS / other)
│   │   ├── phaco_time_seconds
│   │   ├── US_power_percent
│   │   └── complications (capsular_rent / dropped_nucleus / vitreous_loss / zonular_dialysis / other)
│   ├── iol_implanted
│   │   ├── iol_model
│   │   ├── iol_type (monofocal / multifocal / toric / EDOF / other)
│   │   ├── iol_power
│   │   ├── haptic_config (C-loop / plate / other)
│   │   ├── material (acrylic / silicone / PMMA)
│   │   └── 注入_position (in-the-bag / sulcus / anterior_chamber / scleral_fixated)
│   ├── medications_intraop (anesthesia type, intracameral antibiotics, viscoelastic type)
│   └── surgeon_notes
│
├── PostOp_Record
│   ├── day_1
│   │   ├── va (Snellen/logMAR)
│   │   ├── iop
│   │   ├── slit_lamp_findings (cornea, AC cells, IOL position, pupil)
│   │   └── complications
│   ├── week_1
│   │   └── (same fields)
│   ├── month_1
│   │   └── (same fields)
│   ├── refraction_stable_date
│   ├── final_refraction (SE)
│   ├── final_best_corrected_va
│   ├── target_met (within ±0.5D / within ±1.0D / not met)
│   └── postop_medications (steroid taper, antibiotic schedule, etc.)
```

### 2.5 Imaging and Diagnostic Tests

```
DiagnosticTest
├── test_id
├── patient_id (FK)
├── encounter_id (FK, optional — can be linked retrospectively)
├── laterality (OD / OS / OU)
├── test_type (OCT / OCTA / VF / fundus_photo / FA / ICG / biometry / topography / pachymetry / endothelial_microscopy / B_scan / other)
├── test_date
├── device_manufacturer
├── device_model
├── performing_user (FK)
│
├── ImageLinks
│   ├── original_dicom_file_path (or uploaded image path)
│   ├── thumbnail_path
│   └── linked_pacs_study_uid (if PACS-integrated)
│
├── StructuredMetrics (test-type-specific)
│   ├── OCT_Metrics
│   │   ├── central_subfield_thickness_um
│   │   ├── macular_volume_mm3
│   │   ├── subretinal_fluid_present (boolean)
│   │   ├── intraretinal_fluid_present (boolean)
│   │   ├── pigment_epithelial_detachment (boolean)
│   │   ├── pattern_deviation_map_summary
│   │   └── rnfl_thickness_avg_um (peripapillary scan)
│   ├── OCTA_Metrics
│   │   ├── superficial_capillary_plexus_density
│   │   ├── deep_capillary_plexus_density
│   │   ├── foveal_avascular_zone_area
│   │   └── neovascularization_detected (boolean)
│   ├── VF_Metrics
│   │   ├── mean_deviation_dB
│   │   ├── pattern_standard_deviation_dB
│   │   ├── visual_field_index_percent
│   │   ├── reliability_indices (fixation_losses_percent, false_positives_percent, false_negatives_percent)
│   │   ├── glaucoma_hemifield_test (within_normal / outside_normal / borderline)
│   │   ├── pattern_deviation_map_summary (image reference)
│   │   ├── total_deviation_map_summary (image reference)
│   │   └── vfi_percent
│   ├── Biometry_Metrics
│   │   ├── axial_length_mm
│   │   ├── K1_diopters / K1_axis
│   │   ├── K2_diopters / K2_axis
│   │   ├── ACD_mm
│   │   ├── lens_thickness_mm
│   │   ├── WTW_mm
│   │   └── iol_power_calculated
│   ├── Topography_Metrics
│   │   ├── K_max_diopters
│   │   ├── K_min_diopters
│   │   ├── astigmatism_diopters
│   │   ├── symmetry_index
│   │   ├── keratoconus_index (if applicable)
│   │   └── corneal_elevation_map (image reference)
│   ├── FundusPhoto
│   │   ├── field_7_etdrs / field_45 / disc_photo / anterior_segment / other
│   │   └── ai_auto_read (if AI module enabled: findings summary)
│   └── B_Scan_Metrics
│       ├── findings_summary (PVD / RD / vitreous_hemorrhage / mass / other)
│       └── axial_length_if_measured
│
├── ai_interpretation (optional, if AI module active)
│   ├── detected_findings (list)
│   ├── confidence_scores
│   └── flagged_for_review (boolean)
│
└── report_text (free text or structured report)
```

### 2.6 Medications

```
Medication
├── medication_id
├── patient_id (FK)
├── medication_type (ocular / systemic)
├── drug_name
├── generic_name
├── strength / concentration
├── route (topical / intravitreal / oral / IV / subcutaneous / other)
├── frequency (QD / BID / TID / QID / Qweek / Qmonth / PRN / other)
├── duration_days / end_date
├── eye (OD / OS / OU / both eyes / N/A for systemic)
├── prescribing_encounter_id (FK)
├── indication
├── adherence_notes
├── status (active / completed / discontinued / paused)
├── created_by, created_at
```

**Pre-loaded ocular medication library (commonly used in Lebanon):**
- Anti-VEGF: bevacizumab (Avastin), ranibizumab (Lucentis), aflibercept (Eylea), brolucizumab (Beovu), faricimab (Vabysmo)
- Steroids: dexamethasone implant (Ozurdex), triamcinolone acetonide, prednisolone acetate, fluorometholone
- Glaucoma: timolol, brimonidine, dorzolamide, latanoprost, bimatoprost, travoprost, pilocarpine
- Antibiotics: moxifloxacin, ofloxacin, ciprofloxacin, gentamicin, tobramycin
- Others: cyclopentolate, tropicamide, phenylephrine, nepafenac, ketorolac

### 2.7 Follow-Up Plans and Recall Rules

```
FollowUpPlan
├── plan_id
├── patient_id (FK)
├── encounter_id (FK)
├── laterality (OD / OS / OU)
├── diagnosis_link (FK → Diagnosis)
├── follow_up_type (injection_series / glaucoma_review / dr_screening / post_op / routine / other)
├── interval_days
├── next_due_date
├── urgency (routine / soon / urgent / asap)
├── specific_instructions (e.g., "bring old OCT", "dilate for fundus exam")
├── recall_method (sms / whatsapp / phone / patient_portal / other)
├── recall_sent (boolean, date_sent)
├── recall_response (confirmed / no_response / rescheduled / cancelled)
├── created_by, created_at
```

**Automated recall rules (configurable by admin):**

| Condition | Default Follow-Up | Recall Trigger |
|---|---|---|
| Wet AMD — injection series | 4–6 weeks | 2 weeks before due date |
| DME — injection series | 4–8 weeks | 2 weeks before due date |
| RVO — injection series | 4–6 weeks | 2 weeks before due date |
| Glaucoma — stable | 3–6 months | 1 month before due |
| Glaucoma — unstable | 1–3 months | 2 weeks before due |
| Diabetic retinopathy — no DR | Annual | 2 months before due |
| Diabetic retinopathy — NPDR | 6–12 months | 2 months before due |
| Diabetic retinopathy — PDR treated | 4–12 weeks post-laser | 2 weeks before due |
| Post-cataract surgery | Day 1, Week 1, Month 1, Month 3 | Automated milestone reminders |
| Post-injection monitoring | Next day (phone check) | Next morning auto-alert to nurse |

---

## 3. Clinical Workflows

### 3.1 New Patient Registration and Triage

**Actors:** Receptionist (registration), Technician (triage/vitals)

**Steps:**

1. **Receptionist — Patient Registration**
   - Search for existing patient (by name, MRN, phone, national ID).
   - If new: enter demographics (bilingual), insurance info, referring physician.
   - Print/issue MRN or assign digital identifier.
   - Schedule appointment or register as walk-in.

2. **Technician — Pre-Exam Triage**
   - Pull up patient chart on worklist.
   - Record chief complaint (structured picklist + free text).
   - Record vitals (BP, pulse, weight).
   - Verify and update medication list and allergies.
   - Measure UCVA (both eyes, distance and near).
   - Measure IOP (both eyes, method recorded).
   - Dilate pupils (if routine comprehensive exam planned; skip if glaucoma-only or anterior segment visit).
   - Run diagnostic tests as ordered by protocol or physician's pre-orders:
     - New patient default: OCT (macula + RNFL), fundus photo, topography (if first visit).
     - Glaucoma suspect: add VF, gonioscopy prep.
     - Diabetic patient: add ultra-widefield fundus photo.
   - Upload/import all device results into the patient chart.
   - Queue patient for physician review.

3. **System — Auto-Actions**
   - Auto-link device results to the encounter.
   - Auto-populate structured metrics from device imports.
   - Flag any previous outstanding recalls or orders.

### 3.2 Routine Follow-Up Visit — Medical Retina

**Actors:** Technician (prep), Ophthalmologist (exam), Nurse (post-injection if applicable)

**Steps:**

1. **Technician — Pre-Exam**
   - Confirm chief complaint and interval history (any changes since last visit).
   - Measure UCVA (both eyes).
   - Measure IOP (both eyes).
   - Run OCT (protocol-selected by physician or auto-selected based on diagnosis).
   - Import OCT results; system auto-flags significant thickness changes from baseline.
   - Queue for physician.

2. **Ophthalmologist — Examination**
   - Review OCT side-by-side with previous scans (automatically loaded for the same eye).
   - Slit lamp examination → enter structured anterior segment findings.
   - Fundus examination → enter posterior segment findings.
   - Document BCVA if changed.
   - Assessment:
     - System suggests trend graph (CST over time, IOP trend).
     - Mark injection response: improved / stable / worse.
     - Evaluate fluid status: dry / residual IRF / SRF / PED.
   - Plan:
     - Continue current injection: auto-populate next due date and interval.
     - Switch drug or extend interval: document rationale.
     - Add/modify adjuvant therapy.
     - Order additional tests if needed.
     - Update diagnoses if status changed.

3. **If injection administered:** → See §3.3 Injection Day Workflow

4. **System — Auto-Actions**
   - Generate follow-up recall entry with next due date.
   - Update injection series tracker.
   - Push to billing queue for services rendered.

### 3.3 Injection Day Workflow

**Actors:** Nurse (prep), Ophthalmologist (injection), Technician (pre-injection testing)

This workflow handles high-volume injection clinics (potentially 20–60+ injections per half-day session).

**Pre-Clinic Preparation (Nurse/Admin):**

1. Review injection schedule for the day (auto-generated from recall system).
2. Verify drug availability in inventory; flag shortages.
3. Prepare drug trays: bevacizumab syringes (if repackaged), ranibizumab/aflibercept vials, dexamethasone implants.
4. Print injection day list: patient name, eye, drug, dose, last injection date, interval.

**Per-Patient Flow:**

1. **Check-In (Nurse)**
   - Verify patient identity.
   - Confirm consent (check digital consent on file or obtain new).
   - Confirm no contraindications (active eye infection, recent surgery <1 week, patient refusal).
   - Review current medications (anticoagulants — note but generally do not stop).

2. **Pre-Injection Testing (Technician)**
   - Measure VA (distance).
   - Measure IOP (Goldmann or non-contact).
   - Enter into system → system auto-calculates interval since last injection.

3. **Physician Review (Ophthalmologist)**
   - Quick review of OCT (if performed today) or last available OCT.
   - Confirm injection indicated.
   - Select drug, dose, and confirm eye (system enforces laterality check against chart).
   - System prompts: "Right eye — bevacizumab 1.25mg — confirm."

4. **Injection (Ophthalmologist)**
   - Enter injection details: quadrant, gauge, technique.
   - System auto-records timestamp, physician, and links to consent.

5. **Post-Injection (Nurse)**
   - Monitor for 5–15 minutes (configurable).
   - Record post-injection IOP if elevated concern.
   - Record any complications (subconjunctival hemorrhage is routine and auto-logged).
   - Record post-injection eye drops administered.
   - Confirm patient instructions given (no rubbing, return if pain/vision loss, etc.).

6. **System — Auto-Actions**
   - Update injection log.
   - Calculate and record next injection due date.
   - Generate recall entry for next injection.
   - Push billing claim for injection + drug.
   - Decrement drug from inventory.
   - If complication logged → flag for follow-up the next day.

**Injection Log Dashboard View:**

| Date | Patient | Eye | Drug | Dose | Lot # | Pre-IOP | Post-IOP | Pre-VA | Complication | Next Due | Series # |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-09-01 | Ahmad K. | OD | Aflibercept | 8mg | AB1234 | 14 | 16 | 20/60 | None | 2026-10-13 | #7 |
| 2026-09-01 | Layla M. | OS | Bevacizumab | 1.25mg | BV5678 | 12 | 13 | 20/40 | SCH | 2026-09-29 | #12 |

### 3.4 Pre-Operative Assessment (Cataract Surgery)

**Actors:** Technician (biometry/topography), Optometrist (refraction), Ophthalmologist (assessment, IOL selection)

**Steps:**

1. **Technician — Measurements**
   - Biometry (IOLMaster / Lenstar / Pentacam): auto-import axial length, K values, ACD, lens thickness, WTW.
   - Topography: auto-import; system flags irregular astigmatism or keratoconus.
   - Pachymetry: auto-import CCT.
   - System auto-runs IOL calculations using pre-configured formulas (Barrett Universal II as default, with Haigis, Hoffer-Q, SRK/T available).
   - System presents IOL power options for target refraction (planned myopia, emmetropia, or monovision).

2. **Optometrist — Refraction and Biometry Verification**
   - Manifest refraction → entered in structured format.
   - Verify K values against topography.
   - Confirm spectacle prescription consistency with biometry.

3. **Ophthalmologist — Assessment**
   - Review all measurements in consolidated pre-op dashboard.
   - System highlights any biometry outliers (e.g., very short/long eye, posterior staphyloma, irregular K values).
   - Examine: cataract grade (LOCS III), anterior segment, dilated fundus.
   - Risk assessment checklist:
     - Hard cataract (nuclear grade ≥4)
     - Small pupil
     - Pseudoexfoliation
     - Previous vitrectomy
     - High myopia
     - Corneal pathology
     - Glaucoma (document IOP, nerve status, medications)
     - Macular pathology (OCT reviewed)
   - Select IOL:
     - Model and manufacturer (from IOL inventory).
     - Power (from calculation table).
     - Type: monofocal / multifocal / toric / EDOF.
     - If toric: mark axis, system auto-calculates residual astigmatism.
     - Target refraction documented.
   - Anesthesia plan: topical / retrobulbar / general.
   - Informed consent: system generates procedure-specific consent form (Arabic/English) for digital signature or print.

4. **System — Auto-Actions**
   - Create surgery record with all pre-op data.
   - Add to surgical schedule.
   - Reserve IOL from inventory.
   - Generate pre-op instructions for patient (printed or sent digitally).
   - Schedule pre-op drops protocol reminder.

### 3.5 Post-Operative Follow-Up

**Templates (configurable per surgeon):**

**Day 1 Post-Cataract:**
- VA (UCVA and BCVA if possible)
- IOP
- Slit lamp: corneal edema grade, AC cells/flare, IOL position, pupil, wound integrity
- Complications checklist: endophthalmitis suspicion, wound leak, IOL dislocation, retinal detachment
- Medications: confirm started post-op drops

**Week 1 Post-Cataract:**
- Same as Day 1 plus: refraction (if early refraction desired)
- Review of any complaints

**Month 1 Post-Cataract:**
- Full refraction (manifest)
- BCVA
- IOP
- OCT macula (if any visual concern)
- Confirm IOL position
- Update final refraction for glasses prescription

### 3.6 Emergency / Urgent Visit Flow

**Triggers:** Acute vision loss, trauma, acute angle closure, suspected RD, chemical burn, endophthalmitis suspicion, red eye (acute)

**Steps:**

1. **Receptionist / Phone Triage**
   - Flag as URGENT in system → bypasses normal queue.
   - Contacts on-call physician if outside hours.

2. **Rapid Assessment (Technician + Nurse)**
   - Skip routine排队; immediate VA and IOP.
   - Dilate ONLY if RD/angle not suspected.
   - B-scan ultrasound if media opacity (vitreous hemorrhage, cataract).
   - System auto-creates encounter with type = EMERGENCY.

3. **Ophthalmologist — Examination**
   - System presents emergency template with relevant structured fields:
     - Trauma: mechanism, entry/exit wounds, hyphema grade, lens subluxation, retinal findings
     - Acute angle closure: IOP, corneal edema, shallow AC, pupil response, treatment given
     - Suspected RD: location, extent, macula on/off, vitreous status
     - Endophthalmitis: post-injection/surgery timeline, AC cells, vitreous cells, hypopyon
   - Orders treatment: medications, procedures, hospital admission if needed.
   - System auto-generates referral letter if transfer needed.

4. **System — Auto-Actions**
   - Tag encounter as emergency for reporting.
   - If after-hours → audit trail records access.
   - Auto-schedule urgent follow-up (next day or 48 hours).
   - If admitted → notify HIS if integrated.

---

## 4. UI/UX Requirements

### 4.1 Layout Philosophy

- **Single-page encounter view** by default (reduces navigation clicks).
- **Per-eye tabs** at the top of the clinical section: `[ OD (Right) ] [ OS (Left) ] [ OU (Both) ]`
- Switching eyes does NOT lose unsaved data on the other eye (auto-save drafts).
- **Split-screen mode** available for side-by-side OD/OS comparison.
- **Dark mode** available (commonly preferred in dim fundoscopy rooms).

### 4.2 Quick-Entry Grids

**Visual Acuity Grid:**
```
         | Distance UCVA | Distance BCVA | Near UCVA | Near BCVA
---------|---------------|---------------|-----------|----------
   OD    | [dropdown]    | [dropdown]    | [dropdown]| [dropdown]
   OS    | [dropdown]    | [dropdown]    | [dropdown]| [dropdown]
   OU    | [dropdown]    | [dropdown]    | [dropdown]| [dropdown]
```
- Dropdown values: NLP, HM, CF (with distance), 20/400, 20/200, 20/100, 20/80, 20/60, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10
- Also accepts logMAR input (auto-converts).
- One-click "same as last visit" button.

**Refraction Grid:**
```
         | SPH    | CYL    | Axis  | Add   | PD    | Prism+Base
---------|--------|--------|-------|-------|-------|------------
   OD    | [___]  | [___]  | [___] | [___] | [___] | [___] [___]
   OS    | [___]  | [___]  | [___] | [___] | [___] | [___] [___]
```
- Auto-converts between plus/minus cylinder notation.
- Auto-calculates SE (spherical equivalent).

**IOP Grid:**
```
         | IOP (mmHg) | Method           | Time    | CCT
---------|------------|------------------|---------|-----
   OD    | [___]      | [dropdown]       | [time]  | [___]
   OS    | [___]      | [dropdown]       | [time]  | [___]
```
- Methods: Goldmann, Non-contact, Tonopen, Perkins, Digital
- CCT correction auto-suggested if CCT outside 530-570µm range.

### 4.3 Keyboard and Voice Support

- **Keyboard shortcuts:**
  - `Ctrl+1` / `Ctrl+2` → switch to OD / OS tab
  - `Ctrl+S` → save encounter
  - `Ctrl+N` → new encounter for current patient
  - `Ctrl+I` → open injection form
  - `Ctrl+F` → patient search
  - `Ctrl+D` → quick diagnosis entry
  - `Tab` / `Shift+Tab` → navigate through quick-entry grid fields
  - `Enter` in grid → move to next cell
  - `F2` → toggle between Snellen and logMAR entry mode

- **Text expansion / macros:**
  - Type `;ncc` → expands to "Phacoemulsification with foldable IOL implantation, posterior chamber, in-the-bag"
  - Type `;prp` → expands to "Panretinal photocoagulation, [eye], [___] spots, [___] mW, [___] ms"
  - Custom macros configurable per user and globally by admin.
  - Auto-complete for diagnosis entries (ICD-10 search).

- **Voice input:**
  - Integration with system speech-to-text (Windows Speech Recognition or API-based).
  - Activated by hotkey or button; inserts dictated text into focused field.
  - Works for free-text notes; structured fields still use picklists/grids.
  - Arabic and English voice input supported.

### 4.4 Integrated Imaging Viewer

- **Within patient chart**: embedded DICOM viewer or lightweight image viewer.
  - Side-by-side comparison of current and previous OCT scans.
  - OCT layer view with thickness maps.
  - VF pattern deviation overlay.
  - Fundus photo comparison (split view, overlay with transparency slider).
  - Zoom, pan, window/level controls.
  - Toggle between eyes.
- **Toolbar**: link to full PACS viewer for advanced analysis.
- **Annotations**: physician can add measurement calipers, annotations on images within the chart (saved as overlay, does not modify original).

### 4.5 Injection Log Dashboard

Accessed from the main navigation or clinic-specific module:

**Dashboard Panels:**

1. **Today's Injection Schedule**
   - List of patients scheduled for injection today
   - Status: checked-in / pre-tested / injected / post-monitoring / completed
   - Quick filters: drug type, eye, physician

2. **Injection Series Tracker** (per patient)
   - Timeline view: all injections in series with dates, drugs, responses
   - Visual: horizontal bar with injection marks, OCT thickness trend below
   - Flags: patients overdue, patients approaching treatment-free interval

3. **Drug Inventory Status**
   - Current stock of each anti-VEGF and steroid
   - Alerts: low stock, expiring soon
   - Quick link to reorder

4. **Monthly Injection Volume Summary**
   - Bar chart: injections per drug per month
   - Pie chart: distribution by indication

### 4.6 Glaucoma Trend Graphs

**Per-Patient Glaucoma Dashboard:**

1. **IOP Over Time** — line graph
   - X-axis: dates of visits
   - Y-axis: IOP (mmHg)
   - Separate lines for OD and OS
   - Markers for medication changes or procedures
   - Target IOP line (dashed, physician-set)

2. **VF Indices Over Time** — line graph
   - MD (Mean Deviation) trend
   - PSD (Pattern Standard Deviation) trend
   - VFI (Visual Field Index) trend
   - Series of mini VF maps (greyscale) as thumbnails below

3. **OCT RNFL / GCC Thickness Over Time** — line graph
   - Average RNFL thickness trend per eye
   - RNFL thickness map (clock-hour or quadrant) compared to normative database
   - GCC thickness trend (if glaucoma or suspected)

4. **Correlation Panel**
   - Scatter plot: IOP vs RNFL thickness over time
   - Helps identify IOP-related progression

### 4.7 Diabetic Retinopathy Registry View

**Clinic-Level Registry Dashboard:**

| Patient Name | MRN | Last DR Grade (OD) | Last DR Grade (OS) | Last Exam Date | Last HbA1c | Next Due | Status |
|---|---|---|---|---|---|---|---|
| Ahmad K. | 12345 | Moderate NPDR | Moderate NPDR | 2026-07-15 | 7.2% | 2027-01-15 | On track |
| Layla M. | 12346 | Severe NPDR | PDR (treated) | 2026-08-01 | 8.1% | 2026-11-01 | Overdue |

- **Filters:** by DR grade, by physician, by due date range, by HbA1c level
- **Actions:** bulk recall generation, export for outreach
- **Drill-down:** click patient → open chart

---

## 5. Device and Systems Integration

### 5.1 Required Device Integrations

| Device Type | Examples (commonly available in Lebanon) | Integration Method |
|---|---|---|
| **OCT** | Zeiss Cirrus, Heidelberg Spectralis, Topcon Triton, Nidek RS-3000 | DICOM (Image + Structured Report); vendor SDK if DICOM incomplete |
| **OCTA** | Zeiss AngioPlex, Heidelberg AngioPlex, Topcon DRI OCT Triton | DICOM; import segmentation metrics |
| **Visual Field** | Zeiss Humphrey Field Analyzer, Octopus (Haag-Streit), Topcon CV-5000 | DICOM or vendor proprietary format (text/CSV/XML import) |
| **Fundus Camera** | Topcon TRC-NW400, Canon CR-2, Zeiss VISUCAM, Optos (ultra-widefield) | DICOM; JPEG/PNG upload fallback |
| **Slit-Lamp Camera** | Haag-Streit BQ-900, Topcon SL-D7 | DICOM or direct image import |
| **Topography / Tomography** | Topcon Orbscan, Pentacam (Oculus), Zeiss ATLAS, Nidek | DICOM or vendor data file import |
| **Biometry** | Zeiss IOLMaster 700, Nidek AL-Scan, Haag-Streit Lenstar | DICOM or proprietary XML/CSV |
| **Pachymeter** | Topcon SP-100, Tomey SP-100 | Direct data import (serial/USB) |
| **Fundus Fluorescein Angiography** | Heidelberg, Topcon | DICOM |
| **B-Scan Ultrasound** | Quantel Medical, Accutome, Nidek | DICOM or image export |
| **Tonometer (electronic)** | Reichert 7CR, iCare | Bluetooth/USB data transfer |

### 5.2 Integration Architecture

```
                    ┌─────────────────────────┐
                    │    Ophthalmology EMR     │
                    │    (Core Application)     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │             │
              ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
              │  DICOM     │ │ HL7/   │ │  Device    │
              │  Router /  │ │ FHIR   │ │  Import    │
              │  PACS      │ │ Gateway│ │  Module    │
              │  (Orthanc/ │ │        │ │  (vendor   │
              │   dcm4chee)│ │        │ │   parsers) │
              └─────┬─────┘ └───┬────┘ └─────┬─────┘
                    │            │             │
              ┌─────▼─────┐ ┌───▼────┐ ┌─────▼─────┐
              │  DICOM     │ │  HIS/  │ │  Device    │
              │  Devices   │ │  Lab   │ │  Network   │
              │  (OCT, VF, │ │  System│ │  (TWAIN/   │
              │  cameras)  │ │        │ │   USB)     │
              └───────────┘ └────────┘ └───────────┘
```

### 5.3 DICOM/PACS Integration Details

- **DICOM Storage SCP**: system or dedicated PACS (e.g., Orthanc, dcm4chee) receives and stores all DICOM studies from devices.
- **DICOM Query/Retrieve**: EMR can query PACS for patient studies and retrieve images on demand.
- **DICOM Structured Reports**: parse SR objects to extract structured metrics (CST from OCT, MD/PSD from VF, biometry values).
- **Auto-linking**: incoming DICOM studies auto-matched to patient by Patient ID or Name+DOB with manual confirmation fallback.
- **Image caching**: recent studies cached locally for fast viewing; older studies retrieved on demand.

### 5.4 HL7/FHIR Integration

- **FHIR R4** resources supported for interoperability:
  - Patient, Encounter, Observation (vital signs, IOP, VA), Condition (diagnoses), Procedure (injections, lasers, surgeries), MedicationRequest, DiagnosticReport, ImagingStudy
- **HL7 v2** ADT/event messages for hospital information system (HIS) integration if needed.
- **Lab integration**: receive lab results (HbA1c, CBC, etc.) via HL7/FHIR or file import.
- **Referral interfaces**: send/receive referrals to/from other providers.

### 5.5 Device Import Fallback (Non-DICOM)

For devices that do not support DICOM:
1. **File import**: vendor exports to folder (XML, CSV, JPEG, PDF). System watches import folder or manual upload.
2. **TWAIN/WIA**: direct acquisition from USB cameras.
3. **Manual entry**: structured data entry forms for metrics that cannot be auto-imported.
4. **Vendor SDK**: where available, direct API integration (e.g., Heidelberg Eye Explorer API).

---

## 6. Billing, Coding, and Inventory

### 6.1 Diagnosis Coding

- **ICD-10-CM** (or ICD-10-AM if preferred) for all diagnoses.
- Auto-suggest ICD-10 codes from clinical text and structured diagnoses.
- Common ophthalmology ICD-10 code favorites list (configurable):
  - H40.11x0-9 — Primary open-angle glaucoma (by stage)
  - H40.21x — Chronic angle-closure glaucoma
  - E11.319 — Diabetic retinopathy without macular edema
  - E11.32x — Diabetic retinopathy with macular edema
  - H35.31x — Non-exudative AMD
  - H35.32x — Exudative AMD
  - H25.1x — Age-related cataract (nuclear)
  - Z96.1 — Intraocular lens status
  - And many more...

### 6.2 Procedure Coding

- **CPT codes** (or local equivalent if Lebanese billing requires specific codes):
  - 92002/92004 — Comprehensive eye exam (new/established)
  - 92012/92014 — Intermediate/comprehensive visit (established)
  - 92133/92134 — OCT macula/optic nerve
  - 92081/92082/92083 — Visual field (single/double/multiple pattern)
  - 92250 — Fundus photography
  - 92225/92226 — Stereo fundus photo (optic nerve)
  - 67028 — Intravitreal injection (anti-VEGF)
  - 67027 — Intravitreal injection (implant)
  - 67025 — Intravitreal injection (other)
  - 65855 — Trabeculectomy
  - 66984 / 66982 — Phacoemulsification (routine / complex)
  - 66821 — YAG capsulotomy
  - 67210 — Panretinal photocoagulation
  - 67228 — Focal/macular laser
  - 65855 — SLT (or specific SLT code if available)
  - Many more — full CPT table loaded and configurable.

### 6.3 Billing Templates

**Template: Office Visit + OCT + VF**

| Line | Service | CPT Code | Units | Fee |
|---|---|---|---|---|
| 1 | Comprehensive eye exam (new patient) | 92004 | 1 | $XXX |
| 2 | OCT macula | 92134 | 1 (OD) | $XXX |
| 3 | OCT macula | 92134 | 1 (OS) | $XXX |
| 4 | OCT optic nerve | 92133 | 1 (OD) | $XXX |
| 5 | Visual field (24-2) | 92083 | 1 (OD) | $XXX |
| 6 | Fundus photography | 92250 | 1 | $XXX |
| | **Total** | | | **$XXX** |

**Template: Intravitreal Injection**

| Line | Service | CPT Code | Units | Fee |
|---|---|---|---|---|
| 1 | Intravitreal injection | 67028 | 1 (OD) | $XXX |
| 2 | Drug (anti-VEGF, office supply) | J-codes (J3490/J3590 or specific) | 1 | $XXX |
| 3 | OCT post-injection monitoring | 92134 | 1 | $XXX |
| | **Total** | | | **$XXX** |

**Template: Cataract Surgery**

| Line | Service | CPT Code | Units | Fee |
|---|---|---|---|---|
| 1 | Phacoemulsification + IOL | 66984 | 1 | $XXX |
| 2 | IOL (premium, if applicable) | 66990 | 1 | $XXX |
| 3 | Anesthesia (if billed separately) | 00142 | 1 | $XXX |
| | **Total** | | | **$XXX** |

### 6.4 Insurance Integration

- Insurance plan database with coverage rules (covered procedures, copay percentages, pre-auth requirements).
- Auto-check whether ordered procedures require pre-authorization.
- Generate insurance claim with ICD-10 + CPT pairing.
- Support for multiple insurance payers per patient (primary, secondary).
- Track claim status: submitted / accepted / rejected / paid / appealed.
- Support for self-pay and installment plans.

### 6.5 Inventory Module

**Inventory Item Categories:**

1. **Drugs**
   - Anti-VEGF agents (per vial/syringe)
   - Steroid implants
   - Topical drops (antibiotics, steroids, glaucoma, dilating)
   - Injection supplies (syringes, needles, betadine)
   - Systemic medications (if dispensed)

2. **IOLs**
   - By manufacturer, model, type, power range
   - Lot/batch tracking
   - Expiry date tracking
   - Consignment stock management (common with IOL suppliers)

3. **Disposables**
   - Surgical gloves, drapes, cannulas
   - Laser filters / lenses (Goldmann, Panther, etc.)
   - Contact lenses (for biometry, VF, treatment)

4. **Optical Products** (if dispensary)
   - Frames, lenses, contact lenses for sale

**Inventory Tracking:**

```
InventoryItem
├── item_id
├── category (drug / iol / disposable / optical)
├── name
├── generic_name (for drugs)
├── manufacturer
├── sku / barcode
├── unit_of_measure (vial, box, piece, pair)
├── current_stock
├── minimum_stock (reorder threshold)
├── maximum_stock
├── unit_cost
├── selling_price (if applicable)
├── expiry_date
├── lot_number
├── storage_location
├── status (active / discontinued / recalled)
├── supplier_info
├── last_reorder_date
├── auto_reorder_enabled (boolean)
```

**Key Inventory Reports:**
- Current stock levels (with color coding: green/yellow/red for stock status)
- Expiring soon (within 30/60/90 days)
- Drug usage by physician, by indication, by month
- Consumption forecast based on injection volume trends
- Reorder suggestions (auto-generated based on usage rate and minimum stock)
- Cost analysis: drug cost per injection, cost per procedure type

---

## 7. Reporting and Analytics

### 7.1 Clinical KPIs

| Metric | Calculation | Frequency |
|---|---|---|
| Injection volume per drug | Count injections grouped by drug name | Monthly |
| Injection volume per eye | Count injections by laterality | Monthly |
| Average injections per patient per year | Total injections / unique patients per year | Quarterly |
| Treatment switch rate | Patients who switched drugs / total active patients | Quarterly |
| Average interval (treatment-free interval) | Mean days between last 3 injections for T&E patients | Monthly |
| Cataract surgery volume | Count surgeries by type and surgeon | Monthly |
| Cataract outcomes | % eyes within ±0.5D of target refraction at 1 month | Monthly |
| Complication rates | Complications / total procedures (by type) | Monthly |
| VA improvement post-surgery | Mean change in BCVA pre vs post (3 months) | Quarterly |

### 7.2 Disease Registries

**Glaucoma Registry:**
- Total active glaucoma patients
- Patients by stage (OHT, pre-perimetric, mild, moderate, severe, endpoint)
- Patients overdue for review (>1 month past due)
- Patients with documented progression (VF or OCT)
- Patients at target IOP vs above target

**DR Registry:**
- Total diabetic patients screened
- Distribution by DR grade (no DR, mild, moderate, severe NPDR, PDR)
- Patients needing referral (severe NPDR, PDR, CSME)
- Patients overdue for screening
- Correlation with HbA1c (if lab data available)

**AMD Registry:**
- Total wet AMD patients on active injection
- Average number of injections per patient
- Patients with suboptimal response
- Treatment-naïve vs switched patients

### 7.3 Operational KPIs

| Metric | Calculation | Frequency |
|---|---|---|
| Patient wait time | Time from check-in to physician encounter start | Daily/weekly |
| Visit volume | Total encounters by clinic type | Daily/weekly/monthly |
| No-show rate | No-shows / scheduled appointments | Weekly |
| Cancellation rate | Cancelled / scheduled | Weekly |
| Physician utilization | Encounters per physician per session | Weekly |
| Injection clinic throughput | Injections per session hour | Weekly |
| Average encounter duration | Time from encounter open to save | Monthly |
| Imaging utilization | Tests performed / patients seen | Monthly |
| Revenue per encounter | Total billed / encounters | Monthly |

### 7.4 Export and Distribution

- **Export formats**: CSV, Excel, PDF, print
- **Scheduled reports**: daily, weekly, monthly — auto-generated and emailed to admin
- **Role-based dashboards**:
  - **Physician dashboard**: own patient outcomes, injection log, surgical outcomes
  - **Clinic manager dashboard**: operational KPIs, wait times, volumes
  - **Billing dashboard**: revenue, outstanding balances, claim status
  - **Admin dashboard**: all metrics, user activity, system health
  - **Pharmacy/inventory dashboard**: stock levels, usage trends, expiry alerts

---

## 8. Security, Privacy, and Compliance

### 8.1 Authentication

- **Username + password** (minimum 12 characters, complexity requirements enforced).
- **Two-factor authentication (2FA)** — optional but recommended; supports:
  - Authenticator app (TOTP: Google Authenticator, Microsoft Authenticator)
  - SMS OTP (as backup)
- **Session management**: auto-lock after 5 minutes of inactivity; auto-logout after 15 minutes.
- **Password expiry**: every 90 days, with history (cannot reuse last 5 passwords).
- **Account lockout**: after 5 failed attempts, lock for 30 minutes (admin can unlock).
- **Single Sign-On (SSO)**: optional SAML/OAuth2 integration for hospital environments.

### 8.2 Role-Based Access Control (RBAC)

- All permissions enforced at application level (see §1.2 matrix).
- Access control lists (ACLs) per module, per data type.
- Principle of least privilege: new users default to minimum access; upgrades require admin approval.
- Emergency access break-glass procedure: in life-threatening situations, a physician can access any record, but this triggers an immediate audit flag requiring written justification within 24 hours.

### 8.3 Audit Logging

- Immutable audit trail for all CRUD operations on:
  - Patient demographics
  - Clinical notes
  - Diagnoses
  - Medications
  - Procedures
  - Imaging
  - Billing records
  - System configuration changes
  - User management actions
- Log format: `{timestamp, user_id, user_role, action, resource_type, resource_id, old_value, new_value, ip_address, device_info}`
- Audit logs stored in separate, append-only database/table.
- Retention: minimum 10 years (or as required by local law).
- Logs viewable by admin (full) and by individual users (own actions only).
- Tamper detection: hash chain or digital signature on log entries.

### 8.4 Data Encryption

- **In transit**: TLS 1.2+ for all network communication (HTTPS enforced, HSTS header).
- **At rest**: AES-256 encryption for:
  - Database (full database encryption or column-level for PHI)
  - File storage (DICOM images, uploaded documents)
  - Backups
- **Key management**: encryption keys stored in a separate key management system (KMS) or hardware security module (HSM); never embedded in application code.
- **Mobile/tablet access** (if applicable): device-level encryption required, remote wipe capability.

### 8.5 Backup and Disaster Recovery

| Component | Backup Strategy | RPO | RTO |
|---|---|---|---|
| Database | Continuous replication + daily full backup to offsite/cloud | 5 minutes | 1 hour |
| DICOM/Image storage | Daily incremental, weekly full backup to offsite/cloud | 24 hours | 4 hours |
| Application server | VM snapshot daily, config backup to version control | 24 hours | 2 hours |
| Audit logs | Real-time replication to separate storage | Near zero | 1 hour |

- **Recovery Point Objective (RPO)**: maximum 5 minutes of data loss.
- **Recovery Time Objective (RTO)**: system operational within 1 hour of disaster.
- **Backup testing**: quarterly restoration test to verify backup integrity.
- **Geographic redundancy**: primary and backup data centers in different physical locations (within Lebanon or regionally).
- **Air-gapped backup**: monthly offline backup stored separately for ransomware protection.

### 8.6 Compliance Considerations

**Lebanon-Specific:**
- Lebanon does not have a comprehensive health data privacy law equivalent to HIPAA or GDPR as of 2026. However, the system should comply with:
  - Lebanese Electronic Transactions and Personal Data Law (Law No. 81/2018 on Electronic Transactions and Personal Data) — general data protection provisions.
  - Lebanese Order of Physicians ethical obligations regarding patient confidentiality.
  - Lebanese Order of Pharmacists requirements for drug prescription and inventory records.
  - Any Ministry of Public Health (MoPH) requirements for medical records retention and reporting.

**Best Practices (HIPAA/GDPR-aligned):**
- Patient consent for data collection and processing (documented in system).
- Right to access own medical records (patient portal or printed records).
- Right to request correction of inaccurate data.
- Minimum necessary access principle enforced.
- Data minimization: collect only what is clinically necessary.
- De-identification capability for research and analytics exports.
- Breach notification procedure: documented plan for notifying affected patients and authorities within 72 hours.
- Data Protection Officer (DPO) role assigned (even if not legally required, as best practice).
- Business Associate Agreements (BAAs) with all third-party vendors (cloud providers, device vendors, etc.).
- Annual security risk assessment and remediation plan.

---

## 9. Implementation and Training Plan

### 9.1 Phased Rollout

**Phase 1: Pilot (8–12 weeks)**
- Deploy to 1 clinic room / 1–2 physicians + supporting staff.
- Focus on core workflows: patient registration, examination documentation, diagnosis, basic imaging import.
- Exclude: billing integration, inventory, advanced reporting.
- Success criteria:
  - 80% of encounters documented in EMR (vs. paper) within 2 weeks.
  - Average encounter documentation time ≤ 1.5× paper baseline by week 8.
  - Zero critical bugs blocking clinical workflow.
  - User satisfaction score ≥ 3.5/5.

**Phase 2: Clinic Expansion (8–12 weeks)**
- Roll out to all clinic rooms and all physicians.
- Add: injection workflow, glaucoma/DR registries, device integration (OCT, VF).
- Add: billing module and insurance integration.
- Success criteria:
  - 95% of encounters in EMR.
  - Billing accuracy ≥ 98% (claims not rejected for documentation errors).
  - All device results auto-imported for integrated devices.

**Phase 3: Full Deployment (8–12 weeks)**
- Add: inventory module, surgical planning, full analytics dashboards.
- Add: recall system, patient communication (SMS/WhatsApp integration).
- Add: PACS integration.
- Add: multi-language interface (Arabic fully functional).
- Success criteria:
  - Paper completely eliminated for clinical documentation.
  - Inventory discrepancies < 2%.
  - All users trained and self-sufficient on role-specific workflows.

**Phase 4: Optimization (Ongoing)**
- Performance tuning, workflow refinement based on user feedback.
- Add advanced features (AI auto-coding, predictive analytics).
- Expansion to additional clinic locations if applicable.

### 9.2 Data Migration

**From Existing EMR:**
- Inventory of all existing data sources (legacy EMR, paper records, spreadsheets).
- Export patient demographics, diagnoses, medications, allergy lists from old EMR.
- Mapping document: old data fields → new EMR fields.
- Import in batches with validation reports.
- Run parallel operation (old + new) for 2–4 weeks to verify data completeness.

**From Paper Records:**
- Do NOT attempt to digitize entire paper archive.
- Digitize only active patients (seen within last 12 months).
- Priority: chronic disease patients (glaucoma, DR, AMD) who need ongoing tracking.
- Scanned paper records stored as PDF attachments in patient chart (for reference).
- Key data points (diagnoses, medications, IOP history) manually entered for active chronic patients.

**Data Quality Checks:**
- Automated validation: check for required fields, valid codes, consistent laterality.
- Manual review: random sample of 10% of migrated records verified by clinical staff.
- Reconciliation report: patient counts, encounter counts, data completeness metrics.

### 9.3 Training Plan

| Role | Training Focus | Duration | Format |
|---|---|---|---|
| **Ophthalmologist** | Encounter documentation, diagnosis entry, injection/surgery documentation, clinical dashboards | 2 × 2-hour sessions | Hands-on with real patient scenarios |
| **Resident** | Same as ophthalmologist + co-signing workflow | 2 × 2-hour sessions | Paired with supervising physician |
| **Optometrist** | Refraction entry, pre-op testing, topography review | 1 × 2-hour session | Hands-on |
| **Technician** | Patient check-in, VA/IOP entry, device import, test ordering | 3 × 1.5-hour sessions | Hands-on with device integration practice |
| **Nurse** | Injection workflow, medication dispensing, post-injection monitoring | 2 × 1.5-hour sessions | Simulation with mock injection day |
| **Receptionist** | Patient registration, scheduling, check-in/out, insurance entry | 2 × 1.5-hour sessions | Hands-on |
| **Billing** | Invoice creation, coding, insurance claims, payment processing | 3 × 2-hour sessions | Hands-on with sample scenarios |
| **Admin** | System configuration, user management, audit log review, backup monitoring | 2 × 2-hour sessions | Technical walkthrough |

**Training Principles:**
- All training uses **realistic sample data** (de-identified but clinically authentic).
- Short, frequent sessions preferred over marathon sessions.
- "Cheat sheets" / quick reference cards for each role (laminated, posted at workstations).
- Video recordings of key workflows available for on-demand review.
- Training environment (sandbox) available for practice without affecting live data.

### 9.4 Super-User Model

- **Identify 1–2 super-users per role** (technically apt, enthusiastic users).
- Super-users receive **advanced training** (4 additional hours) covering:
  - Troubleshooting common issues
  - Advanced features and customization
  - How to escalate issues to IT support
- Super-users serve as **first-line support** for their peers (reduces IT ticket volume).
- Monthly super-user meeting with IT/project team to discuss issues and improvements.
- Super-users receive **early access** to new features and updates.

### 9.5 Ongoing Support Structure

- **Help desk**: dedicated support channel (phone, WhatsApp group, or ticketing system).
  - Response time targets: critical (30 min), high (2 hours), normal (next business day).
- **Bug tracking**: all issues logged in a ticketing system with status tracking.
- **Release cycle**: monthly bug fix updates, quarterly feature updates.
- **Change management**: all updates tested in staging environment before production deployment.
- **User feedback loop**: in-app feedback button, quarterly user surveys, annual workflow review.
- **System monitoring**: uptime monitoring, performance dashboards, automated alerts for issues.

---

## 10. Future-Proofing and AI Features

### 10.1 AI Scribe / Visit Auto-Summarization

**Concept:** Ambient AI assistant that listens to the physician-patient conversation and auto-generates a structured clinical note.

**How it would work:**
1. Physician activates AI scribe at encounter start (opt-in per encounter).
2. AI processes audio (on-device or cloud-based, with patient consent).
3. AI generates:
   - Structured chief complaint
   - History of present illness (HPI) summary
   - Review of systems
   - Assessment and plan (mapped to diagnoses and orders)
4. Physician reviews, edits, and signs the auto-generated note.
5. Significant time savings: potentially reducing documentation time by 50-70%.

**Data structures to support this:**
- All clinical findings stored in structured fields (not just free text) → AI can map conversation to structured data.
- Template-based note generation: AI fills in existing templates.
- Conversation transcript stored (with consent) alongside the note for audit.
- Arabic and English NLP models needed.

### 10.2 Auto-Coding (ICD-10 + CPT)

**Concept:** AI reads the clinical note and suggests appropriate diagnosis and procedure codes.

**Implementation:**
- Rule-based layer first (structured diagnoses → auto-map to ICD-10).
- NLP layer for free-text notes → extract diagnoses and map to ICD-10.
- CPT code suggestions based on procedures documented and exams performed.
- Physician confirms or adjusts suggested codes (human-in-the-loop).
- Reduces billing errors and increases revenue capture.

### 10.3 Smart Templates

**Concept:** Templates that adapt based on context (diagnosis, visit type, physician preference).

**Examples:**
- If patient has wet AMD and this is visit #7 in injection series → template pre-fills: drug, interval, OCT comparison prompts, injection response fields.
- If patient has glaucoma → template includes IOP trend, VF comparison prompts, target IOP, medication list.
- Templates learn from physician's past entries for similar patients (pattern matching).

### 10.4 Risk Prediction

**Concept:** ML models that predict clinical risks based on accumulated patient data.

**Potential models:**
- **Glaucoma progression risk**: based on IOP trend, RNFL thinning rate, VF progression, C/D ratio, risk factors.
- **AMD conversion risk**: from drusen volume on OCT, pigment changes, genetic risk factors.
- **Diabetic retinopathy progression risk**: based on DR grade trajectory, HbA1c trend, duration of diabetes, blood pressure.
- **Recall non-compliance risk**: predict which patients are likely to miss appointments and prioritize outreach.
- **Surgical complication risk**: based on biometry, cataract grade, patient comorbidities.

**Data structures to support this:**
- Time-series storage of all clinical metrics (IOP, VA, CST, MD, RNFL thickness, C/D ratio).
- Structured comorbidity data (diabetes control, hypertension, medications).
- Outcome data linked to procedures and treatments.
- Sufficient volume of historical data (at least 2-3 years of digitized records).

### 10.5 Recall Optimization

**Concept:** AI-optimized scheduling for injection patients and chronic disease follow-ups.

**How it works:**
- Analyze individual treatment response patterns (injection interval, fluid recurrence timing).
- Recommend personalized follow-up intervals (moving from fixed protocol to treat-and-extend optimization).
- Optimize clinic scheduling to balance injection volumes across available slots.
- Predict no-show risk and overbook accordingly.

### 10.6 Documentation Assistance

**Concept:** Real-time suggestions during documentation.

**Features:**
- As physician types "20/" → suggest common VA values based on patient history.
- As physician enters diagnosis → auto-suggest related follow-up intervals and protocols.
- Auto-detect inconsistencies (e.g., documenting "pseudophakic" but no IOL details entered).
- Auto-flag overdue items (injection overdue, follow-up overdue, consent expired).
- Suggest relevant images from patient's history when documenting a finding (e.g., when documenting macular edema, surface last OCT for comparison).

### 10.7 Architecture for AI Readiness

**Technical prerequisites for future AI features:**

1. **Structured data storage**: all clinical findings in discrete fields (not buried in free text).
2. **Time-series data model**: every metric stored with timestamp, enabling trend analysis.
3. **API-first design**: all data accessible via RESTful APIs for AI model integration.
4. **Event-driven architecture**: clinical events (new OCT result, new injection) trigger notifications that AI services can consume.
5. **Data lake / warehouse**: anonymized data aggregated for model training.
6. **Model serving infrastructure**: ability to deploy ML models alongside the EMR (containerized, e.g., Docker/Kubernetes).
7. **A/B testing framework**: ability to compare AI-assisted vs non-assisted outcomes.
8. **Explainability**: AI predictions must include confidence scores and reasoning (for physician trust and medicolegal defensibility).
9. **Consent management**: explicit patient consent for AI-assisted care, stored per encounter.
10. **Regulatory awareness**: AI features should be classified as clinical decision support (not autonomous), keeping the physician as the final decision-maker.

---

## Appendix A: Example Data Fields — Injection Log Table

| Field | Type | Description |
|---|---|---|
| date | Date | Date of injection |
| patient_name | String | Patient full name |
| MRN | String | Medical record number |
| eye | Enum (OD/OS) | Eye injected |
| drug | Enum | Drug name (bevacizumab, ranibizumab, aflibercept, etc.) |
| dose | String | Dose (e.g., 1.25mg, 2mg, 8mg) |
| lot_number | String | Drug batch/lot number |
| pre_iop | Integer (mmHg) | IOP before injection |
| post_iop | Integer (mmHg) | IOP after injection (if measured) |
| pre_va | String | VA before injection (Snellen) |
| post_va | String | VA after injection (if measured) |
| consent | Boolean | Consent documented |
| quadrant | Enum | Injection site |
| complications | String | Complications (or "None") |
| response | Enum | Improved / Stable / Worse |
| series_number | Integer | Injection number in current series |
| interval_days | Integer | Days since last injection |
| next_due_date | Date | Next scheduled injection |
| next_interval_days | Integer | Planned interval to next injection |
| physician | String | Injecting physician |
| indication | Enum | Wet AMD, DME, RVO, etc. |

## Appendix B: Example Screen Layouts (Text Description)

### Main Encounter Screen

```
┌─────────────────────────────────────────────────────────────────┐
│ Patient: Ahmad Khalil (MRN: 12345)  │ DOB: 1958-03-12  │ ♀  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [ OD (Right) ] [ OS (Left) ] [ OU (Both) ]                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Chief Complaint────────────────────────────────────────────┐ │
│ │ Decreased vision OD x 2 weeks                              │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Visual Acuity Grid─────────────────────────────────────────┐ │
│ │           │ Dist UCVA │ Dist BCVA │ Near UCVA │ Near BCVA  │ │
│ │    OD     │  20/80    │  20/40    │  J4       │  J2        │ │
│ │    OS     │  20/25    │  20/20    │  J1       │  J1        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Refraction Grid────────────────────────────────────────────┐ │
│ │           │ SPH    │ CYL    │ Axis │ Add   │ PD            │ │
│ │    OD     │ -2.00  │ -1.25  │ 110  │ +2.00 │ 62            │ │
│ │    OS     │ -0.75  │ -0.50  │ 85   │ +2.00 │ 62            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─IOP Grid───────────────────────────────────────────────────┐ │
│ │           │ IOP    │ Method       │ Time    │ CCT          │ │
│ │    OD     │ 18     │ Goldmann     │ 09:30   │ 545          │ │
│ │    OS     │ 15     │ Goldmann     │ 09:32   │ 555          │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Anterior Segment (OD)──────────────────────────────────────┐ │
│ │ Cornea: [Clear ▼]  AC: [Deep ▼] Cells: [0 ▼] Flare: [0 ▼]│ │
│ │ Lens: [Pseudophakic ▼] IOL: [ACRY pansoptic ▼] Position:  │ │
│ │ [In-the-bag ▼]                                              │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Posterior Segment (OD)─────────────────────────────────────┐ │
│ │ Macula: [Edema ▼] CST: [420]µm  SRF: [Yes ▼]  IRF: [No ▼]│ │
│ │ ONH: C/D [0.7]  Rim: [Thin ▼]  RNFL avg: [72]µm          │ │
│ │ Retina: [Attached ▼] Periphery: [Laser scars inferotemp ▼] │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Diagnoses──────────────────────────────────────────────────┐ │
│ │ ☑ Wet AMD (exudative), OD — H35.32x — Active              │ │
│ │ ☑ Pseudophakia, OD — Z96.1                                 │ │
│ │ ☐ Open-angle glaucoma, OS — H40.11x — Mild                │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Images & Tests─────────────────────────────────────────────┐ │
│ │ [📷 OCT Macula OD - 2026-09-01] [📷 Fundus Photo OD]      │ │
│ │ [📊 VF 24-2 OD - 2026-06-15]                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─Plan───────────────────────────────────────────────────────┐ │
│ │ ☑ Injection — aflibercept 8mg OD today                     │ │
│ │ ☑ OCT repeat in 4 weeks                                    │ │
│ │ ☑ Next injection: 2026-10-06                                │ │
│ │ ☐ Refer to retina specialist if no improvement — (saved)   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [ 💉 Inject ] [ 📋 Print ] [ 💾 Save ] [ ⬤ Record ]         │
└─────────────────────────────────────────────────────────────────┘
```

## Appendix C: Glossary

| Abbreviation | Full Term |
|---|---|
| AC | Anterior Chamber |
| AMD | Age-related Macular Degeneration |
| BCVA | Best-Corrected Visual Acuity |
| CCT | Central Corneal Thickness |
| CNV | Choroidal Neovascularization |
| CSME | Clinically Significant Macular Edema |
| CPT | Current Procedural Terminology |
| CST | Central Subfield Thickness |
| DME | Diabetic Macular Edema |
| DR | Diabetic Retinopathy |
| EDOF | Extended Depth of Focus |
| FA | Fluorescein Angiography |
| GCC | Ganglion Cell Complex |
| HM | Hand Motion |
| ICD-10 | International Classification of Diseases, 10th Revision |
| ICG | Indocyanine Green (angiography) |
| IOP | Intraocular Pressure |
| IOL | Intraocular Lens |
| IRF | Intraretinal Fluid |
| logMAR | Logarithm of the Minimum Angle of Resolution |
| MD | Mean Deviation |
| NPDR | Non-Proliferative Diabetic Retinopathy |
| OCT | Optical Coherence Tomography |
| OCTA | Optical Coherence Tomography Angiography |
| OD | Oculus Dexter (Right Eye) |
| OS | Oculus Sinister (Left Eye) |
| OU | Oculus Uterque (Both Eyes) |
| PDR | Proliferative Diabetic Retinopathy |
| PL | Perception of Light |
| PSD | Pattern Standard Deviation |
| RAPD | Relative Afferent Pupillary Defect |
| RNFL | Retinal Nerve Fiber Layer |
| RVO | Retinal Vein Occlusion |
| SCH | Subconjunctival Hemorrhage |
| SE | Spherical Equivalent |
| SLT | Selective Laser Trabeculoplasty |
| SRF | Subretinal Fluid |
| T&E | Treat and Extend |
| UCVA | Uncorrected Visual Acuity |
| VF | Visual Field |
| VFI | Visual Field Index |
| WTW | White-to-White (corneal diameter) |

---

*End of Specification Document v1.0*

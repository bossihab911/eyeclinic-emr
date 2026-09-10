/* pages/encounter.js — new encounter form with per-eye tabs */
"use strict";
const EncounterForm = {
  state: {
    eye: "OD",
    eyes: {
      OD: defaultEye(),
      OS: defaultEye(),
    },
    diagnoses: [],
    medications: [],
    icdOptions: [],
    icdSearch: "",
  },
};

function defaultEye() {
  return {
    ucva_dist: "", ucva_near: "", bcva_dist: "", bcva_near: "", pinhole: "",
    sph: "", cyl: "", axis: "", add: "", pd: "", refraction_type: "manifest",
    iop: "", iop_method: "Goldmann", cct: "",
    eyelids: "", conjunctiva: "", cornea: "", ac_depth: "", ac_cells: "", ac_flare: "", iris: "", pupil_mm: "", rapd: "",
    lens_status: "", cataract_type: "", cataract_grade: "", iol_type: "",
    vitreous: "", macula: "", cst_um: "", srf: "", irf: "", cdr: "", rim: "", rnfl_um: "",
    retina: "", hemorrhage: "", exudates: "", neovascularization: "", laser_scars: "",
    anterior_notes: "", posterior_notes: "",
  };
}

app.register("/patients/:id/new-encounter", async (ctx) => {
  const { content, params } = ctx;
  const t = i18n.t.bind(i18n);
  const pid = params.id;
  const st = EncounterForm.state;
  // fetch patient for header
  let patient = null;
  try {
    const r = await api.get(`/patients/${pid}`);
    patient = r.patient;
  } catch (_) {}
  st.eyes = { OD: defaultEye(), OS: defaultEye() };
  st.diagnoses = [];
  st.medications = [];
  st.eye = "OD";

  const VA_OPTIONS = ["", "NLP", "PL", "HM", "CF", "1/10", "2/10", "3/10", "4/10", "5/10", "6/10", "7/10", "8/10", "9/10", "10/10", "11/10", "12/10"];
  const VA_NEAR_OPTIONS = ["", "J1", "J2", "J3", "J5", "J7", "J10", "J12", "NLP", "PL", "HM", "CF"];
  const OPHTHALMIC_MEDS = [
    "Latanoprost 0.005%", "Travoprost 0.004%", "Bimatoprost 0.01%", "Timolol 0.5%", "Dorzolamide 2%", "Brinzolamide 1%", "Brimonidine 0.2%", "Pilocarpine 2%", "Acetazolamide 250mg",
    "Prednisolone acetate 1%", "Dexamethasone 0.1%", "Fluorometholone 0.1%", "Loteprednol 0.5%", "Dexamethasone implant 0.7mg", "Triamcinolone 40mg",
    "Moxifloxacin 0.5%", "Ofloxacin 0.3%", "Tobramycin 0.3%", "Ciprofloxacin 0.3%", "Erythromycin 0.5%", "Azithromycin 1%",
    "Ketorolac 0.5%", "Nepafenac 0.1%", "Diclofenac 0.1%", "Olopatadine 0.1%", "Ketotifen 0.025%",
    "Tropicamide 1%", "Phenylephrine 2.5%", "Cyclopentolate 1%", "Atropine 1%", "Homatropine 2%",
    "Ranibizumab 0.5mg", "Aflibercept 2mg", "Bevacizumab 1.25mg", "Faricimab 6mg",
    "Timolol/Dorzolamide", "Brimonidine/Timolol", "Carboxymethylcellulose 0.5%", "Hyaluronic acid 0.2%", "Artificial tears", "Sodium hyaluronate"
  ];
  const ENC_TYPES = [["follow_up", t("followUpVisit")], ["new", t("newPatientVisit")], ["pre_op", t("preOpVisit")], ["post_op", t("postOpVisit")], ["emergency", t("emergencyVisit")]];
  const SPECIALTIES = [["", ""], ["retina", "Retina"], ["glaucoma", "Glaucoma"], ["cornea", "Cornea"], ["uveitis", "Uveitis"], ["comprehensive", "Comprehensive"]];
  const IOP_METHODS = ["Goldmann", "Non-contact", "Tonopen", "Perkins", "Digital"];

  function render() {
    const eye = st.eye;

    content.innerHTML = `
      <div class="page max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <button data-act="back" class="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">←</button>
            <div>
              <h1 class="text-lg font-bold text-slate-800">${patient ? `${ui.esc(patient.full_name_en || patient.full_name_ar)}` : "New visit"}</h1>
              <p class="text-xs text-slate-400">${ui.esc(patient ? patient.mrn : "")} · ${t("newEncounter")}</p>
            </div>
          </div>
          <button data-act="save" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow">💾 ${t("save")}</button>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          ${ui.row(`
            ${ui.field({ id: "e-date", label: t("encounterDate"), type: "date", value: new Date().toISOString().slice(0, 10) })}
            ${ui.field({ id: "e-type", label: t("encounterType"), type: "select", options: ENC_TYPES })}
            ${ui.field({ id: "e-spec", label: t("specialty"), type: "select", options: SPECIALTIES })}
          `, 3)}
          ${ui.row(`${ui.field({ id: "e-reason", label: t("reason"), type: "text", placeholder: "Chief complaint" })}`, 1)}
        </div>

        <!-- Per-eye tabs -->
        <div class="mb-4">
          <div class="flex gap-1.5 mb-3">
            ${["OD", "OS"].map((e_) => `
              <button data-eye="${e_}" class="px-4 py-2 rounded-lg text-sm font-semibold transition-all ${st.eye === e_ ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">
                ${e_ === "OD" ? "👁 " + t("od") : "👁 " + t("os")}
              </button>`).join("")}
          </div>

          <datalist id="va-options">${VA_OPTIONS.map((v) => `<option value="${v}">`).join("")}</datalist><datalist id="va-near-options">${VA_NEAR_OPTIONS.map((v) => `<option value="${v}">`).join("")}</datalist>
          ${eyeTab(eye)}
        </div>

        <!-- Diagnoses -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 class="text-sm font-bold text-slate-700 mb-3">🩺 ${t("diagnoses")}</h3>
          <div class="relative mb-3">
            <input id="dx-search" placeholder="Search ICD-10…" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${ui.esc(st.icdSearch)}">
            <div id="dx-results" class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
          </div>
          <div id="dx-list" class="space-y-1.5"></div>
        </div>

         <!-- Medications -->
         <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
           <h3 class="text-sm font-bold text-slate-700 mb-3">💊 ${t("medications") || "Medications"}</h3>
           <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
             <div class="relative">
               <input id="med-drug" placeholder="Drug — type to search…" autocomplete="off" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
               <div id="med-results" class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto hidden"></div>
             </div>
             <input id="med-strength" placeholder="Strength" class="border border-slate-300 rounded-lg px-3 py-2 text-sm">
             <div><input id="med-freq" list="freq-options" placeholder="Frequency (BID…)" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><datalist id="freq-options"><option value="QD"><option value="BID"><option value="TID"><option value="QID"><option value="QHS"><option value="Q2H"><option value="Q4H"><option value="Q6H"><option value="Q8H"><option value="Q12H"><option value="PRN"><option value="HS"><option value="Weekly"></datalist></div>
             <select id="med-eye" class="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="OD">OD</option><option value="OS">OS</option><option value="OU">OU</option></select>
           </div>
          <button data-act="add-med" class="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg">＋ Add</button>
          <div id="med-list" class="mt-3 space-y-1.5"></div>
        </div>

        <!-- Plan -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 class="text-sm font-bold text-slate-700 mb-3">📋 ${t("plan")}</h3>
          <textarea id="e-plan" rows="2" placeholder="Assessment & plan…" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"></textarea>
          ${ui.row(`
            <div>${ui.field({ id: "e-fu-days", label: t("interval") + " (days)", type: "number" })}</div>
            ${ui.field({ id: "e-fu-type", label: t("followUp"), type: "select", options: [["routine", "Routine"], ["injection_series", "Injection series"], ["post_op", "Post-op"], ["dr_screening", "DR screening"]] })}
            ${ui.field({ id: "e-fu-inst", label: "Instructions", type: "text", placeholder: "Bring old OCT…" })}
          `, 3)}
        </div>
      </div>`;

    // rerender dynamic lists
    renderDxList();
    renderMedList();
    renderIcdSearch();

    const tabs = content.querySelectorAll("[data-eye]");
    tabs.forEach((b) => b.addEventListener("click", () => {
      st.eye = b.dataset.eye; render();
      bindAfterRender();
    }));

    bindAfterRender();

    // ICD search input
    const dx = content.querySelector("#dx-search");
    if (dx) {
      let timer;
      dx.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = dx.value.trim();
          if (q.length < 2) { content.querySelector("#dx-results").classList.add("hidden"); return; }
          try {
            const r = await api.get(`/icd10?q=${encodeURIComponent(q)}`);
            content.querySelector("#dx-results").innerHTML = (r || []).map((c) => `
              <button data-icd="${ui.esc(c.code)}" data-descr="${ui.esc(c.short_desc)}" class="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm">
                <span class="font-mono font-semibold text-indigo-600">${ui.esc(c.code)}</span>
                <span class="text-slate-600"> ${ui.esc(c.short_desc)}</span>
              </button>`).join("");
            content.querySelector("#dx-results").classList.remove("hidden");
            content.querySelectorAll("[data-icd]").forEach((b) => b.addEventListener("click", () => {
              st.diagnoses.push({ icd10: b.dataset.icd, description: b.dataset.descr, laterality: st.eye, stage: "" });
              content.querySelector("#dx-results").classList.add("hidden");
              dx.value = "";
              renderDxList();
            }));
          } catch (_) {}
        }, 300);
      });
      dx.addEventListener("focus", () => { if (content.querySelector("#dx-results").children.length) content.querySelector("#dx-results").classList.remove("hidden"); });
      document.addEventListener("click", (ev) => { if (!ev.target.closest("#dx-search") && !ev.target.closest("#dx-results")) content.querySelector("#dx-results").classList.add("hidden"); });
    }

    const medInput = content.querySelector("#med-drug");
    const medRes = content.querySelector("#med-results");
    if (medInput && medRes) {
      const showMeds = () => {
        const q = medInput.value.trim().toLowerCase();
        const filtered = q.length < 1 ? OPHTHALMIC_MEDS.slice(0, 8) : OPHTHALMIC_MEDS.filter((m) => m.toLowerCase().includes(q)).slice(0, 8);
        if (!filtered.length) { medRes.classList.add("hidden"); return; }
        medRes.innerHTML = filtered.map((m) => `<button data-med="${ui.esc(m)}" class="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm">${ui.esc(m)}</button>`).join("");
        medRes.classList.remove("hidden");
        medRes.querySelectorAll("[data-med]").forEach((b) => b.addEventListener("click", () => {
          const full = b.dataset.med;
          const mm = full.match(/\s(\d+\.?\d*\s*(%|mg).*)$/i);
          if (mm) {
            medInput.value = full.slice(0, full.length - mm[0].length).trim();
            const sInput = content.querySelector("#med-strength");
            if (sInput) sInput.value = mm[1].trim();
          } else {
            medInput.value = full;
          }
          medRes.classList.add("hidden");
        }));
      };
      medInput.addEventListener("input", showMeds);
      medInput.addEventListener("focus", showMeds);
      document.addEventListener("click", (ev) => { if (!ev.target.closest("#med-drug") && !ev.target.closest("#med-results")) medRes.classList.add("hidden"); });
    }

    const sab = content.querySelector("[data-act='save']");
    if (sab) sab.addEventListener("click", save);
    const back = content.querySelector("[data-act='back']");
    if (back) back.addEventListener("click", () => { location.hash = `#/patients/${pid}`; });
  }

  function bindAfterRender() {
    const content = document.getElementById("page-content");
    content.querySelectorAll("[data-act='add-med']").forEach((b) => b.addEventListener("click", () => {
      const drug = content.querySelector("#med-drug").value.trim();
      if (!drug) return ui.toast("Enter drug name", "warning");
      st.medications.push({
        drug, strength: content.querySelector("#med-strength").value.trim(),
        frequency: content.querySelector("#med-freq").value.trim(), eye: content.querySelector("#med-eye").value,
      });
      content.querySelector("#med-drug").value = ""; content.querySelector("#med-strength").value = ""; content.querySelector("#med-freq").value = "";
      renderMedList();
    }));
    // bind per-eye inputs to state
    const eye = st.eye;
    const e = st.eyes[eye];
    const fields = ["ucva_dist", "ucva_near", "bcva_dist", "bcva_near", "pinhole", "sph", "cyl", "axis", "add", "pd",
      "iop", "cct", "eyelids", "conjunctiva", "cornea", "ac_depth", "ac_cells", "ac_flare", "iris", "pupil_mm", "rapd",
      "lens_status", "cataract_type", "cataract_grade", "iol_type", "vitreous", "macula", "srf", "irf", "cdr",
      "rim", "rnfl_um", "retina", "hemorrhage", "exudates", "neovascularization", "laser_scars", "anterior_notes",
      "posterior_notes", "cst_um"];
    fields.forEach((f) => {
      content.querySelectorAll(`[data-ef="${f}"]`).forEach((el) => {
        const upd = () => { e[f] = el.value; };
        el.addEventListener("input", upd);
        el.addEventListener("change", upd);
        if (e[f] != null && e[f] !== "") el.value = e[f];
      });
    });
    content.querySelectorAll("[data-emethod]").forEach((el) => {
      el.addEventListener("change", () => { e[el.dataset.emethod] = el.value; });
    });

    // LHS comment for methods though
  }

function eyeTab(eye) {
    const e = st.eyes[eye];
    const opt = (arr, cur) => `<option value="">—</option>` + arr.map((o) => `<option value="${o}" ${o === cur ? "selected" : ""}>${o}</option>`).join("");
    const binOpt = (cur) => opt(["No", "Yes"], cur);
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- VA / Refraction / IOP -->
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <h4 class="text-xs font-bold uppercase text-slate-400 mb-3">${t("va")} · ${t("refraction")}</h4>
          <div class="flex items-end gap-2 mb-3">
            ${["ucva_dist", "bcva_dist", "ucva_near", "bcva_near"].map((f, i) => `
              <div class="flex-1">
                <label class="block text-[10px] font-semibold text-slate-400 mb-1">${i < 2 ? (i === 0 ? t("ucvaDist") : t("bcvaDist")) : (i === 2 ? t("ucvaNear") : t("bcvaNear"))}</label>
                <input data-ef="${f}" list="${f.includes("near") ? "va-near-options" : "va-options"}" placeholder="${f.includes("dist") ? "5/10" : "J2"}" class="w-full border border-slate-300 rounded-md px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              </div>`).join("")}
            <div class="flex-1">
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">${t("pinhole")}</label>
              <input data-ef="pinhole" list="va-options" placeholder="20/30" class="w-full border border-slate-300 rounded-md px-2 py-1.5 text-center text-sm">
            </div>
          </div>
          <div class="grid grid-cols-5 gap-2 mb-3">
            ${(() => {
              const fmtN = (v) => v.toFixed(2);
              const dispSph = (v) => (v > 0 ? "+" : "") + v.toFixed(2);
              const sel = (vals, cur, disp) => `<option value="">—</option>` + vals.map((v) => {
                const val = typeof v === "number" ? fmtN(v) : String(v);
                const label = disp ? disp(v) : val;
                const isSel = cur !== "" && cur != null && String(cur) !== "" && Number(cur) === Number(v) || String(cur) === val;
                return `<option value="${val}" ${isSel ? "selected" : ""}>${label}</option>`;
              }).join("");
              const sphVals = []; for (let v = -15; v <= 12; v = Math.round((v + 0.25) * 100) / 100) sphVals.push(v);
              const cylVals = []; for (let v = -6; v <= 6; v = Math.round((v + 0.25) * 100) / 100) cylVals.push(v);
              const axisVals = []; for (let v = 0; v <= 180; v++) axisVals.push(v);
              const addVals = [0, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00];
              const pdVals = []; for (let v = 50; v <= 80; v++) pdVals.push(v);
              const curSph = e.sph, curCyl = e.cyl, curAxis = e.axis, curAdd = e.add, curPd = e.pd;
              return `
              <div><div class="text-[10px] font-semibold text-slate-400 mb-1">${t("sph")}</div><select data-ef="sph" class="w-full border border-slate-300 rounded-md px-1 py-1.5 text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">${sel(sphVals, curSph, dispSph)}</select></div>
              <div><div class="text-[10px] font-semibold text-slate-400 mb-1">${t("cyl")}</div><select data-ef="cyl" class="w-full border border-slate-300 rounded-md px-1 py-1.5 text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">${sel(cylVals, curCyl, dispSph)}</select></div>
              <div><div class="text-[10px] font-semibold text-slate-400 mb-1">${t("axis")}</div><select data-ef="axis" class="w-full border border-slate-300 rounded-md px-1 py-1.5 text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"><option value="">—</option>${axisVals.map((v) => `<option value="${v}" ${String(curAxis) === String(v) ? "selected" : ""}>${v}°</option>`).join("")}</select></div>
              <div><div class="text-[10px] font-semibold text-slate-400 mb-1">ADD</div><select data-ef="add" class="w-full border border-slate-300 rounded-md px-1 py-1.5 text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">${sel(addVals, curAdd, dispSph)}</select></div>
              <div><div class="text-[10px] font-semibold text-slate-400 mb-1">${t("pd")}</div><select data-ef="pd" class="w-full border border-slate-300 rounded-md px-1 py-1.5 text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"><option value="">—</option>${pdVals.map((v) => `<option value="${v}" ${String(curPd) === String(v) ? "selected" : ""}>${v}</option>`).join("")}</select></div>`;
            })()}
          </div>
          <div class="pt-3 border-t border-slate-100">
            <div class="text-[10px] font-semibold text-slate-400 mb-1">${t("iop")}</div>
            <div class="grid grid-cols-[70px_1fr_90px] gap-2 items-center">
              <input data-ef="iop" type="number" placeholder="16" class="text-lg font-bold border border-slate-300 rounded-md px-2 py-1.5 text-center">
              <select data-emethod="iop_method" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">${opt(IOP_METHODS, e.iop_method)}</select>
              <input data-ef="cct" type="number" placeholder="CCT µm" class="border border-slate-300 rounded-md px-2 py-1.5 text-center text-sm">
            </div>
          </div>
        </div>

        <!-- Anterior segment -->
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <h4 class="text-xs font-bold uppercase text-slate-400 mb-3">${t("anteriorSegment")}</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div><label class="text-[10px] text-slate-400">Cornea</label><select data-ef="cornea" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Clear", "Edema", "Scar", "Haze", "Cloudy"], e.cornea)}</select></div>
            <div><label class="text-[10px] text-slate-400">AC depth</label><select data-ef="ac_depth" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Deep", "Shallow", "Flat"], e.ac_depth)}</select></div>
            <div><label class="text-[10px] text-slate-400">AC cells</label><select data-ef="ac_cells" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["0", "1+", "2+", "3+", "4+"], e.ac_cells)}</select></div>
            <div><label class="text-[10px] text-slate-400">AC flare</label><select data-ef="ac_flare" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["0", "1+", "2+", "3+"], e.ac_flare)}</select></div>
            <div><label class="text-[10px] text-slate-400">Iris</label><select data-ef="iris" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Normal", "Synechiae", "Rubeosis", "Coloboma"], e.iris)}</select></div>
            <div><label class="text-[10px] text-slate-400">RAPD</label><select data-ef="rapd" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["None", "Mild", "Marked"], e.rapd)}</select></div>
            <div><label class="text-[10px] text-slate-400">${t("lens")}</label><select data-ef="lens_status" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Phakic", "Pseudophakic", "Aphakic"], e.lens_status)}</select></div>
            <div><label class="text-[10px] text-slate-400">Cataract</label><select data-ef="cataract_type" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Nuclear", "Cortical", "PSC", "Mixed"], e.cataract_type)}</select></div>
            <div><label class="text-[10px] text-slate-400">Grade</label><select data-ef="cataract_grade" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${["", "1+", "2+", "3+", "4+"].map((o) => `<option value="${o}" ${o === e.cataract_grade ? "selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
            <div class="sm:col-span-3"><input data-ef="anterior_notes" placeholder="${ui.esc("Anterior segment notes…")}" class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"></div>
          </div>
        </div>

        <!-- Posterior segment -->
        <div class="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <h4 class="text-xs font-bold uppercase text-slate-400 mb-3">${t("posteriorSegment")}</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label class="text-[10px] text-slate-400">Vitreous</label><select data-ef="vitreous" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Clear", "Cells", "Hemorrhage", "PVD", "Syneresis"], e.vitreous)}</select></div>
            <div><label class="text-[10px] text-slate-400">Macula</label><select data-ef="macula" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Normal", "Edema", "Exudates", "Hemorrhage", "Scar", "CNV", "Atrophy"], e.macula)}</select></div>
            <div><label class="text-[10px] text-slate-400">${t("cst")}</label><input data-ef="cst_um" type="number" placeholder="250" class="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm text-center"></div>
            <div><label class="text-[10px] text-slate-400">SRF</label><select data-ef="srf" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${binOpt(e.srf)}</select></div>
            <div><label class="text-[10px] text-slate-400">IRF</label><select data-ef="irf" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${binOpt(e.irf)}</select></div>
            <div><label class="text-[10px] text-slate-400">${t("cdr")}</label><select data-ef="cdr" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9"], e.cdr)}</select></div>
            <div><label class="text-[10px] text-slate-400">Rim</label><select data-ef="rim" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Normal", "Thin", "Notched", "Hemorrhage"], e.rim)}</select></div>
            <div><label class="text-[10px] text-slate-400">RNFL µm</label><input data-ef="rnfl_um" type="number" placeholder="85" class="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm text-center"></div>
            <div><label class="text-[10px] text-slate-400">Retina</label><select data-ef="retina" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["Attached", "Detached", "RD in field"], e.retina)}</select></div>
            <div><label class="text-[10px] text-slate-400">Hemorrhage</label><select data-ef="hemorrhage" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["None", "Dot-blot", "Flame", "Pre-retinal", "Vitreous"], e.hemorrhage)}</select></div>
            <div><label class="text-[10px] text-slate-400">Exudates</label><select data-ef="exudates" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["None", "Hard", "Cotton-wool"], e.exudates)}</select></div>
            <div><label class="text-[10px] text-slate-400">NV</label><select data-ef="neovascularization" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["None", "NVD", "NVE"], e.neovascularization)}</select></div>
            <div class="col-span-2"><label class="text-[10px] text-slate-400">Laser scars</label><select data-ef="laser_scars" class="w-full border rounded-md px-2 py-1.5 text-sm bg-white">${opt(["None", "PRP", "Focal", "Barrage"], e.laser_scars)}</select></div>
            <div class="col-span-4"><input data-ef="posterior_notes" placeholder="${ui.esc("Posterior segment notes…")}" class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"></div>
          </div>
        </div>
      </div>`;
  }

  function renderDxList() {
    const content = document.getElementById("page-content");
    const el = content.querySelector("#dx-list");
    if (!el) return;
    el.innerHTML = st.diagnoses.map((dx, i) => `
      <div class="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div class="text-sm">
          <span class="font-mono font-semibold text-indigo-600">${ui.esc(dx.icd10)}</span>
          <span class="text-slate-600"> ${ui.esc(dx.description)}</span>
        </div>
        <div class="flex items-center gap-2">
          <select data-dxeye="${i}" class="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white">
            ${["OD", "OS", "OU"].map((l) => `<option value="${l}" ${dx.laterality === l ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <input data-dxstage="${i}" placeholder="Stage" value="${ui.esc(dx.stage || "")}" class="text-xs border border-slate-300 rounded-md px-2 py-1 w-24">
          <button data-dxrm="${i}" class="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      </div>`).join("") || `<div class="text-xs text-slate-400">${t("noData")} — search ICD above</div>`;
    el.querySelectorAll("[data-dxeye]").forEach((s) => s.addEventListener("change", () => { st.diagnoses[Number(s.dataset.dxeye)].laterality = s.value; }));
    el.querySelectorAll("[data-dxstage]").forEach((s) => s.addEventListener("input", () => { st.diagnoses[Number(s.dataset.dxstage)].stage = s.value; }));
    el.querySelectorAll("[data-dxrm]").forEach((s) => s.addEventListener("click", () => { st.diagnoses.splice(Number(s.dataset.dxrm), 1); renderDxList(); }));
  }

  function renderMedList() {
    const content = document.getElementById("page-content");
    const el = content.querySelector("#med-list");
    if (!el) return;
    el.innerHTML = st.medications.map((m, i) => `
      <div class="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-1.5 text-sm">
        <span class="text-slate-700">${ui.esc(m.drug)} ${ui.esc(m.strength)} <span class="text-xs text-slate-400">${ui.esc(m.frequency)} · ${m.eye}</span></span>
        <button data-medrm="${i}" class="text-red-400 hover:text-red-600">✕</button>
      </div>`).join("");
    el.querySelectorAll("[data-medrm]").forEach((s) => s.addEventListener("click", () => { st.medications.splice(Number(s.dataset.medrm), 1); renderMedList(); }));
  }

  function renderIcdSearch() {
    // no-op for now; handled in bind
  }

  async function save() {
    // collect form meta
    const q = (id) => document.getElementById(id);
    const eyes = {};
    for (const lat of ["OD", "OS"]) {
      const e = st.eyes[lat];
      const cleaned = {};
      Object.entries(e).forEach(([k, v]) => {
        if (v !== "" && v != null) {
          if (["sph", "cyl", "axis", "add", "pd", "iop", "cct", "cst_um", "rnfl_um"].includes(k)) {
            const n = parseFloat(v);
            if (!isNaN(n)) cleaned[k] = n;
          } else cleaned[k] = v;
        }
      });
      eyes[lat] = cleaned;
    }
    const body = {
      patient_id: Number(pid),
      encounter_date: q("e-date").value,
      encounter_type: q("e-type").value || "follow_up",
      specialty: q("e-spec").value || null,
      reason: q("e-reason").value,
      plan: q("e-plan").value,
      follow_up_days: q("e-fu-days").value ? Number(q("e-fu-days").value) : null,
      follow_up_type: q("e-fu-type").value,
      follow_up_instructions: q("e-fu-inst").value,
      eyes,
      diagnoses: st.diagnoses,
      medications: st.medications,
    };
    try {
      const res = await api.post("/encounters", body);
      ui.toast(t("save"));
      sessionStorage.removeItem("chart_" + pid);
      location.hash = `#/patients/${pid}`;
    } catch (e) {
      ui.toast(ui.esc(e.message), "error");
    }
  }

  render();
});

/* ---- Read-only encounter viewer: /patients/:id/encounters/:eid ---- */
app.register("/patients/:id/encounters/:eid", async (ctx) => {
  const { content, params } = ctx;
  const t = i18n.t.bind(i18n);
  const pid = params.id, eid = params.eid;
  let enc = null, patient = null;
  try {
    const r = await api.get(`/encounters/${eid}`);
    enc = r.encounter;
  } catch (e) { ui.toast(ui.esc(e.message), "error"); }
  try {
    const r = await api.get(`/patients/${pid}`);
    patient = r.patient;
  } catch (_) {}

  function val(x) { return x === "" || x == null ? "—" : ui.esc(String(x)); }

  content.innerHTML = `
    <div class="page max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <button data-act="back" class="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">←</button>
          <div>
            <h1 class="text-lg font-bold text-slate-800">${patient ? `${ui.esc(patient.full_name_en || patient.full_name_ar)}` : "Encounter"}</h1>
            <p class="text-xs text-slate-400">${ui.esc(patient ? patient.mrn : "")} · ${enc && enc.encounter_date ? new Date(enc.encounter_date + "T00:00:00").toLocaleDateString() : ""}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button data-act="rx" class="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-semibold rounded-lg shadow-sm">🧾 ${t("prescription")}</button>
          <button data-act="rx-glasses" class="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-semibold rounded-lg shadow-sm">👓 ${t("glassesRx")}</button>
          <button data-act="pdf-visit" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold rounded-lg shadow-sm">📄 PDF</button>
          <a href="#/patients/${pid}/new-encounter" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow">＋ ${t("newEncounter")}</a>
          ${["ophthalmologist", "resident", "admin"].includes(ctx.user.role) ? `<button data-act="del-enc" class="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg shadow-sm">🗑 ${t("deleteVisit")}</button>` : ""}
        </div>
      </div>

      ${!enc ? `<div class="bg-white border border-red-200 text-red-500 rounded-xl p-6 text-center text-sm">Encounter not found.</div>` : `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span class="text-slate-500">${t("encounterType")}: <b>${val(enc.encounter_type)}</b></span>
          <span class="text-slate-500">${t("specialty")}: <b>${val(enc.specialty)}</b></span>
          <span class="text-slate-500">${t("reason")}: <b>${val(enc.reason)}</b></span>
        </div>

        ${["OD", "OS"].map((lat) => {
          const e = (enc.eyes || []).find((x) => x.laterality === lat);
          if (!e) return "";
          const f = (label, key) => (e[key] === "" || e[key] == null) ? "" : `<div class="flex justify-between border-b border-slate-50 py-0.5"><span class="text-slate-400 text-xs">${label}</span><span class="font-medium text-sm">${val(e[key])}</span></div>`;
          return `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
            <h3 class="text-sm font-bold text-slate-700 mb-2">${lat === "OD" ? "👁 " + t("od") + " (Right eye)" : "👁 " + t("os") + " (Left eye)"}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
              ${["ucva_dist", "ucva_near", "bcva_dist", "bcva_near", "pinhole"].map((k) => f(t(k), k)).join("")}
              ${["sph", "cyl", "axis", "add", "pd"].map((k) => f(t(k), k)).join("")}
              ${f(t("iop"), "iop")} ${f("Method", "iop_method")} ${f("CCT µm", "cct")}
              ${f(t("lens"), "lens_status")} ${f("Cataract", "cataract_type")} ${f("Grade", "cataract_grade")}
              ${f("Cornea", "cornea")} ${f("AC depth", "ac_depth")} ${f("AC cells", "ac_cells")}
              ${f("AC flare", "ac_flare")} ${f("Iris", "iris")} ${f("RAPD", "rapd")}
              ${f("Vitreous", "vitreous")} ${f("Macula", "macula")} ${f("CST µm", "cst_um")}
              ${f("SRF", "srf")} ${f("IRF", "irf")} ${f(t("cdr"), "cdr")}
              ${f("Rim", "rim")} ${f("RNFL µm", "rnfl_um")} ${f("Retina", "retina")}
              ${f("Hemorrhage", "hemorrhage")} ${f("Exudates", "exudates")} ${f("NV", "neovascularization")}
              ${f("Laser scars", "laser_scars")}
            </div>
            ${(e.anterior_notes || e.posterior_notes) ? `<div class="mt-2 text-xs text-slate-400 border-t border-slate-100 pt-2">${val(e.anterior_notes)} ${val(e.posterior_notes)}</div>` : ""}
          </div>`;
        }).join("")}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 class="text-sm font-bold text-slate-700 mb-2">🩺 ${t("diagnoses")}</h3>
            ${(enc.diagnoses || []).map((d) => `<div class="flex justify-between items-center py-1 border-b border-slate-50"><span><span class="font-mono font-semibold text-indigo-600">${val(d.icd10)}</span> <span class="text-slate-600 text-sm">${val(d.description)}</span></span><span class="text-xs text-slate-400">${val(d.laterality)} ${val(d.stage)}</span></div>`).join("") || '<div class="text-xs text-slate-400">No diagnoses</div>'}
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 class="text-sm font-bold text-slate-700 mb-2">💊 ${t("medications") || "Medications"}</h3>
            ${(enc.medications || []).map((m) => `<div class="flex justify-between py-1 border-b border-slate-50 text-sm"><span>${val(m.drug)} ${val(m.strength)}</span><span class="text-slate-400 text-xs">${val(m.frequency)} · ${val(m.eye)}</span></div>`).join("") || '<div class="text-xs text-slate-400">No medications</div>'}
          </div>
        </div>

        ${(enc.injections || []).length ? `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 class="text-sm font-bold text-slate-700 mb-2">💉 ${t("injections")}</h3>
          ${(enc.injections || []).map((i) => `<div class="flex justify-between items-center py-1 border-b border-slate-50 text-sm"><span class="font-medium">${val(i.drug)}</span><span class="text-slate-400 text-xs">${val(i.laterality)} ${val((i.procedure_date||"").slice(0,10))}</span></div>`).join("")}
        </div>` : ""}

        ${(enc.lasers || []).length ? `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 class="text-sm font-bold text-slate-700 mb-2">🔴 ${t("lasers") || "Lasers"}</h3>
          ${(enc.lasers || []).map((l) => `<div class="flex justify-between items-center py-1 border-b border-slate-50 text-sm"><span class="font-medium">${val(l.laser_type)}</span><span class="text-slate-400 text-xs">${val(l.laterality)} ${val((l.procedure_date||"").slice(0,10))}</span></div>`).join("")}
        </div>` : ""}

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <h3 class="text-sm font-bold text-slate-700 mb-2">📋 ${t("plan")}</h3>
          <div class="text-sm text-slate-700 whitespace-pre-wrap">${val(enc.plan)}</div>
          ${enc.follow_up_days ? `<div class="mt-3 text-xs text-slate-400">↪ ${t("followUp")} in <b>${enc.follow_up_days}</b> days</div>` : ""}
        </div>
      `}
    </div>`;

  const back = content.querySelector("[data-act='back']");
  if (back) back.addEventListener("click", () => { location.hash = `#/patients/${pid}`; });

  const DOCTOR = "Ihab Haj Hassan";

  function rxHtml() {
    const meds = enc.medications || [];
    const date = (enc.encounter_date ? new Date(enc.encounter_date + "T00:00:00") : new Date()).toLocaleDateString();
    const rows = meds.map((m, i) => `
      <tr>
        <td class="p-1.5 align-top font-semibold">${i + 1}. ${ui.esc(m.drug)}${m.strength ? " " + ui.esc(m.strength) : ""}</td>
        <td class="p-1.5 align-top text-right whitespace-nowrap">${ui.esc(m.eye || "")}${m.frequency ? " · " + ui.esc(m.frequency) : ""}${m.route ? " (" + ui.esc(m.route) + ")" : ""}${m.duration_days ? " · " + m.duration_days + " d" : ""}</td>
      </tr>`).join("") || `<tr><td class="p-1.5 text-slate-400">${ui.esc(t("prescription"))} — ${t("noMedsRx") || "no medications on this visit."}</td></tr>`;
    return `
      <div class="print-rx" style="font-family:Georgia,serif">
        <div class="flex justify-between items-start border-b-2 border-slate-800 pb-3">
          <img src="/static/img/logo.jpg" alt="logo" style="height:220px;object-fit:contain">
          <div class="text-right text-xs text-slate-500">${date}</div>
        </div>
        <div class="text-sm my-4 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
          <div><b>${t("patient")}:</b> ${ui.esc(patient ? patient.full_name_en : "")}${patient && patient.full_name_ar ? " (" + ui.esc(patient.full_name_ar) + ")" : ""}</div>
          <div class="text-right"><b>MRN:</b> ${ui.esc(patient ? patient.mrn : "")}</div>
          <div><b>DOB / ${t("age")}:</b> ${ui.esc(patient ? patient.dob : "")}${patient && patient.age != null ? " (" + patient.age + " yrs)" : ""}</div>
          <div class="text-right"><b>${t("prescriber")}:</b> ${ui.esc(DOCTOR)}</div>
        </div>
        <div class="text-5xl text-center my-6" style="font-family:serif">℞</div>
        <table class="w-full text-sm text-slate-800">${rows}</table>
        <div class="mt-10 pt-2 border-t border-slate-300 text-right">
          <img src="/static/img/signature.png" alt="signature" class="block" style="height:42px;max-width:150px;object-fit:contain;margin:0 0 2px auto;">
          <div class="text-sm font-semibold text-slate-800">${ui.esc(DOCTOR)}</div>
          <div class="text-[11px] text-slate-400">${t("prescriber")}</div>
        </div>
      </div>`;
  }

  function glassesHtml() {
    const date = (enc.encounter_date ? new Date(enc.encounter_date + "T00:00:00") : new Date()).toLocaleDateString();
    const fmt = (v) => (v === "" || v == null ? "—" : String(v));
    const laterals = ["OD", "OS"];
    const hasAny = laterals.some((lat) => {
      const e = (enc.eyes || []).find((x) => x.laterality === lat);
      return e && (e.sph != null || e.cyl != null || e.axis != null || e.add != null || e.pd != null || e.prism);
    });
    const rows = laterals.map((lat) => {
      const e = (enc.eyes || []).find((x) => x.laterality === lat) || {};
      return `<tr class="border-b border-slate-200">
        <td class="p-2 font-bold text-slate-800">${lat === "OD" ? t("od") : t("os")}</td>
        <td class="p-2 text-center">${fmt(e.sph)}</td>
        <td class="p-2 text-center">${fmt(e.cyl)}</td>
        <td class="p-2 text-center">${fmt(e.axis)}</td>
        <td class="p-2 text-center">${fmt(e.add)}</td>
        <td class="p-2 text-center">${fmt(e.pd)}</td>
        <td class="p-2 text-center">${fmt(e.prism)}</td>
      </tr>`;
    }).join("");
    return `
      <div class="print-rx-glasses" style="font-family:Georgia,serif">
        <div class="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
          <img src="/static/img/logo.jpg" alt="logo" style="height:240px;object-fit:contain">
          <div class="text-center flex-1">
            <div class="text-xs font-semibold text-indigo-700 mt-1">${ui.esc(t("glassesRx"))}</div>
          </div>
          <div class="text-right text-xs text-slate-500">${date}</div>
        </div>
        <div class="text-xs grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700 mb-3">
          <div><b>${t("patient")}:</b> ${ui.esc(patient ? patient.full_name_en : "")}${patient && patient.full_name_ar ? " (" + ui.esc(patient.full_name_ar) + ")" : ""}</div>
          <div class="text-right"><b>MRN:</b> ${ui.esc(patient ? patient.mrn : "")}</div>
          <div><b>DOB / ${t("age")}:</b> ${ui.esc(patient ? patient.dob : "")}${patient && patient.age != null ? " (" + patient.age + " yrs)" : ""}</div>
          <div class="text-right"><b>${t("prescriber")}:</b> ${ui.esc(DOCTOR)}</div>
        </div>
        ${hasAny ? `
        <table class="w-full text-xs border border-slate-300 border-collapse">
          <thead>
            <tr class="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <th class="p-2 border border-slate-300 text-left">${t("eye")}</th>
              <th class="p-2 border border-slate-300">${t("sph")}</th>
              <th class="p-2 border border-slate-300">${t("cyl")}</th>
              <th class="p-2 border border-slate-300">${t("axis")}</th>
              <th class="p-2 border border-slate-300">ADD</th>
              <th class="p-2 border border-slate-300">${t("pd")}</th>
              <th class="p-2 border border-slate-300">${t("prism")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="text-[11px] text-slate-400 mt-2">${t("refractionType")}: ${val((enc.eyes || []).find((x) => x.refraction_type)?.refraction_type || "—")}</div>
        ` : `<div class="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">${t("noRefraction")}</div>`}
        <div class="mt-8 pt-3 border-t border-slate-300 text-right">
          <img src="/static/img/signature.png" alt="signature" class="block" style="height:38px;max-width:140px;object-fit:contain;margin:0 0 2px auto;">
          <div class="text-sm font-semibold text-slate-800">Dr. ${ui.esc(DOCTOR)}</div>
          <div class="text-[11px] text-slate-400">EYE SURGEON</div>
        </div>
      </div>`;
  }

  const rxBtn = content.querySelector("[data-act='rx']");
  if (rxBtn) {
    rxBtn.addEventListener("click", () => {
      if (!enc) return;
      ui.openModal(`
        <div class="print-rx">${rxHtml()}</div>
        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
          <span class="flex-1 text-[11px] text-slate-400 self-center">${t("printHint") || "Print this prescription sheet"}</span>
          <button data-act="print-rx" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">🖨 ${t("print")}</button>
        </div>`, { size: "lg" });
      const proot = document.getElementById("modal-root");
      const pbtn = proot.querySelector("[data-act='print-rx']");
      if (pbtn) pbtn.addEventListener("click", () => ui.printEl(rxHtml()));
    });
  }

  const rxGlassesBtn = content.querySelector("[data-act='rx-glasses']");
  if (rxGlassesBtn) {
    rxGlassesBtn.addEventListener("click", () => {
      if (!enc) return;
      ui.openModal(`
        <div class="print-rx-glasses">${glassesHtml()}</div>
        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
          <span class="flex-1 text-[11px] text-slate-400 self-center">A5 · ${t("printHint") || "Print this prescription sheet"}</span>
          <button data-act="print-glasses" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">🖨 ${t("print")} A5</button>
        </div>`, { size: "lg" });
      const proot = document.getElementById("modal-root");
      const pbtn = proot.querySelector("[data-act='print-glasses']");
      if (pbtn) pbtn.addEventListener("click", () => ui.printEl(glassesHtml(), { paper: "a5" }));
    });
  }

  const delBtn = content.querySelector("[data-act='del-enc']");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      ui.confirmDlg(`${t("deleteVisit")} #${eid}? ${t("deleteVisitHint") || "This permanently removes the visit and its findings, diagnoses and medications."}`, async () => {
        try {
          await api.del(`/encounters/${eid}`);
          ui.toast(t("save") + " ✓", "success");
          location.hash = `#/patients/${pid}`;
        } catch (err) { ui.toast(ui.esc(err.message || "error"), "error"); }
      }, { danger: true });
    });
  }

  const pdfBtn = content.querySelector("[data-act='pdf-visit']");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      if (!enc || !window.jspdf) return ui.toast("PDF library not loaded", "error");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      let y = 14;
      const add = (txt, opts = {}) => {
        const size = opts.size || 10;
        const bold = opts.bold;
        const color = opts.color || [30, 41, 59];
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(txt, 180);
        if (y + lines.length * (size * 0.45) > 282) { doc.addPage(); y = 14; }
        doc.text(lines, 15, y);
        y += lines.length * (size * 0.45) + (opts.gap || 3);
      };
      const dateStr = enc.encounter_date ? new Date(enc.encounter_date + "T00:00:00").toLocaleDateString() : new Date().toLocaleDateString();
      add("Dr. Ihab Haj Hassan — EYE SURGEON", { size: 13, bold: true, gap: 2 });
      add("Visit Report — " + dateStr, { size: 9, color: [100, 116, 139], gap: 4 });
      doc.setDrawColor(203, 213, 225); doc.line(15, y, 195, y); y += 5;
      add(`Patient: ${patient ? (patient.full_name_en || "") : ""} ${patient && patient.full_name_ar ? "(" + patient.full_name_ar + ")" : ""} — MRN ${patient ? patient.mrn : ""}`, { size: 9 });
      add(`DOB: ${patient ? patient.dob : ""} (${patient && patient.age != null ? patient.age + " yrs" : "—"})  Sex: ${patient ? patient.sex : ""}  City: ${patient ? patient.city : ""}`, { size: 9, gap: 4 });
      add(`Visit: ${enc.encounter_type || "—"} — ${enc.specialty || ""} — Reason: ${enc.reason || "—"}`, { size: 9, gap: 4 });
      const dxTxt = (enc.diagnoses || []).map((d) => `${d.icd10} ${d.description} (${d.laterality || ""})`).join("; ") || "—";
      add("Diagnoses: " + dxTxt, { size: 9, gap: 3 });
      ["OD", "OS"].forEach((lat) => {
        const e = (enc.eyes || []).find((x) => x.laterality === lat);
        if (!e) return;
        add(lat + " — VA " + (e.ucva_dist || "—") + " / BCVA " + (e.bcva_dist || "—") + "  SPH " + (e.sph ?? "—") + "  CYL " + (e.cyl ?? "—") + "  AXIS " + (e.axis ?? "—") + "  ADD " + (e.add ?? "—") + "  IOP " + (e.iop ?? "—") + " " + (e.iop_method || ""), { size: 8, gap: 2 });
        const ant = [e.cornea && "Cornea " + e.cornea, e.ac_cells && "AC " + e.ac_cells, e.lens_status && "Lens " + e.lens_status].filter(Boolean).join(" · ");
        if (ant) add(ant, { size: 8, gap: 2 });
        const post = [e.macula && "Macula " + e.macula, e.cdr && "C/D " + e.cdr, e.retina && "Retina " + e.retina].filter(Boolean).join(" · ");
        if (post) add(post, { size: 8, gap: 2 });
      });
      const medsTxt = (enc.medications || []).map((m) => `${m.drug}${m.strength ? " " + m.strength : ""} ${m.eye || ""} ${m.frequency || ""}`).join("; ") || "—";
      add("Medications: " + medsTxt, { size: 9, gap: 3 });
      add("Plan: " + (enc.plan || "—"), { size: 9, gap: 3 });
      if (enc.follow_up_days) add("Follow-up in " + enc.follow_up_days + " days", { size: 9, bold: true });
      y = Math.max(y, 268);
      doc.setFontSize(9); doc.setTextColor(30, 41, 59);
      doc.text("Dr. Ihab Haj Hassan", 195, y, { align: "right" });
      doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text("EYE SURGEON", 195, y + 5, { align: "right" });
      try { doc.addImage("/static/img/signature.png", "PNG", 155, y - 12, 30, 10); } catch (_) {}
      doc.save(`Visit_${patient ? patient.mrn : pid}_${enc.encounter_date || dateStr}.pdf`);
    });
  }
});
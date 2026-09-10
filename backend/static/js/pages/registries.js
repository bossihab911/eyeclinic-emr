/* pages/registries.js — disease registries (DR / Glaucoma / AMD) */
"use strict";
const RegistryPage = { state: { kind: "dr" } };

app.register("/registries", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");
  const KINDS = [
    ["dr", "🩸 " + (i18n.lang === "ar" ? "سكري" : "Diabetic Retinopathy")],
    ["glaucoma", "💧 " + (i18n.lang === "ar" ? "غلوكوما" : "Glaucoma")],
    ["amd", "👁 " + (i18n.lang === "ar" ? "تليف البقعة" : "AMD")],
  ];

  function render() {
    const kind = RegistryPage.state.kind;
    content.innerHTML = `
      <div class="page">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-bold text-slate-800">🗂 ${t("registries") || "Registries"}</h1>
        </div>
        <div class="flex gap-2 mb-4">
          ${KINDS.map(([k, label]) => `<button data-kind="${k}" class="px-4 py-2 rounded-lg text-sm font-semibold ${kind === k ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">${label}</button>`).join("")}
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400">
              <tr><th class="px-3 py-2.5">Patient</th><th class="px-3 py-2.5">MRN</th><th class="px-3 py-2.5">ICD-10</th><th class="px-3 py-2.5">Diagnosis</th><th class="px-3 py-2.5">Eye</th><th class="px-3 py-2.5">Last visit</th>${kind === "amd" ? `<th class="px-3 py-2.5 text-center">Injections</th>` : kind === "glaucoma" ? `<th class="px-3 py-2.5 text-center">Last IOP</th>` : `<th class="px-3 py-2.5">Stage</th>`}<th class="px-3 py-2.5">Next due</th></tr>
            </thead>
            <tbody id="reg-rows"><tr><td colspan="8" class="px-3 py-8 text-center text-slate-400 text-sm">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>`;
    content.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
      RegistryPage.state.kind = b.dataset.kind;
      render();
      load();
    }));
    load();
  }

  async function load() {
    const kind = RegistryPage.state.kind;
    const tbody = document.getElementById("reg-rows");
    try {
      const r = await api.get(`/reports/registry/${kind}`);
      const rows = r.rows || [];
      tbody.innerHTML = rows.length ? rows.map((d) => `
        <tr class="hover:bg-slate-50">
          <td class="px-3 py-2"><a class="font-medium text-indigo-600 hover:underline" href="#/patients/${d.patient_id}">${ui.esc(d.name_given_en + " " + (d.name_family_en || ""))}</a><div class="text-[11px] text-slate-400">${ui.esc(d.phone || d.city || "")}</div></td>
          <td class="px-3 py-2 text-slate-500 text-xs">${ui.esc(d.mrn || "")}</td>
          <td class="px-3 py-2 font-mono text-indigo-600 text-xs">${ui.esc(d.icd10 || "")}</td>
          <td class="px-3 py-2 text-slate-600">${ui.esc(d.description || "")}</td>
          <td class="px-3 py-2 text-center font-semibold">${ui.esc(d.laterality || "")}</td>
          <td class="px-3 py-2 whitespace-nowrap">${ui.esc((d.last_visit || "").slice(0, 10))}</td>
          ${kind === "amd" ? `<td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">${d.total_injections || 0}</span></td>`
          : kind === "glaucoma" ? `<td class="px-3 py-2 text-center font-semibold">${d.last_iop != null ? d.last_iop : "—"}</td>`
          : `<td class="px-3 py-2 text-xs text-slate-500">${ui.esc(d.stage || "")}</td>`}
          <td class="px-3 py-2 text-xs ${(d.next_due || "").slice(0, 10) < new Date().toISOString().slice(0, 10) ? "text-red-500 font-semibold" : "text-slate-500"}">${ui.esc((d.next_due || "").slice(0, 10) || "—")}</td>
        </tr>`).join("") : `<tr><td colspan="8" class="px-3 py-8 text-center text-slate-400 text-sm">No patients in this registry</td></tr>`;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-3 py-8 text-center text-red-500 text-sm">${ui.esc(e.message)}</td></tr>`;
    }
  }

  render();
});
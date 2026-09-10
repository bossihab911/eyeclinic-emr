/* pages/injections.js — injection log + record injection + per-patient series */
"use strict";
const InjectionPage = { state: { q: "" } };

app.register("/injections", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");
  let all = [];

  function renderList() {
    const q = InjectionPage.state.q.toLowerCase();
    const rows = all.filter((x) => !q ||
      (x.name_given_en + " " + x.name_family_en).toLowerCase().includes(q) ||
      (x.mrn || "").includes(q) || ((x.drug || "").toLowerCase().includes(q)));
    content.querySelector("#inj-rows").innerHTML = rows.length ? rows.map((i) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2"><a class="font-medium text-indigo-600 hover:underline" href="#/patients/${i.patient_id}">${ui.esc(i.name_given_en + " " + (i.name_family_en || ""))}</a><div class="text-[11px] text-slate-400">${ui.esc(i.mrn || "")}</div></td>
        <td class="px-3 py-2 text-center font-semibold text-slate-700">${ui.esc(i.laterality)}</td>
        <td class="px-3 py-2">${ui.esc(i.drug)}</td>
        <td class="px-3 py-2 text-slate-500">${ui.esc(i.indication || "")}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${ui.esc((i.dose_mg || "") + (i.volume_ml ? " / " + i.volume_ml + " ml" : ""))}</td>
        <td class="px-3 py-2 whitespace-nowrap text-sm">${ui.esc((i.procedure_date || "").slice(0, 10))}</td>
        <td class="px-3 py-2 text-xs text-slate-400">${ui.esc(i.dr_name || "")}</td>
        <td class="px-3 py-2 text-right"><button data-series="${i.patient_id}" class="text-indigo-600 text-xs font-medium hover:underline">Series</button></td>
      </tr>`).join("") : `<tr><td colspan="8" class="px-3 py-8 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;
    content.querySelectorAll("[data-series]").forEach((b) => b.addEventListener("click", (ev) => {
      showSeries(Number(ev.currentTarget.dataset.series), rows.find((r) => r.patient_id == ev.currentTarget.dataset.series));
    }));
  }

  function showSeries(pid, info) {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-1">${ui.esc((info.name_given_en || "") + " " + (info.name_family_en || ""))}</h3>
      <p class="text-xs text-slate-400 mb-4">${ui.esc(info.mrn || "")} · Injection series</p>
      <div id="series-body" class="text-sm text-center py-4 text-slate-400">Loading…</div>`, "max-w-2xl");
    (async () => {
      try {
        const r = await api.get(`/injections/series/${pid}`);
        dlg.querySelector("#series-body").innerHTML =
          `<table class="w-full text-left">
            <thead><tr class="text-[11px] uppercase text-slate-400 border-b"><th class="pb-2">#</th><th class="pb-2">${t("date")}</th><th class="pb-2">${t("eye")}</th><th class="pb-2">${t("drug")}</th><th class="pb-2">${t("indication")}</th><th class="pb-2">${t("response")}</th><th class="pb-2 text-right">${t("nextDueShort")}</th></tr></thead>
            <tbody>${(r.injections || []).map((i, idx) => `
              <tr class="border-b border-slate-50 text-sm">
                <td class="py-2 text-slate-400">${idx + 1}</td>
                <td class="py-2 whitespace-nowrap">${ui.esc((i.procedure_date || "").slice(0, 10))}</td>
                <td class="py-2 font-semibold">${ui.esc(i.laterality)}</td>
                <td class="py-2">${ui.esc(i.drug)}</td>
                <td class="py-2 text-slate-500">${ui.esc(i.indication || "")}</td>
                <td class="py-2 text-slate-500">${ui.esc(i.response || "")}</td>
                <td class="py-2 text-right text-xs text-slate-400">${ui.esc((i.next_due_date || "").slice(0, 10))}</td>
              </tr>`).join("") || `<tr><td class="py-4 text-center text-slate-400">No injections</td></tr>`}
            </tbody></table>`;
      } catch (e) { dlg.querySelector("#series-body").innerHTML = `<div class="text-red-500 py-4">${ui.esc(e.message)}</div>`; }
    })();
  }

  function openRecordModal() {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-4">💉 ${t("recordInjection")}</h3>
      <div id="rec-body" class="space-y-3">
        ${ui.field({ id: "r-patient", label: "Patient MRN or name", type: "text", placeholder: "Search…" })}
        <div id="r-pat-pick" class="max-h-40 overflow-y-auto space-y-1"></div>
        <div class="grid grid-cols-2 gap-3">
          ${ui.field({ id: "r-drug", label: "Drug", type: "select", options: [["Ranibizumab","Ranibizumab"],["Aflibercept","Aflibercept"],["Bevacizumab","Bevacizumab"],["Dexamethasone implant","Dexamethasone implant"],["Triamcinolone","Triamcinolone"],["Others","Others"]] })}
          ${ui.field({ id: "r-eye", label: t("eye"), type: "select", options: [["OD","OD"],["OS","OS"]] })}
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${ui.field({ id: "r-date", label: t("date"), type: "date", value: new Date().toISOString().slice(0, 10) })}
          ${ui.field({ id: "r-dose", label: "Dose mg", type: "number" })}
        </div>
        ${ui.field({ id: "r-ind", label: t("indication"), type: "select", options: [["wAMD","wAMD"],["DME","Diabetic macular edema"],["RVO-ME","RVO macular edema"],["PDR","PDR"],["CSCR","CSCR"],["Others","Others"]] })}
        <div class="grid grid-cols-2 gap-3">
          ${ui.field({ id: "r-iop", label: "Pre IOP", type: "number" })}
          ${ui.field({ id: "r-va", label: "Pre VA", type: "text", placeholder: "20/60" })}
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${ui.field({ id: "r-series", label: "Series #", type: "number", value: "1" })}
          ${ui.field({ id: "r-next", label: "Next due (days)", type: "number", placeholder: "28" })}
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-save class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("save")}</button>
      </div>`, "max-w-lg");
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.remove());

    const patInput = dlg.querySelector("#r-patient");
    const pick = dlg.querySelector("#r-pat-pick");
    let selPatient = null;
    let timer;
    patInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = patInput.value.trim();
        if (q.length < 2) { pick.innerHTML = ""; return; }
        try {
          const r = await api.get(`/patients?q=${encodeURIComponent(q)}&per=6`);
          pick.innerHTML = (r.patients || []).map((p) => `
            <button data-pick="${p.id}" class="w-full text-left px-3 py-2 rounded-lg border border-slate-100 hover:bg-indigo-50 text-sm">
              ${ui.esc(p.full_name_en || p.full_name_ar)} <span class="text-slate-400 text-xs">${ui.esc(p.mrn)}</span>
            </button>`).join("");
          pick.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
            const p = (r.patients || []).find((x) => x.id == b.dataset.pick);
            selPatient = p;
            patInput.value = `${p.full_name_en || p.full_name_ar} · ${p.mrn}`;
            patInput.dataset.pid = p.id;
            pick.innerHTML = "";
          }));
        } catch (_) {}
      }, 300);
    });

    dlg.querySelector("[data-save]").addEventListener("click", async () => {
      const pid = patInput.dataset.pid;
      if (!pid) return ui.toast("Select a patient", "warning");
      const g = (id) => dlg.querySelector(id).value;
      const nextDays = Number(g("#r-next"));
      try {
        const body = {
          patient_id: Number(pid),
          drug: g("#r-drug"),
          laterality: g("#r-eye"),
          procedure_date: g("#r-date"),
          dose_mg: g("#r-dose") ? Number(g("#r-dose")) : null,
          volume_ml: g("#r-dose") ? Number(g("#r-dose")) : null,
          indication: g("#r-ind"),
          pre_iop: g("#r-iop") ? Number(g("#r-iop")) : null,
          pre_va: g("#r-va"),
          series_number: g("#r-series") ? Number(g("#r-series")) : null,
          next_interval_days: nextDays || null,
          next_due_date: nextDays ? new Date(new Date(g("#r-date")).getTime() + nextDays * 86400000).toISOString().slice(0, 10) : null,
        };
        await api.post("/injections", body);
        ui.toast(t("save"));
        dlg.remove();
        load();
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
  }

  async function load() {
    content.innerHTML = `
      <div class="page">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-bold text-slate-800">💉 ${t("injectionLog")}</h1>
          <button data-new class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow">＋ ${t("recordInjection")}</button>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-4">
          <input id="inj-q" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="🔍 ${ui.esc(t("searchPlaceholder") || "Search patients or drugs…")}">
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400">
              <tr><th class="px-3 py-2.5">${t("patient")}</th><th class="px-3 py-2.5 text-center">${t("eye")}</th><th class="px-3 py-2.5">${t("drug")}</th><th class="px-3 py-2.5">${t("indication")}</th><th class="px-3 py-2.5">${t("dose")}</th><th class="px-3 py-2.5">${t("date")}</th><th class="px-3 py-2.5">${t("doctor")}</th><th class="px-3 py-2.5 text-right"></th></tr>
            </thead>
            <tbody id="inj-rows"></tbody>
          </table>
        </div>
      </div>`;
    content.querySelector("[data-new]").addEventListener("click", openRecordModal);
    const q = content.querySelector("#inj-q");
    q.addEventListener("input", () => { InjectionPage.state.q = q.value; renderList(); });
    all = (await api.get("/injections")).injections || [];
    renderList();
  }

  await load();
});
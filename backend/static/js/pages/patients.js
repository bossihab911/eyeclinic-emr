/* pages/patients.js */
"use strict";
app.register("/patients", async (ctx) => {
  const { content } = ctx;
  const t = i18n.t.bind(i18n);

  async function load(query, page) {
    const q = encodeURIComponent(query || "");
    const data = await api.get(`/patients?q=${q}&page=${page || 1}&per=25`);
    render(data, query || "", page || 1);
  }

  function getPending() { try { return JSON.parse(localStorage.getItem("pending_patients") || "[]"); } catch { return []; } }
  function updatePendingBadge() {
    const q = getPending();
    const el = document.getElementById("pending-badge");
    const btn = document.getElementById("sync-pending");
    if (el) el.textContent = q.length ? q.length + " pending" : "";
    if (btn) btn.classList.toggle("hidden", q.length === 0);
  }
  async function trySyncPending() {
    const q = getPending();
    if (!q.length) return 0;
    let ok = 0;
    const cur = [...q];
    for (const item of cur) {
      try {
        await api.post("/patients", item.body);
        q.shift(); ok++;
        localStorage.setItem("pending_patients", JSON.stringify(q));
      } catch (e) { if (e.code !== "network" && !String(e.message).includes("Network")) { q.shift(); localStorage.setItem("pending_patients", JSON.stringify(q)); } else break; }
    }
    if (ok) { ui.toast(ok + " offline patient(s) synced ✓", "success"); updatePendingBadge(); load(localStorage.getItem("global_query") || "", 1); }
    return ok;
  }

  function render(data, query, page) {
    const rows = (data.patients || []).map((p) => {
      const nameAr = p.preferred_language === "ar" && p.full_name_ar;
      return `
      <tr class="border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer" data-patient="${p.id}">
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            ${ui.avatar(p.full_name_en || p.full_name_ar)}
            <div>
              <div class="text-sm font-semibold text-slate-800">${ui.esc(p.full_name_en || p.full_name_ar)}</div>
              ${nameAr ? `<div class="text-xs text-slate-400" dir="rtl">${ui.esc(nameAr)}</div>` : ""}
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-sm text-slate-500 font-mono">${ui.esc(p.mrn)}</td>
        <td class="py-3 px-3 text-sm text-slate-600">${p.age != null ? p.age + " yrs" : "—"} <span class="text-xs text-slate-400">·</span> ${p.sex === "F" ? "♀" : p.sex === "M" ? "♂" : "—"}</td>
        <td class="py-3 px-3 text-sm text-slate-600" dir="ltr">${ui.esc(p.phone || "—")}</td>
        <td class="py-3 px-3 text-sm text-slate-600">${ui.esc(p.city || "—")}</td>
        <td class="py-3 px-3"><span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">${ui.esc(p.insurance_provider || "Self-pay")}</span></td>
        <td class="py-3 px-3 text-right whitespace-nowrap">
          ${["ophthalmologist","receptionist","admin"].includes(ctx.user.role) ? `<button data-edit="${p.id}" class="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-medium">✏️ ${t("edit")}</button>` : ""}
          ${ctx.user.role === "admin" ? `<button data-del="${p.id}" title="Delete patient" class="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm">🗑</button>` : ""}
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="7" class="py-12 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;

    const pages = Math.max(1, Math.ceil((data.total || 0) / data.per));
    const pageBtns = Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1)
      .map((n) => `<button data-page="${n}" class="w-8 h-8 rounded-lg text-sm ${n === page ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}">${n}</button>`).join("");

    const canCreate = ["ophthalmologist", "receptionist", "admin"].includes(ctx.user.role);
    content.innerHTML = `
      <div class="page">
        <div class="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 class="text-xl font-bold text-slate-800">${t("patients")}</h1>
            <p class="text-sm text-slate-500">${(data.total || 0)} ${t("totalPatients")}</p>
          </div>
          <div class="flex items-center gap-2">
            <span id="pending-badge" class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full"></span>
            <button id="sync-pending" class="hidden text-xs px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg">↻ Sync</button>
            ${canCreate ? `<button data-act="new-patient" class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm">＋ ${t("newPatient")}</button>` : ""}
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <div class="p-3 border-b border-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
            <input id="p-search" value="${ui.esc(query)}" placeholder="${ui.esc(t("patientSearch"))}" class="flex-1 text-sm bg-transparent focus:outline-none">
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead><tr class="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                <th class="px-3 py-2">${t("patient")}</th><th class="px-3 py-2">${t("mrn")}</th><th class="px-3 py-2">${t("dob")}</th><th class="px-3 py-2">${t("phone")}</th><th class="px-3 py-2">${t("city")}</th><th class="px-3 py-2">${t("insurance")}</th><th></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-xs text-slate-400">${ui.esc(t("totalPatients"))}: ${data.total || 0}</span>
            <div class="flex gap-1">${pageBtns}</div>
          </div>
        </div>
      </div>`;

    updatePendingBadge();
    const syncBtn = content.querySelector("#sync-pending");
    if (syncBtn) syncBtn.onclick = () => trySyncPending();
    if (getPending().length) trySyncPending();

    const inp = content.querySelector("#p-search");
    let timer;
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => load(inp.value.trim(), 1), 300);
    });
    content.querySelectorAll("[data-page]").forEach((b) => {
      b.onclick = () => load(inp.value.trim(), Number(b.dataset.page));
    });
    content.querySelectorAll("[data-patient]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]") || e.target.closest("[data-edit]")) return;
        location.hash = `#/patients/${row.dataset.patient}`;
      });
    });
    content.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.edit;
        const p = (data.patients || []).find((x) => String(x.id) === String(id));
        if (p) editPatientModal(p);
        else api.get(`/patients/${id}`).then((r) => editPatientModal(r.patient)).catch(() => ui.toast("Failed to load patient", "error"));
      });
    });
    content.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.del;
        ui.confirmDlg(`${t("delete")} patient #${id}? ${t("deleteHint") || "This permanently removes the patient record and all related data."}`, async () => {
          try {
            await api.del(`/patients/${id}`);
            ui.toast(t("save") + " ✓", "success");
            load(inp.value.trim(), 1);
          } catch (err) { ui.toast(ui.esc(err.message || "error"), "error"); }
        }, { danger: true });
      });
    });
    function editPatientModal(p) {
      const dlg = ui.openModal(`
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"><span class="text-slate-400 text-xs">${t("mrn")}</span> <span class="font-mono font-semibold ml-2">${ui.esc(p.mrn)}</span></div>
          ${ui.field({ id: "ep-given-en", label: "Given name (EN)", value: p.name_given_en || "" })}
          ${ui.field({ id: "ep-family-en", label: "Family name (EN)", value: p.name_family_en || "" })}
          ${ui.field({ id: "ep-given-ar", label: "الاسم (عربي)", value: p.name_given_ar || "" })}
          ${ui.field({ id: "ep-family-ar", label: "اللقب (عربي)", value: p.name_family_ar || "" })}
          ${ui.field({ id: "ep-dob", label: t("dob"), type: "date", value: p.dob || "" })}
          ${ui.field({ id: "ep-sex", label: t("sex"), type: "select", options: [["", ""], ["M","Male"], ["F","Female"]], value: p.sex || "" })}
          ${ui.field({ id: "ep-phone", label: t("phone"), value: p.phone || "" })}
          ${ui.field({ id: "ep-city", label: t("city"), value: p.city || "" })}
          ${ui.field({ id: "ep-ins", label: t("insurance"), type: "select", options: [["", ""], ["moh","MOH"], ["coop","COOP"], ["issf","ISSF"], ["army","Army"], ["private","Private"], ["beirut municipality","Beirut Municipality"], ["insurance","Insurance"], ["nssf","NSSF"]], value: p.insurance_provider || "" })}
          ${ui.field({ id: "ep-ref", label: t("referring"), value: p.referring_physician || "" })}
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
          <button data-save class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("save")}</button>
        </div>`, { size: "lg" });
      dlg.setTitle(t("edit") + " — " + (p.full_name_en || p.full_name_ar || p.mrn));
      dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
      dlg.querySelector("[data-save]").addEventListener("click", async () => {
        const g = (id) => dlg.querySelector(id).value.trim();
        const body = {
          name_given_en: g("#ep-given-en") || null,
          name_family_en: g("#ep-family-en") || null,
          name_given_ar: g("#ep-given-ar") || null,
          name_family_ar: g("#ep-family-ar") || null,
          dob: g("#ep-dob") || null,
          sex: g("#ep-sex") || null,
          phone: g("#ep-phone") || null,
          city: g("#ep-city") || null,
          insurance_provider: g("#ep-ins") || null,
          referring_physician: g("#ep-ref") || null,
        };
        try {
          await api.put(`/patients/${p.id}`, body);
          ui.toast(t("save") + " ✓", "success");
          dlg.close();
          load(inp.value.trim(), 1);
        } catch (e) { ui.toast(ui.esc(e.message), "error"); }
      });
    }
    const npb = content.querySelector("[data-act='new-patient']");
    if (npb) npb.onclick = () => newPatientModal();
    window.addEventListener("patient-search", () => {
      const q = localStorage.getItem("global_query") || "";
      load(q, 1);
    });
  }

  function newPatientModal() {
    ui.openModal(`
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        ${ui.field({ id: "np-mrn", label: t("mrn") + " *", required: true, placeholder: "OI00011" })}
        ${ui.field({ id: "np-given-en", label: "Given name (EN) *", required: true })}
        ${ui.field({ id: "np-family-en", label: "Family name (EN) *", required: true })}
        ${ui.field({ id: "np-given-ar", label: "الاسم (عربي)" })}
        ${ui.field({ id: "np-family-ar", label: "اللقب (عربي)" })}
        ${ui.field({ id: "np-dob", label: t("dob"), type: "date" })}
        ${ui.field({ id: "np-sex", label: t("sex"), type: "select", options: [["", ""], ["M", "Male"], ["F", "Female"]] })}
        ${ui.field({ id: "np-phone", label: t("phone") })}
        ${ui.field({ id: "np-city", label: t("city") })}
        ${ui.field({ id: "np-insurance", label: t("insurance"), type: "select", options: [["", ""], ["moh", "MOH"], ["coop", "COOP"], ["issf", "ISSF"], ["army", "Army"], ["private", "Private"], ["beirut municipality", "Beirut Municipality"], ["insurance", "Insurance"], ["nssf", "NSSF"]] })}
        ${ui.field({ id: "np-ins-policy", label: "Policy #" })}
        ${ui.field({ id: "np-ref", label: t("referring") })}
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close-modal class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-save class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("save")}</button>
      </div>`, { size: "lg" }).setTitle(t("newPatient"));

    document.querySelector("[data-close-modal]").onclick = () => document.getElementById("modal-root").innerHTML = "";
    document.querySelector("[data-save]").onclick = async () => {
      const body = {
        mrn: val("np-mrn"), name_given_en: val("np-given-en"), name_family_en: val("np-family-en"),
        name_given_ar: val("np-given-ar"), name_family_ar: val("np-family-ar"),
        dob: val("np-dob") || null, sex: val("np-sex") || null, phone: val("np-phone") || null,
        city: val("np-city") || null, insurance_provider: val("np-insurance") || null,
        insurance_policy: val("np-ins-policy") || null, referring_physician: val("np-ref") || null,
        preferred_language: i18n.lang,
      };
      if (!body.mrn || !body.name_given_en || !body.name_family_en) return ui.toast("MRN and names required", "warning");
      try {
        const res = await api.post("/patients", body);
        ui.toast(t("save"));
        document.getElementById("modal-root").innerHTML = "";
        // try sync any pending
        trySyncPending();
        location.hash = `#/patients/${res.id}`;
      } catch (e) {
        if (e.code === "network" || String(e.message).includes("Network")) {
          const q = JSON.parse(localStorage.getItem("pending_patients") || "[]");
          q.push({ body, ts: Date.now() });
          localStorage.setItem("pending_patients", JSON.stringify(q));
          ui.toast("Saved offline — will sync when laptop is on", "success");
          document.getElementById("modal-root").innerHTML = "";
          updatePendingBadge();
        } else {
          ui.toast(ui.esc(e.message), "error");
        }
      }
    };
    function val(id) { return document.getElementById(id).value.trim(); }
  }

  await load(localStorage.getItem("global_query") || "", 1);
});
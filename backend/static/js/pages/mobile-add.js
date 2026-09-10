/* pages/mobile-add.js — ultra-simple offline-first Add Patient for iPhone */
"use strict";
app.register("/add-patient", async (ctx) => {
  const { content } = ctx;
  const t = i18n.t.bind(i18n);
  const canCreate = ["ophthalmologist", "receptionist", "admin"].includes(ctx.user.role);

  function getPending() { try { return JSON.parse(localStorage.getItem("pending_patients") || "[]"); } catch { return []; } }
  function setPending(q) { localStorage.setItem("pending_patients", JSON.stringify(q)); }

  async function trySync() {
    const q = getPending();
    if (!q.length) return 0;
    let ok = 0;
    for (const item of [...q]) {
      try {
        await api.post("/patients", item.body);
        q.shift(); ok++;
        setPending(q);
      } catch (e) {
        if (e.code !== "network" && !String(e.message).includes("Network")) { q.shift(); setPending(q); }
        else break;
      }
    }
    return ok;
  }

  content.innerHTML = `
    <div class="page max-w-lg mx-auto">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h1 class="text-lg font-bold text-slate-800 mb-1">＋ ${t("newPatient")} — iPhone</h1>
        <p class="text-xs text-slate-400 mb-4">Works offline — saved locally and synced when laptop is on. <span id="pending-info" class="font-semibold text-amber-600"></span></p>
        <div class="grid grid-cols-1 gap-3">
          ${ui.field({ id: "m-mrn", label: t("mrn") + " *", required: true, placeholder: "OI00123" })}
          ${ui.field({ id: "m-given", label: "Given name (EN) *", required: true })}
          ${ui.field({ id: "m-family", label: "Family name (EN) *", required: true })}
          ${ui.field({ id: "m-given-ar", label: "الاسم (عربي)" })}
          ${ui.field({ id: "m-family-ar", label: "اللقب (عربي)" })}
          ${ui.field({ id: "m-dob", label: t("dob"), type: "date" })}
          ${ui.field({ id: "m-sex", label: t("sex"), type: "select", options: [["", ""], ["M", "Male"], ["F", "Female"]] })}
          ${ui.field({ id: "m-phone", label: t("phone"), placeholder: "03 123 456" })}
          ${ui.field({ id: "m-city", label: t("city"), placeholder: "Beirut" })}
          ${ui.field({ id: "m-ins", label: t("insurance"), type: "select", options: [["", ""], ["moh","MOH"], ["coop","COOP"], ["issf","ISSF"], ["army","Army"], ["private","Private"], ["beirut municipality","Beirut Municipality"], ["insurance","Insurance"], ["nssf","NSSF"]] })}
        </div>
        <button id="m-save" class="mt-5 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow text-base">💾 ${t("save")} — ${t("newPatient")}</button>
        <button id="m-sync" class="mt-3 w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl border border-amber-200 text-sm">↻ Sync pending (<span id="m-pending-count">0</span>)</button>
        <div id="m-status" class="mt-3 text-sm text-center"></div>
      </div>
      <div class="text-center mt-4">
        <a href="#/patients" class="text-sm text-indigo-600 hover:underline">→ ${t("patients")}</a>
      </div>
    </div>`;

  const upd = () => {
    const q = getPending();
    const el = content.querySelector("#m-pending-count");
    const info = content.querySelector("#pending-info");
    const btn = content.querySelector("#m-sync");
    if (el) el.textContent = q.length;
    if (info) info.textContent = q.length ? ` — ${q.length} pending` : "";
    if (btn) btn.classList.toggle("hidden", false);
  };
  upd();

  // auto-sync on load if online
  trySync().then((n) => { if (n) { upd(); const s = content.querySelector("#m-status"); if (s) s.innerHTML = `<span class="text-emerald-600">${n} offline patient(s) synced ✓</span>`; } });

  content.querySelector("#m-sync").addEventListener("click", async () => {
    const s = content.querySelector("#m-status");
    s.textContent = "Syncing…";
    const n = await trySync();
    upd();
    s.innerHTML = n ? `<span class="text-emerald-600">${n} synced ✓</span>` : `<span class="text-slate-400">No pending or still offline</span>`;
  });

  content.querySelector("#m-save").addEventListener("click", async () => {
    const v = (id) => document.getElementById(id).value.trim();
    const body = {
      mrn: v("m-mrn"), name_given_en: v("m-given"), name_family_en: v("m-family"),
      name_given_ar: v("m-given-ar"), name_family_ar: v("m-family-ar"),
      dob: v("m-dob") || null, sex: v("m-sex") || null, phone: v("m-phone") || null, city: v("m-city") || null,
      insurance_provider: v("m-ins") || null, preferred_language: i18n.lang,
    };
    const status = content.querySelector("#m-status");
    if (!body.mrn || !body.name_given_en || !body.name_family_en) {
      status.innerHTML = '<span class="text-red-500">MRN and names required</span>'; return;
    }
    if (!canCreate) { status.innerHTML = '<span class="text-red-500">Not allowed for this role</span>'; return; }
    status.textContent = "Saving…";
    try {
      const res = await api.post("/patients", body);
      status.innerHTML = '<span class="text-emerald-600">Saved ✓ — <a href="#/patients/' + res.id + '" class="underline">Open chart</a></span>';
      ui.toast(t("save") + " ✓", "success");
      ["m-mrn","m-given","m-family","m-given-ar","m-family-ar","m-dob","m-phone","m-city"].forEach((id)=>{ const el=document.getElementById(id); if(el) el.value=""; });
      upd();
    } catch (e) {
      if (e.code === "network" || String(e.message).includes("Network")) {
        const q = getPending(); q.push({ body, ts: Date.now() }); setPending(q);
        status.innerHTML = '<span class="text-amber-600">Saved offline — will sync when laptop is on (' + q.length + ' pending)</span>';
        ui.toast("Saved offline ✓", "success");
        upd();
      } else {
        status.innerHTML = '<span class="text-red-500">' + ui.esc(e.message) + '</span>';
        ui.toast(ui.esc(e.message), "error");
      }
    }
  });
});
app.register("/m", async (ctx) => { location.hash = "#/add-patient"; });

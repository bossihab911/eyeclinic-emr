/* pages/chart.js — patient chart with per-eye encounter tabs */
"use strict";
app.register("/patients/:id", async (ctx) => {
  const { content, params } = ctx;
  const t = i18n.t.bind(i18n);
  const ALLERGIES_KEY = `pt_allergies_${params.id}`;
  const CACHE_TTL = 5 * 60 * 1000;

  async function load(force) {
    let cached = null;
    try {
      cached = JSON.parse(sessionStorage.getItem("chart_" + params.id) || "null");
    } catch (_) { cached = null; }
    if (cached && !force && (Date.now() - (cached._ts || 0)) < CACHE_TTL) {
      render(cached);
      return;
    }
    const data = await api.get(`/patients/${params.id}/chart`);
    data._ts = Date.now();
    try { sessionStorage.setItem("chart_" + params.id, JSON.stringify(data)); } catch (_) {}
    render(data);
  }

  const encTypeLabel = {
    new: t("newPatientVisit"), follow_up: t("followUpVisit"), pre_op: t("preOpVisit"),
    post_op: t("postOpVisit"), emergency: t("emergencyVisit"), injection: "Injection",
  };

  function render(d) {
    const p = d.patient;
    const useAr = p.preferred_language === "ar";
    const displayName = useAr ? (p.full_name_ar || p.full_name_en) : (p.full_name_en || p.full_name_ar);
    const otherName = useAr ? p.full_name_en : p.full_name_ar;
    const isDoctor = ["ophthalmologist", "resident", "admin"].includes(ctx.user.role);

    // allergies banner
    const allergies = (p.allergies || []).filter((a) => a.active);
    const allergyBanner = allergies.length ? `
      <div class="bg-red-50 border-l-4 border-red-400 rounded-r-lg px-4 py-2 flex gap-2 items-start">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-red-500 shrink-0 mt-0.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        <div class="min-w-0">
          <div class="text-xs font-bold uppercase text-red-600">${t("allergies")}</div>
          <div class="text-sm text-red-700 flex flex-wrap gap-1.5">${allergies.map((a) => `<span class="bg-white px-2 py-0.5 rounded-md border border-red-200">${ui.esc(a.allergen)} <span class="text-red-400">(${ui.esc(a.reaction || "")})</span></span>`).join("")}</div>
        </div>
      </div>` : "";

    const activeDx = (d.diagnoses || p.diagnoses || []).filter((x) => x.status !== "resolved");
    const dxList = activeDx.map((x) => `
      <span class="inline-flex items-center gap-1.5 ${x.is_primary ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"} px-2 py-1 rounded-lg text-xs font-medium">
        ${x.is_primary ? "★ " : ""}${ui.esc(x.icd10)} ${ui.esc(x.description)} ${x.laterality ? ui.badge(x.laterality, "slate") : ""}
      </span>`).join("") || `<span class="text-xs text-slate-400">—</span>`;

    // Header
    const header = `
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        ${allergyBanner ? `<div class="mb-4">${allergyBanner}</div>` : ""}
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            ${ui.avatar(displayName, "bg-indigo-600")}
            <div>
              <h1 class="text-lg font-bold text-slate-800">${ui.esc(displayName)}</h1>
              <div class="text-xs text-slate-400">${ui.esc(p.mrn)} ${otherName ? "· " + ui.esc(otherName) : ""}</div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600">
                <span>${p.dob ? p.dob + " (" + (p.age ?? "?") + " yrs)" : "—"}</span>
                <span>${p.sex === "F" ? "♀ Female" : p.sex === "M" ? "♂ Male" : ""}</span>
                <span dir="ltr">☎ ${ui.esc(p.phone || "—")}</span>
                <span>📍 ${ui.esc(p.city || "")}</span>
                <span>🛡️ ${ui.esc(p.insurance_provider || "Self-pay")}</span>
                ${p.referring_physician ? `<span>↩ ${ui.esc(p.referring_physician)}</span>` : ""}
              </div>
              <div class="flex flex-wrap gap-1.5 mt-2.5">${dxList}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${isDoctor ? `<button data-act="new-encounter" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm">＋ ${t("newEncounter")}</button>` : ""}
            ${["ophthalmologist","receptionist","admin"].includes(ctx.user.role) ? `<button data-act="edit-patient" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg">✏️ ${t("edit")}</button>` : ""}
            <button data-act="qr" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg">⬚ QR</button>
            <button data-act="pdf-followups" class="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg">📄 Follow-ups PDF</button>
            <button data-act="dilate" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">👁 Dilate</button>
            ${ctx.user.role === "admin" ? `<button data-act="del-patient" class="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg">🗑 ${t("deletePatient")}</button>` : ""}
          </div>
        </div>
      </div>`;

    // Encounters timeline (function of selected encounter, default latest)
    const showEncounterWithButton = true;
    const encounters = d.encounters || [];
    const encSummary = encounters.map((e, i) => {
      const eod = (e.eyes || []).find((x) => x.laterality === "OD");
      const eos = (e.eyes || []).find((x) => x.laterality === "OS");
      return `
        <div class="border border-slate-150 bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">${ui.esc(encTypeLabel[e.encounter_type] || e.encounter_type)}</span>
              <span class="text-sm font-semibold text-slate-700">${e.encounter_date}</span>
              <span class="text-xs text-slate-400">${ui.esc(e.specialty || "")}</span>
            </div>
            <button data-enc="${e.id}" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Open →</button>
          </div>
          <div class="p-4 grid md:grid-cols-2 gap-4">
            <div>
              <div class="text-[11px] font-bold uppercase text-slate-400 mb-2">${t("od")}</div>
              ${eyeBlock(eod)}
            </div>
            <div>
              <div class="text-[11px] font-bold uppercase text-slate-400 mb-2">${t("os")}</div>
              ${eyeBlock(eos)}
            </div>
          </div>
        </div>`;
    }).join("");

    content.innerHTML = `
      <div class="page">
        ${header}
        <div id="files-card" class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">📷 Photos / OCT</h3>
            <div class="flex gap-2">
              <label class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer">＋ Photo <input type="file" data-upload="photo" accept="image/*" class="hidden"></label>
              <label class="px-3 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg cursor-pointer">＋ OCT <input type="file" data-upload="oct" accept="image/*,.pdf" class="hidden"></label>
            </div>
          </div>
          <div id="files-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>
          <div id="files-empty" class="text-xs text-slate-400 hidden">No files yet — upload a photo or OCT.</div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div class="xl:col-span-3 space-y-4">
            ${encSummary || `<div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">${t("noData")}</div>`}
          </div>
          <div class="xl:col-span-2 space-y-4">
            ${card(t("injections"), injectionPanel(d.injections), "#/injections", "Injections →")}
            ${card(t("glaucomaIopTrend"), `<div class="h-40"><canvas id="iop-trend"></canvas></div>`, null, null)}
            ${card("Diagnoses (all)", dxPanel(d.encounters), null, null)}
            ${card(t("historyAndMeds"), sidePanel(p, d), null, null)}
          </div>
        </div>
      </div>`;

    // files: load & upload
    const filesGrid = content.querySelector("#files-grid");
    const filesEmpty = content.querySelector("#files-empty");
    async function refreshFiles() {
      try {
        const r = await api.get(`/patients/${params.id}/files`);
        const files = r.files || [];
        if (!files.length) {
          filesGrid.innerHTML = "";
          filesEmpty.classList.remove("hidden");
          return;
        }
        filesEmpty.classList.add("hidden");
        filesGrid.innerHTML = files.map((f) => {
          const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(f.file_name) || (f.mime && f.mime.startsWith("image/"));
          const src = `/api/patients/${params.id}/files/${f.id}/raw?token=${encodeURIComponent(api.token() || "")}`;
          const canDel = ["ophthalmologist", "resident", "admin"].includes(ctx.user.role);
          return `<div class="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            ${isImg ? `<img src="${src}" alt="${ui.esc(f.file_name)}" class="w-full h-28 object-cover cursor-pointer" data-preview="${f.id}">` : `<div class="h-28 flex items-center justify-center text-2xl">📄</div>`}
            <div class="p-1.5 flex items-center justify-between gap-1">
              <span class="text-[11px] font-medium text-slate-700 truncate" title="${ui.esc(f.file_name)}">${ui.esc(f.file_name)} <span class="text-slate-400">${ui.esc(f.kind)}</span></span>
              ${canDel ? `<button data-del-file="${f.id}" class="text-red-400 hover:text-red-600 text-xs px-1">✕</button>` : ""}
            </div>
          </div>`;
        }).join("");
        filesGrid.querySelectorAll("[data-preview]").forEach((img) => {
          img.addEventListener("click", () => {
            const src = img.getAttribute("src");
            ui.openModal(`<img src="${src}" class="max-w-full rounded-lg">`, { size: "lg" });
          });
        });
        filesGrid.querySelectorAll("[data-del-file]").forEach((b) => {
          b.addEventListener("click", async (e) => {
            e.stopPropagation();
            const fid = b.dataset.delFile;
            ui.confirmDlg("Delete this file?", async () => {
              try { await api.del(`/patients/${params.id}/files/${fid}`); ui.toast("Deleted ✓", "success"); refreshFiles(); } catch (err) { ui.toast(ui.esc(err.message), "error"); }
            }, { danger: true });
          });
        });
      } catch (e) { /* ignore */ }
    }
    refreshFiles();
    content.querySelectorAll("[data-upload]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const file = inp.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("kind", inp.dataset.upload);
        fd.append("file", file);
        try {
          ui.toast("Uploading…", "info");
          await api.upload(`/patients/${params.id}/files`, fd);
          ui.toast("Uploaded ✓", "success");
          inp.value = "";
          refreshFiles();
        } catch (err) { ui.toast(ui.esc(err.message || "upload failed"), "error"); }
      });
    });

    // bind: open encounter
    content.querySelectorAll("[data-enc]").forEach((b) => {
      b.addEventListener("click", () => {
        location.hash = `#/patients/${params.id}/encounters/${b.dataset.enc}`;
      });
    });
    const nb = content.querySelector("[data-act='new-encounter']");
    if (nb) nb.addEventListener("click", () => { location.hash = `#/patients/${params.id}/new-encounter`; });
    const dl = content.querySelector("[data-act='dilate']");
    if (dl) dl.addEventListener("click", () => ui.toast("👁 Dilatation recorded", "info"));
    const pdfFuBtn = content.querySelector("[data-act='pdf-followups']");
    if (pdfFuBtn) {
      pdfFuBtn.addEventListener("click", () => {
        if (!window.jspdf) return ui.toast("PDF library not loaded", "error");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ format: "a4", unit: "mm" });
        let y = 14;
        const add = (txt, opts = {}) => {
          const size = opts.size || 10;
          doc.setFontSize(size);
          doc.setFont("helvetica", opts.bold ? "bold" : "normal");
          doc.setTextColor(opts.color ? opts.color[0] : 30, opts.color ? opts.color[1] : 41, opts.color ? opts.color[2] : 59);
          const lines = doc.splitTextToSize(txt, 180);
          if (y + lines.length * (size * 0.45) > 285) { doc.addPage(); y = 14; }
          doc.text(lines, 15, y);
          y += lines.length * (size * 0.45) + (opts.gap || 3);
        };
        add("Dr. Ihab Haj Hassan — EYE SURGEON", { size: 13, bold: true, gap: 2 });
        add("Follow-ups — " + displayName + " — " + p.mrn, { size: 10, gap: 2 });
        add("DOB: " + (p.dob || "—") + (p.age != null ? " (" + p.age + "y)" : "") + "   Date: " + new Date().toLocaleDateString(), { size: 8, color: [100, 116, 139], gap: 4 });
        doc.setDrawColor(203, 213, 225); doc.line(15, y, 195, y); y += 5;
        const fus = d.follow_ups || [];
        if (!fus.length) {
          add("No follow-ups recorded.", { size: 9, color: [148, 163, 184] });
        } else {
          add("Follow-up    Type          Next due     Status", { size: 8, bold: true, gap: 1 });
          fus.forEach((f) => {
            const line = `${(f.next_due_date || "—").slice(0,10)}  ${(f.follow_up_type || "routine").padEnd(12)}  ${(f.laterality || "OU").padEnd(4)}  ${(f.urgency || "routine").padEnd(8)}  ${f.status || "pending"}`;
            add(line, { size: 8, gap: 1 });
            if (f.instructions) add("  ↳ " + f.instructions, { size: 7, color: [100, 116, 139], gap: 2 });
          });
        }
        y = Math.max(y, 270);
        doc.setFontSize(9); doc.text("Dr. Ihab Haj Hassan", 195, y, { align: "right" });
        doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text("EYE SURGEON", 195, y + 5, { align: "right" });
        try { doc.addImage("/static/img/signature.png", "PNG", 155, y - 12, 30, 10); } catch (_) {}
        doc.save(`FollowUps_${p.mrn}_${new Date().toISOString().slice(0,10)}.pdf`);
      });
    }
    const dp = content.querySelector("[data-act='del-patient']");
    if (dp) {
      dp.addEventListener("click", () => {
        const nm = ui.tname(p) || p.full_name_en || p.full_name_ar || `#${params.id}`;
        ui.confirmDlg(`${t("deletePatient")} "${nm}"? ${t("deleteHint") || "This permanently removes the patient record and all related data."}`, async () => {
          try {
            await api.del(`/patients/${params.id}`);
            ui.toast(t("save") + " ✓", "success");
            location.hash = "#/patients";
          } catch (err) { ui.toast(ui.esc(err.message || "error"), "error"); }
        }, { danger: true });
      });
    }
    const ep = content.querySelector("[data-act='edit-patient']");
    if (ep) ep.addEventListener("click", () => openEditPatient());
    function openEditPatient() {
      const dlg = ui.openModal(`
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"><span class="text-slate-400 text-xs">${t("mrn")}</span> <span class="font-mono font-semibold">${ui.esc(p.mrn)}</span></div>
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
      dlg.setTitle(t("edit") + " — " + displayName);
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
          await api.put(`/patients/${params.id}`, body);
          ui.toast(t("save") + " ✓", "success");
          dlg.close();
          sessionStorage.removeItem("chart_" + params.id);
          load(true);
        } catch (e) { ui.toast(ui.esc(e.message), "error"); }
      });
    }

    const qrBtn = content.querySelector("[data-act='qr']");
    if (qrBtn) {
      qrBtn.addEventListener("click", () => {
        const link = location.origin + "/#/patients/" + params.id;
        const shortList = (arr, n, fmt, sep) => (arr || []).slice(0, n).map(fmt).join(sep);
        const note = [
          "Dr. Ihab Haj Hassan — EYE SURGEON",
          `Patient: ${displayName} — ${p.mrn}`,
          `DOB: ${p.dob || "—"} (${p.age ?? "?"}y) ${p.sex || ""}`,
          `Diagnoses: ${shortList(activeDx, 2, (x)=> x.icd10, ", ") || "—"}`,
          `Link: ${link}`,
        ].join("\n");
        const html = `
          <div class="text-center">
            <div class="flex justify-center mb-3"><div id="qr-box"></div></div>
            <div class="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-left whitespace-pre-wrap">${ui.esc(note)}</div>
            <div class="text-[11px] text-slate-400 mt-2">Scan with iPhone Camera — tap to open the chart (same Wi-Fi).</div>
            <div id="qr-err" class="text-xs text-amber-600 mt-2 hidden"></div>
          </div>`;
        const m = ui.openModal(html, { size: "md" });
        m.setTitle("QR — " + displayName);
        setTimeout(() => {
          const box = document.getElementById("qr-box");
          const errEl = document.getElementById("qr-err");
          if (box && window.QRCode) {
            box.innerHTML = "";
            const tryQr = (txt) => {
              try {
                new QRCode(box, { text: txt, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.L });
                return true;
              } catch (e) { return false; }
            };
            // QR must be a pure URL so iPhone offers “Open in Safari”
            let qrOk = tryQr(link);
            if (!qrOk) {
              box.innerHTML = '<div class="text-xs text-red-500">QR too large — use the link below</div>';
              if (errEl) { errEl.textContent = "Link too long for QR."; errEl.classList.remove("hidden"); }
            } else if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
              if (errEl) { errEl.textContent = "You opened the EMR as localhost — iPhone can't reach 127.0.0.1. Re-open the EMR on the laptop as http://192.168.1.102:5000 then re-scan."; errEl.classList.remove("hidden"); }
            }
          }
        }, 50);
      });
    }

    drawIopChart(d.iops, content);
  }

  function eyeBlock(ef) {
    if (!ef) return `<div class="text-xs text-slate-300">—</div>`;
    return `
      <div class="text-xs text-slate-600 space-y-1">
        <div><span class="font-semibold text-slate-500">${t("va")}:</span> <span class="font-bold text-slate-800">${ui.esc(ef.ucva_dist || "—")}</span> ${ef.bcva_dist ? `<span class="text-slate-400">/ BCVA ${ui.esc(ef.bcva_dist)}</span>` : ""}</div>
        <div><span class="font-semibold text-slate-500">Refr:</span> <span class="text-slate-800">${ui.esc(ef.sph ?? "0")} ${ui.esc(ef.cyl ?? "0")} × ${ui.esc(ef.axis ?? "0")}</span></div>
        <div><span class="font-semibold text-slate-500">${t("iop")}:</span> <span class="font-bold ${ef.iop > 21 ? "text-red-600" : "text-slate-800"}">${ui.esc(ef.iop || "—")}</span> <span class="text-slate-400">${ui.esc(ef.iop_method || "")}</span> ${ef.cct ? `(CCT ${ui.esc(ef.cct)})` : ""}</div>
        <div><span class="font-semibold text-slate-500">${t("anteriorSegment")}:</span> <span class="text-slate-600">${ui.esc(ef.lens_status || "—")}</span> ${ef.cataract_type ? `<span class="text-slate-500">· ${ui.esc(ef.cataract_type)} ${ui.esc(ef.cataract_grade || "")}</span>` : ""} ${ef.ac_cells ? `· AC ${ui.esc(ef.ac_cells)}/${ui.esc(ef.ac_flare || "")}` : ""}</div>
        <div><span class="font-semibold text-slate-500">${t("posteriorSegment")}:</span>
          <span class="text-slate-600">${ui.esc(ef.macula || "")}</span> ${ef.cst_um ? ui.badge("CST " + ef.cst_um + "µm", ef.cst_um > 300 ? "red" : "green") : ""}
          <span class="text-slate-500">· C/D ${ui.esc(ef.cdr || "—")}</span> ${ef.rnfl_um ? `<span class="text-slate-500">RNFL ${ui.esc(ef.rnfl_um)}µm</span>` : ""}
        </div>
        ${ef.vitreous ? `<div><span class="font-semibold text-slate-500">Vitreous:</span> ${ui.esc(ef.vitreous)}</div>` : ""}
      </div>`;
  }

  function injectionPanel(inj) {
    if (!inj || !inj.length) return `<div class="text-xs text-slate-400">${t("noData")}</div>`;
    const rows = inj.slice().reverse().map((x) => `
      <div class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
        <div class="text-xs">
          <div class="text-[11px] text-slate-400">${x.procedure_date} · ${ui.esc(x.drug)} ${ui.esc(x.dose_mg || "")}</div>
          <div class="text-slate-600 font-medium">${x.laterality === "OD" ? "Right eye" : "Left eye"} · #${x.series_number ?? "?"} · ${ui.esc(x.indication || "")}</div>
        </div>
        ${ui.badge(x.response || "—", x.response === "Improved" ? "green" : x.response === "Stable" ? "blue" : x.response === "Worse" ? "red" : "slate")}
      </div>`).join("");
    return `<div>${rows}</div><div class="mt-2 text-[11px] text-slate-400">Total: ${inj.length} injections</div>`;
  }

  function dxPanel(encounters) {
    const seen = new Set();
    const list = [];
    (encounters || []).forEach((e) => (e.diagnoses || []).forEach((dx) => {
      const k = dx.icd10 + "|" + dx.laterality;
      if (!seen.has(k)) { seen.add(k); list.push(dx); }
    }));
    if (!list.length) return `<div class="text-xs text-slate-400">—</div>`;
    return list.map((dx) => `
      <div class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-xs">
        <div class="text-slate-700">${ui.esc(dx.icd10)} — ${ui.esc(dx.description)}</div>
        <span class="text-[11px] text-slate-400">${dx.laterality || "OU"}</span>
      </div>`).join("");
  }

  function sidePanel(p, d) {
    const sys = (p.systemic_medications || []).map((s) => `<li>${ui.esc(s.drug)} ${ui.esc(s.dose || "")} ${ui.esc(s.frequency || "")}</li>`).join("");
    const hist = (p.medical_history || []).map((h) => `<li>${ui.esc(h.condition_name)} <span class="text-slate-400">(${ui.esc(h.icd10 || "")})</span></li>`).join("");
    return `
      <div class="text-xs space-y-2">
        <div>
          <div class="font-bold uppercase text-[10px] text-slate-400 mb-1">${t("systemicMeds")}</div>
          ${sys ? `<ul class="list-disc list-inside text-slate-700">${sys}</ul>` : `<div class="text-slate-400">—</div>`}
        </div>
        <div>
          <div class="font-bold uppercase text-[10px] text-slate-400 mb-1">${t("medicalHistory")}</div>
          ${hist ? `<ul class="list-disc list-inside text-slate-700">${hist}</ul>` : `<div class="text-slate-400">—</div>`}
        </div>
        <div>
          <div class="font-bold uppercase text-[10px] text-slate-400 mb-1">${t("medications") || "Medications (ocular)"}</div>
          ${medList(d)}
        </div>
      </div>`;
  }

  function medList(d) {
    const meds = {};
    (d.encounters || []).forEach((e) => (e.medications || []).forEach((m) => {
      const k = m.drug;
      if (!meds[k]) meds[k] = { ...m, count: 0 };
      meds[k].count++;
    }));
    const items = Object.values(meds);
    if (!items.length) return `<div class="text-slate-400">—</div>`;
    return items.map((m) => `<div class="py-1 border-b border-slate-50 last:border-0"><span class="font-semibold text-slate-700">${ui.esc(m.drug)}</span> <span class="text-slate-400">${ui.esc(m.strength || "")} ${ui.esc(m.frequency || "")} · ${ui.esc(m.eye || "")}</span></div>`).join("");
  }

  function card(title, body, href, hrefText) {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <h3 class="text-sm font-semibold text-slate-700">${title}</h3>
          ${href ? `<a href="${href}" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">→</a>` : ""}
        </div>
        <div class="p-4">${body}</div>
      </div>`;
  }

  function drawIopChart(iops, content) {
    const el = content.querySelector("#iop-trend");
    if (!el || !window.Chart) return;
    if (!iops || !iops.length) {
      el.parentElement.innerHTML = `<div class="text-xs text-slate-400 p-4">${t("noData")}</div>`;
      return;
    }
    const od = iops.filter((x) => x.laterality === "OD");
    const os = iops.filter((x) => x.laterality === "OS");
    const labels = [...new Set(iops.map((x) => x.encounter_date))].sort();
    const series = (arr) => labels.map((d) => { const r = arr.find((x) => x.encounter_date === d); return r ? r.iop : null; });
    new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "OD", data: series(od), borderColor: "#6366f1", tension: .3, spanGaps: true, pointRadius: 4 },
          { label: "OS", data: series(os), borderColor: "#0ea5e9", tension: .3, spanGaps: true, pointRadius: 4 },
          { label: "target 21", data: labels.map(() => 21), borderColor: "#f87171", borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } },
    });
  }

  await load(false);
});
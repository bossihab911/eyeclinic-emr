/* pages/dashboard.js */
"use strict";
app.register("/dashboard", async (ctx) => {
  const { content } = ctx;
  const t = i18n.t.bind(i18n);
  const data = await api.get("/reports/overview");
  const fups = await api.get("/follow-ups");
  const injections = await api.get("/injections");

  const kpis = [
    { label: t("totalPatients"), value: data.patients_total, icon: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z", color: "from-indigo-500 to-violet-500" },
    { label: t("encountersMonth"), value: data.encounters_month, icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5", color: "from-sky-500 to-blue-600" },
    { label: t("injectionsMonth"), value: data.injections_month, icon: "M19.5 12c0-1.232-.046-2.453-.134-3.662C19.154 5.544 16.708 4 14.25 4h-1.5c-2.458 0-4.904 1.544-5.116 4.338-.088 1.21-.134 2.43-.134 3.662 0 1.232.046 2.453.134 3.662C7.846 18.456 10.292 20 12.75 20h1.5c2.458 0 4.904-1.544 5.116-4.338.088-1.21.134-2.43.134-3.662Z", color: "from-fuchsia-500 to-pink-600" },
    { label: t("injectionsToday"), value: data.injections_today, icon: "M15 12h3.375m-3.375 6h4.5M15 12V9.375A1.125 1.125 0 0116.125 8.25h1.5A1.125 1.125 0 0118.75 9.375V12M15 12h-3.75v-1.5a1.125 1.125 0 00-1.125-1.125h-1.5A1.125 1.125 0 008.25 10.5V12m0 0H6.5m0 0V9.375A1.125 1.125 0 017.625 8.25h1.5a1.125 1.125 0 011.125 1.125V12", color: "from-emerald-500 to-teal-600" },
    { label: t("overdueRecalls"), value: data.overdue_recalls, icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z", color: "from-rose-500 to-red-600", alert: data.overdue_recalls > 0 },
    { label: t("dueThisWeek"), value: data.due_this_week, icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5", color: "from-amber-500 to-orange-600" },
    { label: t("unpaidInvoices"), value: "$" + Math.round(data.invoices_unpaid), icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z", color: "from-slate-600 to-slate-800" },
    { label: t("surgeriesScheduled"), value: data.surgeries_scheduled, icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z", color: "from-violet-500 to-purple-600" },
  ];

  const kpiCards = kpis.map((k, i) => `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-start gap-3 ${k.alert ? "ring-2 ring-red-200" : ""}">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${k.color} flex items-center justify-center shrink-0 shadow">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="white" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="${k.icon}" /></svg>
      </div>
      <div class="min-w-0">
        <div class="text-2xl font-bold text-slate-800 leading-tight">${k.value}</div>
        <div class="text-xs text-slate-500 mt-0.5">${k.label}</div>
      </div>
    </div>`).join("");

  const drugRows = (data.drug_usage || []).map((d) => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="py-2.5 text-sm text-slate-700 font-medium">${ui.esc(d.drug)}</td>
      <td class="py-2.5"><span class="text-sm font-bold text-indigo-600">${d.n}</span></td>
    </tr>`).join("") || `<tr><td class="py-4 text-sm text-slate-400 text-center">${t("noData")}</td></tr>`;

  const dxRows = (data.icd_volume || []).map((d) => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="py-2 text-xs text-slate-500">${ui.esc(d.icd10)}</td>
      <td class="py-2 text-sm text-slate-700">${ui.esc(d.description)}</td>
      <td class="py-2 text-sm font-bold text-indigo-600">${d.n}</td>
    </tr>`).join("") || `<tr><td class="py-4 text-sm text-slate-400 text-center">${t("noData")}</td></tr>`;

  const recentInjections = (injections.injections || []).slice(0, 8).map((ij) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50" data-patient="${ij.patient_id}">
      <td class="py-2.5 px-2">
        <div class="text-sm font-medium text-slate-700">${ui.esc(ij.name_given_en)} ${ui.esc(ij.name_family_en)}</div>
        <div class="text-[11px] text-slate-400">${ui.esc(ij.mrn)}</div>
      </td>
      <td class="py-2.5 text-sm">${ij.procedure_date}</td>
      <td class="py-2.5">${ui.badge(ij.laterality, ij.laterality === "OD" ? "blue" : "purple")}</td>
      <td class="py-2.5 text-sm font-medium text-slate-700">${ui.esc(ij.drug)}</td>
      <td class="py-2.5 text-sm text-slate-500">${ui.esc(ij.complications || "None")}</td>
      <td class="py-2.5 text-right"><a href="#/patients/${ij.patient_id}/encounters/${ij.encounter_id || ij.id}" class="text-indigo-600 hover:text-indigo-800 text-sm">${t("viewChart")} →</a></td>
    </tr>`).join("");

  const dueList = (fups.follow_ups || []).filter((f) => f.status !== "done" && f.status !== "cancelled").slice(0, 8).map((f) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50" data-patient="${f.patient_id}">
      <td class="py-2.5 px-2">
        <div class="text-sm font-medium text-slate-700">${ui.esc(f.name_given_en)} ${ui.esc(f.name_family_en)}</div>
        <div class="text-[11px] text-slate-400">${ui.esc(f.mrn)}</div>
      </td>
      <td class="py-2.5 text-sm text-slate-600">${ui.esc(f.follow_up_type)}</td>
      <td class="py-2.5">${f.next_due_date < new Date().toISOString().slice(0,10) ? ui.badge(t("overdue"), "red") : ui.badge(f.next_due_date, "blue")}</td>
      <td class="py-2.5 text-sm text-slate-500">${f.next_due_date}</td>
      <td class="py-2.5 text-right"><a href="#/patients/${f.patient_id}" class="text-indigo-600 hover:text-indigo-800 text-sm">${t("viewChart")} →</a></td>
    </tr>`).join("");

  content.innerHTML = `
    <div class="page">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-slate-800">${t("dashboard")}</h1>
          <p class="text-sm text-slate-500">${new Date().toLocaleDateString(i18n.lang === "ar" ? "ar-LB" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">${kpiCards}</div>

      <div class="grid lg:grid-cols-3 gap-4 mb-6">
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">${t("injectionVolume")}</h3>
          <div class="h-48"><canvas id="inject-30d"></canvas></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">${t("drugUsage")}</h3>
          <table class="w-full"><tbody>${drugRows}</tbody></table>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-slate-700">${t("injectionLog")}</h3>
            <a href="#/injections" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">${t("viewChart")} →</a>
          </div>
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
            <th class="px-2 py-2">${t("patient")}</th><th class="px-2 py-2">${t("date")}</th><th class="px-2 py-2">${t("eye")}</th><th class="px-2 py-2">${t("drug")}</th><th class="px-2 py-2">${t("complications")}</th></tr></thead><tbody>${recentInjections}</tbody></table></div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-slate-700">${t("upcoming")}</h3>
            <a href="#/registries" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Registries →</a>
          </div>
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
            <th class="px-2 py-2">${t("patient")}</th><th class="px-2 py-2">${t("followUp")}</th><th class="px-2 py-2">${t("status")}</th><th class="px-2 py-2">${t("nextDue")}</th></tr></thead><tbody>${dueList}</tbody></table></div>
        </div>
      </div>
    </div>`;

  // click delegation to open patient charts
  content.querySelectorAll("[data-patient]").forEach((tr) => {
    tr.addEventListener("click", () => { location.hash = `#/patients/${tr.dataset.patient}`; });
  });

  // charts
  const vol = data.injection_volume_30d || [];
  if (window.Chart) {
    new Chart(content.querySelector("#inject-30d"), {
      type: "line",
      data: {
        labels: vol.map((r) => r.d.slice(5)),
        datasets: [{
          label: t("volume"), data: vol.map((r) => r.n),
          borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,.15)",
          fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: "#6366f1",
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }
});
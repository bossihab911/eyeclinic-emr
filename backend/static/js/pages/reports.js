/* pages/reports.js — analytics dashboard */
"use strict";
const ReportPage = { state: { tab: "overview" } };

app.register("/reports", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");

  function renderBar(canvasId, labels, data, color) {
    setTimeout(() => {
      const cv = document.getElementById(canvasId);
      if (!cv || !window.Chart) return;
      new Chart(cv.getContext("2d"), {
        type: "bar",
        data: { labels, datasets: [{ label: "", data, backgroundColor: color, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: "#f1f5f9" } } } },
      });
    }, 50);
  }

  function renderLine(canvasId, labels, data, color) {
    setTimeout(() => {
      const cv = document.getElementById(canvasId);
      if (!cv || !window.Chart) return;
      new Chart(cv.getContext("2d"), {
        type: "line",
        data: { labels, datasets: [{ label: "", data, borderColor: color, backgroundColor: color + "22", fill: true, tension: 0.35, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: "#f1f5f9" } } } },
      });
    }, 50);
  }

  function kpi(label, value, sub, accent) {
    return `<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">${label}</div>
      <div class="text-2xl font-bold text-slate-800 mt-1">${value}</div>
      ${sub ? `<div class="text-xs ${accent || "text-slate-400"} mt-0.5">${sub}</div>` : ""}
    </div>`;
  }

  function render() {
    const tab = ReportPage.state.tab;
    content.innerHTML = `
      <div class="page">
        <h1 class="text-lg font-bold text-slate-800 mb-4">📊 ${t("reports")}</h1>
        <div class="flex gap-2 mb-4">
          ${[["overview", "🎯 Overview"], ["injections", "💉 Injections"], ["revenue", "💰 Revenue"], ["ops", "🧮 Operations"]].map(([k, label]) => `<button data-tab="${k}" class="px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">${label}</button>`).join("")}
        </div>
        <div id="rep-view"></div>
      </div>`;
    content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      ReportPage.state.tab = b.dataset.tab;
      render();
    }));
    const view = content.querySelector("#rep-view");
    if (tab === "overview") overview(view);
    else if (tab === "injections") injections(view);
    else if (tab === "revenue") revenue(view);
    else ops(view);
  }

  async function overview(view) {
    view.innerHTML = `<div class="space-y-4">
      <div id="kpi-grid" class="grid grid-cols-2 md:grid-cols-4 gap-3"><div class="col-span-2 text-slate-400 text-sm py-8 text-center">Loading…</div></div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Injections (30 days)</h3><div class="h-56"><canvas id="c-vol"></canvas></div></div>
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Drug usage</h3><div class="h-56"><canvas id="c-drug"></canvas></div></div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Top diagnoses</h3><div class="space-y-1.5" id="dx-list"></div></div>
    </div>`;
    const r = await api.get("/reports/overview");
    document.getElementById("kpi-grid").innerHTML =
      kpi(t("patients"), r.patients_total, "Total") +
      kpi(t("encounters"), r.encounters_month, `${r.encounters_month} this month`) +
      kpi(t("injections"), r.injections_month, `${r.injections_today} today`) +
      kpi(t("surgeriesScheduled"), r.surgeries_scheduled, r.overdue_recalls + " overdue recalls", r.overdue_recalls ? "text-red-500" : "") +
      kpi("Outstanding", "$" + Number(r.invoices_unpaid || 0).toFixed(0), "unpaid invoices") +
      kpi("Pending billing", "$" + Number(r.pending_billing || 0).toFixed(0), "unbilled items") +
      kpi("Overdue recalls", r.overdue_recalls, "patients due", r.overdue_recalls ? "text-red-500" : "");
    const vol = r.injection_volume_30d || [];
    renderLine("c-vol", vol.map((x) => (x.d || "").slice(5)), vol.map((x) => x.n), "#6366f1");
    const drugs = r.drug_usage || [];
    renderBar("c-drug", drugs.map((x) => x.drug), drugs.map((x) => x.n), "#6366f1");
    const dx = r.icd_volume || [];
    document.getElementById("dx-list").innerHTML = dx.map((d) => `
      <div class="flex justify-between py-1.5 border-b border-slate-50 text-sm">
        <span class="text-slate-600"><span class="font-mono text-indigo-600 font-semibold">${ui.esc(d.icd10)}</span> ${ui.esc(d.description || "")}</span>
        <span class="font-bold text-slate-700">${d.n}</span>
      </div>`).join("") || '<div class="text-xs text-slate-400">No data</div>';
  }

  async function injections(view) {
    view.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-2"><h3 class="text-sm font-bold text-slate-700 mb-2">By drug</h3><div class="h-64"><canvas id="c-by-drug"></canvas></div></div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">By eye</h3><div class="h-32"><canvas id="c-by-eye"></canvas></div><h3 class="text-sm font-bold text-slate-700 mb-2 mt-6">Monthly volume</h3><div id="monthly" class="space-y-1.5"></div></div>
    </div>`;
    const r = await api.get("/reports/injections");
    const byDrug = r.by_drug || [], byEye = r.by_eye || [], byMonth = r.by_month || [];
    renderBar("c-by-drug", byDrug.map((x) => x.drug), byDrug.map((x) => x.n), "#6366f1");
    document.getElementById("c-by-eye") && new Chart(document.getElementById("c-by-eye").getContext("2d"), {
      type: "doughnut",
      data: { labels: byEye.map((x) => x.laterality), datasets: [{ data: byEye.map((x) => x.n), backgroundColor: ["#6366f1", "#38bdf8"] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });
    // clear canvas for doughnut (canvas reused id close)
    const map = (m) => {
      const d = m.split("-")[0] + "-" + m.split("-")[1];
      const max = Math.max(...byMonth.map((x) => x.n), 1);
      return `<div class="flex items-center gap-2 text-xs">
        <span class="w-12 text-slate-400">${d}</span>
        <div class="flex-1 bg-slate-100 rounded-full h-2"><div class="bg-indigo-500 h-2 rounded-full" style="width:${(m.n / max) * 100}%"></div></div>
        <span class="font-semibold text-slate-700 w-6 text-right">${m.n}</span>
      </div>`;
    };
    document.getElementById("monthly").innerHTML = byMonth.map(map).join("") || '<div class="text-xs text-slate-400">No data</div>';
  }

  async function revenue(view) {
    view.innerHTML = `<div class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="rev-kpis"></div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Daily revenue</h3><div class="h-64"><canvas id="c-rev"></canvas></div></div>
    </div>`;
    const r = await api.get("/reports/revenue");
    const t = r.totals || {};
    document.getElementById("rev-kpis").innerHTML =
      kpi("Revenue", "$" + Number(t.revenue || 0).toFixed(0), "billed") +
      kpi("Collected", "$" + Number(t.collected || 0).toFixed(0), "paid") +
      kpi("Outstanding", "$" + Number(t.outstanding || 0).toFixed(0), "unpaid", "text-red-500");
    const daily = (r.daily || []).slice().reverse();
    renderBar("c-rev", daily.map((x) => (x.date || "").slice(5)), daily.map((x) => x.revenue), "#10b981");
  }

  async function ops(view) {
    view.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Encounters by type</h3><div id="ops-type" class="space-y-1.5"></div></div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><h3 class="text-sm font-bold text-slate-700 mb-2">Encounters by specialty</h3><div id="ops-spec" class="space-y-1.5"></div></div>
    </div>`;
    const r = await api.get("/reports/ops");
    const bar = (arr) => {
      const max = Math.max(...arr.map((x) => x.n), 1);
      return arr.map((x) => `
        <div class="flex items-center gap-2 text-sm">
          <span class="w-28 capitalize text-slate-600">${ui.esc(x.encounter_type || x.specialty || "—")}</span>
          <div class="flex-1 bg-slate-100 rounded-full h-3"><div class="bg-indigo-500 h-3 rounded-full" style="width:${(x.n / max) * 100}%"></div></div>
          <span class="font-bold text-slate-700 w-6 text-right">${x.n}</span>
        </div>`).join("") || '<div class="text-xs text-slate-400">No data</div>';
    };
    document.getElementById("ops-type").innerHTML = bar(r.encounters_by_type || []);
    document.getElementById("ops-spec").innerHTML = bar(r.encounters_by_specialty || []);
  }

  render();
});
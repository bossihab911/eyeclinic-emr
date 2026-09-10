/* pages/billing.js — invoices + billing items */
"use strict";
const BillingPage = { state: { tab: "invoices" } };

app.register("/billing", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");

  function statusPill(status, amount, total) {
    const paid = total - amount <= 0.001;
    const cls = paid ? "bg-emerald-50 text-emerald-600" : status === "partial" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500";
    return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${cls}">${paid ? t("statusPaid") : status === "partial" ? t("statusPartial") : t("statusUnpaid")}</span>`;
  }

  function openCreateInvoice() {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-4">🧾 ${t("newInvoice")}</h3>
      <div class="space-y-3">
        <label class="block text-xs font-semibold text-slate-500 mb-1">Patient</label>
        <select id="b-patient-select" class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Loading patients…</option>
        </select>
        <label class="block text-xs font-semibold text-slate-500">Items (from billing templates)</label>
        <div class="grid grid-cols-[1fr_70px_60px_80px] gap-2 items-center">
          <select id="b-item" class="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"></select>
          <input id="b-price" type="number" value="0" class="border border-slate-200 rounded-lg px-2 py-2 text-sm text-center">
          <input id="b-qty" type="number" value="1" min="1" class="border border-slate-200 rounded-lg px-2 py-2 text-sm text-center">
          <button id="b-add" class="px-2 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold">＋</button>
        </div>
        <div id="b-line-items" class="space-y-1"></div>
        <div class="grid grid-cols-2 gap-3">
          ${ui.field({ id: "b-discount", label: "Discount", type: "number", value: "0" })}
          ${ui.field({ id: "b-tax", label: "Tax", type: "number", value: "0" })}
        </div>
      </div>
      <div class="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
        <span class="text-sm text-slate-500">${t("total")}</span>
        <span id="b-total" class="text-xl font-bold text-slate-800">0.00</span>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-create class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("create")}</button>
      </div>`, "max-w-lg");

    let lines = [], selPatient = null, templates = [];
    const g = (id) => document.getElementById("modal-root").querySelector(id);
    const renderLines = () => {
      g("#b-line-items").innerHTML = lines.length ? lines.map((l, i) => `
        <div class="flex justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
          <span>${ui.esc(l.item_name)} <span class="text-xs text-slate-400">×${l.quantity}</span></span>
          <span class="font-medium">$${ui.esc((l.unit_price * l.quantity).toFixed(2))} <button data-del="${i}" class="text-red-400 ml-2">✕</button></span>
        </div>`).join("") : '<div class="text-xs text-slate-400 py-1">No items</div>';
      g("#b-line-items").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { lines.splice(Number(b.dataset.del), 1); renderLines(); }));
      const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
      g("#b-total").textContent = (total - (Number(g("#b-discount").value) || 0) + (Number(g("#b-tax").value) || 0)).toFixed(2);
    };

    (async () => {
      const r = await api.get("/billing/templates");
      templates = r.templates || [];
      g("#b-item").innerHTML = templates.map((x) => `<option value="${x.name}" data-cpt="${x.cpt}" data-price="${x.price}">${ui.esc(x.name)} — $${x.price}</option>`).join("");
      const sync = () => {
        const opt = g("#b-item").selectedOptions[0];
        if (opt) g("#b-price").value = opt.dataset.price;
      };
      g("#b-item").addEventListener("change", sync);
      sync();
    })();

    g("#b-add").addEventListener("click", () => {
      const opt = g("#b-item").selectedOptions[0];
      if (!opt) return;
      lines.push({ item_name: opt.value, cpt_code: opt.dataset.cpt, quantity: Number(g("#b-qty").value) || 1, unit_price: Number(g("#b-price").value) || 0 });
      renderLines();
    });
    ["#b-discount", "#b-tax"].forEach((s) => g(s).addEventListener("input", renderLines));

    // dropdown of all patients — fresh fetch so new patients appear and deleted ones disappear automatically
    const selEl = g("#b-patient-select");
    (async () => {
      try {
        const r = await api.get("/patients?per=500");
        const pts = r.patients || [];
        selEl.innerHTML = '<option value="">Select patient…</option>' + pts.map((p) => `<option value="${p.id}">${ui.esc((p.full_name_en || p.full_name_ar) + " — " + p.mrn)}</option>`).join("");
        selEl.addEventListener("change", () => {
          const id = selEl.value;
          selPatient = pts.find((x) => String(x.id) === String(id)) || null;
        });
      } catch (e) {
        selEl.innerHTML = '<option value="">Failed to load patients</option>';
      }
    })();

    g("[data-close]").addEventListener("click", () => dlg.remove());
    g("[data-create]").addEventListener("click", async () => {
      if (!selPatient) return ui.toast("Select a patient", "warning");
      if (!lines.length) return ui.toast("Add at least one item", "warning");
      try {
        await api.post("/invoices", {
          patient_id: selPatient.id,
          items: lines,
          discount: Number(g("#b-discount").value) || 0,
          tax: Number(g("#b-tax").value) || 0,
        });
        ui.toast(t("save"));
        dlg.remove();
        loadInvoices();
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
  }

  function payInvoice(iv, amount) {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-3">💵 ${t("recordPayment")}</h3>
      <div class="space-y-3">
        ${ui.field({ id: "p-amount", label: "Amount", type: "number", value: amount.toFixed(2) })}
        ${ui.field({ id: "p-method", label: "Method", type: "select", options: [["cash", "Cash"], ["card", "Card"], ["insurance", "Insurance"], ["bank_transfer", "Bank transfer"]] })}
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-pay class="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">${t("pay")}</button>
      </div>`, "max-w-sm");
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.remove());
    dlg.querySelector("[data-pay]").addEventListener("click", async () => {
      try {
        await api.post(`/invoices/${iv}/pay`, {
          amount: Number(dlg.querySelector("#p-amount").value) || 0,
          payment_method: dlg.querySelector("#p-method").value,
        });
        ui.toast(t("save"));
        dlg.remove();
        loadInvoices();
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
  }

  async function loadInvoices() {
    const r = await api.get("/invoices");
    const rows = r.invoices || [];
    const tbody = document.getElementById("inv-rows");
    tbody.innerHTML = rows.length ? rows.map((i) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2"><a class="font-medium text-indigo-600 hover:underline" href="#/patients/${i.patient_id}">${ui.esc(i.name_given_en + " " + (i.name_family_en || ""))}</a><div class="text-[11px] text-slate-400">${ui.esc(i.mrn || "")}</div></td>
        <td class="px-3 py-2 font-mono text-xs text-slate-500">${ui.esc(i.invoice_no)}</td>
        <td class="px-3 py-2 text-sm">${ui.esc((i.date || "").slice(0, 10))}</td>
        <td class="px-3 py-2 text-right font-semibold">$${ui.esc(Number(i.total).toFixed(2))}</td>
        <td class="px-3 py-2 text-right text-slate-500">$${ui.esc(Number(i.paid || 0).toFixed(2))}</td>
        <td class="px-3 py-2 text-center">${statusPill(i.status, i.balance, i.total)}</td>
        <td class="px-3 py-2 text-right">${i.balance > 0.001 ? `<button data-payrow="${i.id}" data-bal="${i.balance}" class="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">${t("pay")}</button>` : ""}</td>
      </tr>`).join("") : `<tr><td colspan="7" class="px-3 py-8 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;
    tbody.querySelectorAll("[data-payrow]").forEach((b) => b.addEventListener("click", () => payInvoice(Number(b.dataset.payrow), Number(b.dataset.bal))));
  }

  async function loadItems() {
    const r = await api.get("/billing");
    const rows = r.items || [];
    const tbody = document.getElementById("bill-rows");
    const sum = rows.reduce((s, x) => s + x.total, 0);
    document.getElementById("bill-total").textContent = `$${sum.toFixed(2)}`;
    tbody.innerHTML = rows.length ? rows.map((x) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2"><a class="font-medium text-indigo-600 hover:underline" href="#/patients/${x.patient_id}">${ui.esc(x.name_given_en + " " + (x.name_family_en || ""))}</a></td>
        <td class="px-3 py-2">${ui.esc(x.item_name)} <span class="text-[11px] text-slate-400">${ui.esc(x.cpt_code || "")}</span></td>
        <td class="px-3 py-2 text-center">×${x.quantity}</td>
        <td class="px-3 py-2 text-right font-semibold">$${ui.esc(Number(x.total).toFixed(2))}</td>
      </tr>`).join("") : `<tr><td colspan="4" class="px-3 py-8 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;
  }

  function render() {
    const tab = BillingPage.state.tab;
    content.innerHTML = `
      <div class="page">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-bold text-slate-800">🧾 ${t("billing")}</h1>
          ${tab === "invoices" ? `<button data-new class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow">＋ ${t("newInvoice")}</button>` : ""}
        </div>
        <div class="flex gap-2 mb-4">
          ${[["invoices", "🧾 " + t("invoices")], ["items", "🛒 " + t("billingItems")]].map(([k, label]) => `<button data-tab="${k}" class="px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">${label}</button>`).join("")}
        </div>
        <div id="bill-view"></div>
      </div>`;

    content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      BillingPage.state.tab = b.dataset.tab;
      render();
    }));
    content.querySelector("[data-new]")?.addEventListener("click", openCreateInvoice);

    const view = content.querySelector("#bill-view");
    if (tab === "invoices") {
      view.innerHTML = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th class="px-3 py-2.5">${t("patient")}</th><th class="px-3 py-2.5">${t("invoice")}</th><th class="px-3 py-2.5">${t("date")}</th><th class="px-3 py-2.5 text-right">${t("total")}</th><th class="px-3 py-2.5 text-right">${t("paid")}</th><th class="px-3 py-2.5 text-center">${t("status")}</th><th class="px-3 py-2.5 text-right"></th></tr></thead>
          <tbody id="inv-rows"><tr><td colspan="7" class="px-3 py-8 text-center text-slate-400 text-sm">Loading…</td></tr></tbody>
        </table></div>`;
      loadInvoices();
    } else {
      view.innerHTML = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <div class="flex justify-between px-4 py-3 border-b border-slate-100"><span class="text-sm text-slate-500">${t("total")} unbilled items</span><span id="bill-total" class="font-bold text-indigo-600">$0</span></div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th class="px-3 py-2.5">${t("patient")}</th><th class="px-3 py-2.5">${t("itemName")}</th><th class="px-3 py-2.5 text-center">${t("qty")}</th><th class="px-3 py-2.5 text-right">${t("total")}</th></tr></thead>
          <tbody id="bill-rows"></tbody>
        </table></div>`;
      loadItems();
    }
  }

  render();
});
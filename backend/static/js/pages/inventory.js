/* pages/inventory.js — stock + movements */
"use strict";
const InventoryPage = { state: { tab: "stock" } };

app.register("/inventory", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");

  function stockBadge(item) {
    if (item.low_stock) return `<span class="px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold">Low</span>`;
    return `<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">OK</span>`;
  }

  function movement(item) {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-3">${ui.esc(item.name)}</h3>
      <div class="text-xs text-slate-400 mb-3">${t("currentStock")}: <b class="text-slate-700">${item.current_stock}</b> ${ui.esc(item.unit_of_measure || "")}</div>
      <div class="grid grid-cols-2 gap-3">
        ${ui.field({ id: "m-qty", label: "Change (+ in / − out)", type: "number" })}
        ${ui.field({ id: "m-reason", label: "Reason", type: "select", options: [["supply","Supply"],["injection","Injection use"],["expired","Expired"],["transfer","Transfer"],["adjust","Adjustment"]] })}
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-save class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("save")}</button>
      </div>`, "max-w-sm");
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.remove());
    dlg.querySelector("[data-save]").addEventListener("click", async () => {
      const qty = Number(dlg.querySelector("#m-qty").value);
      if (!qty) return ui.toast("Enter a quantity", "warning");
      try {
        await api.post(`/inventory/${item.id}/movement`, { change_qty: qty, reason: dlg.querySelector("#m-reason").value });
        ui.toast(t("save"));
        dlg.remove();
        loadStock();
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
  }

  function newItem() {
    const dlg = ui.openModal(`
      <h3 class="text-lg font-bold text-slate-800 mb-4">＋ ${t("newItem")}</h3>
      <div class="grid grid-cols-2 gap-3">
        ${ui.field({ id: "n-name", label: "Name", type: "text", placeholder: "Avastin 100mg" })}
        ${ui.field({ id: "n-cat", label: "Category", type: "select", options: [["drug","Drug"],["consumable","Consumable"],["equipment","Equipment"]] })}
        ${ui.field({ id: "n-qty", label: "Initial stock", type: "number", value: "0" })}
        ${ui.field({ id: "n-min", label: "Min stock", type: "number", value: "5" })}
        ${ui.field({ id: "n-uom", label: "Unit", type: "text", placeholder: "vial / box" })}
        ${ui.field({ id: "n-cost", label: "Unit cost $", type: "number" })}
        ${ui.field({ id: "n-sell", label: "Selling $", type: "number" })}
        ${ui.field({ id: "n-lot", label: "Lot #", type: "text" })}
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button data-close class="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg">${t("cancel")}</button>
        <button data-save class="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">${t("save")}</button>
      </div>`, "max-w-lg");
    dlg.querySelector("[data-close]").addEventListener("click", () => dlg.remove());
    dlg.querySelector("[data-save]").addEventListener("click", async () => {
      const g = (id) => dlg.querySelector(id).value;
      if (!g("#n-name")) return ui.toast("Name required", "warning");
      try {
        await api.post("/inventory", {
          name: g("#n-name"), category: g("#n-cat"), current_stock: Number(g("#n-qty")) || 0,
          minimum_stock: Number(g("#n-min")) || 5, unit_of_measure: g("#n-uom"),
          unit_cost: Number(g("#n-cost")) || 0, selling_price: Number(g("#n-sell")) || 0, lot_number: g("#n-lot"),
        });
        ui.toast(t("save"));
        dlg.remove();
        loadStock();
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
  }

  async function loadStock() {
    const r = await api.get("/inventory");
    const items = r.items || [];
    const tbody = document.getElementById("st-rows");
    const low = items.filter((x) => x.low_stock).length;
    document.getElementById("st-stat").innerHTML = `<span class="text-slate-400">${items.length} ${t("items")}</span> · <span class="text-red-500">${low} low</span>`;
    tbody.innerHTML = items.map((i) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2"><div class="font-medium text-slate-700">${ui.esc(i.name)}</div><div class="text-[11px] text-slate-400">${ui.esc(i.generic_name || "")} ${ui.esc(i.manufacturer || "")}</div></td>
        <td class="px-3 py-2 text-xs uppercase text-slate-400">${ui.esc(i.category)}</td>
        <td class="px-3 py-2 text-center font-semibold">${Number(i.current_stock).toFixed(i.current_stock % 1 ? 1 : 0)} ${ui.esc(i.unit_of_measure || "")}</td>
        <td class="px-3 py-2 text-center text-xs text-slate-400">${Number(i.minimum_stock)}</td>
        <td class="px-3 py-2 text-center">${stockBadge(i)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500">$${Number(i.unit_cost || 0).toFixed(2)} / $${Number(i.selling_price || 0).toFixed(2)}</td>
        <td class="px-3 py-2 text-center text-xs text-slate-400">${ui.esc((i.expiry_date || "").slice(0, 10))}</td>
        <td class="px-3 py-2 text-right"><button data-move="${i.id}" class="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">${t("adjust")}</button></td>
      </tr>`).join("");
    tbody.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => movement(items.find((x) => x.id == b.dataset.move))));
  }

  async function loadMoves() {
    const r = await api.get("/inventory/movements");
    const rows = r.movements || [];
    const tbody = document.getElementById("mv-rows");
    tbody.innerHTML = rows.length ? rows.map((m) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2 font-medium text-slate-700">${ui.esc(m.item_name)}</td>
        <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${m.change_qty >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}">${m.change_qty >= 0 ? "+" : ""}${m.change_qty}</span></td>
        <td class="px-3 py-2 text-xs text-slate-500">${ui.esc(m.reason || "")}</td>
        <td class="px-3 py-2 text-xs text-slate-400">${m.ref_patient_id ? `<a class="text-indigo-500 hover:underline" href="#/patients/${m.ref_patient_id}">${ui.esc((m.name_given_en || "") + " " + (m.name_family_en || ""))}</a>` : "—"}</td>
        <td class="px-3 py-2 text-center font-medium">${ui.esc(Number(m.balance_after || 0))}</td>
        <td class="px-3 py-2 text-xs text-slate-400">${ui.esc(m.user_name || "")}</td>
        <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">${ui.esc((m.created_at || "").slice(0, 16))}</td>
      </tr>`).join("") : `<tr><td colspan="7" class="px-3 py-8 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;
  }

  function render() {
    const tab = InventoryPage.state.tab;
    content.innerHTML = `
      <div class="page">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-bold text-slate-800">📦 ${t("inventory")}</h1>
          <button data-new class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow">＋ ${t("newItem")}</button>
        </div>
        <div class="flex gap-2 mb-4">
          ${[["stock", "📦 " + t("items") + " / Stock"], ["movements", "🔄 " + (t("movements") || "Movements")]].map(([k, label]) => `<button data-tab="${k}" class="px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">${label}</button>`).join("")}
        </div>
        <div id="inv-view"></div>
      </div>`;

    content.querySelector("[data-new]").addEventListener("click", newItem);
    content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      InventoryPage.state.tab = b.dataset.tab;
      render();
    }));

    const view = content.querySelector("#inv-view");
    if (tab === "stock") {
      view.innerHTML = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <div id="st-stat" class="px-4 py-3 border-b border-slate-100 text-sm"></div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th class="px-3 py-2.5">${t("itemName")}</th><th class="px-3 py-2.5">${t("category")}</th><th class="px-3 py-2.5 text-center">${t("stock")}</th><th class="px-3 py-2.5 text-center">${t("minStock")}</th><th class="px-3 py-2.5 text-center">${t("status")}</th><th class="px-3 py-2.5 text-right">${t("costSell")}</th><th class="px-3 py-2.5 text-center">${t("expiry")}</th><th class="px-3 py-2.5 text-right"></th></tr></thead>
          <tbody id="st-rows"></tbody>
        </table></div>`;
      loadStock();
    } else {
      view.innerHTML = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th class="px-3 py-2.5">${t("itemName")}</th><th class="px-3 py-2.5 text-center">${t("change")}</th><th class="px-3 py-2.5">${t("reason")}</th><th class="px-3 py-2.5">${t("patient")}</th><th class="px-3 py-2.5 text-center">${t("balance")}</th><th class="px-3 py-2.5">${t("by")}</th><th class="px-3 py-2.5">${t("when")}</th></tr></thead>
          <tbody id="mv-rows"></tbody>
        </table></div>`;
      loadMoves();
    }
  }

  render();
});
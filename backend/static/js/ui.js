/* ui.js — shared UI helpers: icons, badges, toasts, modals, inputs */
"use strict";
const ui = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const I = {
    dashboard: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v17.25m0 0h-1.5M19.5 17.25v-4.5m0 4.5h-4.5" /></svg>',
    patients: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0112-7.3M18.213 17.25a6.75 6.75 0 013.75 2.25" /></svg>',
    injection: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5a2.25 2.25 0 01-2.25 2.25h-2.25" /></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8" /></svg>',
  };

  const t = (key) => (window.I18N && I18N && I18N[i18n.lang]) ? i18n.t(key) : key;

  function toast(msg, type = "success") {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    const color = type === "error" ? "bg-red-600" : type === "warning" ? "bg-amber-500" : "bg-emerald-600";
    el.className = `flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium ${color} animate-[fade_.2s_ease]`;
    el.innerHTML = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 2800);
  }

  function confirmDlg(message, onOk, { danger = false } = {}) {
    const root = document.getElementById("modal-root");
    const close = () => root.innerHTML = "";
    root.innerHTML = `
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
          <div class="flex items-start gap-3">
            <div class="text-amber-500 mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>
            <p class="text-slate-700 text-sm mt-0.5">${esc(message)}</p>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg" data-act="cancel">${t("cancel")}</button>
            <button class="px-4 py-2 text-sm font-medium text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"} rounded-lg" data-act="ok">${t("confirm")}</button>
          </div>
        </div>
      </div>`;
    root.querySelector('[data-act="ok"]').onclick = () => { close(); onOk && onOk(); };
    root.querySelector('[data-act="cancel"]').onclick = close;
  }

  function openModal(html, { size = "md" } = {}) {
    const root = document.getElementById("modal-root");
    const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
    root.innerHTML = `
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto" data-modal-backdrop>
        <div class="bg-white rounded-xl shadow-2xl ${widths[size]} w-full my-8">
          <div class="sticky top-0 flex justify-between items-center px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <span class="text-sm font-semibold text-slate-700" data-modal-title></span>
            <button class="text-slate-400 hover:text-slate-600" data-close><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div class="p-5" data-modal-body>${html}</div>
        </div>
      </div>`;
    const close = () => root.innerHTML = "";
    root.querySelector("[data-close]").onclick = close;
    const backdrop = root.querySelector("[data-modal-backdrop]");
    backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
    return {
      close,
      remove: close,
      querySelector: (sel) => root.querySelector(sel),
      querySelectorAll: (sel) => root.querySelectorAll(sel),
      setTitle: (s) => { const el = root.querySelector("[data-modal-title]"); if (el) el.textContent = s; },
      body: () => root.querySelector("[data-modal-body]"),
    };
  }

  function badge(text, color = "slate") {
    const map = {
      slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700",
      red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-700",
      blue: "bg-blue-100 text-blue-700", indigo: "bg-indigo-100 text-indigo-700",
      purple: "bg-purple-100 text-purple-700",
    };
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[color] || map.slate}">${esc(text)}</span>`;
  }

  function statusPill(status) {
    const map = {
      paid: ["green", "Paid"], active: ["green", "Active"],
      unpaid: ["red", "Unpaid"], pending: ["amber", "Pending"],
      partial: ["amber", "Partial"], overdue: ["red", "Overdue"],
      scheduled: ["blue", "Scheduled"], completed: ["green", "Completed"],
      confirmed: ["green", "Confirmed"], done: ["green", "Done"],
      cancelled: ["red", "Cancelled"], planned: ["blue", "Planned"],
      resolved: ["slate", "Resolved"], chronic: ["indigo", "Chronic"],
    };
    const m = map[status] || ["slate", status];
    return badge(i18n.lang === "ar" ? (i18n.t("status" + status) || m[1]) : m[1], m[0]);
  }

  function field({ id, label, value = "", type = "text", options = null, placeholder = "", required = false, step = "" }) {
    const v = esc(String(value ?? ""));
    let control;
    if (options && type === "select") {
      const opts = options.map((o) => {
        const [val, lbl] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(value) ? "selected" : ""}>${esc(lbl)}</option>`;
      }).join("");
      control = `<select id="${id}" ${required ? "required" : ""} class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">${opts}</select>`;
    } else if (type === "textarea") {
      control = `<textarea id="${id}" rows="3" placeholder="${esc(placeholder)}" ${required ? "required" : ""} class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">${v}</textarea>`;
    } else {
      control = `<input id="${id}" type="${type}" value="${v}" placeholder="${esc(placeholder)}" step="${step}" ${required ? "required" : ""} class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">`;
    }
    return `<div class="mb-3">
      <label for="${id}" class="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">${esc(label)}</label>
      ${control}
    </div>`;
  }

  // generic form-row builder for grids
  function row(children, cols = 3) {
    const grid = { 2: "sm:grid-cols-2", 2.5: "sm:grid-cols-2 lg:grid-cols-5", 3: "sm:grid-cols-3", 3.5: "sm:grid-cols-3 lg:grid-cols-6", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" };
    return `<div class="grid gap-3 ${grid[cols] || "sm:grid-cols-3"}">${children}</div>`;
  }

  function meter(pct, color = "bg-emerald-500") {
    return `<div class="w-full bg-slate-200 rounded-full h-1.5"><div class="h-1.5 rounded-full ${color}" style="width:${Math.min(100, pct)}%"></div></div>`;
  }

  function avatar(name, color = "bg-indigo-500") {
    const initials = String(name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
    return `<div class="w-9 h-9 rounded-full ${color} text-white flex items-center justify-center text-sm font-semibold shrink-0">${esc(initials)}</div>`;
  }

  const tname = (p) => {
    const useAr = (p.preferred_language || "en") === "ar";
    return useAr ? (p.full_name_ar || p.full_name_en || "—") : (p.full_name_en || p.full_name_ar || "—");
  };

  function printEl(html, { paper = "letter" } = {}) {
    let pa = document.querySelector(".print-area");
    if (!pa) {
      pa = document.createElement("div");
      pa.className = "print-area";
      document.body.appendChild(pa);
    }
    pa.innerHTML = html;
    let st = document.getElementById("rx-page-style");
    if (paper !== "letter") {
      if (!st) {
        st = document.createElement("style");
        st.id = "rx-page-style";
        document.head.appendChild(st);
      }
      const sizes = { a5: "A5 landscape", a4: "A4 portrait" };
      st.textContent = `@page { size: ${sizes[paper] || "A5 landscape"}; margin: 8mm; }`;
    } else if (st) {
      st.textContent = "";
    }
    window.print();
    setTimeout(() => { pa.innerHTML = ""; }, 1000);
  }

  return { esc, I, toast, confirmDlg, openModal, badge, statusPill, field, row, meter, avatar, tname, t, printEl };
})();
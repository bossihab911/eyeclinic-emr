/* app.js — router, layout, and page registry */
"use strict";

const app = (() => {
  const routes = [];
  let currentPath = "";
  let currentCtx = null;

  function navigate(hash) {
    let path = (hash || location.hash || "#/dashboard").replace(/^#/, "") || "/dashboard";
    if (path === "" || path === "/") path = "/dashboard";
    currentPath = path;
    const parts = path.split("/").filter(Boolean);
    const route = routes.find((r) => {
      if (r.path === path) return true;
      return false;
    });
    const template = routes.find((r) => {
      const segs = r.path.split("/").filter(Boolean);
      if (segs.length !== parts.length) return false;
      return segs.every((s, i) => s.startsWith(":") || s === parts[i]);
    });
    renderRoute(template || route, parts);
  }

  function register(path, fn) { routes.push({ path, fn, public: path === "/login" }); }

  async function renderRoute(route, parts) {
    const root = document.getElementById("app");
    const user = api.user();
    if (!user) {
      applyLanguage();
      if (route && route.public) {
        root.innerHTML = "";
        currentCtx = { content: root, params: {}, user: null, navigate };
        try { await route.fn(currentCtx); }
        catch (e) { console.error(e); root.innerHTML = `<div class="p-8 text-center text-red-600 text-sm">Error: ${ui.esc(e.message || e)}</div>`; }
      } else {
        location.hash = "#/login";
      }
      window.scrollTo(0, 0);
      return;
    }
    // build layout shell
    let params = {};
    if (route) {
      const segs = route.path.split("/").filter(Boolean);
      parts.forEach((p, i) => { if (segs[i] && segs[i].startsWith(":")) params[segs[i].slice(1)] = p; });
    }
    applyLanguage();
    root.innerHTML = layout(user, currentPath);
    bindNav(user);
    const content = document.getElementById("page-content");
    currentCtx = { content, params, user, navigate };
    if (route) {
      try {
        await route.fn(currentCtx);
      } catch (e) {
        console.error(e);
        content.innerHTML = `<div class="p-8 text-center text-red-600 text-sm">Error: ${ui.esc(e.message || e)}</div>`;
      }
    } else {
      content.innerHTML = `<div class="p-8 text-center text-slate-500">Page not found</div>`;
    }
    window.scrollTo(0, 0);
  }

  function applyLanguage() {
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir();
  }

  function navItems(user) {
    const perms = user.permissions || {};
    const items = [
      { id: "/dashboard", icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v17.25m0 0h-1.5M19.5 17.25v-4.5m0 4.5h-4.5", label: "dashboard" },
      { id: "/patients", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0112-7.3M18.213 17.25a6.75 6.75 0 013.75 2.25", label: "patients" },
      { id: "/injections", icon: "M19.5 12c0-1.232-.046-2.453-.134-3.662C19.154 5.544 16.708 4 14.25 4h-1.5c-2.458 0-4.904 1.544-5.116 4.338-.088 1.21-.134 2.43-.134 3.662 0 1.232.046 2.453.134 3.662C7.846 18.456 10.292 20 12.75 20h1.5c2.458 0 4.904-1.544 5.116-4.338.088-1.21.134-2.43.134-3.662Z M18.75 9.75v9a2.25 2.25 0 01-2.25 2.25H7.5a2.25 2.25 0 01-2.25-2.25v-9", label: "injections" },
      { id: "/registries", icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v17.25m0 0h-1.5M19.5 17.25v-4.5m0 4.5h-4.5", label: "registries" },
    ];
    if (perms.billing_view || user.role === "billing" || user.role === "admin") {
      items.push({ id: "/billing", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z", label: "billing" });
    }
    items.push({ id: "/inventory", icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z", label: "inventory" });
    items.push({ id: "/reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z", label: "reports" });
    items.push({ id: "/settings", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138.75.43.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z", label: "settings", adminOnly: true });
    return items.filter((it) => !it.adminOnly || user.role === "admin" || user.role === "ophthalmologist");
  }

  function layout(user, path) {
    const items = navItems(user);
    const t = i18n.t.bind(i18n);
    const isDoctor = ["ophthalmologist", "resident", "admin"].includes(user.role);
    const nav = items.map((it) => `
      <a href="#${it.id}" data-nav="${it.id}"
         class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${path.startsWith(it.id) ? "active-nav" : ""}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="${it.icon}" /></svg>
        ${t(it.label)}
      </a>`).join("");
    const names = user.name_en || user.username;
    const dir = i18n.dir();
    const isRtl = dir === "rtl";
    return `
    <div class="flex min-h-screen" dir="${dir}">
      <aside class="hidden md:flex flex-col w-60 bg-white border-e border-slate-200 fixed inset-y-0 start-0 z-30">
        <div class="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <div class="w-9 h-9 rounded-xl overflow-hidden bg-white shadow shrink-0">
            <img src="/static/img/logo.jpg" alt="logo" class="w-9 h-9 object-cover">
          </div>
          <div>
            <div class="text-sm font-bold text-slate-800 leading-tight">${t("appName")}</div>
            <div class="text-[10px] text-slate-400">${t("clinicName")}</div>
          </div>
        </div>
        <nav class="flex-1 px-3 py-3 space-y-1 overflow-y-auto">${nav}</nav>
        <div class="px-3 py-3 border-t border-slate-100">
          <button data-act="lang" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50">
            🌐 ${t("lang")}: <span class="font-bold text-indigo-600">${i18n.lang === "ar" ? t("arabic") : t("english")} ⇄</span>
          </button>
        </div>
      </aside>
      <div class="flex-1 md:ms-60">
        <header class="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button class="md:hidden text-slate-500" data-act="menu">☰</button>
            <div class="relative w-full max-w-xs ${isRtl ? "hidden" : ""}">
              <input id="global-search" placeholder="${ui.esc(t("patientSearch"))}"
                class="w-full bg-slate-100 border border-transparent rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:bg-white focus:border-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
            </div>
          </div>
          <div class="flex items-center gap-3">
            ${isDoctor && path !== "/dashboard" ? `<button data-act="new-encounter" class="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">＋ ${t("newEncounter")}</button>` : ""}
            <div class="text-end hidden sm:block">
              <div class="text-sm font-semibold text-slate-700 leading-tight">${ui.esc(names)}</div>
              <div class="text-xs text-slate-400">${ui.esc(user.role_en || user.role)}</div>
            </div>
            <div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">${ui.esc((names || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase())}</div>
            <button data-act="logout" title="${t("logout")}" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            </button>
          </div>
        </header>
        <main id="page-content" class="p-4 md:p-6 max-w-7xl mx-auto"></main>
      </div>
    </div>`;
  }

  function bindNav(user) {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.addEventListener("click", () => { });
    });
    document.querySelectorAll("[data-act='logout']").forEach((b) => {
      b.onclick = async () => {
        try { await api.request("/logout", { method: "POST", body: {} }); } catch (_) {}
        localStorage.removeItem(api.TOKEN_KEY); localStorage.removeItem(api.USER_KEY);
        location.hash = "#/login";
      };
    });
    document.querySelectorAll("[data-act='lang']").forEach((b) => {
      b.onclick = () => {
        const next = i18n.lang === "ar" ? "en" : "ar";
        i18n.set(next);
        api.setLanguage(next);
        navigate(location.hash);
      };
    });
    document.querySelectorAll("[data-act='new-encounter']").forEach((b) => {
      b.onclick = () => { location.hash = "#/patients"; };
    });
    const gs = document.getElementById("global-search");
    if (gs) {
      let timer;
      gs.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          localStorage.setItem("global_query", gs.value);
          if (currentPath !== "/patients") { location.hash = "#/patients"; }
          else window.dispatchEvent(new CustomEvent("patient-search"));
        }, 350);
      });
      const saved = localStorage.getItem("global_query");
      if (saved) gs.value = saved;
    }
  }

  window.addEventListener("hashchange", () => navigate(location.hash));
  window.appN = navigate;

  return { navigate, register, current: () => currentCtx };
})();

document.addEventListener("DOMContentLoaded", async () => {
  // auto-login via stored token (validated lazily on first API call)
  app.navigate(location.hash);
});
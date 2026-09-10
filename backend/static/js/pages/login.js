/* pages/login.js */
"use strict";
app.register("/login", async (ctx) => {
  const { content } = ctx;
  const t = i18n.t.bind(i18n);
  const isRtl = i18n.dir() === "rtl";
  content.innerHTML = `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4" dir="${i18n.dir()}">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="inline-flex w-28 h-28 rounded-2xl overflow-hidden bg-white shadow-lg shadow-slate-200 mb-4">
          <img src="/static/img/doctor.jpg" alt="Dr. Ihab" class="w-28 h-28 object-cover object-top">
        </div>
        <h1 class="text-2xl font-bold text-slate-800">${t("appName")}</h1>
        <p class="text-slate-500 text-sm mt-1">${t("clinicName")} — ${t("signInToContinue")}</p>
      </div>
      <div class="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6">
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">${t("username")}</label>
            <input id="lf-user" type="text" autocomplete="username" required
              class="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">${t("password")}</label>
            <input id="lf-pass" type="password" autocomplete="current-password" required
              class="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white">
          </div>
          <div id="login-error" class="hidden text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2"></div>
          <button type="submit"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2">
            <span>${t("login")}</span>
          </button>
        </form>
        <div class="mt-5 pt-4 border-t border-slate-100">
          <div class="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2">${t("demo")}</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button data-demo="admin|admin123" class="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300">
              <div class="font-bold text-slate-700">Admin</div><div class="text-slate-400">admin / admin123</div>
            </button>
            <button data-demo="dr.karim|demo123" class="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300">
              <div class="font-bold text-slate-700">Ophthalmologist</div><div class="text-slate-400">dr.karim / demo123</div>
            </button>
            <button data-demo="b.sara|demo123" class="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300">
              <div class="font-bold text-slate-700">Billing</div><div class="text-slate-400">b.sara / demo123</div>
            </button>
            <button data-demo="r.rana|demo123" class="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300">
              <div class="font-bold text-slate-700">Reception</div><div class="text-slate-400">r.rana / demo123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const errBox = content.querySelector("#login-error");
  const doLogin = async (u, p) => {
    errBox.classList.add("hidden");
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "login failed");
      localStorage.setItem(api.TOKEN_KEY, data.token);
      localStorage.setItem(api.USER_KEY, JSON.stringify(data.user));
      location.hash = "#/dashboard";
    } catch (e) {
      errBox.textContent = e.message === "login failed" ? "Invalid username or password" : "Network error — is the server running?";
      errBox.classList.remove("hidden");
    }
  };
  content.querySelector("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin(content.querySelector("#lf-user").value.trim(), content.querySelector("#lf-pass").value);
  });
  content.querySelectorAll("[data-demo]").forEach((b) => {
    b.addEventListener("click", () => {
      const [u, p] = b.dataset.demo.split("|");
      doLogin(u, p);
    });
  });
});
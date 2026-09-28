/* pages/settings.js — settings + audit log (admin) */
"use strict";
const SettingsPage = { state: { tab: "audit" } };

app.register("/settings", async () => {
  const t = i18n.t.bind(i18n);
  const content = document.getElementById("page-content");
  const user = JSON.parse(localStorage.getItem("ophthalmo_user") || "{}");
  const isAdmin = user.role === "admin" || Object.keys(user.permissions || {}).includes("admin:audit");

  function render() {
    const tab = SettingsPage.state.tab;
    const tabs = [["profile", "👤 Profile"], ["audit", "🕵️ " + (t("auditLog") || "Audit log")]];
    if (isAdmin) tabs.push(["backup", "☁️ Backup"]);
    content.innerHTML = `
      <div class="page">
        <h1 class="text-lg font-bold text-slate-800 mb-4">⚙️ ${t("settings")}</h1>
        <div class="flex gap-2 mb-4">
          ${tabs.map(([k, label]) => `<button data-tab="${k}" class="px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50"}">${label}</button>`).join("")}
        </div>
        <div id="set-view"></div>
      </div>`;
    content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      SettingsPage.state.tab = b.dataset.tab;
      render();
    }));
    const view = content.querySelector("#set-view");
    if (tab === "profile") profile(view);
    else if (tab === "backup") backup(view);
    else audit(view);
  }

  async function backup(view) {
    if (!isAdmin) {
      view.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">🔒 Admin only — ${t("forbidden") || "forbidden"}</div>`;
      return;
    }
    view.innerHTML = `<div class="max-w-xl bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 class="text-sm font-bold text-slate-700 mb-1">📦 Dropbox backup (recommended)</h3>
      <p class="text-xs text-slate-400 mb-3">Simplest cloud backup — 1 token, auto every 24h.</p>
      <div id="db-box" class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-600">Checking Dropbox…</div>
      <div class="flex gap-2 mb-4 flex-wrap">
        <button data-db-bk class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg">📦 Upload to Dropbox now</button>
        <span id="db-status" class="text-xs text-slate-400 self-center"></span>
      </div>
      <h3 class="text-sm font-bold text-slate-700 mb-1">☁️ Google Drive backup</h3>
      <p class="text-xs text-slate-400 mb-3">Alternative. Needs OAuth keys.</p>
      <div id="cloud-box" class="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-600">Checking Drive link…</div>
      <div class="flex gap-2 mb-3 flex-wrap">
        <button data-cloud-bk class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">☁️ Upload to Drive now</button>
        <a data-dl-bk href="#/settings" class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg">⬇ Download .zip</a>
        <span id="cloud-status" class="text-xs text-slate-400 self-center"></span>
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-500 mb-4"><input type="checkbox" id="cloud-auto" checked> Auto-upload to cloud daily</label>
      <h3 class="text-sm font-bold text-slate-700 mb-1">💻 Local folder backup (clinic PC only)</h3>
      <p class="text-xs text-slate-400 mb-4">Point the folder to your local Google Drive sync folder (e.g. C:\\Users\\you\\My Drive\\EMR Backup). The app writes a timestamped .zip there; Drive syncs it to the cloud. Auto backup runs daily.</p>
      <label class="block text-xs font-semibold text-slate-500 mb-1">Backup folder path</label>
      <div class="flex gap-2 mb-3">
        <input id="bk-folder" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="C:\\Users\\you\\My Drive\\EMR Backup">
        <button data-save-bk class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">Save</button>
      </div>
      <div class="flex gap-2 mb-3">
        <button data-run-bk class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg">⬇ Backup now</button>
        <span id="bk-status" class="text-xs text-slate-400 self-center"></span>
      </div>
      <div id="bk-info" class="text-xs text-slate-400"></div>
      <div class="mt-6 pt-4 border-t border-slate-200">
        <h4 class="text-xs font-bold text-slate-600 mb-1">♻️ Restore backup</h4>
        <p class="text-xs text-slate-400 mb-2">Select a .zip backup file to restore. This will overwrite current data.</p>
        <div class="flex gap-2 items-center flex-wrap">
          <input type="file" id="bk-restore-file" accept=".zip" class="text-xs">
          <button data-restore-bk class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg">Restore</button>
          <span id="bk-restore-status" class="text-xs text-slate-400"></span>
        </div>
      </div>
    </div>`;
    const inp = view.querySelector("#bk-folder");
    const info = view.querySelector("#bk-info");
    const status = view.querySelector("#bk-status");
    const cloudBox = view.querySelector("#cloud-box");
    const cloudStatus = view.querySelector("#cloud-status");
    const cloudAuto = view.querySelector("#cloud-auto");
    const dlBtn = view.querySelector("[data-dl-bk]");
    const dbBox = view.querySelector("#db-box");
    const dbStatus = view.querySelector("#db-status");
    try {
      const cc = await api.get("/settings/cloud-backup");
      cloudAuto.checked = cc.auto_cloud_backup !== false;
      const db = cc.dropbox || {};
      if (db.configured) {
        dbBox.innerHTML = `✅ Linked → <b>${ui.esc(db.folder || "/EMR Backup")}</b> · Last: ${ui.esc(cc.last_dropbox_backup || cc.last_cloud_backup || "—")} ${ui.esc(cc.last_dropbox_file || "")}`;
      } else {
        dbBox.innerHTML = `❌ Not linked — set <b>DROPBOX_APP_KEY / SECRET / REFRESH_TOKEN</b> in Render → Environment.`;
      }
      const drv = cc.drive || cc;
      if (drv.configured) {
        cloudBox.innerHTML = `✅ Linked${drv.service_email ? " as <b>" + ui.esc(drv.service_email) + "</b>" : ""} · Last upload: ${ui.esc(cc.last_cloud_backup || "—")} ${cc.last_cloud_link ? `· <a class="text-blue-600 underline" target="_blank" href="${ui.esc(cc.last_cloud_link)}">open in Drive</a>` : ""}`;
      } else {
        cloudBox.innerHTML = `❌ Drive not linked — ${ui.esc(drv.error || "use Dropbox above (simpler)")}`;
      }
    } catch (e) { cloudBox.textContent = "Drive status: " + e.message; dbBox.textContent = "Dropbox: " + e.message; }
    view.querySelector("[data-db-bk]").addEventListener("click", async () => {
      dbStatus.textContent = "Uploading…";
      try {
        const r = await api.request("/backup/cloud?provider=dropbox", { method: "POST", body: { provider: "dropbox" } });
        dbStatus.textContent = "Done: " + (r.name || r.path || "");
        ui.toast("Uploaded to Dropbox ✓", "success");
        const cc = await api.get("/settings/cloud-backup");
        dbBox.innerHTML = `✅ Linked · Last: ${ui.esc(cc.last_dropbox_backup || "")} ${ui.esc(cc.last_dropbox_file || "")}`;
      } catch (e) { dbStatus.textContent = ""; ui.toast(ui.esc(e.message || "upload failed"), "error"); }
    });
    cloudAuto.addEventListener("change", async () => {
      try { await api.request("/settings/cloud-backup", { method: "POST", body: { auto_cloud_backup: cloudAuto.checked } }); ui.toast("Saved ✓", "success"); }
      catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
    view.querySelector("[data-cloud-bk]").addEventListener("click", async () => {
      cloudStatus.textContent = "Uploading…";
      try {
        const r = await api.request("/backup/cloud", { method: "POST", body: {} });
        cloudStatus.innerHTML = `Done: ${ui.esc(r.name || "")} <a class="text-blue-600 underline" target="_blank" href="${ui.esc(r.link || "")}">open</a>`;
        ui.toast("Uploaded to Drive ✓", "success");
      } catch (e) { cloudStatus.textContent = ""; ui.toast(ui.esc(e.message || "upload failed"), "error"); }
    });
    dlBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const token = localStorage.getItem("ophthalmo_token") || "";
      window.open("/api/backup/download?token=" + encodeURIComponent(token), "_blank");
    });
    try {
      const cfg = await api.get("/settings/backup");
      inp.value = cfg.backup_folder || "";
      const lb = cfg.last_backup ? `Last: ${cfg.last_backup} · ${cfg.last_backup_file || ""}` : "No backup yet";
      info.textContent = lb + (cfg.backup_folder ? ` · Folder: ${cfg.backup_folder}` : "");
    } catch (e) { info.textContent = e.message; }
    view.querySelector("[data-save-bk]").addEventListener("click", async () => {
      try {
        await api.request("/settings/backup", { method: "POST", body: { backup_folder: inp.value.trim() } });
        ui.toast("Saved ✓", "success");
        const cfg = await api.get("/settings/backup");
        info.textContent = `Last: ${cfg.last_backup || "—"} · Folder: ${cfg.backup_folder || ""}`;
      } catch (e) { ui.toast(ui.esc(e.message), "error"); }
    });
    view.querySelector("[data-run-bk]").addEventListener("click", async () => {
      status.textContent = "Backing up…";
      try {
        const r = await api.request("/backup/run", { method: "POST", body: {} });
        status.textContent = "Done: " + r.file;
        ui.toast("Backup saved: " + r.file, "success");
        const cfg = await api.get("/settings/backup");
        info.textContent = `Last: ${cfg.last_backup} · ${cfg.last_backup_file || ""} · Folder: ${cfg.backup_folder || ""}`;
      } catch (e) { status.textContent = ""; ui.toast(ui.esc(e.message || "backup failed"), "error"); }
    });
    view.querySelector("[data-restore-bk]").addEventListener("click", async () => {
      const inpFile = view.querySelector("#bk-restore-file");
      const rs = view.querySelector("#bk-restore-status");
      if (!inpFile.files[0]) return ui.toast("Select a .zip file", "warning");
      if (!confirm("Restore will overwrite current database and photos. Continue?")) return;
      rs.textContent = "Restoring…";
      try {
        const fd = new FormData(); fd.append("file", inpFile.files[0]);
        await api.upload("/backup/restore", fd);
        rs.textContent = "Done — reloading";
        ui.toast("Restored ✓", "success");
        setTimeout(() => location.reload(), 1200);
      } catch (e) { rs.textContent = ""; ui.toast(ui.esc(e.message || "restore failed"), "error"); }
    });
  }

  function profile(view) {
    const u = JSON.parse(localStorage.getItem("ophthalmo_user") || "{}");
    view.innerHTML = `
      <div class="max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">${ui.esc(((u.name_en || "U").charAt(0) || "").toUpperCase())}</div>
          <div><div class="text-lg font-bold text-slate-800">${ui.esc(u.name_en || "")}</div>
          <div class="text-xs text-slate-400">${ui.esc(u.name_ar || "")} · ${(i18n.lang === "ar" ? u.role_ar : u.role_en) || u.role}</div></div>
        </div>
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between border-b border-slate-50 py-1.5"><span class="text-slate-400">Username</span><span class="font-medium">${ui.esc(u.username || "")}</span></div>
          <div class="flex justify-between border-b border-slate-50 py-1.5"><span class="text-slate-400">Role</span><span class="font-medium">${ui.esc(u.role || "")}</span></div>
          <div class="flex justify-between border-b border-slate-50 py-1.5"><span class="text-slate-400">Permissions</span><span class="text-xs text-slate-500 w-56 text-right">${Object.keys(u.permissions || {}).join(", ") || "—"}</span></div>
        </div>
        <button data-logout class="mt-6 w-full px-4 py-2 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg">🚪 ${t("logout")}</button>
      </div>`;
    view.querySelector("[data-logout]").addEventListener("click", async () => {
      try { await api.post("/logout"); } catch (_) {}
      localStorage.removeItem("ophthalmo_token");
      localStorage.removeItem("ophthalmo_user");
      location.hash = "#/login";
    });
  }

  async function audit(view) {
    if (!isAdmin) {
      view.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">🔒 Admin only — ${t("forbidden") || "forbidden"}</div>`;
      return;
    }
    view.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th class="px-3 py-2.5">When</th><th class="px-3 py-2.5">User</th><th class="px-3 py-2.5">Action</th><th class="px-3 py-2.5">Resource</th><th class="px-3 py-2.5 text-right">ID</th><th class="px-3 py-2.5">Details</th></tr></thead>
        <tbody id="audit-rows"><tr><td colspan="6" class="px-3 py-8 text-center text-slate-400 text-sm">Loading…</td></tr></tbody>
      </table></div>`;
    const r = await api.get("/audit");
    const rows = r.audits || [];
    document.getElementById("audit-rows").innerHTML = rows.length ? rows.map((a) => `
      <tr class="hover:bg-slate-50">
        <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">${ui.esc((a.ts || "").slice(0, 16))}</td>
        <td class="px-3 py-2 text-xs">${ui.esc(a.user_name || a.username || "—")}</td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${["view", "login", "logout"].includes(a.action) ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"}">${ui.esc(a.action)}</span></td>
        <td class="px-3 py-2 text-xs text-slate-500">${ui.esc(a.resource || "")}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-400">${a.resource_id || "—"}</td>
        <td class="px-3 py-2 text-xs text-slate-400 max-w-[240px] truncate">${ui.esc(a.details || "")}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="px-3 py-8 text-center text-slate-400 text-sm">${t("noData")}</td></tr>`;
  }

  render();
});
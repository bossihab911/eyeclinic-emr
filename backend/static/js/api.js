/* api.js — fetch wrapper with token auth */
"use strict";
const api = (() => {
  const TOKEN_KEY = "ophthalmo_token";
  const USER_KEY = "ophthalmo_user";
  const LANG_KEY = "lang";

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function user() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (_) { return null; } }
  function lang() { return localStorage.getItem(LANG_KEY) || "en"; }
  function setLanguage(l) { localStorage.setItem(LANG_KEY, l); }

  function headers(json = true) {
    const h = {};
    if (json) h["Content-Type"] = "application/json";
    const t = token();
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }

  async function request(path, { method = "GET", body = null } = {}) {
    const opts = { method, headers: headers(body !== null) };
    if (body !== null) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch("/api" + path, opts);
    } catch (e) {
      throw { code: "network", message: "Network error — is the server running?" };
    }
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      location.hash = "#/login";
      throw { code: "unauthorized" };
    }
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Convenience
  const get = (p) => request(p);
  const post = (p, b) => request(p, { method: "POST", body: b || {} });
  const put = (p, b) => request(p, { method: "PUT", body: b || {} });

  const del = (p) => request(p, { method: "DELETE" });

  async function upload(path, formData) {
    const h = {};
    const t = token();
    if (t) h["Authorization"] = "Bearer " + t;
    let res;
    try {
      res = await fetch("/api" + path, { method: "POST", headers: h, body: formData });
    } catch (e) {
      throw { code: "network", message: "Network error — is the server running?" };
    }
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      location.hash = "#/login";
      throw { code: "unauthorized" };
    }
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return { token, user, lang, setLanguage, request, get, post, put, del, upload, TOKEN_KEY, USER_KEY };
})();
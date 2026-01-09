function getSiteRoot() {
  // Works on GitHub Pages repo path + /admin/
  let p = window.location.pathname;

  // If you're in /admin or /admin/...
  if (p.includes("/admin")) {
    p = p.split("/admin")[0] + "/"; // keep "/repo/" if present
  } else {
    // otherwise keep current folder
    p = p.endsWith("/") ? p : p.replace(/[^/]*$/, "");
  }
  return window.location.origin + p;
}

const BASE_URL = getSiteRoot() + "content.json";
const LS_OVERRIDE_KEY = "derm_site_override_v1";
const LS_ADMIN_SESSION = "derm_admin_session_v1";

let BASE = null;        // base content.json
let OVERRIDE = {};      // overrides only
let EDIT_LANG = "sq";   // sq/en

const $ = (s) => document.querySelector(s);

function nowMs() { return Date.now(); }

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

function deepMerge(base, override) {
  if (!override) return base;
  if (Array.isArray(base) && Array.isArray(override)) return override;
  if (typeof base === "object" && base && typeof override === "object" && override) {
    const out = { ...base };
    for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k]);
    return out;
  }
  return override;
}

function getAtPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

function setAtPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem(LS_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides() {
  localStorage.setItem(LS_OVERRIDE_KEY, JSON.stringify(OVERRIDE));
  renderRaw();
  setStatus("Saved to this device", "ok");
}

function clearOverrides() {
  localStorage.removeItem(LS_OVERRIDE_KEY);
  OVERRIDE = {};
  setStatus("Cleared overrides", "warn");
  hydrateAllInputs();
  renderDynamicEditors();
  renderRaw();
}

function setStatus(text, kind = "ok") {
  const el = $("#statusText");
  if (!el) return;
  el.textContent = text;
  el.className = kind;
}

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function setSession(minutes) {
  const expiresAt = nowMs() + minutes * 60 * 1000;
  localStorage.setItem(LS_ADMIN_SESSION, JSON.stringify({ expiresAt }));
}

function hasValidSession() {
  try {
    const raw = localStorage.getItem(LS_ADMIN_SESSION);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s.expiresAt && nowMs() < s.expiresAt;
  } catch {
    return false;
  }
}

function logout() {
  localStorage.removeItem(LS_ADMIN_SESSION);
  $("#editorView")?.classList.add("hidden");
  $("#loginView")?.classList.remove("hidden");
  setStatus("Logged out", "warn");
}

function resolvePath(templatePath) {
  return templatePath.replace("{lang}", EDIT_LANG);
}

function readWorkingValue(path) {
  // value comes from merged view: BASE + OVERRIDE
  const merged = deepMerge(deepClone(BASE), OVERRIDE);
  return getAtPath(merged, path);
}

function bindInputs() {
  document.querySelectorAll("[data-path]").forEach((el) => {
    const rawPath = el.getAttribute("data-path");
    const path = resolvePath(rawPath);

    // Set initial value
    const val = readWorkingValue(path);
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = val ?? "";
    }

    // On change, write override
    el.addEventListener("input", () => {
      const p = resolvePath(rawPath);
      setAtPath(OVERRIDE, p, el.value);
      renderRaw();
      setStatus("Editing…", "warn");
    });
  });
}

function hydrateAllInputs() {
  document.querySelectorAll("[data-path]").forEach((el) => {
    const rawPath = el.getAttribute("data-path");
    const path = resolvePath(rawPath);
    const val = readWorkingValue(path);
    el.value = val ?? "";
  });
}

function renderRaw() {
  const pre = $("#rawOut");
  if (!pre) return;
  pre.textContent = JSON.stringify(OVERRIDE, null, 2);
}

function renderDynamicEditors() {
  renderArrayEditor({
    mountId: "servicesEditor",
    arrayPath: `i18n.${EDIT_LANG}.services.items`,
    fields: [
      { k: "title", label: "Title", type: "input" },
      { k: "subtitle", label: "Subtitle", type: "input" },
      { k: "iconKey", label: "Icon key (shield/laser/skin)", type: "input" },
      { k: "bullets", label: "Bullets (one per line)", type: "textarea-lines" }
    ]
  });

  renderArrayEditor({
    mountId: "doctorsEditor",
    arrayPath: `i18n.${EDIT_LANG}.doctors.items`,
    fields: [
      { k: "name", label: "Name", type: "input" },
      { k: "role", label: "Role", type: "input" },
      { k: "photoKey", label: "Photo key (doc1/doc2…)", type: "input" },
      { k: "bio", label: "Bio", type: "input" },
      { k: "badges", label: "Badges (one per line)", type: "textarea-lines" }
    ]
  });

  renderArrayEditor({
    mountId: "testimonialsEditor",
    arrayPath: `i18n.${EDIT_LANG}.testimonials.items`,
    fields: [
      { k: "name", label: "Name", type: "input" },
      { k: "text", label: "Text", type: "input" },
      { k: "stars", label: "Stars (1–5)", type: "input" }
    ]
  });

  renderArrayEditor({
    mountId: "resultsEditor",
    arrayPath: `i18n.${EDIT_LANG}.results.items`,
    fields: [
      { k: "title", label: "Title", type: "input" },
      { k: "subtitle", label: "Subtitle", type: "input" },
      { k: "photoKey", label: "Photo key (res1/res2…)", type: "input" }
    ]
  });
}

function renderArrayEditor({ mountId, arrayPath, fields }) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = "";

  const merged = deepMerge(deepClone(BASE), OVERRIDE);
  const arr = getAtPath(merged, arrayPath) || [];

  arr.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "row";

    fields.forEach((f) => {
      const box = document.createElement("label");
      box.className = "field";

      const label = document.createElement("span");
      label.textContent = f.label;

      const keyPath = `${arrayPath}.${idx}.${f.k}`;

      let control;
      if (f.type === "textarea-lines") {
        control = document.createElement("textarea");
        const val = getAtPath(merged, keyPath);
        control.value = Array.isArray(val) ? val.join("\n") : (val ?? "");
        control.rows = 2;
        control.addEventListener("input", () => {
          const lines = control.value.split("\n").map(s => s.trim()).filter(Boolean);
          setAtPath(OVERRIDE, keyPath, lines);
          renderRaw();
          setStatus("Editing…", "warn");
        });
      } else {
        control = document.createElement("input");
        const val = getAtPath(merged, keyPath);
        control.value = val ?? "";
        control.addEventListener("input", () => {
          setAtPath(OVERRIDE, keyPath, control.value);
          renderRaw();
          setStatus("Editing…", "warn");
        });
      }

      box.appendChild(label);
      box.appendChild(control);
      row.appendChild(box);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn ghost";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const merged2 = deepMerge(deepClone(BASE), OVERRIDE);
      const arr2 = getAtPath(merged2, arrayPath) || [];
      arr2.splice(idx, 1);
      setAtPath(OVERRIDE, arrayPath, arr2);
      renderDynamicEditors();
      renderRaw();
      setStatus("Item deleted", "warn");
    });

    row.appendChild(delBtn);
    mount.appendChild(row);
  });
}

function addArrayItem(arrayPath, itemTemplate) {
  const merged = deepMerge(deepClone(BASE), OVERRIDE);
  const arr = getAtPath(merged, arrayPath) || [];
  arr.push(itemTemplate);
  setAtPath(OVERRIDE, arrayPath, arr);
  renderDynamicEditors();
  renderRaw();
  setStatus("Item added", "warn");
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function boot() {
  // load base
  const res = await fetch(BASE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load content.json");
  BASE = await res.json();

  OVERRIDE = loadOverrides();

  // session-based view
  const loggedIn = hasValidSession();
  $("#loginView")?.classList.toggle("hidden", loggedIn);
  $("#editorView")?.classList.toggle("hidden", !loggedIn);

  // buttons
  $("#logoutBtn")?.addEventListener("click", logout);

  $("#langSq")?.addEventListener("click", () => {
    EDIT_LANG = "sq";
    $("#langSq").classList.add("primary"); $("#langSq").classList.remove("ghost");
    $("#langEn").classList.add("ghost"); $("#langEn").classList.remove("primary");
    hydrateAllInputs();
    renderDynamicEditors();
    bindInputs(); // re-bind on new lang
    setStatus("Language: SQ", "ok");
  });

  $("#langEn")?.addEventListener("click", () => {
    EDIT_LANG = "en";
    $("#langEn").classList.add("primary"); $("#langEn").classList.remove("ghost");
    $("#langSq").classList.add("ghost"); $("#langSq").classList.remove("primary");
    hydrateAllInputs();
    renderDynamicEditors();
    bindInputs();
    setStatus("Language: EN", "ok");
  });

  $("#saveBtn")?.addEventListener("click", saveOverrides);
  $("#clearBtn")?.addEventListener("click", clearOverrides);
  $("#exportBtn")?.addEventListener("click", () => {
    const merged = deepMerge(deepClone(BASE), OVERRIDE);
    downloadJson("content.json", merged);
    setStatus("Exported content.json", "ok");
  });

  // add item buttons
  $("#addServiceBtn")?.addEventListener("click", () => addArrayItem(
    `i18n.${EDIT_LANG}.services.items`,
    { title: "New service", subtitle: "", iconKey: "shield", bullets: [] }
  ));
  $("#addDoctorBtn")?.addEventListener("click", () => addArrayItem(
    `i18n.${EDIT_LANG}.doctors.items`,
    { name: "New doctor", role: "", photoKey: "doc1", bio: "", badges: [] }
  ));
  $("#addTestBtn")?.addEventListener("click", () => addArrayItem(
    `i18n.${EDIT_LANG}.testimonials.items`,
    { name: "Initials", text: "", stars: 5 }
  ));
  $("#addResultBtn")?.addEventListener("click", () => addArrayItem(
    `i18n.${EDIT_LANG}.results.items`,
    { title: "New result", subtitle: "", photoKey: "res1" }
  ));

  // login
  $("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginError").textContent = "";

    const pass = $("#passwordInput").value || "";
    const passHash = await sha256Hex(pass);

    const expected = BASE?.meta?.admin?.passwordSha256;
    const mins = Number(BASE?.meta?.admin?.sessionMinutes || 60);

    if (expected && passHash === expected) {
      setSession(mins);
      $("#passwordInput").value = "";
      $("#loginView").classList.add("hidden");
      $("#editorView").classList.remove("hidden");
      setStatus("Logged in", "ok");
      hydrateAllInputs();
      renderDynamicEditors();
      bindInputs();
      renderRaw();
      return;
    }

    $("#loginError").textContent = "Wrong password.";
  });

  // password hash generator helper
  $("#genHashBtn")?.addEventListener("click", async () => {
    const v = $("#newPass").value || "";
    const h = await sha256Hex(v);
    $("#hashOut").textContent =
      `SHA-256:\n${h}\n\nPut this into content.json:\n"passwordSha256": "${h}"`;
  });

  // initial render
  hydrateAllInputs();
  renderDynamicEditors();
  bindInputs();
  renderRaw();
}

boot().catch((err) => {
  console.error(err);
  alert("Admin failed to load content.json. Make sure the site is served over HTTP.");
});

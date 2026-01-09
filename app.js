let SITE = null;
let lang = "sq";
const LS_OVERRIDE_KEY = "derm_site_override_v1";
const $ = (sel) => document.querySelector(sel);

function deepMerge(base, override) {
  if (!override) return base;
  if (Array.isArray(base) && Array.isArray(override)) return override; // override arrays fully
  if (typeof base === "object" && base && typeof override === "object" && override) {
    const out = { ...base };
    for (const k of Object.keys(override)) {
      out[k] = deepMerge(base[k], override[k]);
    }
    return out;
  }
  return override;
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem(LS_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

function setText(id, value) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.textContent = value ?? "";
}

function setImg(id, dataUri, alt = "") {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.src = dataUri || "";
  if (alt) el.alt = alt;
}

function setHref(id, href) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.href = href || "#";
}

function applyI18n() {
  const dict = SITE.i18n[lang];
  document.documentElement.lang = lang;

  // Basic brand
  setText("#clinicName", dict.clinicName);
  setText("#clinicTagline", dict.clinicTagline);
  setText("#footerName", dict.clinicName);

  // Hero text
  setText("#heroTitle", dict.hero.title);
  setText("#heroSubtitle", dict.hero.subtitle);
  setText("#heroQuickText", dict.hero.quickText);

  const highlights = dict.hero.highlights || [];
  setText("#highlight1", highlights[0] || "");
  setText("#highlight2", highlights[1] || "");
  setText("#highlight3", highlights[2] || "");

  // Trust
  setText("#trust1", dict.trust.item1.v);
  setText("#trust2", dict.trust.item2.v);
  setText("#trust3", dict.trust.item3.v);

  // Section intros
  setText("#servicesIntro", dict.services.intro);
  setText("#doctorsIntro", dict.doctors.intro);
  setText("#resultsIntro", dict.results.intro);
  setText("#testimonialsIntro", dict.testimonials.intro);
  setText("#contactIntro", dict.contact.intro);

  // Footer legal
  const year = new Date().getFullYear();
  setText("#footerLegal", (dict.footer.legal || "").replace("{year}", String(year)));

  // Static i18n nodes
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = getByPath(dict, key);
    if (typeof val === "string") el.textContent = val;
  });

  // Contact labels + values
  const c = SITE.contact;
  setText("#hoursShort", c.hoursShort);
  setText("#locationShort", c.locationShort);

  setText("#addressText", c.address);
  setText("#hoursText", c.hours);

  setText("#phoneLink", c.phone);
  setHref("#phoneLink", `tel:${c.phone.replace(/\s+/g, "")}`);

  setText("#emailLink", c.email);
  setHref("#emailLink", `mailto:${c.email}`);

  setHref("#mapsCta", c.mapsUrl);
  setHref("#emailCta", `mailto:${c.email}?subject=${encodeURIComponent(dict.cta.emailUs)}&body=${encodeURIComponent("Hello!")}`);

  // CTAs
  setHref("#callCta", `tel:${c.phone.replace(/\s+/g, "")}`);
  setHref("#whatsAppCta", `https://wa.me/${c.whatsappNumber}`);

  // Map
  const mapFrame = $("#mapFrame");
  if (mapFrame) mapFrame.src = c.mapEmbedUrl;

  // Form note
  setText("#formNote", dict.form.note);

  renderServices();
  renderDoctors();
  renderResults();
  renderTestimonials();
  populateServiceSelect();
}

function renderServices() {
  const dict = SITE.i18n[lang];
  const grid = $("#servicesGrid");
  if (!grid) return;

  grid.innerHTML = "";
  (dict.services.items || []).forEach((svc) => {
    const icon = SITE.assets.icons[svc.iconKey];
    const card = document.createElement("div");
    card.className = "card card-pad";
    card.innerHTML = `
      <div class="service-icon"><img alt="" src="${icon || ""}"></div>
      <div class="card-title">${escapeHtml(svc.title)}</div>
      <div class="card-text">${escapeHtml(svc.subtitle)}</div>
      <ul class="bullets">
        ${(svc.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
      </ul>
    `;
    grid.appendChild(card);
  });
}

function renderDoctors() {
  const dict = SITE.i18n[lang];
  const grid = $("#doctorsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  (dict.doctors.items || []).forEach((doc) => {
    const photo = SITE.assets.doctorPhotos[doc.photoKey];
    const card = document.createElement("div");
    card.className = "card card-pad";
    card.innerHTML = `
      <div class="doctor-top">
        <img class="avatar" alt="${escapeHtml(doc.name)}" src="${photo || ""}">
        <div>
          <div class="doctor-name">${escapeHtml(doc.name)}</div>
          <div class="doctor-role">${escapeHtml(doc.role)}</div>
        </div>
      </div>
      <div class="card-text">${escapeHtml(doc.bio)}</div>
      <div class="badges">
        ${(doc.badges || []).map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("")}
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderResults() {
  const dict = SITE.i18n[lang];
  const grid = $("#resultsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  (dict.results.items || []).forEach((it) => {
    const photo = SITE.assets.resultPhotos[it.photoKey];
    const wrap = document.createElement("div");
    wrap.className = "gallery-item";
    wrap.innerHTML = `
      <img alt="${escapeHtml(it.title)}" src="${photo || ""}">
      <div class="gallery-caption">
        <div class="t">${escapeHtml(it.title)}</div>
        <div class="s">${escapeHtml(it.subtitle)}</div>
      </div>
    `;
    grid.appendChild(wrap);
  });
}

function renderTestimonials() {
  const dict = SITE.i18n[lang];
  const grid = $("#testimonialsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  (dict.testimonials.items || []).forEach((t) => {
    const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, Number(t.stars || 5))));
    const card = document.createElement("div");
    card.className = "card card-pad";
    card.innerHTML = `
      <div class="card-title">${escapeHtml(t.name)}</div>
      <div class="quote">“${escapeHtml(t.text)}”</div>
      <div class="stars" aria-label="${escapeHtml(String(t.stars))} stars">${stars}</div>
    `;
    grid.appendChild(card);
  });
}

function populateServiceSelect() {
  const dict = SITE.i18n[lang];
  const select = $("#serviceSelect");
  if (!select) return;

  select.innerHTML = "";
  (dict.services.items || []).forEach((svc) => {
    const opt = document.createElement("option");
    opt.value = svc.title;
    opt.textContent = svc.title;
    select.appendChild(opt);
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
async function init() {
  const res = await fetch("/content.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load content.json");
  const base = await res.json();

  const overrides = loadOverrides();
  SITE = deepMerge(base, overrides);

  lang = SITE?.meta?.defaultLang || "sq";

  // Set shared images
  setImg("#brandLogo", SITE.assets.logo, "Clinic logo");
  setImg("#footerLogo", SITE.assets.logo, "Clinic logo");
  setImg("#heroImage", SITE.assets.heroImage, "Clinic hero");

  // Wire language toggle
  $("#langToggle")?.addEventListener("click", () => {
    lang = (lang === "sq") ? "en" : "sq";
    applyI18n();
  });

  // Appointment form mailto (same as before)
  $("#appointmentForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const dict = SITE.i18n[lang];
    const c = SITE.contact;

    const fd = new FormData(e.target);
    const name = fd.get("name");
    const phone = fd.get("phone");
    const service = fd.get("service");
    const message = fd.get("message");

    const subject = lang === "sq" ? "Kërkesë për rezervim" : "Appointment request";
    const bodyLines = [
      `${dict.form.name}: ${name}`,
      `${dict.form.phone}: ${phone}`,
      `${dict.form.service}: ${service}`,
      `${dict.form.message}:`,
      `${message}`,
      "",
      "—",
      lang === "sq" ? "Dërguar nga faqja e klinikës" : "Sent from clinic website"
    ];

    const mailto = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailto;
  });

  applyI18n();
}

init().catch((err) => {
  console.error(err);
  alert("Could not load site content. Make sure content.json exists and you're serving via HTTP.");
});
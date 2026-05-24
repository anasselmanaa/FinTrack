// FinTrack marketing-page i18n
// ----------------------------
// Loaded by every public page (landing, features, trial, etc.). Reads
// data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-aria
// attributes and swaps them per the user's chosen language. Persists the
// choice in localStorage under "fintrack.lang" — same key the in-app i18n
// uses, so once the user logs in, their preference carries over.
//
// Translations live in window.MARKETING_I18N — populated per page by a
// small inline <script> block (so each page only ships the strings it
// uses, keeping the bundle tiny).

(function () {
  const SUPPORTED = ["en", "fr", "es"];
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "fintrack.lang";
  const LANG_NAMES = { en: "English", fr: "Français", es: "Español" };
  const LANG_SHORT = { en: "EN", fr: "FR", es: "ES" };

  function detectLang() {
    let saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_e) {}
    if (saved && SUPPORTED.includes(saved)) return saved;

    const urlParam = new URLSearchParams(window.location.search).get("lang");
    if (urlParam && SUPPORTED.includes(urlParam.toLowerCase())) return urlParam.toLowerCase();

    const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(browser)) return browser;

    return DEFAULT_LANG;
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_e) {}
  }

  // Cache the original English text so switching back to English restores
  // even when the HTML has been overwritten by a previous switch.
  const EN_TEXT = new WeakMap();
  const EN_PLACEHOLDER = new WeakMap();
  const EN_TITLE = new WeakMap();
  const EN_ARIA = new WeakMap();

  function applyDict(dict) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      if (!EN_TEXT.has(el)) EN_TEXT.set(el, el.textContent);
      el.textContent = dict[key] || EN_TEXT.get(el);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      if (!EN_PLACEHOLDER.has(el)) EN_PLACEHOLDER.set(el, el.placeholder || "");
      el.placeholder = dict[key] || EN_PLACEHOLDER.get(el);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      if (!EN_TITLE.has(el)) EN_TITLE.set(el, el.title || "");
      el.title = dict[key] || EN_TITLE.get(el);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      const key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      if (!EN_ARIA.has(el)) EN_ARIA.set(el, el.getAttribute("aria-label") || "");
      el.setAttribute("aria-label", dict[key] || EN_ARIA.get(el));
    });
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    saveLang(lang);
    document.documentElement.lang = lang;

    const dicts = window.MARKETING_I18N || {};
    const dict = (lang === "en") ? {} : (dicts[lang] || {});
    applyDict(dict);

    // Update language picker UI
    document.querySelectorAll("[data-lang-current]").forEach(el => {
      el.textContent = LANG_SHORT[lang] || "EN";
    });
    document.querySelectorAll("[data-lang-option]").forEach(el => {
      const optLang = el.getAttribute("data-lang-option");
      el.classList.toggle("is-active", optLang === lang);
    });
  }

  // Build the language picker DOM. Inserted into any element with
  // class="lang-picker-slot" so each page can decide where it goes.
  function buildLangPicker() {
    document.querySelectorAll(".lang-picker-slot").forEach(slot => {
      if (slot.dataset.langPickerBuilt) return;
      slot.dataset.langPickerBuilt = "1";

      const wrap = document.createElement("div");
      wrap.className = "lang-picker";
      wrap.innerHTML = `
        <button type="button" class="lang-picker-btn" aria-haspopup="true" aria-expanded="false" aria-label="Change language">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span data-lang-current>EN</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="lang-picker-menu" role="menu">
          ${SUPPORTED.map(code => `
            <button type="button" class="lang-picker-option" data-lang-option="${code}" role="menuitem">
              ${LANG_NAMES[code]}
            </button>
          `).join("")}
        </div>
      `;
      slot.appendChild(wrap);

      const btn = wrap.querySelector(".lang-picker-btn");
      const menu = wrap.querySelector(".lang-picker-menu");

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = wrap.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      wrap.querySelectorAll("[data-lang-option]").forEach(opt => {
        opt.addEventListener("click", () => {
          const lang = opt.getAttribute("data-lang-option");
          setLanguage(lang);
          wrap.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
        });
      });

      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) {
          wrap.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  function init() {
    buildLangPicker();
    setLanguage(detectLang());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging + the in-app code to call directly.
  window.FinTrackI18n = { setLanguage, getCurrentLang: detectLang };
})();

/**
 * VoicePrime — Site Behavior
 * ---------------------------------------------------------------------------
 * Handles: theme switching, language switching (with RTL/LTR + full content
 * re-render from js/i18n.js), mobile navigation, scroll-triggered reveal
 * animation, download-button wiring from js/config.js, and comparison-page
 * rendering when the site is loaded from comparison.html.
 *
 * No external dependencies. Every DOM query is guarded so a missing
 * element never throws — sections can be edited or removed without
 * breaking the rest of the script.
 */
(function () {
  "use strict";

  var CONFIG = window.VOICEPRIME_CONFIG || { downloads: {}, contact: {} };
  var I18N = window.VOICEPRIME_I18N || { fa: {}, en: {} };

  var STORAGE = {
    theme: "voiceprime-theme",
    lang: "voiceprime-lang"
  };

  var revealObserver = null;
  var isComparisonPage = false;

  /* ---------------------------------------------------------------------
     Small utilities
     --------------------------------------------------------------------- */
  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function escapeHtml(str) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(str).replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  function icon(name, extraClass) {
    return '<svg class="icon ' + (extraClass || "") + '" aria-hidden="true" focusable="false">' +
      '<use href="#icon-' + name + '"></use></svg>';
  }

  function toPersianDigits(input) {
    var map = { "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴", "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹" };
    return String(input).replace(/[0-9]/g, function (d) { return map[d]; });
  }

  function byId(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------------
     Theme
     --------------------------------------------------------------------- */
  function getInitialTheme() {
    var stored = safeGet(STORAGE.theme);
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    safeSet(STORAGE.theme, theme);
    var btn = byId("themeToggle");
    if (btn) btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  }

  /* ---------------------------------------------------------------------
     Language / content rendering
     --------------------------------------------------------------------- */
  function getInitialLang() {
    var stored = safeGet(STORAGE.lang);
    if (stored === "en" || stored === "fa") return stored;
    return "fa";
  }

  function dictFor(lang) { return I18N[lang] || I18N.fa; }

  function renderStaticText(dict) {
    if (dict.meta) {
      document.title = dict.meta.title;
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", dict.meta.description);
    }

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var path = el.getAttribute("data-i18n");
      var value = path.split(".").reduce(function (acc, key) {
        return acc && acc[key] !== undefined ? acc[key] : null;
      }, dict);
      if (typeof value === "string") el.textContent = value;
    }

    var ariaNodes = document.querySelectorAll("[data-i18n-aria]");
    for (var j = 0; j < ariaNodes.length; j++) {
      var ael = ariaNodes[j];
      var apath = ael.getAttribute("data-i18n-aria");
      var avalue = apath.split(".").reduce(function (acc, key) {
        return acc && acc[key] !== undefined ? acc[key] : null;
      }, dict);
      if (typeof avalue === "string") ael.setAttribute("aria-label", avalue);
    }
  }

  function renderWhy(dict) {
    var wrap = byId("whyGrid");
    if (!wrap || !dict.why) return;
    wrap.innerHTML = dict.why.points.map(function (p, i) {
      return '<div class="card why__card reveal">' +
        '<div class="why__num">0' + (i + 1) + "</div>" +
        "<h3>" + escapeHtml(p.title) + "</h3>" +
        "<p>" + escapeHtml(p.body) + "</p>" +
        "</div>";
    }).join("");
  }

  function renderCapabilities(dict) {
    var wrap = byId("capGrid");
    if (!wrap || !dict.capabilities) return;
    var icons = ["mic", "translate", "terminal", "speaker", "bubble"];
    var items = dict.capabilities.items;
    wrap.innerHTML = items.map(function (item, i) {
      var isOnline = i === items.length - 1;
      return '<div class="card card--hover cap__card reveal">' +
        '<div class="cap__icon">' + icon(icons[i] || "mic") + "</div>" +
        "<h3>" + escapeHtml(item.title) + "</h3>" +
        "<p>" + escapeHtml(item.body) + "</p>" +
        '<span class="cap__tag' + (isOnline ? " cap__tag--online" : "") + '">' + escapeHtml(item.tag) + "</span>" +
        "</div>";
    }).join("");
  }

  function renderHybrid(dict) {
    if (!dict.hybrid) return;
    var offlineList = byId("hybridOfflineList");
    var onlineList = byId("hybridOnlineList");
    if (offlineList) {
      offlineList.innerHTML = dict.hybrid.offlineItems.map(function (t) {
        return "<li>" + icon("check") + "<span>" + escapeHtml(t) + "</span></li>";
      }).join("");
    }
    if (onlineList) {
      onlineList.innerHTML = dict.hybrid.onlineItems.map(function (t) {
        return "<li>" + icon("wifi") + "<span>" + escapeHtml(t) + "</span></li>";
      }).join("");
    }
  }

  function renderLanguages(dict) {
    var wrap = byId("langCards");
    if (!wrap || !dict.languages) return;
    wrap.innerHTML = dict.languages.cards.map(function (c) {
      return '<div class="card lang__card reveal"><h3>' + escapeHtml(c.title) + "</h3><p>" + escapeHtml(c.body) + "</p></div>";
    }).join("");
  }

  function renderCompareSummary(dict) {
    var wrap = byId("compareSummary");
    if (!wrap || !dict.compareSummary) return;
    var html =
      '<div class="compare-summary__inner">' +
      '<div class="compare-summary__text">' +
      "<h3>" + escapeHtml(dict.compareSummary.title) + "</h3>" +
      "<p>" + escapeHtml(dict.compareSummary.body) + "</p>" +
      "</div>" +
      '<a href="comparison.html" class="btn btn--primary">' + icon("arrow-right") + "<span>" + escapeHtml(dict.compareSummary.cta) + "</span></a>" +
      "</div>";
    wrap.innerHTML = html;
  }

  function renderComparisonPage(dict) {
    if (!isComparisonPage || !dict.comparisonPage) return;

    var headingWrap = byId("comparisonHeading");
    var tableWrap = byId("comparisonTable");
    var highlightWrap = byId("comparisonHighlight");
    if (!headingWrap || !tableWrap) return;

    // Render heading
    headingWrap.innerHTML =
      '<span class="eyebrow">' + escapeHtml(dict.comparisonPage.eyebrow) + "</span>" +
      "<h1 class=\"section-title\">" + escapeHtml(dict.comparisonPage.title) + "</h1>" +
      '<p class="section-subtitle">' + escapeHtml(dict.comparisonPage.subtitle) + "</p>" +
      '<p class="comparison-intro">' + escapeHtml(dict.comparisonPage.intro) + "</p>";

    // Build table with score bars
    var headHtml = "<tr><th scope=\"col\">" + escapeHtml(dict.comparisonPage.colVoicePrime) + "</th>" +
      "<th scope=\"col\">" + escapeHtml(dict.comparisonPage.colOthers) + "</th></tr>";
    var bodyHtml = dict.comparisonPage.rows.map(function (row) {
      var percentage = row.score * 10; // score 0-10 -> width 0-100%
      var scoreClass = row.score >= 9.5 ? "score-high" : (row.score >= 9 ? "score-good" : "score-ok");
      return "<tr>" +
        "<td>" + escapeHtml(row.label) + "</td>" +
        '<td class="is-brand"><div class="score-cell"><span class="score-number">' + row.score.toFixed(1) + '</span>' +
        '<div class="score-bar"><div class="score-bar__fill ' + scoreClass + '" style="width:' + percentage + '%"></div></div></div></td>' +
        "</tr>";
    }).join("");
    tableWrap.innerHTML = "<table class=\"comparison-table\"><thead>" + headHtml + "</thead><tbody>" + bodyHtml + "</tbody></table>";

    var footnote = byId("comparisonFootnote");
    if (footnote) footnote.textContent = dict.comparisonPage.footnote;

    var cta = byId("comparisonCta");
    if (cta) cta.textContent = dict.comparisonPage.cta;

    var backLink = byId("comparisonBack");
    if (backLink) backLink.textContent = dict.comparisonPage.back;

    // Render highlight
    if (highlightWrap) {
      highlightWrap.innerHTML =
        '<div class="highlight-card">' +
        '<div class="highlight-card__icon">' + icon("audio-wave") + "</div>" +
        "<h3>" + escapeHtml(dict.comparisonPage.highlightTitle) + "</h3>" +
        "<p>" + escapeHtml(dict.comparisonPage.highlightBody) + "</p>" +
        "</div>";
    }
  }

  function renderPlatforms(dict) {
    var wrap = byId("platformGrid");
    if (!wrap || !dict.getStarted) return;
    var keys = ["windows", "android", "linux"];
    var icons = ["windows", "android", "linux"];
    wrap.innerHTML = dict.getStarted.platforms.map(function (p, i) {
      var url = (CONFIG.downloads || {})[keys[i]];
      var btnHtml;
      if (url) {
        btnHtml = '<a class="btn btn--secondary btn--block" href="' + encodeURI(url) +
          '" target="_blank" rel="noopener noreferrer" data-platform="' + keys[i] + '">' +
          icon("download") + "<span>" + escapeHtml(dict.getStarted.downloadBtn) + "</span></a>";
      } else {
        btnHtml = '<button type="button" class="btn btn--ghost btn--block" disabled aria-disabled="true">' +
          escapeHtml(dict.getStarted.comingSoon) + "</button>";
      }
      return '<div class="card platform-card reveal">' +
        '<div class="platform-card__icon">' + icon(icons[i]) + "</div>" +
        "<h3>" + escapeHtml(p.title) + "</h3>" +
        "<p>" + escapeHtml(p.body) + "</p>" +
        btnHtml +
        "</div>";
    }).join("");
  }

  function renderContact(dict) {
    var wrap = byId("contactGrid");
    if (!wrap || !dict.contact) return;
    var c = CONFIG.contact || {};
    var email = c.email || "";
    var items = [
      { icon: "mail", label: dict.contact.emailLabel, value: email, href: "mailto:" + email }
    ];
    wrap.innerHTML = items.map(function (it) {
      return '<a class="card card--hover contact-card reveal" href="' + it.href + '">' +
        '<div class="contact-card__icon">' + icon(it.icon) + "</div>" +
        '<div class="contact-card__label">' + escapeHtml(it.label) + "</div>" +
        '<div class="contact-card__value">' + escapeHtml(it.value) + "</div>" +
        "</a>";
    }).join("");
  }

  function renderFooterRights(dict, lang) {
    var el = byId("footerRights");
    if (!el || !dict.footer) return;
    var year = new Date().getFullYear();
    var yearStr = lang === "fa" ? toPersianDigits(year) : String(year);
    el.textContent = dict.footer.rights.replace("{year}", yearStr);
  }

  function updateLangToggleLabel(dict, lang) {
    var btn = byId("langToggle");
    if (!btn) return;
    btn.textContent = lang === "fa" ? "EN" : "فا";
    if (dict.aria && dict.aria.langToggle) btn.setAttribute("aria-label", dict.aria.langToggle);
  }

  function applyLanguage(lang) {
    var dict = dictFor(lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "fa" ? "rtl" : "ltr");

    renderStaticText(dict);
    if (isComparisonPage) {
      renderComparisonPage(dict);
    } else {
      renderWhy(dict);
      renderCapabilities(dict);
      renderHybrid(dict);
      renderLanguages(dict);
      renderCompareSummary(dict);
    }
    renderPlatforms(dict);
    renderContact(dict);
    renderFooterRights(dict, lang);
    updateLangToggleLabel(dict, lang);

    safeSet(STORAGE.lang, lang);
    observeReveal();
  }

  /* ---------------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------------- */
  function initRevealObserver() {
    var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !("IntersectionObserver" in window)) return null;
    return new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
  }

  function observeReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!revealObserver) {
      nodes.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    nodes.forEach(function (el) {
      if (!el.classList.contains("is-visible")) revealObserver.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Navigation (scroll shadow + mobile panel)
     --------------------------------------------------------------------- */
  function initNavScrollShadow() {
    var nav = byId("siteNav");
    if (!nav) return;
    var ticking = false;
    function update() {
      if (window.scrollY > 8) nav.classList.add("is-scrolled");
      else nav.classList.remove("is-scrolled");
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  function initMobileMenu() {
    var burger = byId("navBurger");
    var panel = byId("mobilePanel");
    var closeBtn = byId("mobilePanelClose");
    if (!burger || !panel) return;

    function open() {
      panel.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    function close() {
      panel.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    burger.addEventListener("click", function () {
      if (panel.classList.contains("is-open")) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    panel.addEventListener("click", function (e) {
      if (e.target.tagName === "A") close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) close();
    });
  }

  /* ---------------------------------------------------------------------
     Detect page type
     --------------------------------------------------------------------- */
  function detectPageType() {
    var path = window.location.pathname.toLowerCase();
    isComparisonPage = path.indexOf("comparison") !== -1;
  }

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    detectPageType();
    applyTheme(getInitialTheme());
    revealObserver = initRevealObserver();
    applyLanguage(getInitialLang());
    initNavScrollShadow();
    initMobileMenu();

    var themeBtn = byId("themeToggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme");
        applyTheme(current === "light" ? "dark" : "light");
      });
    }

    var langBtn = byId("langToggle");
    if (langBtn) {
      langBtn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("lang") === "fa" ? "fa" : "en";
        applyLanguage(current === "fa" ? "en" : "fa");
      });
    }
  });
})();
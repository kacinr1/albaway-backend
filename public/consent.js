'use strict';
/* AlbaWay — Consentement cookies + Google Analytics 4 (RGPD/LPD).
   GA n'est chargé qu'après consentement explicite. Bandeau 4 langues. */
(function () {
  var GA_ID = window.__ALBAWAY_GA_ID;
  if (!GA_ID) return;

  var KEY = 'albaway_consent';
  var lang = (document.documentElement.lang || 'sq').slice(0, 2);
  if (['sq', 'fr', 'de', 'en'].indexOf(lang) < 0) lang = 'sq';

  var T = {
    sq: { txt: 'Përdorim cookie për matje (Google Analytics). Mund të pranoni ose refuzoni.', ok: 'Pranoj', no: 'Refuzoj', pr: 'Privatësia' },
    fr: { txt: 'Nous utilisons des cookies de mesure d’audience (Google Analytics). Vous pouvez accepter ou refuser.', ok: 'Accepter', no: 'Refuser', pr: 'Confidentialité' },
    de: { txt: 'Wir verwenden Analyse-Cookies (Google Analytics). Sie können akzeptieren oder ablehnen.', ok: 'Akzeptieren', no: 'Ablehnen', pr: 'Datenschutz' },
    en: { txt: 'We use analytics cookies (Google Analytics). You can accept or decline.', ok: 'Accept', no: 'Decline', pr: 'Privacy' }
  }[lang];

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  // Helper d'événements funnel : window.albawayTrack('purchase', {value: 3.6})
  window.albawayTrack = function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  };

  // page_view manuel sur navigation SPA (History API)
  var _push = history.pushState;
  history.pushState = function () {
    _push.apply(this, arguments);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: location.pathname + location.search });
    }
  };

  var decision = null;
  try { decision = localStorage.getItem(KEY); } catch (e) {}
  if (decision === 'granted') { loadGA(); return; }
  if (decision === 'denied') return;

  function choose(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (v === 'granted') loadGA();
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  var bar = document.createElement('div');
  bar.setAttribute('role', 'dialog');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:rgba(15,15,20,.97);backdrop-filter:blur(8px);border-top:1px solid rgba(255,255,255,.12);padding:14px 18px;color:#eaeaea;font-family:Inter,system-ui,sans-serif;font-size:13px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center';
  bar.innerHTML =
    '<span style="flex:1;min-width:220px;max-width:640px">' + T.txt +
    ' <a href="/legal.html" style="color:#E41E20;text-decoration:underline">' + T.pr + '</a></span>' +
    '<span style="display:flex;gap:10px">' +
    '<button id="aw-no" style="background:transparent;color:#bbb;border:0;padding:8px 12px;cursor:pointer;font-size:13px">' + T.no + '</button>' +
    '<button id="aw-ok" style="background:#E41E20;color:#fff;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;font-weight:600;font-size:13px">' + T.ok + '</button>' +
    '</span>';

  function mount() {
    document.body.appendChild(bar);
    document.getElementById('aw-ok').addEventListener('click', function () { choose('granted'); });
    document.getElementById('aw-no').addEventListener('click', function () { choose('denied'); });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();

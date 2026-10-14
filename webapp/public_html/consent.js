/* Consenso cookie e Google Analytics (GA4): lo script analytics si carica SOLO dopo il consenso esplicito. */
(function () {
  'use strict';
  // Inserisci qui l'ID di misurazione GA4 (es. 'G-ABCDE12345'). Se vuoto, gli analytics non vengono mai caricati.
  var GA_ID = '';
  var KEY = 'aifs_consent_v1';

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadAnalytics() {
    if (!GA_ID || window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  function removeBanner() { var b = document.getElementById('cookie-banner'); if (b) b.remove(); }

  function decide(v) {
    set(v); removeBanner();
    if (v === 'all') loadAnalytics();
    else if (window.__gaLoaded) location.reload();   // revoca: ricarica per fermare lo script
  }

  function showBanner() {
    removeBanner();
    var d = document.createElement('div');
    d.id = 'cookie-banner'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Preferenze cookie');
    d.innerHTML = '<strong>Cookie e analytics.</strong> Usiamo cookie tecnici necessari (accesso e sicurezza) e, solo con il tuo consenso, ' +
      '<strong>Google Analytics</strong> per statistiche anonime sull\'uso del sito. Puoi cambiare idea in qualsiasi momento da «Gestisci cookie». ' +
      '<a href="/privacy.html">Informativa privacy e cookie</a>.' +
      '<div class="btns"><button class="primary" data-c="all">ACCETTA ANALYTICS</button><button data-c="necessary">SOLO NECESSARI</button></div>';
    d.addEventListener('click', function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c) decide(c); });
    document.body.appendChild(d);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-consent-open]');
    if (t) { e.preventDefault(); showBanner(); }
  });

  var v = get();
  if (v === 'all') loadAnalytics();
  else if (v === null && GA_ID) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner); else showBanner();
  }
})();

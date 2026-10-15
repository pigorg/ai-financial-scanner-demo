/* Cookie consent and Google Analytics (GA4): the analytics script loads ONLY after explicit consent. */
(function () {
  'use strict';
  // Put your GA4 measurement ID here (e.g. 'G-ABCDE12345'). If empty, analytics is never loaded.
  var GA_ID = '';
  var KEY = 'aifs_consent_v1';
  function lang() { try { return localStorage.getItem('aifs_lang') === 'it' ? 'it' : 'en'; } catch (e) { return 'en'; } }

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
    else if (window.__gaLoaded) location.reload();   // consent withdrawn: reload to stop the script
  }

  function showBanner() {
    removeBanner();
    var d = document.createElement('div');
    d.id = 'cookie-banner'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie preferences');
    var it = lang() === 'it';
    d.innerHTML = it
      ? '<strong>Cookie e analytics.</strong> Usiamo cookie tecnici necessari (accesso e sicurezza) e, solo con il tuo consenso, ' +
        '<strong>Google Analytics</strong> per statistiche anonime sull\'uso del sito. Puoi cambiare idea in qualsiasi momento da «Gestisci cookie». ' +
        '<a href="/informativa-privacy.html">Informativa privacy e cookie</a>.' +
        '<div class="btns"><button class="primary" data-c="all">ACCETTA ANALYTICS</button><button data-c="necessary">SOLO NECESSARI</button></div>'
      : '<strong>Cookies and analytics.</strong> We use strictly necessary cookies (login and security) and, only with your consent, ' +
        '<strong>Google Analytics</strong> for anonymous statistics about how the site is used. You can change your mind at any time from "Cookie settings". ' +
        '<a href="/privacy.html">Privacy &amp; Cookies policy</a>.' +
        '<div class="btns"><button class="primary" data-c="all">ACCEPT ANALYTICS</button><button data-c="necessary">NECESSARY ONLY</button></div>';
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

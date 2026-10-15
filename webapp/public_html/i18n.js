/* Shared language helper: English by default, Italian on request. Remembers the choice in localStorage. */
(function () {
  'use strict';
  var KEY = 'aifs_lang';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }

  var q = (location.search.match(/[?&]lang=(it|en)/) || [])[1];
  if (q) store(q);
  var lang = q || saved() || 'en';
  if (lang !== 'it') lang = 'en';

  var IT = {};
  var LEGAL = {en: {terms: '/terms.html', privacy: '/privacy.html'}, it: {terms: '/termini.html', privacy: '/informativa-privacy.html'}};

  var api = {
    lang: lang,
    /** Registers Italian translations keyed by the exact English text. */
    add: function (d) { for (var k in d) IT[k] = d[k]; },
    /** t('Hello {name}', {name: 'x'}) -> translated string with placeholders filled. */
    t: function (en, p) {
      var s = (lang === 'it' && IT[en] !== undefined) ? IT[en] : en;
      if (p) s = s.replace(/\{(\w+)\}/g, function (m, k) { return p[k] !== undefined ? p[k] : m; });
      return s;
    },
    legal: function (name) { return LEGAL[lang][name]; },
    set: function (l) { store(l); location.reload(); },

    /** Static markup: elements with data-i="key" (innerHTML) and data-iph="key" (placeholder). dict = Italian, by key. */
    applyStatic: function (dict) {
      document.documentElement.lang = lang;
      var titleEn = document.title;
      if (lang === 'it' && dict.title) document.title = dict.title;
      var md = document.querySelector('meta[name=description]');
      if (lang === 'it' && dict.desc && md) md.setAttribute('content', dict.desc);
      document.querySelectorAll('[data-i]').forEach(function (n) {
        var v = dict[n.getAttribute('data-i')];
        if (lang === 'it' && v !== undefined) n.innerHTML = v;
      });
      document.querySelectorAll('[data-iph]').forEach(function (n) {
        var v = dict[n.getAttribute('data-iph')];
        if (lang === 'it' && v !== undefined) n.setAttribute('placeholder', v);
      });
      return titleEn;
    },

    /** Language switch (.lang buttons) and language-dependent legal links ([data-legal]). */
    wire: function () {
      document.querySelectorAll('.lang button[data-lang]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-lang') === lang);
        b.addEventListener('click', function () {
          var l = b.getAttribute('data-lang');
          if (l !== lang) api.set(l);
        });
      });
      document.querySelectorAll('[data-legal]').forEach(function (a) { a.setAttribute('href', LEGAL[lang][a.getAttribute('data-legal')]); });
    }
  };
  window.I18N = api;
})();

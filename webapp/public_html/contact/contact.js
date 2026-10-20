'use strict';
/* Contact form: sends the message through the API (which emails it to the author). */
(function () {
  var form = document.getElementById('cform');
  var box = document.getElementById('cmsg');
  var btn = document.getElementById('csend');
  var csrf = '';
  var it = I18N.lang === 'it';

  function show(type, text) {
    box.innerHTML = '';
    if (!text) return;
    var d = document.createElement('div');
    d.className = 'cmsg ' + type;
    d.setAttribute('role', type === 'err' ? 'alert' : 'status');
    d.textContent = text;
    box.appendChild(d);
    d.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }

  function call(action, body) {
    var opt = {credentials: 'same-origin', headers: {'X-Lang': I18N.lang}};
    if (body !== undefined) {
      opt.method = 'POST';
      opt.headers['Content-Type'] = 'application/json';
      opt.headers['X-CSRF-Token'] = csrf;
      opt.body = JSON.stringify(body);
    }
    return fetch('/api.php?action=' + action, opt).then(function (r) {
      return r.json().then(function (j) { if (j.csrf) csrf = j.csrf; if (!j.ok) throw new Error(j.error || 'Error'); return j; });
    });
  }

  // CSRF token + if the visitor is logged in, swap the top buttons for "Open the app"
  call('me').then(function (j) {
    if (j.user) {
      var lg = document.getElementById('top-login'), su = document.getElementById('top-signup');
      if (lg) lg.hidden = true;
      if (su) { su.setAttribute('href', '/account/'); su.textContent = it ? "Apri l'app" : 'Open the app'; }
      var f = form.elements;
      if (!f.name.value) f.name.value = j.user.username;
      if (!f.email.value) f.email.value = j.user.email;
    }
  }).catch(function () {});

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    show('', '');
    var f = form.elements;
    if (!f.accept_privacy.checked) {
      show('err', it ? "Accetta l'informativa privacy per inviare il messaggio." : 'Please accept the privacy policy to send your message.');
      return;
    }
    btn.disabled = true;
    var wait = btn.textContent;
    btn.textContent = it ? 'Invio in corso…' : 'Sending…';
    call('contact', {
      name: f.name.value, email: f.email.value, message: f.message.value,
      accept_privacy: true, website: f.website.value
    }).then(function (r) {
      show('ok', r.message);
      f.message.value = '';
      f.accept_privacy.checked = false;
    }).catch(function (err) {
      show('err', err.message);
    }).then(function () {
      btn.disabled = false;
      btn.textContent = wait;
    });
  });
})();

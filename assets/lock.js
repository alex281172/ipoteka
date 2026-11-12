/* Закрытые страницы: содержимое зашифровано AES-256-GCM, ключ – PBKDF2-SHA-256 от пароля (200 000 итераций).
   В репозитории лежит только шифр; без пароля текст и сканы не прочитать. Ключ после входа хранится
   в этом браузере (localStorage) – кнопка «Закрыть паролем» его удаляет. Шифрует tools/secure.py. */
(function () {
  'use strict';
  var KEY = 'ipoteka-key', SALT = 'ipoteka-secure-v1', IT = 200000;
  var RH = 'd78644491c7af05d52f9b720d542bd5d175df86c757a01fdc78da1993264fe75', RK = 'rasstanovka-auth';
  var enc = new TextEncoder(), dec = new TextDecoder(), cache = {}, keyP = null;
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function hex(b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function b64(s) { var bin = atob(s.replace(/\s+/g, '')), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function pbkdf2(pw, salt) {
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: IT }, k, 256);
    });
  }
  function aesKey(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); }
  function decrypt(key, bytes) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)); }
  function storedKey() { var h = load(KEY); if (!h || h.length !== 64) return null; return aesKey(unhex(h)); }

  /* Запомнить пароль: ключ для закрытых страниц и отметка для расстановки мебели (тот же пароль). */
  function remember(pw) {
    return Promise.all([pbkdf2(pw, SALT), pbkdf2(pw, 'ipoteka-rasstanovka-v1')]).then(function (r) {
      store(KEY, hex(r[0])); if (hex(r[1]) === RH) store(RK, RH);
      keyP = aesKey(r[0]); return keyP;
    });
  }
  function forget() { store(KEY, null); store(RK, null); keyP = null; }

  function runScripts(box, done) {
    var list = Array.prototype.slice.call(box.querySelectorAll('script'));
    (function next() {
      var old = list.shift(); if (!old) { done(); return; }
      var s = document.createElement('script');
      if (old.src) { s.src = old.src; s.onload = s.onerror = next; old.parentNode.replaceChild(s, old); }
      else { s.textContent = old.textContent; old.parentNode.replaceChild(s, old); next(); }
    })();
  }

  /* Загрузить и расшифровать файл (сканы): вернуть blob-URL. */
  function blobURL(path, type) {
    if (cache[path]) return cache[path];
    cache[path] = (keyP || Promise.reject(new Error('нет ключа'))).then(function (key) {
      return fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (b) { return decrypt(key, new Uint8Array(b)); })
        .then(function (p) { return URL.createObjectURL(new Blob([p], { type: type || 'application/octet-stream' })); });
    });
    return cache[path];
  }

  /* Страница с зашифрованным содержимым: #payload – шифр, #secure – куда вставить, #gate – форма пароля. */
  function page(opt) {
    opt = opt || {};
    var payload = document.getElementById('payload'), target = document.getElementById('secure');
    var gate = document.getElementById('gate'), form = document.getElementById('gateF');
    var msg = document.getElementById('gateM'), btn = document.getElementById('gateB'), inp = document.getElementById('gateP');
    if (!payload || !target) return;
    var bytes = b64(payload.textContent);
    function open(key) {
      return decrypt(key, bytes).then(function (plain) {
        target.innerHTML = dec.decode(plain);
        document.body.classList.remove('locked');
        runScripts(target, function () {
          (opt.after || []).forEach(function (src) { var s = document.createElement('script'); s.src = src; document.body.appendChild(s); });
          if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
        });
        document.querySelectorAll('[data-logout]').forEach(function (b) { b.hidden = false; b.addEventListener('click', function () { forget(); location.reload(); }); });
      });
    }
    if (!window.crypto || !crypto.subtle) { if (msg) msg.textContent = 'Браузер не поддерживает расшифровку.'; return; }
    var sk = storedKey();
    if (sk) { keyP = sk; sk.then(open).catch(function () { forget(); if (inp) inp.focus(); }); }
    else if (inp) setTimeout(function () { inp.focus(); }, 50);
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      btn.disabled = true; msg.textContent = 'Проверяю…';
      var pw = inp.value;
      Promise.all([pbkdf2(pw, SALT), pbkdf2(pw, 'ipoteka-rasstanovka-v1')]).then(function (r) {
        return aesKey(r[0]).then(function (k) {
          return decrypt(k, bytes).then(function () {
            store(KEY, hex(r[0])); if (hex(r[1]) === RH) store(RK, RH);
            keyP = Promise.resolve(k); msg.textContent = ''; return open(k);
          });
        });
      }).catch(function () { msg.textContent = 'Неверный пароль'; inp.select(); }).then(function () { btn.disabled = false; });
    });
  }

  window.IPLock = { page: page, blobURL: blobURL, remember: remember, forget: forget };
})();

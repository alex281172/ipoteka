/* Чек-листы: отметки сохраняются в этом браузере (localStorage), счётчик «N из M» обновляется сам. */
(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  document.querySelectorAll('ul.checklist[data-list]').forEach(function (list) {
    var id = list.getAttribute('data-list');
    var boxes = list.querySelectorAll('input[type="checkbox"]');
    var counter = document.querySelector('[data-progress="' + id + '"]');
    boxes.forEach(function (box, i) {
      var key = 'kv:' + id + ':' + (box.value || i);
      box.id = box.id || ('cb-' + id + '-' + i);
      if (store.get(key) === '1') box.checked = true;
      box.addEventListener('change', function () { store.set(key, box.checked ? '1' : '0'); update(); });
    });
    function update() {
      if (!counter) return;
      var done = 0; boxes.forEach(function (b) { if (b.checked) done++; });
      counter.textContent = 'отмечено ' + done + ' из ' + boxes.length;
      counter.classList.toggle('done', done === boxes.length);
    }
    update();
  });
})();

/* Просмотр фото на весь экран: ссылки a.ph внутри [data-gallery]; стрелки, Esc, свайп. */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-gallery] a.ph'));
  if (!links.length || typeof HTMLDialogElement === 'undefined') return;
  var dlg = document.createElement('dialog');
  dlg.className = 'lb';
  dlg.setAttribute('aria-label', 'Просмотр фото');
  dlg.innerHTML = '<div class="lb-stage"><img alt=""><button class="x" type="button" aria-label="Закрыть">×</button>' +
    '<button class="prev" type="button" aria-label="Предыдущее фото">‹</button><button class="next" type="button" aria-label="Следующее фото">›</button></div>' +
    '<div class="lb-cap"><span class="n"></span><span class="t"></span></div>';
  document.body.appendChild(dlg);
  var img = dlg.querySelector('img'), num = dlg.querySelector('.n'), txt = dlg.querySelector('.t');
  var set = [], i = 0;
  function show(k) {
    i = (k + set.length) % set.length;
    var a = set[i], fig = a.closest('figure'), cap = fig && fig.querySelector('figcaption');
    img.src = a.getAttribute('href');
    img.alt = (a.querySelector('img') || {}).alt || '';
    txt.textContent = cap ? cap.textContent : img.alt;
    num.textContent = (i + 1) + ' из ' + set.length;
  }
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      set = Array.prototype.slice.call(a.closest('[data-gallery]').querySelectorAll('a.ph'));
      show(set.indexOf(a));
      dlg.showModal();
    });
  });
  dlg.querySelector('.x').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.prev').addEventListener('click', function () { show(i - 1); });
  dlg.querySelector('.next').addEventListener('click', function () { show(i + 1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb-stage')) dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
  var x0 = null;
  dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(dx < 0 ? i + 1 : i - 1);
  });
})();

/* Заметки: фильтр по статусу и счётчики. Кнопки [data-filter] внутри .filters[data-for="<id списка>"]. */
(function () {
  document.querySelectorAll('.filters[data-for]').forEach(function (bar) {
    var list = document.getElementById(bar.getAttribute('data-for'));
    if (!list) return;
    var items = list.querySelectorAll('.note');
    var btns = bar.querySelectorAll('button[data-filter]');
    btns.forEach(function (b) {
      var f = b.getAttribute('data-filter'), n = 0;
      items.forEach(function (it) { if (f === 'all' || it.getAttribute('data-status') === f) n++; });
      var c = document.createElement('span'); c.className = 'c'; c.textContent = n; b.appendChild(c);
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        items.forEach(function (it) { it.hidden = !(f === 'all' || it.getAttribute('data-status') === f); });
      });
    });
  });
})();

/* Палитра: отметки «Нравится» хранятся в этом браузере, итог можно скопировать и отправить. */
(function () {
  var boxes = document.querySelectorAll('input[data-fav]');
  if (!boxes.length) return;
  var out = document.querySelector('[data-fav-out]'), btn = document.querySelector('[data-fav-copy]');
  var initial = out ? out.textContent : '';
  function key(b) { return 'kv:fav:' + b.getAttribute('data-fav'); }
  function text() {
    var picked = [];
    boxes.forEach(function (b) {
      if (b.checked) {
        var card = b.closest('.swc'), name = card.querySelector('h3').textContent, ncs = card.querySelector('.ncs span').textContent;
        picked.push(b.getAttribute('data-fav') + ' – ' + name + ' (' + ncs + ')');
      }
    });
    return picked;
  }
  function update() {
    var p = text();
    if (out) out.textContent = p.length ? 'Нравятся: ' + p.join('; ') : initial;
    if (btn) btn.hidden = !p.length;
  }
  boxes.forEach(function (b) {
    try { if (localStorage.getItem(key(b)) === '1') b.checked = true; } catch (e) {}
    b.addEventListener('change', function () { try { localStorage.setItem(key(b), b.checked ? '1' : '0'); } catch (e) {} update(); });
  });
  if (btn) btn.addEventListener('click', function () {
    var t = 'Оттенки, которые нравятся: ' + text().join('; ');
    var done = function () { btn.textContent = 'Скопировано'; setTimeout(function () { btn.textContent = 'Скопировать список'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { selectOut(); });
    else selectOut();
  });
  function selectOut() { var r = document.createRange(); r.selectNodeContents(out); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  update();
})();

/* Чек-лист с выбором: [data-picklist] собирает отмеченные пункты по группам и даёт скопировать список. */
(function () {
  document.querySelectorAll('[data-picklist]').forEach(function (root) {
    var out = root.querySelector('[data-pick-out]'), btn = root.querySelector('[data-pick-copy]');
    if (!out) return;
    var initial = out.textContent;
    function collect() {
      var res = [];
      root.querySelectorAll('ul.checklist[data-list]').forEach(function (ul) {
        var items = [];
        ul.querySelectorAll('input:checked').forEach(function (b) { var t = b.closest('label').querySelector('b'); if (t) items.push(t.textContent); });
        if (items.length) res.push((ul.getAttribute('data-group') || '') + ': ' + items.join(', '));
      });
      return res;
    }
    function update() {
      var g = collect();
      out.textContent = g.length ? 'Выбрано. ' + g.join('. ') + '.' : initial;
      if (btn) btn.hidden = !g.length;
    }
    root.addEventListener('change', update);
    if (btn) btn.addEventListener('click', function () {
      var t = 'Санузел, что нужно. ' + collect().join('. ') + '.';
      var done = function () { btn.textContent = 'Скопировано'; setTimeout(function () { btn.textContent = 'Скопировать список'; }, 1800); };
      var sel = function () { var r = document.createRange(); r.selectNodeContents(out); var s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, sel); else sel();
    });
    update();
  });
})();

/* Палитра: нажатие на карточку – цвет на весь экран. Закрыть: крестик, повторное нажатие, Esc. Листать: свайп или стрелки. */
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.palette .swc'));
  if (!cards.length || typeof HTMLDialogElement === 'undefined') return;
  var dlg = document.createElement('dialog');
  dlg.className = 'cv';
  dlg.setAttribute('aria-label', 'Цвет на весь экран');
  dlg.innerHTML = '<button class="x" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<div class="cv-info"><span class="n"></span><h2 class="t"></h2><span class="c"></span><p class="d"></p>' +
    '<span class="h">Нажмите ещё раз, чтобы закрыть · свайп – соседний цвет</span></div>';
  document.body.appendChild(dlg);
  var n = dlg.querySelector('.n'), t = dlg.querySelector('.t'), c = dlg.querySelector('.c'), d = dlg.querySelector('.d');
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) dlg.querySelector('.h').textContent = 'Щёлкните ещё раз, чтобы закрыть · стрелки ← → – соседний цвет';
  var i = 0, swiped = false;
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function show(k) {
    i = (k + cards.length) % cards.length;
    var card = cards[i], sw = card.querySelector('.swatch');
    var rgb = getComputedStyle(sw).backgroundColor, m = (rgb.match(/\d+/g) || [0, 0, 0]).map(Number);
    var L = 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]);
    var hex = '#' + m.slice(0, 3).map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('').toUpperCase();
    dlg.style.background = rgb;
    dlg.classList.toggle('dk', (1.05 / (L + 0.05)) > ((L + 0.05) / 0.05));
    var ncs = card.querySelector('.ncs span'), desc = card.querySelector('.swb p'), fav = card.querySelector('.fav input');
    n.textContent = (i + 1) + ' из ' + cards.length;
    t.textContent = card.querySelector('h3').textContent;
    c.textContent = (ncs ? ncs.textContent + ' · ' : '') + hex + (fav && fav.checked ? ' · ♥ нравится' : '');
    d.textContent = desc ? desc.textContent : '';
  }
  function open(k) {
    show(k);
    document.documentElement.classList.add('cv-lock');
    dlg.showModal();
    dlg.querySelector('.x').focus();
  }
  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('cv-lock');
    var sw = cards[i] && cards[i].querySelector('.swatch');
    if (sw) sw.focus({ preventScroll: true });
  });
  cards.forEach(function (card, k) {
    var sw = card.querySelector('.swatch');
    if (sw) {
      sw.setAttribute('tabindex', '0');
      sw.setAttribute('role', 'button');
      sw.setAttribute('aria-label', 'Открыть на весь экран: ' + card.querySelector('h3').textContent);
      sw.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(k); }
      });
    }
    card.addEventListener('click', function (e) {
      if (e.target.closest('.fav')) return;
      open(k);
    });
  });
  dlg.addEventListener('click', function () {
    if (swiped) { swiped = false; return; }
    dlg.close();
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
  });
  var x0 = null, y0 = null;
  dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true; setTimeout(function () { swiped = false; }, 450);
      show(dx < 0 ? i + 1 : i - 1);
    }
  });
})();

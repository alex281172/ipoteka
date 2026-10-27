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

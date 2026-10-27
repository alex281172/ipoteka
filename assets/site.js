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

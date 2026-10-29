/* Гайд по ремонту: данные из gaid/data.json, поиск по словам, фильтры по теме, оценке, этапу и ролику.
   Состояние фильтров – в адресе страницы (?q=&t=&r=&s=&v=), им можно поделиться. Клавиша «/» – к поиску. */
(function () {
  var root = document.getElementById('guide');
  if (!root) return;
  function $(s) { return document.querySelector(s); }
  var q = $('#g-q'), list = $('#g-list'), cnt = $('#g-count'), reset = $('#g-reset'), empty = $('#g-empty');
  var topicsBar = $('#g-topics'), verdBar = $('#g-verdict'), stageSel = $('#g-stage'), srcBar = $('#g-src');
  var vidsList = $('#g-videos'), pop = $('#g-pop');
  var D, tips = [], byId = {}, topicName = {}, stageName = {}, verd = {};
  var st = { q: '', t: 'all', r: 'all', s: 'all', v: '' };

  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* Простая «основа» слова: у русских слов от 5 букв отрезаем конечные гласные, чтобы «розетки» находили «розетка», а «стяжке» – «стяжки». */
  function stem(w) {
    if (!/[а-я]/.test(w) || w.length < 5) return w;
    var b = w.replace(/[аеиоуыэюяйь]+$/, '');
    return b.length >= 4 ? b : w;
  }
  function words(s) { return norm(s).split(/[^0-9a-zа-я.\-]+/i).filter(function (w) { return w.length > 0; }).map(stem); }
  function rx(ws) {
    if (!ws.length) return null;
    var parts = ws.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]'); });
    parts.sort(function (a, b) { return b.length - a.length; });
    return new RegExp('((?:' + parts.join('|') + ')[0-9a-zа-яё]*)', 'gi');
  }
  function hl(s, re) { var e = esc(s); return re ? e.replace(re, '<mark>$1</mark>') : e; }
  function tc(sec) {
    sec = +sec; var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + x).slice(-2);
  }
  function yt(url, t) { return t ? url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + (+t) + 's' : url; }
  function date(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d; }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    st.q = p.get('q') || ''; st.t = p.get('t') || 'all'; st.r = p.get('r') || 'all'; st.s = p.get('s') || 'all'; st.v = p.get('v') || '';
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (st.q) p.set('q', st.q);
    if (st.t !== 'all') p.set('t', st.t);
    if (st.r !== 'all') p.set('r', st.r);
    if (st.s !== 'all') p.set('s', st.s);
    if (st.v) p.set('v', st.v);
    var s = p.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
  }

  function chips(bar, items, key, allLabel) {
    bar.innerHTML = '';
    [{ id: 'all', name: allLabel }].concat(items).forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-id', it.id);
      b.innerHTML = esc(it.name) + '<span class="c"></span>';
      b.addEventListener('click', function () { st[key] = it.id; apply(); });
      bar.appendChild(b);
    });
  }

  function card(t, re) {
    var v = byId[t.video] || {}, vd = verd[t.verdict] || { name: '', chip: 'n' };
    var links = (t.links || []).map(function (l) { return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('');
    var src = v.url ? '<a class="gyt" href="' + esc(yt(v.url, t.t)) + '" target="_blank" rel="noopener">▶ ' + esc((v.channel || '').split(' – ')[0]) + (t.t ? ' · ' + tc(t.t) : '') + '</a>' : '';
    var tags = (t.tags || []).map(function (g) { return '<button type="button" data-tag="' + esc(g) + '">' + hl(g, re) + '</button>'; }).join('');
    return '<li class="gtip" id="' + esc(t.id) + '">' +
      '<div class="gh"><span class="chip ' + vd.chip + '">' + esc(vd.name) + '</span><h3>' + hl(t.title, re) + '</h3></div>' +
      '<p>' + hl(t.text, re) + '</p>' +
      (t.for_us ? '<p class="gfor"><b>Для нас:</b> ' + hl(t.for_us, re) + '</p>' : '') +
      '<div class="gmeta"><span>' + esc(topicName[t.topic] || '') + '</span><span>' + esc(stageName[t.stage] || '') + '</span>' + src + links + '</div>' +
      (tags ? '<div class="gtags">' + tags + '</div>' : '') + '</li>';
  }

  function match(t, ws, skip) {
    if (skip !== 't' && st.t !== 'all' && t.topic !== st.t) return false;
    if (skip !== 'r' && st.r !== 'all' && t.verdict !== st.r) return false;
    if (st.s !== 'all' && t.stage !== st.s) return false;
    if (st.v && t.video !== st.v) return false;
    for (var i = 0; i < ws.length; i++) if (t._h.indexOf(ws[i]) < 0) return false;
    return true;
  }

  function apply() {
    var ws = words(st.q), re = rx(ws);
    var shown = tips.filter(function (t) { return match(t, ws); });
    list.innerHTML = shown.map(function (t) { return card(t, re); }).join('');
    empty.hidden = shown.length > 0;
    cnt.textContent = shown.length === tips.length ? 'Все советы: ' + tips.length : 'Найдено: ' + shown.length + ' из ' + tips.length;
    reset.hidden = !(st.q || st.t !== 'all' || st.r !== 'all' || st.s !== 'all' || st.v);
    [[topicsBar, 't'], [verdBar, 'r']].forEach(function (p) {
      var bar = p[0], key = p[1];
      bar.querySelectorAll('button').forEach(function (b) {
        var id = b.getAttribute('data-id');
        var n = tips.filter(function (t) { return (id === 'all' || (key === 't' ? t.topic : t.verdict) === id) && match(t, ws, key); }).length;
        b.querySelector('.c').textContent = n;
        b.setAttribute('aria-pressed', st[key] === id ? 'true' : 'false');
        b.hidden = key === 't' && id !== 'all' && !tips.some(function (t) { return t.topic === id; });
      });
    });
    stageSel.value = st.s;
    if (st.v && byId[st.v]) {
      srcBar.hidden = false;
      srcBar.innerHTML = '<span>Советы из ролика «' + esc(byId[st.v].title) + '»</span><button type="button" aria-label="Показать все ролики">✕</button>';
      srcBar.querySelector('button').addEventListener('click', function () { st.v = ''; apply(); });
    } else { srcBar.hidden = true; srcBar.innerHTML = ''; }
    if (q.value !== st.q) q.value = st.q;
    writeUrl();
  }

  function videos() {
    vidsList.innerHTML = D.videos.slice().reverse().map(function (v) {
      var n = tips.filter(function (t) { return t.video === v.id; }).length;
      var stTxt = v.status === 'transcript' ? '<span class="chip o">Текст разобран</span>' : '<span class="chip n">По кадрам</span>';
      return '<li class="gvid"><div class="gvh"><h3>' + esc(v.title) + '</h3>' + stTxt + '</div>' +
        '<p class="small muted">' + esc(v.channel) + (v.duration ? ' · ' + esc(v.duration) : '') + ' · добавлен ' + esc(date(v.added)) + '</p>' +
        (v.summary ? '<p class="small">' + esc(v.summary) + '</p>' : '') +
        (v.chapters && v.chapters.length ? '<div class="gch"><span>Главы:</span>' + v.chapters.map(function (c) {
          return '<a href="' + esc(yt(v.url, c.t)) + '" target="_blank" rel="noopener"><b>' + tc(c.t) + '</b> ' + esc(c.name) + '</a>';
        }).join('') + '</div>' : '') +
        '<div class="gvr"><button type="button" data-v="' + esc(v.id) + '">Советы: ' + n + '</button><a href="' + esc(v.url) + '" target="_blank" rel="noopener">Смотреть на YouTube ↗</a></div></li>';
    }).join('');
    vidsList.querySelectorAll('button[data-v]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.v = b.getAttribute('data-v'); st.q = ''; st.t = 'all'; st.r = 'all'; st.s = 'all'; apply();
        q.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function popular() {
    var f = {};
    tips.forEach(function (t) { (t.tags || []).forEach(function (g) { var k = norm(g); f[k] = f[k] || { g: g, n: 0 }; f[k].n++; }); });
    var top = Object.keys(f).map(function (k) { return f[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    if (!top.length) return;
    pop.innerHTML = 'Часто ищут: ' + top.map(function (x) { return '<button type="button" class="gtag" data-tag="' + esc(x.g) + '">' + esc(x.g) + '</button>'; }).join(' ');
  }

  function init(data) {
    D = data; tips = data.tips || [];
    (data.videos || []).forEach(function (v) { byId[v.id] = v; });
    (data.topics || []).forEach(function (t) { topicName[t.id] = t.name; });
    (data.stages || []).forEach(function (s) { stageName[s.id] = s.name; });
    (data.verdicts || []).forEach(function (v) { verd[v.id] = v; });
    var vIdx = {}; (data.videos || []).forEach(function (v, k) { vIdx[v.id] = k; });
    tips.sort(function (a, b) { return (vIdx[b.video] - vIdx[a.video]) || ((a.t || 0) - (b.t || 0)); });
    tips.forEach(function (t) {
      var v = byId[t.video] || {};
      t._h = norm([t.title, t.text, t.for_us, (t.tags || []).join(' '), topicName[t.topic], stageName[t.stage], v.title, v.channel].join(' '));
    });
    document.querySelectorAll('[data-g-tips]').forEach(function (e) { e.textContent = tips.length; });
    document.querySelectorAll('[data-g-videos]').forEach(function (e) { e.textContent = (data.videos || []).length; });
    document.querySelectorAll('[data-g-updated]').forEach(function (e) { e.textContent = date(data.updated); });
    chips(topicsBar, data.topics || [], 't', 'Все темы');
    chips(verdBar, data.verdicts || [], 'r', 'Любая оценка');
    (data.stages || []).forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.name; stageSel.appendChild(o); });
    videos(); popular(); readUrl(); apply();
    if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }

  var timer;
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { st.q = q.value.trim(); apply(); }, 120); });
  stageSel.addEventListener('change', function () { st.s = stageSel.value; apply(); });
  reset.addEventListener('click', function () { st = { q: '', t: 'all', r: 'all', s: 'all', v: '' }; apply(); q.focus(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tag]');
    if (!b) return;
    st.q = b.getAttribute('data-tag'); apply();
    q.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  });

  fetch('data.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(init).catch(function () {
    list.innerHTML = '<li class="warnline">Не удалось загрузить советы. Обновите страницу.</li>';
  });
})();

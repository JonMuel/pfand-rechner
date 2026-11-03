/* Pfand-Rechner – Leergut-Annahme & Vollgut-Ausgabe
   Alle Beträge intern in Cent (Ganzzahlen), damit keine Rundungsfehler entstehen. */
(function () {
  'use strict';

  // ---------- Standard-Pfandwerte (Deutschland) ----------
  var BASE = [
    { id: 'bier',   group: 'flaschen', name: 'Bierflasche',        sub: 'Glas: NRW, Euro, Longneck, Steinie', price: 8,    img: 'bier' },
    { id: 'buegel', group: 'flaschen', name: 'Bügelflasche',       sub: 'Glas mit Bügelverschluss',           price: 15,   img: 'buegel' },
    { id: 'glas',   group: 'flaschen', name: 'Mehrweg-Glas',       sub: 'Wasser/Saft, z. B. Perlenflasche',   price: 15,   img: 'glas' },
    { id: 'pet',    group: 'flaschen', name: 'Mehrweg-PET',        sub: 'Wasser/Limo 0,5 / 1,0 l',            price: 15,   img: 'pet' },
    { id: 'milch',  group: 'flaschen', name: 'Milch-/Joghurtglas', sub: 'Mehrweg-Glas',                       price: 15,   img: 'milch' },
    { id: 'einweg', group: 'flaschen', name: 'Einwegflasche',      sub: 'PET mit Pfandlogo',                  price: 25,   img: 'einweg' },
    { id: 'dose',   group: 'flaschen', name: 'Getränkedose',       sub: 'mit Pfandlogo',                      price: 25,   img: 'dose' },
    { id: 'kasten', group: 'gebinde',  name: 'Leerer Kasten',      sub: 'Bier-, Wasser-, Saftkasten',         price: 150,  img: 'kasten-leer' },
    { id: 'fass',   group: 'gebinde',  name: 'Fass / KEG',         sub: 'z. B. 30 l oder 50 l',               price: 3000, img: 'fass' }
  ];

  // Komplette Kästen = Kasten + n Flaschen (Preis wird automatisch berechnet)
  var COMBOS = [
    { id: 'k_bier20',   name: 'Bierkasten',   sub: '20 × 0,5 l',       crate: 'kasten', bottle: 'bier',   n: 20, img: 'kasten-bier' },
    { id: 'k_bier24',   name: 'Bierkasten',   sub: '24 × 0,33 l',      crate: 'kasten', bottle: 'bier',   n: 24, img: 'kasten-bier33' },
    { id: 'k_buegel20', name: 'Bügelkasten',  sub: '20 × 0,5 l',       crate: 'kasten', bottle: 'buegel', n: 20, img: 'kasten-buegel' },
    { id: 'k_glas12',   name: 'Wasserkasten', sub: '12 × 0,7 l Glas',  crate: 'kasten', bottle: 'glas',   n: 12, img: 'kasten-glas' },
    { id: 'k_pet12',    name: 'Wasserkasten', sub: '12 × 1,0 l PET',   crate: 'kasten', bottle: 'pet',    n: 12, img: 'kasten-pet' },
    { id: 'k_saft6',    name: 'Saftkasten',   sub: '6 × 1,0 l Glas',   crate: 'kasten', bottle: 'glas',   n: 6,  img: 'kasten-saft' }
  ];

  var GROUPS = [
    { id: 'kaesten',  title: 'Kästen komplett' },
    { id: 'flaschen', title: 'Flaschen & Dosen' },
    { id: 'gebinde',  title: 'Leere Kästen & Fässer' },
    { id: 'eigene',   title: 'Eigene Artikel' }
  ];

  var IMAGES = [
    ['bier', 'Bierflasche'], ['buegel', 'Bügelflasche'], ['glas', 'Glasflasche'], ['pet', 'PET-Flasche'],
    ['einweg', 'Einwegflasche'], ['dose', 'Dose'], ['milch', 'Milchflasche'], ['fass', 'Fass'],
    ['kasten-leer', 'Kasten leer'], ['kasten-bier', 'Kasten rot'], ['kasten-bier33', 'Kasten orange'],
    ['kasten-buegel', 'Kasten grün'], ['kasten-glas', 'Kasten blau'], ['kasten-pet', 'Kasten türkis'],
    ['kasten-saft', 'Kasten gelb']
  ];

  var MODES = { leer: 'Leergut-Annahme', voll: 'Vollgut-Ausgabe' };

  // ---------- Speicher (robust, auch im privaten Modus) ----------
  var store = {
    get: function (key, fallback) {
      try {
        var v = window.localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignorieren */ }
    }
  };
  var SETTINGS_KEY = 'pfand.settings.v1';
  var TXN_KEY = 'pfand.txn.v1';
  var HINT_KEY = 'pfand.hint.dismissed';

  function emptySettings() { return { prices: {}, hidden: {}, custom: [] }; }
  function emptyTxn(mode) { return { counts: { leer: {}, voll: {} }, ware: 0, mode: mode || 'leer' }; }

  var settings = store.get(SETTINGS_KEY, emptySettings());
  if (!settings.prices) settings.prices = {};
  if (!settings.hidden) settings.hidden = {};
  if (!settings.custom) settings.custom = [];
  var txn = store.get(TXN_KEY, emptyTxn());
  if (!txn.counts || !txn.counts.leer || !txn.counts.voll) txn = emptyTxn();
  var history = [];

  // ---------- Hilfsfunktionen ----------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var euroFmt;
  try { euroFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }); } catch (e) { euroFmt = null; }
  function eur(cents) {
    var v = cents / 100;
    if (euroFmt) return euroFmt.format(v);
    return v.toFixed(2).replace('.', ',') + ' €';
  }
  function parseEur(str) {
    var s = String(str).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function imgSrc(name) { return 'img/' + name + '.svg'; }
  function haptic() { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* */ } } }

  function basePrice(id) {
    if (Object.prototype.hasOwnProperty.call(settings.prices, id)) return settings.prices[id];
    for (var i = 0; i < BASE.length; i++) if (BASE[i].id === id) return BASE[i].price;
    return 0;
  }

  // Alle Artikel mit aktuellem Preis
  function allItems() {
    var list = [];
    COMBOS.forEach(function (c) {
      list.push({
        id: c.id, group: 'kaesten', name: c.name, sub: c.sub, img: c.img, combo: c,
        price: basePrice(c.crate) + c.n * basePrice(c.bottle)
      });
    });
    BASE.forEach(function (b) {
      list.push({ id: b.id, group: b.group, name: b.name, sub: b.sub, img: b.img, price: basePrice(b.id) });
    });
    settings.custom.forEach(function (c) {
      list.push({ id: c.id, group: 'eigene', name: c.name, sub: 'Eigener Artikel', img: c.img, price: c.price, custom: true });
    });
    return list;
  }
  function itemMap() {
    var m = {};
    allItems().forEach(function (it) { m[it.id] = it; });
    return m;
  }

  function totals() {
    var items = itemMap();
    var t = { leer: 0, voll: 0, nleer: 0, nvoll: 0 };
    ['leer', 'voll'].forEach(function (mode) {
      var counts = txn.counts[mode];
      Object.keys(counts).forEach(function (id) {
        var it = items[id];
        if (!it || !counts[id]) return;
        t[mode] += it.price * counts[id];
        t['n' + mode] += counts[id];
      });
    });
    t.pfandSaldo = t.voll - t.leer;
    t.saldo = t.pfandSaldo + (txn.ware || 0);
    return t;
  }

  function save() { store.set(TXN_KEY, txn); }
  function saveSettings() { store.set(SETTINGS_KEY, settings); }

  function snapshot() {
    history.push(JSON.stringify({ counts: txn.counts, ware: txn.ware }));
    if (history.length > 100) history.shift();
    $('#btn-undo').disabled = false;
  }
  function undo() {
    if (!history.length) return;
    var prev = JSON.parse(history.pop());
    txn.counts = prev.counts;
    txn.ware = prev.ware;
    save();
    updateAll();
    $('#btn-undo').disabled = history.length === 0;
    toast('Rückgängig gemacht');
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // ---------- Katalog ----------
  function renderCatalog() {
    var items = allItems().filter(function (it) { return !settings.hidden[it.id]; });
    var html = '';
    GROUPS.forEach(function (g) {
      var inGroup = items.filter(function (it) { return it.group === g.id; });
      if (!inGroup.length) return;
      html += '<section><h2 class="group-title">' + esc(g.title) + '</h2><div class="grid">';
      inGroup.forEach(function (it) {
        html +=
          '<div class="card" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="card-tap" data-act="plus" aria-label="' + esc(it.name + ' ' + it.sub) + ' hinzufügen">' +
              '<span class="card-img"><img src="' + esc(imgSrc(it.img)) + '" alt="" loading="lazy"></span>' +
              '<span class="card-text">' +
                '<span class="card-name">' + esc(it.name) + '</span>' +
                '<span class="card-sub">' + esc(it.sub) + '</span>' +
                '<span class="card-price">' + eur(it.price) + '</span>' +
              '</span>' +
            '</button>' +
            '<div class="stepper">' +
              '<button type="button" class="step step-minus" data-act="minus" aria-label="weniger">−</button>' +
              '<button type="button" class="step step-count" data-act="edit" aria-label="Anzahl eingeben">0</button>' +
              '<button type="button" class="step step-plus" data-act="plus" aria-label="mehr">+</button>' +
            '</div>' +
            '<div class="card-line"></div>' +
          '</div>';
      });
      html += '</div></section>';
    });
    if (!html) html = '<p class="muted" style="padding:24px 4px">Alle Artikel sind ausgeblendet. Unter „Preise" wieder einblenden.</p>';
    $('#catalog').innerHTML = html;
    updateAll();
  }

  function updateAll() {
    var mode = txn.mode;
    var items = itemMap();
    document.body.setAttribute('data-mode', mode);
    $$('.mode').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-mode') === mode ? 'true' : 'false');
    });

    var other = mode === 'leer' ? 'voll' : 'leer';
    $$('.card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var n = txn.counts[mode][id] || 0;
      var nOther = txn.counts[other][id] || 0;
      var it = items[id];
      card.classList.toggle('has-count', n > 0);
      $('.step-count', card).textContent = n;
      $('.step-minus', card).disabled = n === 0;
      var line = n > 0 && it ? '= ' + eur(n * it.price) : '';
      if (nOther > 0) line += (line ? ' · ' : '') + (other === 'voll' ? 'Vollgut: ' : 'Leergut: ') + nOther;
      $('.card-line', card).textContent = line;
    });

    var t = totals();
    $('#sum-leer').textContent = eur(t.leer) + (t.nleer ? ' · ' + t.nleer + ' Stk.' : '');
    $('#sum-voll').textContent = eur(t.voll) + (t.nvoll ? ' · ' + t.nvoll + ' Stk.' : '');

    var summary = $('#summary');
    summary.classList.remove('pay', 'payout');
    var label;
    if (t.saldo > 0) {
      label = txn.ware ? 'Kunde zahlt (inkl. Ware)' : 'Kunde zahlt Pfand';
      summary.classList.add('pay');
    } else if (t.saldo < 0) {
      label = 'An Kunde auszahlen';
      summary.classList.add('payout');
    } else {
      label = 'Ausgeglichen';
    }
    $('#saldo-label').textContent = label;
    $('#saldo-value').textContent = eur(Math.abs(t.saldo));

    if (!$('#receipt').hidden) renderReceipt();
  }

  function change(id, delta, absolute) {
    var counts = txn.counts[txn.mode];
    var cur = counts[id] || 0;
    var next = absolute != null ? absolute : cur + delta;
    if (next < 0) next = 0;
    if (next > 9999) next = 9999;
    if (next === cur) return;
    snapshot();
    if (next === 0) delete counts[id]; else counts[id] = next;
    save();
    updateAll();
    haptic();
    var card = $('.card[data-id="' + id + '"]');
    if (card) {
      var c = $('.step-count', card);
      c.classList.remove('bump');
      void c.offsetWidth; // Animation neu starten
      c.classList.add('bump');
    }
  }

  // ---------- Ziffernblock ----------
  var kp = null;
  function openKeypad(opts) {
    kp = { value: 0, fresh: true, money: !!opts.money, onOk: opts.onOk, initial: opts.value || 0 };
    kp.value = kp.initial;
    $('#keypad-title').textContent = opts.title;
    renderKeypad();
    openSheet('#keypad');
  }
  function renderKeypad() {
    $('#keypad-display').textContent = kp.money ? eur(kp.value) : String(kp.value);
  }
  function keypadKey(k) {
    if (!kp) return;
    var max = kp.money ? 9999999 : 9999;
    if (/^\d$/.test(k)) {
      var base = kp.fresh ? 0 : kp.value; // erste Eingabe ersetzt den alten Wert
      var v = base * 10 + parseInt(k, 10);
      if (v <= max) kp.value = v;
      kp.fresh = false;
    } else if (k === 'back') {
      kp.value = Math.floor(kp.value / 10);
      kp.fresh = false;
    } else if (k === 'C') {
      kp.value = 0;
      kp.fresh = false;
    } else if (k === 'ok') {
      var cb = kp.onOk, val = kp.value;
      closeSheet('#keypad');
      kp = null;
      cb(val);
      return;
    } else if (k === 'cancel') {
      closeSheet('#keypad');
      kp = null;
      return;
    }
    renderKeypad();
  }

  // ---------- Sheets ----------
  var lastFocus = null;
  function openSheet(sel) {
    lastFocus = document.activeElement;
    var el = $(sel);
    el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var f = $('button, input, select', el);
    if (f && sel !== '#keypad') { try { f.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  function closeSheet(sel) {
    $(sel).hidden = true;
    if ($$('.sheet-backdrop:not([hidden])').length === 0) document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  // ---------- Beleg ----------
  function receiptLines(mode, items) {
    var counts = txn.counts[mode];
    var order = allItems().map(function (it) { return it.id; });
    return Object.keys(counts)
      .filter(function (id) { return counts[id] > 0 && items[id]; })
      .sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); })
      .map(function (id) {
        var it = items[id];
        return { n: counts[id], name: it.name, sub: it.sub, price: it.price, sum: counts[id] * it.price };
      });
  }

  function renderReceipt() {
    var items = itemMap();
    var t = totals();
    var html = '';
    [['voll', 'var(--voll)'], ['leer', 'var(--leer)']].forEach(function (m) {
      var mode = m[0];
      var lines = receiptLines(mode, items);
      html += '<div class="rc-section"><h3><span class="rc-dot" style="background:' + m[1] + '"></span>' + MODES[mode] + '</h3>';
      if (!lines.length) {
        html += '<p class="rc-empty">Keine Positionen</p>';
      } else {
        html += '<table class="rc-table">';
        lines.forEach(function (l) {
          html += '<tr><td class="n">' + l.n + '×</td><td>' + esc(l.name) +
            '<span class="rc-sub">' + esc(l.sub) + ' · je ' + eur(l.price) + '</span></td>' +
            '<td class="r">' + eur(l.sum) + '</td></tr>';
        });
        html += '<tr class="total"><td></td><td>Summe</td><td class="r">' + eur(t[mode]) + '</td></tr></table>';
      }
      html += '</div>';
    });
    html += '<div class="rc-grand">' +
      '<div class="row"><span>Pfand Vollgut</span><span>+ ' + eur(t.voll) + '</span></div>' +
      '<div class="row"><span>Pfand Leergut</span><span>− ' + eur(t.leer) + '</span></div>' +
      (txn.ware ? '<div class="row"><span>Warenwert</span><span>+ ' + eur(txn.ware) + '</span></div>' : '') +
      '<div class="row big"><span>' + esc($('#saldo-label').textContent) + '</span><span>' + eur(Math.abs(t.saldo)) + '</span></div>' +
      '</div>';
    $('#receipt-body').innerHTML = html;
    $('#btn-ware').textContent = txn.ware ? 'Warenwert: ' + eur(txn.ware) : 'Warenwert eingeben';
  }

  function printReceipt() {
    var items = itemMap();
    var t = totals();
    var now = new Date();
    var html = '<h1>Pfandbeleg</h1><table>';
    html += '<tr><td colspan="2">' + now.toLocaleDateString('de-DE') + ' ' +
      now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + '</td></tr>';
    ['voll', 'leer'].forEach(function (mode) {
      var lines = receiptLines(mode, items);
      if (!lines.length) return;
      html += '<tr class="sep"><td colspan="2"><b>' + MODES[mode] + '</b></td></tr>';
      lines.forEach(function (l) {
        html += '<tr><td>' + l.n + ' × ' + esc(l.name + ' ' + l.sub) + '<br>&nbsp; je ' + eur(l.price) + '</td>' +
          '<td class="r">' + (mode === 'leer' ? '−' : '') + eur(l.sum) + '</td></tr>';
      });
    });
    html += '<tr class="sep"><td>Pfand Vollgut</td><td class="r">' + eur(t.voll) + '</td></tr>';
    html += '<tr><td>Pfand Leergut</td><td class="r">−' + eur(t.leer) + '</td></tr>';
    if (txn.ware) html += '<tr><td>Warenwert</td><td class="r">' + eur(txn.ware) + '</td></tr>';
    html += '<tr class="big"><td>' + esc($('#saldo-label').textContent) + '</td><td class="r">' + eur(Math.abs(t.saldo)) + '</td></tr>';
    html += '</table><p>Vielen Dank für Ihren Einkauf!</p>';
    $('#print-area').innerHTML = html;
    window.print();
  }

  // ---------- Einstellungen ----------
  function renderSettings() {
    var items = itemMap();
    function toggle(id) {
      var on = !settings.hidden[id];
      return '<button type="button" class="set-toggle" data-toggle="' + esc(id) + '" aria-pressed="' + on + '" aria-label="' +
        (on ? 'Ausblenden' : 'Einblenden') + '">' + (on ? '✓' : '–') + '</button>';
    }
    function row(it, inner) {
      return '<div class="set-row' + (settings.hidden[it.id] ? ' off' : '') + '">' +
        '<img src="' + esc(imgSrc(it.img)) + '" alt="">' +
        '<div class="set-name">' + esc(it.name) + '<small>' + esc(it.sub) + '</small></div>' + inner + '</div>';
    }
    var html = '<div class="set-group"><h4>Einzelpfand</h4>';
    BASE.forEach(function (b) {
      html += row(items[b.id],
        '<input class="set-price" type="text" inputmode="decimal" data-price="' + b.id + '" value="' +
        esc(eur(basePrice(b.id)).replace(/\s?€/, '')) + '" aria-label="Pfand ' + esc(b.name) + ' in Euro">' + toggle(b.id));
    });
    html += '</div><div class="set-group"><h4>Kästen komplett (automatisch)</h4>';
    COMBOS.forEach(function (c) {
      var it = items[c.id];
      html += row(it, '<span class="set-calc">' + eur(it.price) + '</span>' + toggle(c.id));
    });
    html += '</div>';
    if (settings.custom.length) {
      html += '<div class="set-group"><h4>Eigene Artikel</h4>';
      settings.custom.forEach(function (c) {
        html += row(items[c.id],
          '<input class="set-price" type="text" inputmode="decimal" data-cprice="' + esc(c.id) + '" value="' +
          esc(eur(c.price).replace(/\s?€/, '')) + '" aria-label="Pfand ' + esc(c.name) + ' in Euro">' +
          '<button type="button" class="set-del" data-del="' + esc(c.id) + '" aria-label="Löschen">🗑</button>');
      });
      html += '</div>';
    }
    $('#settings-list').innerHTML = html;
  }

  function onSettingsChange(e) {
    var el = e.target;
    var id = el.getAttribute('data-price');
    var cid = el.getAttribute('data-cprice');
    if (!id && !cid) return;
    var cents = parseEur(el.value);
    if (cents == null) {
      toast('Ungültiger Betrag');
      renderSettings();
      return;
    }
    if (id) settings.prices[id] = cents;
    if (cid) settings.custom.forEach(function (c) { if (c.id === cid) c.price = cents; });
    saveSettings();
    renderSettings();
    renderCatalog();
    toast('Pfandwert gespeichert');
  }

  function onSettingsClick(e) {
    var t = e.target.closest ? e.target.closest('[data-toggle],[data-del]') : null;
    if (!t) return;
    var id = t.getAttribute('data-toggle');
    if (id) {
      if (settings.hidden[id]) delete settings.hidden[id]; else settings.hidden[id] = true;
    }
    var del = t.getAttribute('data-del');
    if (del) {
      settings.custom = settings.custom.filter(function (c) { return c.id !== del; });
      delete txn.counts.leer[del];
      delete txn.counts.voll[del];
      save();
    }
    saveSettings();
    renderSettings();
    renderCatalog();
  }

  // ---------- Installationshinweis (iOS Safari) ----------
  function maybeShowInstallHint() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIOS && !standalone && !store.get(HINT_KEY, false)) $('#install-hint').hidden = false;
  }

  // ---------- Events ----------
  function init() {
    // Polyfill für Element.closest (ältere Browser)
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (s) {
        var el = this;
        while (el && el.nodeType === 1) {
          if ((el.matches || el.msMatchesSelector || el.webkitMatchesSelector).call(el, s)) return el;
          el = el.parentNode;
        }
        return null;
      };
    }

    $$('.mode').forEach(function (b) {
      b.addEventListener('click', function () {
        txn.mode = b.getAttribute('data-mode');
        save();
        updateAll();
        haptic();
      });
    });

    $('#catalog').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var card = btn.closest('.card');
      var id = card.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'plus') change(id, 1);
      else if (act === 'minus') change(id, -1);
      else if (act === 'edit') {
        var it = itemMap()[id];
        openKeypad({
          title: (it ? it.name + ' ' + it.sub : 'Anzahl') + ' – ' + MODES[txn.mode],
          value: txn.counts[txn.mode][id] || 0,
          onOk: function (v) { change(id, 0, v); }
        });
      }
    });

    $('#keypad').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) { keypadKey('cancel'); return; }
      var k = e.target.closest('[data-key]');
      if (k) keypadKey(k.getAttribute('data-key'));
    });
    document.addEventListener('keydown', function (e) {
      if (!$('#keypad').hidden) {
        if (/^\d$/.test(e.key)) keypadKey(e.key);
        else if (e.key === 'Backspace') keypadKey('back');
        else if (e.key === 'Enter') { e.preventDefault(); keypadKey('ok'); }
        else if (e.key === 'Escape') keypadKey('cancel');
        return;
      }
      if (e.key === 'Escape') {
        $$('.sheet-backdrop:not([hidden])').forEach(function (s) { closeSheet('#' + s.id); });
      }
    });

    $$('#receipt, #settings').forEach(function (sheet) {
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet || e.target.closest('[data-close]')) closeSheet('#' + sheet.id);
      });
    });

    $('#btn-undo').addEventListener('click', undo);

    $('#btn-new').addEventListener('click', function () {
      var t = totals();
      if (!t.nleer && !t.nvoll && !txn.ware) { toast('Noch nichts erfasst'); return; }
      snapshot();
      txn = emptyTxn('leer');
      save();
      updateAll();
      window.scrollTo(0, 0);
      toast('Neuer Kunde – „Zurück" stellt wieder her');
    });

    $('#btn-receipt').addEventListener('click', function () {
      renderReceipt();
      openSheet('#receipt');
    });
    $('#btn-print').addEventListener('click', printReceipt);
    $('#btn-ware').addEventListener('click', function () {
      openKeypad({
        title: 'Warenwert (ohne Pfand)',
        money: true,
        value: txn.ware || 0,
        onOk: function (v) {
          if (v === txn.ware) return;
          snapshot();
          txn.ware = v;
          save();
          updateAll();
        }
      });
    });

    $('#btn-settings').addEventListener('click', function () {
      renderSettings();
      openSheet('#settings');
    });
    $('#settings-list').addEventListener('change', onSettingsChange);
    $('#settings-list').addEventListener('click', onSettingsClick);
    $('#settings-list').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList.contains('set-price')) e.target.blur();
    });

    var sel = $('#custom-img');
    sel.innerHTML = IMAGES.map(function (i) { return '<option value="' + i[0] + '">' + esc(i[1]) + '</option>'; }).join('');
    $('#custom-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var name = f.elements.name.value.trim();
      var cents = parseEur(f.elements.price.value);
      if (!name) return;
      if (cents == null) { toast('Ungültiger Betrag'); return; }
      settings.custom.push({ id: 'c_' + Date.now().toString(36), name: name, price: cents, img: f.elements.img.value });
      saveSettings();
      f.reset();
      renderSettings();
      renderCatalog();
      toast('Artikel hinzugefügt');
    });

    $('#btn-defaults').addEventListener('click', function () {
      if (!window.confirm('Alle Pfandwerte zurücksetzen und eigene Artikel löschen?')) return;
      settings.custom.forEach(function (c) { delete txn.counts.leer[c.id]; delete txn.counts.voll[c.id]; });
      settings = emptySettings();
      saveSettings();
      save();
      renderSettings();
      renderCatalog();
      toast('Standardwerte wiederhergestellt');
    });

    $('#hint-close').addEventListener('click', function () {
      $('#install-hint').hidden = true;
      store.set(HINT_KEY, true);
    });

    renderCatalog();
    maybeShowInstallHint();

    // Offline-Fähigkeit
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline-Cache optional */ });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

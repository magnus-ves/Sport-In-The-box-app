'use strict';

// Alle SIB-kall går via serveren (/sib/...), som legger på passordet og
// videresender til Sport In The Box. Stiene under er som i SIB sin API-doc.
const SIB = {
  quickbuttons: () => '/api/quickbutton/',
  quickTrigger: (triggerId) => `/api/quickbutton/trig/${triggerId}`,

  rundowns: () => '/api/rundown-with-items/',
  selection: () => '/api/rundown/selection',
  selectRundown: (rd) => `/api/rundown/select-rundown/${rd}`,
  itemRun: (rd, item) => `/api/rundown/item-run/${rd}/${item}`,
  selectedRun: (rd) => `/api/rundown/selected-run/${rd}`,
  previousRun: (rd) => `/api/rundown/item-previous-run/${rd}`,
  nextRun: (rd) => `/api/rundown/item-next-run/${rd}`,
  selectPrevious: () => '/api/rundown/select-previous',
  selectNext: () => '/api/rundown/select-next',

  playlist: (id) => `/api/playlist/${id}`,
  playFromStart: (id) => `/api/playlist/trig/from_start/${id}/`,
  playFromLast: (id) => `/api/playlist/trig/from_last/${id}/`,
  playFromItem: (id, item) => `/api/playlist/trig/from_item/${id}/item/${item}/`,

  streams: () => '/api/streams/',
  streamControl: (id, action) => `/api/stream-control/${id}/${action}/`,
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c != null) node.append(c);
  return node;
};

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* privat modus */ } },
};

// ---------------------------------------------------------------------------
// API-hjelpere
// ---------------------------------------------------------------------------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/sib' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body,
  });
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (_) { /* ikke JSON */ }
  if (!res.ok) {
    const msg = (data && data.error) || (res.status === 401 || res.status === 403
      ? 'Ingen tilgang — sjekk API-passordet under Innstillinger'
      : res.status === 404 ? 'Ikke funnet i Sport In The Box (404)' : `Feil fra Sport In The Box (${res.status})`);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 1600);
}

function flash(node, ok) {
  if (!node) return;
  const cls = ok ? 'flash-ok' : 'flash-err';
  node.classList.remove('flash-ok', 'flash-err');
  void node.offsetWidth; // start animasjonen på nytt
  node.classList.add(cls);
}

// Sender en kommando og gir visuell tilbakemelding på knappen som ble trykket.
async function command(path, label, node) {
  node && node.classList.add('busy');
  try {
    await api(path);
    flash(node, true);
    if (label) toast(label);
    return true;
  } catch (err) {
    flash(node, false);
    toast(err.message, true);
    return false;
  } finally {
    node && node.classList.remove('busy');
  }
}

// SIB bruker #RRGGBB og #RRGGBBAA. Returnerer null for helt transparente farger.
function sibColor(hex) {
  if (!hex || !/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  if (hex.length === 9 && hex.slice(7).toLowerCase() === '00') return null;
  return hex;
}

function isLight(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

function base64Image(data) {
  if (!data || data.length < 16) return null;
  if (data.startsWith('data:')) return data;
  const mime = data.startsWith('/9j/') ? 'image/jpeg'
    : data.startsWith('PHN2') || data.startsWith('PD94') ? 'image/svg+xml'
    : data.startsWith('R0lG') ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${data}`;
}

function empty(msg) { return el('div', { className: 'empty', textContent: msg }); }

// ---------------------------------------------------------------------------
// Faner
// ---------------------------------------------------------------------------
const loaders = {};
let currentView = 'quick';

function showView(name) {
  currentView = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  store.set('sib.view', name);
  if (loaders[name]) loaders[name]();
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-goto]');
  if (link) { e.preventDefault(); showView(link.dataset.goto); }
});

// ---------------------------------------------------------------------------
// Tilkoblingsstatus
// ---------------------------------------------------------------------------
async function checkHealth() {
  const conn = $('#conn');
  try {
    const h = await (await fetch('/health')).json();
    conn.className = 'conn ' + (h.online ? 'online' : 'offline');
    $('#conn-text').textContent = h.online ? 'Tilkoblet SIB' : 'SIB svarer ikke';
    conn.title = h.online ? `${h.sibUrl} (${h.ms} ms)` : `${h.sibUrl}: ${h.error}`;
  } catch (_) {
    conn.className = 'conn offline';
    $('#conn-text').textContent = 'Server frakoblet';
    conn.title = 'Får ikke kontakt med SIB Kontroll-serveren';
  }
}

// ---------------------------------------------------------------------------
// Hurtigknapper
// ---------------------------------------------------------------------------
loaders.quick = async function loadQuickButtons() {
  const wrap = $('#quick-groups');
  if (!wrap.children.length) wrap.replaceChildren(empty('Laster hurtigknapper…'));
  let groups;
  try {
    groups = await api(SIB.quickbuttons());
  } catch (err) {
    wrap.replaceChildren(empty(err.message));
    return;
  }
  if (!Array.isArray(groups) || !groups.length) {
    wrap.replaceChildren(empty('Ingen hurtigknapper funnet i Sport In The Box.'));
    return;
  }
  wrap.replaceChildren(...groups.map((g) => {
    const buttons = (g.Buttons || []).map((b) => {
      const bg = sibColor(b.BackgroundColor) || '#3f6d8f';
      const img = base64Image(b.Icon);
      const key = (b.Shortcut || '').split(',');
      const shortcut = key[0]
        ? [key[2] === 'True' && 'Ctrl', key[1] === 'True' && 'Alt', key[3] === 'True' && 'Shift', key[0]].filter(Boolean).join('+')
        : '';
      const btn = el('button', { className: 'qbtn' + (isLight(bg) ? ' light' : ''), title: `Trigger-ID ${b.TriggerId}` },
        img ? el('img', { src: img, alt: '' }) : null,
        el('span', { textContent: b.ButtonText || `Knapp ${b.TriggerId}` }),
        shortcut ? el('span', { className: 'shortcut', textContent: shortcut }) : null);
      btn.style.background = bg;
      btn.addEventListener('click', () => command(SIB.quickTrigger(b.TriggerId), b.ButtonText, btn));
      return btn;
    });
    const swatch = el('span', { className: 'swatch' });
    swatch.style.background = sibColor(g.BackgroundColor) || 'transparent';
    return el('div', { className: 'quick-group' },
      el('h2', {}, swatch, g.ButtonText || 'Gruppe'),
      buttons.length ? el('div', { className: 'quick-grid' }, ...buttons) : empty('Tom gruppe'));
  }));
};
$('#quick-refresh').addEventListener('click', () => loaders.quick());

// ---------------------------------------------------------------------------
// Rundown
// ---------------------------------------------------------------------------
let rundowns = [];
let selection = null;
let rundownId = store.get('sib.rundown', null);
let selectionTimer = null;

function formatClock(iso) {
  if (!iso || iso.startsWith('0001-')) return '';
  const m = iso.match(/T(\d{2}:\d{2})(:\d{2})?/);
  return m ? m[1] + (m[2] && m[2] !== ':00' ? m[2] : '') : '';
}

function renderRundownSelect() {
  const sel = $('#rundown-select');
  sel.replaceChildren(...rundowns.map((r) => el('option', { value: r.Id, textContent: r.Name })));
  sel.value = rundownId;
}

function renderRundownItems() {
  const list = $('#rundown-items');
  const rd = rundowns.find((r) => r.Id === rundownId);
  if (!rd) { list.replaceChildren(empty('Ingen rundown valgt.')); return; }
  const items = [...(rd.Items || [])].sort((a, b) => a.Order - b.Order);
  if (!items.length) { list.replaceChildren(empty('Denne rundownen har ingen elementer.')); return; }
  const selectedId = selection && selection.SelectedItems ? Number(selection.SelectedItems[rd.Id]) : null;
  list.replaceChildren(...items.map((it) => {
    const bar = el('span', { className: 'bar' });
    bar.style.background = sibColor(it.ColorHex) || 'var(--border)';
    const li = el('li', { className: 'rd-item' + (it.Id === selectedId ? ' selected' : '') },
      bar,
      el('span', { className: 'ident', textContent: it.Ident || '' }),
      el('span', { className: 'clock', textContent: formatClock(it.Clock) }),
      el('span', {}, el('div', { className: 'name', textContent: it.Name || '' }),
        it.Description ? el('div', { className: 'desc', textContent: it.Description }) : null),
      it.HasEvents ? el('span', { className: 'badge', textContent: 'Hendelser' }) : el('span'));
    li.dataset.id = it.Id;
    li.addEventListener('click', async () => {
      if (await command(SIB.itemRun(rd.Id, it.Id), `Kjører ${it.Ident || ''} ${it.Name || ''}`.trim(), li)) refreshSelection();
    });
    return li;
  }));
}

async function refreshSelection() {
  try {
    const s = await api(SIB.selection());
    if (JSON.stringify(s) !== JSON.stringify(selection)) {
      selection = s;
      renderRundownItems();
      const sel = document.querySelector('.rd-item.selected');
      if (sel && currentView === 'rundown') sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch (_) { /* vises via tilkoblingsstatus */ }
}

loaders.rundown = async function loadRundowns() {
  const list = $('#rundown-items');
  if (!rundowns.length) list.replaceChildren(empty('Laster rundowns…'));
  try {
    const [all, sel] = await Promise.all([api(SIB.rundowns()), api(SIB.selection()).catch(() => null)]);
    rundowns = Array.isArray(all) ? [...all].sort((a, b) => a.Order - b.Order) : [];
    selection = sel;
  } catch (err) {
    list.replaceChildren(empty(err.message));
    return;
  }
  if (!rundowns.length) { list.replaceChildren(empty('Ingen rundowns funnet i Sport In The Box.')); return; }
  if (!rundowns.some((r) => r.Id === rundownId)) {
    rundownId = (selection && rundowns.some((r) => r.Id === selection.SelectedRundown))
      ? selection.SelectedRundown : rundowns[0].Id;
  }
  renderRundownSelect();
  renderRundownItems();
};

$('#rundown-select').addEventListener('change', (e) => {
  rundownId = Number(e.target.value);
  store.set('sib.rundown', rundownId);
  renderRundownItems();
});
$('#rundown-refresh').addEventListener('click', () => loaders.rundown());
$('#rundown-show').addEventListener('click', (e) =>
  command(SIB.selectRundown(rundownId), 'Rundown vist i SIB', e.currentTarget));

const rundownAction = (id, pathFn, label) => $(id).addEventListener('click', async (e) => {
  if (rundownId == null) return toast('Velg en rundown først', true);
  if (await command(pathFn(rundownId), label, e.currentTarget)) refreshSelection();
});
rundownAction('#rd-prev-run', SIB.previousRun, 'Kjører forrige');
rundownAction('#rd-selected-run', SIB.selectedRun, 'Kjører valgt element');
rundownAction('#rd-next-run', SIB.nextRun, 'Kjører neste');
rundownAction('#rd-select-prev', () => SIB.selectPrevious(), null);
rundownAction('#rd-select-next', () => SIB.selectNext(), null);

// ---------------------------------------------------------------------------
// Spillelister
// ---------------------------------------------------------------------------
let serverConfig = { sibUrl: '', hasPassword: false, playlists: [] };

loaders.playlists = async function loadPlaylists() {
  const wrap = $('#playlist-cards');
  const lists = serverConfig.playlists || [];
  if (!lists.length) {
    wrap.replaceChildren(empty('Ingen spillelister lagt inn ennå. Legg dem til under Innstillinger.'));
    return;
  }
  wrap.replaceChildren(...lists.map((pl) => {
    const title = pl.name || `Spilleliste ${pl.id}`;
    const body = el('div', { className: 'muted', textContent: 'Laster filer…' });
    const start = el('button', { className: 'btn primary', textContent: 'Start fra begynnelsen' });
    const resume = el('button', { className: 'btn', textContent: 'Fortsett fra sist' });
    start.addEventListener('click', () => command(SIB.playFromStart(pl.id), `Starter ${title}`, start));
    resume.addEventListener('click', () => command(SIB.playFromLast(pl.id), `Fortsetter ${title}`, resume));
    const card = el('div', { className: 'card playlist-card' },
      el('h2', { textContent: title }),
      el('div', { className: 'muted', textContent: `ID ${pl.id}` }),
      el('div', { className: 'actions' }, start, resume),
      body);

    api(SIB.playlist(pl.id)).then((files) => {
      if (!Array.isArray(files) || !files.length) { body.replaceWith(el('div', { className: 'muted', textContent: 'Ingen filer i spillelisten.' })); return; }
      body.replaceWith(el('ul', {}, ...files.map((f, i) => {
        const b = el('button', { className: 'btn', textContent: `${i + 1}. ${f.MedialistItemName}` });
        b.addEventListener('click', () => command(SIB.playFromItem(pl.id, f.MedialistItemOid), `Spiller ${f.MedialistItemName}`, b));
        return el('li', {}, b);
      })));
    }).catch((err) => body.replaceWith(el('div', { className: 'err', textContent: err.message })));
    return card;
  }));
};
$('#playlists-refresh').addEventListener('click', () => loaders.playlists());

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------
loaders.streams = async function loadStreams() {
  const wrap = $('#stream-list');
  if (!wrap.children.length) wrap.replaceChildren(empty('Laster strømmer…'));
  let streams;
  try {
    streams = await api(SIB.streams());
  } catch (err) {
    wrap.replaceChildren(empty(err.message));
    return;
  }
  if (!Array.isArray(streams) || !streams.length) { wrap.replaceChildren(empty('Ingen strømmer satt opp i Sport In The Box.')); return; }
  wrap.replaceChildren(...streams.map((s) => {
    const live = !!s.IsStreaming;
    const btn = el('button', { className: 'btn big ' + (live ? 'stop' : 'primary'), textContent: live ? 'Stopp' : 'Start' });
    btn.addEventListener('click', async () => {
      const action = live ? 'STOP' : 'START';
      if (live && !confirm(`Stoppe «${s.Name}»?`)) return;
      if (await command(SIB.streamControl(s.Id, action), live ? `Stoppet ${s.Name}` : `Startet ${s.Name}`, btn)) {
        setTimeout(loaders.streams, 600);
      }
    });
    return el('div', { className: 'card stream' + (live ? ' live' : '') },
      el('div', { className: 'info' },
        el('div', { className: 'name', textContent: s.Name || `Strøm ${s.Id}` }),
        el('div', { className: 'state' }, el('span', { className: 'dot' }), live ? 'Sender direkte' : 'Stoppet')),
      btn);
  }));
};
$('#streams-refresh').addEventListener('click', () => loaders.streams());

// ---------------------------------------------------------------------------
// Innstillinger
// ---------------------------------------------------------------------------
function addPlaylistRow(pl = { id: '', name: '' }) {
  const row = $('#tpl-playlist-row').content.firstElementChild.cloneNode(true);
  $('.pl-id', row).value = pl.id;
  $('.pl-name', row).value = pl.name;
  $('.pl-remove', row).addEventListener('click', () => row.remove());
  $('#cfg-playlists').append(row);
}

function fillSettings() {
  $('#cfg-url').value = serverConfig.sibUrl;
  $('#cfg-password').value = '';
  $('#cfg-clear-password').checked = false;
  $('#cfg-password-status').textContent = serverConfig.hasPassword
    ? 'Et passord er lagret på serveren. La feltet stå tomt for å beholde det.'
    : 'Ingen passord lagret — bruk dette hvis SIB-API-et er passordbeskyttet.';
  $('#cfg-playlists').replaceChildren();
  (serverConfig.playlists || []).forEach(addPlaylistRow);
}

async function loadConfig() {
  try {
    serverConfig = await (await fetch('/config')).json();
  } catch (_) { /* server nede — vises i statusfeltet */ }
}

loaders.settings = async function () { await loadConfig(); fillSettings(); };

$('#cfg-add-playlist').addEventListener('click', () => addPlaylistRow());

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#cfg-status');
  const payload = {
    sibUrl: $('#cfg-url').value.trim(),
    playlists: [...document.querySelectorAll('.cfg-playlist')].map((row) => ({
      id: $('.pl-id', row).value.trim(),
      name: $('.pl-name', row).value.trim(),
    })).filter((p) => p.id),
  };
  const bad = payload.playlists.find((p) => !/^\d+$/.test(p.id));
  if (bad) { toast(`Ugyldig spilleliste-ID: «${bad.id}» (må være et tall)`, true); return; }
  const pw = $('#cfg-password').value;
  if ($('#cfg-clear-password').checked) payload.password = '';
  else if (pw) payload.password = pw;

  status.textContent = 'Lagrer…';
  try {
    const res = await fetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunne ikke lagre');
    serverConfig = data;
    fillSettings();
    status.textContent = '';
    toast('Innstillinger lagret');
    checkHealth();
  } catch (err) {
    status.textContent = '';
    toast(err.message, true);
  }
});

$('#custom-method').addEventListener('change', (e) => { $('#custom-body').hidden = e.target.value !== 'POST'; });
$('#custom-send').addEventListener('click', async () => {
  const out = $('#custom-output');
  let path = $('#custom-path').value.trim();
  if (!path) return;
  path = path.replace(/^https?:\/\/[^/]+/i, ''); // godta hele URL-er fra dokumentasjonen
  if (!path.startsWith('/')) path = '/' + path;
  const method = $('#custom-method').value;
  out.textContent = `${method} ${path} …`;
  try {
    const data = await api(path, method === 'POST' ? { method, body: $('#custom-body').value || '[]' } : {});
    out.textContent = data == null || data === '' ? 'OK (tomt svar)' : (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } catch (err) {
    out.textContent = `Feil: ${err.message}`;
  }
});

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------
(async function init() {
  await loadConfig();
  checkHealth();
  setInterval(checkHealth, 5000);
  // Hold rundown-markeringen i synk med SIB mens fanen er åpen.
  selectionTimer = setInterval(() => {
    if (currentView === 'rundown' && !document.hidden && rundowns.length) refreshSelection();
  }, 2000);
  const initial = store.get('sib.view', 'quick');
  showView(document.getElementById(`view-${initial}`) ? initial : 'quick');
})();

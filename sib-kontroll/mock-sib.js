#!/usr/bin/env node
// Enkel etterligning av Sport In The Box sitt REST-API (port 8080), med
// eksempeldata fra API-dokumentasjonen. Brukes til å teste SIB Kontroll uten
// en ekte SIB-installasjon:   node mock-sib.js   (valgfritt: MOCK_PASSWORD=hemmelig)

const http = require('http');

const PORT = Number(process.env.MOCK_PORT) || 8080;
const PASSWORD = process.env.MOCK_PASSWORD || '';

const svg = (color) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="${color}"/></svg>`
).toString('base64');

const item = (ParentId, Id, Order, Ident, Clock, Name, Description, ColorHex, HasEvents = false) =>
  ({ ParentId, Id, Order, Ident, Clock, Name, Description, ColorHex, HasEvents });

const rundowns = [
  {
    Id: 2, Order: 1, Name: 'Match rundown', ColorHex: '#FFC196', IconId: 'fade_out', SvgIcon: svg('#e67e22'),
    Items: [
      item(2, 19, 0, 'A1', '2024-04-24T18:00:00', 'Intro', 'Intro 1', '#FFC196FF', true),
      item(2, 20, 1, 'A2', '2024-04-24T18:01:00', 'Intro 2', 'Intro 2', '#FFC196'),
      item(2, 21, 2, 'A3', '2024-04-24T18:05:00', 'Ads loop', 'Advertisements', '#FFC196'),
      item(2, 22, 3, 'B1', '2024-04-24T18:30:00', 'Pres', 'Home team presentation', '#FF6F9F'),
      item(2, 23, 4, 'B2', '2024-04-24T18:32:00', 'Pres', 'Guest team presentation', '#FF6F9F'),
      item(2, 24, 5, 'B3', '2024-04-24T18:35:00', 'Pres', 'Pre-start videos', '#FF6F9F'),
      item(2, 25, 6, 'C1', '2024-04-24T19:00:00', 'Break', 'Playlist break 1', '#FFFFFF00'),
      item(2, 26, 7, 'C2', '2024-04-24T19:25:00', 'Break', 'Playlist break 2', '#FFFFFF00'),
      item(2, 27, 8, 'C3', '2024-04-24T20:00:00', 'End', 'End of match loo', '#FFFFFF00'),
      item(2, 28, 9, 'C4', '2024-04-24T00:10:00', 'End 2', 'Post-game loop', '#FFFFFF00'),
      item(2, 29, 10, 'E1', '0001-01-01T00:00:00', 'Exit loop', 'Game ended', '#9BCFFFFF', true),
    ],
  },
  { Id: 4, Order: 2, Name: 'New rundown 3', ColorHex: '#FFFFFF00', IconId: 'rundown', SvgIcon: svg('#3f6d8f'), Items: [] },
];

const quickbuttons = [
  {
    QuickButtonGroupOid: 1, ButtonText: 'Mål', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#FFA500',
    Buttons: [
      { QuickButtonOid: 2, TriggerId: 8, ButtonText: 'Mål hjemme', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#5F9EA0', Shortcut: 'G,False,True,False' },
      { QuickButtonOid: 3, TriggerId: 9, ButtonText: 'Mål borte', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#B22222', Shortcut: '' },
    ],
  },
  {
    QuickButtonGroupOid: 2, ButtonText: 'Lyd', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#000000',
    Buttons: [
      { QuickButtonOid: 4, TriggerId: 10, ButtonText: 'Horn', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#000000', Shortcut: '' },
      { QuickButtonOid: 5, TriggerId: 11, ButtonText: 'Timeout', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#2E8B57', Shortcut: '' },
      { QuickButtonOid: 6, TriggerId: 12, ButtonText: 'Periode slutt', Icon: '', IconIndex: 0, IconType: 0, BackgroundColor: '#6A5ACD', Shortcut: '' },
    ],
  },
];

const playlists = {
  1: [{ MedialistItemOid: 2, MedialistItemName: 'iccms_1' }, { MedialistItemOid: 3, MedialistItemName: 'iccms_2' }],
  5: [{ MedialistItemOid: 7, MedialistItemName: 'Sponsor A' }, { MedialistItemOid: 8, MedialistItemName: 'Sponsor B' }, { MedialistItemOid: 9, MedialistItemName: 'Sponsor C' }],
};

const streams = [{ Id: 1, Name: 'ICCMS Stream 1', IsStreaming: false }, { Id: 2, Name: 'YouTube', IsStreaming: false }];
const selection = { SelectedRundown: 2, SelectedItems: { 2: 19, 4: 0 } };

function moveSelection(delta, run) {
  const rd = rundowns.find((r) => r.Id === selection.SelectedRundown);
  if (!rd || !rd.Items.length) return;
  const idx = rd.Items.findIndex((i) => i.Id === selection.SelectedItems[rd.Id]);
  const next = rd.Items[Math.max(0, Math.min(rd.Items.length - 1, idx + delta))];
  selection.SelectedItems[rd.Id] = next.Id;
  if (run) console.log(`  -> kjører "${next.Ident} ${next.Name}"`);
}

http.createServer((req, res) => {
  // CORS, slik at web-versjonen av Expo-appen (sib-app) kan testes direkte mot mocken.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let parts = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
  if (PASSWORD) {
    if (parts[parts.length - 1] !== PASSWORD) { console.log(`401 ${req.method} ${req.url}`); res.writeHead(401); return res.end(); }
    parts = parts.slice(0, -1);
  }
  const p = parts.join('/');
  const json = (body) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const ok = () => { res.writeHead(200); res.end(); };
  const nf = () => { res.writeHead(404); res.end(); };
  console.log(`${req.method} /${p}`);
  let m;

  if (p === 'api/quickbutton') return json(quickbuttons);
  if ((m = p.match(/^api\/quickbutton\/trig\/(\d+)$/))) return ok();

  if (p === 'api/rundown-with-items') return json(rundowns);
  if (p === 'api/rundown-without-items') return json(rundowns.map(({ Items, ...r }) => r));
  if ((m = p.match(/^api\/rundown-item\/(\d+)$/))) {
    const it = rundowns.flatMap((r) => r.Items).find((i) => i.Id === +m[1]);
    return it ? json(it) : nf();
  }
  if (p === 'api/rundown/selection') return json(selection);
  if ((m = p.match(/^api\/rundown\/select-rundown\/(\d+)$/))) { selection.SelectedRundown = +m[1]; return ok(); }
  if ((m = p.match(/^api\/rundown\/item-run\/(\d+)\/(\d+)$/))) {
    selection.SelectedRundown = +m[1]; selection.SelectedItems[m[1]] = +m[2]; return ok();
  }
  if ((m = p.match(/^api\/rundown\/selected-run\/(\d+)$/))) return ok();
  if ((m = p.match(/^api\/rundown\/item-next-run\/(\d+)$/))) { selection.SelectedRundown = +m[1]; moveSelection(1, true); return ok(); }
  if ((m = p.match(/^api\/rundown\/item-previous-run\/(\d+)$/))) { selection.SelectedRundown = +m[1]; moveSelection(-1, true); return ok(); }
  if (p === 'api/rundown/select-next') { moveSelection(1); return ok(); }
  if (p === 'api/rundown/select-previous') { moveSelection(-1); return ok(); }

  if ((m = p.match(/^api\/playlist\/(\d+)$/))) return playlists[m[1]] ? json(playlists[m[1]]) : nf();
  if ((m = p.match(/^api\/playlist\/trig\/(from_start|from_last)\/(\d+)$/))) return playlists[m[2]] ? ok() : nf();
  if ((m = p.match(/^api\/playlist\/trig\/from_item\/(\d+)\/item\/(\d+)$/))) return playlists[m[1]] ? ok() : nf();

  if (p === 'api/streams' || p === 'api/streams/pass') return json(streams);
  if ((m = p.match(/^api\/stream-control\/(\d+)\/(START|STOP)$/))) {
    const s = streams.find((x) => x.Id === +m[1]);
    if (!s) return nf();
    s.IsStreaming = m[2] === 'START';
    return ok();
  }
  nf();
}).listen(PORT, () => console.log(`Mock Sport In The Box-API på http://localhost:${PORT}${PASSWORD ? ' (med passord)' : ''}`));

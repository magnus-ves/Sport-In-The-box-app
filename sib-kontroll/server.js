#!/usr/bin/env node
// SIB Kontroll — liten server uten avhengigheter som
//  1) serverer fjernkontroll-appen (public/) til nettbrett/telefon på samme nett
//  2) videresender /sib/* til Sport In The Box sitt REST-API (unngår CORS)
//  3) legger på API-passordet på serversiden, slik at klientene aldri ser det
//
// Start:  node server.js            (port 3000, SIB på http://localhost:8080)
//         PORT=4000 SIB_URL=http://192.168.1.50:8080 SIB_PASSWORD=hemmelig node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = process.env.SIB_CONFIG || path.join(__dirname, 'config.json');
const TIMEOUT_MS = 5000;

const DEFAULT_CONFIG = {
  sibUrl: 'http://localhost:8080',
  password: '',
  playlists: [], // [{ id: 12, name: 'Pauseloop' }] — SIB-API-et har ikke et kall for å liste spillelister
};

function loadConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch (_) { /* første oppstart — bruk standardverdier */ }
  if (process.env.SIB_URL) cfg.sibUrl = process.env.SIB_URL;
  if (process.env.SIB_PASSWORD !== undefined) cfg.password = process.env.SIB_PASSWORD;
  return cfg;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();

// SIB tar passordet som siste path-segment, f.eks.
//   /api/quickbutton/trig/8/        ->  /api/quickbutton/trig/8/hemmelig/
//   /api/playlist/3                 ->  /api/playlist/3/hemmelig
//   /api/streams/                   ->  /api/streams/hemmelig/
function withPassword(apiPath, password) {
  if (!password) return apiPath;
  const trailing = apiPath.endsWith('/');
  const base = trailing ? apiPath.slice(0, -1) : apiPath;
  return `${base}/${encodeURIComponent(password)}${trailing ? '/' : ''}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('For stor forespørsel')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyToSib(req, res, apiPath) {
  let target;
  try {
    target = new URL(withPassword(apiPath, config.password), config.sibUrl);
  } catch (_) {
    return sendJson(res, 400, { error: `Ugyldig SIB-adresse: ${config.sibUrl}` });
  }
  const init = { method: req.method, signal: AbortSignal.timeout(TIMEOUT_MS), headers: {} };
  if (req.method === 'POST' || req.method === 'PUT') {
    init.body = await readBody(req);
    init.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
  }
  try {
    const upstream = await fetch(target, init);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'tidsavbrudd' : (err.cause && err.cause.code) || err.message;
    sendJson(res, 502, { error: `Får ikke kontakt med Sport In The Box på ${config.sibUrl} (${reason})` });
  }
}

// "Tilkoblet" = SIB svarer med hva som helst (også 404). Bare nettverksfeil regnes som frakoblet.
async function health(res) {
  const started = Date.now();
  try {
    const r = await fetch(new URL(withPassword('/api/rundown/selection', config.password), config.sibUrl),
      { signal: AbortSignal.timeout(2500) });
    sendJson(res, 200, { online: true, status: r.status, ms: Date.now() - started, sibUrl: config.sibUrl });
  } catch (err) {
    sendJson(res, 200, { online: false, error: (err.cause && err.cause.code) || err.name, sibUrl: config.sibUrl });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Ikke funnet'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/sib/')) {
      return await proxyToSib(req, res, url.pathname.slice(4));
    }
    if (url.pathname === '/health') return await health(res);
    if (url.pathname === '/config' && req.method === 'GET') {
      // Passordet sendes aldri ut — bare om det er satt.
      return sendJson(res, 200, { sibUrl: config.sibUrl, hasPassword: !!config.password, playlists: config.playlists });
    }
    if (url.pathname === '/config' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const next = { ...config };
      if (typeof body.sibUrl === 'string') {
        const u = new URL(body.sibUrl.trim()); // kaster ved ugyldig adresse
        next.sibUrl = u.origin;
      }
      if (typeof body.password === 'string') next.password = body.password;
      if (Array.isArray(body.playlists)) {
        next.playlists = body.playlists
          .map((p) => ({ id: String(p.id).trim(), name: String(p.name || '').trim() }))
          .filter((p) => /^\d+$/.test(p.id));
      }
      config = next;
      saveConfig(config);
      return sendJson(res, 200, { ok: true, sibUrl: config.sibUrl, hasPassword: !!config.password, playlists: config.playlists });
    }
    if (req.method === 'GET') return serveStatic(req, res, url.pathname);
    res.writeHead(405); res.end();
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SIB Kontroll kjører — styrer ${config.sibUrl}`);
  console.log(`  På denne PC-en:   http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Nettbrett/mobil:  http://${a.address}:${PORT}`);
    }
  }
});

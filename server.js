/**
 * ProShare - internetsiz/kurulumsuz dosya paylaşımı için eşleştirme sunucusu
 * HTTP : index.html  ( / , /apps/proshare/ ) + PWA dosyaları (manifest, sw.js, simgeler)
 *        demo sürüm  ( /demo/ , /apps/proshare/demo/ ) + kendi PWA dosyaları
 * WS   : /ws, /apps/proshare/ws (canlı)  ·  /demo/ws, /apps/proshare/demo/ws (demo)
 * Far-Away ( /faraway/ , /apps/proshare/faraway/ , WS: /faraway/ws ): farklı ağlardaki cihazlar için.
 *        Liste yok, oda yok: cihazlar birbirini sadece adını yazarak bulur; adlar bu alanda benzersizdir.
 * Canlı, demo ve Far-Away ayrı "alan"lardır: birbirlerinin cihazlarını görmezler.
 * Sunucu SADECE eşleştirme yapar: kayıt, şifre kontrolü ve WebRTC sinyal mesajları (sdp/ice).
 * Dosya ve mesajlar sunucudan geçmez; cihazlar arasında doğrudan (WebRTC DataChannel) akar.
 *
 * Kimlik: her cihaz tarayıcıda gizli bir anahtar üretir. Sunucu anahtardan geri çözülemeyen
 * bir cihaz kimliği (id) türetir; yönlendirme hep bu id ile yapılır, kullanıcı sadece adı görür.
 * Anahtar başka cihazlara asla gönderilmez, bu yüzden kimse bir başkasının id'sini alamaz.
 * Oda: aynı oda kodunu giren cihazlar yalnızca birbirini görür (boş oda = herkes).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = parseInt(process.env.PORT || '4008', 10);
const HOST = process.env.HOST || '127.0.0.1';
const BASE_PATH = (process.env.BASE_PATH || '/apps/proshare').replace(/\/+$/, '');

const MAX_CLIENTS = 300;
const MAX_NAME = 40;
const MAX_PASS = 128;
const MAX_ROOM = 32;
const MAX_PAYLOAD = 32 * 1024;            // sinyal mesajları küçüktür
const MAX_SIGNAL = 16 * 1024;             // tek sdp/ice verisi üst sınırı
const SIGNAL_KINDS = new Set(['sdp', 'ice']);
const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
const INVITE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const INVITE_TTL = 10 * 60 * 1000;         // QR daveti 10 dakika geçerli
const MAX_INVITES = 5;
const HEARTBEAT = 15000;
const AUTH_LIMIT = 20;                     // dakikada en fazla bağlanma denemesi (şifre tahminine karşı)

// ---------- Dosyalar (açılışta belleğe alınır) ----------
const PUB = path.join(__dirname, 'public');
function load(rel) { try { return fs.readFileSync(path.join(PUB, rel)); } catch { return null; } }
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'
};
const ROUTES = new Map();
function route(urls, rel, cache) {
    const body = load(rel);
    if (!body) return;
    const file = { body, type: TYPES[path.extname(rel)] || 'application/octet-stream', cache };
    for (const u of urls) { ROUTES.set(u, file); ROUTES.set(BASE_PATH + u, file); }
}
route(['/', '/index.html'], 'index.html', 'no-cache');
route(['/manifest.webmanifest'], 'manifest.webmanifest', 'no-cache');
route(['/sw.js'], 'sw.js', 'no-cache');
route(['/icon-192.png'], 'icon-192.png', 'public, max-age=86400');
route(['/icon-512.png'], 'icon-512.png', 'public, max-age=86400');
route(['/jsqr.js'], 'jsqr.js', 'public, max-age=86400');           // QR okuyucu (Apache-2.0, cozmo/jsQR 1.4.0)
route(['/demo/', '/demo/index.html'], 'demo/index.html', 'no-cache');
route(['/demo/manifest.webmanifest'], 'demo/manifest.webmanifest', 'no-cache');
route(['/demo/sw.js'], 'demo/sw.js', 'no-cache');
route(['/demo/icon-192.png'], 'demo/icon-192.png', 'public, max-age=86400');
route(['/demo/icon-512.png'], 'demo/icon-512.png', 'public, max-age=86400');
route(['/demo/jsqr.js'], 'demo/jsqr.js', 'public, max-age=86400');
route(['/faraway/', '/faraway/index.html'], 'faraway/index.html', 'no-cache');
route(['/faraway/manifest.webmanifest'], 'faraway/manifest.webmanifest', 'no-cache');
route(['/faraway/sw.js'], 'faraway/sw.js', 'no-cache');
route(['/faraway/icon-192.png'], 'faraway/icon-192.png', 'public, max-age=86400');
route(['/faraway/icon-512.png'], 'faraway/icon-512.png', 'public, max-age=86400');

// ---------- Alanlar: canlı ve demo birbirinden bağımsız ----------
function makeHub(label, byName) {
    return { label, byName, clients: new Map(), peersTimer: null };
}
const HUBS = { live: makeHub('canlı'), demo: makeHub('demo'), far: makeHub('far-away', true) };
const WS_PATHS = new Map([
    ['/ws', HUBS.live], [BASE_PATH + '/ws', HUBS.live],
    ['/demo/ws', HUBS.demo], [BASE_PATH + '/demo/ws', HUBS.demo],
    ['/faraway/ws', HUBS.far], [BASE_PATH + '/faraway/ws', HUBS.far]
]);

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
    const p = (req.url || '/').split('?')[0];
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (p === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('ok ' + HUBS.live.clients.size + ' demo ' + HUBS.demo.clients.size + ' far ' + HUBS.far.clients.size);
    }
    // /demo -> /demo/, /apps/proshare -> /apps/proshare/ (göreli PWA dosyaları doğru klasörden yüklensin)
    if ((p === '/demo' || p === BASE_PATH + '/demo' || p === '/faraway' || p === BASE_PATH + '/faraway' || p === BASE_PATH) && ROUTES.has(p + '/')) {
        res.writeHead(301, { Location: p + '/' + ((req.url || '').includes('?') ? req.url.slice(req.url.indexOf('?')) : '') });
        return res.end();
    }
    const f = ROUTES.get(p);
    if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
    res.writeHead(200, {
        'Content-Type': f.type,
        'Content-Length': f.body.length,
        'Cache-Control': f.cache,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
    });
    res.end(req.method === 'HEAD' ? undefined : f.body);
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;

// ---------- WebSocket ----------
const wss = new WebSocket.Server({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });

server.on('upgrade', (req, sock, head) => {
    const hub = WS_PATHS.get((req.url || '').split('?')[0]);
    if (!hub) return sock.destroy();
    if (wss.clients.size >= MAX_CLIENTS) { sock.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return sock.destroy(); }
    wss.handleUpgrade(req, sock, head, ws => { ws.hub = hub; wss.emit('connection', ws); });
});

function send(ws, o) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o)); }
function hash(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function deviceId(key) { return crypto.createHash('sha256').update('proshare-id:' + key).digest('hex').slice(0, 20); }
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME); }
function cleanRoom(r) { return String(r || '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, MAX_ROOM).toLocaleLowerCase('tr-TR'); }
function nameKey(n) { return n.toLocaleLowerCase('tr-TR'); }
// Far-Away: aynı adı başka bir cihaz kullanıyor mu?
function nameTaken(hub, name, id) {
    const k = nameKey(name);
    for (const w of hub.clients.values()) if (w.id !== id && nameKey(w.name) === k) return true;
    return false;
}
function peerList(hub, room) {
    const out = [];
    for (const w of hub.clients.values()) if (w.room === room) out.push({ id: w.id, name: w.name });
    return out;
}
// Herkese kendi odasındaki cihazları gönder (100 ms içinde gelen değişiklikler birleştirilir)
function broadcastPeers(hub) {
    if (hub.peersTimer) return;
    hub.peersTimer = setTimeout(() => {
        hub.peersTimer = null;
        const lists = new Map();
        if (hub.byName) return; // Far-Away'de kimse cihaz listesi almaz
        for (const ws of hub.clients.values()) {
            if (ws.readyState !== WebSocket.OPEN) continue;
            if (!lists.has(ws.room)) lists.set(ws.room, JSON.stringify({ type: 'peers', room: ws.room, peers: peerList(hub, ws.room) }));
            ws.send(lists.get(ws.room));
        }
    }, 100);
}

function unregister(ws) {
    if (!ws.id) return;
    const { clients } = ws.hub;
    if (clients.get(ws.id) === ws) {
        clients.delete(ws.id);
        for (const n of ws.links) { const o = clients.get(n); if (o) o.links.delete(ws.id); }
    }
    ws.links.clear();
    ws.id = '';
    ws.name = '';
    broadcastPeers(ws.hub);
}

function onText(ws, raw) {
    let d;
    try { d = JSON.parse(raw); } catch { return; }
    if (!d || typeof d.type !== 'string') return;
    const hub = ws.hub, clients = hub.clients;

    if (d.type === 'register') {
        const key = String(d.key || '');
        if (!KEY_RE.test(key)) return send(ws, { type: 'register_result', status: 'error', reason: 'bad_key' });
        const name = cleanName(d.name);
        if (!name) return send(ws, { type: 'register_result', status: 'error', reason: 'bad_name' });
        const id = deviceId(key);
        if (hub.byName && nameTaken(hub, name, id)) return send(ws, { type: 'register_result', status: 'error', reason: 'name_taken' });
        const cur = clients.get(id);
        // Aynı anahtarı bilen = aynı cihaz (ör. bağlantı koptu, geri geldi): eski oturum devralınır
        let links = new Set();
        if (cur && cur !== ws) { links = cur.links; cur.links = new Set(); clients.delete(id); cur.id = ''; cur.terminate(); }
        if (ws.id && ws.id !== id) unregister(ws);
        const pw = String(d.password || '').slice(0, MAX_PASS);
        ws.id = id;
        ws.name = name;
        ws.room = hub.byName ? '' : cleanRoom(d.room);
        ws.pass = pw ? hash(pw) : null;
        for (const n of links) if (clients.has(n)) ws.links.add(n);
        clients.set(id, ws);
        send(ws, { type: 'register_result', status: 'ok', id, name, room: ws.room });
        return broadcastPeers(hub);
    }

    if (!ws.id) return;

    if (d.type === 'rename') {
        const name = cleanName(d.name);
        if (!name) return send(ws, { type: 'rename_result', status: 'error', reason: 'bad_name' });
        if (hub.byName && nameTaken(hub, name, ws.id)) return send(ws, { type: 'rename_result', status: 'error', reason: 'name_taken' });
        ws.name = name;
        send(ws, { type: 'rename_result', status: 'ok', name });
        return broadcastPeers(hub);
    }

    if (d.type === 'room') {
        if (hub.byName) return;
        ws.room = cleanRoom(d.room);
        send(ws, { type: 'room_result', status: 'ok', room: ws.room });
        return broadcastPeers(hub);
    }

    if (d.type === 'auth_check') {
        const now = Date.now();
        ws.auths = ws.auths.filter(t => t > now - 60000);
        if (ws.auths.length >= AUTH_LIMIT) return send(ws, { type: 'auth_result', target: String(d.target || ''), req: d.name, status: 'error', reason: 'rate' });
        ws.auths.push(now);
        let t = String(d.target || '');
        // Far-Away: hedef, adı yazılarak bulunur (büyük/küçük harf fark etmez)
        const req = typeof d.name === 'string' ? cleanName(d.name) : '';
        if (hub.byName && req) {
            const k = nameKey(req);
            t = '';
            for (const w of clients.values()) if (nameKey(w.name) === k) { t = w.id; break; }
        }
        const target = clients.get(t);
        if (!target || target === ws) return send(ws, { type: 'auth_result', target: t, req, status: 'error', reason: 'not_found' });
        // QR daveti: hedefin ekranındaki tek seferlik kodu bilen, şifre sormadan bağlanabilir
        const inv = String(d.invite || '');
        const exp = INVITE_RE.test(inv) && target.invites.get(inv);
        const invited = !!exp && exp > Date.now();
        if (!invited && target.room !== ws.room) return send(ws, { type: 'auth_result', target: t, status: 'error', reason: 'not_found' });
        if (invited) target.invites.delete(inv);
        if (!invited && target.pass && !crypto.timingSafeEqual(target.pass, hash(String(d.password || '').slice(0, MAX_PASS)))) {
            return send(ws, { type: 'auth_result', target: t, req, status: 'error', reason: 'bad_password' });
        }
        ws.links.add(t);
        target.links.add(ws.id);
        send(ws, { type: 'auth_result', target: t, req, name: target.name, status: 'ok' });
        return send(target, { type: 'incoming_peer', from: ws.id, name: ws.name });
    }

    if (d.type === 'invite') {
        const tok = String(d.token || '');
        if (!INVITE_RE.test(tok)) return;
        const now = Date.now();
        for (const [k, v] of ws.invites) if (v <= now) ws.invites.delete(k);
        while (ws.invites.size >= MAX_INVITES) ws.invites.delete(ws.invites.keys().next().value);
        ws.invites.set(tok, now + INVITE_TTL);
        return;
    }

    if (d.type === 'invite_revoke') { ws.invites.clear(); return; }

    if (d.type === 'unlink') {
        const t = String(d.target || '');
        ws.links.delete(t);
        const target = clients.get(t);
        if (target) target.links.delete(ws.id);
        return;
    }

    if (d.type === 'relay') {
        const t = String(d.target || '');
        const target = clients.get(t);
        if (!target || !ws.links.has(t)) return send(ws, { type: 'peer_gone', target: t });
        // Sadece bağlantı kurulum (sinyal) mesajları iletilir; dosya/mesaj içeriği asla
        const data = d.data;
        if (!data || !SIGNAL_KINDS.has(data.k) || JSON.stringify(data).length > MAX_SIGNAL) return;
        return send(target, { type: 'relay', from: ws.id, data });
    }
}

wss.on('connection', ws => {
    ws.id = '';
    ws.name = '';
    ws.room = '';
    ws.pass = null;
    ws.links = new Set();
    ws.invites = new Map();
    ws.auths = [];
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data, isBinary) => {
        if (isBinary) return; // ikili veri kabul edilmez
        onText(ws, data.toString('utf8'));
    });
    ws.on('close', () => unregister(ws));
    ws.on('error', () => {});
    if (!ws.hub.byName) send(ws, { type: 'peers', room: '', peers: peerList(ws.hub, '') });
});

const hb = setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch {}
    }
}, HEARTBEAT);

server.listen(PORT, HOST, () => console.log(`ProShare dinliyor: http://${HOST}:${PORT}  (base: ${BASE_PATH})`));

function shutdown() {
    clearInterval(hb);
    for (const ws of wss.clients) ws.close(1001, 'restart');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

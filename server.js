/**
 * ProShare Signaling Server + Static File Server
 * Dinler : 127.0.0.1:4008
 * Statik : ./public/
 * WS     : /ws
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 4008;
const HOST = process.env.HOST || '127.0.0.1';
const STATIC_DIR = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.txt':  'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.normalize(path.join(STATIC_DIR, urlPath));
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, d2) => {
                    if (e2) { res.writeHead(404); res.end('Not found'); return; }
                    res.writeHead(200, { 'Content-Type': MIME['.html'] });
                    res.end(d2);
                });
                return;
            }
            res.writeHead(500); res.end('Server error'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
        });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server, path: '/ws' });
const clients = new Map();
const HEARTBEAT_INTERVAL = 30000;

function safeSend(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(obj)); } catch {}
    }
}
function broadcastPeerList() {
    const names = [...clients.keys()];
    const payload = { type: 'peers', peers: names };
    for (const { ws } of clients.values()) safeSend(ws, payload);
}
function sendTo(targetName, obj) {
    const c = clients.get(targetName);
    if (c) { safeSend(c.ws, obj); return true; }
    return false;
}

wss.on('connection', (ws) => {
    let myName = null;
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) { try { ws.ping(); } catch {} }
    }, HEARTBEAT_INTERVAL);
    ws.on('pong', () => {});
    ws.on('message', (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        if (!data || typeof data.type !== 'string') return;

        switch (data.type) {
            case 'register': {
                const name = String(data.name || '').trim();
                if (!name) return;
                if (clients.has(name)) {
                    const old = clients.get(name);
                    if (old.ws !== ws) { try { old.ws.close(4000, 'replaced'); } catch {} }
                }
                myName = name;
                clients.set(name, { ws, password: String(data.password || '') });
                broadcastPeerList();
                break;
            }
            case 'auth_check': {
                if (!myName) return;
                const targetName = String(data.target || '');
                const target = clients.get(targetName);
                if (!target) {
                    safeSend(ws, { type: 'auth_result', status: 'fail', target: targetName, reason: 'not_found' });
                    return;
                }
                const ok = (target.password || '') === String(data.password || '');
                safeSend(ws, { type: 'auth_result', status: ok ? 'ok' : 'fail', target: targetName });
                if (ok) sendTo(targetName, { type: 'incoming_peer', from: myName });
                break;
            }
            case 'offer':
            case 'answer':
            case 'candidate': {
                if (!myName) return;
                const targetName = String(data.target || '');
                if (!targetName) return;
                sendTo(targetName, { ...data, from: myName });
                break;
            }
            default: break;
        }
    });
    ws.on('close', () => {
        clearInterval(heartbeat);
        if (myName && clients.get(myName)?.ws === ws) {
            clients.delete(myName);
            broadcastPeerList();
        }
    });
    ws.on('error', () => { clearInterval(heartbeat); });
});

server.listen(PORT, HOST, () => {
    console.log(`ProShare listening on http://${HOST}:${PORT}`);
    console.log(`  static dir : ${STATIC_DIR}`);
    console.log(`  websocket  : ws://${HOST}:${PORT}/ws`);
});

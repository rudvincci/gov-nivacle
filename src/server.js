/**
 * Gov Nivacle — Ierahkwa Sovereign Platform
 * Category: generic | Port: 3512
 * Full backend: auth, BDET Bank, blockchain ledger, domain API
 * Zero dependencies — pure Node.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3512;
const DATA_DIR = path.join(__dirname, '..', 'data');
const BDET_URL = process.env.BDET_URL || 'http://localhost:3000';
const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || 'http://localhost:3012';
const PLATFORM = 'gov-nivacle';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── DB ──────────────────────────────────────────────────────────
const dbPath = n => path.join(DATA_DIR, n + '.json');
const dbRead = n => { try { return JSON.parse(fs.readFileSync(dbPath(n), 'utf8')); } catch { return /transactions|items|records|logs|orders|appointments|cases|tickets|courses|listings|events|routes|reports|alerts|messages|jobs|assets|harvests/.test(n) ? [] : {}; } };
const dbWrite = (n, d) => fs.writeFileSync(dbPath(n), JSON.stringify(d, null, 2));
const genId = () => 'FW-' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const hashPw = p => crypto.createHash('sha256').update(p + 'ierahkwa-salt').digest('hex');
const genToken = () => 'tk_' + crypto.randomBytes(24).toString('hex');
const now = () => new Date().toISOString();

let sessions = dbRead('sessions');
const saveSession = (t, uid) => { sessions[t] = { userId: uid, created: now() }; dbWrite('sessions', sessions); };
const getUser = req => {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const s = sessions[t]; if (!s) return null;
    return dbRead('users')[s.userId] || null;
};
const requireAuth = (req, res) => { const u = getUser(req); if (!u) { json(res, { error: 'No autorizado' }, 401); return null; } return u; };

// ── HTTP ────────────────────────────────────────────────────────
const cors = r => { r.setHeader('Access-Control-Allow-Origin','*'); r.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,PATCH,OPTIONS'); r.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization'); };
const json = (r, d, s) => { r.writeHead(s||200, {'Content-Type':'application/json'}); r.end(JSON.stringify(d)); };
const parseBody = req => new Promise(resolve => { let b=''; req.on('data',c=>{b+=c;if(b.length>5e6)req.destroy()}); req.on('end',()=>{ try{resolve(JSON.parse(b))}catch{resolve({})} }); });

const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon' };
const serveStatic = (req, res) => {
    let fp = path.join(__dirname,'..','public', req.url==='/'?'index.html':req.url);
    if (!path.extname(fp)) fp += '/index.html';
    fs.readFile(fp, (e, d) => { if(e){res.writeHead(404);res.end('Not Found');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(d); });
};

// ── Service Calls ───────────────────────────────────────────────
const serviceCall = (baseUrl, method, urlPath, body, token) => new Promise(resolve => {
    const url = new URL(baseUrl + urlPath);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, res => { let data = ''; res.on('data', c => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } }); });
    req.on('error', () => resolve({ error: 'Service offline', url: baseUrl }));
    if (body) req.write(JSON.stringify(body));
    req.end();
});
const bdet = (m, p, b, t) => serviceCall(BDET_URL, m, p, b, t);

// ── Blockchain Ledger ───────────────────────────────────────────
const logToChain = (action, data) => {
    const ledger = dbRead('blockchain_ledger');
    const prev = ledger.length > 0 ? ledger[ledger.length-1].hash : '0000000000';
    const block = { index: ledger.length, timestamp: now(), platform: PLATFORM, action, data, prev, hash: crypto.createHash('sha256').update(prev + JSON.stringify(data) + Date.now()).digest('hex'), nonce: Math.floor(Math.random() * 1e6) };
    ledger.push(block);
    dbWrite('blockchain_ledger', ledger);
    return block;
};

// ══════════════════════════════════════════════════════════════════
async function handleAPI(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    const method = req.method;

    // Health
    if (route === '/api/health') return json(res, { status: 'ok', service: PLATFORM, category: 'generic', version: '1.0.0', bdet: BDET_URL, uptime: process.uptime() });

    // ── Auth ────────────────────────────────────────────────────
    if (route === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.email || !body.password) return json(res, { error: 'Email y password requeridos' }, 400);
        const users = dbRead('users');
        if (Object.values(users).find(u => u.email === body.email)) return json(res, { error: 'Email ya registrado' }, 409);
        const id = genId();
        const user = { id, name: body.name||'', email: body.email, password: hashPw(body.password), nation: body.nation||'', role: body.role||'user', created: now() };
        users[id] = user;
        dbWrite('users', users);
        bdet('POST', '/api/auth/register', { name: body.name, email: body.email, password: body.password, nation: body.nation }).catch(()=>{});
        const token = genToken();
        saveSession(token, id);
        logToChain('USER_REGISTER', { userId: id, email: body.email });
        const { password, ...safe } = user;
        return json(res, { ok: true, token, user: safe }, 201);
    }
    if (route === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const users = dbRead('users');
        const user = Object.values(users).find(u => u.email === body.email);
        if (!user || user.password !== hashPw(body.password)) return json(res, { error: 'Credenciales inválidas' }, 401);
        const token = genToken();
        saveSession(token, user.id);
        logToChain('USER_LOGIN', { userId: user.id });
        const { password, ...safe } = user;
        return json(res, { ok: true, token, user: safe });
    }
    if (route === '/api/auth/me') { const u = requireAuth(req, res); if (!u) return; const { password, ...safe } = u; return json(res, safe); }
    if (route === '/api/auth/logout' && method === 'POST') { const t = (req.headers.authorization||'').replace('Bearer ',''); delete sessions[t]; dbWrite('sessions', sessions); return json(res, { ok: true }); }

    // ── Pay via BDET ────────────────────────────────────────────
    if (route === '/api/pay' && method === 'POST') {
        const user = requireAuth(req, res); if (!user) return;
        const body = await parseBody(req);
        const t = (req.headers.authorization||'').replace('Bearer ','');
        const result = await bdet('POST', '/api/wallet/pay', { amount: body.amount, service: PLATFORM, description: body.description || 'Pago en ' + PLATFORM }, t);
        logToChain('PAYMENT', { userId: user.id, amount: body.amount });
        return json(res, result);
    }

    // ── Blockchain ──────────────────────────────────────────────
    if (route === '/api/blockchain/ledger') { const l = dbRead('blockchain_ledger'); return json(res, { blocks: l.slice(-50), total: l.length }); }

    // ── Stats ───────────────────────────────────────────────────
    if (route === '/api/stats') { const u = dbRead('users'); const l = dbRead('blockchain_ledger'); return json(res, { users: Object.keys(u).length, blocks: l.length, platform: PLATFORM, uptime: process.uptime() }); }

    // ── CRUD: items/records ─────────────────────────────────────
    if (route === '/api/items' && method === 'GET') { return json(res, dbRead('items').slice(0, parseInt(url.searchParams.get('limit'))||50)); }
    if (route === '/api/items' && method === 'POST') {
        const user = requireAuth(req, res); if (!user) return;
        const body = await parseBody(req);
        const items = dbRead('items');
        const item = { id: genId(), ...body, createdBy: user.id, createdByName: user.name, platform: PLATFORM, created: now() };
        items.unshift(item);
        dbWrite('items', items);
        logToChain('ITEM_CREATE', { id: item.id });
        return json(res, { ok: true, item }, 201);
    }
    if (route.startsWith('/api/items/') && method === 'GET') { const id = route.split('/').pop(); const item = dbRead('items').find(i => i.id === id); return item ? json(res, item) : json(res, { error: 'No encontrado' }, 404); }
    if (route.startsWith('/api/items/') && method === 'DELETE') {
        const user = requireAuth(req, res); if (!user) return;
        const id = route.split('/')[3]; const items = dbRead('items');
        const idx = items.findIndex(i => i.id === id); if (idx === -1) return json(res, { error: 'No encontrado' }, 404);
        if (items[idx].createdBy !== user.id && user.role !== 'admin') return json(res, { error: 'No autorizado' }, 403);
        items.splice(idx, 1); dbWrite('items', items); return json(res, { ok: true });
    }

    // ── Reports ─────────────────────────────────────────────────
    if (route === '/api/reports' && method === 'POST') {
        const user = requireAuth(req, res); if (!user) return;
        const body = await parseBody(req);
        const reports = dbRead('reports');
        reports.unshift({ id: genId(), ...body, createdBy: user.id, platform: PLATFORM, created: now() });
        dbWrite('reports', reports);
        logToChain('REPORT', { type: body.type });
        return json(res, { ok: true }, 201);
    }
    if (route === '/api/reports' && method === 'GET') { return json(res, dbRead('reports').slice(0, 50)); }

    // 404
    return json(res, { error: 'Endpoint no encontrado', path: route }, 404);
}

// ── Server ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url.startsWith('/api/')) { try { await handleAPI(req, res); } catch(e) { console.error('[gov-nivacle]', e); json(res, { error: 'Error interno' }, 500); } }
    else { serveStatic(req, res); }
});

server.listen(PORT, () => {
    console.log(`\n  Gov Nivacle`);
    console.log(`  Port:       http://localhost:${PORT}`);
    console.log(`  API:        http://localhost:${PORT}/api/health`);
    console.log(`  BDET Bank:  ${BDET_URL}`);
    console.log(`  Status:     ONLINE\n`);
});

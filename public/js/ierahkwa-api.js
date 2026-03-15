/**
 * IERAHKWA SOVEREIGN PLATFORM — Shared API Client v5.0.0
 * Fully functional offline/demo mode with localStorage persistence.
 * Include in every HTML platform for auth, wallet, payments, and UI.
 *
 * Usage:
 *   <script src="../shared/ierahkwa-api.js"></script>
 *   Ierahkwa.auth.isLoggedIn()  // check session
 *   Ierahkwa.wallet.balance()   // get Wampum balance
 *   Ierahkwa.wallet.send(to, amount) // transfer
 */

window.Ierahkwa = (function() {
    'use strict';

    const VERSION = '5.0.0';
    const BASE_URL = window.IERAHKWA_API_URL || 'https://api.ierahkwa.org';
    const STORAGE = {
        SESSION: 'ierahkwa_session',
        WALLET: 'ierahkwa_wallet',
        TRANSACTIONS: 'ierahkwa_transactions',
        USERS: 'ierahkwa_users',
    };

    // ── Utility ─────────────────────────────────────────────────
    function uid() { return 'FW-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
    function now() { return new Date().toISOString(); }
    function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
    function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }

    // ── Session Management ──────────────────────────────────────
    function getSession() { return load(STORAGE.SESSION, null); }
    function setSession(s) { store(STORAGE.SESSION, s); }
    function clearSession() { localStorage.removeItem(STORAGE.SESSION); }

    // ── Detect platform from URL ────────────────────────────────
    function detectPlatform() {
        const m = window.location.pathname.match(/\/([a-z0-9-]+)\/(?:index\.html)?$/);
        return m ? m[1] : 'ierahkwa';
    }
    const currentPlatform = detectPlatform();

    // ── Auth Module ─────────────────────────────────────────────
    const auth = {
        register(data) {
            const users = load(STORAGE.USERS, {});
            if (users[data.email]) return { ok: false, error: 'Email ya registrado' };
            const user = {
                id: uid(),
                name: data.name || '',
                email: data.email,
                password: data.password,
                nation: data.nation || 'Ierahkwa Global',
                tier: 'member',
                created: now(),
            };
            users[data.email] = user;
            store(STORAGE.USERS, users);
            // Create wallet
            const wallets = load(STORAGE.WALLET, {});
            wallets[user.id] = { balance: 500, currency: 'W', bonus: true };
            store(STORAGE.WALLET, wallets);
            // Auto login
            const session = { token: 'tk_' + uid(), userId: user.id, email: user.email, name: user.name, tier: user.tier, nation: user.nation };
            setSession(session);
            hideLoginModal();
            updateNavbar();
            window.dispatchEvent(new CustomEvent('ierahkwa:auth:login', { detail: session }));
            return { ok: true, user, bonus: '500 W de bienvenida' };
        },

        login(email, password) {
            const users = load(STORAGE.USERS, {});
            const user = users[email];
            if (!user) return { ok: false, error: 'Usuario no encontrado' };
            if (user.password !== password) return { ok: false, error: 'Contraseña incorrecta' };
            const session = { token: 'tk_' + uid(), userId: user.id, email: user.email, name: user.name, tier: user.tier, nation: user.nation };
            setSession(session);
            hideLoginModal();
            updateNavbar();
            window.dispatchEvent(new CustomEvent('ierahkwa:auth:login', { detail: session }));
            return { ok: true, user };
        },

        logout() {
            clearSession();
            updateNavbar();
            window.dispatchEvent(new CustomEvent('ierahkwa:auth:logout'));
        },

        isLoggedIn() { return !!getSession()?.token; },
        getSession,
        getTier() { return getSession()?.tier || 'anonymous'; },
        me() { return getSession(); },
    };

    // ── Wallet Module ───────────────────────────────────────────
    const wallet = {
        balance() {
            const s = getSession();
            if (!s) return { balance: 0, currency: 'W' };
            const wallets = load(STORAGE.WALLET, {});
            return wallets[s.userId] || { balance: 0, currency: 'W' };
        },

        send(toEmail, amount, description) {
            const s = getSession();
            if (!s) return { ok: false, error: 'Debes iniciar sesión' };
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) return { ok: false, error: 'Monto inválido' };

            const wallets = load(STORAGE.WALLET, {});
            const myWallet = wallets[s.userId] || { balance: 0 };
            if (myWallet.balance < amount) return { ok: false, error: 'Saldo insuficiente' };

            // Find recipient
            const users = load(STORAGE.USERS, {});
            const recipient = users[toEmail];
            if (!recipient) return { ok: false, error: 'Destinatario no encontrado' };

            // Transfer
            myWallet.balance -= amount;
            wallets[s.userId] = myWallet;
            const recipientWallet = wallets[recipient.id] || { balance: 0, currency: 'W' };
            recipientWallet.balance += amount;
            wallets[recipient.id] = recipientWallet;
            store(STORAGE.WALLET, wallets);

            // Log transaction
            const txs = load(STORAGE.TRANSACTIONS, []);
            txs.unshift({
                id: uid(),
                from: s.userId,
                fromName: s.name,
                to: recipient.id,
                toName: recipient.name,
                amount,
                currency: 'W',
                description: description || 'Transferencia P2P',
                platform: currentPlatform,
                timestamp: now(),
                status: 'completed',
            });
            store(STORAGE.TRANSACTIONS, txs.slice(0, 500));

            updateNavbar();
            return { ok: true, newBalance: myWallet.balance, txId: txs[0].id };
        },

        pay(platformService, amount, description) {
            const s = getSession();
            if (!s) return { ok: false, error: 'Debes iniciar sesión' };
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) return { ok: false, error: 'Monto inválido' };

            const wallets = load(STORAGE.WALLET, {});
            const myWallet = wallets[s.userId] || { balance: 0 };
            if (myWallet.balance < amount) return { ok: false, error: 'Saldo insuficiente' };

            myWallet.balance -= amount;
            wallets[s.userId] = myWallet;
            store(STORAGE.WALLET, wallets);

            const txs = load(STORAGE.TRANSACTIONS, []);
            txs.unshift({
                id: uid(),
                from: s.userId,
                fromName: s.name,
                to: 'PLATFORM',
                toName: platformService || currentPlatform,
                amount,
                currency: 'W',
                description: description || 'Pago de servicio',
                platform: currentPlatform,
                timestamp: now(),
                status: 'completed',
                type: 'payment',
            });
            store(STORAGE.TRANSACTIONS, txs.slice(0, 500));

            updateNavbar();
            return { ok: true, newBalance: myWallet.balance, txId: txs[0].id };
        },

        history(limit) {
            const s = getSession();
            if (!s) return [];
            const txs = load(STORAGE.TRANSACTIONS, []);
            return txs.filter(t => t.from === s.userId || t.to === s.userId).slice(0, limit || 50);
        },

        deposit(amount) {
            const s = getSession();
            if (!s) return { ok: false };
            const wallets = load(STORAGE.WALLET, {});
            const w = wallets[s.userId] || { balance: 0, currency: 'W' };
            w.balance += parseFloat(amount);
            wallets[s.userId] = w;
            store(STORAGE.WALLET, wallets);
            updateNavbar();
            return { ok: true, newBalance: w.balance };
        },
    };

    // ── Tier definitions ────────────────────────────────────────
    const tiers = {
        isMember() { return auth.isLoggedIn(); },
        canAccess(req) {
            const order = { anonymous: 0, member: 1, bronce: 2, silver: 3, gold: 4, diamante: 5 };
            return (order[auth.getTier()] || 0) >= (order[req] || 0);
        },
    };

    // ── Payments backward compat ────────────────────────────────
    const payments = {
        balance: wallet.balance,
        send: wallet.send,
        history: wallet.history,
    };

    // ── API stub (for platforms that use raw api.get/post) ──────
    const api = {
        get(path) { console.log('[Ierahkwa] GET', path); return Promise.resolve({ status: 'offline', path }); },
        post(path, body) { console.log('[Ierahkwa] POST', path, body); return Promise.resolve({ status: 'offline', path }); },
        put(path, body) { return Promise.resolve({ status: 'offline', path }); },
        delete(path) { return Promise.resolve({ status: 'offline', path }); },
    };

    // ══════════════════════════════════════════════════════════════
    // ── LOGIN/REGISTER MODAL UI ─────────────────────────────────
    // ══════════════════════════════════════════════════════════════

    function showLoginModal() {
        if (document.getElementById('ierahkwa-auth-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'ierahkwa-auth-modal';
        modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)" onclick="if(event.target===this)document.getElementById('ierahkwa-auth-modal').remove()">
            <div style="background:#0d1117;border:1px solid rgba(0,255,65,.2);border-radius:16px;padding:2rem;width:380px;max-width:92vw;box-shadow:0 0 40px rgba(0,255,65,.08)">
                <div style="text-align:center;margin-bottom:1.5rem">
                    <div style="font-size:2rem;margin-bottom:.3rem">🦅</div>
                    <h2 style="font-family:Orbitron,sans-serif;color:#00FF41;font-size:1.1rem;margin:0">IERAHKWA</h2>
                    <p style="color:#a0a8b8;font-size:.75rem;margin-top:.3rem">Nación Digital Soberana</p>
                </div>
                <div id="ierahkwa-auth-tabs" style="display:flex;gap:0;margin-bottom:1.2rem">
                    <button id="ierahkwa-tab-login" onclick="document.getElementById('ierahkwa-form-login').style.display='block';document.getElementById('ierahkwa-form-register').style.display='none';this.style.borderBottom='2px solid #00FF41';this.style.color='#00FF41';document.getElementById('ierahkwa-tab-register').style.borderBottom='2px solid transparent';document.getElementById('ierahkwa-tab-register').style.color='#a0a8b8'" style="flex:1;background:none;border:none;border-bottom:2px solid #00FF41;color:#00FF41;padding:.6rem;font-size:.85rem;font-weight:600;cursor:pointer">Iniciar Sesión</button>
                    <button id="ierahkwa-tab-register" onclick="document.getElementById('ierahkwa-form-register').style.display='block';document.getElementById('ierahkwa-form-login').style.display='none';this.style.borderBottom='2px solid #00FF41';this.style.color='#00FF41';document.getElementById('ierahkwa-tab-login').style.borderBottom='2px solid transparent';document.getElementById('ierahkwa-tab-login').style.color='#a0a8b8'" style="flex:1;background:none;border:none;border-bottom:2px solid transparent;color:#a0a8b8;padding:.6rem;font-size:.85rem;font-weight:600;cursor:pointer">Registrarse</button>
                </div>
                <div id="ierahkwa-form-login">
                    <input id="ierahkwa-l-email" type="email" placeholder="Email" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.6rem;outline:none" onfocus="this.style.borderColor='#00FF41'" onblur="this.style.borderColor='#1e3a5f'">
                    <input id="ierahkwa-l-pass" type="password" placeholder="Contraseña" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.8rem;outline:none" onfocus="this.style.borderColor='#00FF41'" onblur="this.style.borderColor='#1e3a5f'" onkeydown="if(event.key==='Enter')document.getElementById('ierahkwa-login-go').click()">
                    <button id="ierahkwa-login-go" style="width:100%;background:#00FF41;color:#0a0e17;border:none;border-radius:8px;padding:.7rem;font-weight:700;cursor:pointer;font-size:.9rem;font-family:Orbitron,sans-serif">Entrar</button>
                </div>
                <div id="ierahkwa-form-register" style="display:none">
                    <input id="ierahkwa-r-name" type="text" placeholder="Nombre completo" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.6rem;outline:none" onfocus="this.style.borderColor='#00FF41'" onblur="this.style.borderColor='#1e3a5f'">
                    <input id="ierahkwa-r-email" type="email" placeholder="Email" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.6rem;outline:none" onfocus="this.style.borderColor='#00FF41'" onblur="this.style.borderColor='#1e3a5f'">
                    <input id="ierahkwa-r-pass" type="password" placeholder="Contraseña (mín. 6 caracteres)" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.6rem;outline:none" onfocus="this.style.borderColor='#00FF41'" onblur="this.style.borderColor='#1e3a5f'">
                    <select id="ierahkwa-r-nation" style="width:100%;box-sizing:border-box;background:#1a1f2e;border:1px solid #1e3a5f;border-radius:8px;padding:.65rem .8rem;color:#f0f0f5;font-size:.85rem;margin-bottom:.8rem;outline:none">
                        <option value="">Selecciona tu Nación</option>
                        <option value="Navajo Nation">Navajo Nation</option>
                        <option value="Cherokee Nation">Cherokee Nation</option>
                        <option value="Mohawk (Kanienke)">Mohawk (Kanienke)</option>
                        <option value="Maya">Maya</option>
                        <option value="Quechua">Quechua</option>
                        <option value="Mapuche">Mapuche</option>
                        <option value="Taíno">Taíno</option>
                        <option value="Guaraní">Guaraní</option>
                        <option value="Aymara">Aymara</option>
                        <option value="Otra Nación">Otra Nación</option>
                    </select>
                    <button id="ierahkwa-register-go" style="width:100%;background:#00FF41;color:#0a0e17;border:none;border-radius:8px;padding:.7rem;font-weight:700;cursor:pointer;font-size:.9rem;font-family:Orbitron,sans-serif" onkeydown="if(event.key==='Enter')this.click()">Crear Cuenta Soberana</button>
                    <p style="color:#a0a8b8;font-size:.7rem;text-align:center;margin-top:.6rem">Recibirás 500 W de bienvenida al registrarte</p>
                </div>
                <p id="ierahkwa-auth-msg" style="font-size:.78rem;text-align:center;margin-top:.8rem;display:none"></p>
            </div>
        </div>`;
        document.body.appendChild(modal);

        // Login handler
        document.getElementById('ierahkwa-login-go').addEventListener('click', function() {
            var email = document.getElementById('ierahkwa-l-email').value.trim();
            var pass = document.getElementById('ierahkwa-l-pass').value;
            if (!email || !pass) return showMsg('Ingresa email y contraseña', true);
            var result = auth.login(email, pass);
            if (!result.ok) return showMsg(result.error, true);
            showMsg('Bienvenido de vuelta, ' + (result.user.name || email), false);
        });

        // Register handler
        document.getElementById('ierahkwa-register-go').addEventListener('click', function() {
            var name = document.getElementById('ierahkwa-r-name').value.trim();
            var email = document.getElementById('ierahkwa-r-email').value.trim();
            var pass = document.getElementById('ierahkwa-r-pass').value;
            var nation = document.getElementById('ierahkwa-r-nation').value;
            if (!name) return showMsg('Ingresa tu nombre', true);
            if (!email) return showMsg('Ingresa tu email', true);
            if (pass.length < 6) return showMsg('La contraseña debe tener mínimo 6 caracteres', true);
            var result = auth.register({ name: name, email: email, password: pass, nation: nation });
            if (!result.ok) return showMsg(result.error, true);
            showMsg('Cuenta creada. +500 W de bienvenida!', false);
        });

        function showMsg(text, isError) {
            var el = document.getElementById('ierahkwa-auth-msg');
            el.textContent = text;
            el.style.color = isError ? '#f44336' : '#00FF41';
            el.style.display = 'block';
            if (!isError) setTimeout(function() { hideLoginModal(); }, 1200);
        }
    }

    function hideLoginModal() {
        var m = document.getElementById('ierahkwa-auth-modal');
        if (m) m.remove();
    }

    // ══════════════════════════════════════════════════════════════
    // ── PAYMENT MODAL ───────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════

    function showPaymentModal(serviceName, amount, description, onSuccess) {
        if (!auth.isLoggedIn()) { showLoginModal(); return; }
        if (document.getElementById('ierahkwa-pay-modal')) return;

        var bal = wallet.balance().balance;
        var modal = document.createElement('div');
        modal.id = 'ierahkwa-pay-modal';
        modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)" onclick="if(event.target===this)document.getElementById('ierahkwa-pay-modal').remove()">
            <div style="background:#0d1117;border:1px solid rgba(0,255,65,.2);border-radius:16px;padding:2rem;width:380px;max-width:92vw;box-shadow:0 0 40px rgba(0,255,65,.08)">
                <div style="text-align:center;margin-bottom:1rem">
                    <div style="font-size:2rem">💳</div>
                    <h3 style="font-family:Orbitron,sans-serif;color:#00FF41;font-size:1rem;margin:.3rem 0">Confirmar Pago</h3>
                </div>
                <div style="background:#1a1f2e;border-radius:10px;padding:1rem;margin-bottom:1rem">
                    <div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="color:#a0a8b8;font-size:.8rem">Servicio</span><span style="color:#f0f0f5;font-size:.85rem;font-weight:600">${serviceName}</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="color:#a0a8b8;font-size:.8rem">Monto</span><span style="color:#ffd600;font-family:Orbitron,sans-serif;font-size:1.1rem;font-weight:700">${amount} W</span></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:#a0a8b8;font-size:.8rem">Tu saldo</span><span style="color:${bal >= amount ? '#00FF41' : '#f44336'};font-size:.85rem;font-weight:600">${bal.toFixed(2)} W</span></div>
                </div>
                ${description ? '<p style="color:#a0a8b8;font-size:.75rem;text-align:center;margin-bottom:1rem">' + description + '</p>' : ''}
                <button id="ierahkwa-pay-confirm" style="width:100%;background:#00FF41;color:#0a0e17;border:none;border-radius:8px;padding:.7rem;font-weight:700;cursor:pointer;font-size:.9rem;font-family:Orbitron,sans-serif;${bal < amount ? 'opacity:.4;pointer-events:none' : ''}">${bal < amount ? 'Saldo Insuficiente' : 'Pagar ' + amount + ' W'}</button>
                <button onclick="document.getElementById('ierahkwa-pay-modal').remove()" style="width:100%;background:none;border:1px solid #1e3a5f;border-radius:8px;padding:.6rem;color:#a0a8b8;cursor:pointer;font-size:.8rem;margin-top:.5rem">Cancelar</button>
                <p id="ierahkwa-pay-msg" style="font-size:.78rem;text-align:center;margin-top:.6rem;display:none"></p>
            </div>
        </div>`;
        document.body.appendChild(modal);

        document.getElementById('ierahkwa-pay-confirm').addEventListener('click', function() {
            var result = wallet.pay(serviceName, amount, description);
            var msg = document.getElementById('ierahkwa-pay-msg');
            if (result.ok) {
                msg.textContent = 'Pago exitoso! Nuevo saldo: ' + result.newBalance.toFixed(2) + ' W';
                msg.style.color = '#00FF41';
                msg.style.display = 'block';
                if (onSuccess) onSuccess(result);
                setTimeout(function() {
                    var m = document.getElementById('ierahkwa-pay-modal');
                    if (m) m.remove();
                }, 1500);
            } else {
                msg.textContent = result.error;
                msg.style.color = '#f44336';
                msg.style.display = 'block';
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    // ── FLOATING NAVBAR (auto-injected) ─────────────────────────
    // ══════════════════════════════════════════════════════════════

    function injectNavbar() {
        if (document.getElementById('ierahkwa-nav')) return;
        var nav = document.createElement('nav');
        nav.id = 'ierahkwa-nav';
        nav.setAttribute('aria-label', 'Navegación soberana');
        nav.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(10,14,23,.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(0,255,65,.1);padding:.5rem 1rem;display:flex;align-items:center;justify-content:space-between;font-size:.8rem';
        nav.innerHTML = `
            <a href="../index.html" style="text-decoration:none;display:flex;align-items:center;gap:.4rem">
                <span style="font-size:1.1rem">🦅</span>
                <span style="font-family:Orbitron,sans-serif;color:#00FF41;font-weight:700;font-size:.75rem">IERAHKWA</span>
            </a>
            <div id="ierahkwa-nav-right" style="display:flex;align-items:center;gap:.8rem"></div>
        `;
        document.body.prepend(nav);
        // Add top padding to body so content isn't hidden behind navbar
        document.body.style.paddingTop = '48px';
        updateNavbar();
    }

    function updateNavbar() {
        var right = document.getElementById('ierahkwa-nav-right');
        if (!right) return;
        if (auth.isLoggedIn()) {
            var s = getSession();
            var bal = wallet.balance().balance;
            right.innerHTML = `
                <span style="color:#ffd600;font-family:Orbitron,sans-serif;font-size:.75rem;font-weight:600">${bal.toFixed(0)} W</span>
                <span style="color:#a0a8b8;font-size:.75rem">${s.name || s.email}</span>
                <button onclick="Ierahkwa.auth.logout()" style="background:none;border:1px solid rgba(244,67,54,.3);border-radius:6px;color:#f44336;padding:.25rem .6rem;font-size:.7rem;cursor:pointer">Salir</button>
            `;
        } else {
            right.innerHTML = `
                <button onclick="Ierahkwa.showLogin()" style="background:#00FF41;color:#0a0e17;border:none;border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:700;cursor:pointer;font-family:Orbitron,sans-serif">Entrar</button>
            `;
        }
    }

    // ══════════════════════════════════════════════════════════════
    // ── WIRE UP BUTTONS ─────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════

    function wireButtons() {
        // Wire all .hero-btn and .plan-btn to login or pay
        document.querySelectorAll('.hero-btn, .plan-btn').forEach(function(btn) {
            if (btn.dataset.wired) return;
            btn.dataset.wired = '1';
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (!auth.isLoggedIn()) {
                    showLoginModal();
                } else {
                    // If button has data-price, show payment
                    var price = btn.dataset.price;
                    var service = btn.dataset.service || btn.textContent.trim();
                    if (price) {
                        showPaymentModal(service, parseFloat(price), null);
                    } else {
                        // Show a confirmation toast
                        showToast('Conectado a ' + currentPlatform);
                    }
                }
            });
        });
    }

    function showToast(msg) {
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#00FF41;color:#0a0e17;padding:.5rem 1.2rem;border-radius:8px;font-size:.8rem;font-weight:600;z-index:99999;font-family:Orbitron,sans-serif;box-shadow:0 4px 20px rgba(0,255,65,.3)';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    }

    // ── Init on DOM ready ───────────────────────────────────────
    function init() {
        injectNavbar();
        wireButtons();
        // Re-wire after any dynamic content loads
        var observer = new MutationObserver(function() { wireButtons(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Public API ──────────────────────────────────────────────
    return {
        auth: auth,
        wallet: wallet,
        payments: payments,
        api: api,
        tiers: tiers,
        showLogin: showLoginModal,
        showPayment: showPaymentModal,
        showToast: showToast,
        platform: currentPlatform,
        version: VERSION,
    };
})();

// ==========================================
// FiveZone Police PC - desktop OS (login screen, desktop, windows, taskbar, start menu, notifications)
// ==========================================

const Apps = {
    defs: {},
    // def = { w, h, mount(win, args), onArgs(win, args), onLive(win, event, data), onClose(win) }
    define(id, def) { this.defs[id] = def; },
};

const OS = {
    isOpen: false, state: null, perms: new Set(), wins: {}, z: 10, focused: null,
    notifs: [], badges: {}, timers: [], login: null, locked: true,
};

OS.can = perm => {
    if (!perm) return true;
    if (Array.isArray(perm)) return perm.some(p => OS.perms.has(p));
    return OS.perms.has(perm);
};
OS.appTitle = id => {
    const ext = OS.state && OS.state.apps.find(a => a.id === id && a.external);
    return ext ? ext.label : T('app_' + id);
};

// ==========================================
// Wallpaper
// ==========================================
function wallpaperUrl(settings, list) {
    if (settings && settings.wallpaper === 'custom' && settings.customWallpaper) return settings.customWallpaper;
    const w = (list || []).find(x => x.id === (settings && settings.wallpaper)) || (list || [])[0];
    return w ? w.file : null;
}
OS.applyWallpaper = function () {
    const st = OS.state || {};
    const url = wallpaperUrl(st.settings || (OS.login && { wallpaper: OS.login.wallpaper, customWallpaper: OS.login.customWallpaper }),
        st.wallpapers || (OS.login && OS.login.wallpapers));
    $('#screen').style.cssText = url ? bgUrl(url) : '';
    $('#lock').style.cssText = url ? bgUrl(url) : '';
};

// ==========================================
// Open / close
// ==========================================
OS.open = function (login) {
    typing = false;
    loginRun++;
    OS.login = login;
    OS.isOpen = true;
    OS.state = null;
    const bezel = $('#bezel');
    bezel.className = 'bezel' + (login.frame === false ? ' noframe' : '') + (login.mode === 'laptop' ? ' laptop' : '') + (login.mode === 'vehicle' ? ' vehicle' : '');
    $('#os').classList.remove('hidden');
    $('#os').classList.add('fade-in');
    $('#windows').innerHTML = '';
    $('#icons').innerHTML = '';
    $('#widget').innerHTML = '';
    $('#taskbar').innerHTML = '';
    $('#modals').innerHTML = '';
    $('#toasts').innerHTML = '';
    OS.wins = {};
    OS.notifs = [];
    OS.applyWallpaper();
    OS.renderLock(true);
    OS.startClock();
};

OS.close = function () {
    OS.isOpen = false;
    OS.state = null;
    OS.timers.forEach(t => clearInterval(t));
    OS.timers = [];
    Object.values(OS.wins).forEach(w => { try { const d = Apps.defs[w.app]; d && d.onClose && d.onClose(w); } catch (e) { /* ignore */ } });
    OS.wins = {};
    $('#os').classList.add('hidden');
    $('#start').classList.add('hidden');
    $('#notif-center').classList.add('hidden');
    $('#modals').innerHTML = '';
};

OS.logout = () => post('pcClose', { reason: 'logout' });

// ==========================================
// Lock / login screen (the login fills itself in and logs in)
// ==========================================
function clockText() {
    const d = new Date();
    const clock24 = !OS.state || OS.state.settings.clock24 !== false;
    return d.toLocaleTimeString(LOCALE(), { hour: '2-digit', minute: '2-digit', hour12: !clock24 });
}
function dateText(long) {
    return new Date().toLocaleDateString(LOCALE(), long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function accountName(login) {
    const parts = String(login.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
    const user = parts.length > 1 ? parts[0][0] + '.' + parts[parts.length - 1] : (parts[0] || 'officer');
    return `${(login.deptShort || 'PD').toLowerCase()}\\${user.replace(/[^a-z0-9.]/g, '')}`;
}

OS.renderLock = function (auto) {
    const lg = OS.login;
    OS.locked = true;
    const lock = $('#lock');
    lock.classList.remove('out', 'hidden');
    lock.innerHTML = `
        <div class="lk-clock" id="lk-clock">${clockText()}</div>
        <div class="lk-date">${dateText(true)}</div>
        <div class="lk-card">
            <div class="lk-badge">${icon('shield')}</div>
            <div class="lk-name">${esc(lg.label || lg.name)}</div>
            <div class="lk-dept">${esc(lg.dept || '')}</div>
            <div class="lk-field">
                <div class="lk-input" id="lk-user">${icon('user')}<span class="v"></span></div>
                <div class="lk-input" id="lk-pass">${icon('lock')}<span class="v pw"></span></div>
            </div>
            <button class="btn primary lk-btn" id="lk-go">${T('ui_login')}</button>
            <div class="lk-status" id="lk-status"></div>
        </div>
        <div class="lk-hint">${T('ui_lock_hint')}</div>
        <button class="btn ghost sm" id="lk-off" style="position:absolute;bottom:16px;right:16px">${icon('power', 'sm')} ${T('ui_shutdown')}</button>`;
    $('#lk-off').onclick = OS.logout;
    $('#lk-go').onclick = () => OS.autoLogin();
    if (auto) setTimeout(() => OS.autoLogin(), 350);
};

let typing = false;
let loginRun = 0; // a new open / lock cancels a running login animation
async function typeInto(el, text, ms) {
    el.innerHTML = '';
    for (const ch of text) {
        el.textContent += ch;
        await new Promise(r => setTimeout(r, ms));
    }
}

OS.autoLogin = async function () {
    if (typing) return;
    typing = true;
    const run = ++loginRun;
    const lg = OS.login;
    const u = $('#lk-user'), p = $('#lk-pass'), st = $('#lk-status');
    $('#lk-go').disabled = true;
    u.classList.add('focus');
    await typeInto($('.v', u), accountName(lg), 28);
    u.classList.remove('focus');
    p.classList.add('focus');
    await typeInto($('.v', p), '••••••••••', 45);
    p.classList.remove('focus');
    st.innerHTML = `<div class="spinner"></div>${T('ui_logging_in')}`;
    const minWait = new Promise(r => setTimeout(r, Math.max(300, (lg.bootMs || 1400) - 900)));
    const res = await post('pcLogin');
    await minWait;
    if (run !== loginRun || !OS.isOpen) return;
    typing = false;
    if (!res || res.error) {
        st.innerHTML = `<span class="bad">${errMsg(res)}</span>`;
        $('#lk-go').disabled = false;
        return;
    }
    OS.boot(res);
};

OS.lock = function () {
    if (!OS.state) return;
    $('#start').classList.add('hidden');
    $('#notif-center').classList.add('hidden');
    OS.renderLock(false);
};

OS.forceLock = function () { /* the client closes the PC when the session ends */ };

// ==========================================
// Boot the desktop
// ==========================================
OS.boot = function (payload) {
    const first = !OS.state;
    OS.state = payload;
    OS.perms = new Set(payload.perms || []);
    OS.applyWallpaper();
    if (first) {
        OS.renderDesktop();
        OS.renderTaskbar();
        OS.timers.push(setInterval(OS.refreshBadges, 30000));
        OS.refreshBadges();
        OS.watchIdle();
    } else {
        OS.renderDesktop();
        OS.renderTaskbar();
    }
    OS.locked = false;
    $('#lock').classList.add('out');
    setTimeout(() => { if (!OS.locked) $('#lock').classList.add('hidden'); }, 400);
};

// Roles / perms changed while logged in
OS.session = function (payload) {
    if (!OS.state) return;
    OS.state = payload;
    OS.perms = new Set(payload.perms || []);
    const allowed = new Set(payload.apps.map(a => a.id));
    Object.values(OS.wins).forEach(w => { if (!allowed.has(w.app)) OS.closeWin(w.id); });
    OS.renderDesktop();
    OS.renderTaskbar();
    OS.toast({ title: T('ui_perms_changed'), app: 'settings' });
};

// ==========================================
// Desktop icons + widget
// ==========================================
const GRID = { w: 96, h: 100 };

OS.renderDesktop = function () {
    const st = OS.state;
    const icons = st.settings.icons || {};
    const area = $('#icons');
    // many apps: smaller cells, and without room the widget gives way to the icons
    const W = area.clientWidth || 1200, H = area.clientHeight || 600, n = st.apps.length;
    const fits = (g, free) => Math.max(1, Math.floor((W - free) / g.w)) * Math.max(1, Math.floor(H / g.h)) >= n;
    let showWidget = true;
    Object.assign(GRID, { w: 96, h: 100 });
    if (!fits(GRID, 290)) {
        Object.assign(GRID, { w: 88, h: 90 });
        if (!fits(GRID, 290)) showWidget = false;
    }
    $('#widget').classList.toggle('hidden', !showWidget);
    const rows = Math.max(1, Math.floor(H / GRID.h));
    area.innerHTML = st.apps.map((a, i) => {
        const pos = icons[a.id] || [Math.floor(i / rows), i % rows];
        return `<div class="dicon" data-app="${esc(a.id)}" style="left:${pos[0] * GRID.w}px;top:${pos[1] * GRID.h}px">
            <div class="ico">${appIcon(a.external ? 'mdt' : a.id, '', a.external ? (a.icon || 'mdt') : undefined)}<span class="badge hidden" data-badge="${esc(a.id)}"></span></div>
            <div class="lbl">${esc(OS.appTitle(a.id))}</div></div>`;
    }).join('');
    OS.renderWidget();
    OS.paintBadges();
};

OS.renderWidget = function () {
    const st = OS.state, u = st.user;
    $('#widget').innerHTML = `
        <div class="w-time" id="w-time">${clockText()}</div>
        <div class="w-date">${dateText(true)}</div>
        <div class="w-user"><div class="avatar" ${bg(u.photo)}>${u.photo ? '' : initials(u.name)}</div>
            <div class="grow"><div class="n ellipsis">${esc(u.name)}</div><div class="r ellipsis">${esc(u.gradeLabel || '')} · ${esc(u.deptShort || '')}</div></div>
            <span class="chip" style="color:${esc(u.role.color)};border-color:${esc(u.role.color)}55">${esc(u.role.label)}</span></div>
        <div class="w-stats">
            ${OS.can('mail.use') ? `<div class="w-stat" data-open="mail"><b id="ws-mail">-</b><span>${T('ui_unread_mail')}</span></div>` : ''}
            ${OS.can(['warrants.approve', 'bolo.approve']) ? `<div class="w-stat" data-open="warrants"><b id="ws-warrants">-</b><span>${T('ui_pending_requests')}</span></div>` : ''}
            ${st.printers.length ? `<div class="w-stat" data-printer><b id="ws-printer">-</b><span>${T('ui_printouts_ready')}</span></div>` : ''}
            ${st.workplace ? `<div class="w-stat"><b style="font-size:13px" class="ellipsis">${esc(st.workplace.label)}</b><span>${T('ui_workplace')}</span></div>` : ''}
        </div>`;
};

OS.refreshBadges = async function () {
    if (!OS.state || !OS.isOpen) return;
    const res = await api('system:badges');
    if (!res || res.error) return;
    OS.badges = res;
    OS.paintBadges();
};

OS.paintBadges = function () {
    const b = OS.badges || {};
    $$('[data-badge]').forEach(el => {
        const n = b[el.dataset.badge] || 0;
        el.textContent = n > 99 ? '99+' : n;
        el.classList.toggle('hidden', !n);
    });
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v ?? 0; };
    set('#ws-mail', b.mail);
    set('#ws-warrants', b.warrants);
    set('#ws-printer', b.printer);
    const nb = $('#tb-notif-badge');
    if (nb) {
        const n = OS.notifs.filter(x => !x.read).length;
        nb.textContent = n;
        nb.classList.toggle('hidden', !n);
    }
};

// icon drag + double click to open
(function iconEvents() {
    let drag = null, sel = null;
    document.addEventListener('mousedown', e => {
        const ic = e.target.closest('.dicon');
        if (!ic || e.button !== 0) return;
        if (sel) sel.classList.remove('sel');
        sel = ic;
        ic.classList.add('sel');
        const r = ic.getBoundingClientRect();
        drag = { el: ic, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
    });
    document.addEventListener('mousemove', e => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        drag.el.classList.add('drag');
        const area = $('#icons').getBoundingClientRect();
        drag.el.style.left = (e.clientX - area.left - drag.dx) + 'px';
        drag.el.style.top = (e.clientY - area.top - drag.dy) + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.moved) return;
        d.el.classList.remove('drag');
        const area = $('#icons');
        const maxX = Math.max(0, Math.floor(area.clientWidth / GRID.w) - 1), maxY = Math.max(0, Math.floor(area.clientHeight / GRID.h) - 1);
        const gx = Math.min(maxX, Math.max(0, Math.round(parseFloat(d.el.style.left) / GRID.w)));
        const gy = Math.min(maxY, Math.max(0, Math.round(parseFloat(d.el.style.top) / GRID.h)));
        d.el.style.left = gx * GRID.w + 'px';
        d.el.style.top = gy * GRID.h + 'px';
        const icons = OS.state.settings.icons || {};
        // other icons keep their current place
        $$('.dicon').forEach(el => { icons[el.dataset.app] = [Math.round(parseFloat(el.style.left) / GRID.w), Math.round(parseFloat(el.style.top) / GRID.h)]; });
        OS.state.settings.icons = icons;
        api('system:settings', { icons });
    });
    document.addEventListener('dblclick', e => {
        const ic = e.target.closest('.dicon');
        if (ic) OS.openApp(ic.dataset.app);
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.dicon') && sel) { sel.classList.remove('sel'); sel = null; }
        const w = e.target.closest('[data-open]');
        if (w && OS.isOpen && w.closest('#widget')) OS.openApp(w.dataset.open);
        if (e.target.closest('#widget [data-printer]')) OS.printerStatus();
        if (!e.target.closest('#start') && !e.target.closest('.tb-start')) $('#start').classList.add('hidden');
        if (!e.target.closest('#notif-center') && !e.target.closest('#tb-notif')) $('#notif-center').classList.add('hidden');
        if (!e.target.closest('.ctx')) $$('.ctx').forEach(c => c.remove());
    });
    document.addEventListener('contextmenu', e => {
        if (!OS.isOpen || !OS.state || OS.locked) return;
        if (!e.target.closest('#desktop') || e.target.closest('.widget')) return;
        e.preventDefault();
        $$('.ctx').forEach(c => c.remove());
        const scr = $('#screen').getBoundingClientRect();
        const m = h(`<div class="ctx" style="left:${e.clientX - scr.left}px;top:${e.clientY - scr.top}px">
            <button data-c="refresh">${icon('refresh', 'sm')}${T('ui_refresh')}</button>
            <button data-c="settings">${icon('settings', 'sm')}${T('ui_personalize')}</button>
            <button data-c="arrange">${icon('grid', 'sm')}${T('ui_arrange')}</button>
            <button data-c="lock">${icon('lock', 'sm')}${T('ui_lock')}</button></div>`);
        m.onclick = ev => {
            const c = ev.target.closest('[data-c]');
            if (!c) return;
            m.remove();
            if (c.dataset.c === 'refresh') { OS.refreshBadges(); OS.renderDesktop(); }
            if (c.dataset.c === 'settings') OS.openApp('settings');
            if (c.dataset.c === 'lock') OS.lock();
            if (c.dataset.c === 'arrange') { OS.state.settings.icons = {}; api('system:settings', { icons: {} }); OS.renderDesktop(); }
        };
        $('#screen').appendChild(m);
    });
})();

// ==========================================
// Taskbar + start menu + notification centre
// ==========================================
OS.renderTaskbar = function () {
    const st = OS.state;
    const modeTag = st.mode === 'laptop' ? T('ui_mode_laptop') : (st.mode === 'vehicle' ? T('ui_mode_vehicle') : null);
    $('#taskbar').innerHTML = `
        <button class="tb-start" id="tb-start" title="${T('ui_start')}">${icon('shield')}</button>
        <div class="tb-sep"></div>
        <div class="tb-apps" id="tb-apps"></div>
        <div class="tb-tray">
            ${modeTag ? `<span class="tb-mode">${modeTag}</span>` : ''}
            ${st.printers.length ? `<button class="tb-btn" id="tb-printer" title="${T('ui_printers')}">${icon('printer')}</button>` : ''}
            <button class="tb-btn" id="tb-notif" title="${T('ui_notifications')}">${icon('bell')}<span class="badge hidden" id="tb-notif-badge"></span></button>
            <button class="tb-btn" id="tb-lock" title="${T('ui_lock')}">${icon('lock')}</button>
            <div class="tb-clock"><b id="tb-time">${clockText()}</b><span id="tb-date">${dateText(false)}</span></div>
        </div>`;
    $('#tb-start').onclick = OS.toggleStart;
    $('#tb-notif').onclick = OS.toggleNotifs;
    $('#tb-lock').onclick = OS.lock;
    const pr = $('#tb-printer');
    if (pr) pr.onclick = OS.printerStatus;
    OS.renderTaskApps();
    OS.paintBadges();
};

OS.renderTaskApps = function () {
    const box = $('#tb-apps');
    if (!box) return;
    box.innerHTML = Object.values(OS.wins).map(w => `<button class="tb-app ${OS.focused === w.id && !w.min ? 'focus' : ''} ${w.min ? 'min' : ''}" data-w="${w.id}">
        ${appIcon(w.ext ? 'mdt' : w.app, 'sm')}<span>${esc(w.title)}</span></button>`).join('');
    box.onclick = e => {
        const b = e.target.closest('[data-w]');
        if (!b) return;
        const w = OS.wins[b.dataset.w];
        if (!w) return;
        if (w.min) { w.min = false; w.el.classList.remove('hidden'); OS.focusWin(w.id); if (w.stale) OS.refreshWin(w, false); }
        else if (OS.focused === w.id) OS.minWin(w.id);
        else OS.focusWin(w.id);
    };
};

OS.toggleStart = function () {
    const el = $('#start');
    if (!el.classList.contains('hidden')) return el.classList.add('hidden');
    $('#notif-center').classList.add('hidden');
    const st = OS.state, u = st.user;
    el.innerHTML = `
        <div class="st-head"><div class="avatar lg" ${bg(u.photo)}>${u.photo ? '' : initials(u.name)}</div>
            <div class="grow"><div class="n">${esc(u.name)}</div><div class="r">${esc(u.gradeLabel || '')} · ${esc(u.dept || '')}</div>
            <div class="st-certs"><span class="chip" style="color:${esc(u.role.color)};border-color:${esc(u.role.color)}55">${esc(u.role.label)}</span>
            ${(u.certs || []).map(c => `<span class="chip accent">${esc(c)}</span>`).join('')}</div></div></div>
        <div class="st-search"><div class="search">${icon('search')}<input class="input" id="st-q" placeholder="${T('ui_search_apps')}"></div></div>
        <div class="st-apps" id="st-apps"></div>
        <div class="st-foot"><span class="muted" style="font-size:11px">${st.workplace ? esc(st.workplace.label) : ''}</span>
            <div class="row"><button class="btn sm" id="st-lock">${icon('lock', 'sm')}${T('ui_lock')}</button>
            <button class="btn sm danger" id="st-off">${icon('power', 'sm')}${T('ui_logout')}</button></div></div>`;
    const render = q => {
        q = (q || '').toLowerCase();
        $('#st-apps').innerHTML = st.apps.filter(a => !q || OS.appTitle(a.id).toLowerCase().includes(q))
            .map(a => `<button class="st-app" data-app="${esc(a.id)}">${appIcon(a.external ? 'mdt' : a.id, 'md', a.external ? (a.icon || 'mdt') : undefined)}<span>${esc(OS.appTitle(a.id))}</span></button>`).join('');
    };
    render('');
    $('#st-q').oninput = e => render(e.target.value);
    $('#st-q').onkeydown = e => { if (e.key === 'Enter') { const f = $('#st-apps .st-app'); if (f) { OS.openApp(f.dataset.app); el.classList.add('hidden'); } } };
    $('#st-apps').onclick = e => { const b = e.target.closest('[data-app]'); if (b) { OS.openApp(b.dataset.app); el.classList.add('hidden'); } };
    $('#st-lock').onclick = () => { el.classList.add('hidden'); OS.lock(); };
    $('#st-off').onclick = OS.logout;
    el.classList.remove('hidden');
    setTimeout(() => $('#st-q').focus(), 30);
};

OS.toggleNotifs = function () {
    const el = $('#notif-center');
    if (!el.classList.contains('hidden')) return el.classList.add('hidden');
    $('#start').classList.add('hidden');
    OS.notifs.forEach(n => { n.read = true; });
    el.innerHTML = `<div class="nc-head"><span>${T('ui_notifications')}</span><button class="btn sm ghost" id="nc-clear">${T('ui_clear')}</button></div>
        <div class="nc-list">${OS.notifs.length ? OS.notifs.slice().reverse().map((n, i) => `<div class="nc-item" data-i="${OS.notifs.length - 1 - i}">
            ${appIcon(n.app || 'settings', 'sm')}<div class="grow"><div class="t">${esc(n.title)}</div><div class="x">${esc(n.text || '')}</div></div>
            <span class="dim" style="font-size:10px">${fmtTime(n.at)}</span></div>`).join('') : `<div class="empty">${icon('bell')}${T('ui_no_notifications')}</div>`}</div>`;
    $('#nc-clear').onclick = () => { OS.notifs = []; el.classList.add('hidden'); OS.paintBadges(); };
    el.onclick = e => {
        const it = e.target.closest('.nc-item');
        if (!it) return;
        const n = OS.notifs[+it.dataset.i];
        if (n && n.app && OS.state.apps.find(a => a.id === n.app)) OS.openApp(n.app, { ref: n.ref });
        el.classList.add('hidden');
    };
    el.classList.remove('hidden');
    OS.paintBadges();
};

OS.printerStatus = async function () {
    const res = await api('printer:list');
    const list = (res && res.printers) || [];
    UI.modal({
        title: T('ui_printers'), icon: 'printer',
        body: list.length ? `<div class="col">${list.map(p => `<div class="printer-opt">${icon('printer', 'lg')}<div class="grow">
            <div style="font-weight:700">${esc(p.label)}</div><div class="meta">${p.paper != null ? `<span>${T('ui_paper')}: ${p.paper}/${p.capacity}</span>` : ''}
            ${p.toner != null ? `<span>${T('ui_toner')}: ${p.toner} %</span>` : ''}<span>${T('ui_queue')}: ${p.queue}</span><span>${T('ui_tray')}: ${p.tray}</span></div></div>
            ${p.mine ? `<span class="chip accent">${T('ui_yours_ready', p.mine)}</span>` : ''}${p.err ? `<span class="chip bad">${T('perr_' + p.err)}</span>` : ''}</div>`).join('')}</div>`
            : `<div class="empty">${T('err_no_printer')}</div>`,
    });
};

// ==========================================
// Notifications
// ==========================================
let audioCtx;
function beep() {
    if (OS.state && OS.state.settings.sound === false) return;
    try {
        audioCtx = audioCtx || new AudioContext();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, audioCtx.currentTime);
        o.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.09);
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        o.connect(g).connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.32);
    } catch (e) { /* no audio */ }
}

// n = { title, text, app, ref, type }
OS.toast = function (n) {
    if (!OS.isOpen) return post('notify', { msg: n.title + (n.text ? ': ' + n.text : ''), type: n.type === 'error' ? 'error' : 'inform' });
    const el = h(`<div class="toast ${n.type || ''}">${n.app ? appIcon(n.app, 'sm') : icon(n.type === 'error' ? 'warn' : 'check')}
        <div class="grow"><div class="t">${esc(n.title)}</div>${n.text ? `<div class="x">${esc(n.text)}</div>` : ''}</div></div>`);
    el.onclick = () => {
        if (n.app && OS.state && OS.state.apps.find(a => a.id === n.app)) OS.openApp(n.app, { ref: n.ref });
        el.remove();
    };
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, n.type === 'error' ? 4500 : 5500);
};

// from the server (mail, approvals, printouts...)
OS.notify = function (n) {
    if (!OS.isOpen) return;
    n.at = Math.floor(Date.now() / 1000);
    OS.notifs.push(n);
    if (OS.notifs.length > 50) OS.notifs.shift();
    OS.toast(n);
    beep();
    OS.refreshBadges();
    Object.values(OS.wins).forEach(w => {
        const d = Apps.defs[w.app];
        if (d && d.onNotify && n.app === w.app) d.onNotify(w, n);
    });
};

// Which open apps show data changed by an API call (prefix of the call name -> apps)
const AFFECTS = {
    cases: ['cases', 'gallery', 'documents', 'notes'], documents: ['documents', 'cases'], gallery: ['gallery', 'cases'],
    notes: ['notes', 'cases'], warrants: ['warrants', 'cases', 'prisoners'], weapons: ['weapons', 'cases'],
    forensics: ['forensics', 'cases', 'weapons'], prisoners: ['prisoners', 'cases', 'gallery'], penal: ['penal'],
    shifts: ['shifts'], management: ['management'], printer: ['gallery', 'documents', 'cases'],
    training: ['training'], ia: ['ia'], desk: ['desk', 'warrants', 'cases'], armory: ['armory', 'weapons'],
};

// Reload a window. auto = after a change somewhere -> skipped while the person types in it / it is minimised
OS.refreshWin = function (w, auto) {
    if (!w || !OS.wins[w.id]) return;
    if (auto) {
        if (w.min) { w.stale = true; return; }
        const a = document.activeElement;
        if (a && w.el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox') { w.stale = true; return; }
        if (w.el.querySelector('.viewer')) { w.stale = true; return; }
    }
    w.stale = false;
    if (w.refresh) {
        try { w.refresh(); } catch (e) { console.error(e); }
    } else if (!w.ext) {
        // apps without their own refresh are mounted again
        w.body.innerHTML = '';
        w.state = {};
        Apps.defs[w.app].mount(w, {});
    }
};

OS.live = function (ev) {
    if (ev.event === 'changed') {
        const prefix = String((ev.data && ev.data.name) || '').split(':')[0];
        const apps = AFFECTS[prefix] || [];
        Object.values(OS.wins).forEach(w => {
            if (!apps.includes(w.app)) return;
            clearTimeout(w.refreshTimer);
            w.refreshTimer = setTimeout(() => OS.refreshWin(w, true), 600);
        });
        if (prefix === 'warrants' || prefix === 'printer') OS.refreshBadges();
        return;
    }
    if (ev.event === 'chat' && ev.data && ev.data.msg && OS.state && ev.data.msg.fromId !== OS.state.user.id) {
        const w = Object.values(OS.wins).find(x => x.app === 'chat');
        if (!w || w.state.current !== ev.data.channel || w.min) {
            OS.badges.chat = (OS.badges.chat || 0) + 1;
            OS.paintBadges();
        }
    }
    Object.values(OS.wins).forEach(w => {
        const d = Apps.defs[w.app];
        if (d && d.onLive) d.onLive(w, ev.event, ev.data);
    });
};

// ==========================================
// Clock + idle lock
// ==========================================
OS.startClock = function () {
    OS.timers.push(setInterval(() => {
        const t = clockText();
        ['#lk-clock', '#tb-time', '#w-time'].forEach(s => { const el = $(s); if (el) el.textContent = t; });
    }, 1000));
};

let lastInput = Date.now();
['mousemove', 'keydown', 'mousedown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));

OS.watchIdle = function () {
    lastInput = Date.now();
    OS.timers.push(setInterval(() => {
        const mins = OS.state && OS.state.server.autoLock;
        if (mins && !OS.locked && Date.now() - lastInput > mins * 60000) OS.lock();
    }, 15000));
};

// ==========================================
// Windows
// ==========================================
let winSeq = 0;

OS.openApp = function (appId, args = {}) {
    if (!OS.state || OS.locked) return;
    const meta = OS.state.apps.find(a => a.id === appId);
    if (!meta) return;
    // one window per app (the app gets the new args)
    const open = Object.values(OS.wins).find(w => w.app === appId);
    if (open) {
        if (open.min) { open.min = false; open.el.classList.remove('hidden'); if (open.stale) OS.refreshWin(open, false); }
        OS.focusWin(open.id);
        const d = Apps.defs[appId];
        if (d && d.onArgs && args && Object.keys(args).length) d.onArgs(open, args);
        return open;
    }
    const def = meta.external ? Apps.external : Apps.defs[appId];
    if (!def) return;
    const scr = $('#windows');
    const W = scr.clientWidth, H = scr.clientHeight;
    const w = Math.min(def.w || 900, W - 20), hgt = Math.min(def.h || 600, H - 20);
    const n = Object.keys(OS.wins).length;
    const id = 'w' + (++winSeq);
    const el = h(`<div class="win" data-win="${id}" style="width:${w}px;height:${hgt}px;left:${Math.max(10, (W - w) / 2 + n * 26 - 40)}px;top:${Math.max(8, (H - hgt) / 2 + n * 22 - 30)}px">
        <div class="w-bar">${appIcon(meta.external ? 'mdt' : appId, 'sm', meta.external ? (meta.icon || 'mdt') : undefined)}
            <div class="w-title">${esc(OS.appTitle(appId))}</div>
            <div class="w-btns">${meta.external ? '' : `<button class="w-btn" data-wa="refresh" title="${T('ui_refresh')}">${icon('refresh')}</button>`}
            ${!meta.external && appId !== 'help' && OS.state.apps.find(a => a.id === 'help') ? `<button class="w-btn" data-wa="help" title="${T('app_help')}">${icon('help')}</button>` : ''}
            <button class="w-btn" data-wa="min">${icon('min')}</button><button class="w-btn" data-wa="max">${icon('max')}</button>
            <button class="w-btn close" data-wa="close">${icon('close')}</button></div></div>
        <div class="w-body"></div><div class="w-resize"></div></div>`);
    scr.appendChild(el);
    const win = { id, app: appId, el, body: $('.w-body', el), title: OS.appTitle(appId), min: false, ext: !!meta.external, meta, state: {} };
    win.setTitle = t => { win.title = t ? `${OS.appTitle(appId)} — ${t}` : OS.appTitle(appId); $('.w-title', el).textContent = win.title; OS.renderTaskApps(); };
    win.close = () => OS.closeWin(id);
    OS.wins[id] = win;
    bindWin(win);
    OS.focusWin(id);
    try { def.mount(win, args); } catch (e) { console.error(e); win.body.innerHTML = `<div class="empty">${icon('warn')}${esc(String(e))}</div>`; }
    return win;
};

OS.focusWin = function (id) {
    const w = OS.wins[id];
    if (!w) return;
    OS.z += 1;
    w.el.style.zIndex = OS.z;
    OS.focused = id;
    Object.values(OS.wins).forEach(x => x.el.classList.toggle('inactive', x.id !== id));
    OS.renderTaskApps();
};

OS.minWin = function (id) {
    const w = OS.wins[id];
    if (!w) return;
    w.min = true;
    w.el.classList.add('hidden');
    if (OS.focused === id) OS.focused = null;
    OS.renderTaskApps();
};

OS.closeWin = function (id) {
    const w = OS.wins[id];
    if (!w) return;
    const d = w.ext ? null : Apps.defs[w.app];
    try { d && d.onClose && d.onClose(w); } catch (e) { /* ignore */ }
    delete OS.wins[id];
    w.el.classList.add('closing');
    setTimeout(() => w.el.remove(), 130);
    if (OS.focused === id) OS.focused = null;
    OS.renderTaskApps();
};

function bindWin(win) {
    const el = win.el, bar = $('.w-bar', el);
    el.addEventListener('mousedown', () => { if (OS.focused !== win.id) OS.focusWin(win.id); });
    bar.addEventListener('dblclick', e => { if (!e.target.closest('.w-btn')) el.classList.toggle('max'); });
    bar.addEventListener('click', e => {
        const b = e.target.closest('[data-wa]');
        if (!b) return;
        if (b.dataset.wa === 'close') OS.closeWin(win.id);
        if (b.dataset.wa === 'refresh') OS.refreshWin(win, false);
        if (b.dataset.wa === 'help') OS.openApp('help', { topic: win.app });
        if (b.dataset.wa === 'min') OS.minWin(win.id);
        if (b.dataset.wa === 'max') {
            el.classList.toggle('max');
            b.innerHTML = icon(el.classList.contains('max') ? 'restore' : 'max');
        }
    });
    bar.addEventListener('mousedown', e => {
        if (e.target.closest('.w-btn') || el.classList.contains('max') || e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
        const area = $('#windows');
        const move = ev => {
            el.style.left = Math.min(area.clientWidth - 80, Math.max(-el.offsetWidth + 120, ox + ev.clientX - sx)) + 'px';
            el.style.top = Math.min(area.clientHeight - 38, Math.max(0, oy + ev.clientY - sy)) + 'px';
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
    $('.w-resize', el).addEventListener('mousedown', e => {
        e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, ow = el.offsetWidth, oh = el.offsetHeight;
        const move = ev => {
            el.style.width = Math.max(380, ow + ev.clientX - sx) + 'px';
            el.style.height = Math.max(260, oh + ev.clientY - sy) + 'px';
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
}

// External app (other resource, e.g. the MDT) in a frame
Apps.external = {
    w: 1100, h: 680,
    mount(win) {
        win.body.innerHTML = `<iframe class="ext-frame" src="${esc(win.meta.url)}"></iframe>`;
    },
};

// Keyboard: Esc closes the start menu / top dialog
document.addEventListener('keydown', e => {
    if (!OS.isOpen) return;
    if (e.key === 'Escape') {
        const m = $$('#modals .modal-bg').pop();
        if (m) return m.querySelector('[data-x]').click();
        if (!$('#start').classList.contains('hidden')) return $('#start').classList.add('hidden');
        if (!$('#notif-center').classList.contains('hidden')) return $('#notif-center').classList.add('hidden');
    }
});

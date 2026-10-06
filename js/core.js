// ==========================================
// FiveZone Police PC - UI core (translations, NUI calls, icons, helpers, dialogs, pickers)
// ==========================================

const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'fz_police_pc';
const L = {};

// T('key', a, b) - Lua style placeholders (%s, %d)
function T(key, ...args) {
    let s = L[key] !== undefined ? L[key] : key;
    let i = 0;
    return String(s).replace(/%%|%[sd]/g, m => (m === '%%' ? '%' : i < args.length ? args[i++] : m));
}

function applyT(root = document) {
    root.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
}

function post(name, data = {}) {
    return fetch(`https://${RES}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    }).then(r => r.json()).catch(() => null);
}

// App API (server checks the session + permission)
async function api(name, payload = {}) {
    const res = await post('api', { name, payload });
    if (!res) return { error: 'timeout' };
    if (res.error === 'no_session' || res.error === 'too_far' || res.error === 'off_duty') OS.forceLock && OS.forceLock(res.error);
    return res;
}
const srv = (name, payload = {}) => post('srv', { name, payload });
const errMsg = res => T('err_' + ((res && res.error) || 'timeout'));

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// style="background-image:url(...)" (https / nui / local img only)
function bgUrl(url) {
    if (!url || !/^(https:\/\/|nui:\/\/|img\/)/.test(url)) return '';
    return `background-image:url('${encodeURI(url).replace(/'/g, '%27')}')`;
}
function bg(url) { const s = bgUrl(url); return s ? `style="${s}"` : ''; }

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join(''); }

// ==========================================
// Time
// ==========================================
const LOCALE = () => ({ cs: 'cs-CZ', de: 'de-DE', ru: 'ru-RU' }[L.__locale] || 'en-GB');
function fmtDate(ts) { return ts ? new Date(ts * 1000).toLocaleDateString(LOCALE(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'; }
function fmtTime(ts) { return ts ? new Date(ts * 1000).toLocaleTimeString(LOCALE(), { hour: '2-digit', minute: '2-digit' }) : '-'; }
function fmtDT(ts) { return ts ? `${fmtDate(ts)} ${fmtTime(ts)}` : '-'; }
function ago(ts) {
    if (!ts) return '-';
    const d = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (d < 60) return T('ago_now');
    if (d < 3600) return T('ago_min', Math.floor(d / 60));
    if (d < 86400) return T('ago_hour', Math.floor(d / 3600));
    if (d < 86400 * 7) return T('ago_day', Math.floor(d / 86400));
    return fmtDate(ts);
}
function money(n) { return (OS.state && OS.state.server ? OS.state.server.currency : '$') + Number(n || 0).toLocaleString(LOCALE()); }

// ==========================================
// Icons (24px stroke)
// ==========================================
const ICONS = {
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    badge: '<path d="M12 2.5l2.3 2 3-.4.9 2.9 2.6 1.6-1 2.8 1 2.8-2.6 1.6-.9 2.9-3-.4-2.3 2-2.3-2-3 .4-.9-2.9L2.2 14.2l1-2.8-1-2.8 2.6-1.6.9-2.9 3 .4z"/><circle cx="12" cy="11.5" r="3.2"/>',
    cases: '<path d="M3.5 7.5h17v11a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8.5 7.5V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5v2M3.5 12.5h17M11 12.5v2h2v-2"/>',
    forensics: '<path d="M12 11v3a8 8 0 0 1-1.5 4.7"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0v1.5a12 12 0 0 1-1 4.8"/><path d="M5.5 15.5A9 9 0 0 1 5 12a7 7 0 0 1 12.5-4.3"/><path d="M19 12v1a16 16 0 0 1-.6 4.3"/><path d="M8 4.7A9 9 0 0 1 12 4"/>',
    prisoners: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0M8 3.5v3M12 3.5v3M16 3.5v3"/>',
    gallery: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M20.5 15.5l-5-5-9 9"/>',
    warrants: '<path d="M14.5 4.5l5 5M12 7l5 5M5 19l7-7M16.5 2.5l5 5-3 3-5-5zM9.5 9.5l5 5-3 3-5-5z"/><path d="M3 21h8"/>',
    penal: '<path d="M12 4v16M6 20h12M4 8h16"/><path d="M6.5 8L4 14a3 3 0 0 0 5 0zM17.5 8L15 14a3 3 0 0 0 5 0z"/>',
    notes: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M9 12h7M9 15.5h7M9 8.5h3"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    documents: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/><path d="M4 6v15h12"/>',
    roster: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a4.5 4.5 0 0 1 5 4.5"/>',
    weapons: '<path d="M3 8.5h15l2.5 2-1 1.5H14l-1.5 2.5h-2.5L9 18H5.5l1.5-6H3z"/><path d="M18 8.5V6.5"/>',
    shifts: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6"/>',
    management: '<path d="M12 3l7 3v5c0 4.3-3 8-7 9-4-1-7-4.7-7-9V6z"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16a3.8 3.8 0 0 1 7 0"/>',
    audit: '<path d="M4 5h16M4 10h10M4 15h7M4 20h7"/><circle cx="17" cy="16" r="3"/><path d="M19.2 18.2L21 20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3.5a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.2.8z"/>',
    chat: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    stats: '<path d="M4 20h16M7 16v-5M11 16V7M15 16v-3M19 16V9"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17v.01"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    mdt: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4M7 9h4M7 12h7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    min: '<path d="M6 12h12"/>',
    max: '<rect x="5.5" y="5.5" width="13" height="13" rx="1"/>',
    restore: '<rect x="5" y="8" width="11" height="11" rx="1"/><path d="M8 8V5h11v11h-3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    power: '<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    printer: '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8" rx="1.5"/><path d="M7 13.5h10v7H7z"/><circle cx="17" cy="11" r="0.6"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3.5 11h17v5h-17z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
    warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    folder: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    tag: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8.5" r="1.3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    inbox: '<path d="M3.5 13.5l3-8.5h11l3 8.5v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    reply: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    dna: '<path d="M7 3c0 6 10 6 10 12 0 3-2 5-2 6M17 3c0 6-10 6-10 12 0 3 2 5 2 6M8.5 7h7M8.5 17h7M10 12h4"/>',
    bullet: '<path d="M9 21V10c0-3 1.3-6 3-7 1.7 1 3 4 3 7v11z"/><path d="M9 16h6"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M5 11h14"/>',
    interrogations: '<rect x="3.5" y="4" width="17" height="12" rx="1.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 20h8M12 16v4"/><circle cx="17.5" cy="6.8" r=".9" fill="currentColor"/>',
    court: '<path d="M12 3l9 4.5H3z"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18"/>',
    interrogation: '<rect x="3.5" y="4" width="17" height="12" rx="1.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 20h8M12 16v4"/>',
    training: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5.5"/>',
    armory: '<path d="M3 15.5h9.5l2-2H21v-3h-6.5l-1-1.5H5.5L3 11z"/><path d="M8 15.5l-1 4h3l1.2-4M15 10.5v3"/>',
    desk: '<path d="M4 4.5h16v9H4z"/><path d="M2.5 13.5h19v3h-19zM8.5 16.5v3M15.5 16.5v3M8 8h8M8 10.5h5"/>',
    ia: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.6 14.6L20 20"/><path d="M10.5 7.5l1 2 2.1.3-1.5 1.5.4 2.1-2-1-2 1 .4-2.1-1.5-1.5 2.1-.3z"/>',
    gavel: '<path d="M14.5 4.5l5 5M8 11l5 5M11.5 7.5l5 5M3 21l7-7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    board: '<rect x="3.5" y="4.5" width="17" height="12" rx="1"/><path d="M8 20l2-3.5M16 20l-2-3.5M8 9h3M13 8h3v3M8 12.5h4"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
    heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
    bullets: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    checklist: '<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"/>',
    quote: '<path d="M7 7h4v4H8v2a2 2 0 0 1-2 2M15 7h4v4h-3v2a2 2 0 0 1-2 2"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICONS[name] || ICONS.grid}</svg>`;

// App colours (icon gradient)
const APP_LOOK = {
    cases: ['#f1c40f', '#a8810a', '#17140a'], forensics: ['#3aa0ff', '#1c4f8f'], prisoners: ['#e67e22', '#8a4510'],
    gallery: ['#9b59b6', '#53296a'], warrants: ['#e74c3c', '#7c1d14'], penal: ['#7f8c8d', '#3b4446'],
    notes: ['#f5d76e', '#b08d1f', '#2a220a'], mail: ['#2ecc71', '#156b3a'], documents: ['#ecf0f1', '#8e9aa3', '#1b2129'],
    roster: ['#1abc9c', '#0e6656'], weapons: ['#95a5a6', '#3d4748'], shifts: ['#3498db', '#1b4f72'],
    management: ['#f39c12', '#7d4f06'], audit: ['#34495e', '#1b2631'], settings: ['#5d6d7e', '#283747'], help: ['#16a085', '#0b5345'], chat: ['#00a8ff', '#0b4f78'], interrogations: ['#c0392b', '#4a1410'], interrogation: ['#c0392b', '#4a1410'], court: ['#b9935a', '#4f3a1c'], training: ['#27ae60', '#145a32'], armory: ['#6c7a89', '#2c3640'], desk: ['#2980b9', '#154360'], ia: ['#34495e', '#0f1720', '#f1c40f'], stats: ['#8e44ad', '#3d1a4f'], mdt: ['#2c3e50', '#0f1720'],
};
function appIcon(id, size = '', ico) {
    const look = APP_LOOK[id] || ['#2c3440', '#171c23'];
    return `<div class="app-ico ${size}" style="--c1:${look[0]};--c2:${look[1]};--ic:${look[2] || '#fff'}">${icon(ico || id)}</div>`;
}

// ==========================================
// Markdown (escaped first, then a small subset)
// ==========================================
function mdInline(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
}
function md(text) {
    const lines = esc(text || '').split('\n');
    let out = '', list = null; // 'ul' / 'ol'
    const open = t => { if (list !== t) { close(); out += `<${t}>`; list = t; } };
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const raw of lines) {
        const line = raw.trimEnd();
        let m;
        if ((m = line.match(/^- \[( |x)\] (.*)$/i))) {
            open('ul');
            out += `<li class="task ${m[1].toLowerCase() === 'x' ? 'done' : ''}">${mdInline(m[2])}</li>`;
        } else if ((m = line.match(/^[-*] (.*)$/))) {
            open('ul');
            out += `<li>${mdInline(m[1])}</li>`;
        } else if ((m = line.match(/^\d+\. (.*)$/))) {
            open('ol');
            out += `<li>${mdInline(m[1])}</li>`;
        } else {
            close();
            if ((m = line.match(/^### (.*)$/))) out += `<h3>${mdInline(m[1])}</h3>`;
            else if ((m = line.match(/^## (.*)$/))) out += `<h2>${mdInline(m[1])}</h2>`;
            else if ((m = line.match(/^# (.*)$/))) out += `<h1>${mdInline(m[1])}</h1>`;
            else if ((m = line.match(/^&gt; ?(.*)$/))) out += `<blockquote>${mdInline(m[1])}</blockquote>`;
            else if (/^---+$/.test(line)) out += '<hr>';
            else if (line !== '') out += `<p>${mdInline(line)}</p>`;
        }
    }
    close();
    return out;
}

// ==========================================
// Dialogs (inside the screen when the OS is open, otherwise over the page)
// ==========================================
const UI = {};

UI.layer = () => (OS.isOpen ? $('#modals') : document.body);

// opts = { title, icon, body (html), wide, buttons: [{ label, value, cls }], onOpen(root, close) }
UI.modal = function (opts) {
    return new Promise(resolve => {
        const buttons = opts.buttons || [{ label: T('ui_close'), value: null }];
        const btns = buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('');
        const el = h(`<div class="modal-bg">
            <div class="modal ${opts.wide ? 'wide' : ''}">
                <div class="modal-head">${opts.icon ? icon(opts.icon) : ''}<span class="grow">${opts.title || ''}</span>
                    <button class="icon-btn" data-x>${icon('close', 'sm')}</button></div>
                <div class="modal-body">${opts.body || ''}</div>
                <div class="modal-foot">${btns}</div>
            </div></div>`);
        const close = v => { el.remove(); resolve(v); };
        el.addEventListener('click', e => {
            if (e.target.closest('[data-x]')) return close(null);
            const b = e.target.closest('.modal-foot [data-i]');
            if (b) {
                const def = buttons[+b.dataset.i];
                if (def.collect) {
                    const v = def.collect(el);
                    if (v === false) return;
                    return close(v);
                }
                close(def.value);
            }
        });
        UI.layer().appendChild(el);
        if (opts.onOpen) opts.onOpen(el, close);
        const first = el.querySelector('input, textarea');
        if (first) setTimeout(() => first.focus(), 30);
    });
};

UI.confirm = (text, opts = {}) => UI.modal({
    title: opts.title || T('ui_confirm'), icon: opts.icon || 'warn', body: `<div>${text}</div>`,
    buttons: [{ label: T('ui_cancel'), value: false }, { label: opts.ok || T('ui_yes'), value: true, cls: opts.danger ? 'danger' : 'primary' }],
});

UI.prompt = (title, value = '', opts = {}) => UI.modal({
    title, icon: opts.icon || 'edit',
    body: `<div class="field">${opts.label ? `<label>${opts.label}</label>` : ''}${opts.multi
        ? `<textarea class="textarea" id="ui-prompt" maxlength="${opts.max || 500}">${esc(value)}</textarea>`
        : `<input class="input" id="ui-prompt" maxlength="${opts.max || 120}" value="${esc(value)}">`}</div>`,
    buttons: [{ label: T('ui_cancel'), value: null }, { label: opts.ok || T('ui_save'), cls: 'primary', collect: el => $('#ui-prompt', el).value }],
});

UI.toast = (msg, type = 'info') => OS.toast({ title: msg, type });
UI.err = res => OS.toast({ title: errMsg(res), type: 'error' });

// ---------- pickers ----------
// People of the departments. multi = true -> array
UI.pickOfficer = function (opts = {}) {
    let chosen = (opts.selected || []).slice();
    return UI.modal({
        title: opts.title || T('ui_pick_officer'), icon: 'users',
        body: `<div class="search">${icon('search')}<input class="input" id="pk-q" placeholder="${T('ui_search_name')}"></div>
            ${opts.multi ? '<div class="pick-tags" id="pk-tags"></div>' : ''}
            ${opts.groups ? `<div class="pick-tags" id="pk-groups">${opts.groups.map(g => `<span class="chip" data-g="${esc(g.id)}">${icon('users', 'sm')}${esc(g.label)}</span>`).join('')}</div>` : ''}
            <div class="pick-list" id="pk-list"><div class="loading"><div class="spinner"></div></div></div>`,
        buttons: opts.multi ? [{ label: T('ui_cancel'), value: null }, { label: T('ui_select'), cls: 'primary', collect: () => chosen }] : [{ label: T('ui_cancel'), value: null }],
        onOpen(el, close) {
            const tags = () => {
                const t = $('#pk-tags', el);
                if (t) t.innerHTML = chosen.map((p, i) => `<span class="chip accent" data-rm="${i}">${esc(p.name || p.label)} ✕</span>`).join('');
            };
            const load = async q => {
                const res = await api('people:officers', { query: q });
                const list = (res && res.list) || [];
                $('#pk-list', el).innerHTML = list.length ? list.map(p => `<div class="pick-item ${chosen.find(c => c.id === p.id) ? 'on' : ''}" data-id="${esc(p.id)}" data-n="${esc(p.name)}">
                    <div class="avatar">${initials(p.name)}</div><div class="grow"><div class="t">${esc(p.name)}</div><div class="s muted">${esc(p.dept)}</div></div>
                    ${p.online ? `<span class="chip ok"><span class="dot"></span>${T('ui_online')}</span>` : ''}</div>`).join('') : `<div class="empty">${T('ui_nothing_found')}</div>`;
            };
            $('#pk-q', el).addEventListener('input', debounce(e => load(e.target.value), 250));
            el.addEventListener('click', e => {
                const it = e.target.closest('.pick-item');
                if (it) {
                    const p = { id: it.dataset.id, name: it.dataset.n };
                    if (!opts.multi) return close(p);
                    const i = chosen.findIndex(c => c.id === p.id);
                    if (i >= 0) chosen.splice(i, 1); else chosen.push(p);
                    it.classList.toggle('on', i < 0);
                    tags();
                }
                const rm = e.target.closest('[data-rm]');
                if (rm) { chosen.splice(+rm.dataset.rm, 1); tags(); load($('#pk-q', el).value); }
                const g = e.target.closest('[data-g]');
                if (g && !chosen.find(c => c.group === g.dataset.g)) { chosen.push({ group: g.dataset.g, label: g.textContent.trim() }); tags(); }
            });
            tags();
            load('');
        },
    });
};

// Citizens (warrants, weapons). Free text allowed (returns { name } without id)
UI.pickCitizen = function (opts = {}) {
    return UI.modal({
        title: opts.title || T('ui_pick_citizen'), icon: 'user',
        body: `<div class="search">${icon('search')}<input class="input" id="pk-q" placeholder="${T('ui_search_name')}"></div>
            <div class="pick-list" id="pk-list"><div class="empty">${T('ui_type_to_search')}</div></div>`,
        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_use_text'), cls: 'primary', collect: el => { const v = $('#pk-q', el).value.trim(); return v ? { name: v } : false; } }],
        onOpen(el, close) {
            const load = async q => {
                if (q.trim().length < 2) { $('#pk-list', el).innerHTML = `<div class="empty">${T('ui_type_to_search')}</div>`; return; }
                const res = await api('people:citizens', { query: q });
                const list = (res && res.list) || [];
                $('#pk-list', el).innerHTML = list.length ? list.map(p => `<div class="pick-item" data-id="${esc(p.id)}" data-n="${esc(p.name)}" data-p="${esc(p.photo || '')}">
                    <div class="avatar" ${bg(p.photo)}>${p.photo ? '' : initials(p.name)}</div><div class="grow"><div class="t">${esc(p.name)}</div>
                    <div class="s muted">${esc(p.dob || '')}</div></div></div>`).join('') : `<div class="empty">${T('ui_nothing_found')}</div>`;
            };
            $('#pk-q', el).addEventListener('input', debounce(e => load(e.target.value), 300));
            el.addEventListener('click', e => {
                const it = e.target.closest('.pick-item');
                if (it) close({ id: it.dataset.id, name: it.dataset.n, photo: it.dataset.p || null });
            });
        },
    });
};

UI.pickCase = function (opts = {}) {
    return UI.modal({
        title: opts.title || T('ui_pick_case'), icon: 'cases',
        body: `<div class="search">${icon('search')}<input class="input" id="pk-q" placeholder="${T('ui_search_case')}"></div>
            <div class="pick-list" id="pk-list"><div class="loading"><div class="spinner"></div></div></div>`,
        buttons: [{ label: T('ui_cancel'), value: null }].concat(opts.allowNone ? [{ label: T('ui_no_case'), value: { id: null } }] : []),
        onOpen(el, close) {
            const load = async q => {
                const res = await api('cases:pick', { query: q });
                const list = (res && res.cases) || [];
                $('#pk-list', el).innerHTML = list.length ? list.map(c => `<div class="pick-item" data-id="${c.id}" data-no="${esc(c.caseNo)}" data-t="${esc(c.title)}">
                    ${icon('folder')}<div class="grow"><div class="t">${esc(c.title)}</div><div class="s mono muted">${esc(c.caseNo)}</div></div>
                    <span class="chip st-${c.status}">${T('case_status_' + c.status)}</span></div>`).join('') : `<div class="empty">${T('ui_nothing_found')}</div>`;
            };
            $('#pk-q', el).addEventListener('input', debounce(e => load(e.target.value), 250));
            el.addEventListener('click', e => {
                const it = e.target.closest('.pick-item');
                if (it) close({ id: +it.dataset.id, caseNo: it.dataset.no, title: it.dataset.t });
            });
            load('');
        },
    });
};

// Charges from the penal code: returns [{ id, code, label, type, count, fine, jail }]
UI.pickCharges = async function (selected = []) {
    const res = await api('penal:list');
    if (!res || res.error) { UI.err(res); return null; }
    const list = res.list || [];
    const chosen = selected.map(c => ({ ...c }));
    return UI.modal({
        title: T('ui_pick_charges'), icon: 'penal', wide: true,
        body: `<div class="search">${icon('search')}<input class="input" id="pk-q" placeholder="${T('ui_search_charge')}"></div>
            <div class="pick-tags" id="pk-tags"></div><div class="pick-list" id="pk-list" style="max-height:320px"></div>`,
        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_select'), cls: 'primary', collect: () => chosen }],
        onOpen(el) {
            const tags = () => {
                $('#pk-tags', el).innerHTML = chosen.map((c, i) => `<span class="chip accent" data-rm="${i}">${esc(c.code)} ×${c.count} ✕</span>`).join('');
            };
            const render = q => {
                q = (q || '').toLowerCase();
                const rows = list.filter(c => !q || (c.code + ' ' + c.title + ' ' + (c.category || '')).toLowerCase().includes(q));
                $('#pk-list', el).innerHTML = rows.map(c => `<div class="pick-item" data-id="${c.id}">
                    <span class="mono accent" style="width:80px">${esc(c.code)}</span><div class="grow"><div class="t">${esc(c.title)}</div>
                    <div class="s muted">${esc(c.category || '')}</div></div><span class="type-${c.type}" style="font-size:11px">${T('ptype_' + c.type)}</span></div>`).join('');
            };
            $('#pk-q', el).addEventListener('input', e => render(e.target.value));
            el.addEventListener('click', e => {
                const it = e.target.closest('.pick-item');
                if (it) {
                    const c = list.find(x => x.id === +it.dataset.id);
                    const ex = chosen.find(x => x.id === c.id);
                    if (ex) ex.count++; else chosen.push({ id: c.id, code: c.code, label: c.title, type: c.type, fine: c.fine, jail: c.jail, count: 1 });
                    tags();
                }
                const rm = e.target.closest('[data-rm]');
                if (rm) { chosen.splice(+rm.dataset.rm, 1); tags(); }
            });
            tags();
            render('');
        },
    });
};

// ==========================================
// Printing from apps: printer + copies dialog -> printer:print
// ==========================================
UI.print = async function (what, title) {
    if (!OS.can('printer.print')) return UI.toast(T('err_no_permission'), 'error');
    if (OS.state.mode !== 'pc') return UI.toast(T('err_no_printer'), 'error');
    const res = await api('printer:list');
    const printers = (res && res.printers) || [];
    if (!printers.length) return UI.toast(T('err_no_printer'), 'error');
    let sel = printers[0].id;
    const r = await UI.modal({
        title: T('ui_print') + (title ? ': ' + esc(title) : ''), icon: 'printer',
        body: `<div class="col">${printers.map(p => `<div class="printer-opt ${p.id === sel ? 'on' : ''}" data-p="${esc(p.id)}">
                ${icon('printer', 'lg')}<div class="grow"><div class="t" style="font-weight:700">${esc(p.label)}</div>
                <div class="meta">${p.paper != null ? `<span>${T('ui_paper')}: ${p.paper}/${p.capacity}</span>` : ''}${p.toner != null ? `<span>${T('ui_toner')}: ${p.toner} %</span>` : ''}
                <span>${T('ui_queue')}: ${p.queue}</span></div></div>${p.err ? `<span class="chip bad">${T('perr_' + p.err)}</span>` : ''}</div>`).join('')}</div>
            <div class="field"><label>${T('ui_copies')}</label><input class="input" id="pr-copies" type="number" min="1" max="5" value="1"></div>`,
        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_print'), cls: 'primary', collect: el => ({ printerId: sel, copies: +$('#pr-copies', el).value || 1 }) }],
        onOpen(el) {
            el.addEventListener('click', e => {
                const p = e.target.closest('.printer-opt');
                if (p) { sel = p.dataset.p; $$('.printer-opt', el).forEach(x => x.classList.toggle('on', x === p)); }
            });
        },
    });
    if (!r) return;
    const out = await api('printer:print', { printerId: r.printerId, copies: r.copies, what });
    if (out && out.ok) OS.toast({ title: T('ui_printing'), text: T('ui_print_pickup', out.printer), type: 'success', app: 'printer' });
    else UI.err(out);
};

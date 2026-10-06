// ==========================================
// Signature pad (mouse) -> SVG path in a 300 x 100 box, rendering of signatures,
// questions from the server to the player (confirm / text / sign)
// ==========================================
const SignPad = {};

// Signature as SVG (stored path, 300 x 100)
SignPad.svg = (path, cls = '') => path ? `<svg class="sig-svg ${cls}" viewBox="0 0 300 100"><path d="${esc(path)}" fill="none" stroke="#1f4e8c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';

// List of signatures [{ name, at, path, role, refused }]
SignPad.list = list => (list || []).length ? `<div class="sig-list">${list.map(s => `<div class="sig-item">
    ${s.refused ? `<div class="sig-refused">${T('sig_refused')}</div>` : SignPad.svg(s.path)}
    <div class="sig-name">${esc(s.name)}${s.role ? ` · ${esc(T('sig_role_' + s.role))}` : ''}</div><div class="sig-at">${fmtDT(s.at)}</div></div>`).join('')}</div>` : '';

// opts = { title, text, refuse: true } -> Promise(path | 'refused' | null)
SignPad.open = function (opts = {}) {
    return new Promise(resolve => {
        const el = h(`<div class="modal-bg sign-bg"><div class="modal" style="width:640px">
            <div class="modal-head">${icon('edit')}<span class="grow">${esc(opts.title || T('sig_title'))}</span>
                ${opts.timeout ? `<span class="chip warn" data-cd>${opts.timeout}</span>` : ''}</div>
            <div class="modal-body">${opts.text ? `<div class="md">${md(opts.text)}</div>` : ''}
                <div class="sig-pad"><canvas width="600" height="200"></canvas><div class="sig-line"></div><span class="sig-hint">${T('sig_hint')}</span></div></div>
            <div class="modal-foot">${opts.refuse ? `<button class="btn danger" data-r>${T('sig_refuse')}</button>` : `<button class="btn" data-c>${T('ui_cancel')}</button>`}
                <div class="grow"></div><button class="btn" data-clear>${T('ui_clear')}</button><button class="btn primary" data-ok>${icon('check', 'sm')}${T('sig_confirm')}</button></div>
        </div></div>`);
        (OS.isOpen ? $('#modals') : document.body).appendChild(el);
        const cv = $('canvas', el), ctx = cv.getContext('2d');
        ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f4e8c';
        let strokes = [], cur = null;
        const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
        cv.addEventListener('mousedown', e => { cur = [pos(e)]; strokes.push(cur); $('.sig-hint', el).classList.add('hidden'); });
        cv.addEventListener('mousemove', e => {
            if (!cur) return;
            const p = pos(e), last = cur[cur.length - 1];
            if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3) return;
            cur.push(p);
            ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        });
        const end = () => { cur = null; };
        cv.addEventListener('mouseup', end);
        cv.addEventListener('mouseleave', end);
        let timer;
        const close = v => { clearInterval(timer); el.remove(); resolve(v); };
        if (opts.timeout) {
            let left = opts.timeout;
            timer = setInterval(() => { left--; const c = $('[data-cd]', el); if (c) c.textContent = left; if (left <= 0) close(null); }, 1000);
        }
        el.addEventListener('click', e => {
            if (e.target.closest('[data-clear]')) { strokes = []; ctx.clearRect(0, 0, cv.width, cv.height); return; }
            if (e.target.closest('[data-c]')) return close(null);
            if (e.target.closest('[data-r]')) return close('refused');
            if (e.target.closest('[data-ok]')) {
                const pts = strokes.filter(s => s.length > 1);
                if (!pts.length) return;
                // 600 x 200 canvas -> 300 x 100 path, integers
                const path = pts.map(s => s.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p[0] / 2)} ${Math.round(p[1] / 2)}`).join('')).join('');
                close(path.slice(0, 6000));
            }
        });
        SignPad.cancel = id => { if (opts.askId === id) close(null); };
    });
};

// ==========================================
// Questions from the server
// ==========================================
const Ask = { open: {} };

Ask.handle = async function (q) {
    const d = q.data || {};
    let value = null;
    if (q.kind === 'sign') {
        value = await SignPad.open({ title: d.title, text: d.text, refuse: true, timeout: d.timeout, askId: q.id });
    } else if (q.kind === 'confirm' || q.kind === 'text') {
        value = await new Promise(resolve => {
            const el = h(`<div class="modal-bg"><div class="modal ${q.kind === 'text' ? 'wide' : ''}">
                <div class="modal-head">${icon(q.kind === 'text' ? 'edit' : 'gavel')}<span class="grow">${esc(d.title || '')}</span><span class="chip warn" data-cd>${d.timeout || ''}</span></div>
                <div class="modal-body"><div class="md">${md(d.text || '')}</div>${q.kind === 'text' ? `<textarea class="textarea" data-t maxlength="4000" style="min-height:200px"></textarea>` : ''}</div>
                <div class="modal-foot">${q.kind === 'confirm' ? `<button class="btn danger" data-v="0">${T('ask_no')}</button><button class="btn primary" data-v="1">${T('ask_yes')}</button>`
                    : `<button class="btn" data-v="0">${T('ask_skip')}</button><button class="btn primary" data-v="1">${T('ask_send')}</button>`}</div></div></div>`);
            (OS.isOpen ? $('#modals') : document.body).appendChild(el);
            let left = d.timeout || 60;
            const close = v => { clearInterval(timer); el.remove(); delete Ask.open[q.id]; resolve(v); };
            const timer = setInterval(() => { left--; $('[data-cd]', el).textContent = left; if (left <= 0) close(null); }, 1000);
            Ask.open[q.id] = () => close(null);
            el.addEventListener('click', e => {
                const b = e.target.closest('[data-v]');
                if (!b) return;
                if (q.kind === 'confirm') return close(b.dataset.v === '1');
                close(b.dataset.v === '1' ? ($('[data-t]', el).value.trim() || null) : null);
            });
            const t = $('[data-t]', el);
            if (t) setTimeout(() => t.focus(), 50);
        });
    }
    post('askReply', { id: q.id, value });
};

Ask.cancel = function (id) {
    if (Ask.open[id]) Ask.open[id]();
    if (SignPad.cancel) SignPad.cancel(id);
};

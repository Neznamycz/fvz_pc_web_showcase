// ==========================================
// FiveZone Police PC - NUI message router + world prompt, placement hint, progress, printer sound
// ==========================================

// ---------- world prompt ----------
const Prompt = {
    show(d) {
        const el = $('#prompt');
        if (!d) return el.classList.add('hidden');
        $('.pr-title', el).textContent = d.title || '';
        $('.pr-opts', el).innerHTML = d.opts.map((o, i) => `<div class="pr-opt ${i + 1 === d.sel ? 'on' : ''}">${esc(o.l)}</div>`).join('');
        $('#pr-key').textContent = d.key || 'E';
        el.classList.remove('hidden');
    },
    pos(d) {
        const el = $('#prompt');
        if (!d || d.x == null || d.x < 0) { el.style.left = '-999px'; return; }
        el.style.left = (d.x * 100) + '%';
        el.style.top = (d.y * 100) + '%';
    },
};

// ---------- recording indicator (people inside a recorded interrogation room) ----------
const Rec = {
    show(d) {
        const el = $('#rec');
        if (!d) return el.classList.add('hidden');
        el.className = d.rec ? 'on' : 'paused';
        el.innerHTML = `<i></i><b>${d.rec ? 'REC' : T('int_paused')}</b><span>${esc(d.room || '')} · ${esc(d.number || '')}</span>`;
    },
};

// ---------- progress ----------
let progTimer;
function progress(d) {
    const el = $('#progress');
    $('.lb', el).textContent = d.label || '';
    const bar = $('.bar-h i', el);
    bar.style.transition = 'none';
    bar.style.width = '0%';
    el.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        bar.style.transition = `width ${d.ms}ms linear`;
        bar.style.width = '100%';
    }));
    clearTimeout(progTimer);
    progTimer = setTimeout(() => el.classList.add('hidden'), d.ms + 400);
}

// ---------- printer sound (soft mechanical noise, no audio file) ----------
let sndCtx;
function printerSound(d) {
    try {
        sndCtx = sndCtx || new AudioContext();
        const len = Math.min(8, d.ms / 1000);
        const buf = sndCtx.createBuffer(1, sndCtx.sampleRate * len, sndCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / sndCtx.sampleRate;
            // noise modulated like a print head going back and forth
            data[i] = (Math.random() * 2 - 1) * (0.35 + 0.25 * Math.sin(t * 18)) * (Math.sin(t * 2.4) > -0.6 ? 1 : 0.2);
        }
        const src = sndCtx.createBufferSource();
        src.buffer = buf;
        const filter = sndCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.8;
        const g = sndCtx.createGain();
        g.gain.value = 0.06 * (d.volume || 0.5);
        src.connect(filter).connect(g).connect(sndCtx.destination);
        src.start();
    } catch (e) { /* no audio */ }
}

// ---------- router ----------
window.addEventListener('message', e => {
    const { action, data } = e.data || {};
    switch (action) {
        case 'locale':
            Object.assign(L, data || {});
            L.__locale = (data && data.__locale) || L.__locale;
            applyT();
            break;
        case 'osOpen': OS.open(data); break;
        case 'osClose': OS.close(); break;
        case 'osNotify': OS.notify(data); break;
        case 'osLive': OS.live(data); break;
        case 'osSession': OS.session(data); break;
        case 'admin': Admin.open(data); break;
        case 'printer': PrinterUI.open(data); break;
        case 'document': Doc.open(data); break;
        case 'docList': Doc.list(data); break;
        case 'prompt': Prompt.show(data); break;
        case 'world': Prompt.pos(data); break;
        case 'placement':
            $('#pl-kind').textContent = T(({ printer: 'adm_new_printer', interrogation: 'adm_new_int', public: 'adm_new_public', armory: 'adm_new_armory', screen: 'adm_new_screen' })[data.kind] || 'adm_new_pc');
            $('#placement').classList.remove('hidden');
            break;
        case 'placementEnd': $('#placement').classList.add('hidden'); break;
        case 'progress': progress(data); break;
        case 'progressEnd': $('#progress').classList.add('hidden'); break;
        case 'printerSound': printerSound(data); break;
        case 'intPanel': IntUI.open(data); break;
        case 'intEvent': IntUI.event(data); break;
        case 'ask': Ask.handle(data); break;
        case 'askCancel': Ask.cancel(data.id); break;
        case 'rec': Rec.show(data); break;
        case 'pubOpen': PubUI.open(data); break;
        case 'armOpen': ArmUI.open(data); break;
        case 'test': TestUI.open(data); break;
        case 'testEnd': TestUI.end(data); break;
    }
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    // dialogs outside the desktop
    const m = $$('body > .modal-bg').pop();
    if (m) return m.querySelector('[data-x]').click();
    if (!$('#doc').classList.contains('hidden')) return Doc.close();
    if (!$('#int').classList.contains('hidden')) return IntUI.close();
    if (!$('#pub').classList.contains('hidden')) return PubUI.close();
    if (!$('#arm').classList.contains('hidden')) return ArmUI.close();
    if (!$('#printer').classList.contains('hidden')) return PrinterUI.close();
    if (!$('#admin').classList.contains('hidden')) return Admin.close();
});

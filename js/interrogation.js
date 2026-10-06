// ==========================================
// Interrogation terminal (overlay outside the desktop)
// setup -> recording (rights, transcript, evidence, pause, statement, silent notes) -> finish -> signatures
// ==========================================
const IntUI = { d: null, sp: 'O', caseSel: null, subject: null, clerk: '', notes: [] };

const fmtClock = t => { t = Math.max(0, Math.floor(t || 0)); const z = n => String(n).padStart(2, '0'); return `${z(Math.floor(t / 3600))}:${z(Math.floor(t % 3600 / 60))}:${z(t % 60)}`; };

IntUI.open = function (d) {
    IntUI.d = d;
    IntUI.notes = (d.session && d.session.lines || []).filter(l => l.kind === 'note');
    $('#int').classList.remove('hidden');
    IntUI.render();
};

IntUI.close = function () {
    $('#int').classList.add('hidden');
    clearInterval(IntUI.timer);
    post('close', { layer: 'int' });
};

IntUI.lineHtml = l => {
    if (l.kind === 'note') return '';
    const cls = l.sp === 'X' ? 'sys' : 'sp-' + l.sp;
    return `<div class="il ${cls} ${l.kind}"><span class="il-t mono">${fmtClock(l.t)}</span>${l.sp !== 'X' ? `<b>${esc(l.name || l.sp)}:</b> ` : ''}<span>${esc(l.text)}</span></div>`;
};

IntUI.render = function () {
    const d = IntUI.d, s = d.session;
    const el = $('#int');
    clearInterval(IntUI.timer);
    if (!s) {
        // ---------- setup ----------
        el.innerHTML = `<div class="panel int-panel"><div class="panel-head"><div class="logo">${icon('users')}</div>
            <div class="grow"><div class="ttl">${esc(d.room.label)}</div><div class="sub">${T('int_setup')}</div></div><button class="icon-btn" data-close>${icon('close')}</button></div>
            <div class="panel-body"><div class="adm-main">
                <div class="field"><label>${T('int_subject')}</label><div class="col">${d.people.filter(p => !p.officer).map(p => `<label class="check"><input type="radio" name="subj" value="${p.src}">${esc(p.name)}${p.lawyer ? ` <span class="chip">${T('int_lawyer')}</span>` : ''}</label>`).join('')
                    || `<span class="dim">${T('int_nobody')}</span>`}</div></div>
                <div class="field"><label>${T('f_case_no')}</label><div class="row"><span class="chip accent" data-case>${T('ui_no_case')}</span><button class="btn sm" data-a="case">${icon('cases', 'sm')}${T('ui_pick')}</button></div></div>
                <div class="field"><label>${T('int_clerk')}</label><select class="select" data-clerk><option value="">${T('int_no_clerk')}</option>
                    ${d.clerks.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
                <div class="muted" style="font-size:12px">${T('int_setup_hint')}</div>
                <div class="row"><button class="btn primary" data-a="start">${icon('scan', 'sm')}${T('int_start')}</button><button class="btn" data-a="reload">${icon('refresh', 'sm')}</button></div>
            </div></div></div>`;
        return;
    }
    const running = s.status === 'running', paused = s.status === 'paused';
    const rightsDone = !d.requireRights || s.rights;
    el.innerHTML = `<div class="panel int-panel"><div class="panel-head"><div class="logo ${running ? 'rec' : ''}">${icon('users')}</div>
        <div class="grow"><div class="ttl">${esc(s.number)} · ${esc(s.subject.name)}</div><div class="sub">${esc(d.room.label)}${s.caseNo ? ' · ' + esc(s.caseNo) : ''}${s.clerk ? ' · ' + T('int_clerk') + ': ' + esc(s.clerk) : ''}</div></div>
        <span class="rec-badge ${running ? 'on' : ''}">${running ? '● REC' : (s.finished ? T('int_finished') : '❚❚ ' + T('int_paused'))}</span>
        <span class="mono int-clock" data-clock>${fmtClock(s.elapsed)}</span><button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="panel-body"><div class="pr-main">
            <div class="int-lines" data-lines>${s.lines.map(IntUI.lineHtml).join('')}</div>
            ${s.finished ? `<div class="pr-foot">${s.signed ? `<span class="muted">${T('int_wait_subject')}</span>` : `<button class="btn primary" data-a="sign">${icon('edit', 'sm')}${T('int_sign')}</button>`}
                <div class="grow"></div><button class="btn" data-a="closeSession">${T('ui_close')}</button></div>`
            : `<div class="int-input"><div class="row">${['O', 'S', 'L'].map(k => `<button class="btn sm ${IntUI.sp === k ? 'primary' : ''}" data-sp="${k}">${T('int_sp_' + k)}</button>`).join('')}
                    <span class="dim" style="font-size:11px">${T('int_sp_hint')}</span></div>
                <div class="row"><input class="input" data-in maxlength="1000" placeholder="${rightsDone ? T('int_type') : T('int_rights_first')}" ${running && rightsDone ? '' : 'disabled'}>
                <button class="btn primary" data-a="line" ${running && rightsDone ? '' : 'disabled'}>${icon('send', 'sm')}</button></div></div>`}
        </div>
        ${s.finished ? '' : `<div class="pr-side" style="border-left:1px solid var(--line);border-right:none">
            <button class="btn ${s.rights ? '' : 'primary'}" data-a="rights" ${s.rights ? 'disabled' : ''}>${icon('gavel', 'sm')}${s.rights ? T('int_rights_' + s.rights) : T('int_rights_read')}</button>
            <button class="btn" data-a="evidence" ${s.caseId ? '' : 'disabled'}>${icon('bag', 'sm')}${T('int_show_evidence')}</button>
            <button class="btn" data-a="pause">${paused ? icon('chev', 'sm') + T('int_resume') : '❚❚ ' + T('int_pause')}</button>
            <button class="btn" data-a="statement">${icon('edit', 'sm')}${s.statement ? T('int_statement_again') : T('int_statement')}</button>
            ${s.statement ? `<div class="card" style="font-size:11.5px;max-height:120px;overflow:auto">${esc(s.statement)}</div>` : ''}
            <div class="section-title" style="margin-top:6px">${T('int_notes')}<span class="line"></span></div>
            <div class="int-notes" data-notes>${IntUI.notes.map(n => `<div class="int-note"><b>${esc(n.name)}</b> ${esc(n.text)}</div>`).join('') || `<span class="dim" style="font-size:11px">${T('int_notes_hint')}</span>`}</div>
            <div class="grow"></div>
            <button class="btn danger" data-a="finish">${icon('check', 'sm')}${T('int_finish')}</button>
            <button class="btn ghost sm" data-a="cancel">${T('int_cancel')}</button>
        </div>`}</div></div>`;
    const box = $('[data-lines]', el);
    box.scrollTop = box.scrollHeight;
    const inp = $('[data-in]', el);
    if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === 'Enter') IntUI.send(); if (e.key === 'Tab') { e.preventDefault(); IntUI.cycle(); } }; }
    if (running) {
        let t = s.elapsed;
        IntUI.timer = setInterval(() => { t++; const c = $('[data-clock]', el); if (c) c.textContent = fmtClock(t); }, 1000);
    }
};

IntUI.cycle = function () {
    IntUI.sp = { O: 'S', S: 'L', L: 'O' }[IntUI.sp];
    $$('#int [data-sp]').forEach(b => b.classList.toggle('primary', b.dataset.sp === IntUI.sp));
};

IntUI.send = async function () {
    const inp = $('#int [data-in]');
    const text = inp && inp.value.trim();
    if (!text) return;
    const r = await srv('int:line', { roomId: IntUI.d.room.id, speaker: IntUI.sp, text });
    if (r && r.error) return post('notify', { msg: errMsg(r), type: 'error' });
    inp.value = '';
    // after a question of the officer the answer usually follows
    if (IntUI.sp === 'O') IntUI.cycle();
};

IntUI.reload = async function () {
    const r = await srv('int:panel', { roomId: IntUI.d.room.id });
    if (r && !r.error) IntUI.open(r);
};

// live events from the server
IntUI.event = function (ev) {
    const d = IntUI.d;
    if (!d || $('#int').classList.contains('hidden')) return;
    if (ev.event === 'line' && d.session) {
        const l = ev.data.line;
        d.session.lines.push(l);
        if (l.kind === 'note') {
            IntUI.notes.push(l);
            const n = $('#int [data-notes]');
            if (n) n.innerHTML = IntUI.notes.map(x => `<div class="int-note"><b>${esc(x.name)}</b> ${esc(x.text)}</div>`).join('');
            post('notify', { msg: `${l.name}: ${l.text}`, type: 'inform' });
            return;
        }
        const box = $('#int [data-lines]');
        if (box) { box.insertAdjacentHTML('beforeend', IntUI.lineHtml(l)); box.scrollTop = box.scrollHeight; }
    } else if (ev.event === 'state') {
        const keepInput = $('#int [data-in]') ? $('#int [data-in]').value : '';
        d.session = ev.data.state;
        IntUI.render();
        const inp = $('#int [data-in]');
        if (inp) inp.value = keepInput;
    } else if (ev.event === 'signed') {
        post('notify', { msg: ev.data.refused ? T('int_subject_refused') : T('int_subject_signed'), type: ev.data.refused ? 'error' : 'success' });
        d.session = null;
        IntUI.reload();
    }
};

$('#int').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return IntUI.close();
    const sp = e.target.closest('[data-sp]');
    if (sp) { IntUI.sp = sp.dataset.sp; $$('#int [data-sp]').forEach(b => b.classList.toggle('primary', b === sp)); return; }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const d = IntUI.d, room = d.room.id;
    const act = a.dataset.a;
    const call = async (name, payload = {}) => {
        const r = await srv('int:' + name, { roomId: room, ...payload });
        if (!r || r.error) { post('notify', { msg: errMsg(r), type: 'error' }); return null; }
        return r;
    };
    if (act === 'reload') return IntUI.reload();
    if (act === 'case') {
        const c = await UI.modal({ title: T('ui_pick_case'), icon: 'cases',
            body: `<div class="search">${icon('search')}<input class="input" id="ic-q"></div><div class="pick-list" id="ic-l"></div>`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_no_case'), value: { none: true } }],
            onOpen(m, close) {
                const load = async q => {
                    const r = await srv('int:cases', { roomId: room, query: q });
                    const list = (r && r.cases) || [];
                    $('#ic-l', m).innerHTML = list.map((x, i) => `<div class="pick-item" data-i="${i}">${icon('folder')}<b class="mono">${esc(x.case_no)}</b><span class="grow">${esc(x.title)}</span></div>`).join('') || `<div class="empty">${T('ui_nothing_found')}</div>`;
                    m.onclick = ev => { const it = ev.target.closest('[data-i]'); if (it) close(list[+it.dataset.i]); };
                };
                $('#ic-q', m).addEventListener('input', debounce(ev => load(ev.target.value), 250));
                load('');
            } });
        if (c) { IntUI.caseSel = c.none ? null : c; $('#int [data-case]').textContent = IntUI.caseSel ? IntUI.caseSel.case_no : T('ui_no_case'); }
        return;
    }
    if (act === 'start') {
        const subj = $('#int input[name="subj"]:checked');
        if (!subj) return post('notify', { msg: T('int_pick_subject'), type: 'error' });
        const r = await call('start', { subject: +subj.value, caseId: IntUI.caseSel ? IntUI.caseSel.id : null, clerk: $('#int [data-clerk]').value });
        if (r) { d.session = r.session; IntUI.notes = []; IntUI.render(); }
        return;
    }
    if (act === 'line') return IntUI.send();
    if (act === 'rights') return call('rights');
    if (act === 'pause') return call('pause', { resume: d.session.status === 'paused' });
    if (act === 'statement') return call('statement');
    if (act === 'evidence') {
        const r = await call('caseItems');
        if (!r) return;
        const pick = await UI.modal({ title: T('int_show_evidence'), icon: 'bag',
            body: `<div class="pick-list">${r.items.map((it, i) => `<div class="pick-item" data-i="${i}">${it.url ? `<div class="avatar" ${bg(it.url)}></div>` : icon('bag')}<span class="grow">${esc(it.label)}</span></div>`).join('') || `<div class="empty">${T('ui_no_evidence')}</div>`}</div>`,
            buttons: [{ label: T('ui_cancel'), value: null }],
            onOpen(m, close) { m.addEventListener('click', ev => { const it = ev.target.closest('[data-i]'); if (it) close(r.items[+it.dataset.i]); }); } });
        if (pick) call('evidence', { label: pick.label });
        return;
    }
    if (act === 'finish') {
        if (!(await UI.confirm(T('int_confirm_finish')))) return;
        const r = await call('finish');
        if (r) { d.session = r.session; IntUI.render(); post('notify', { msg: T('int_protocol_saved', r.docNo), type: 'success' }); }
        return;
    }
    if (act === 'sign') {
        const path = await SignPad.open({ title: T('int_sign'), text: T('int_sign_officer') });
        if (!path) return;
        const r = await call('sign', { path });
        if (r) { d.session.signed = true; IntUI.render(); }
        return;
    }
    if (act === 'cancel') {
        if (!(await UI.confirm(T('int_confirm_cancel'), { danger: true }))) return;
        if (await call('close')) { d.session = null; IntUI.reload(); }
        return;
    }
    if (act === 'closeSession') {
        await call('close');
        IntUI.close();
    }
});

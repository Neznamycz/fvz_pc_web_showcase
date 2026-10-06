// ==========================================
// Overlays outside the desktop: public terminal (everyone), armory (police), training test (recruit)
// ==========================================

// ---------- public terminal ----------
const PubUI = { d: null, tab: 'home' };

PubUI.SERVICES = [
    { id: 'report', icon: 'notes' }, { id: 'stolen', icon: 'car' }, { id: 'complaint', icon: 'warn' },
    { id: 'licence', icon: 'badge' }, { id: 'wanted', icon: 'eye' }, { id: 'status', icon: 'list' },
];

PubUI.open = function (d) {
    PubUI.d = d;
    PubUI.tab = 'home';
    $('#pub').classList.remove('hidden');
    PubUI.render();
};

PubUI.close = function () {
    $('#pub').classList.add('hidden');
    post('close', { layer: 'pub' });
};

PubUI.on = id => PubUI.d.services && PubUI.d.services[id];

PubUI.render = function () {
    const d = PubUI.d, t = PubUI.tab;
    const nav = [{ id: 'home', icon: 'grid' }].concat(PubUI.SERVICES.filter(s => PubUI.on(s.id)))
        .map(s => `<button class="side-item ${t === s.id ? 'on' : ''}" data-tab="${s.id}">${icon(s.icon)}${T('pub_t_' + s.id)}</button>`).join('');
    $('#pub').innerHTML = `<div class="panel pub-panel"><div class="panel-head"><div class="logo">${icon('shield')}</div>
        <div class="grow"><div class="ttl">${T('pub_title')}</div><div class="sub">${esc(d.name || '')}</div></div><button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="panel-body"><div class="adm-nav">${nav}</div><div class="adm-main" data-main>${PubUI['view_' + t]()}</div></div></div>`;
};

PubUI.view_home = function () {
    return `<div class="pub-hello"><h2>${T('pub_hello', esc(PubUI.d.name || ''))}</h2><div class="muted">${T('pub_hello_hint')}</div></div>
        <div class="pub-svcs">${PubUI.SERVICES.filter(s => PubUI.on(s.id)).map(s => `<button class="pub-svc" data-tab="${s.id}">${icon(s.icon, 'lg')}
            <b>${T('pub_t_' + s.id)}</b><span>${T('pub_d_' + s.id)}</span></button>`).join('')}</div>
        <div class="muted" style="font-size:12px">${T('pub_emergency')}</div>`;
};

const pubField = (id, label, html) => `<div class="field"><label>${label}</label>${html || `<input class="input" id="${id}" maxlength="120">`}</div>`;

PubUI.view_report = function () {
    return `<h3>${T('pub_t_report')}</h3><div class="muted" style="font-size:12px">${T('pub_d_report')}</div>
        <div class="grid2">${pubField('pf-type', T('f_type'), `<select class="select" id="pf-type">${(PubUI.d.reportTypes || []).map(x => `<option value="${x}">${T('rep_' + x)}</option>`).join('')}</select>`)}
            ${pubField('pf-title', T('pub_f_title'))}</div>
        <div class="grid2">${pubField('pf-location', T('pub_f_location'))}${pubField('pf-when', T('pub_f_when'))}</div>
        ${pubField('pf-desc', T('f_description'), `<textarea class="textarea" id="pf-desc" maxlength="4000" style="min-height:140px"></textarea>`)}
        ${pubField('pf-phone', T('pub_phone'), `<input class="input" id="pf-phone" maxlength="30" value="${esc(PubUI.d.phone || '')}">`)}
        <div class="row"><button class="btn primary" data-send="report">${icon('send', 'sm')}${T('pub_send')}</button></div>`;
};

PubUI.view_stolen = function () {
    const vs = PubUI.d.vehicles || [];
    return `<h3>${T('pub_t_stolen')}</h3><div class="muted" style="font-size:12px">${T('pub_stolen_hint')}</div>
        ${vs.length ? pubField('pf-veh', T('pub_my_vehicle'), `<select class="select" id="pf-veh"><option value="">${T('pub_other_vehicle')}</option>
            ${vs.map((v, i) => `<option value="${i}">${esc(v.plate)}${v.label ? ' · ' + esc(v.label) : ''}</option>`).join('')}</select>`) : ''}
        <div class="grid3">${pubField('pf-plate', T('pub_f_plate'), `<input class="input mono" id="pf-plate" maxlength="16">`)}${pubField('pf-model', T('pub_f_model'))}${pubField('pf-color', T('pub_f_color'))}</div>
        <div class="grid2">${pubField('pf-last', T('pub_f_lastSeen'))}${pubField('pf-when', T('pub_f_when'))}</div>
        ${pubField('pf-desc', T('f_description'), `<textarea class="textarea" id="pf-desc" maxlength="2000"></textarea>`)}
        ${pubField('pf-phone', T('pub_phone'), `<input class="input" id="pf-phone" maxlength="30" value="${esc(PubUI.d.phone || '')}">`)}
        <div class="row"><button class="btn primary" data-send="stolen">${icon('send', 'sm')}${T('pub_send')}</button></div>`;
};

PubUI.view_complaint = function () {
    return `<h3>${T('pub_t_complaint')}</h3><div class="pub-note">${icon('shield', 'sm')}${T('pub_complaint_hint')}</div>
        <div class="grid2">${pubField('pf-officer', T('pub_f_officer'))}${pubField('pf-cat', T('pub_f_category'), `<select class="select" id="pf-cat">${(PubUI.d.categories || []).map(c => `<option value="${c}">${T('ia_cat_' + c)}</option>`).join('')}</select>`)}</div>
        <div class="grid2">${pubField('pf-title', T('pub_f_title'))}${pubField('pf-when', T('pub_f_when'))}</div>
        ${pubField('pf-desc', T('f_description'), `<textarea class="textarea" id="pf-desc" maxlength="6000" style="min-height:140px"></textarea>`)}
        ${pubField('pf-phone', T('pub_contact'), `<input class="input" id="pf-phone" maxlength="30" value="${esc(PubUI.d.phone || '')}">`)}
        <div class="row"><button class="btn primary" data-send="complaint">${icon('send', 'sm')}${T('pub_send')}</button></div>`;
};

PubUI.view_licence = function () {
    return `<h3>${T('pub_t_licence')}</h3><div class="muted" style="font-size:12px">${T('pub_licence_hint')}</div>
        <div class="col">${(PubUI.d.licences || []).map(l => `<div class="adm-row"><div class="ic">${icon('badge')}</div><div class="grow"><div class="t">${T('lic_' + l.id)}</div>
            <div class="s">${l.has ? T('pub_lic_has') : l.pending ? T('pub_lic_pending') : T('pub_lic_none')}</div></div>
            ${!l.has && !l.pending ? `<button class="btn primary sm" data-apply="${esc(l.id)}">${T('pub_apply')}</button>` : `<span class="chip ${l.has ? 'ok' : 'warn'}">${l.has ? T('pub_lic_valid') : T('desk_status_new')}</span>`}</div>`).join('')}</div>`;
};

PubUI.view_wanted = function () {
    const list = PubUI.d.wanted || [];
    const cur = PubUI.d.currency || '$';
    return `<h3>${T('pub_t_wanted')}</h3><div class="muted" style="font-size:12px">${T('pub_wanted_hint')}</div>
        <div class="pub-wanted">${list.map(w => `<div class="pw-card"><div class="photo" ${bg(w.photo)}>${w.photo ? '' : icon('user', 'lg')}</div>
            <div class="pw-body"><b>${esc(w.name)}</b><span class="mono dim">${esc(w.number)}</span>
            ${(w.charges || []).length ? `<span class="s">${esc(w.charges.join(', '))}</span>` : ''}
            <div class="row">${w.reward ? `<span class="chip ok">${T('wanted_reward')}: ${esc(cur)}${Number(w.reward).toLocaleString(LOCALE())}</span>` : ''}
                ${w.danger ? `<span class="chip bad">${T('wanted_danger')}</span>` : ''}</div>
            <button class="btn sm" data-tip="${esc(w.number)}">${icon('mail', 'sm')}${T('pub_tip')}</button></div></div>`).join('') || `<div class="empty">${T('wanted_none')}</div>`}</div>`;
};

PubUI.view_status = function () {
    const rows = PubUI.d.mine || [];
    return `<div class="row between"><h3>${T('pub_t_status')}</h3><button class="btn sm" data-a="reload">${icon('refresh', 'sm')}</button></div>
        ${rows.length ? `<table class="tbl"><thead><tr><th>${T('f_number')}</th><th>${T('f_type')}</th><th>${T('pub_f_title')}</th><th>${T('f_status')}</th><th>${T('pub_answer_col')}</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td class="mono">${esc(r.number)}<div class="dim" style="font-size:10.5px">${fmtDate(r.created_at)}</div></td><td>${T('pub_kind_' + r.kind)}</td><td>${esc(r.title || '')}</td>
            <td><span class="chip ${r.status === 'approved' || r.status === 'done' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn'}">${T('desk_status_' + r.status)}</span></td>
            <td>${esc(r.response || '-')}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${T('pub_none')}</div>`}`;
};

PubUI.collect = function (kind) {
    const v = id => { const el = $('#' + id, $('#pub')); return el ? el.value.trim() : ''; };
    if (kind === 'report') {
        if (!v('pf-title')) return null;
        return { type: v('pf-type'), title: v('pf-title'), location: v('pf-location'), when: v('pf-when'), description: v('pf-desc'), phone: v('pf-phone') };
    }
    if (kind === 'stolen') {
        if (!v('pf-plate')) return null;
        return { plate: v('pf-plate'), model: v('pf-model'), color: v('pf-color'), lastSeen: v('pf-last'), when: v('pf-when'), description: v('pf-desc'), phone: v('pf-phone') };
    }
    if (kind === 'complaint') {
        if (!v('pf-officer') || !v('pf-title')) return null;
        return { officer: v('pf-officer'), category: v('pf-cat'), title: v('pf-title'), occurred: v('pf-when'), description: v('pf-desc'), phone: v('pf-phone') };
    }
};

PubUI.send = async function (kind, data) {
    const r = await srv('pub:submit', { pointId: PubUI.d.pointId, kind, data });
    if (!r || r.error) return post('notify', { msg: errMsg(r), type: 'error' });
    const res = await srv('pub:mine', { pointId: PubUI.d.pointId });
    if (res && res.mine) PubUI.d.mine = res.mine;
    if (kind === 'licence') PubUI.d.licences.forEach(l => { if (l.id === data.licence) l.pending = true; });
    $('[data-main]', $('#pub')).innerHTML = `<div class="pub-done">${icon('check', 'lg')}<h2>${T('pub_sent')}</h2>
        <div>${T('pub_sent_no')} <b class="mono accent">${esc(r.number)}</b></div><div class="muted">${T('pub_sent_hint')}</div>
        <div class="row"><button class="btn" data-tab="status">${T('pub_t_status')}</button><button class="btn primary" data-tab="home">${T('pub_back')}</button></div></div>`;
};

$('#pub').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return PubUI.close();
    const t = e.target.closest('[data-tab]');
    if (t) { PubUI.tab = t.dataset.tab; return PubUI.render(); }
    const s = e.target.closest('[data-send]');
    if (s) {
        const data = PubUI.collect(s.dataset.send);
        if (!data) return post('notify', { msg: T('pub_fill'), type: 'error' });
        return PubUI.send(s.dataset.send, data);
    }
    const ap = e.target.closest('[data-apply]');
    if (ap) {
        const reason = await UI.prompt(T('pub_apply') + ': ' + T('lic_' + ap.dataset.apply), '', { multi: true, label: T('pub_lic_reason'), max: 1500, ok: T('pub_send') });
        if (reason === null) return;
        return PubUI.send('licence', { licence: ap.dataset.apply, reason });
    }
    const tip = e.target.closest('[data-tip]');
    if (tip) {
        const v = await UI.modal({
            title: T('pub_tip') + ' · ' + esc(tip.dataset.tip), icon: 'mail',
            body: `<div class="field"><label>${T('pub_tip_text')}</label><textarea class="textarea" id="tp-t" maxlength="2000"></textarea></div>
                <div class="field"><label>${T('pub_f_location')}</label><input class="input" id="tp-l" maxlength="120"></div>
                ${PubUI.d.anonymousTips ? `<label class="check"><input type="checkbox" id="tp-a">${T('pub_anonymous')}</label>` : ''}`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('pub_send'), cls: 'primary', collect: el => {
                const text = $('#tp-t', el).value.trim();
                return text ? { warrant: tip.dataset.tip, text, location: $('#tp-l', el).value.trim(), anonymous: !!($('#tp-a', el) && $('#tp-a', el).checked) } : false;
            } }],
        });
        if (v) PubUI.send('tip', v);
        return;
    }
    const a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'reload') {
        const res = await srv('pub:mine', { pointId: PubUI.d.pointId });
        if (res && res.mine) { PubUI.d.mine = res.mine; PubUI.render(); }
    }
});

$('#pub').addEventListener('change', e => {
    if (e.target.id !== 'pf-veh') return;
    const v = (PubUI.d.vehicles || [])[+e.target.value];
    $('#pf-plate', $('#pub')).value = v ? v.plate : '';
    $('#pf-model', $('#pub')).value = v ? (v.label || '') : '';
});

// ---------- armory ----------
const ArmUI = { d: null };

ArmUI.open = function (d) {
    ArmUI.d = d;
    $('#arm').classList.remove('hidden');
    ArmUI.render();
};

ArmUI.close = function () {
    $('#arm').classList.add('hidden');
    post('close', { layer: 'arm' });
};

ArmUI.render = function () {
    const d = ArmUI.d;
    $('#arm').innerHTML = `<div class="panel arm-panel"><div class="panel-head"><div class="logo">${icon('armory')}</div>
        <div class="grow"><div class="ttl">${esc(d.point.label)}</div><div class="sub">${T('arm_sub')}</div></div><button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="panel-body"><div class="pr-main"><div class="arm-grid">${d.items.map(it => {
            const full = it.held + it.count > it.max;
            const why = !it.allowed ? (it.cert ? T('arm_need_cert') : T('arm_need_grade')) : full ? T('arm_limit') : '';
            return `<div class="arm-item ${it.allowed && !full ? '' : 'off'}"><div class="img" ${bg(it.image)}>${it.image ? '' : icon('armory', 'lg')}</div>
                <b>${esc(it.label)}</b><span class="dim">${it.count > 1 ? '×' + it.count + ' · ' : ''}${T('arm_held', it.held, it.max)}</span>
                ${why ? `<span class="chip">${why}</span>` : `<button class="btn sm primary" data-take="${it.index}">${icon('plus', 'sm')}${T('arm_take')}</button>`}</div>`;
        }).join('')}</div></div>
        <div class="pr-side" style="border-left:1px solid var(--line);border-right:none">
            <div class="section-title">${T('arm_mine')}<span class="line"></span></div>
            <div class="col">${d.out.map(o => `<div class="adm-row"><div class="grow"><div class="t">${esc(o.label || o.item)}${o.count > 1 ? ' ×' + o.count : ''}</div>
                <div class="s mono">${esc(o.serial || '')} ${fmtTime(o.out_at)}</div></div><button class="btn sm" data-ret="${o.id}">${T('arm_return')}</button></div>`).join('')
                || `<span class="dim" style="font-size:12px">${T('arm_nothing')}</span>`}</div>
            <div class="grow"></div>
            ${d.returnAll && d.out.length ? `<button class="btn" data-retall>${icon('refresh', 'sm')}${T('arm_return_all')}</button>` : ''}
        </div></div></div>`;
};

ArmUI.apply = function (r) {
    if (r && r.items) { ArmUI.d.items = r.items; ArmUI.d.out = r.out; ArmUI.render(); }
    if (!r || r.error) post('notify', { msg: errMsg(r), type: 'error' });
};

$('#arm').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return ArmUI.close();
    const t = e.target.closest('[data-take]');
    if (t) return ArmUI.apply(await srv('arm:take', { pointId: ArmUI.d.pointId, index: +t.dataset.take }));
    const r = e.target.closest('[data-ret]');
    if (r) return ArmUI.apply(await srv('arm:return', { pointId: ArmUI.d.pointId, id: +r.dataset.ret }));
    if (e.target.closest('[data-retall]')) return ArmUI.apply(await srv('arm:return', { pointId: ArmUI.d.pointId, all: true }));
});

// ---------- training test ----------
const TestUI = { d: null, timer: null, deadline: 0, done: false };

TestUI.open = function (d) {
    TestUI.d = d;
    TestUI.done = false;
    TestUI.warned = false;
    TestUI.deadline = Date.now() + d.minutes * 60000;
    const el = $('#test');
    el.innerHTML = `<div class="panel test-panel"><div class="panel-head"><div class="logo">${icon('training')}</div>
        <div class="grow"><div class="ttl">${esc(d.title)}</div><div class="sub">${T('test_by', esc(d.fto || ''))} · ${T('test_pass', d.passScore)}</div></div>
        <span class="mono int-clock" data-clock></span></div>
        <div class="panel-body"><div class="pr-main"><div class="test-qs">${d.questions.map((q, i) => `<div class="test-q"><div class="tq-n">${i + 1}.</div><div class="grow">
            <div class="tq-t">${esc(q.q)}</div>${q.multi ? `<div class="dim" style="font-size:11px">${T('test_multi')}</div>` : ''}
            ${q.options.map((o, j) => `<label class="check"><input type="${q.multi ? 'checkbox' : 'radio'}" name="q${i}" value="${j + 1}">${esc(o)}</label>`).join('')}</div></div>`).join('')}</div>
            <div class="pr-foot"><span class="muted" data-left></span><div class="grow"></div><button class="btn primary" data-submit>${icon('check', 'sm')}${T('test_submit')}</button></div></div></div></div>`;
    el.classList.remove('hidden');
    const tick = () => {
        const left = Math.max(0, Math.round((TestUI.deadline - Date.now()) / 1000));
        const c = $('[data-clock]', el);
        if (c) c.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
        if (left <= 0 && !TestUI.done) TestUI.submit(true);
    };
    clearInterval(TestUI.timer);
    TestUI.timer = setInterval(tick, 1000);
    tick();
};

TestUI.answers = function () {
    return TestUI.d.questions.map((_, i) => $$(`#test input[name="q${i}"]:checked`).map(x => +x.value));
};

TestUI.submit = async function (auto) {
    if (TestUI.done) return;
    const answers = TestUI.answers();
    const empty = answers.filter(a => !a.length).length;
    // the test can lie over the desktop - no dialog, the second click submits
    if (!auto && empty && !TestUI.warned) {
        TestUI.warned = true;
        $('#test [data-left]').innerHTML = `<span class="chip warn">${T('test_confirm_empty', empty)}</span>`;
        return;
    }
    TestUI.done = true;
    clearInterval(TestUI.timer);
    const r = await srv('test:submit', { id: TestUI.d.id, answers });
    const main = $('#test .pr-main');
    if (!r || r.error) {
        main.innerHTML = `<div class="pub-done">${icon('warn', 'lg')}<h2>${errMsg(r)}</h2><button class="btn" data-tclose>${T('ui_close')}</button></div>`;
        return;
    }
    main.innerHTML = `<div class="pub-done ${r.passed ? 'ok' : 'bad'}">${icon(r.passed ? 'check' : 'x', 'lg')}<h2>${r.passed ? T('test_passed') : T('test_failed')}</h2>
        <div class="test-score">${r.score} %</div><div class="muted">${T('test_good', r.good, r.total)}${r.late ? ' · ' + T('test_late') : ''}</div>
        <button class="btn primary" data-tclose>${T('ui_close')}</button></div>`;
};

TestUI.close = function () {
    clearInterval(TestUI.timer);
    $('#test').classList.add('hidden');
    post('close', { layer: 'test' });
};

TestUI.end = function (d) {
    if (!TestUI.d || TestUI.d.id !== d.id || TestUI.done) return;
    TestUI.done = true;
    clearInterval(TestUI.timer);
    $('#test .pr-main').innerHTML = `<div class="pub-done bad">${icon('clock', 'lg')}<h2>${T('test_expired')}</h2><button class="btn" data-tclose>${T('ui_close')}</button></div>`;
};

$('#test').addEventListener('click', e => {
    if (e.target.closest('[data-submit]')) return TestUI.submit(false);
    if (e.target.closest('[data-tclose]')) return TestUI.close();
});

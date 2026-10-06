// ==========================================
// App: desk - submissions of the public terminal (reports, stolen vehicles, licences, tips)
// ==========================================
(function () {
    const KINDS = ['report', 'stolen', 'licence', 'tip'];
    const KIND_ICON = { report: 'notes', stolen: 'car', licence: 'badge', tip: 'eye' };
    const stChip = s => `<span class="chip ${s === 'approved' || s === 'done' ? 'ok' : s === 'rejected' ? 'bad' : s === 'new' ? 'info' : 'warn'}">${T('desk_status_' + s)}</span>`;
    const FIELDS = ['type', 'location', 'when', 'plate', 'model', 'color', 'lastSeen', 'warrant', 'dob'];

    Apps.define('desk', {
        w: 1100, h: 700,
        mount(win, args) {
            const st = win.state = { kind: '', filter: 'open', query: '', current: null };
            win.body.innerHTML = `<div class="app"><div class="tabs" data-kinds>${[''].concat(KINDS).map(k => `<button class="tab ${k === '' ? 'on' : ''}" data-kind="${k}">
                    ${icon(k ? KIND_ICON[k] : 'list', 'sm')}${k ? T('pub_kind_' + k) : T('ui_all')}<span class="n hidden" data-cnt="${k}"></span></button>`).join('')}</div>
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('desk_search')}"></div>
                    <select class="select" data-f style="width:150px">${['open', 'closed', 'all'].map(f => `<option value="${f}">${T('ia_f_' + f)}</option>`).join('')}</select></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail><div class="empty" style="height:100%;justify-content:center">${icon('notes')}${T('desk_pick')}</div></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));
            $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };

            async function load() {
                const r = await api('desk:list', { kind: st.kind, status: st.filter, query: st.query });
                if (r.error) return UI.err(r);
                KINDS.forEach(k => { const el = $(`[data-cnt="${k}"]`, win.body); el.textContent = r.counts[k] || ''; el.classList.toggle('hidden', !r.counts[k]); });
                $('[data-list]', win.body).innerHTML = r.list.map(x => `<div class="list-item ${st.current && st.current.id === x.id ? 'active' : ''}" data-id="${x.id}">${icon(KIND_ICON[x.kind] || 'notes')}
                    <div class="grow"><div class="row between"><span class="t ellipsis">${esc(x.title)}</span>${stChip(x.status)}</div>
                    <div class="s"><span class="mono">${esc(x.number)}</span> · ${T('pub_kind_' + x.kind)} · ${x.anonymous ? T('desk_anonymous') : esc(x.name || '')}</div>
                    <div class="s">${ago(x.createdAt)}${x.handled ? ' · ' + esc(x.handled) : ''}</div></div></div>`).join('') || `<div class="empty">${icon('notes')}${T('ui_nothing_found')}</div>`;
            }

            async function open(id, silent) {
                const r = await api('desk:get', { id });
                if (r.error) return silent ? null : UI.err(r);
                const x = st.current = r.item, d = x.data || {};
                win.setTitle(x.number);
                $$('[data-list] .list-item', win.body).forEach(el => el.classList.toggle('active', +el.dataset.id === id));
                const open_ = x.status === 'new' || x.status === 'processing';
                const ck = x.checks;
                $('[data-detail]', win.body).innerHTML = `<div class="detail-head"><div class="grow"><h2>${esc(x.title)}</h2>
                    <div class="sub"><span class="mono accent">${esc(x.number)}</span>${stChip(x.status)}<span>${T('pub_kind_' + x.kind)}</span>
                    ${x.caseId ? `<a class="mono" data-case="${x.caseId}" style="cursor:pointer">${icon('cases', 'sm')}${T('desk_open_case')}</a>` : ''}${x.ref ? `<span class="chip accent">${esc(x.ref)}</span>` : ''}</div></div>
                    <div class="detail-actions">
                        ${x.can.case && !x.caseId && x.kind !== 'licence' ? `<button class="btn sm" data-a="case">${icon('cases', 'sm')}${T('desk_to_case')}</button>` : ''}
                        ${x.can.bolo && x.kind === 'stolen' && !x.ref ? `<button class="btn sm primary" data-a="bolo">${icon('eye', 'sm')}${T('desk_to_bolo')}</button>` : ''}
                        ${x.can.manage ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body">
                        <div class="card"><div class="kv"><span>${T('desk_from')}</span><span>${x.anonymous ? T('desk_anonymous') : esc(x.name || '-')}</span>
                            ${x.phone ? `<span>${T('pub_phone')}</span><span class="mono">${esc(x.phone)}</span>` : ''}
                            ${FIELDS.filter(k => d[k]).map(k => `<span>${T('pub_f_' + k)}</span><span>${k === 'type' ? T('rep_' + d[k]) : esc(d[k])}</span>`).join('')}
                            ${x.kind === 'licence' ? `<span>${T('desk_licence')}</span><span>${T('lic_' + d.licence)}</span>` : ''}
                            <span>${T('f_date')}</span><span>${fmtDT(x.createdAt)}</span>
                            ${x.handled ? `<span>${T('desk_handled')}</span><span>${esc(x.handled)} · ${fmtDT(x.updatedAt)}</span>` : ''}</div></div>
                        ${d.description || d.text || d.reason ? `<div class="card"><div class="md">${md(d.description || d.text || d.reason)}</div></div>` : ''}
                        ${ck ? `<div class="card"><div class="card-title">${icon('shield', 'sm')}${T('desk_checks')}</div><div class="kv">
                            ${ck.warrants != null ? `<span>${T('desk_check_warrants')}</span><span><span class="chip ${ck.warrants ? 'bad' : 'ok'}">${ck.warrants}</span></span>` : ''}
                            ${ck.bookings != null ? `<span>${T('desk_check_bookings', ck.days)}</span><span><span class="chip ${ck.bookings ? 'bad' : 'ok'}">${ck.bookings}</span></span>` : ''}
                            <span>${T('desk_check_weapons')}</span><span>${ck.weapons || 0}</span></div></div>` : ''}
                        ${x.kind === 'licence' && x.status === 'approved' ? `<div class="card"><span class="chip ${x.applied ? 'ok' : 'warn'}">${x.applied ? T('desk_lic_applied') : T('desk_lic_waiting')}</span></div>` : ''}
                        <div class="card"><div class="card-title">${icon('mail', 'sm')}${T('desk_answer')}</div>
                            <div class="dim" style="font-size:11.5px">${T('desk_answer_hint')}</div>
                            <textarea class="textarea" data-resp maxlength="500" style="min-height:70px">${esc(x.response || '')}</textarea>
                            ${open_ ? `<div class="row" style="margin-top:6px">${x.kind === 'licence'
                                ? (x.can.manage ? `<button class="btn ok" data-a="approve">${icon('check', 'sm')}${T('desk_lic_approve')}</button><button class="btn danger" data-a="reject">${icon('x', 'sm')}${T('desk_lic_reject')}</button>` : `<span class="dim">${T('desk_lic_manage')}</span>`)
                                : `<button class="btn" data-st="processing">${T('desk_take')}</button><button class="btn ok" data-st="done">${icon('check', 'sm')}${T('desk_done')}</button><button class="btn" data-st="rejected">${T('desk_reject')}</button>`}</div>`
                            : `<button class="btn sm" data-st="${x.status}" style="align-self:flex-start;margin-top:6px">${T('desk_save_answer')}</button>`}</div>
                    </div>`;
            }

            win.state.open = open;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id, true); };

            win.body.addEventListener('click', async e => {
                const k = e.target.closest('[data-kind]');
                if (k) { st.kind = k.dataset.kind; $$('[data-kind]', win.body).forEach(b => b.classList.toggle('on', b === k)); return load(); }
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const x = st.current;
                const sb = e.target.closest('[data-st]');
                if (sb) {
                    const r = await api('desk:respond', { id: x.id, status: sb.dataset.st, response: $('[data-resp]', win.body).value });
                    if (r.error) return UI.err(r);
                    await load();
                    return open(x.id);
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'case') {
                    const r = await api('desk:toCase', { id: x.id });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('ui_case_created'), text: r.caseNo, type: 'success', app: 'cases' });
                    return OS.openApp('cases', { id: r.id });
                }
                if (a.dataset.a === 'bolo') {
                    const r = await api('desk:toBolo', { id: x.id });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: r.status === 'pending' ? T('wr_sent') : T('wr_active'), text: r.number, type: 'success', app: 'warrants' });
                    return OS.openApp('warrants', { id: r.id });
                }
                if (a.dataset.a === 'approve' || a.dataset.a === 'reject') {
                    const ok = a.dataset.a === 'approve';
                    if (!(await UI.confirm(T(ok ? 'desk_confirm_approve' : 'desk_confirm_reject', esc(x.name || ''))))) return;
                    const r = await api('desk:licence', { id: x.id, approve: ok, response: $('[data-resp]', win.body).value });
                    if (r.error) return UI.err(r);
                    if (ok) OS.toast({ title: r.applied ? T('desk_lic_applied') : T('desk_lic_waiting'), type: 'success', app: 'desk' });
                    await load();
                    return open(x.id);
                }
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('desk_confirm_delete', esc(x.number)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('desk:delete', { id: x.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    $('[data-detail]', win.body).innerHTML = '';
                    return load();
                }
            });

            load();
            if (args && (args.id || args.ref)) open(+(args.id || args.ref));
        },
        onArgs(win, args) { if (args.id || args.ref) win.state.open(+(args.id || args.ref)); },
    });
})();

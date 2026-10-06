// ==========================================
// App: prisoners (fz_mugshot) - bookings, arrest history, mugshots, charges, status, property
// ==========================================
(function () {
    Apps.define('prisoners', {
        w: 1120, h: 700,
        async mount(win, args) {
            const st = win.state = { query: '', status: '', current: null, meta: null };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('pr_search')}"></div>
                    <select class="select" data-status style="width:190px"><option value="">${T('ui_all_states')}</option></select><div class="grow"></div>
                    <button class="icon-btn" data-a="refresh">${icon('refresh')}</button></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail>
                    <div class="empty" style="height:100%;justify-content:center">${icon('prisoners')}${T('pr_pick')}</div></div></div></div>`;
            const meta = await api('prisoners:init');
            if (meta.error) { win.body.innerHTML = `<div class="empty">${icon('warn')}${errMsg(meta)}</div>`; return; }
            st.meta = meta;
            const sSel = $('[data-status]', win.body);
            if (meta.statusEnabled) sSel.innerHTML += meta.statuses.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
            else sSel.classList.add('hidden');
            sSel.onchange = () => { st.status = sSel.value; load(); };
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));
            const statusLabel = id => ((meta.statuses || []).find(s => s.id === id) || {}).label || id;
            const statusChip = s => s ? `<span class="chip ${s === 'custody' ? 'bad' : s === 'released' ? 'ok' : 'warn'}"><span class="dot"></span>${esc(statusLabel(s))}</span>` : '';

            async function load() {
                const res = await api('prisoners:list', { query: st.query, status: st.status });
                if (res.error) return UI.err(res);
                $('[data-list]', win.body).innerHTML = res.list.length ? res.list.map(b => `<div class="list-item ${st.current && st.current.bookingNo === b.bookingNo ? 'active' : ''}" data-b="${esc(b.bookingNo)}">
                    <div class="avatar" ${bg(b.photo)}>${b.photo ? '' : initials(b.name)}</div>
                    <div class="grow"><div class="row between"><span class="t ellipsis">${esc(b.name)}</span>${statusChip(b.status)}</div>
                    <div class="s mono">${esc(b.bookingNo)}</div><div class="s">${fmtDate(b.createdAt)} · ${esc(b.firstCharge || '-')}${b.charges > 1 ? ` +${b.charges - 1}` : ''}</div></div></div>`).join('')
                    : `<div class="empty">${icon('prisoners')}${T('ui_nothing_found')}</div>`;
            }

            async function open(no, silent) {
                const res = await api('prisoners:get', { bookingNo: no, refresh: !!silent });
                if (res.error) { if (silent) { st.current = null; $('[data-detail]', win.body).innerHTML = ''; return; } return UI.err(res); }
                const r = st.current = res.record;
                win.setTitle(r.name);
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', x.dataset.b === no));
                const prop = r.propertyData;
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(r.name)}</h2>
                        <div class="sub"><span class="mono accent">${esc(r.bookingNo)}</span>${statusChip(r.status)}${r.statusBy ? `<span>${esc(r.statusBy)} · ${ago(r.statusAt)}</span>` : ''}</div></div>
                        <div class="detail-actions">
                            ${meta.canStatus && meta.statusEnabled ? `<select class="select" data-setstatus style="width:170px">${meta.statuses.map(s => `<option value="${esc(s.id)}" ${s.id === r.status ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>` : ''}
                            ${meta.canEdit ? `<button class="btn sm" data-a="edit">${icon('edit', 'sm')}${T('ui_edit')}</button>` : ''}
                            ${OS.can('court.file') && OS.state.apps.find(x => x.id === 'court') ? `<button class="btn sm" data-a="toCourt">${icon('gavel', 'sm')}${T('court_file')}</button>` : ''}
                            <button class="btn sm" data-a="printRecord">${icon('printer', 'sm')}${T('pr_print_record')}</button>
                            ${r.photos && r.photos.front ? `<button class="btn sm" data-a="printPhoto">${icon('camera', 'sm')}${T('pr_print_photo')}</button>` : ''}
                            ${meta.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}
                        </div></div>
                    <div class="detail-body">
                        <div class="row" style="align-items:flex-start;gap:16px">
                            <div class="mugs"><div class="photo" ${bg(r.photos && r.photos.front)}></div><div class="photo" ${bg(r.photos && r.photos.side)}></div></div>
                            <div class="card grow"><div class="kv">
                                <span>${T('f_dob')}</span><span>${esc(r.dob || '-')}</span><span>${T('f_sex')}</span><span>${r.sex ? T('sex_' + r.sex) : '-'}</span>
                                <span>${T('f_dept')}</span><span>${esc(r.dept || '-')}</span><span>${T('f_officer')}</span><span>${esc(r.officer || '-')}</span>
                                <span>${T('f_date')}</span><span>${fmtDT(r.createdAt)}</span>
                                <span>${T('f_case_no')}</span><span>${r.caseRef ? `<a data-case="${r.caseRef.id}" style="cursor:pointer" class="mono">${esc(r.caseNo)}</a> · ${esc(r.caseRef.title)}` : esc(r.caseNo || '-')}</span>
                                <span>${T('f_fingerprint')}</span><span class="mono">${r.fingerprint ? esc(r.fingerprint.code) + ` <span class="dim">${fmtDate(r.fingerprint.at)}</span>` : '-'}</span>
                                ${r.forensics ? `<span>${T('f_dna')}</span><span class="mono">${esc(r.forensics.dna || '-')}${r.forensics.dnaRegistered ? ' ✓' : ''}</span>` : ''}
                            </div></div></div>
                        <div class="card"><div class="card-title">${icon('penal', 'sm')}${T('pr_charges')}</div>
                            ${(r.charges || []).length ? `<table class="tbl"><tbody>${r.charges.map(c => `<tr><td class="mono accent" style="width:100px">${esc(c.code || '')}</td>
                                <td>${esc(c.label || '')}</td><td class="type-${esc(c.type || '')}" style="width:110px">${c.type ? T('ptype_' + c.type) : ''}</td><td style="width:40px">×${c.count || 1}</td></tr>`).join('')}</tbody></table>`
                                : `<span class="dim">${T('pr_no_charges')}</span>`}</div>
                        ${r.notes ? `<div class="card"><div class="card-title">${icon('notes', 'sm')}${T('f_notes')}</div><div class="md">${md(r.notes)}</div></div>` : ''}
                        ${prop ? `<div class="card"><div class="card-title">${icon('bag', 'sm')}${T('pr_property')} ${prop.returnedAt ? `<span class="chip ok">${T('pr_returned')} ${fmtDate(prop.returnedAt)}</span>` : `<span class="chip warn">${T('pr_held')}</span>`}</div>
                            <div class="row wrap">${(prop.items || []).map(i => `<span class="chip">${esc(i.label || i.name)} ×${i.count}</span>`).join('')}
                            ${(prop.weapons || []).map(w => `<span class="chip bad">${esc(w.label || w.name)}</span>`).join('')}${prop.money ? `<span class="chip accent">${money(prop.money)}</span>` : ''}</div>
                            <div class="s muted" style="margin-top:8px;font-size:11px">${esc(prop.takenBy || '')} · ${fmtDT(prop.takenAt)}</div></div>` : ''}
                        ${(r.warrants || []).length ? `<div class="card"><div class="card-title">${icon('gavel', 'sm')}${T('tab_warrants')}</div>${r.warrants.map(w => `<div class="list-item" data-warrant="${w.id}">
                            <span class="mono">${esc(w.number)}</span><span class="grow">${esc(w.title)}</span><span class="chip st-${w.status}">${T('wstatus_' + w.status)}</span></div>`).join('')}</div>` : ''}
                        <div><div class="section-title">${T('pr_history')}<span class="line"></span></div><div class="list">${(r.history || []).filter(h => h.bookingNo !== r.bookingNo).map(h => `<div class="list-item" data-b="${esc(h.bookingNo)}">
                            <div class="avatar" ${bg(h.photo)}></div><div class="grow"><div class="t mono">${esc(h.bookingNo)}</div><div class="s">${fmtDate(h.createdAt)} · ${esc(h.firstCharge || '-')}</div></div>${statusChip(h.status)}</div>`).join('') || `<div class="empty">${T('pr_first_arrest')}</div>`}</div></div>
                    </div>`;
                const ss = $('[data-setstatus]', win.body);
                if (ss) ss.onchange = async () => {
                    const res2 = await api('prisoners:status', { bookingNo: r.bookingNo, status: ss.value });
                    if (res2.error) return UI.err(res2);
                    OS.toast({ title: T('pr_status_set'), type: 'success', app: 'prisoners' });
                    load();
                    open(r.bookingNo);
                };
            }
            win.state.open = open;
            win.refresh = async () => { await load(); if (st.current) open(st.current.bookingNo, true); };

            win.body.addEventListener('click', async e => {
                const it = e.target.closest('[data-b]');
                if (it) return open(it.dataset.b);
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const wr = e.target.closest('[data-warrant]');
                if (wr) return OS.openApp('warrants', { id: +wr.dataset.warrant });
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const r = st.current;
                if (a.dataset.a === 'refresh') return load();
                if (a.dataset.a === 'toCourt') {
                    const res = await CourtFile({ title: (r.charges && r.charges[0] ? r.charges[0].label : r.bookingNo), defendant: { name: r.name }, bookingNo: r.bookingNo,
                        bookingCharges: r.charges || [], caseId: r.caseRef ? r.caseRef.id : null, caseNo: r.caseNo });
                    if (res) OS.openApp('court', { id: res.id });
                    return;
                }
                if (a.dataset.a === 'printRecord') return UI.print({ type: 'booking', bookingNo: r.bookingNo, kind: 'record' }, r.bookingNo);
                if (a.dataset.a === 'printPhoto') return UI.print({ type: 'booking', bookingNo: r.bookingNo, kind: 'photo' }, r.name);
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('pr_confirm_delete', esc(r.bookingNo)), { danger: true, ok: T('ui_delete') }))) return;
                    let res = await api('prisoners:delete', { bookingNo: r.bookingNo });
                    if (res.error === 'property_held') {
                        if (!(await UI.confirm(T('pr_confirm_property'), { danger: true, ok: T('ui_delete') }))) return;
                        res = await api('prisoners:delete', { bookingNo: r.bookingNo, force: true });
                    }
                    if (res.error) return UI.err(res);
                    st.current = null;
                    $('[data-detail]', win.body).innerHTML = `<div class="empty" style="height:100%;justify-content:center">${icon('prisoners')}${T('pr_pick')}</div>`;
                    return load();
                }
                if (a.dataset.a === 'edit') {
                    let charges = (r.charges || []).map(c => ({ ...c }));
                    const v = await UI.modal({
                        title: T('pr_edit'), icon: 'edit', wide: true,
                        body: `<div class="field"><label>${T('pr_charges')}</label><div class="pick-tags" id="ed-ch"></div>
                            <button class="btn sm" id="ed-add" style="align-self:flex-start">${icon('plus', 'sm')}${T('pr_from_penal')}</button></div>
                            <div class="field"><label>${T('f_case_no')}</label><div class="row"><input class="input mono" id="ed-case" value="${esc(r.caseNo || '')}" maxlength="40"><button class="btn sm" id="ed-pick">${icon('cases', 'sm')}</button></div></div>
                            <div class="field"><label>${T('f_notes')}</label><textarea class="textarea" id="ed-notes" maxlength="1200">${esc(r.notes || '')}</textarea></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => ({
                            charges, caseNo: $('#ed-case', el).value.trim(), notes: $('#ed-notes', el).value,
                        }) }],
                        onOpen(el) {
                            const paint = () => {
                                $('#ed-ch', el).innerHTML = charges.map((c, i) => `<span class="chip accent" data-rm="${i}">${esc(c.code || '')} ${esc(c.label || '')} ×${c.count || 1} ✕</span>`).join('') || `<span class="dim">-</span>`;
                            };
                            paint();
                            el.addEventListener('click', ev => { const rm = ev.target.closest('[data-rm]'); if (rm) { charges.splice(+rm.dataset.rm, 1); paint(); } });
                            $('#ed-add', el).onclick = async () => {
                                const picked = await UI.pickCharges([]);
                                if (picked) { charges = charges.concat(picked.map(p => ({ code: p.code, label: p.label, type: p.type, count: p.count }))); paint(); }
                            };
                            // allow picking a case from the case book
                            $('#ed-pick', el).onclick = async () => { const c = await UI.pickCase({ allowNone: true }); if (c) $('#ed-case', el).value = c.caseNo || ''; };
                        },
                    });
                    if (!v) return;
                    const res = await api('prisoners:update', { bookingNo: r.bookingNo, ...v });
                    if (res.error) return UI.err(res);
                    open(r.bookingNo);
                }
            });

            await load();
            if (args && args.bookingNo) open(args.bookingNo);
        },
        onArgs(win, args) { if (args.bookingNo && win.state.open) win.state.open(args.bookingNo); },
    });
})();

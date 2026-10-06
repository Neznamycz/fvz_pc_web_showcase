// ==========================================
// App: weapons registry (+ ballistic matches from fz_forensics)
// ==========================================
(function () {
    const stChip = s => `<span class="chip st-${s}">${T('wpstatus_' + s)}</span>`;

    Apps.define('weapons', {
        w: 1060, h: 660,
        mount(win, args) {
            const st = win.state = { query: '', status: '', current: null, canEdit: false, canDelete: false, forensics: false };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('we_search')}"></div>
                    <select class="select" data-s style="width:170px"><option value="">${T('ui_all_states')}</option>
                        ${OS.state.config.weaponStatuses.map(s => `<option value="${s}">${T('wpstatus_' + s)}</option>`).join('')}</select><div class="grow"></div>
                    <button class="btn sm hidden" data-a="carried">${icon('download', 'sm')}${T('we_from_inventory')}</button>
                    <button class="btn primary hidden" data-a="new">${icon('plus', 'sm')}${T('we_register')}</button></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail>
                    <div class="empty" style="height:100%;justify-content:center">${icon('weapons')}${T('we_pick')}</div></div></div></div>`;
            $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; load(); }, 300));
            $('[data-s]', win.body).onchange = e => { st.status = e.target.value; load(); };

            async function load() {
                const res = await api('weapons:list', { query: st.query, status: st.status });
                if (res.error) return UI.err(res);
                Object.assign(st, { canEdit: res.canEdit, canDelete: res.canDelete, forensics: res.forensics });
                $('[data-a="new"]', win.body).classList.toggle('hidden', !st.canEdit);
                $('[data-a="carried"]', win.body).classList.toggle('hidden', !st.canEdit);
                $('[data-list]', win.body).innerHTML = res.list.length ? res.list.map(w => `<div class="list-item ${st.current && st.current.id === w.id ? 'active' : ''}" data-id="${w.id}">
                    ${icon('weapons')}<div class="grow"><div class="row between"><span class="t">${esc(w.weapon)}</span>${stChip(w.status)}</div>
                    <div class="s mono">${esc(w.serial)}</div><div class="s">${esc(w.ownerName || T('we_no_owner'))}${w.caseNo ? ` · <span class="mono accent">${esc(w.caseNo)}</span>` : ''}</div></div></div>`).join('')
                    : `<div class="empty">${icon('weapons')}${T('ui_nothing_found')}</div>`;
            }

            async function open(id, silent) {
                const res = await api('weapons:get', { id, refresh: !!silent });
                if (res.error) { if (silent) { st.current = null; $('[data-detail]', win.body).innerHTML = ''; return; } return UI.err(res); }
                const w = st.current = res.weapon;
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', +x.dataset.id === id));
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(w.weapon)}</h2><div class="sub"><span class="mono accent">${esc(w.serial)}</span>${stChip(w.status)}</div></div>
                        <div class="detail-actions">${st.canEdit ? `<button class="btn sm" data-a="edit">${icon('edit', 'sm')}${T('ui_edit')}</button>` : ''}
                        ${st.forensics && OS.can('forensics.edit') && !w.testFired ? `<button class="btn sm" data-a="test">${icon('bullet', 'sm')}${T('we_test_fire')}</button>` : ''}
                        ${st.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body"><div class="card"><div class="kv">
                        <span>${T('f_owner')}</span><span>${esc(w.ownerName || '-')}</span>
                        <span>${T('f_signature')}</span><span class="mono">${esc(w.signature || '-')} ${w.testFired ? `<span class="chip ok">${T('we_in_lab')}</span>` : ''}</span>
                        <span>${T('f_case_no')}</span><span>${w.caseId ? `<a class="mono" data-case="${w.caseId}" style="cursor:pointer">${esc(w.caseNo)}</a>` : '-'}</span>
                        <span>${T('f_registered')}</span><span>${esc(w.registeredBy || '')} · ${fmtDT(w.registeredAt)}</span><span>${T('f_updated')}</span><span>${fmtDT(w.updatedAt)}</span></div>
                        ${w.note ? `<div class="md" style="margin-top:10px"><blockquote>${esc(w.note)}</blockquote></div>` : ''}</div>
                        ${st.forensics ? `<div><div class="section-title">${T('we_ballistic_matches')}<span class="line"></span></div><div class="list">${(w.evidence || []).map(b => `<div class="list-item" data-bag="${esc(b.code)}">
                            ${icon('bullet')}<div class="grow"><div class="t">${esc(b.code)} · ${esc(b.label)}</div><div class="s">${esc(b.location || '')} · ${fmtDate(b.collectedAt)}</div></div></div>`).join('')
                            || `<div class="empty">${T('we_no_matches')}</div>`}</div></div>` : ''}</div>`;
            }

            async function form(w = {}) {
                let owner = w.ownerId ? { id: w.ownerId, name: w.ownerName } : null, caseSel = w.caseId ? { id: w.caseId, caseNo: w.caseNo } : null;
                const v = await UI.modal({
                    title: w.id ? T('we_edit') : T('we_register'), icon: 'weapons',
                    body: `<div class="grid2"><div class="field"><label>${T('f_weapon')}</label><input class="input" id="w-w" maxlength="80" value="${esc(w.weapon || '')}"></div>
                        <div class="field"><label>${T('f_serial')}</label><input class="input mono" id="w-s" maxlength="60" value="${esc(w.serial || '')}"></div></div>
                        <div class="field"><label>${T('f_owner')}</label><div class="row"><input class="input" id="w-o" maxlength="80" value="${esc(w.ownerName || '')}"><button class="btn sm" id="w-op">${icon('user', 'sm')}</button></div></div>
                        <div class="grid2"><div class="field"><label>${T('f_status')}</label><select class="select" id="w-st">${OS.state.config.weaponStatuses.map(s => `<option value="${s}" ${s === (w.status || 'registered') ? 'selected' : ''}>${T('wpstatus_' + s)}</option>`).join('')}</select></div>
                        <div class="field"><label>${T('f_case_no')}</label><div class="row"><span class="chip accent" id="w-c">${esc(w.caseNo || T('ui_no_case'))}</span><button class="btn sm" id="w-cp">${icon('cases', 'sm')}</button></div></div></div>
                        <div class="field"><label>${T('f_note')}</label><textarea class="textarea" id="w-n" maxlength="500">${esc(w.note || '')}</textarea></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                        const weapon = $('#w-w', el).value.trim(), serial = $('#w-s', el).value.trim();
                        if (!weapon || !serial) return false;
                        const ownerName = $('#w-o', el).value.trim();
                        return { id: w.id, weapon, serial, ownerName, ownerId: owner && owner.name === ownerName ? owner.id : null, status: $('#w-st', el).value,
                            caseId: caseSel ? caseSel.id : null, note: $('#w-n', el).value };
                    } }],
                    onOpen(el) {
                        $('#w-op', el).onclick = async () => { const p = await UI.pickCitizen(); if (p) { owner = p; $('#w-o', el).value = p.name; } };
                        $('#w-cp', el).onclick = async () => { const c = await UI.pickCase({ allowNone: true }); if (c) { caseSel = c.id ? c : null; $('#w-c', el).textContent = c.caseNo || T('ui_no_case'); } };
                    },
                });
                if (!v) return;
                const r = await api('weapons:save', v);
                if (r.error) return UI.err(r);
                await load();
                open(r.id);
            }

            win.body.addEventListener('click', async e => {
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const bag = e.target.closest('[data-bag]');
                if (bag) return OS.openApp('forensics', { bag: bag.dataset.bag });
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const w = st.current;
                if (a.dataset.a === 'new') return form();
                if (a.dataset.a === 'edit') return form(w);
                if (a.dataset.a === 'test') {
                    const r = await api('weapons:testFire', { id: w.id });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('we_test_done'), text: r.signature, type: 'success', app: 'weapons' });
                    return open(w.id);
                }
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('we_confirm_delete', esc(w.serial)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('weapons:delete', { id: w.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    return load();
                }
                if (a.dataset.a === 'carried') {
                    const res = await api('weapons:carried');
                    if (res.error) return UI.err(res);
                    const pick = await UI.modal({ title: T('we_from_inventory'), icon: 'weapons',
                        body: `<div class="muted" style="font-size:12px">${T('we_inventory_hint')}</div><div class="pick-list">${res.list.map((x, i) => `<div class="pick-item" data-i="${i}">${icon('weapons')}
                            <div class="grow"><div class="t">${esc(x.label)}</div><div class="s mono muted">${esc(x.serial)}</div></div>${x.knownId ? stChip(x.status) : `<span class="chip">${T('we_unknown')}</span>`}</div>`).join('') || `<div class="empty">${T('we_no_inventory')}</div>`}</div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }],
                        onOpen(el, close) { el.addEventListener('click', ev => { const it2 = ev.target.closest('[data-i]'); if (it2) close(res.list[+it2.dataset.i]); }); } });
                    if (!pick) return;
                    if (pick.knownId) return open(pick.knownId);
                    return form({ weapon: pick.label, serial: pick.serial, status: 'seized' });
                }
            });

            win.state.open = open;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id, true); };
            load().then(() => { if (args && args.id) open(+args.id); });
        },
        onArgs(win, args) { if (args.id) win.state.open(+args.id); },
    });
})();

// ==========================================
// App: warrants & BOLO (request -> judge / supervisor approves)
// ==========================================
(function () {
    const stChip = s => `<span class="chip st-${s}"><span class="dot"></span>${T('wstatus_' + s)}</span>`;

    Apps.define('warrants', {
        w: 1100, h: 700,
        mount(win, args) {
            const canW = OS.can('warrants.view'), canB = OS.can('bolo.view');
            const st = win.state = { kind: canW ? 'warrant' : 'bolo', filter: 'active', mine: false, query: '', current: null };
            win.body.innerHTML = `<div class="app">
                <div class="tabs" data-kinds>${canW ? `<button class="tab" data-kind="warrant">${icon('gavel', 'sm')}${T('wr_warrants')}<span class="n" data-cnt="warrant"></span></button>` : ''}
                    ${canB ? `<button class="tab" data-kind="bolo">${icon('eye', 'sm')}${T('wr_bolo')}<span class="n" data-cnt="bolo"></span></button>` : ''}</div>
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('wr_search')}"></div>
                    <select class="select" data-f style="width:160px"><option value="active">${T('wr_f_active')}</option><option value="pending">${T('wr_f_pending')}</option>
                        <option value="closed">${T('wr_f_closed')}</option><option value="all">${T('ui_all')}</option></select>
                    <label class="check"><input type="checkbox" data-mine>${T('wr_mine')}</label><div class="grow"></div>
                    <button class="btn primary" data-a="new">${icon('plus', 'sm')}<span data-newlbl></span></button></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));
            $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };
            $('[data-mine]', win.body).onchange = e => { st.mine = e.target.checked; load(); };

            function setKind(k) {
                st.kind = k;
                $$('[data-kind]', win.body).forEach(b => b.classList.toggle('on', b.dataset.kind === k));
                const canReq = k === 'bolo' ? OS.can('bolo.create') : OS.can('warrants.request');
                const nb = $('[data-a="new"]', win.body);
                nb.classList.toggle('hidden', !canReq);
                $('[data-newlbl]', win.body).textContent = k === 'bolo' ? T('wr_new_bolo') : T('wr_new_warrant');
                // approvers start with the pending requests
                const approver = k === 'bolo' ? OS.can('bolo.approve') : OS.can('warrants.approve');
                if (approver && st.firstLoad !== false && (OS.badges.warrants || 0) > 0) { st.filter = 'pending'; $('[data-f]', win.body).value = 'pending'; }
                st.firstLoad = false;
                $('[data-detail]', win.body).innerHTML = `<div class="empty" style="height:100%;justify-content:center">${icon(k === 'bolo' ? 'eye' : 'gavel')}${T('wr_pick')}</div>`;
                load();
            }

            async function counts() {
                const c = await api('warrants:counts');
                if (c.error) return;
                ['warrant', 'bolo'].forEach(k => { const el = $(`[data-cnt="${k}"]`, win.body); if (el) { el.textContent = c[k] || ''; el.classList.toggle('hidden', !c[k]); } });
            }

            async function load() {
                const res = await api('warrants:list', { kind: st.kind, status: st.filter, mine: st.mine, query: st.query });
                if (res.error) return UI.err(res);
                $('[data-list]', win.body).innerHTML = res.list.length ? res.list.map(w => `<div class="w-card ${st.current && st.current.id === w.id ? 'on' : ''}" data-id="${w.id}">
                    <div class="photo" ${bg(w.photo)}>${w.photo ? '' : icon(w.type === 'vehicle' ? 'car' : w.type === 'search' ? 'pin' : 'user')}</div>
                    <div class="grow"><div class="row between"><span class="t ellipsis">${esc(w.title)}</span>${stChip(w.status)}</div>
                    <div class="s"><span class="mono">${esc(w.number)}</span> · ${T('wtype_' + w.type)}${w.danger ? ` · <span class="danger-flag">${T('wr_danger')}</span>` : ''}${w.wanted ? ` · <span class="accent">★ ${T('wanted_short')}</span>` : ''}</div>
                    <div class="s">${esc(w.subject || w.plate || w.address || '')}${w.subject && w.plate ? ' · ' + esc(w.plate) : ''} · ${ago(w.requestedAt)}</div></div></div>`).join('')
                    : `<div class="empty">${icon(st.kind === 'bolo' ? 'eye' : 'gavel')}${T('ui_nothing_found')}</div>`;
                counts();
            }

            async function open(id, silent) {
                const res = await api('warrants:get', { id });
                if (res.error) { if (silent) { st.current = null; $('[data-detail]', win.body).innerHTML = ''; return; } return UI.err(res); }
                const w = st.current = res.item;
                if (w.kind !== st.kind) { st.kind = w.kind; $$('[data-kind]', win.body).forEach(b => b.classList.toggle('on', b.dataset.kind === w.kind)); load(); }
                $$('[data-list] .w-card', win.body).forEach(x => x.classList.toggle('on', +x.dataset.id === id));
                win.setTitle(w.number);
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(w.title)}</h2>
                        <div class="sub"><span class="mono accent">${esc(w.number)}</span>${stChip(w.status)}<span>${T('wtype_' + w.type)}</span>
                        ${w.danger ? `<span class="chip bad">${icon('warn', 'sm')}${T('wr_danger')}</span>` : ''}
                        ${w.wanted ? `<span class="chip accent">★ ${T('wanted_short')}${w.reward ? ' · ' + esc(OS.state.config.wantedCurrency || '$') + Number(w.reward).toLocaleString(LOCALE()) : ''}</span>` : ''}</div></div>
                        <div class="detail-actions">
                            ${w.canServe ? `<button class="btn sm ok" data-a="served">${icon('check', 'sm')}${T(w.kind === 'bolo' ? 'wr_resolve' : 'wr_serve')}</button>` : ''}
                            ${w.canRevoke ? `<button class="btn sm" data-a="revoked">${icon('x', 'sm')}${T('wr_revoke')}</button>` : ''}
                            ${w.canWanted ? `<button class="btn sm ${w.wanted ? 'primary' : ''}" data-a="wanted">★ ${w.wanted ? T('wanted_remove') : T('wanted_add')}</button>` : ''}
                            ${w.status === 'approved' && w.wanted ? `<button class="btn sm" data-a="poster">${icon('printer', 'sm')}${T('wanted_poster')}</button>` : ''}
                            <button class="btn sm" data-a="print">${icon('printer', 'sm')}</button>
                            ${w.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body">
                        ${w.canDecide ? `<div class="decision"><div style="font-weight:700">${icon('gavel', 'sm')} ${T('wr_decide_title')}</div>
                            <textarea class="textarea" data-note placeholder="${T('wr_decision_note')}" maxlength="500" style="min-height:60px"></textarea>
                            <div class="row"><button class="btn ok" data-a="approve">${icon('check', 'sm')}${T('wr_approve')}</button>
                            <button class="btn danger" data-a="deny">${icon('x', 'sm')}${T('wr_deny')}</button></div></div>` : ''}
                        <div class="row" style="align-items:flex-start;gap:16px">
                            ${w.photo ? `<div class="photo" style="width:140px;height:170px;flex-shrink:0" ${bg(w.photo)}></div>` : ''}
                            <div class="card grow"><div class="kv">
                                ${w.subject ? `<span>${T('f_subject')}</span><span>${esc(w.subject)}</span>` : ''}
                                ${w.plate ? `<span>${T('f_plate')}</span><span class="mono">${esc(w.plate)}</span>` : ''}
                                ${w.vehicle ? `<span>${T('f_vehicle')}</span><span>${esc(w.vehicle)}</span>` : ''}
                                ${w.address ? `<span>${T('f_address')}</span><span>${esc(w.address)}</span>` : ''}
                                <span>${T('f_case_no')}</span><span>${w.caseId ? `<a class="mono" data-case="${w.caseId}" style="cursor:pointer">${esc(w.caseNo)}</a>` : '-'}</span>
                                <span>${T('f_requested')}</span><span>${esc(w.requestedBy || '')} · ${fmtDT(w.requestedAt)}</span>
                                ${w.decidedBy ? `<span>${T('f_decided')}</span><span>${esc(w.decidedBy)} · ${fmtDT(w.decidedAt)}</span>` : ''}
                                ${w.expiresAt ? `<span>${T('f_expires')}</span><span>${fmtDT(w.expiresAt)}</span>` : ''}
                                ${w.closedBy ? `<span>${T('f_closed')}</span><span>${esc(w.closedBy)} · ${fmtDT(w.closedAt)}</span>` : ''}
                            </div></div></div>
                        ${w.note ? `<div class="card"><div class="card-title">${T('wr_decision_note')}</div><div class="md"><blockquote>${esc(w.note)}</blockquote></div></div>` : ''}
                        ${w.charges.length ? `<div class="card"><div class="card-title">${icon('penal', 'sm')}${T('pr_charges')}</div><table class="tbl"><tbody>${w.charges.map(c => `<tr>
                            <td class="mono accent" style="width:100px">${esc(c.code)}</td><td>${esc(c.label)}</td><td style="width:40px">×${c.count}</td></tr>`).join('')}</tbody></table></div>` : ''}
                        <div class="card"><div class="card-title">${icon('notes', 'sm')}${T(w.kind === 'bolo' ? 'wr_description' : 'wr_reason')}</div><div class="md">${md(w.reason || '-')}</div></div>
                    </div>`;
            }
            win.state.open = open;
            win.state.reload = load;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id, true); };

            async function newRequest() {
                const bolo = st.kind === 'bolo';
                const cfg = OS.state.config;
                let subject = null, charges = [], caseSel = null;
                const types = bolo ? ['person', 'vehicle'] : cfg.warrantTypes;
                const v = await UI.modal({
                    title: bolo ? T('wr_new_bolo') : T('wr_new_warrant'), icon: bolo ? 'eye' : 'gavel', wide: true,
                    body: `<div class="muted" style="font-size:12px">${(bolo ? cfg.boloApproval : cfg.warrantApproval) ? T('wr_needs_approval') : T('wr_no_approval')}</div>
                        <div class="grid2"><div class="field"><label>${T('f_type')}</label><select class="select" id="n-type">${types.map(t => `<option value="${t}">${T('wtype_' + t)}</option>`).join('')}</select></div>
                            <div class="field"><label>${T('f_title')}</label><input class="input" id="n-title" maxlength="120"></div></div>
                        <div class="field"><label>${T('f_subject')}</label><div class="row"><input class="input" id="n-subj" maxlength="80"><button class="btn sm" id="n-pick">${icon('user', 'sm')}${T('ui_pick')}</button></div></div>
                        <div class="grid3"><div class="field"><label>${T('f_plate')}</label><input class="input mono" id="n-plate" maxlength="16"></div>
                            <div class="field"><label>${T('f_vehicle')}</label><input class="input" id="n-veh" maxlength="80"></div>
                            <div class="field"><label>${T('f_address')}</label><input class="input" id="n-addr" maxlength="120"></div></div>
                        ${bolo ? `<div class="field"><label>${T('f_photo_url')}</label><input class="input" id="n-photo" maxlength="512" placeholder="https://"></div>`
                            : `<div class="field"><label>${T('pr_charges')}</label><div class="pick-tags" id="n-ch"></div><button class="btn sm" id="n-chadd" style="align-self:flex-start">${icon('plus', 'sm')}${T('pr_from_penal')}</button></div>`}
                        <div class="field"><label>${T(bolo ? 'wr_description' : 'wr_reason')}</label><textarea class="textarea" id="n-reason" maxlength="3000"></textarea></div>
                        <div class="row"><label class="check"><input type="checkbox" id="n-danger">${T('wr_danger_flag')}</label><div class="grow"></div>
                            <span class="chip accent" id="n-case">${T('ui_no_case')}</span><button class="btn sm" id="n-casepick">${icon('cases', 'sm')}${T('ui_pick')}</button></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('wr_submit'), cls: 'primary', collect: el => {
                        const title = $('#n-title', el).value.trim();
                        if (!title) return false;
                        const subjText = $('#n-subj', el).value.trim();
                        return {
                            kind: st.kind, type: $('#n-type', el).value, title, subject: subjText || null,
                            subjectId: subject && subject.name === subjText ? subject.id : null,
                            plate: $('#n-plate', el).value.trim(), vehicle: $('#n-veh', el).value.trim(), address: $('#n-addr', el).value.trim(),
                            reason: $('#n-reason', el).value, danger: $('#n-danger', el).checked, caseId: caseSel ? caseSel.id : null,
                            charges: charges.map(c => ({ id: c.id, count: c.count })),
                            photo: bolo ? ($('#n-photo', el).value.trim() || (subject && subject.photo) || null) : (subject && subject.photo) || null,
                        };
                    } }],
                    onOpen(el) {
                        $('#n-pick', el).onclick = async () => {
                            const p = await UI.pickCitizen();
                            if (p) { subject = p; $('#n-subj', el).value = p.name; }
                        };
                        $('#n-casepick', el).onclick = async () => {
                            const c = await UI.pickCase({ allowNone: true });
                            if (c) { caseSel = c.id ? c : null; $('#n-case', el).textContent = c.caseNo || T('ui_no_case'); }
                        };
                        const add = $('#n-chadd', el);
                        if (add) {
                            const paint = () => { $('#n-ch', el).innerHTML = charges.map((c, i) => `<span class="chip accent" data-rm="${i}">${esc(c.code)} ×${c.count} ✕</span>`).join(''); };
                            add.onclick = async () => { const p = await UI.pickCharges(charges); if (p) { charges = p; paint(); } };
                            el.addEventListener('click', ev => { const rm = ev.target.closest('[data-rm]'); if (rm) { charges.splice(+rm.dataset.rm, 1); paint(); } });
                        }
                    },
                });
                if (!v) return;
                const r = await api('warrants:request', v);
                if (r.error) return UI.err(r);
                OS.toast({ title: r.status === 'pending' ? T('wr_sent') : T('wr_active'), text: r.number, type: 'success', app: 'warrants' });
                await load();
                open(r.id);
            }

            win.body.addEventListener('click', async e => {
                const k = e.target.closest('[data-kind]');
                if (k) return setKind(k.dataset.kind);
                const c = e.target.closest('[data-list] .w-card');
                if (c) return open(+c.dataset.id);
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const w = st.current;
                const act = a.dataset.a;
                if (act === 'new') return newRequest();
                if (act === 'print') return UI.print({ type: 'warrant', id: w.id }, w.number);
                if (act === 'poster') return UI.print({ type: 'wanted', id: w.id }, T('wanted_poster'));
                if (act === 'wanted') {
                    let reward = 0;
                    if (!w.wanted) {
                        const v = await UI.prompt(T('wanted_add'), String(w.reward || ''), { label: T('wanted_reward_hint'), ok: T('wanted_add') });
                        if (v === null) return;
                        reward = Math.max(0, parseInt(v, 10) || 0);
                    }
                    const r = await api('warrants:wanted', { id: w.id, on: !w.wanted, reward });
                    if (r.error) return UI.err(r);
                    await load();
                    return open(w.id);
                }
                if (act === 'approve' || act === 'deny') {
                    const note = $('[data-note]', win.body).value;
                    const r = await api('warrants:decide', { id: w.id, approve: act === 'approve', note });
                    if (r.error) return UI.err(r);
                    OS.refreshBadges();
                    await load();
                    return open(w.id);
                }
                if (act === 'served' || act === 'revoked') {
                    if (!(await UI.confirm(T(act === 'served' ? 'wr_confirm_served' : 'wr_confirm_revoke')))) return;
                    const r = await api('warrants:close', { id: w.id, action: act });
                    if (r.error) return UI.err(r);
                    await load();
                    return open(w.id);
                }
                if (act === 'delete') {
                    if (!(await UI.confirm(T('wr_confirm_delete', esc(w.number)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('warrants:delete', { id: w.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    $('[data-detail]', win.body).innerHTML = '';
                    return load();
                }
            });

            setKind(st.kind);
            if (args && (args.id || args.ref)) open(+(args.id || args.ref));
        },
        onArgs(win, args) { if (args.id || args.ref) win.state.open(+(args.id || args.ref)); },
        onNotify(win) { if (win.state.reload) win.state.reload(); },
    });
})();

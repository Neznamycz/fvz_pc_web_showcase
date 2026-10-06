// ==========================================
// App: forensic database (fz_forensics) - profiles, evidence bags + protocols, ballistics
// ==========================================
(function () {
    const BAG_TYPES = ['casing', 'bullet', 'blood', 'print', 'gsr', 'reference'];
    const bagChip = s => `<span class="chip ${s === 'done' ? 'ok' : s === 'analyzing' ? 'info' : 'warn'}"><span class="dot"></span>${T('bag_status_' + s)}</span>`;

    // Lab protocol (structure of fz_forensics Reports.Build)
    function report(rep) {
        if (!rep) return '';
        const rows = s => (s.rows || []).map(r => `<div class="r-row"><span>${esc(r.k)}</span><span class="${esc(r.tone || '')}">${esc(r.v)}</span></div>`).join('');
        return `<div class="rep">
            <h4>${esc(rep.lab || T('ui_forensic_lab'))}</h4><h3>${T('ui_lab_report')} · <span class="mono">${esc(rep.code)}</span></h3>
            <div class="r-row"><span>${T('f_item')}</span><span>${esc(rep.label)}</span></div>
            <div class="r-row"><span>${T('f_place')}</span><span>${esc(rep.location || '-')}${rep.detail ? ' · ' + esc(rep.detail) : ''}</span></div>
            <div class="r-row"><span>${T('f_collected')}</span><span>${fmtDT(rep.collectedAt)} · ${esc(rep.collectedBy || '')}</span></div>
            <div class="r-row"><span>${T('f_analyzed')}</span><span>${fmtDT(rep.analyzedAt)}</span></div>
            ${(rep.sections || []).map(s => `<div class="r-sec"><b>${esc(s.title)}</b>${rows(s)}${s.note ? `<div style="font-size:11px;color:#5b6470;margin-top:4px">${esc(s.note)}</div>` : ''}</div>`).join('')}
            ${rep.persons && rep.persons.length ? `<div class="r-persons">${rep.persons.map(p => `<div><i ${bg(p.photo)}></i>${esc(p.name)}</div>`).join('')}</div>` : ''}
            ${rep.conclusion ? `<div class="r-concl ${esc(rep.conclusion.tone || '')}">${esc(rep.conclusion.text)}</div>` : ''}
            ${rep.links && rep.links.length ? `<div class="r-sec"><b>${T('ui_linked_evidence')}</b>${rep.links.map(l => `<div class="r-row" data-bag="${esc(l.code)}" style="cursor:pointer">
                <span class="mono">${esc(l.code)}</span><span>${esc(l.label || '')} · ${esc(l.location || '')} · ${fmtDate(l.at)}</span></div>`).join('')}</div>` : ''}
        </div>`;
    }

    function bagRow(b) {
        return `<div class="list-item" data-bag="${esc(b.code)}">${icon(b.type === 'blood' || b.type === 'reference' ? 'dna' : b.type === 'print' ? 'forensics' : b.type === 'gsr' ? 'warn' : 'bullet')}
            <div class="grow"><div class="t">${esc(b.code)} · ${esc(b.label)}</div><div class="s">${esc(b.typeLabel || b.type)} · ${esc(b.location || '-')} · ${fmtDate(b.collectedAt)}</div>
            ${b.summary ? `<div class="s ok ellipsis">${esc(b.summary)}</div>` : ''}</div>${bagChip(b.status)}</div>`;
    }

    Apps.define('forensics', {
        w: 1120, h: 700,
        mount(win, args) {
            const st = win.state = { view: 'profiles', query: '', status: '', type: '', current: null };
            win.body.innerHTML = `<div class="app"><div class="app-body">
                <div class="app-side">
                    <div class="side-title">${T('ui_database')}</div>
                    <button class="side-item on" data-view="profiles">${icon('user')}${T('fx_profiles')}</button>
                    <button class="side-item" data-view="bags">${icon('bag')}${T('fx_evidence')}</button>
                    <button class="side-item" data-view="ballistics">${icon('bullet')}${T('fx_ballistics')}</button>
                </div>
                <div class="app-list" style="display:flex;flex-direction:column">
                    <div class="app-toolbar" style="flex-wrap:wrap"><div class="search" style="width:100%">${icon('search')}<input class="input" data-q></div><div class="row" data-filters style="width:100%"></div></div>
                    <div class="app-scroll" data-list></div></div>
                <div class="app-detail" data-detail></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));

            function setView(v) {
                st.view = v;
                st.query = '';
                q.value = '';
                $$('[data-view]', win.body).forEach(b => b.classList.toggle('on', b.dataset.view === v));
                q.placeholder = T(v === 'profiles' ? 'fx_search_profiles' : v === 'bags' ? 'fx_search_bags' : 'fx_search_ballistics');
                $('[data-filters]', win.body).innerHTML = v === 'bags' ? `
                    <select class="select" data-status><option value="">${T('ui_all_states')}</option>${['sealed', 'analyzing', 'done'].map(s => `<option value="${s}">${T('bag_status_' + s)}</option>`).join('')}</select>
                    <select class="select" data-type><option value="">${T('ui_all_types')}</option>${BAG_TYPES.map(t => `<option value="${t}">${T('bag_type_' + t)}</option>`).join('')}</select>`
                    : v === 'ballistics' && OS.can('forensics.edit') ? `<button class="btn sm" data-a="regBallistic">${icon('plus', 'sm')}${T('fx_register_weapon')}</button>` : '';
                const sSel = $('[data-status]', win.body), tSel = $('[data-type]', win.body);
                if (sSel) sSel.onchange = () => { st.status = sSel.value; load(); };
                if (tSel) tSel.onchange = () => { st.type = tSel.value; load(); };
                $('[data-detail]', win.body).innerHTML = `<div class="empty" style="height:100%;justify-content:center">${icon('forensics')}${T('fx_pick')}</div>`;
                load();
            }

            async function load() {
                const list = $('[data-list]', win.body);
                list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                if (st.view === 'profiles') {
                    const res = await api('forensics:profiles', { query: st.query });
                    if (res.error) return (list.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                    list.innerHTML = res.profiles.length ? res.profiles.map(p => `<div class="list-item" data-profile="${esc(p.dna)}">
                        <div class="avatar" ${bg(p.photo)}>${p.photo ? '' : (p.known ? initials(p.name) : '?')}</div>
                        <div class="grow"><div class="t">${esc(p.known ? p.name : T('fx_unknown'))}</div><div class="s mono">${esc(p.dna)} · ${esc(p.fingerprint)}</div></div>
                        <div class="col" style="gap:3px;align-items:flex-end">${p.dnaRegistered ? '<span class="chip ok">DNA</span>' : ''}${p.fingerprintRegistered ? '<span class="chip ok">FP</span>' : ''}</div></div>`).join('')
                        : `<div class="empty">${icon('user')}${T('ui_nothing_found')}</div>`;
                } else if (st.view === 'bags') {
                    const res = await api('forensics:bags', { query: st.query, status: st.status, type: st.type });
                    if (res.error) return (list.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                    list.innerHTML = res.bags.length ? res.bags.map(bagRow).join('') : `<div class="empty">${icon('bag')}${T('ui_nothing_found')}</div>`;
                } else {
                    const res = await api('forensics:ballistics', { query: st.query });
                    if (res.error) return (list.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                    list.innerHTML = res.list.length ? res.list.map(b => `<div class="list-item" data-sig="${esc(b.signature)}">${icon('weapons')}
                        <div class="grow"><div class="t">${esc(b.weapon)}</div><div class="s mono">${esc(b.signature)} · ${esc(b.serial || T('fx_no_serial'))}</div>
                        <div class="s">${esc(b.registeredBy || '')} · ${fmtDate(b.registeredAt)}</div></div>${b.links ? `<span class="chip accent">${b.links} ${T('ui_links')}</span>` : ''}</div>`).join('')
                        : `<div class="empty">${icon('bullet')}${T('ui_nothing_found')}</div>`;
                }
            }

            async function openProfile(key, silent) {
                const res = await api('forensics:profile', { key, refresh: !!silent });
                if (res.error) return silent ? null : UI.err(res);
                const p = res.profile;
                st.current = { kind: 'profile', key, data: res };
                const ev = res.evidence || {};
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(p.known ? p.name : T('fx_unknown'))}</h2>
                        <div class="sub">${p.registered ? `<span class="chip ok">${T('fx_registered')}</span>` : `<span class="chip warn">${T('fx_not_registered')}</span>`}
                        ${p.registeredBy ? `<span>${esc(p.registeredBy)} · ${fmtDate(p.registeredAt)}</span>` : ''}</div></div>
                        <div class="detail-actions">${res.canDelete ? `<button class="btn sm danger" data-a="unregister">${icon('trash', 'sm')}${T('fx_unregister')}</button>` : ''}</div></div>
                    <div class="detail-body">
                        <div class="profile-card"><div class="photo" ${bg(p.photo)}>${p.photo ? '' : icon('user', 'lg')}</div>
                            <div class="card grow"><div class="kv">
                                <span>${T('f_dna')}</span><span class="mono">${esc(p.dna)} ${p.dnaRegistered ? '<span class="chip ok">✓</span>' : ''}</span>
                                <span>${T('f_fingerprint')}</span><span class="mono">${esc(p.fingerprint)} ${p.fingerprintRegistered ? '<span class="chip ok">✓</span>' : ''}</span>
                                <span>${T('f_blood_type')}</span><span>${esc(p.bloodType || '-')}</span>
                                ${p.photoAt ? `<span>${T('f_photo')}</span><span>${fmtDate(p.photoAt)}</span>` : ''}</div></div></div>
                        <div><div class="section-title">${T('fx_dna_matches')}<span class="line"></span></div><div class="list">${(ev.dna || []).map(bagRow).join('') || `<div class="empty">-</div>`}</div></div>
                        <div><div class="section-title">${T('fx_fp_matches')}<span class="line"></span></div><div class="list">${(ev.fp || []).map(bagRow).join('') || `<div class="empty">-</div>`}</div></div>
                        ${res.bookings ? `<div><div class="section-title">${T('tab_bookings')}<span class="line"></span></div><div class="list">${res.bookings.map(b => `<div class="list-item" data-booking="${esc(b.bookingNo)}">
                            <div class="avatar" ${bg(b.photo)}></div><div class="grow"><div class="t mono">${esc(b.bookingNo)}</div><div class="s">${fmtDate(b.createdAt)} · ${esc(b.firstCharge || '')}</div></div></div>`).join('') || `<div class="empty">-</div>`}</div></div>` : ''}
                    </div>`;
            }

            async function openBag(code, silent) {
                const res = await api('forensics:bag', { code, refresh: !!silent });
                if (res.error) return silent ? null : UI.err(res);
                const b = res.bag;
                st.current = { kind: 'bag', code, data: b };
                win.setTitle(b.code);
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(b.label)}</h2>
                        <div class="sub"><span class="mono accent">${esc(b.code)}</span>${bagChip(b.status)}<span>${esc(b.typeLabel || b.type)}</span>
                        ${b.contaminated ? `<span class="chip bad">${T('fx_contaminated')}</span>` : ''}</div></div>
                        <div class="detail-actions">
                            ${b.canEdit ? `<button class="btn sm" data-a="note">${icon('edit', 'sm')}${T('fx_note')}</button><button class="btn sm" data-a="toCase">${icon('cases', 'sm')}${T('ui_to_case')}</button>` : ''}
                            ${b.report ? `<button class="btn sm" data-a="printReport">${icon('printer', 'sm')}${T('fx_print_report')}</button>` : ''}
                        </div></div>
                    <div class="detail-body">
                        <div class="grid2"><div class="card"><div class="kv">
                            <span>${T('f_place')}</span><span>${esc(b.location || '-')}</span>
                            ${b.detail ? `<span>${T('f_detail')}</span><span>${esc(b.detail)}</span>` : ''}
                            <span>${T('f_collected')}</span><span>${fmtDT(b.collectedAt)}</span><span>${T('f_by')}</span><span>${esc(b.collectedBy || '-')}</span>
                            <span>${T('f_holder')}</span><span>${esc(b.holderLabel || T('holder_' + (b.holderType || 'player')))}</span></div>
                            ${b.note ? `<div class="md" style="margin-top:10px"><blockquote>${esc(b.note)}</blockquote></div>` : ''}</div>
                            <div class="card"><div class="card-title">${icon('cases', 'sm')}${T('ui_cases')}</div>
                            ${(b.cases || []).map(c => `<div class="list-item" data-case="${c.id}" style="padding:6px 4px">${icon('folder', 'sm')}<span class="mono">${esc(c.caseNo)}</span><span class="grow ellipsis">${esc(c.title)}</span></div>`).join('') || `<span class="dim">${T('ui_no_case')}</span>`}</div></div>
                        ${b.report ? report(b.report) : `<div class="card"><span class="muted">${T('fx_no_report')}</span></div>`}
                        <div><div class="section-title">${T('fx_custody')}<span class="line"></span></div><div class="timeline">${(b.custody || []).map(c => `<div class="tl-item ${c.action === 'unrecorded' ? 'warn' : ''}">
                            <div class="tl-dot"></div><div><div class="t">${esc(c.label)}</div><div class="s">${fmtDT(c.t)} · ${esc(c.by || '')}${c.note ? ' · ' + esc(c.note) : ''}</div></div></div>`).join('')}</div></div>
                    </div>`;
            }

            async function openSig(sig) {
                const res = await api('forensics:links', { kind: 'sig', value: sig });
                if (res.error) return UI.err(res);
                st.current = { kind: 'sig', sig };
                $('[data-detail]', win.body).innerHTML = `<div class="detail-head"><div class="grow"><h2 class="mono">${esc(sig)}</h2><div class="sub">${T('fx_sig_matches')}</div></div></div>
                    <div class="detail-body"><div class="list">${res.bags.map(bagRow).join('') || `<div class="empty">${T('fx_no_matches')}</div>`}</div></div>`;
            }
            win.state.openBag = openBag;
            win.state.openProfile = openProfile;
            win.refresh = async () => {
                await load();
                const c = st.current;
                if (!c) return;
                if (c.kind === 'profile') openProfile(c.key, true);
                if (c.kind === 'bag') openBag(c.code, true);
                if (c.kind === 'sig') openSig(c.sig);
            };

            win.body.addEventListener('click', async e => {
                const v = e.target.closest('[data-view]');
                if (v) return setView(v.dataset.view);
                const pr = e.target.closest('[data-profile]');
                if (pr) return openProfile(pr.dataset.profile);
                const bg_ = e.target.closest('[data-bag]');
                if (bg_) return openBag(bg_.dataset.bag);
                const sg = e.target.closest('[data-sig]');
                if (sg) return openSig(sg.dataset.sig);
                const bk = e.target.closest('[data-booking]');
                if (bk) return OS.openApp('prisoners', { bookingNo: bk.dataset.booking });
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const cur = st.current;
                if (a.dataset.a === 'note') {
                    const note = await UI.prompt(T('fx_note'), cur.data.note || '', { max: 200 });
                    if (note === null) return;
                    const r = await api('forensics:note', { code: cur.code, note });
                    if (r.error) return UI.err(r);
                    openBag(cur.code);
                } else if (a.dataset.a === 'toCase') {
                    const c = await UI.pickCase();
                    if (!c) return;
                    const r = await api('forensics:toCase', { code: cur.code, caseId: c.id });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('ui_linked'), text: c.caseNo, type: 'success', app: 'cases' });
                    openBag(cur.code);
                } else if (a.dataset.a === 'printReport') {
                    UI.print({ type: 'bag', code: cur.code }, cur.code);
                } else if (a.dataset.a === 'unregister') {
                    if (!(await UI.confirm(T('fx_confirm_unregister'), { danger: true, ok: T('fx_unregister') }))) return;
                    const r = await api('forensics:unregister', { key: cur.key });
                    if (r.error) return UI.err(r);
                    openProfile(cur.key);
                } else if (a.dataset.a === 'regBallistic') {
                    const v = await UI.modal({
                        title: T('fx_register_weapon'), icon: 'weapons',
                        body: `<div class="muted" style="font-size:12px">${T('fx_register_hint')}</div>
                            <div class="field"><label>${T('f_weapon')}</label><input class="input" id="rb-w" maxlength="60" placeholder="Pistol .50"></div>
                            <div class="field"><label>${T('f_serial')}</label><input class="input mono" id="rb-s" maxlength="60"></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                            const w = $('#rb-w', el).value.trim(), s = $('#rb-s', el).value.trim();
                            return w && s ? { weapon: w, serial: s } : false;
                        } }],
                    });
                    if (!v) return;
                    const r = await api('forensics:registerBallistic', v);
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('fx_registered_sig'), text: r.signature, type: 'success', app: 'forensics' });
                    load();
                }
            });

            setView(args && args.bag ? 'bags' : 'profiles');
            if (args && args.bag) openBag(args.bag);
            if (args && args.profile) openProfile(args.profile);
        },
        onArgs(win, args) {
            if (args.bag) win.state.openBag(args.bag);
            if (args.profile) win.state.openProfile(args.profile);
        },
    });
})();

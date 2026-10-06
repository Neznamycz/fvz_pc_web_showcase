// ==========================================
// App: Internal Affairs - file a complaint, my results (only the result), investigations (ia.view)
// ==========================================
(function () {
    const stChip = s => `<span class="chip ${s === 'closed' ? 'ok' : s === 'new' ? 'bad' : 'warn'}">${T('ia_status_' + s)}</span>`;
    const resChip = r => r ? `<span class="chip ${r === 'sustained' ? 'bad' : 'ok'}">${T('ia_res_' + r)}</span>` : '';

    Apps.define('ia', {
        w: 1100, h: 700,
        mount(win, args) {
            const cfg = OS.state.config.ia || { categories: [], results: [], actions: [] };
            const canView = OS.can('ia.view'), canFile = OS.can('ia.file');
            const st = win.state = { tab: canView ? 'cases' : (canFile ? 'file' : 'results'), filter: 'open', query: '', current: null, mine: false };
            const tabs = [];
            if (canView) tabs.push(['cases', 'shield', T('ia_tab_cases')]);
            if (canFile) tabs.push(['file', 'warn', T('ia_tab_file')]);
            tabs.push(['results', 'user', T('ia_tab_results')]);
            win.body.innerHTML = `<div class="app"><div class="tabs">${tabs.map(([id, ic, l]) => `<button class="tab" data-tab="${id}">${icon(ic, 'sm')}${l}</button>`).join('')}</div>
                <div data-view style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>`;

            // ---------- file ----------
            async function fileView() {
                const r = await api('ia:mine');
                if (r.error) return UI.err(r);
                let officer = null;
                $('[data-view]', win.body).innerHTML = `<div class="app-scroll"><div class="pad col">
                    <div class="pub-note">${icon('shield', 'sm')}${T('ia_file_hint')}</div>
                    <div class="grid2"><div class="field"><label>${T('ia_subject')}</label><div class="row"><span class="chip accent" data-off>-</span><button class="btn sm" data-a="pickOff">${icon('user', 'sm')}${T('ui_pick')}</button></div></div>
                        <div class="field"><label>${T('pub_f_category')}</label><select class="select" data-cat>${cfg.categories.map(c => `<option value="${c}">${T('ia_cat_' + c)}</option>`).join('')}</select></div></div>
                    <div class="grid2"><div class="field"><label>${T('pub_f_title')}</label><input class="input" data-title maxlength="160"></div>
                        <div class="field"><label>${T('pub_f_when')}</label><input class="input" data-when maxlength="80"></div></div>
                    <div class="field"><label>${T('f_description')}</label><textarea class="textarea" data-desc maxlength="6000" style="min-height:140px"></textarea></div>
                    <div class="row"><button class="btn primary" data-a="file">${icon('send', 'sm')}${T('ia_file_btn')}</button></div>
                    <div class="section-title">${T('ia_my_filed')}<span class="line"></span></div>
                    ${r.filed.length ? `<table class="tbl"><tbody>${r.filed.map(x => `<tr><td class="mono">${esc(x.number)}</td><td>${esc(x.subject_name)}</td><td>${esc(x.title)}</td>
                        <td>${stChip(x.status)}</td><td class="dim">${fmtDate(x.created_at)}</td></tr>`).join('')}</tbody></table>` : `<div class="dim">-</div>`}</div></div>`;
                st.pickOfficer = p => { officer = p; $('[data-off]', win.body).textContent = p.name; };
                st.fileData = () => officer ? { subjectId: officer.id, subjectName: officer.name, category: $('[data-cat]', win.body).value,
                    title: $('[data-title]', win.body).value.trim(), occurred: $('[data-when]', win.body).value.trim(), description: $('[data-desc]', win.body).value } : null;
            }

            // ---------- my results ----------
            async function resultsView() {
                const r = await api('ia:mine');
                if (r.error) return UI.err(r);
                $('[data-view]', win.body).innerHTML = `<div class="app-scroll"><div class="pad col"><div class="muted" style="font-size:12px">${T('ia_results_hint')}</div>
                    ${r.about.length ? r.about.map(x => `<div class="card"><div class="row between"><b class="mono">${esc(x.number)}</b><span class="dim">${fmtDate(x.closed_at)}</span></div>
                        <div class="row" style="margin-top:6px">${resChip(x.result)}<span class="chip">${T('ia_act_' + (x.action || 'none'))}</span><span class="dim">${T('ia_cat_' + x.category)}</span></div>
                        ${x.result_note ? `<div class="md" style="margin-top:6px">${md(x.result_note)}</div>` : ''}</div>`).join('') : `<div class="empty">${icon('shield')}${T('ia_no_results')}</div>`}</div></div>`;
            }

            // ---------- investigations ----------
            function casesView() {
                $('[data-view]', win.body).innerHTML = `<div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q value="${esc(st.query)}" placeholder="${T('ia_search')}"></div>
                    <select class="select" data-f style="width:150px">${['open', 'closed', 'all'].map(f => `<option value="${f}" ${st.filter === f ? 'selected' : ''}>${T('ia_f_' + f)}</option>`).join('')}</select>
                    <label class="check"><input type="checkbox" data-mine ${st.mine ? 'checked' : ''}>${T('ia_assigned_me')}</label></div>
                    <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail><div class="empty" style="height:100%;justify-content:center">${icon('shield')}${T('ia_pick')}</div></div></div>`;
                const q = $('[data-q]', win.body);
                q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));
                $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };
                $('[data-mine]', win.body).onchange = e => { st.mine = e.target.checked; load(); };
                load().then(() => { if (st.current) open(st.current.id, true); });
            }

            async function load() {
                const r = await api('ia:list', { status: st.filter, query: st.query, mine: st.mine });
                if (r.error) return UI.err(r);
                const box = $('[data-list]', win.body);
                if (!box) return;
                box.innerHTML = r.list.map(x => `<div class="list-item ${st.current && st.current.id === x.id ? 'active' : ''}" data-id="${x.id}">${icon('shield')}
                    <div class="grow"><div class="row between"><span class="t ellipsis">${esc(x.subject.name)}</span>${stChip(x.status)}</div>
                    <div class="s"><span class="mono">${esc(x.number)}</span> · ${T('ia_cat_' + x.category)} · ${T('ia_src_' + x.source)}</div><div class="s ellipsis">${esc(x.title)}</div></div></div>`).join('')
                    || `<div class="empty">${icon('shield')}${T('ui_nothing_found')}</div>`;
            }

            async function open(id, silent) {
                const r = await api('ia:get', { id, refresh: !!silent });
                if (r.error) return silent ? null : UI.err(r);
                const x = st.current = r.item;
                win.setTitle(x.number);
                $$('[data-list] .list-item', win.body).forEach(el => el.classList.toggle('active', +el.dataset.id === id));
                const closed = x.status === 'closed';
                $('[data-detail]', win.body).innerHTML = `<div class="detail-head"><div class="grow"><h2>${esc(x.subject.name)}</h2>
                    <div class="sub"><span class="mono accent">${esc(x.number)}</span>${stChip(x.status)}<span>${T('ia_cat_' + x.category)}</span><span class="chip">${T('ia_src_' + x.source)}</span>${resChip(x.result)}</div></div>
                    <div class="detail-actions">${x.can.manage ? `<button class="btn sm" data-a="assign">${icon('users', 'sm')}${T('ui_assign')}</button>
                        ${closed ? `<button class="btn sm" data-a="reopen">${icon('refresh', 'sm')}${T('ia_reopen')}</button>` : `<button class="btn sm primary" data-a="close">${icon('gavel', 'sm')}${T('ia_close')}</button>`}
                        <button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body">
                        <div class="grid2"><div class="card"><div class="kv">
                            <span>${T('ia_complainant')}</span><span>${esc(x.complainant.name || '-')}${x.complainant.contact ? ' · ' + esc(x.complainant.contact) : ''}</span>
                            <span>${T('pub_f_when')}</span><span>${esc(x.occurred || '-')}</span>
                            <span>${T('ia_investigator')}</span><span>${esc(x.assigned ? x.assigned.name : '-')}</span>
                            <span>${T('f_date')}</span><span>${fmtDT(x.createdAt)}</span>
                            ${closed ? `<span>${T('ia_closed_by')}</span><span>${esc(x.closedBy || '')} · ${fmtDT(x.closedAt)}</span><span>${T('ia_action')}</span><span>${T('ia_act_' + (x.action || 'none'))}</span>` : ''}</div></div>
                            <div class="card"><div class="card-title">${icon('list', 'sm')}${T('ia_history')}</div>${x.history.map(h => `<div class="row between" style="padding:2px 0"><a class="mono" data-open="${h.id}" style="cursor:pointer">${esc(h.number)}</a>
                                <span class="dim">${T('ia_cat_' + h.category)}</span>${h.result ? resChip(h.result) : stChip(h.status)}</div>`).join('') || `<span class="dim">${T('ia_no_history')}</span>`}</div></div>
                        <div class="card"><div class="card-title">${esc(x.title)}</div><div class="md">${md(x.description || '-')}</div></div>
                        ${closed && x.resultNote ? `<div class="card"><div class="card-title">${T('ia_result_note')}</div><div class="md">${md(x.resultNote)}</div></div>` : ''}
                        <div class="card"><div class="card-title">${icon('notes', 'sm')}${T('ia_findings')}</div>
                            ${x.can.edit ? `<textarea class="textarea" data-findings maxlength="8000" style="min-height:120px">${esc(x.findings || '')}</textarea>
                            <button class="btn sm" data-a="findings" style="align-self:flex-start;margin-top:6px">${icon('check', 'sm')}${T('ui_save')}</button>` : `<div class="md">${md(x.findings || '-')}</div>`}</div>
                        <div class="card"><div class="card-title">${icon('chat', 'sm')}${T('ia_notes')}</div>
                            ${x.notes.map(n => `<div class="ia-note"><b>${esc(n.author_name || '')}</b><span class="dim">${fmtDT(n.created_at)}</span><div class="md">${md(n.body)}</div></div>`).join('') || `<span class="dim">-</span>`}
                            <div class="row" style="margin-top:8px"><input class="input" data-note maxlength="4000" placeholder="${T('ia_note_ph')}"><button class="btn" data-a="note">${icon('send', 'sm')}</button></div></div>
                    </div>`;
                const ni = $('[data-note]', win.body);
                if (ni) ni.onkeydown = e => { if (e.key === 'Enter') addNote(); };
            }

            async function addNote() {
                const inp = $('[data-note]', win.body);
                const body = inp.value.trim();
                if (!body) return;
                const r = await api('ia:note', { id: st.current.id, body });
                if (r.error) return UI.err(r);
                open(st.current.id, true);
            }

            function setTab(t) {
                st.tab = t;
                $$('[data-tab]', win.body).forEach(b => b.classList.toggle('on', b.dataset.tab === t));
                if (t === 'cases') casesView(); else if (t === 'file') fileView(); else resultsView();
            }
            win.refresh = () => { if (st.tab !== 'file') setTab(st.tab); };
            win.state.open = id => { if (!canView) return setTab('results'); if (st.tab !== 'cases') setTab('cases'); open(id); };

            win.body.addEventListener('click', async e => {
                const tab = e.target.closest('[data-tab]');
                if (tab) return setTab(tab.dataset.tab);
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const op = e.target.closest('[data-open]');
                if (op) return open(+op.dataset.open);
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const x = st.current;
                if (a.dataset.a === 'pickOff') { const p = await UI.pickOfficer({ title: T('ia_subject') }); if (p) st.pickOfficer(p); return; }
                if (a.dataset.a === 'file') {
                    const v = st.fileData();
                    if (!v || !v.title) return UI.toast(T('pub_fill'), 'error');
                    if (!(await UI.confirm(T('ia_confirm_file', esc(v.subjectName))))) return;
                    const r = await api('ia:file', v);
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('ia_filed'), text: r.number, type: 'success', app: 'ia' });
                    return fileView();
                }
                if (a.dataset.a === 'note') return addNote();
                if (a.dataset.a === 'findings') {
                    const r = await api('ia:findings', { id: x.id, findings: $('[data-findings]', win.body).value });
                    if (r.error) return UI.err(r);
                    return OS.toast({ title: T('ui_saved'), type: 'success', app: 'ia' });
                }
                if (a.dataset.a === 'assign') {
                    const p = await UI.pickOfficer({ title: T('ia_investigator') });
                    if (!p) return;
                    const r = await api('ia:assign', { id: x.id, officer: p.id });
                    if (r.error) return UI.err(r);
                    return open(x.id);
                }
                if (a.dataset.a === 'close') {
                    const v = await UI.modal({ title: T('ia_close') + ' · ' + esc(x.number), icon: 'gavel', wide: true,
                        body: `<div class="grid2"><div class="field"><label>${T('ia_result')}</label><select class="select" id="ic-r">${cfg.results.map(r => `<option value="${r}">${T('ia_res_' + r)}</option>`).join('')}</select></div>
                            <div class="field"><label>${T('ia_action')}</label><select class="select" id="ic-a">${cfg.actions.map(r => `<option value="${r}">${T('ia_act_' + r)}</option>`).join('')}</select></div></div>
                            <div class="field"><label>${T('ia_result_note')}</label><textarea class="textarea" id="ic-n" maxlength="500"></textarea><div class="dim" style="font-size:11px">${T('ia_result_note_hint')}</div></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ia_close'), cls: 'primary', collect: el => ({
                            result: $('#ic-r', el).value, action: $('#ic-a', el).value, resultNote: $('#ic-n', el).value,
                            findings: $('[data-findings]', win.body) ? $('[data-findings]', win.body).value : undefined }) }] });
                    if (!v) return;
                    const r = await api('ia:close', { id: x.id, ...v });
                    if (r.error) return UI.err(r);
                    await load();
                    return open(x.id);
                }
                if (a.dataset.a === 'reopen') {
                    const r = await api('ia:reopen', { id: x.id });
                    if (r.error) return UI.err(r);
                    return open(x.id);
                }
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('ia_confirm_delete', esc(x.number)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('ia:delete', { id: x.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    return casesView();
                }
            });

            setTab(st.tab);
            if (args && (args.id || args.ref)) win.state.open(+(args.id || args.ref));
        },
        onArgs(win, args) { if (args.id || args.ref) win.state.open(+(args.id || args.ref)); },
    });
})();

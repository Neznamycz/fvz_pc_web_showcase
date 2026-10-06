// ==========================================
// App: documents (written in the PC from templates, scanned paper) + templates
// ==========================================
(function () {
    function fill(body, caseNo) {
        const u = OS.state.user, now = Math.floor(Date.now() / 1000);
        return body.replace(/\{\{(\w+)\}\}/g, (m, k) => ({
            name: u.name, rank: u.gradeLabel || '', dept: u.dept || '', date: fmtDate(now), time: fmtTime(now), case: caseNo || '-',
        }[k] ?? m));
    }

    Apps.define('documents', {
        w: 1100, h: 700,
        mount(win, args) {
            const st = win.state = { filter: 'all', query: '', docs: [], current: null, canTemplates: false };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('do_search')}"></div>
                    <select class="select" data-f style="width:170px"><option value="all">${T('ui_all')}</option><option value="mine">${T('do_mine')}</option><option value="scans">${T('do_scans')}</option></select>
                    <div class="grow"></div><button class="btn sm hidden" data-a="templates">${icon('settings', 'sm')}${T('do_templates')}</button>
                    <button class="btn primary" data-a="new">${icon('plus', 'sm')}${T('do_new')}</button></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail style="display:flex;flex-direction:column"></div></div></div>`;
            $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; load(); }, 300));
            $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };
            const empty = () => { st.editing = false; $('[data-detail]', win.body).innerHTML = `<div class="empty" style="height:100%;justify-content:center">${icon('documents')}${T('do_pick')}</div>`; };
            empty();

            async function load() {
                const res = await api('documents:list', { filter: st.filter, query: st.query });
                if (res.error) return UI.err(res);
                st.docs = res.docs;
                st.canTemplates = res.canTemplates;
                $('[data-a="templates"]', win.body).classList.toggle('hidden', !st.canTemplates);
                $('[data-list]', win.body).innerHTML = st.docs.length ? st.docs.map(d => `<div class="list-item ${st.current && st.current.id === d.id ? 'active' : ''}" data-id="${d.id}">
                    ${icon(d.source === 'scan' ? 'scan' : 'documents')}<div class="grow"><div class="t ellipsis">${esc(d.title)}</div>
                    <div class="s"><span class="mono">${esc(d.docNo)}</span> · ${esc(d.author || '')} · ${fmtDate(d.updatedAt)}</div>
                    ${d.caseNo ? `<div class="s mono accent">${esc(d.caseNo)}</div>` : ''}</div></div>`).join('') : `<div class="empty">${icon('documents')}${T('do_empty')}</div>`;
            }

            async function open(id, silent) {
                const res = await api('documents:get', { id, refresh: !!silent });
                if (res.error) { if (silent) { st.current = null; empty(); return; } return UI.err(res); }
                st.editing = false;
                const d = st.current = res.doc;
                win.setTitle(d.docNo);
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', +x.dataset.id === id));
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(d.title)}</h2><div class="sub"><span class="mono accent">${esc(d.docNo)}</span>
                        ${d.source === 'scan' ? `<span class="chip info">${icon('scan', 'sm')}${T('do_scanned')}</span>` : ''}<span>${esc(d.author || '')} · ${fmtDT(d.createdAt)}</span>
                        ${d.caseNo ? `<a class="mono" data-case="${d.caseId}" style="cursor:pointer">${esc(d.caseNo)}</a>` : ''}</div></div>
                        <div class="detail-actions">${d.canEdit ? `<button class="btn sm" data-a="edit">${icon('edit', 'sm')}${T('ui_edit')}</button>` : ''}
                            <button class="btn sm" data-a="sign">${icon('edit', 'sm')}${T('sig_sign_doc')}</button>
                            <button class="btn sm" data-a="mail">${icon('mail', 'sm')}</button><button class="btn sm" data-a="print">${icon('printer', 'sm')}</button>
                            ${d.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="app-scroll"><div class="pad"><div class="md">${md(d.body || '')}</div>
                        ${d.meta && d.meta.metadata && d.meta.metadata.imageurl ? `<div class="photo" style="height:300px;margin-top:12px" ${bg(d.meta.metadata.imageurl)}></div>` : ''}
                        ${d.meta && d.meta.signatures && d.meta.signatures.length ? `<div class="paper-sigs">${SignPad.list(d.meta.signatures)}</div>` : ''}</div></div>`;
            }

            function editor(d) {
                st.current = d;
                st.editing = true;
                $('[data-detail]', win.body).innerHTML = `
                    <div class="app-toolbar"><input class="input" data-title maxlength="120" placeholder="${T('do_title')}" value="${esc(d.title || '')}" style="font-weight:700">
                        <span class="chip accent" data-casechip>${esc(d.caseNo || T('ui_no_case'))}</span><button class="btn sm" data-a="case">${icon('cases', 'sm')}</button>
                        <button class="btn sm" data-a="cancel">${T('ui_cancel')}</button><button class="btn sm primary" data-a="save">${icon('check', 'sm')}${T('ui_save')}</button></div>
                    <div class="editor">${MDTools.bar()}<div class="ed-split"><textarea class="textarea" data-body maxlength="12000">${esc(d.body || '')}</textarea><div class="md" data-prev></div></div></div>`;
                const ta = $('[data-body]', win.body), prev = $('[data-prev]', win.body);
                prev.innerHTML = md(ta.value);
                ta.addEventListener('input', () => { prev.innerHTML = md(ta.value); });
                MDTools.bind($('.editor', win.body), ta);
            }

            async function newDoc() {
                const res = await api('documents:templates');
                const tpls = (res && res.templates) || [];
                let caseSel = null;
                const pick = await UI.modal({
                    title: T('do_new'), icon: 'documents', wide: true,
                    body: `<div class="pick-list" style="max-height:340px"><div class="pick-item" data-tpl="">${icon('plus')}<div class="grow"><div class="t">${T('do_blank')}</div></div></div>
                        ${tpls.map(t => `<div class="pick-item" data-tpl="${t.id}">${icon('documents')}<div class="grow"><div class="t">${esc(t.title)}</div><div class="s muted">${esc(t.category || '')}</div></div></div>`).join('')}</div>
                        <div class="row"><span class="muted">${T('f_case_no')}:</span><span class="chip accent" id="nd-case">${T('ui_no_case')}</span><button class="btn sm" id="nd-pick">${icon('cases', 'sm')}${T('ui_pick')}</button></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }],
                    onOpen(el, close) {
                        $('#nd-pick', el).onclick = async () => { const c = await UI.pickCase({ allowNone: true }); if (c) { caseSel = c.id ? c : null; $('#nd-case', el).textContent = c.caseNo || T('ui_no_case'); } };
                        el.addEventListener('click', e => { const it = e.target.closest('[data-tpl]'); if (it) close({ tpl: it.dataset.tpl }); });
                    },
                });
                if (!pick) return;
                const tpl = tpls.find(t => String(t.id) === pick.tpl);
                editor({ title: tpl ? tpl.title : '', body: tpl ? fill(tpl.body, caseSel && caseSel.caseNo) : '', caseId: caseSel && caseSel.id, caseNo: caseSel && caseSel.caseNo });
            }

            async function templates() {
                const res = await api('documents:templates');
                const tpls = (res && res.templates) || [];
                const which = await UI.modal({
                    title: T('do_templates'), icon: 'settings', wide: true,
                    body: `<div class="muted" style="font-size:12px">${T('do_tpl_hint')}</div><div class="pick-list" style="max-height:360px">
                        <div class="pick-item" data-t="">${icon('plus')}<b>${T('do_tpl_new')}</b></div>
                        ${tpls.map(t => `<div class="pick-item" data-t="${t.id}">${icon('documents')}<div class="grow"><div class="t">${esc(t.title)}</div><div class="s muted">${esc(t.category || '')}</div></div></div>`).join('')}</div>`,
                    buttons: [{ label: T('ui_close'), value: null }],
                    onOpen(el, close) { el.addEventListener('click', e => { const it = e.target.closest('[data-t]'); if (it) close({ id: it.dataset.t }); }); },
                });
                if (!which) return;
                const t = tpls.find(x => String(x.id) === which.id) || {};
                const v = await UI.modal({
                    title: t.id ? T('do_tpl_edit') : T('do_tpl_new'), icon: 'edit', wide: true,
                    body: `<div class="grid2"><div class="field"><label>${T('do_title')}</label><input class="input" id="t-t" maxlength="80" value="${esc(t.title || '')}"></div>
                        <div class="field"><label>${T('f_category')}</label><input class="input" id="t-c" maxlength="40" value="${esc(t.category || '')}"></div></div>
                        <div class="field"><label>${T('do_body')}</label><textarea class="textarea mono" id="t-b" style="min-height:260px" maxlength="12000">${esc(t.body || '')}</textarea></div>`,
                    buttons: (t.id ? [{ label: T('ui_delete'), value: 'delete', cls: 'danger' }] : []).concat([{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                        const title = $('#t-t', el).value.trim(), body = $('#t-b', el).value;
                        return title && body.trim() ? { title, category: $('#t-c', el).value, body } : false;
                    } }]),
                });
                if (v === 'delete') {
                    const r = await api('documents:templateDelete', { id: t.id });
                    if (r.error) return UI.err(r);
                } else if (v) {
                    const r = await api('documents:templateSave', { id: t.id, ...v });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('do_tpl_saved'), type: 'success', app: 'documents' });
                }
            }

            win.body.addEventListener('click', async e => {
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const d = st.current;
                if (a.dataset.a === 'new') return newDoc();
                if (a.dataset.a === 'templates') return templates();
                if (a.dataset.a === 'edit') return editor({ ...d });
                if (a.dataset.a === 'cancel') return d && d.id ? open(d.id) : empty();
                if (a.dataset.a === 'case') {
                    const c = await UI.pickCase({ allowNone: true });
                    if (c) { d.caseId = c.id; d.caseNo = c.caseNo; $('[data-casechip]', win.body).textContent = c.caseNo || T('ui_no_case'); }
                    return;
                }
                if (a.dataset.a === 'save') {
                    const r = await api('documents:save', { id: d.id, title: $('[data-title]', win.body).value, body: $('[data-body]', win.body).value, caseId: d.caseId || null });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('do_saved'), text: r.docNo || '', type: 'success', app: 'documents' });
                    await load();
                    return open(r.id);
                }
                if (a.dataset.a === 'print') return UI.print({ type: 'document', id: d.id }, d.docNo);
                if (a.dataset.a === 'sign') {
                    const path = await SignPad.open({ title: T('sig_sign_doc'), text: esc(d.title) });
                    if (!path) return;
                    const r = await api('documents:sign', { id: d.id, path });
                    if (r.error) return UI.err(r);
                    return open(d.id);
                }
                if (a.dataset.a === 'mail') return OS.openApp('mail', { compose: { subject: d.title, attachments: [{ kind: 'document', ref: String(d.id), label: d.docNo }] } });
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('do_confirm_delete', esc(d.docNo)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('documents:delete', { id: d.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    empty();
                    return load();
                }
            });

            win.state.open = open;
            // the editor is never reloaded under the hands of the author
            win.refresh = async () => { await load(); if (st.current && st.current.id && !st.editing) open(st.current.id, true); };
            load().then(() => { if (args && args.id) open(+args.id); });
        },
        onArgs(win, args) { if (args.id) win.state.open(+args.id); },
    });
})();

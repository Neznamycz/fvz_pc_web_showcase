// ==========================================
// App: photo gallery (my photos, categories, case folders, mugshots, import from the camera)
// ==========================================
(function () {
    const COLORS = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#95a5a6'];

    Apps.define('gallery', {
        w: 1120, h: 700,
        async mount(win, args) {
            const st = win.state = { view: 'mine', id: null, query: '', photos: [], meta: null };
            win.body.innerHTML = `<div class="app"><div class="app-body"><div class="app-side" data-side></div>
                <div class="grow" style="display:flex;flex-direction:column;min-width:0;position:relative">
                    <div class="app-toolbar"><h3 data-title></h3><div class="grow"></div>
                        <div class="search">${icon('search')}<input class="input" data-q placeholder="${T('ga_search')}"></div>
                        <button class="btn sm hidden" data-a="import">${icon('camera', 'sm')}${T('ga_import')}</button>
                        <button class="btn sm hidden" data-a="url">${icon('link', 'sm')}${T('ga_add_url')}</button></div>
                    <div class="app-scroll" data-grid></div></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));

            async function side() {
                const m = await api('gallery:init');
                if (m.error) { win.body.innerHTML = `<div class="empty">${errMsg(m)}</div>`; return false; }
                st.meta = m;
                const item = (view, id, ico, label, n, color) => `<button class="side-item ${st.view === view && String(st.id) === String(id) ? 'on' : ''}" data-view="${view}" data-id="${id ?? ''}">
                    ${color ? `<i class="sw" style="background:${esc(color)}"></i>` : icon(ico)}<span class="ellipsis">${esc(label)}</span>${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
                $('[data-side]', win.body).innerHTML = `
                    ${item('mine', null, 'user', T('ga_mine'), m.mine)}${item('all', null, 'grid', T('ga_all'), m.all)}
                    ${m.mugshots ? item('mugshots', null, 'prisoners', T('ga_mugshots')) : ''}
                    ${item('uncategorized', null, 'folder', T('ga_uncategorized'))}
                    <div class="side-title">${T('ga_categories')}${m.canManage ? `<button class="icon-btn" data-a="catNew" style="width:22px;height:22px">${icon('plus', 'sm')}</button>` : ''}</div>
                    ${m.categories.map(c => item('category', c.id, 'tag', c.label, c.n, c.color)).join('')}
                    <div class="side-title">${T('ga_cases')}</div>
                    ${m.cases.map(c => item('case', c.id, 'folder', c.case_no + ' · ' + c.title, c.n)).join('') || `<div class="dim" style="padding:4px 9px;font-size:11px">-</div>`}`;
                $('[data-a="import"]', win.body).classList.toggle('hidden', !(m.canUpload && m.camera));
                $('[data-a="url"]', win.body).classList.toggle('hidden', !(m.canUpload && m.allowUrl));
                return true;
            }

            function title() {
                const m = st.meta;
                if (st.view === 'category') { const c = m.categories.find(x => x.id === +st.id); return c ? c.label : ''; }
                if (st.view === 'case') { const c = m.cases.find(x => x.id === +st.id); return c ? c.case_no + ' · ' + c.title : T('ga_case'); }
                return T('ga_' + st.view);
            }

            async function load() {
                $('[data-title]', win.body).textContent = title();
                const grid = $('[data-grid]', win.body);
                grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                const res = await api('gallery:list', { view: st.view, id: st.id, query: st.query });
                if (res.error) return (grid.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                st.photos = res.photos;
                const catEdit = st.view === 'category' && st.meta.canManage;
                grid.innerHTML = (catEdit ? `<div class="row" style="padding:12px 12px 0"><button class="btn sm" data-a="catEdit">${icon('edit', 'sm')}${T('ga_cat_edit')}</button>
                    <button class="btn sm danger" data-a="catDelete">${icon('trash', 'sm')}${T('ga_cat_delete')}</button></div>` : '')
                    + (st.photos.length ? `<div class="g-grid">${st.photos.map((p, i) => `<div class="g-tile" data-i="${i}" ${bg(p.url)}>
                        ${p.source === 'scan' ? `<span class="chip tag">${icon('scan', 'sm')}</span>` : ''}${p.caseNo ? `<span class="chip accent tag" style="left:auto;right:6px">${esc(p.caseNo)}</span>` : ''}
                        <div class="cap">${esc(p.label || '')}<span>${esc(p.place || '')} · ${fmtDate(p.takenAt || p.addedAt)}</span></div></div>`).join('')}</div>`
                    : `<div class="empty">${icon('gallery')}${T('ga_empty')}</div>`);
            }

            function viewer(i) {
                const p = st.photos[i];
                if (!p) return;
                const m = st.meta;
                const own = p.owner === OS.state.user.id;
                const mug = p.source === 'mugshot';
                const canEdit = !mug && (own || m.canEdit);
                const canDel = !mug && (own || m.canDelete);
                const el = h(`<div class="viewer">
                    <button class="icon-btn v-close" data-v="close" style="background:rgba(0,0,0,.6)">${icon('close')}</button>
                    <div class="v-img" ${bg(p.url)}></div>
                    <div class="v-side">
                        <div><div style="font-weight:700;font-size:14px">${esc(p.label || T('photo'))}</div><div class="muted" style="font-size:11.5px;margin-top:3px">${esc(p.place || '')}</div></div>
                        ${p.side ? `<div class="photo" style="height:160px" ${bg(p.side)}></div>` : ''}
                        <div class="kv"><span>${T('f_taken')}</span><span>${fmtDT(p.takenAt)}</span><span>${T('f_by')}</span><span>${esc(p.takenBy || '-')}</span>
                            ${p.ownerName ? `<span>${T('f_added')}</span><span>${esc(p.ownerName)} · ${fmtDate(p.addedAt)}</span>` : ''}
                            <span>${T('f_category')}</span><span>${esc((m.categories.find(c => c.id === p.categoryId) || {}).label || '-')}</span>
                            <span>${T('f_case_no')}</span><span class="mono">${esc(p.caseNo || '-')}</span></div>
                        ${p.note ? `<div class="md"><blockquote>${esc(p.note)}</blockquote></div>` : ''}
                        <div class="col">
                            ${canEdit ? `<button class="btn sm" data-v="edit">${icon('edit', 'sm')}${T('ga_edit')}</button>` : ''}
                            ${mug ? `<button class="btn sm" data-v="booking">${icon('prisoners', 'sm')}${T('ga_open_booking')}</button>` : ''}
                            <button class="btn sm" data-v="print">${icon('printer', 'sm')}${T('ga_print')}</button>
                            ${OS.can('gallery.edit') && OS.state.integrations.board ? `<button class="btn sm" data-v="board">${icon('board', 'sm')}${T('ga_to_board')}</button>` : ''}
                            ${canDel ? `<button class="btn sm danger" data-v="delete">${icon('trash', 'sm')}${T('ui_delete')}</button>` : ''}
                        </div>
                        <div class="row between" style="margin-top:auto"><button class="btn sm" data-v="prev">${icon('back', 'sm')}</button>
                            <span class="dim">${i + 1} / ${st.photos.length}</span><button class="btn sm" data-v="next">${icon('chev', 'sm')}</button></div>
                    </div></div>`);
                el.addEventListener('click', async e => {
                    const b = e.target.closest('[data-v]');
                    if (!b) return;
                    const a = b.dataset.v;
                    if (a === 'close') return el.remove();
                    if (a === 'prev' || a === 'next') { el.remove(); return viewer((i + (a === 'next' ? 1 : -1) + st.photos.length) % st.photos.length); }
                    if (a === 'booking') return OS.openApp('prisoners', { bookingNo: p.bookingNo });
                    if (a === 'print') return UI.print({ type: 'photo', id: p.id }, p.label);
                    if (a === 'board') {
                        const bres = await api('gallery:boards');
                        if (!bres.boards || !bres.boards.length) return UI.toast(T('ga_no_boards'), 'error');
                        const boardId = await UI.modal({ title: T('ga_to_board'), icon: 'board',
                            body: `<div class="pick-list">${bres.boards.map(b2 => `<div class="pick-item" data-bd="${esc(b2.id)}">${icon('board')}<span>${esc(b2.label)}</span></div>`).join('')}</div>`,
                            buttons: [{ label: T('ui_cancel'), value: null }],
                            onOpen(m2, close) { m2.addEventListener('click', ev => { const it = ev.target.closest('[data-bd]'); if (it) close(it.dataset.bd); }); } });
                        if (!boardId) return;
                        const r = await api('gallery:toBoard', { id: p.id, boardId });
                        if (r.error) return UI.err(r);
                        return OS.toast({ title: T('ga_pinned'), type: 'success', app: 'gallery' });
                    }
                    if (a === 'delete') {
                        if (!(await UI.confirm(T('ga_confirm_delete'), { danger: true, ok: T('ui_delete') }))) return;
                        const r = await api('gallery:delete', { id: p.id });
                        if (r.error) return UI.err(r);
                        el.remove();
                        await side();
                        return load();
                    }
                    if (a === 'edit') {
                        let caseSel = p.caseId ? { id: p.caseId, caseNo: p.caseNo } : null;
                        const v = await UI.modal({
                            title: T('ga_edit'), icon: 'edit',
                            body: `<div class="field"><label>${T('f_label')}</label><input class="input" id="pe-l" maxlength="120" value="${esc(p.label || '')}"></div>
                                <div class="field"><label>${T('f_note')}</label><textarea class="textarea" id="pe-n" maxlength="500">${esc(p.note || '')}</textarea></div>
                                <div class="field"><label>${T('f_category')}</label><select class="select" id="pe-c"><option value="">-</option>
                                    ${m.categories.map(c => `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
                                <div class="field"><label>${T('f_case_no')}</label><div class="row"><span class="chip accent" id="pe-case">${esc(p.caseNo || '-')}</span>
                                    <button class="btn sm" id="pe-pick">${icon('cases', 'sm')}${T('ui_pick')}</button></div></div>`,
                            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: m2 => ({
                                label: $('#pe-l', m2).value, note: $('#pe-n', m2).value, categoryId: +$('#pe-c', m2).value || null, caseId: caseSel ? caseSel.id : null }) }],
                            onOpen(m2) {
                                $('#pe-pick', m2).onclick = async () => {
                                    const c = await UI.pickCase({ allowNone: true });
                                    if (c) { caseSel = c.id ? c : null; $('#pe-case', m2).textContent = c.caseNo || '-'; }
                                };
                            },
                        });
                        if (!v) return;
                        const r = await api('gallery:update', { id: p.id, ...v });
                        if (r.error) return UI.err(r);
                        el.remove();
                        await side();
                        load();
                    }
                });
                $('[data-grid]', win.body).parentElement.appendChild(el);
            }

            async function importDialog() {
                const res = await api('gallery:importList');
                if (res.error) return UI.err(res);
                const sel = new Set();
                let caseSel = st.view === 'case' ? { id: +st.id } : null;
                const v = await UI.modal({
                    title: T('ga_import'), icon: 'camera', wide: true,
                    body: `<div class="muted" style="font-size:12px">${T('ga_import_hint')}</div>
                        <div class="g-grid" style="padding:0;max-height:340px;overflow-y:auto" id="im-grid">${res.photos.map(p => `<div class="g-tile ${p.imported ? 'done' : ''}" data-pid="${p.id}" ${bg(p.url)}>
                            <span class="chk"></span><div class="cap">${esc(p.street || p.zone || '')}<span>${fmtDT(p.takenAt)}</span></div></div>`).join('') || `<div class="empty">${T('ga_no_camera')}</div>`}</div>
                        <div class="grid2"><div class="field"><label>${T('f_category')}</label><select class="select" id="im-c"><option value="">-</option>
                            ${st.meta.categories.map(c => `<option value="${c.id}" ${st.view === 'category' && +st.id === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
                        <div class="field"><label>${T('f_case_no')}</label><div class="row"><span class="chip accent" id="im-case">${caseSel ? esc(title()) : '-'}</span>
                            <button class="btn sm" id="im-pick">${icon('cases', 'sm')}${T('ui_pick')}</button></div></div></div>
                        <div class="field"><label>${T('f_label_opt')}</label><input class="input" id="im-l" maxlength="120"></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ga_import_btn'), cls: 'primary', collect: m2 => sel.size ? ({
                        ids: [...sel], categoryId: +$('#im-c', m2).value || null, caseId: caseSel ? caseSel.id : null, label: $('#im-l', m2).value }) : false }],
                    onOpen(m2) {
                        m2.addEventListener('click', e => {
                            const t = e.target.closest('[data-pid]');
                            if (!t || t.classList.contains('done')) return;
                            const id = +t.dataset.pid;
                            if (sel.has(id)) sel.delete(id); else sel.add(id);
                            t.classList.toggle('on', sel.has(id));
                        });
                        $('#im-pick', m2).onclick = async () => {
                            const c = await UI.pickCase({ allowNone: true });
                            if (c) { caseSel = c.id ? c : null; $('#im-case', m2).textContent = c.caseNo || '-'; }
                        };
                    },
                });
                if (!v) return;
                const r = await api('gallery:import', v);
                if (r.error) return UI.err(r);
                OS.toast({ title: T('ga_imported', r.count), type: 'success', app: 'gallery' });
                await side();
                load();
            }

            win.body.addEventListener('click', async e => {
                const sv = e.target.closest('[data-view]');
                if (sv) {
                    st.view = sv.dataset.view;
                    st.id = sv.dataset.id || null;
                    $$('[data-view]', win.body).forEach(b => b.classList.toggle('on', b === sv));
                    return load();
                }
                const t = e.target.closest('[data-grid] .g-tile');
                if (t) return viewer(+t.dataset.i);
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'import') return importDialog();
                if (a.dataset.a === 'url') {
                    const v = await UI.modal({ title: T('ga_add_url'), icon: 'link',
                        body: `<div class="field"><label>URL (https)</label><input class="input" id="u-url" maxlength="512"></div>
                            <div class="field"><label>${T('f_label')}</label><input class="input" id="u-l" maxlength="120"></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: m2 => {
                            const url = $('#u-url', m2).value.trim();
                            return url ? { url, label: $('#u-l', m2).value, categoryId: st.view === 'category' ? +st.id : null, caseId: st.view === 'case' ? +st.id : null } : false;
                        } }] });
                    if (!v) return;
                    const r = await api('gallery:addUrl', v);
                    if (r.error) return UI.err(r);
                    await side();
                    return load();
                }
                if (a.dataset.a === 'catNew' || a.dataset.a === 'catEdit') {
                    const cur = a.dataset.a === 'catEdit' ? st.meta.categories.find(c => c.id === +st.id) : null;
                    let color = cur ? cur.color : COLORS[1];
                    const v = await UI.modal({ title: cur ? T('ga_cat_edit') : T('ga_cat_new'), icon: 'tag',
                        body: `<div class="field"><label>${T('f_label')}</label><input class="input" id="c-l" maxlength="60" value="${esc(cur ? cur.label : '')}"></div>
                            <div class="field"><label>${T('f_color')}</label><div class="colors" id="c-c">${COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: m2 => { const l = $('#c-l', m2).value.trim(); return l ? { label: l, color } : false; } }],
                        onOpen(m2) { $('#c-c', m2).onclick = ev => { const b = ev.target.closest('[data-c]'); if (b) { color = b.dataset.c; $$('#c-c button', m2).forEach(x => x.classList.toggle('on', x === b)); } }; } });
                    if (!v) return;
                    const r = await api('gallery:catSave', { id: cur ? cur.id : null, ...v });
                    if (r.error) return UI.err(r);
                    await side();
                    return load();
                }
                if (a.dataset.a === 'catDelete') {
                    if (!(await UI.confirm(T('ga_confirm_cat_delete'), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('gallery:catDelete', { id: +st.id });
                    if (r.error) return UI.err(r);
                    st.view = 'mine';
                    st.id = null;
                    await side();
                    return load();
                }
            });

            win.refresh = async () => { if (await side()) load(); };
            win.state.go = async (a2) => {
                if (a2.view) { st.view = a2.view; st.id = a2.id || null; }
                await side();
                await load();
                if (a2.photo) {
                    const i = st.photos.findIndex(p => p.id === a2.photo);
                    if (i >= 0) viewer(i);
                }
            };
            if (await side()) {
                if (args && (args.view || args.photo)) win.state.go(args);
                else load();
            }
        },
        onArgs(win, args) { if (win.state.go) win.state.go(args); },
    });
})();

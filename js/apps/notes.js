// ==========================================
// App: notepads (private / department / shared with people, optional case, markdown)
// ==========================================
(function () {
    const COLORS = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#95a5a6'];

    // markdown toolbar helper
    function wrap(ta, before, after = before, line = false) {
        const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        if (line) {
            const ls = v.lastIndexOf('\n', s - 1) + 1;
            ta.value = v.slice(0, ls) + before + v.slice(ls);
            ta.selectionStart = ta.selectionEnd = e + before.length;
        } else {
            ta.value = v.slice(0, s) + before + v.slice(s, e) + after + v.slice(e);
            ta.selectionStart = s + before.length;
            ta.selectionEnd = e + before.length;
        }
        ta.focus();
        ta.dispatchEvent(new Event('input'));
    }
    window.MDTools = {
        bar: () => `<div class="ed-tools">
            <button class="icon-btn" data-md="h" title="H">${icon('heading', 'sm')}</button><button class="icon-btn" data-md="b">${icon('bold', 'sm')}</button>
            <button class="icon-btn" data-md="i">${icon('italic', 'sm')}</button><button class="icon-btn" data-md="ul">${icon('bullets', 'sm')}</button>
            <button class="icon-btn" data-md="task">${icon('checklist', 'sm')}</button><button class="icon-btn" data-md="q">${icon('quote', 'sm')}</button>
            <button class="icon-btn" data-md="hr">—</button></div>`,
        bind(root, ta) {
            root.addEventListener('click', e => {
                const b = e.target.closest('[data-md]');
                if (!b) return;
                const k = b.dataset.md;
                if (k === 'h') wrap(ta, '## ', '', true);
                if (k === 'b') wrap(ta, '**');
                if (k === 'i') wrap(ta, '*');
                if (k === 'ul') wrap(ta, '- ', '', true);
                if (k === 'task') wrap(ta, '- [ ] ', '', true);
                if (k === 'q') wrap(ta, '> ', '', true);
                if (k === 'hr') wrap(ta, '\n---\n', '');
            });
        },
    };

    Apps.define('notes', {
        w: 1060, h: 680,
        mount(win, args) {
            const st = win.state = { filter: 'all', query: '', notes: [], canShare: false, editing: null };
            win.body.innerHTML = `<div class="app" data-root></div>`;

            function listView() {
                st.editing = null;
                win.setTitle();
                $('[data-root]', win.body).innerHTML = `
                    <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('no_search')}" value="${esc(st.query)}"></div>
                        <select class="select" data-f style="width:160px"><option value="all">${T('ui_all')}</option><option value="mine">${T('no_mine')}</option><option value="shared">${T('no_shared')}</option></select>
                        <div class="grow"></div><button class="btn primary" data-a="new">${icon('plus', 'sm')}${T('no_new')}</button></div>
                    <div class="app-scroll" data-list></div>`;
                $('[data-f]', win.body).value = st.filter;
                $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };
                $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; load(); }, 300));
                load();
            }

            async function load() {
                const res = await api('notes:list', { filter: st.filter, query: st.query });
                if (res.error) return UI.err(res);
                st.notes = res.notes;
                st.canShare = res.canShare;
                const box = $('[data-list]', win.body);
                if (!box) return;
                box.innerHTML = st.notes.length ? `<div class="notes-grid">${st.notes.map(n => `<div class="note-card" data-id="${n.id}" style="--nc:${esc(n.color || '#f1c40f')}">
                    <div class="row between"><span class="t ellipsis">${n.pinned ? '📌 ' : ''}${esc(n.title)}</span>${scopeChip(n.scope)}</div>
                    <div class="p">${esc(n.body || '')}</div>
                    <div class="f">${n.mine ? '' : `${icon('user', 'sm')}${esc(n.ownerName)} · `}${ago(n.updatedAt)}${n.caseNo ? ` · <span class="mono accent">${esc(n.caseNo)}</span>` : ''}</div></div>`).join('')}</div>`
                    : `<div class="empty">${icon('notes')}${T('no_empty')}</div>`;
            }

            const scopeChip = s => s === 'private' ? `<span class="chip">${icon('lock', 'sm')}</span>` : s === 'dept' ? `<span class="chip info">${T('no_scope_dept')}</span>` : `<span class="chip accent">${icon('users', 'sm')}</span>`;

            async function edit(id) {
                let n = { title: '', body: '', scope: 'private', shared: [], color: COLORS[0], pinned: false, canEdit: true, mine: true };
                if (id) {
                    const res = await api('notes:get', { id });
                    if (res.error) return UI.err(res);
                    n = res.note;
                }
                st.editing = n;
                win.setTitle(n.title || T('no_new'));
                const ro = !n.canEdit;
                $('[data-root]', win.body).innerHTML = `
                    <div class="app-toolbar"><button class="btn sm" data-a="back">${icon('back', 'sm')}${T('ui_back')}</button>
                        <input class="input" data-title maxlength="120" placeholder="${T('no_title')}" value="${esc(n.title)}" style="font-weight:700;font-size:14px" ${ro ? 'readonly' : ''}>
                        <div class="colors" data-colors>${COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === (n.color || COLORS[0]) ? 'on' : ''}"></button>`).join('')}</div></div>
                    <div class="app-toolbar" style="padding:6px 12px">
                        ${n.mine ? `<select class="select" data-scope style="width:200px"><option value="private">${T('no_scope_private')}</option>
                            ${st.canShare ? `<option value="dept">${T('no_scope_dept_long')}</option><option value="shared">${T('no_scope_shared')}</option>` : ''}</select>` : `<span class="chip">${icon('user', 'sm')}${esc(n.ownerName)}</span>`}
                        <div class="pick-tags" data-sharedlist></div>
                        <button class="btn sm ${n.scope === 'shared' && n.mine ? '' : 'hidden'}" data-a="share">${icon('users', 'sm')}${T('no_people')}</button>
                        <div class="grow"></div>
                        <span class="chip accent" data-case>${esc(n.caseNo || T('ui_no_case'))}</span>
                        ${ro ? '' : `<button class="btn sm" data-a="case">${icon('cases', 'sm')}</button>`}
                        <label class="check"><input type="checkbox" data-pin ${n.pinned ? 'checked' : ''} ${ro ? 'disabled' : ''}>${T('no_pin')}</label>
                        ${n.id ? `<button class="btn sm" data-a="print">${icon('printer', 'sm')}</button>` : ''}
                        ${n.id && n.mine ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}
                        ${ro ? '' : `<button class="btn sm primary" data-a="save">${icon('check', 'sm')}${T('ui_save')}</button>`}</div>
                    <div class="editor">${ro ? '' : MDTools.bar()}<div class="ed-split">
                        ${ro ? '' : `<textarea class="textarea" data-body maxlength="8000" placeholder="${T('no_body_hint')}">${esc(n.body || '')}</textarea>`}
                        <div class="md" data-preview></div></div></div>`;
                const ta = $('[data-body]', win.body), prev = $('[data-preview]', win.body);
                prev.innerHTML = md(n.body || '');
                if (ta) {
                    ta.addEventListener('input', () => { prev.innerHTML = md(ta.value); });
                    MDTools.bind($('.editor', win.body), ta);
                }
                const sc = $('[data-scope]', win.body);
                if (sc) {
                    sc.value = n.scope;
                    sc.onchange = () => { n.scope = sc.value; $('[data-a="share"]', win.body).classList.toggle('hidden', n.scope !== 'shared'); paintShared(); };
                }
                const paintShared = () => {
                    $('[data-sharedlist]', win.body).innerHTML = n.scope === 'shared' ? (n.shared || []).map(p => `<span class="chip">${esc(p.name)}</span>`).join('') : '';
                };
                paintShared();
                $('[data-colors]', win.body).onclick = e => {
                    const b = e.target.closest('[data-c]');
                    if (!b || ro) return;
                    n.color = b.dataset.c;
                    $$('[data-colors] button', win.body).forEach(x => x.classList.toggle('on', x === b));
                };
                st.paintShared = paintShared;
            }
            win.state.edit = edit;
            // the list only - an open note is never reloaded under the hands of the author
            win.refresh = () => { if (!st.editing) load(); };

            win.body.addEventListener('click', async e => {
                const card = e.target.closest('.note-card');
                if (card) return edit(+card.dataset.id);
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const n = st.editing;
                if (a.dataset.a === 'new') return edit(null);
                if (a.dataset.a === 'back') return listView();
                if (a.dataset.a === 'share') {
                    const people = await UI.pickOfficer({ multi: true, selected: n.shared || [], title: T('no_people') });
                    if (people) { n.shared = people.filter(p => p.id); st.paintShared(); }
                }
                if (a.dataset.a === 'case') {
                    const c = await UI.pickCase({ allowNone: true });
                    if (c) { n.caseId = c.id; n.caseNo = c.caseNo; $('[data-case]', win.body).textContent = c.caseNo || T('ui_no_case'); }
                }
                if (a.dataset.a === 'print') return UI.print({ type: 'note', id: n.id }, n.title);
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('no_confirm_delete'), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('notes:delete', { id: n.id });
                    if (r.error) return UI.err(r);
                    return listView();
                }
                if (a.dataset.a === 'save') {
                    const r = await api('notes:save', {
                        id: n.id, title: $('[data-title]', win.body).value, body: $('[data-body]', win.body).value, scope: n.scope,
                        shared: (n.shared || []).map(p => p.id), caseId: n.caseId || null, color: n.color, pinned: $('[data-pin]', win.body).checked,
                    });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('no_saved'), type: 'success', app: 'notes' });
                    n.id = r.id;
                    edit(r.id);
                }
            });

            listView();
            if (args && (args.id || args.ref)) edit(+(args.id || args.ref));
        },
        onArgs(win, args) { if (args.id || args.ref) win.state.edit(+(args.id || args.ref)); },
    });
})();

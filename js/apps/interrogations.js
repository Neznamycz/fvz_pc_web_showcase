// ==========================================
// App: interrogations - live observation (+ silent notes, clerk) and the archive
// ==========================================
(function () {
    const stChip = s => `<span class="chip ${s === 'running' ? 'bad' : s === 'paused' ? 'warn' : s === 'finished' ? 'ok' : ''}">${s === 'running' ? '● ' : ''}${T('ints_' + s)}</span>`;
    const clock = t => { t = Math.max(0, Math.floor(t || 0)); const z = n => String(n).padStart(2, '0'); return `${z(Math.floor(t / 3600))}:${z(Math.floor(t % 3600 / 60))}:${z(t % 60)}`; };

    Apps.define('interrogations', {
        w: 1080, h: 680,
        mount(win, args) {
            const st = win.state = { filter: 'all', query: '', current: null, sp: 'O' };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('ints_search')}"></div>
                    <select class="select" data-f style="width:160px"><option value="all">${T('ui_all')}</option><option value="live">${T('ints_live')}</option></select></div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail style="display:flex;flex-direction:column">
                    <div class="empty" style="height:100%;justify-content:center">${icon('users')}${T('ints_pick')}</div></div></div></div>`;
            $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; load(); }, 300));
            $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; load(); };

            async function load() {
                const res = await api('int:list', { filter: st.filter, query: st.query });
                if (res.error) return UI.err(res);
                $('[data-list]', win.body).innerHTML = res.list.length ? res.list.map(i => `<div class="list-item ${st.current && st.current.id === i.id ? 'active' : ''}" data-id="${i.id}">
                    ${icon('users')}<div class="grow"><div class="row between"><span class="t ellipsis">${esc(i.subject)}</span>${stChip(i.status)}</div>
                    <div class="s mono">${esc(i.number)}${i.caseNo ? ' · ' + esc(i.caseNo) : ''}</div><div class="s">${esc(i.officer || '')} · ${fmtDT(i.startedAt)} · ${clock(i.duration)}</div></div></div>`).join('')
                    : `<div class="empty">${icon('users')}${T('ints_empty')}</div>`;
            }

            const line = l => l.kind === 'note' ? `<div class="il note"><span class="il-t mono">${clock(l.t)}</span><b>${esc(l.name)}</b> <span>${esc(l.text)}</span></div>`
                : `<div class="il ${l.sp === 'X' ? 'sys' : 'sp-' + l.sp} ${l.kind}"><span class="il-t mono">${clock(l.t)}</span>${l.sp !== 'X' ? `<b>${esc(l.name || l.sp)}:</b> ` : ''}<span>${esc(l.text)}</span></div>`;

            async function open(id, silent) {
                const res = await api('int:get', { id });
                if (res.error) return silent ? null : UI.err(res);
                const i = st.current = res.item;
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', +x.dataset.id === id));
                win.setTitle(i.number);
                const live = i.live;
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(i.subject)}</h2><div class="sub"><span class="mono accent">${esc(i.number)}</span>${stChip(i.status)}
                        <span>${esc(i.officer || '')}${i.clerk ? ' · ' + T('int_clerk') + ': ' + esc(i.clerk) : ''}</span><span class="mono">${clock(i.duration)}</span>
                        ${i.caseNo ? `<a class="mono" data-case="${i.caseId}" style="cursor:pointer">${esc(i.caseNo)}</a>` : ''}</div></div>
                        <div class="detail-actions">${i.docId ? `<button class="btn sm" data-a="doc">${icon('documents', 'sm')}${T('ints_protocol')}</button>` : ''}
                            ${i.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="int-lines grow" data-lines style="padding:12px 16px">${(i.lines || []).map(line).join('')}
                        ${i.statement ? `<div class="card" style="margin-top:12px"><div class="card-title">${T('int_p_statement')}</div><div class="md">${md(i.statement)}</div></div>` : ''}
                        ${(i.signatures || []).length ? `<div class="paper-sigs" style="margin-top:12px">${SignPad.list(i.signatures)}</div>` : ''}</div>
                    ${live ? `<div class="int-input">${i.isClerk ? `<div class="row">${['O', 'S', 'L'].map(k => `<button class="btn sm ${st.sp === k ? 'primary' : ''}" data-sp="${k}">${T('int_sp_' + k)}</button>`).join('')}
                        <span class="dim" style="font-size:11px">${T('ints_clerk_hint')}</span></div>
                        <div class="row"><input class="input" data-clerk maxlength="1000" placeholder="${T('int_type')}"><button class="btn primary" data-a="clerk">${icon('send', 'sm')}</button></div>` : ''}
                        <div class="row"><input class="input" data-note maxlength="300" placeholder="${T('ints_note_hint')}"><button class="btn" data-a="note">${icon('mail', 'sm')}${T('ints_note')}</button></div></div>` : ''}`;
                const box = $('[data-lines]', win.body);
                box.scrollTop = box.scrollHeight;
                const ci = $('[data-clerk]', win.body);
                if (ci) ci.onkeydown = e => { if (e.key === 'Enter') sendClerk(); };
                const ni = $('[data-note]', win.body);
                if (ni) ni.onkeydown = e => { if (e.key === 'Enter') sendNote(); };
            }

            async function sendClerk() {
                const inp = $('[data-clerk]', win.body);
                const text = inp.value.trim();
                if (!text) return;
                const r = await api('int:clerkLine', { id: st.current.id, speaker: st.sp, text });
                if (r.error) return UI.err(r);
                inp.value = '';
            }
            async function sendNote() {
                const inp = $('[data-note]', win.body);
                const text = inp.value.trim();
                if (!text) return;
                const r = await api('int:note', { id: st.current.id, text });
                if (r.error) return UI.err(r);
                inp.value = '';
                OS.toast({ title: T('ints_note_sent'), type: 'success', app: 'interrogations' });
            }

            win.state.live = d => {
                if (d.event === 'line' && st.current && st.current.id === d.data.id) {
                    st.current.lines.push(d.data.line);
                    const box = $('[data-lines]', win.body);
                    if (box) { box.insertAdjacentHTML('beforeend', line(d.data.line)); box.scrollTop = box.scrollHeight; }
                } else if (d.event === 'state' || d.event === 'signed') {
                    load();
                    if (st.current && st.current.id === d.data.id && !document.activeElement.closest('[data-detail]')) open(st.current.id, true);
                }
            };
            win.state.open = open;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id, true); };

            win.body.addEventListener('click', async e => {
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const sp = e.target.closest('[data-sp]');
                if (sp) { st.sp = sp.dataset.sp; $$('[data-sp]', win.body).forEach(b => b.classList.toggle('primary', b === sp)); return; }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'clerk') return sendClerk();
                if (a.dataset.a === 'note') return sendNote();
                if (a.dataset.a === 'doc') return OS.openApp('documents', { id: st.current.docId });
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('ints_confirm_delete'), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('int:delete', { id: st.current.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    $('[data-detail]', win.body).innerHTML = '';
                    return load();
                }
            });
            load().then(() => { if (args && args.id) open(+args.id); });
        },
        onArgs(win, args) { if (args.id) win.state.open(+args.id); },
        onLive(win, event, data) { if (event === 'interrogation' && win.state.live) win.state.live(data); },
    });
})();

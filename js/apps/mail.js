// ==========================================
// App: internal mail
// ==========================================
(function () {
    const ATT_APP = { case: ['cases', 'id'], document: ['documents', 'id'], photo: ['gallery', 'photo'], warrant: ['warrants', 'id'], note: ['notes', 'id'] };

    Apps.define('mail', {
        w: 1080, h: 680,
        mount(win, args) {
            const st = win.state = { folder: 'inbox', mails: [], current: null, canBroadcast: false };
            win.body.innerHTML = `<div class="app"><div class="app-body">
                <div class="app-side"><button class="btn primary" data-a="compose" style="width:100%;margin-bottom:8px">${icon('edit', 'sm')}${T('ma_compose')}</button>
                    <button class="side-item on" data-folder="inbox">${icon('inbox')}${T('ma_inbox')}<span class="n" data-unread></span></button>
                    <button class="side-item" data-folder="sent">${icon('send')}${T('ma_sent')}</button>
                    <button class="side-item" data-folder="trash">${icon('trash')}${T('ma_trash')}</button></div>
                <div class="app-list" data-list></div><div class="app-detail" data-detail></div></div></div>`;

            async function load() {
                const res = await api('mail:list', { folder: st.folder });
                if (res.error) return UI.err(res);
                st.mails = res.mails;
                st.canBroadcast = res.canBroadcast;
                $('[data-unread]', win.body).textContent = res.unread || '';
                $('[data-list]', win.body).innerHTML = st.mails.length ? st.mails.map(m => `<div class="mail-item ${m.read || st.folder !== 'inbox' ? '' : 'unread'} ${st.current && st.current.id === m.id ? 'on' : ''}" data-id="${m.id}">
                    <div class="f"><span class="ellipsis">${esc(st.folder === 'sent' ? (m.to || []).join(', ') : m.from)}</span><span>${ago(m.at)}</span></div>
                    <div class="t ellipsis">${m.attachments ? '📎 ' : ''}${esc(m.subject)}</div><div class="p">${esc(m.preview || '')}</div></div>`).join('')
                    : `<div class="empty">${icon('inbox')}${T('ma_empty')}</div>`;
                $('[data-detail]', win.body).innerHTML = st.current ? $('[data-detail]', win.body).innerHTML : `<div class="empty" style="height:100%;justify-content:center">${icon('mail')}${T('ma_pick')}</div>`;
            }

            async function open(id) {
                const res = await api('mail:get', { id });
                if (res.error) return UI.err(res);
                const m = st.current = res.mail;
                $$('[data-list] .mail-item', win.body).forEach(x => { if (+x.dataset.id === id) { x.classList.add('on'); x.classList.remove('unread'); } else x.classList.remove('on'); });
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="avatar">${initials(m.from)}</div><div class="grow"><h2>${esc(m.subject)}</h2>
                        <div class="sub"><b>${esc(m.from)}</b><span>→ ${esc((m.to || []).join(', '))}</span><span>${fmtDT(m.at)}</span></div></div>
                        <div class="detail-actions"><button class="btn sm" data-a="reply">${icon('reply', 'sm')}${T('ma_reply')}</button>
                        ${m.folder === 'trash' ? `<button class="btn sm" data-a="restore">${icon('inbox', 'sm')}${T('ma_restore')}</button><button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>`
                            : m.folder === 'inbox' ? `<button class="btn sm" data-a="trash">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body"><div class="md">${md(m.body || '')}</div>
                        ${m.attachments.length ? `<div class="row wrap">${m.attachments.map((a, i) => `<span class="attach" data-att="${i}">${icon(ATT_APP[a.kind] ? ATT_APP[a.kind][0] : 'link', 'sm')}${esc(a.label)}</span>`).join('')}</div>` : ''}</div>`;
                OS.refreshBadges();
                const un = await api('mail:unread');
                if (!un.error) $('[data-unread]', win.body).textContent = un.unread || '';
            }

            async function compose(pre = {}) {
                let to = pre.to || [], att = pre.attachments || [];
                const v = await UI.modal({
                    title: T('ma_compose'), icon: 'mail', wide: true,
                    body: `<div class="field"><label>${T('ma_to')}</label><div class="row"><div class="pick-tags grow" id="c-to"></div><button class="btn sm" id="c-pick">${icon('users', 'sm')}${T('ui_pick')}</button></div></div>
                        <div class="field"><label>${T('ma_subject')}</label><input class="input" id="c-sub" maxlength="120" value="${esc(pre.subject || '')}"></div>
                        <div class="field"><label>${T('ma_body')}</label><textarea class="textarea" id="c-body" style="min-height:200px" maxlength="4000">${esc(pre.body || '')}</textarea></div>
                        <div class="row"><div class="pick-tags grow" id="c-att"></div><button class="btn sm" id="c-case">${icon('cases', 'sm')}${T('ma_attach_case')}</button></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ma_send'), cls: 'primary', collect: el => to.length ? ({
                        to: to.map(p => p.group ? { group: p.group } : p.id), subject: $('#c-sub', el).value, body: $('#c-body', el).value,
                        attachments: att, replyTo: pre.replyTo }) : false }],
                    onOpen(el) {
                        const paint = () => {
                            $('#c-to', el).innerHTML = to.map((p, i) => `<span class="chip accent" data-rmto="${i}">${esc(p.name || p.label)} ✕</span>`).join('') || `<span class="dim">${T('ma_no_recipients')}</span>`;
                            $('#c-att', el).innerHTML = att.map((a, i) => `<span class="chip" data-rmatt="${i}">📎 ${esc(a.label)} ✕</span>`).join('');
                        };
                        paint();
                        el.addEventListener('click', e => {
                            const rt = e.target.closest('[data-rmto]');
                            if (rt) { to.splice(+rt.dataset.rmto, 1); paint(); }
                            const ra = e.target.closest('[data-rmatt]');
                            if (ra) { att.splice(+ra.dataset.rmatt, 1); paint(); }
                        });
                        $('#c-pick', el).onclick = async () => {
                            const groups = st.canBroadcast ? [{ id: 'all', label: T('ma_group_all') }].concat((OS.state.config.depts || [])) : null;
                            const p = await UI.pickOfficer({ multi: true, selected: to, groups, title: T('ma_to') });
                            if (p) { to = p; paint(); }
                        };
                        $('#c-case', el).onclick = async () => {
                            const c = await UI.pickCase();
                            if (c) { att.push({ kind: 'case', ref: String(c.id), label: c.caseNo }); paint(); }
                        };
                    },
                });
                if (!v) return;
                const r = await api('mail:send', v);
                if (r.error) return UI.err(r);
                OS.toast({ title: T('ma_sent_ok'), type: 'success', app: 'mail' });
                if (st.folder === 'sent') load();
            }
            win.state.compose = compose;
            win.state.open = open;
            win.state.reload = load;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id); };

            win.body.addEventListener('click', async e => {
                const f = e.target.closest('[data-folder]');
                if (f) {
                    st.folder = f.dataset.folder;
                    st.current = null;
                    $$('[data-folder]', win.body).forEach(b => b.classList.toggle('on', b === f));
                    return load();
                }
                const it = e.target.closest('.mail-item');
                if (it) return open(+it.dataset.id);
                const at = e.target.closest('[data-att]');
                if (at) {
                    const a = st.current.attachments[+at.dataset.att];
                    const map = ATT_APP[a.kind];
                    if (map) OS.openApp(map[0], { [map[1]]: isNaN(+a.ref) ? a.ref : +a.ref });
                    return;
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const m = st.current;
                if (a.dataset.a === 'compose') return compose();
                if (a.dataset.a === 'reply') {
                    return compose({ to: [{ id: m.fromId, name: m.from }], subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject,
                        body: `\n\n---\n> ${m.from}, ${fmtDT(m.at)}:\n> ${(m.body || '').split('\n').join('\n> ')}`, replyTo: m.id });
                }
                if (a.dataset.a === 'trash' || a.dataset.a === 'restore') {
                    const r = await api('mail:move', { id: m.id, folder: a.dataset.a === 'trash' ? 'trash' : 'inbox' });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    return load();
                }
                if (a.dataset.a === 'delete') {
                    const r = await api('mail:delete', { id: m.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    return load();
                }
            });

            load().then(() => {
                if (args && args.ref) open(+args.ref);
                if (args && args.compose) compose(args.compose);
            });
        },
        onArgs(win, args) {
            if (args.ref) win.state.open(+args.ref);
            if (args.compose) win.state.compose(args.compose);
        },
        onNotify(win) { win.state.reload && win.state.reload(); },
    });
})();

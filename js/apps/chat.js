// ==========================================
// App: unit chat (everyone / department / unit / case team / direct messages)
// ==========================================
(function () {
    const KIND_ICON = { all: 'users', dept: 'shield', unit: 'car', case: 'cases', dm: 'user' };

    function linkify(body) {
        return esc(body).replace(/(^|\s)@([^\s,.!?]+)/g, '$1<span class="mention">@$2</span>');
    }

    Apps.define('chat', {
        w: 980, h: 640,
        mount(win, args) {
            const st = win.state = { channels: [], current: null, messages: [], quick: [], me: null };
            win.body.innerHTML = `<div class="app"><div class="app-body">
                <div class="app-side" style="width:240px"><button class="btn sm" data-a="dm" style="width:100%;margin-bottom:8px">${icon('user', 'sm')}${T('ch_new_dm')}</button>
                    <div data-chans></div></div>
                <div class="grow chat-main"><div class="app-toolbar"><h3 data-title>${T('app_chat')}</h3></div>
                    <div class="chat-msgs" data-msgs></div>
                    <div class="chat-quick" data-quick></div>
                    <div class="chat-input"><input class="input" data-in maxlength="500" placeholder="${T('ch_placeholder')}">
                        <button class="btn" data-a="loc" title="${T('ch_location')}">${icon('pin', 'sm')}</button>
                        <button class="btn primary" data-a="send">${icon('send', 'sm')}</button></div></div></div></div>`;
            const input = $('[data-in]', win.body);

            async function channels() {
                const res = await api('chat:channels');
                if (res.error) return UI.err(res);
                st.channels = res.channels;
                st.quick = res.quick || [];
                st.me = res.me;
                paintChannels();
                $('[data-quick]', win.body).innerHTML = st.quick.map(q => `<button class="btn sm" data-q="${esc(q)}">${esc(q)}</button>`).join('');
            }

            function paintChannels() {
                const group = (kind, title) => {
                    const list = st.channels.filter(c => c.kind === kind || (kind === 'all' && c.kind === 'dept'));
                    if (!list.length) return '';
                    return `<div class="side-title">${title}</div>` + list.map(c => `<button class="side-item ${st.current === c.id ? 'on' : ''}" data-ch="${esc(c.id)}">
                        ${icon(KIND_ICON[c.kind] || 'users')}<span class="ellipsis">${esc(c.label)}</span>${c.unread ? `<span class="badge" style="margin-left:auto">${c.unread}</span>` : ''}</button>`).join('');
                };
                $('[data-chans]', win.body).innerHTML = group('all', T('ch_channels')) + group('unit', T('ch_units')) + group('case', T('ch_cases')) + group('dm', T('ch_direct'));
            }

            function msgHtml(m, prev) {
                const mine = m.fromId === st.me;
                const cont = prev && prev.fromId === m.fromId && m.at - prev.at < 180;
                return `<div class="msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}">${cont ? '' : `<div class="msg-h"><b>${esc(m.from)}</b><span>${fmtTime(m.at)}</span></div>`}
                    <div class="msg-b">${linkify(m.body)}</div></div>`;
            }

            function paintMessages(scroll) {
                const box = $('[data-msgs]', win.body);
                box.innerHTML = st.messages.length ? st.messages.map((m, i) => msgHtml(m, st.messages[i - 1])).join('')
                    : `<div class="empty">${icon('mail')}${T('ch_empty')}</div>`;
                if (scroll) box.scrollTop = box.scrollHeight;
            }

            async function openChannel(id, label) {
                st.current = id;
                const ch = st.channels.find(c => c.id === id);
                $('[data-title]', win.body).textContent = (ch && ch.label) || label || id;
                win.setTitle((ch && ch.label) || label);
                const res = await api('chat:history', { channel: id });
                if (res.error) return UI.err(res);
                st.messages = res.messages;
                paintMessages(true);
                markRead();
                if (ch) ch.unread = 0;
                paintChannels();
                input.focus();
            }

            function markRead() {
                const last = st.messages[st.messages.length - 1];
                if (last) api('chat:read', { channel: st.current, lastId: last.id }).then(() => OS.refreshBadges());
            }

            async function send(text) {
                text = (text || '').trim();
                if (!text || !st.current) return;
                const r = await api('chat:send', { channel: st.current, body: text });
                if (r.error) return UI.err(r);
                input.value = '';
            }

            win.state.onMessage = d => {
                if (d.channel === st.current) {
                    if (st.messages.find(m => m.id === d.msg.id)) return;
                    st.messages.push(d.msg);
                    const box = $('[data-msgs]', win.body);
                    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
                    paintMessages(atBottom || d.msg.fromId === st.me);
                    markRead();
                } else {
                    const ch = st.channels.find(c => c.id === d.channel);
                    if (ch) { ch.unread++; paintChannels(); } else channels();
                }
            };
            win.state.open = openChannel;
            win.refresh = async () => { await channels(); if (st.current) openChannel(st.current); };

            input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); });
            win.body.addEventListener('click', async e => {
                const ch = e.target.closest('[data-ch]');
                if (ch) return openChannel(ch.dataset.ch);
                const q = e.target.closest('[data-q]');
                if (q) return send(q.dataset.q);
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'send') return send(input.value);
                if (a.dataset.a === 'loc') {
                    const loc = await post('myLocation');
                    if (loc) send(`📍 ${[loc.street, loc.cross].filter(Boolean).join(' / ')}${loc.zone ? ', ' + loc.zone : ''} (${Math.round(loc.x)}, ${Math.round(loc.y)})`);
                    return;
                }
                if (a.dataset.a === 'dm') {
                    const p = await UI.pickOfficer({ title: T('ch_new_dm') });
                    if (!p) return;
                    const r = await api('chat:dm', { id: p.id });
                    if (r.error) return UI.err(r);
                    if (!st.channels.find(c => c.id === r.channel)) st.channels.push({ id: r.channel, kind: 'dm', label: r.label, unread: 0 });
                    openChannel(r.channel, r.label);
                }
            });

            channels().then(() => {
                const start = (args && args.ref) || (st.channels[0] && st.channels[0].id);
                if (start) openChannel(start);
            });
        },
        onArgs(win, args) { if (args.ref) win.state.open(args.ref); },
        onLive(win, event, data) { if (event === 'chat' && win.state.onMessage) win.state.onMessage(data); },
    });
})();

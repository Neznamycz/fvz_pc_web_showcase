// ==========================================
// App: help - user guide (texts: locales/help_*.lua, keys help_<topic>)
// General topics for everyone + a page for every app the person can open.
// ==========================================
(function () {
    const GENERAL = [
        { id: 'start', icon: 'star' }, { id: 'workflow', icon: 'list' }, { id: 'desktop', icon: 'grid' },
        { id: 'printer', icon: 'printer' }, { id: 'mobile', icon: 'car' }, { id: 'perms', icon: 'shield' },
    ];

    Apps.define('help', {
        w: 1000, h: 680,
        mount(win, args) {
            const st = win.state = { topic: (args && args.topic) || 'start', query: '' };
            win.body.innerHTML = `<div class="app"><div class="app-body"><div class="app-side" data-side style="width:230px"></div>
                <div class="app-detail" data-page></div></div></div>`;

            const appTopics = () => OS.state.apps.filter(a => !a.external && a.id !== 'help' && L['help_' + a.id]);
            const text = id => L['help_' + id] || '';

            function side() {
                const q = st.query.toLowerCase();
                const match = id => !q || (T('helpt_' + id) + ' ' + T('app_' + id) + ' ' + text(id)).toLowerCase().includes(q);
                const item = (id, ico, label) => `<button class="side-item ${st.topic === id ? 'on' : ''}" data-topic="${esc(id)}">${ico}<span class="ellipsis">${esc(label)}</span></button>`;
                $('[data-side]', win.body).innerHTML = `<div class="search" style="margin:4px 2px 8px">${icon('search')}<input class="input" data-q placeholder="${T('help_search')}" value="${esc(st.query)}"></div>
                    <div class="side-title">${T('help_general')}</div>
                    ${GENERAL.filter(g => match(g.id)).map(g => item(g.id, icon(g.icon), T('helpt_' + g.id))).join('')}
                    <div class="side-title">${T('help_apps')}</div>
                    ${appTopics().filter(a => match(a.id)).map(a => item(a.id, appIcon(a.id, 'sm'), T('app_' + a.id))).join('')}`;
                const qi = $('[data-q]', win.body);
                qi.oninput = debounce(() => {
                    st.query = qi.value;
                    side();
                    const again = $('[data-q]', win.body);
                    again.focus();
                    again.setSelectionRange(again.value.length, again.value.length);
                }, 250);
            }

            function page() {
                const isApp = !GENERAL.find(g => g.id === st.topic);
                const body = text(st.topic) || T('help_missing');
                $('[data-page]', win.body).innerHTML = `
                    <div class="detail-head">${isApp ? appIcon(st.topic, 'md') : `<div class="app-ico md" style="--c1:#16a085;--c2:#0b5345">${icon('book')}</div>`}
                        <div class="grow"><h2>${esc(isApp ? T('app_' + st.topic) : T('helpt_' + st.topic))}</h2></div>
                        ${isApp ? `<button class="btn sm primary" data-openapp="${esc(st.topic)}">${icon('ext', 'sm')}${T('help_open_app')}</button>` : ''}</div>
                    <div class="app-scroll"><div class="pad"><div class="md help-md">${md(body)}</div></div></div>`;
                win.setTitle(isApp ? T('app_' + st.topic) : T('helpt_' + st.topic));
            }

            function go(topic) {
                st.topic = topic;
                side();
                page();
            }
            win.state.go = go;

            win.body.addEventListener('click', e => {
                const t = e.target.closest('[data-topic]');
                if (t) return go(t.dataset.topic);
                const o = e.target.closest('[data-openapp]');
                if (o) OS.openApp(o.dataset.openapp);
            });

            go(st.topic);
        },
        onArgs(win, args) { if (args.topic) win.state.go(args.topic); },
    });
})();

// ==========================================
// App: audit log
// ==========================================
(function () {
    const APPS = ['system', 'cases', 'forensics', 'prisoners', 'gallery', 'warrants', 'bolo', 'penal', 'mail', 'documents', 'weapons', 'shifts', 'management', 'printer'];

    Apps.define('audit', {
        w: 1060, h: 660,
        mount(win) {
            const st = { app: '', query: '', offset: 0, rows: [] };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('au_search')}"></div>
                    <select class="select" data-app style="width:180px"><option value="">${T('ui_all')}</option>${APPS.map(a => `<option value="${a}">${T('app_' + a)}</option>`).join('')}</select>
                    <div class="grow"></div><button class="icon-btn" data-a="refresh">${icon('refresh')}</button></div>
                <div class="app-scroll" data-list></div></div>`;
            $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; st.offset = 0; load(); }, 300));
            $('[data-app]', win.body).onchange = e => { st.app = e.target.value; st.offset = 0; load(); };

            async function load(more) {
                const res = await api('audit:list', { app: st.app, query: st.query, offset: st.offset });
                if (res.error) return UI.err(res);
                st.rows = more ? st.rows.concat(res.rows) : res.rows;
                $('[data-list]', win.body).innerHTML = `<table class="tbl"><thead><tr><th style="width:140px">${T('f_date')}</th><th>${T('au_who')}</th><th>${T('au_app')}</th>
                    <th>${T('au_action')}</th><th>${T('au_target')}</th></tr></thead><tbody>${st.rows.map(r => `<tr><td class="mono dim">${fmtDT(r.at)}</td><td>${esc(r.name || '')}</td>
                    <td>${appIcon(r.app === 'bolo' ? 'warrants' : r.app === 'system' ? 'settings' : r.app, 'sm')}</td><td><span class="chip">${esc(T('aua_' + r.action) === 'aua_' + r.action ? r.action : T('aua_' + r.action))}</span></td>
                    <td class="sel-text">${esc(r.target || '')}${r.detail ? `<div class="dim" style="font-size:11px">${esc(r.detail)}</div>` : ''}</td></tr>`).join('')}</tbody></table>
                    ${res.rows.length === 60 ? `<div class="row" style="justify-content:center;padding:12px"><button class="btn sm" data-a="more">${T('ui_more')}</button></div>` : ''}`;
            }

            win.body.addEventListener('click', e => {
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'refresh') { st.offset = 0; load(); }
                if (a.dataset.a === 'more') { st.offset += 60; load(true); }
            });
            win.refresh = () => { st.offset = 0; load(); };
            load();
        },
    });
})();

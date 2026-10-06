// ==========================================
// App: armory - who holds what from the armory, log of equipment out / in / lost
// ==========================================
(function () {
    const actChip = a => `<span class="chip ${a === 'out' ? 'warn' : a === 'lost' ? 'bad' : 'ok'}">${T('arm_act_' + a)}</span>`;

    Apps.define('armory', {
        w: 1040, h: 660,
        mount(win) {
            const st = win.state = { tab: 'out', query: '' };
            win.body.innerHTML = `<div class="app"><div class="tabs"><button class="tab on" data-tab="out">${icon('armory', 'sm')}${T('arm_tab_out')}</button>
                <button class="tab" data-tab="log">${icon('list', 'sm')}${T('arm_tab_log')}</button></div>
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('arm_search')}"></div></div>
                <div class="app-scroll" data-view></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));

            async function load() {
                const r = await api('armory:overview', { query: st.query });
                if (r.error) return UI.err(r);
                const view = $('[data-view]', win.body);
                if (st.tab === 'out') {
                    const by = {};
                    r.out.forEach(o => { (by[o.identifier] = by[o.identifier] || { name: o.name, rows: [] }).rows.push(o); });
                    view.innerHTML = Object.values(by).map(p => `<div class="pad" style="padding-bottom:0"><div class="section-title">${icon('user', 'sm')}${esc(p.name)}<span class="line"></span><span class="dim">${p.rows.length}</span></div>
                        <table class="tbl"><tbody>${p.rows.map(o => `<tr><td>${esc(o.label || o.item)}${o.count > 1 ? ' ×' + o.count : ''}</td><td class="mono">${esc(o.serial || '-')}</td>
                            <td class="dim">${fmtDT(o.out_at)} · ${ago(o.out_at)}</td><td class="dim">${esc(o.point || '')}</td>
                            <td class="row" style="justify-content:flex-end">${r.can.manage ? `<button class="btn sm" data-res="${o.id}" data-act="in">${T('arm_release')}</button>
                                <button class="btn sm danger" data-res="${o.id}" data-act="lost">${T('arm_lost')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`).join('')
                        || `<div class="empty">${icon('armory')}${T('arm_nothing_out')}</div>`;
                } else {
                    view.innerHTML = r.log.length ? `<table class="tbl"><thead><tr><th>${T('f_date')}</th><th>${T('tr_person')}</th><th></th><th>${T('arm_item')}</th><th>${T('arm_serial')}</th><th>${T('f_notes')}</th></tr></thead>
                        <tbody>${r.log.map(l => `<tr><td class="dim">${fmtDT(l.at)}</td><td>${esc(l.name || '')}</td><td>${actChip(l.action)}</td><td>${esc(l.label || l.item)}${l.count > 1 ? ' ×' + l.count : ''}</td>
                            <td class="mono">${esc(l.serial || '')}</td><td class="dim">${esc(l.note || '')}${l.by_name && l.by_name !== l.name ? ' · ' + esc(l.by_name) : ''}${l.source && l.source !== 'armory' ? ' · ' + esc(l.source) : ''}</td></tr>`).join('')}</tbody></table>`
                        : `<div class="empty">${icon('list')}${T('ui_nothing_found')}</div>`;
                }
            }
            win.refresh = load;

            win.body.addEventListener('click', async e => {
                const t = e.target.closest('[data-tab]');
                if (t) { st.tab = t.dataset.tab; $$('[data-tab]', win.body).forEach(b => b.classList.toggle('on', b === t)); return load(); }
                const b = e.target.closest('[data-res]');
                if (b) {
                    const lost = b.dataset.act === 'lost';
                    const note = await UI.prompt(lost ? T('arm_lost') : T('arm_release'), '', { label: T('f_notes'), max: 255, ok: T('ui_yes') });
                    if (note === null) return;
                    const r = await api('armory:resolve', { id: +b.dataset.res, action: lost ? 'lost' : 'in', note });
                    if (r.error) return UI.err(r);
                    return load();
                }
            });
            load();
        },
    });
})();

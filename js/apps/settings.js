// ==========================================
// App: settings (wallpaper, clock, sound, account info)
// ==========================================
(function () {
    Apps.define('settings', {
        w: 820, h: 600,
        mount(win) {
            const s = OS.state.settings;
            const u = OS.state.user;
            const walls = OS.state.wallpapers || [];
            win.body.innerHTML = `<div class="app"><div class="app-scroll"><div class="pad col" style="gap:16px">
                <div class="card"><div class="card-title">${icon('user', 'sm')}${T('se_account')}</div>
                    <div class="row"><div class="avatar lg" ${bg(u.photo)}>${u.photo ? '' : initials(u.name)}</div><div class="kv grow">
                    <span>${T('ro_name')}</span><span>${esc(u.name)}</span><span>${T('ro_dept')}</span><span>${esc(u.dept)}</span>
                    <span>${T('ro_rank')}</span><span>${esc(u.gradeLabel || '')}</span><span>${T('se_role')}</span><span style="color:${esc(u.role.color)}">${esc(u.role.label)}</span>
                    <span>${T('mg_certs')}</span><span>${(u.certs || []).map(c => `<span class="chip accent">${esc(c)}</span>`).join(' ') || '-'}</span></div></div>
                    <div class="muted" style="font-size:11.5px;margin-top:10px">${T('se_perm_count', OS.perms.size)}</div></div>
                <div class="card"><div class="card-title">${icon('gallery', 'sm')}${T('se_wallpaper')}</div>
                    <div class="wall-grid">${walls.map(w => `<div class="wall ${s.wallpaper === w.id || (!s.wallpaper && w === walls[0]) ? 'on' : ''}" data-wall="${esc(w.id)}" ${bg(w.file)}></div>`).join('')}</div>
                    ${OS.state.customWallpaper ? `<div class="field" style="margin-top:12px"><label>${T('se_custom')}</label><div class="row">
                        <input class="input" data-custom maxlength="512" placeholder="https://..." value="${esc(s.customWallpaper || '')}"><button class="btn sm" data-a="custom">${T('ui_use')}</button></div></div>` : ''}</div>
                <div class="card"><div class="card-title">${icon('settings', 'sm')}${T('se_system')}</div><div class="col">
                    <label class="check"><input type="checkbox" data-opt="clock24" ${s.clock24 !== false ? 'checked' : ''}>${T('se_clock24')}</label>
                    <label class="check"><input type="checkbox" data-opt="sound" ${s.sound !== false ? 'checked' : ''}>${T('se_sound')}</label>
                    <button class="btn sm" data-a="arrange" style="align-self:flex-start">${icon('grid', 'sm')}${T('ui_arrange')}</button></div></div>
                <div class="card"><div class="card-title">${icon('db', 'sm')}${T('se_connections')}</div><div class="row wrap">
                    ${[['forensics', 'fz_forensics'], ['mugshot', 'fz_mugshot'], ['board', 'fz_evidence_board']].map(([k, n]) => `<span class="chip ${OS.state.integrations[k] ? 'ok' : ''}">
                        <span class="dot"></span>${n}</span>`).join('')}</div></div>
            </div></div></div>`;

            const save = patch => {
                Object.assign(OS.state.settings, patch);
                api('system:settings', patch);
            };
            win.body.addEventListener('click', e => {
                const w = e.target.closest('[data-wall]');
                if (w) {
                    save({ wallpaper: w.dataset.wall });
                    $$('[data-wall]', win.body).forEach(x => x.classList.toggle('on', x === w));
                    return OS.applyWallpaper();
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'custom') {
                    const url = $('[data-custom]', win.body).value.trim();
                    if (url && !/^https:\/\//.test(url)) return UI.toast(T('err_invalid_url'), 'error');
                    save({ wallpaper: url ? 'custom' : (walls[0] && walls[0].id), customWallpaper: url });
                    $$('[data-wall]', win.body).forEach(x => x.classList.remove('on'));
                    OS.applyWallpaper();
                }
                if (a.dataset.a === 'arrange') { save({ icons: {} }); OS.renderDesktop(); }
            });
            win.body.addEventListener('change', e => {
                const o = e.target.closest('[data-opt]');
                if (o) { save({ [o.dataset.opt]: o.checked }); OS.renderTaskbar(); }
            });
        },
    });
})();

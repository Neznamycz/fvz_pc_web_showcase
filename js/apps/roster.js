// ==========================================
// App: roster / units (live)
// ==========================================
(function () {
    Apps.define('roster', {
        w: 1060, h: 660,
        mount(win) {
            const st = win.state = { data: null };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><h3>${icon('roster', 'sm')} ${T('ro_online')}</h3><span class="chip" data-count></span><div class="grow"></div>
                    <span class="muted" style="font-size:11.5px">${T('ro_my_status')}</span><select class="select" data-mystatus style="width:180px"></select>
                    <button class="btn sm" data-a="unit">${icon('plus', 'sm')}${T('ro_new_unit')}</button></div>
                <div class="ros"><div class="ros-people" data-people></div><div class="ros-units" data-units></div></div></div>`;
            const sc = id => (OS.state.config.rosterStatuses.find(s => s.id === id) || {}).color || '#7f8c8d';
            const pill = id => id ? `<span class="st-pill" style="--c:${sc(id)}"><i></i>${T('ros_' + id)}</span>` : `<span class="dim">-</span>`;

            async function load() {
                const res = await api('roster:list');
                if (res.error) return UI.err(res);
                st.data = res;
                const me = res.people.find(p => p.id === res.me);
                const ms = $('[data-mystatus]', win.body);
                ms.innerHTML = `<option value="">-</option>` + res.statuses.map(s => `<option value="${esc(s.id)}">${T('ros_' + s.id)}</option>`).join('');
                ms.value = (me && me.status) || '';
                $('[data-count]', win.body).textContent = res.people.filter(p => p.onDuty).length + ' / ' + res.people.length;
                const unitName = id => (res.units.find(u => u.id === id) || {}).name;
                $('[data-people]', win.body).innerHTML = `<table class="tbl"><thead><tr><th>${T('ro_name')}</th><th>${T('ro_dept')}</th><th>${T('ro_rank')}</th>
                    <th>${T('ro_status')}</th><th>${T('ro_unit')}</th><th></th></tr></thead><tbody>${res.people.map(p => `<tr data-pid="${esc(p.id)}" style="${p.onDuty ? '' : 'opacity:.5'}">
                    <td><div class="row"><div class="avatar" style="width:28px;height:28px;font-size:10px">${initials(p.name)}</div><b>${esc(p.name)}</b>
                        ${p.pc ? `<span title="PC">${icon('mdt', 'sm')}</span>` : ''}</div></td>
                    <td>${esc(p.dept)}</td><td>${esc(p.gradeLabel || '')}</td><td>${p.onDuty ? pill(p.status) : `<span class="dim">${T('ro_off_duty')}</span>`}</td>
                    <td class="mono accent">${esc(unitName(p.unit) || '')}</td>
                    <td>${res.canManage && p.id !== res.me ? `<button class="icon-btn" data-manage="${esc(p.id)}">${icon('edit', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
                const myUnit = me && me.unit;
                $('[data-units]', win.body).innerHTML = `<div class="section-title">${T('ro_units')}<span class="line"></span></div>` + (res.units.map(u => `<div class="unit">
                    <div class="row between"><span class="n">${esc(u.name)}</span>${u.kind ? `<span class="chip">${esc(u.kind)}</span>` : ''}</div>
                    <div class="m">${u.members.map(m => esc(m.name)).join(', ') || '-'}</div>
                    <div class="row" style="margin-top:8px">${myUnit === u.id ? `<button class="btn sm" data-leave>${T('ro_leave')}</button>` : `<button class="btn sm" data-join="${esc(u.id)}">${T('ro_join')}</button>`}
                    ${res.canManage ? `<button class="btn sm danger" data-delunit="${esc(u.id)}">${icon('trash', 'sm')}</button>` : ''}</div></div>`).join('') || `<div class="empty">${T('ro_no_units')}</div>`);
            }
            win.state.reload = load;
            win.refresh = load;

            $('[data-mystatus]', win.body).onchange = async e => {
                const r = await api('roster:status', { status: e.target.value || null });
                if (r.error) UI.err(r);
            };

            win.body.addEventListener('click', async e => {
                const j = e.target.closest('[data-join]');
                if (j) { const r = await api('roster:unitJoin', { unit: j.dataset.join }); return r.error && UI.err(r); }
                if (e.target.closest('[data-leave]')) { const r = await api('roster:unitJoin', { unit: null }); return r.error && UI.err(r); }
                const d = e.target.closest('[data-delunit]');
                if (d) { const r = await api('roster:unitDelete', { unit: d.dataset.delunit }); return r.error && UI.err(r); }
                const m = e.target.closest('[data-manage]');
                if (m) {
                    const p = st.data.people.find(x => x.id === m.dataset.manage);
                    const v = await UI.modal({ title: p.name, icon: 'roster',
                        body: `<div class="field"><label>${T('ro_status')}</label><select class="select" id="m-s"><option value="">-</option>
                            ${st.data.statuses.map(s => `<option value="${esc(s.id)}" ${s.id === p.status ? 'selected' : ''}>${T('ros_' + s.id)}</option>`).join('')}</select></div>
                            <div class="field"><label>${T('ro_unit')}</label><select class="select" id="m-u"><option value="">-</option>
                            ${st.data.units.map(u => `<option value="${esc(u.id)}" ${u.id === p.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => ({ status: $('#m-s', el).value || null, unit: $('#m-u', el).value || null }) }] });
                    if (!v) return;
                    await api('roster:status', { id: p.id, status: v.status });
                    await api('roster:unitJoin', { id: p.id, unit: v.unit });
                    return;
                }
                const a = e.target.closest('[data-a="unit"]');
                if (a) {
                    const v = await UI.modal({ title: T('ro_new_unit'), icon: 'car',
                        body: `<div class="field"><label>${T('ro_callsign')}</label><input class="input mono" id="u-n" maxlength="24" placeholder="ADAM-12"></div>
                            <div class="field"><label>${T('f_type')}</label><input class="input" id="u-k" maxlength="20" placeholder="${T('ro_kind_hint')}"></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_create'), cls: 'primary', collect: el => { const n = $('#u-n', el).value.trim(); return n ? { name: n, kind: $('#u-k', el).value } : false; } }] });
                    if (!v) return;
                    const r = await api('roster:unitCreate', v);
                    if (r.error) UI.err(r);
                }
            });

            load();
            st.timer = setInterval(load, 20000);
        },
        onLive(win, event) { if (event === 'roster' && win.state.reload) win.state.reload(); },
        onClose(win) { clearInterval(win.state.timer); },
    });
})();

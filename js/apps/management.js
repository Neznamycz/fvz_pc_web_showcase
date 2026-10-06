// ==========================================
// App: department management (staff, certifications, hiring, promotions, firing)
// ==========================================
(function () {
    Apps.define('management', {
        w: 1100, h: 680,
        mount(win) {
            const st = win.state = { query: '', data: null };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('ui_search_name')}"></div><div class="grow"></div>
                    <button class="btn primary hidden" data-a="hire">${icon('plus', 'sm')}${T('mg_hire')}</button></div>
                <div class="app-scroll" data-list></div></div>`;
            $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; load(); }, 300));

            async function load() {
                const res = await api('management:staff', { query: st.query });
                if (res.error) return UI.err(res);
                st.data = res;
                $('[data-a="hire"]', win.body).classList.toggle('hidden', !res.can.hire);
                $('[data-list]', win.body).innerHTML = `<table class="tbl"><thead><tr><th>${T('ro_name')}</th><th>${T('ro_dept')}</th><th>${T('ro_rank')}</th>
                    <th>${T('mg_certs')}</th><th>${T('mg_last_login')}</th><th></th></tr></thead><tbody>${res.staff.map(p => `<tr>
                    <td><div class="row"><div class="avatar" style="width:28px;height:28px;font-size:10px">${initials(p.name)}</div><b>${esc(p.name)}</b>
                        ${p.online ? `<span class="chip ok"><span class="dot"></span>${T('ui_online')}</span>` : ''}</div></td>
                    <td>${esc(p.dept)}</td><td>${esc(p.gradeLabel)} <span class="dim">(${p.grade})</span></td>
                    <td><div class="row wrap">${res.certs.map(c => {
                        const on = p.certs.includes(c.id);
                        return res.can.certs ? `<span class="chip cert-tag ${on ? 'accent' : 'off'}" data-cert="${esc(c.id)}" data-pid="${esc(p.id)}" data-on="${on ? 1 : 0}">${esc(c.label)}</span>`
                            : (on ? `<span class="chip accent">${esc(c.label)}</span>` : '');
                    }).join('')}</div></td>
                    <td class="dim">${ago(p.lastLogin)}</td>
                    <td>${p.canChange && (res.can.promote || res.can.fire) && p.id !== res.me ? `<button class="btn sm" data-edit="${esc(p.id)}">${icon('edit', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
            }

            const gradeSelect = (grades, cur, max) => `<select class="select" id="g-sel">${grades.filter(g => max == null || g.grade < max).map(g => `<option value="${g.grade}" ${g.grade === cur ? 'selected' : ''}>${esc(g.label)} (${g.grade})</option>`).join('')}</select>`;

            win.body.addEventListener('click', async e => {
                const c = e.target.closest('[data-cert]');
                if (c) {
                    const on = c.dataset.on !== '1';
                    const r = await api('management:cert', { id: c.dataset.pid, cert: c.dataset.cert, on });
                    if (r.error) return UI.err(r);
                    return load();
                }
                const ed = e.target.closest('[data-edit]');
                if (ed) {
                    const p = st.data.staff.find(x => x.id === ed.dataset.edit);
                    const max = st.data.myJob === 'admin' ? null : st.data.myGrade;
                    const v = await UI.modal({ title: p.name, icon: 'management',
                        body: `<div class="kv"><span>${T('ro_dept')}</span><span>${esc(p.dept)}</span><span>${T('ro_rank')}</span><span>${esc(p.gradeLabel)}</span></div>
                            ${st.data.can.promote ? `<div class="field"><label>${T('mg_new_grade')}</label>${gradeSelect(st.data.grades, p.grade, max)}</div>` : ''}
                            ${!p.online && !st.data.offline ? `<div class="warn" style="font-size:12px">${T('mg_offline_hint')}</div>` : ''}`,
                        buttons: (st.data.can.fire ? [{ label: T('mg_fire'), value: 'fire', cls: 'danger' }] : []).concat([{ label: T('ui_cancel'), value: null }])
                            .concat(st.data.can.promote ? [{ label: T('mg_set_grade'), cls: 'primary', collect: el => ({ grade: +$('#g-sel', el).value }) }] : []) });
                    if (!v) return;
                    if (v === 'fire') {
                        if (!(await UI.confirm(T('mg_confirm_fire', esc(p.name)), { danger: true, ok: T('mg_fire') }))) return;
                        const r = await api('management:fire', { id: p.id });
                        if (r.error) return UI.err(r);
                    } else {
                        const r = await api('management:grade', { id: p.id, grade: v.grade });
                        if (r.error) return UI.err(r);
                    }
                    OS.toast({ title: T('mg_done'), type: 'success', app: 'management' });
                    return load();
                }
                const a = e.target.closest('[data-a="hire"]');
                if (a) {
                    const res = await api('management:candidates');
                    if (res.error) return UI.err(res);
                    let chosen = null;
                    const v = await UI.modal({ title: T('mg_hire'), icon: 'users',
                        body: `<div class="muted" style="font-size:12px">${T('mg_hire_hint')}</div><div class="pick-list">${res.list.map(p => `<div class="pick-item" data-src="${p.src}">
                            ${icon('user')}<span class="grow">${esc(p.name)}</span><span class="dim mono">#${p.src}</span></div>`).join('') || `<div class="empty">${T('mg_nobody_near')}</div>`}</div>
                            <div class="field"><label>${T('ro_rank')}</label>${gradeSelect(st.data.grades, 0, st.data.myJob === 'admin' ? null : st.data.myGrade)}</div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('mg_hire'), cls: 'primary', collect: el => chosen ? { src: chosen, grade: +$('#g-sel', el).value } : false }],
                        onOpen(el) { el.addEventListener('click', ev => { const it = ev.target.closest('[data-src]'); if (it) { chosen = +it.dataset.src; $$('[data-src]', el).forEach(x => x.classList.toggle('on', x === it)); } }); } });
                    if (!v) return;
                    const r = await api('management:hire', v);
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('mg_hired'), type: 'success', app: 'management' });
                    load();
                }
            });

            win.refresh = load;
            load();
        },
    });
})();

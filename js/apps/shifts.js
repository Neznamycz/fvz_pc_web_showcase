// ==========================================
// App: shift calendar + attendance
// ==========================================
(function () {
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    function monday(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(12, 0, 0, 0); return x; }

    Apps.define('shifts', {
        w: 1180, h: 660,
        mount(win) {
            const st = win.state = { start: monday(new Date()), tab: 'cal', data: null };
            win.body.innerHTML = `<div class="app">
                <div class="tabs"><button class="tab on" data-tab="cal">${icon('shifts', 'sm')}${T('sh_calendar')}</button>
                    ${OS.state.config.trackDuty ? `<button class="tab" data-tab="att">${icon('clock', 'sm')}${T('sh_attendance')}</button>` : ''}</div>
                <div class="app-toolbar"><button class="icon-btn" data-nav="-1">${icon('back')}</button><b data-range></b><button class="icon-btn" data-nav="1">${icon('chev')}</button>
                    <button class="btn sm" data-nav="0">${T('sh_today')}</button><div class="grow"></div>
                    <span class="chip">${T('sh_legend_open')}</span><span class="chip ok">${T('sh_legend_mine')}</span></div>
                <div class="app-scroll" data-main></div></div>`;

            function range() {
                const end = new Date(st.start);
                end.setDate(end.getDate() + 6);
                $('[data-range]', win.body).textContent = `${st.start.toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' })}`;
                return [iso(st.start), iso(end)];
            }

            async function load() {
                const [from, to] = range();
                if (st.tab === 'att') return attendance(from);
                const res = await api('shifts:list', { from, to });
                if (res.error) return UI.err(res);
                st.data = res;
                const today = iso(new Date());
                const days = [];
                for (let i = 0; i < 7; i++) { const d = new Date(st.start); d.setDate(d.getDate() + i); days.push(d); }
                $('[data-main]', win.body).innerHTML = `<div class="cal">${days.map(d => {
                    const key = iso(d);
                    const list = res.shifts.filter(s => s.day === key);
                    return `<div class="cal-day ${key === today ? 'today' : ''}"><div class="h"><b>${d.toLocaleDateString(LOCALE(), { weekday: 'short' })}</b><span>${d.getDate()}.${d.getMonth() + 1}.</span></div>
                        <div class="b">${list.map(s => `<div class="shift ${!s.assigneeId ? 'open' : s.assigneeId === res.me ? 'mine' : ''}" data-sid="${s.id}">
                            <b>${esc(s.start)}–${esc(s.finish)}</b>${esc(s.title)}<div class="dim">${esc(s.assignee || T('sh_open'))}</div></div>`).join('')}
                        ${res.canPlan ? `<button class="btn sm ghost" data-add="${key}" style="margin-top:auto">${icon('plus', 'sm')}</button>` : ''}</div></div>`;
                }).join('')}</div>`;
            }

            async function attendance(week) {
                const res = await api('shifts:attendance', { week });
                if (res.error) return UI.err(res);
                const max = Math.max(1, ...res.rows.map(r => r.minutes));
                const hrs = m => `${Math.floor(m / 60)} h ${m % 60} min`;
                $('[data-main]', win.body).innerHTML = res.rows.length ? `<table class="tbl"><thead><tr><th>${T('ro_name')}</th><th>${T('ro_dept')}</th><th style="width:40%"></th><th>${T('sh_time')}</th></tr></thead>
                    <tbody>${res.rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.dept)}</td><td><div class="bar-h"><i style="width:${(r.minutes / max) * 100}%"></i></div></td>
                    <td class="mono">${hrs(r.minutes)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${icon('clock')}${T('sh_no_attendance')}</div>`;
            }

            async function shiftForm(s = {}) {
                let who = s.assigneeId ? { id: s.assigneeId, name: s.assignee } : null;
                const v = await UI.modal({
                    title: s.id ? T('sh_edit') : T('sh_new'), icon: 'shifts',
                    body: `<div class="grid3"><div class="field"><label>${T('f_date')}</label><input class="input" id="s-d" type="date" value="${esc(s.day || '')}"></div>
                        <div class="field"><label>${T('sh_from')}</label><input class="input" id="s-a" type="time" value="${esc(s.start || '08:00')}"></div>
                        <div class="field"><label>${T('sh_to')}</label><input class="input" id="s-b" type="time" value="${esc(s.finish || '16:00')}"></div></div>
                        <div class="field"><label>${T('f_title')}</label><input class="input" id="s-t" maxlength="80" value="${esc(s.title || '')}" placeholder="${T('sh_title_hint')}"></div>
                        <div class="field"><label>${T('sh_assignee')}</label><div class="row"><span class="chip accent" id="s-w">${esc(s.assignee || T('sh_open'))}</span>
                            <button class="btn sm" id="s-pick">${icon('user', 'sm')}${T('ui_pick')}</button><button class="btn sm" id="s-clear">${T('sh_make_open')}</button></div></div>
                        <div class="field"><label>${T('f_note')}</label><input class="input" id="s-n" maxlength="255" value="${esc(s.note || '')}"></div>`,
                    buttons: (s.id ? [{ label: T('ui_delete'), value: 'delete', cls: 'danger' }] : []).concat([{ label: T('ui_cancel'), value: null },
                        { label: T('ui_save'), cls: 'primary', collect: el => ({ id: s.id, day: $('#s-d', el).value, start: $('#s-a', el).value, finish: $('#s-b', el).value,
                            title: $('#s-t', el).value, assigneeId: who ? who.id : null, note: $('#s-n', el).value }) }]),
                    onOpen(el) {
                        $('#s-pick', el).onclick = async () => { const p = await UI.pickOfficer(); if (p) { who = p; $('#s-w', el).textContent = p.name; } };
                        $('#s-clear', el).onclick = () => { who = null; $('#s-w', el).textContent = T('sh_open'); };
                    },
                });
                if (v === 'delete') {
                    const r = await api('shifts:delete', { id: s.id });
                    if (r.error) return UI.err(r);
                } else if (v) {
                    const r = await api('shifts:save', v);
                    if (r.error) return UI.err(r);
                } else return;
                load();
            }

            win.body.addEventListener('click', async e => {
                const tab = e.target.closest('[data-tab]');
                if (tab) { st.tab = tab.dataset.tab; $$('[data-tab]', win.body).forEach(b => b.classList.toggle('on', b === tab)); return load(); }
                const nav = e.target.closest('[data-nav]');
                if (nav) {
                    const n = +nav.dataset.nav;
                    if (n === 0) st.start = monday(new Date()); else st.start.setDate(st.start.getDate() + n * 7);
                    return load();
                }
                const add = e.target.closest('[data-add]');
                if (add) return shiftForm({ day: add.dataset.add });
                const sh = e.target.closest('[data-sid]');
                if (sh) {
                    const s = st.data.shifts.find(x => x.id === +sh.dataset.sid);
                    if (st.data.canPlan) return shiftForm(s);
                    if (!s.assigneeId) {
                        if (!(await UI.confirm(T('sh_confirm_take', esc(s.day + ' ' + s.start))))) return;
                        const r = await api('shifts:take', { id: s.id });
                        if (r.error) return UI.err(r);
                    } else if (s.assigneeId === st.data.me) {
                        if (!(await UI.confirm(T('sh_confirm_leave')))) return;
                        const r = await api('shifts:take', { id: s.id, leave: true });
                        if (r.error) return UI.err(r);
                    } else return;
                    load();
                }
            });

            win.refresh = load;
            load();
        },
    });
})();

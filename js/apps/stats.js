// ==========================================
// App: statistics for command (arrests, cases, warrants, hours on duty)
// Single-series charts in the accent colour; tooltips on hover; horizontal bars carry their values as labels.
// ==========================================
(function () {
    // Column chart (one series per day). data = [{ day: 'YYYY-MM-DD', n }]
    function columns(data, label) {
        const W = 560, H = 170, pad = { l: 28, r: 6, t: 10, b: 22 };
        const max = Math.max(1, ...data.map(d => d.n));
        const step = (W - pad.l - pad.r) / Math.max(1, data.length);
        const bw = Math.max(2, Math.min(step - 2, 22));
        const y = n => pad.t + (H - pad.t - pad.b) * (1 - n / max);
        const ticks = [0, Math.ceil(max / 2), max];
        const every = Math.ceil(data.length / 8);
        const bars = data.map((d, i) => {
            const x = pad.l + i * step + (step - bw) / 2, top = y(d.n), h = H - pad.b - top;
            const r = Math.min(4, bw / 2, h);
            const path = h > 0 ? `M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z` : '';
            return `<g class="bar" data-tip="${esc(fmtShortDay(d.day))}: ${d.n} ${esc(label)}"><rect x="${pad.l + i * step}" y="${pad.t}" width="${step}" height="${H - pad.t - pad.b}" fill="transparent"/>
                ${path ? `<path d="${path}" fill="var(--accent)"/>` : ''}</g>`;
        }).join('');
        const xl = data.map((d, i) => i % every === 0 ? `<text x="${pad.l + i * step + step / 2}" y="${H - 6}" text-anchor="middle">${esc(fmtShortDay(d.day))}</text>` : '').join('');
        const grid = ticks.map(t => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 6}" y="${y(t) + 3}" text-anchor="end">${t}</text>`).join('');
        return `<div class="chart"><svg viewBox="0 0 ${W} ${H}"><g class="grid">${grid}</g>${bars}<g class="xl">${xl}</g></svg><div class="chart-tip hidden"></div></div>`;
    }

    function fmtShortDay(day) {
        const [y, m, d] = day.split('-');
        return `${+d}. ${+m}.`;
    }

    // Horizontal bars with the value as a direct label. rows = [{ name, n }]
    function hbars(rows, fmt) {
        if (!rows || !rows.length) return `<div class="empty" style="padding:16px">-</div>`;
        const max = Math.max(1, ...rows.map(r => r.n));
        return `<div class="hbars">${rows.map(r => `<div class="hb"><span class="hb-l ellipsis">${esc(r.name)}</span>
            <div class="hb-t"><i style="width:${Math.max(2, (r.n / max) * 100)}%"></i></div><span class="hb-v mono">${esc(fmt ? fmt(r.n) : r.n)}</span></div>`).join('')}</div>`;
    }

    const hrs = m => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

    Apps.define('stats', {
        w: 1120, h: 720,
        mount(win) {
            const st = win.state = { range: 'week', dept: '' };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar"><div class="row" data-ranges>${['week', 'month', 'all'].map(r => `<button class="btn sm ${r === 'week' ? 'primary' : ''}" data-r="${r}">${T('st_' + r)}</button>`).join('')}</div>
                    <select class="select" data-dept style="width:160px"><option value="">${T('st_all_depts')}</option></select><span class="dim" style="font-size:11px">${T('st_dept_hint')}</span></div>
                <div class="app-scroll"><div class="pad col" style="gap:14px" data-body><div class="loading"><div class="spinner"></div></div></div></div></div>`;

            async function load() {
                const res = await api('stats:overview', { range: st.range, dept: st.dept });
                if (res.error) return UI.err(res);
                const dsel = $('[data-dept]', win.body);
                if (dsel.options.length === 1) dsel.innerHTML += res.depts.map(d => `<option value="${esc(d.id)}">${esc(d.label)}</option>`).join('');
                const tile = (v, l, i) => `<div class="stat"><div class="row between"><b>${v}</b>${icon(i, 'sm')}</div><span>${l}</span></div>`;
                const a = res.arrests;
                $('[data-body]', win.body).innerHTML = `
                    <div class="stats">${a ? tile(a.total, T('st_arrests'), 'prisoners') : ''}${tile(res.cases.created, T('st_cases_new'), 'cases')}
                        ${tile(res.cases.closed, T('st_cases_closed'), 'check')}${tile(res.cases.open, T('st_cases_open'), 'folder')}
                        ${tile(res.warrants.requested, T('st_warrants'), 'gavel')}${tile(res.warrants.bolos, T('st_bolos'), 'eye')}
                        ${tile(res.documents, T('st_documents'), 'documents')}${tile(hrs(res.totalMinutes), T('st_hours'), 'clock')}</div>
                    <div class="grid2">
                        ${a ? `<div class="card"><div class="card-title">${icon('prisoners', 'sm')}${T('st_arrests_day')}</div>${columns(res.arrestsByDay, T('st_arrests_u'))}</div>` : ''}
                        <div class="card"><div class="card-title">${icon('cases', 'sm')}${T('st_cases_day')}</div>${columns(res.casesByDay, T('st_cases_u'))}</div>
                    </div>
                    <div class="grid3">
                        ${a ? `<div class="card"><div class="card-title">${icon('user', 'sm')}${T('st_top_arrests')}</div>${hbars(a.byOfficer)}</div>` : ''}
                        <div class="card"><div class="card-title">${icon('check', 'sm')}${T('st_top_closed')}</div>${hbars(res.topLeads)}</div>
                        <div class="card"><div class="card-title">${icon('clock', 'sm')}${T('st_top_hours')}</div>${hbars(res.hours.map(h => ({ name: `${h.name} · ${h.dept}`, n: h.minutes })), hrs)}</div>
                    </div>
                    ${a ? `<div class="card"><div class="card-title">${icon('penal', 'sm')}${T('st_top_charges')}</div>${hbars(a.topCharges.map(c => ({ name: c.label, n: c.n })))}</div>` : ''}`;
            }
            win.refresh = load;

            win.body.addEventListener('click', e => {
                const r = e.target.closest('[data-r]');
                if (r) {
                    st.range = r.dataset.r;
                    $$('[data-r]', win.body).forEach(b => b.classList.toggle('primary', b === r));
                    load();
                }
            });
            $('[data-dept]', win.body).onchange = e => { st.dept = e.target.value; load(); };
            // tooltip of the column charts
            win.body.addEventListener('mousemove', e => {
                const g = e.target.closest('.bar');
                const chart = e.target.closest('.chart');
                $$('.chart-tip', win.body).forEach(t => { if (!chart || !chart.contains(t)) t.classList.add('hidden'); });
                if (!g) $$('.bar.dim', win.body).forEach(b => b.classList.remove('dim'));
                if (!g || !chart) return;
                const tip = $('.chart-tip', chart), r = chart.getBoundingClientRect();
                tip.textContent = g.dataset.tip;
                tip.style.left = (e.clientX - r.left + 12) + 'px';
                tip.style.top = (e.clientY - r.top - 28) + 'px';
                tip.classList.remove('hidden');
                $$('.bar', chart).forEach(b => b.classList.toggle('dim', b !== g));
            });
            win.body.addEventListener('mouseleave', () => $$('.bar.dim', win.body).forEach(b => b.classList.remove('dim')));
            load();
        },
    });
})();

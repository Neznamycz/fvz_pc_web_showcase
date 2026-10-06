// ==========================================
// App: court - court cases (file, schedule, hearing notes, verdict + signature), calendar, court orders, bail
// ==========================================
(function () {
    const STATUSES = ['filed', 'scheduled', 'in_session', 'decided', 'appeal', 'closed'];
    const stChip = s => `<span class="chip ${s === 'decided' || s === 'closed' ? 'ok' : s === 'in_session' ? 'bad' : s === 'appeal' ? 'warn' : 'info'}">${T('court_status_' + s)}</span>`;
    function toLocalInput(ts) {
        const d = new Date((ts || Date.now() / 1000) * 1000), z = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
    }

    // picker of a court party (judge / prosecutor / defense)
    async function pickParty(kind) {
        return UI.modal({
            title: T('court_pick_' + kind), icon: 'users',
            body: `<div class="search">${icon('search')}<input class="input" id="cp-q"></div><div class="pick-list" id="cp-l"></div>`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('court_nobody'), value: { id: '' } }],
            onOpen(el, close) {
                const load = async q => {
                    const r = await api('court:parties', { kind, query: q });
                    const list = (r && r.list) || [];
                    $('#cp-l', el).innerHTML = list.map((p, i) => `<div class="pick-item" data-i="${i}"><div class="avatar">${initials(p.name)}</div><span class="grow">${esc(p.name)}</span>
                        <span class="dim">${esc(p.dept)}</span>${p.online ? `<span class="chip ok">${T('ui_online')}</span>` : ''}</div>`).join('') || `<div class="empty">${T('ui_nothing_found')}</div>`;
                    el.onclick = e => { const it = e.target.closest('[data-i]'); if (it) close(list[+it.dataset.i]); };
                };
                $('#cp-q', el).addEventListener('input', debounce(e => load(e.target.value), 250));
                load('');
            },
        });
    }

    // Filing from other apps (case book, prisoners): CourtFile({ caseId, caseNo, title, bookingNo, defendant, bookingCharges })
    window.CourtFile = async function (pre = {}) {
        let defendant = pre.defendant || null, charges = [];
        const v = await UI.modal({
            title: T('court_file'), icon: 'penal', wide: true,
            body: `<div class="muted" style="font-size:12px">${T('court_file_hint')}</div>
                <div class="field"><label>${T('f_title')}</label><input class="input" id="cf-t" maxlength="160" value="${esc(pre.title || '')}"></div>
                <div class="field"><label>${T('court_defendant')}</label><div class="row"><input class="input" id="cf-d" maxlength="80" value="${esc(defendant ? defendant.name : '')}">
                    <button class="btn sm" id="cf-dp">${icon('user', 'sm')}${T('ui_pick')}</button></div></div>
                <div class="field"><label>${T('pr_charges')}</label>${pre.bookingCharges && pre.bookingCharges.length ? `<div class="pick-tags">${pre.bookingCharges.map(c => `<span class="chip">${esc(c.code || '')} ${esc(c.label || '')} ×${c.count || 1}</span>`).join('')}</div>
                    <div class="dim" style="font-size:11px">${T('court_from_booking')}</div>` : ''}
                    <div class="pick-tags" id="cf-ch"></div><button class="btn sm" id="cf-add" style="align-self:flex-start">${icon('plus', 'sm')}${T('pr_from_penal')}</button></div>
                <div class="field"><label>${T('f_summary')}</label><textarea class="textarea" id="cf-s" maxlength="4000"></textarea></div>
                <div class="dim" style="font-size:11.5px">${pre.caseNo ? T('f_case_no') + ': ' + esc(pre.caseNo) : ''}${pre.bookingNo ? ' · ' + esc(pre.bookingNo) : ''}</div>`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('court_file'), cls: 'primary', collect: el => {
                const title = $('#cf-t', el).value.trim(), name = $('#cf-d', el).value.trim();
                if (!title || !name) return false;
                return { title, defendant: { id: defendant && defendant.name === name ? defendant.id : null, name }, summary: $('#cf-s', el).value,
                    charges: charges.map(c => ({ id: c.id, count: c.count })), bookingCharges: pre.bookingCharges, caseId: pre.caseId, bookingNo: pre.bookingNo };
            } }],
            onOpen(el) {
                const paint = () => { $('#cf-ch', el).innerHTML = charges.map((c, i) => `<span class="chip accent" data-rm="${i}">${esc(c.code)} ×${c.count} ✕</span>`).join(''); };
                $('#cf-dp', el).onclick = async () => { const p = await UI.pickCitizen(); if (p) { defendant = p; $('#cf-d', el).value = p.name; } };
                $('#cf-add', el).onclick = async () => { const p = await UI.pickCharges(charges); if (p) { charges = p; paint(); } };
                el.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) { charges.splice(+rm.dataset.rm, 1); paint(); } });
            },
        });
        if (!v) return null;
        const r = await api('court:file', v);
        if (r.error) { UI.err(r); return null; }
        OS.toast({ title: T('court_filed'), text: r.number, type: 'success', app: 'court' });
        return r;
    };

    Apps.define('court', {
        w: 1120, h: 700,
        mount(win, args) {
            const st = win.state = { tab: 'cases', filter: 'active', query: '', current: null, can: {}, courtrooms: [] };
            win.body.innerHTML = `<div class="app">
                <div class="tabs">${['cases', 'calendar', 'orders'].map(t => `<button class="tab ${t === 'cases' ? 'on' : ''}" data-tab="${t}">${icon(t === 'cases' ? 'penal' : t === 'calendar' ? 'shifts' : 'gavel', 'sm')}${T('court_tab_' + t)}</button>`).join('')}</div>
                <div data-view style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>`;

            function casesView() {
                $('[data-view]', win.body).innerHTML = `<div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="${T('court_search')}" value="${esc(st.query)}"></div>
                    <select class="select" data-f style="width:170px">${['active', 'mine', 'decided', 'all'].map(f => `<option value="${f}" ${st.filter === f ? 'selected' : ''}>${T('court_f_' + f)}</option>`).join('')}</select>
                    <div class="grow"></div><button class="btn primary hidden" data-a="file">${icon('plus', 'sm')}${T('court_file')}</button></div>
                    <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail><div class="empty" style="height:100%;justify-content:center">${icon('penal')}${T('court_pick')}</div></div></div>`;
                $('[data-q]', win.body).addEventListener('input', debounce(e => { st.query = e.target.value; loadCases(); }, 300));
                $('[data-f]', win.body).onchange = e => { st.filter = e.target.value; loadCases(); };
                loadCases().then(() => { if (st.current) open(st.current.id, true); });
            }

            async function loadCases() {
                const res = await api('court:list', { filter: st.filter, query: st.query });
                if (res.error) return UI.err(res);
                st.can = res.can;
                st.courtrooms = res.courtrooms || [];
                const fb = $('[data-a="file"]', win.body);
                if (fb) fb.classList.toggle('hidden', !st.can.file);
                const list = $('[data-list]', win.body);
                if (!list) return;
                list.innerHTML = res.list.length ? res.list.map(c => `<div class="list-item ${st.current && st.current.id === c.id ? 'active' : ''}" data-id="${c.id}">
                    ${icon('penal')}<div class="grow"><div class="row between"><span class="t ellipsis">${esc(c.defendant.name)}</span>${stChip(c.status)}</div>
                    <div class="s mono">${esc(c.number)}${c.caseNo ? ' · ' + esc(c.caseNo) : ''}</div>
                    <div class="s">${c.hearingAt ? icon('clock', 'sm') + ' ' + fmtDT(c.hearingAt) + (c.courtroom ? ' · ' + esc(c.courtroom) : '') : esc(c.title)}</div></div></div>`).join('')
                    : `<div class="empty">${icon('penal')}${T('court_empty')}</div>`;
            }

            async function open(id, silent) {
                const res = await api('court:get', { id, refresh: !!silent });
                if (res.error) return silent ? null : UI.err(res);
                const c = st.current = res.item;
                win.setTitle(c.number);
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', +x.dataset.id === id));
                const fine = (c.charges || []).reduce((s, x) => s + (x.fine || 0) * (x.count || 1), 0);
                const jail = (c.charges || []).reduce((s, x) => s + (x.jail || 0) * (x.count || 1), 0);
                st.suggest = { fine, jail };
                const m = c.can.manage;
                const det = $('[data-detail]', win.body);
                if (!det) return;
                det.innerHTML = `
                    <div class="detail-head court-head">${c.booking && c.booking.photo ? `<div class="photo" style="width:56px;height:70px;flex-shrink:0" ${bg(c.booking.photo)}></div>` : ''}
                        <div class="grow"><h2>${esc(c.defendant.name)}</h2><div class="sub"><span class="mono accent">${esc(c.number)}</span>${stChip(c.status)}<span>${esc(c.title)}</span>
                        ${c.caseNo ? `<a class="mono" data-case="${c.caseId}" style="cursor:pointer">${esc(c.caseNo)}</a>` : ''}</div></div>
                        <div class="detail-actions">
                            ${m ? `<button class="btn sm" data-a="schedule">${icon('shifts', 'sm')}${T('court_schedule')}</button>
                                <select class="select" data-status style="width:150px">${STATUSES.map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${T('court_status_' + s)}</option>`).join('')}</select>
                                ${c.status !== 'closed' ? `<button class="btn sm primary" data-a="verdict">${icon('gavel', 'sm')}${T('court_verdict')}</button>` : ''}
                                <button class="btn sm" data-a="bail">${T('court_bail')}</button>` : ''}
                            ${c.can.orders ? `<button class="btn sm" data-a="order">${icon('warn', 'sm')}${T('court_order')}</button>` : ''}
                            <button class="btn sm" data-a="print">${icon('printer', 'sm')}</button>
                            ${m && OS.state.config.archive ? `<button class="btn sm" data-a="export">${icon('send', 'sm')}</button>` : ''}
                            ${c.can.delete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body">
                        <div class="grid2"><div class="card"><div class="kv">
                            <span>${T('court_judge')}</span><span>${esc(c.judge ? c.judge.name : '-')}</span>
                            <span>${T('court_prosecutor')}</span><span>${esc(c.prosecutor ? c.prosecutor.name : '-')}</span>
                            <span>${T('court_defense')}</span><span>${esc(c.defense ? c.defense.name : '-')}</span>
                            <span>${T('court_hearing')}</span><span>${c.hearingAt ? fmtDT(c.hearingAt) + ' · ' + esc(c.courtroom || '') : '-'}</span>
                            <span>${T('court_filed_by')}</span><span>${esc(c.filedBy || '-')} · ${fmtDate(c.createdAt)}</span>
                            ${c.bailStatus ? `<span>${T('court_bail')}</span><span>${money(c.bailAmount)} · ${T('bail_' + c.bailStatus)}</span>` : ''}
                            ${c.booking ? `<span>${T('link_booking')}</span><span class="mono">${esc(c.booking.bookingNo)}${c.booking.status ? ' · ' + esc(T('pstatus_' + c.booking.status)) : ''}</span>` : ''}</div></div>
                            <div class="card"><div class="card-title">${icon('users', 'sm')}${T('court_witnesses')}</div>
                            ${(c.witnesses || []).map(w => `<div class="row between" style="padding:3px 0"><span>${esc(w.name)}</span>${c.hearingAt ? `<button class="btn sm ghost" data-summon="${esc(w.name)}">${icon('printer', 'sm')}${T('court_summons')}</button>` : ''}</div>`).join('') || `<span class="dim">-</span>`}
                            ${c.hearingAt ? `<button class="btn sm" data-summon="${esc(c.defendant.name)}" data-role="defendant" style="margin-top:8px">${icon('printer', 'sm')}${T('court_summons_defendant')}</button>` : ''}</div></div>
                        <div class="card"><div class="card-title">${icon('penal', 'sm')}${T('pr_charges')}<span class="grow"></span><span class="dim" style="text-transform:none;letter-spacing:0">${T('court_suggest', money(fine), jail)}</span></div>
                            ${(c.charges || []).length ? `<table class="tbl"><tbody>${c.charges.map(x => `<tr><td class="mono accent" style="width:100px">${esc(x.code || '')}</td><td>${esc(x.label || '')}</td><td style="width:40px">×${x.count || 1}</td></tr>`).join('')}</tbody></table>` : `<span class="dim">-</span>`}</div>
                        ${c.summary ? `<div class="card"><div class="card-title">${T('f_summary')}</div><div class="md">${md(c.summary)}</div></div>` : ''}
                        ${c.verdict ? `<div class="card verdict-card"><div class="card-title">${icon('gavel', 'sm')}${T('court_verdict')} · ${fmtDT(c.verdictAt)}</div>
                            <div style="font-size:16px;font-weight:800">${T('verdict_' + c.verdict)}</div>
                            ${c.verdict !== 'not_guilty' ? `<div>${T('court_sentence', c.months || 0, money(c.fine))}</div>` : ''}
                            ${c.verdictText ? `<div class="md" style="margin-top:8px">${md(c.verdictText)}</div>` : ''}
                            ${c.signature ? `<div class="paper-sigs">${SignPad.list([{ name: c.judge ? c.judge.name : '', at: c.verdictAt, path: c.signature, role: 'judge' }])}</div>` : ''}</div>` : ''}
                        <div class="card"><div class="card-title">${icon('notes', 'sm')}${T('court_notes')}</div>
                            ${c.can.notes ? `<textarea class="textarea" data-notes maxlength="8000" style="min-height:120px">${esc(c.notes || '')}</textarea>
                                <button class="btn sm" data-a="saveNotes" style="align-self:flex-start;margin-top:6px">${icon('check', 'sm')}${T('ui_save')}</button>` : `<div class="md">${md(c.notes || '-')}</div>`}</div>
                        ${(c.orders || []).length ? `<div class="card"><div class="card-title">${icon('warn', 'sm')}${T('court_tab_orders')}</div>${c.orders.map(o => `<div class="list-item" data-order="${o.id}">
                            <span class="mono">${esc(o.number)}</span><span class="grow">${T('order_' + o.kind)} · ${esc(o.subject_name)}</span><span class="chip">${T('order_status_' + o.status)}</span></div>`).join('')}</div>` : ''}
                    </div>`;
                const ss = $('[data-status]', win.body);
                if (ss) ss.onchange = async () => {
                    const r = await api('court:status', { id: c.id, status: ss.value });
                    if (r.error) return UI.err(r);
                    open(c.id);
                };
            }

            async function schedule(c) {
                let judge = c.judge, pros = c.prosecutor, def = c.defense;
                const witnesses = (c.witnesses || []).slice();
                const cur = k => (k === 'judge' ? judge : k === 'prosecutor' ? pros : def);
                const v = await UI.modal({
                    title: T('court_schedule'), icon: 'shifts', wide: true,
                    body: `<div class="grid2"><div class="field"><label>${T('court_hearing')}</label><input class="input" type="datetime-local" id="cs-at" value="${c.hearingAt ? toLocalInput(c.hearingAt) : ''}"></div>
                        <div class="field"><label>${T('court_room')}</label><select class="select" id="cs-room">${st.courtrooms.map(r => `<option ${r === c.courtroom ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div></div>
                        <div class="grid3">${['judge', 'prosecutor', 'defense'].map(k => `<div class="field"><label>${T('court_' + k)}</label><div class="row"><span class="chip accent" id="cs-${k}">${esc(cur(k) ? cur(k).name : '-')}</span>
                            <button class="btn sm" data-party="${k}">${icon('user', 'sm')}</button></div></div>`).join('')}</div>
                        <div class="field"><label>${T('court_witnesses')}</label><div class="pick-tags" id="cs-w"></div><button class="btn sm" id="cs-wadd" style="align-self:flex-start">${icon('plus', 'sm')}${T('court_add_witness')}</button></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                        const at = $('#cs-at', el).value ? Math.floor(new Date($('#cs-at', el).value).getTime() / 1000) : null;
                        return { hearingAt: at, courtroom: $('#cs-room', el).value, judge: judge ? judge.id : '', prosecutor: pros ? pros.id : '', defense: def ? def.id : '', witnesses };
                    } }],
                    onOpen(el) {
                        const paint = () => { $('#cs-w', el).innerHTML = witnesses.map((w, i) => `<span class="chip accent" data-rm="${i}">${esc(w.name)} ✕</span>`).join(''); };
                        paint();
                        el.addEventListener('click', async e => {
                            const rm = e.target.closest('[data-rm]');
                            if (rm) { witnesses.splice(+rm.dataset.rm, 1); paint(); }
                            const pb = e.target.closest('[data-party]');
                            if (pb) {
                                const k = pb.dataset.party;
                                const p = await pickParty(k);
                                if (!p) return;
                                const val = p.id ? { id: p.id, name: p.name } : null;
                                if (k === 'judge') judge = val; else if (k === 'prosecutor') pros = val; else def = val;
                                $('#cs-' + k, el).textContent = val ? val.name : '-';
                            }
                        });
                        $('#cs-wadd', el).onclick = async () => { const p = await UI.pickCitizen({ title: T('court_add_witness') }); if (p) { witnesses.push({ id: p.id, name: p.name }); paint(); } };
                    },
                });
                if (!v) return;
                const r = await api('court:update', { id: c.id, ...v });
                if (r.error) return UI.err(r);
                open(c.id);
            }

            async function verdict(c) {
                const v = await UI.modal({
                    title: T('court_verdict'), icon: 'gavel', wide: true,
                    body: `<div class="grid3"><div class="field"><label>${T('court_verdict')}</label><select class="select" id="cv-v">${['guilty', 'partial', 'not_guilty'].map(x => `<option value="${x}">${T('verdict_' + x)}</option>`).join('')}</select></div>
                        <div class="field"><label>${T('pe_jail')} (${T('months')})</label><input class="input" type="number" min="0" id="cv-m" value="${st.suggest.jail}"></div>
                        <div class="field"><label>${T('pe_fine')}</label><input class="input" type="number" min="0" id="cv-f" value="${st.suggest.fine}"></div></div>
                        <div class="field"><label>${T('court_reasoning')}</label><textarea class="textarea" id="cv-t" style="min-height:180px" maxlength="8000"></textarea></div>
                        <div class="muted" style="font-size:12px">${T('court_verdict_hint')}</div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('court_sign_verdict'), cls: 'primary', collect: el => ({
                        verdict: $('#cv-v', el).value, months: +$('#cv-m', el).value || 0, fine: +$('#cv-f', el).value || 0, text: $('#cv-t', el).value }) }],
                });
                if (!v) return;
                const path = await SignPad.open({ title: T('court_sign_verdict'), text: `**${esc(c.number)}** · ${esc(c.defendant.name)} · ${T('verdict_' + v.verdict)}` });
                if (!path) return;
                const r = await api('court:verdict', { id: c.id, ...v, path });
                if (r.error) return UI.err(r);
                OS.toast({ title: T('court_verdict_saved'), text: c.number, type: 'success', app: 'court' });
                open(c.id);
            }

            async function issueOrder(c) {
                const v = await UI.modal({
                    title: T('court_order'), icon: 'warn',
                    body: `<div class="field"><label>${T('f_type')}</label><select class="select" id="co-k"><option value="restraining">${T('order_restraining')}</option><option value="release">${T('order_release')}</option></select></div>
                        <div class="field"><label>${T('f_subject')}</label><input class="input" id="co-s" maxlength="80" value="${esc(c ? c.defendant.name : '')}"></div>
                        <div class="grid2"><div class="field"><label>${T('order_protected')}</label><input class="input" id="co-p" maxlength="80"></div>
                        <div class="field"><label>${T('order_distance')} (m)</label><input class="input" type="number" id="co-d" value="50"></div></div>
                        <div class="field"><label>${T('order_days')}</label><input class="input" type="number" id="co-v" value="30"></div>
                        <div class="field"><label>${T('f_description')}</label><textarea class="textarea" id="co-t" maxlength="3000"></textarea></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('court_sign_order'), cls: 'primary', collect: el => {
                        const s = $('#co-s', el).value.trim();
                        return s ? { kind: $('#co-k', el).value, subject: s, subjectId: c && c.defendant.name === s ? c.defendant.id : null, protectedName: $('#co-p', el).value,
                            distance: +$('#co-d', el).value || 0, days: +$('#co-v', el).value || 0, details: $('#co-t', el).value } : false;
                    } }],
                });
                if (!v) return;
                const path = await SignPad.open({ title: T('court_sign_order'), text: `${T('order_' + v.kind)} · ${esc(v.subject)}` });
                if (!path) return;
                const r = await api('court:order', { courtId: c ? c.id : null, ...v, path });
                if (r.error) return UI.err(r);
                OS.toast({ title: T('court_order_saved'), text: r.number, type: 'success', app: 'court' });
                if (c) open(c.id); else ordersView();
            }

            async function calendarView() {
                const now = Math.floor(Date.now() / 1000);
                const res = await api('court:calendar', { from: now - 86400, to: now + 86400 * 21 });
                if (res.error) return UI.err(res);
                let day = '';
                $('[data-view]', win.body).innerHTML = `<div class="app-scroll"><div class="pad">${res.list.length ? res.list.map(h => {
                    const d = fmtDate(h.hearing_at), head = d !== day ? `<div class="tl2-day" style="padding-left:0">${esc(d)}</div>` : '';
                    day = d;
                    return `${head}<div class="list-item" data-open="${h.id}"><span class="mono" style="width:50px">${fmtTime(h.hearing_at)}</span>${icon('penal')}
                        <div class="grow"><div class="t">${esc(h.defendant_name)} · ${esc(h.title)}</div><div class="s">${esc(h.number)} · ${esc(h.courtroom || '')} · ${esc(h.judge_name || '')}</div></div>${stChip(h.status)}</div>`;
                }).join('') : `<div class="empty">${icon('shifts')}${T('court_no_hearings')}</div>`}</div></div>`;
            }

            async function ordersView() {
                const res = await api('court:orders', { query: st.oq || '' });
                if (res.error) return UI.err(res);
                $('[data-view]', win.body).innerHTML = `<div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-oq value="${esc(st.oq || '')}" placeholder="${T('court_search_orders')}"></div><div class="grow"></div>
                    ${res.canOrders ? `<button class="btn primary" data-a="newOrder">${icon('plus', 'sm')}${T('court_order')}</button>` : ''}</div>
                    <div class="app-scroll"><table class="tbl"><thead><tr><th>${T('f_number')}</th><th>${T('f_type')}</th><th>${T('f_subject')}</th><th>${T('order_protected')}</th><th>${T('f_expires')}</th><th>${T('f_status')}</th><th></th></tr></thead>
                    <tbody>${res.list.map(o => `<tr><td class="mono">${esc(o.number)}</td><td>${T('order_' + o.kind)}</td><td>${esc(o.subject_name)}</td><td>${esc(o.protected_name || '-')}${o.distance ? ` (${o.distance} m)` : ''}</td>
                        <td>${o.valid_until ? fmtDate(o.valid_until) : '-'}</td><td><span class="chip ${o.status === 'active' ? 'bad' : ''}">${T('order_status_' + o.status)}</span></td>
                        <td class="row"><button class="icon-btn" data-printorder="${o.id}">${icon('printer', 'sm')}</button>${res.canOrders && o.status === 'active' ? `<button class="icon-btn danger" data-revoke="${o.id}">${icon('x', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table>
                    ${res.list.length ? '' : `<div class="empty">${T('court_no_orders')}</div>`}</div>`;
                const oq = $('[data-oq]', win.body);
                oq.addEventListener('input', debounce(() => { st.oq = oq.value; ordersView(); }, 400));
            }

            function setTab(t) {
                st.tab = t;
                $$('[data-tab]', win.body).forEach(b => b.classList.toggle('on', b.dataset.tab === t));
                if (t === 'cases') casesView(); else if (t === 'calendar') calendarView(); else ordersView();
            }

            win.state.open = id => { if (st.tab !== 'cases') setTab('cases'); open(id); };
            win.refresh = () => setTab(st.tab);

            win.body.addEventListener('click', async e => {
                const tab = e.target.closest('[data-tab]');
                if (tab) return setTab(tab.dataset.tab);
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const op = e.target.closest('[data-open]');
                if (op) { setTab('cases'); return open(+op.dataset.open); }
                const cs = e.target.closest('[data-case]');
                if (cs) return OS.openApp('cases', { id: +cs.dataset.case });
                const sm = e.target.closest('[data-summon]');
                if (sm) return UI.print({ type: 'summons', id: st.current.id, name: sm.dataset.summon, role: sm.dataset.role === 'defendant' ? 'defendant' : 'witness' }, T('court_summons'));
                const po = e.target.closest('[data-printorder],[data-order]');
                if (po) return UI.print({ type: 'order', id: +(po.dataset.printorder || po.dataset.order) }, T('court_order'));
                const rv = e.target.closest('[data-revoke]');
                if (rv) {
                    if (!(await UI.confirm(T('court_confirm_revoke'), { danger: true }))) return;
                    const r = await api('court:orderRevoke', { id: +rv.dataset.revoke });
                    if (r.error) return UI.err(r);
                    return ordersView();
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const c = st.current;
                if (a.dataset.a === 'file') { const r = await CourtFile({}); if (r) { await loadCases(); open(r.id); } return; }
                if (a.dataset.a === 'newOrder') return issueOrder(null);
                if (a.dataset.a === 'schedule') return schedule(c);
                if (a.dataset.a === 'verdict') return verdict(c);
                if (a.dataset.a === 'order') return issueOrder(c);
                if (a.dataset.a === 'saveNotes') {
                    const r = await api('court:notes', { id: c.id, notes: $('[data-notes]', win.body).value });
                    if (r.error) return UI.err(r);
                    return OS.toast({ title: T('no_saved'), type: 'success', app: 'court' });
                }
                if (a.dataset.a === 'bail') {
                    const v = await UI.modal({ title: T('court_bail'), icon: 'penal',
                        body: `<div class="grid2"><div class="field"><label>${T('court_bail_amount')}</label><input class="input" type="number" id="cb-a" value="${c.bailAmount || 0}"></div>
                            <div class="field"><label>${T('f_status')}</label><select class="select" id="cb-s">${['set', 'paid', 'revoked'].map(x => `<option value="${x}" ${x === c.bailStatus ? 'selected' : ''}>${T('bail_' + x)}</option>`).join('')}</select></div></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => ({ amount: +$('#cb-a', el).value || 0, status: $('#cb-s', el).value }) }] });
                    if (!v) return;
                    const r = await api('court:bail', { id: c.id, ...v });
                    if (r.error) return UI.err(r);
                    return open(c.id);
                }
                if (a.dataset.a === 'print') {
                    const what = c.verdict ? await UI.modal({ title: T('ui_print'), icon: 'printer', body: `<div class="col">
                        <button class="btn" data-w="file">${icon('documents', 'sm')}${T('court_doc_file')}</button><button class="btn" data-w="verdict">${icon('gavel', 'sm')}${T('court_doc_verdict_btn')}</button></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }], onOpen(el, close) { el.addEventListener('click', ev => { const b = ev.target.closest('[data-w]'); if (b) close(b.dataset.w); }); } }) : 'file';
                    if (what) UI.print({ type: 'court', id: c.id, doc: what }, c.number);
                    return;
                }
                if (a.dataset.a === 'export') {
                    const r = await api('court:export', { id: c.id });
                    if (r.error) return UI.err(r);
                    return OS.toast({ title: T('ui_exported'), text: c.number, type: 'success', app: 'court' });
                }
                if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('court_confirm_delete', esc(c.number)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('court:delete', { id: c.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    return casesView();
                }
            });

            setTab('cases');
            if (args && (args.id || args.ref)) setTimeout(() => open(+(args.id || args.ref)), 200);
        },
        onArgs(win, args) { if (args.id || args.ref) win.state.open(+(args.id || args.ref)); },
    });
})();

// ==========================================
// App: case book
// ==========================================
(function () {
    const statusChip = s => `<span class="chip st-${s}"><span class="dot"></span>${T('case_status_' + s)}</span>`;
    const prioChip = p => `<span class="chip pr-${p}">${T('priority_' + p)}</span>`;

    function caseForm(c = {}) {
        const cfg = OS.state.config;
        return `<div class="field"><label>${T('f_title')}</label><input class="input" id="cf-title" maxlength="120" value="${esc(c.title || '')}"></div>
            <div class="grid2">
                <div class="field"><label>${T('f_priority')}</label><select class="select" id="cf-prio">${cfg.casePriorities.map(p => `<option value="${p}" ${p === (c.priority || 'normal') ? 'selected' : ''}>${T('priority_' + p)}</option>`).join('')}</select></div>
                ${c.id ? `<div class="field"><label>${T('f_status')}</label><select class="select" id="cf-status">${cfg.caseStatuses.map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${T('case_status_' + s)}</option>`).join('')}</select></div>` : '<div></div>'}
            </div>
            <div class="field"><label>${T('f_tags')}</label><input class="input" id="cf-tags" placeholder="${T('ui_tags_hint')}" value="${esc((c.tags || []).join(', '))}"></div>
            <div class="field"><label>${T('f_summary')}</label><textarea class="textarea" id="cf-sum" style="min-height:180px" maxlength="6000">${esc(c.summary || '')}</textarea></div>`;
    }
    const collect = el => {
        const title = $('#cf-title', el).value.trim();
        if (!title) return false;
        return {
            title, priority: $('#cf-prio', el).value, status: $('#cf-status', el) ? $('#cf-status', el).value : undefined,
            tags: $('#cf-tags', el).value.split(',').map(t => t.trim()).filter(Boolean), summary: $('#cf-sum', el).value,
        };
    };

    Apps.define('cases', {
        w: 1080, h: 680,
        mount(win, args) {
            const st = win.state = { query: '', status: 'active', mine: false, list: [], current: null, tab: 'overview' };
            win.body.innerHTML = `<div class="app">
                <div class="app-toolbar">
                    <div class="search">${icon('search')}<input class="input" data-q placeholder="${T('ui_search_case')}"></div>
                    <select class="select" data-status style="width:170px">
                        <option value="active">${T('ui_active_cases')}</option><option value="">${T('ui_all')}</option>
                        ${OS.state.config.caseStatuses.map(s => `<option value="${s}">${T('case_status_' + s)}</option>`).join('')}
                    </select>
                    <label class="check"><input type="checkbox" data-mine>${T('ui_my_cases')}</label>
                    <div class="grow"></div>
                    <button class="btn sm" data-a="mapAll">${icon('pin', 'sm')}${T('ui_cases_map')}</button>
                    ${OS.can('cases.create') ? `<button class="btn primary" data-a="new">${icon('plus', 'sm')}${T('ui_new_case')}</button>` : ''}
                </div>
                <div class="app-body"><div class="app-list" data-list></div><div class="app-detail" data-detail>
                    <div class="empty" style="height:100%;justify-content:center">${icon('cases')}${T('ui_select_case')}</div></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', debounce(() => { st.query = q.value; load(); }, 300));
            $('[data-status]', win.body).onchange = e => { st.status = e.target.value; load(); };
            $('[data-mine]', win.body).onchange = e => { st.mine = e.target.checked; load(); };

            async function load() {
                const res = await api('cases:list', { query: st.query, status: st.status, mine: st.mine });
                if (res.error) return UI.err(res);
                st.list = res.cases;
                $('[data-list]', win.body).innerHTML = st.list.length ? st.list.map(c => `<div class="list-item ${st.current && st.current.id === c.id ? 'active' : ''}" data-id="${c.id}">
                    <div class="grow"><div class="row between"><span class="t ellipsis">${esc(c.title)}</span>${prioChip(c.priority)}</div>
                    <div class="s row"><span class="mono">${esc(c.caseNo)}</span>·${statusChip(c.status)}<span class="grow"></span><span>${ago(c.updatedAt)}</span></div>
                    ${c.lead ? `<div class="s">${icon('user', 'sm')} ${esc(c.lead.name)}${c.assigned.length ? ` +${c.assigned.length}` : ''}</div>` : ''}</div></div>`).join('')
                    : `<div class="empty">${icon('folder')}${T('ui_no_cases')}</div>`;
            }

            async function open(id, silent) {
                const res = await api('cases:get', { id, refresh: !!silent });
                if (res.error) { if (silent) { st.current = null; $('[data-detail]', win.body).innerHTML = ''; return; } return UI.err(res); }
                st.current = res.case;
                $$('[data-list] .list-item', win.body).forEach(x => x.classList.toggle('active', +x.dataset.id === id));
                win.setTitle(st.current.caseNo);
                render();
            }
            win.state.open = open;
            win.refresh = async () => { await load(); if (st.current) open(st.current.id, true); };

            function tabBtn(id, label, n) { return `<button class="tab ${st.tab === id ? 'on' : ''}" data-tab="${id}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`; }

            function render() {
                const c = st.current;
                const people = (c.bookings || []).length + c.links.filter(l => l.kind === 'person' || l.kind === 'vehicle').length;
                $('[data-detail]', win.body).innerHTML = `
                    <div class="detail-head"><div class="grow"><h2>${esc(c.title)}</h2>
                        <div class="sub"><span class="mono accent">${esc(c.caseNo)}</span>${statusChip(c.status)}${prioChip(c.priority)}
                        ${(c.tags || []).map(t => `<span class="chip">${icon('tag', 'sm')}${esc(t)}</span>`).join('')}</div></div>
                        <div class="detail-actions">
                            ${c.canEdit ? `<button class="btn sm" data-a="edit">${icon('edit', 'sm')}${T('ui_edit')}</button>` : ''}
                            ${c.canEdit || c.canManage ? `<button class="btn sm" data-a="assign">${icon('users', 'sm')}${T('ui_assign')}</button>` : ''}
                            ${c.canEdit ? `<button class="btn sm" data-a="link">${icon('link', 'sm')}${T('ui_link')}</button>` : ''}
                            ${OS.can('court.file') && OS.state.apps.find(x => x.id === 'court') ? `<button class="btn sm" data-a="toCourt">${icon('gavel', 'sm')}${T('court_file')}</button>` : ''}
                            <button class="btn sm" data-a="print">${icon('printer', 'sm')}</button>
                            ${OS.can('cases.export') && OS.state.config.archive ? `<button class="btn sm" data-a="export" title="${T('ui_export')}">${icon('send', 'sm')}</button>` : ''}
                            ${c.canDelete ? `<button class="btn sm danger" data-a="delete">${icon('trash', 'sm')}</button>` : ''}
                        </div></div>
                    <div class="tabs">${tabBtn('overview', T('tab_overview'))}${tabBtn('timeline', T('tab_timeline'))}${tabBtn('map', T('tab_map'))}${tabBtn('evidence', T('tab_evidence'), (c.bags || []).length)}
                        ${tabBtn('people', T('tab_people'), people)}${tabBtn('photos', T('tab_photos'), c.photos.length)}
                        ${tabBtn('docs', T('tab_docs'), c.documents.length + c.notes.length)}${tabBtn('warrants', T('tab_warrants'), c.warrants.length)}
                        ${tabBtn('weapons', T('tab_weapons'), c.weapons.length)}${c.archive ? tabBtn('archive', T('tab_archive'), c.archive.length) : ''}</div>
                    <div class="detail-body">${tabContent(c)}</div>`;
                if (st.map) { st.map.destroy(); st.map = null; }
                if (st.tab === 'timeline') loadTimeline();
                if (st.tab === 'map') loadMap();
            }

            // ---------- timeline ----------
            const TL_ICON = { created: 'plus', manual: 'edit', link: 'link', bag: 'bag', lab: 'forensics', arrest: 'prisoners', warrant: 'gavel',
                document: 'documents', photo: 'gallery', status: 'refresh', closed: 'check', export: 'send', interrogation: 'users', court: 'penal' };
            st.tlFilter = st.tlFilter || '';
            async function loadTimeline() {
                const box = $('[data-tl]', win.body);
                if (!box) return;
                const res = await api('cases:timeline', { id: st.current.id });
                if (res.error) return (box.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                st.tl = res;
                paintTimeline();
            }
            function paintTimeline() {
                const box = $('[data-tl]', win.body);
                if (!box || !st.tl) return;
                const list = st.tl.events.filter(e => !st.tlFilter || e.category === st.tlFilter);
                let day = '';
                box.innerHTML = list.length ? `<div class="tl2">${list.map(e => {
                    const d = fmtDate(e.at);
                    const head = d !== day ? `<div class="tl2-day">${esc(d)}</div>` : '';
                    day = d;
                    const i = st.tl.events.indexOf(e);
                    const mine = e.id && (e.createdBy === st.tl.me || st.tl.canManage);
                    return `${head}<div class="tl2-item ${e.category === 'crime' ? 'crime' : ''} ${e.open ? 'click' : ''}" data-tli="${i}">
                        <div class="tl2-time mono">${fmtTime(e.at)}</div><div class="tl2-dot">${icon(TL_ICON[e.kind] || 'clock', 'sm')}</div>
                        <div class="grow"><div class="t">${esc(e.title)}</div>${e.detail ? `<div class="s">${esc(e.detail)}</div>` : ''}
                        ${e.by ? `<div class="s dim">${esc(e.by)}</div>` : ''}</div>
                        ${mine ? `<button class="icon-btn" data-evedit="${i}">${icon('edit', 'sm')}</button><button class="icon-btn danger" data-evdel="${e.id}">${icon('trash', 'sm')}</button>` : ''}</div>`;
                }).join('')}</div>` : `<div class="empty">${icon('clock')}${T('ui_no_events')}</div>`;
            }
            function toLocalInput(ts) {
                const d = new Date(ts * 1000), z = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
            }
            async function eventForm(e) {
                e = e || { at: Math.floor(Date.now() / 1000), category: 'crime' };
                const v = await UI.modal({
                    title: e.id ? T('ui_edit_event') : T('ui_add_event'), icon: 'clock',
                    body: `<div class="grid2"><div class="field"><label>${T('f_event_time')}</label><input class="input" type="datetime-local" id="ev-at" value="${toLocalInput(e.at)}"></div>
                        <div class="field"><label>${T('f_type')}</label><select class="select" id="ev-cat"><option value="crime" ${e.category === 'crime' ? 'selected' : ''}>${T('tl_cat_crime')}</option>
                        <option value="investigation" ${e.category !== 'crime' ? 'selected' : ''}>${T('tl_cat_investigation')}</option></select></div></div>
                        <div class="field"><label>${T('f_title')}</label><input class="input" id="ev-t" maxlength="160" value="${esc(e.title || '')}" placeholder="${T('ui_event_hint')}"></div>
                        <div class="field"><label>${T('f_description')}</label><textarea class="textarea" id="ev-d" maxlength="2000">${esc(e.detail || '')}</textarea></div>`,
                    buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                        const t = $('#ev-t', el).value.trim(), at = new Date($('#ev-at', el).value).getTime() / 1000;
                        return t && at ? { title: t, at: Math.floor(at), category: $('#ev-cat', el).value, detail: $('#ev-d', el).value } : false;
                    } }],
                });
                if (!v) return;
                const r = await api('cases:eventSave', { caseId: st.current.id, id: e.id, ...v });
                if (r.error) return UI.err(r);
                loadTimeline();
            }

            // ---------- map ----------
            const TYPE_COLOR = {};
            (OS.state.config.caseMap.types || []).forEach(t => { TYPE_COLOR[t.id] = t.color; });
            const AUTO = { evidence: { color: '#f1c40f', icon: 'bag' }, arrest: { color: '#2ecc71', icon: 'prisoners' } };
            async function loadMap() {
                const box = $('[data-map]', win.body);
                if (!box) return;
                const res = await api('cases:pins', { id: st.current.id });
                if (res.error) return (box.innerHTML = `<div class="empty">${errMsg(res)}</div>`);
                st.pins = res;
                if (!st.map) {
                    st.map = MapView.create(box, OS.state.config.caseMap, {
                        view: st.mapView && st.mapView.caseId === st.current.id ? st.mapView.v : null,
                        onView: v => { st.mapView = { caseId: st.current.id, v }; },
                        onClick: w => { if (st.placing) { st.placing = false; box.classList.remove('placing'); pinForm({ x: w.x, y: w.y }); } },
                        onMarker: m => {
                            if (m.open) return OS.openApp(m.open.app, m.open);
                            if (m.pin && st.pins.canEdit) pinForm(m.pin);
                        },
                    });
                }
                const markers = res.pins.map(p => ({ x: p.x, y: p.y, color: TYPE_COLOR[p.type] || '#95a5a6', label: p.label, note: p.note,
                    sub: `${T('pin_' + p.type)} · ${p.by || ''}`, short: p.route ? String(p.sort || '') : '', pin: p }))
                    .concat(res.auto.map(a => ({ x: a.x, y: a.y, color: AUTO[a.auto].color, icon: AUTO[a.auto].icon, auto: true, label: a.label, note: a.note,
                        sub: T('pin_auto_' + a.auto) + (a.at ? ' · ' + fmtDT(a.at) : ''), open: a.open })));
                const routes = {};
                res.pins.filter(p => p.route).forEach(p => { (routes[p.route] = routes[p.route] || []).push(p); });
                st.map.set(markers, Object.values(routes).map(list => ({ color: TYPE_COLOR[list[0].type] || '#f1c40f',
                    points: list.sort((a, b) => a.sort - b.sort).map(p => ({ x: p.x, y: p.y })) })));
                const legend = $('[data-legend]', win.body);
                if (legend) legend.innerHTML = res.pins.map(p => `<span class="chip click" data-pinfocus="${p.id}"><span class="dot" style="color:${esc(TYPE_COLOR[p.type] || '#95a5a6')}"></span>${esc(p.label)}</span>`).join('')
                    + res.auto.map(a => `<span class="chip"><span class="dot" style="color:${AUTO[a.auto].color}"></span>${esc(a.label)}</span>`).join('');
            }
            async function pinForm(p) {
                const types = OS.state.config.caseMap.types || [];
                const v = await UI.modal({
                    title: p.id ? T('ui_edit_pin') : T('ui_add_pin'), icon: 'pin',
                    body: `<div class="grid2"><div class="field"><label>${T('f_type')}</label><select class="select" id="pn-t">${types.map(t => `<option value="${t.id}" ${t.id === (p.type || 'scene') ? 'selected' : ''}>${T('pin_' + t.id)}</option>`).join('')}</select></div>
                        <div class="field"><label>${T('f_route')}</label><input class="input" id="pn-r" maxlength="40" value="${esc(p.route || '')}" placeholder="${T('ui_route_hint')}"></div></div>
                        <div class="field"><label>${T('f_label')}</label><input class="input" id="pn-l" maxlength="80" value="${esc(p.label || '')}"></div>
                        <div class="field"><label>${T('f_note')}</label><textarea class="textarea" id="pn-n" maxlength="500">${esc(p.note || '')}</textarea></div>
                        <div class="dim mono" style="font-size:11px">X ${Math.round(p.x)} · Y ${Math.round(p.y)}</div>`,
                    buttons: (p.id ? [{ label: T('ui_delete'), value: 'delete', cls: 'danger' }] : []).concat([{ label: T('ui_cancel'), value: null },
                        { label: T('ui_save'), cls: 'primary', collect: el => { const l = $('#pn-l', el).value.trim(); return l ? { type: $('#pn-t', el).value, label: l,
                            note: $('#pn-n', el).value, route: $('#pn-r', el).value.trim() } : false; } }]),
                });
                if (!v) return;
                const r = v === 'delete' ? await api('cases:pinDelete', { id: p.id })
                    : await api('cases:pinSave', { caseId: st.current.id, id: p.id, x: p.x, y: p.y, sort: p.sort, ...v });
                if (r.error) return UI.err(r);
                loadMap();
            }
            async function mapAll() {
                const res = await api('cases:mapAll');
                if (res.error) return UI.err(res);
                const PR = { low: '#95a5a6', normal: '#3498db', high: '#f39c12', critical: '#e74c3c' };
                let map;
                await UI.modal({
                    title: T('ui_cases_map'), icon: 'pin', wide: true,
                    body: `<div class="mv-box" data-allmap style="height:480px"></div><div class="row wrap">${res.cases.map(c => `<span class="chip click" data-opencase="${c.id}"><span class="dot" style="color:${PR[c.priority]}"></span>${esc(c.caseNo)} · ${esc(c.title)}</span>`).join('') || `<span class="dim">${T('ui_no_cases')}</span>`}</div>`,
                    onOpen(el, close) {
                        const markers = [];
                        res.cases.forEach(c => c.markers.forEach(m => markers.push({ x: m.x, y: m.y, color: PR[c.priority] || '#f1c40f', label: c.caseNo + ' · ' + c.title,
                            note: m.label, sub: m.auto ? T('pin_auto_' + m.auto) : T('pin_' + m.type), caseId: c.id, icon: m.auto ? AUTO[m.auto].icon : null })));
                        map = MapView.create($('[data-allmap]', el), OS.state.config.caseMap, { onMarker: m => { close(null); open(m.caseId); } });
                        map.set(markers);
                        el.addEventListener('click', e => { const c = e.target.closest('[data-opencase]'); if (c) { close(null); open(+c.dataset.opencase); } });
                    },
                });
                if (map) map.destroy();
            }


            function linkRows(kind) {
                return st.current.links.filter(l => l.kind === kind).map(l => `<div class="list-item" style="cursor:default">${icon(kind === 'vehicle' ? 'car' : 'user')}
                    <div class="grow"><div class="t">${esc(l.label || l.ref)}</div><div class="s">${T('link_' + kind)} · ${esc(l.addedBy || '')} · ${ago(l.addedAt)}</div></div>
                    ${st.current.canEdit ? `<button class="icon-btn danger" data-unlink="${l.id}">${icon('x', 'sm')}</button>` : ''}</div>`).join('');
            }

            function tabContent(c) {
                if (st.tab === 'timeline') {
                    return `<div class="row"><div class="row">${[['', T('ui_all')], ['crime', T('tl_cat_crime')], ['investigation', T('tl_cat_investigation')]].map(([k, l]) =>
                        `<button class="btn sm ${st.tlFilter === k ? 'primary' : ''}" data-tlfilter="${k}">${l}</button>`).join('')}</div><div class="grow"></div>
                        <button class="btn sm" data-a="tlPrint">${icon('printer', 'sm')}</button>
                        ${c.canEdit ? `<button class="btn sm primary" data-a="addEvent">${icon('plus', 'sm')}${T('ui_add_event')}</button>` : ''}</div>
                        <div data-tl><div class="loading"><div class="spinner"></div></div></div>`;
                }
                if (st.tab === 'map') {
                    return `<div class="row"><span class="muted" style="font-size:11.5px">${T('ui_map_hint')}</span><div class="grow"></div>
                        ${c.canEdit ? `<button class="btn sm" data-a="myPos">${icon('pin', 'sm')}${T('ui_my_position')}</button>
                        <button class="btn sm primary" data-a="addPin">${icon('plus', 'sm')}${T('ui_add_pin')}</button>` : ''}</div>
                        <div class="mv-box" data-map></div><div class="row wrap" data-legend></div>`;
                }
                if (st.tab === 'overview') {
                    return `<div class="grid2">
                        <div class="card"><div class="card-title">${icon('user', 'sm')}${T('f_lead')}</div>${c.lead ? `<div class="row"><div class="avatar">${initials(c.lead.name)}</div><b>${esc(c.lead.name)}</b></div>` : `<span class="dim">-</span>`}
                            <div class="card-title" style="margin-top:12px">${icon('users', 'sm')}${T('f_assigned')}</div>
                            <div class="row wrap">${c.assigned.length ? c.assigned.map(a => `<span class="chip">${esc(a.name)}</span>`).join('') : '<span class="dim">-</span>'}</div></div>
                        <div class="card"><div class="kv"><span>${T('f_created')}</span><span>${fmtDT(c.createdAt)} · ${esc(c.createdBy || '')}</span>
                            <span>${T('f_updated')}</span><span>${fmtDT(c.updatedAt)}</span><span>${T('tab_evidence')}</span><span>${(c.bags || []).length}</span>
                            <span>${T('tab_people')}</span><span>${(c.bookings || []).length}</span></div></div></div>
                        <div class="card"><div class="card-title">${icon('notes', 'sm')}${T('f_summary')}</div><div class="md">${c.summary ? md(c.summary) : `<span class="dim">${T('ui_no_summary')}</span>`}</div></div>`;
                }
                if (st.tab === 'evidence') {
                    const bags = c.bags || [];
                    return `${OS.state.integrations.forensics ? '' : `<div class="empty">${T('ui_needs_forensics')}</div>`}
                        <div class="list">${bags.map(b => `<div class="list-item" data-bag="${esc(b.code)}">${icon('bag')}<div class="grow">
                            <div class="t">${esc(b.code)} · ${esc(b.label)}</div><div class="s">${esc(b.typeLabel || b.type)} · ${esc(b.location || '')}${b.detail ? ' · ' + esc(b.detail) : ''}</div>
                            ${b.summary ? `<div class="s ok">${esc(b.summary)}</div>` : ''}</div><span class="chip ${b.status === 'done' ? 'ok' : 'warn'}">${T('bag_status_' + b.status)}</span>
                            ${c.canEdit ? `<button class="icon-btn danger" data-unlink-bag="${esc(b.code)}">${icon('x', 'sm')}</button>` : ''}</div>`).join('') || `<div class="empty">${icon('bag')}${T('ui_no_evidence')}</div>`}</div>`;
                }
                if (st.tab === 'people') {
                    return `<div class="section-title">${T('tab_bookings')}<span class="line"></span></div>
                        <div class="list">${(c.bookings || []).map(b => `<div class="list-item" data-booking="${esc(b.bookingNo)}"><div class="avatar" ${bg(b.photo)}>${b.photo ? '' : initials(b.name)}</div>
                            <div class="grow"><div class="t">${esc(b.name)}</div><div class="s mono">${esc(b.bookingNo)} · ${fmtDate(b.createdAt)}</div></div>
                            ${b.status ? `<span class="chip">${esc(T('pstatus_' + b.status))}</span>` : ''}</div>`).join('') || `<div class="empty">${T('ui_no_bookings')}</div>`}</div>
                        <div class="section-title" style="margin-top:6px">${T('ui_persons_vehicles')}<span class="line"></span></div>
                        <div class="list">${linkRows('person') + linkRows('vehicle') || `<div class="empty">-</div>`}</div>`;
                }
                if (st.tab === 'photos') {
                    return c.photos.length ? `<div class="g-grid" style="padding:0">${c.photos.map(p => `<div class="g-tile" data-photo="${p.id}" ${bg(p.url)}>
                        <div class="cap">${esc(p.label || '')}<span>${fmtDate(p.taken_at || p.added_at)}</span></div></div>`).join('')}</div>` : `<div class="empty">${icon('gallery')}${T('ui_no_photos')}</div>`;
                }
                if (st.tab === 'docs') {
                    return `<div class="list">${c.documents.map(d => `<div class="list-item" data-doc="${d.id}">${icon(d.source === 'scan' ? 'scan' : 'documents')}
                        <div class="grow"><div class="t">${esc(d.title)}</div><div class="s mono">${esc(d.doc_no)} · ${esc(d.author_name || '')} · ${fmtDate(d.created_at)}</div></div></div>`).join('')}
                        ${c.notes.map(n => `<div class="list-item" data-note="${n.id}">${icon('notes')}<div class="grow"><div class="t">${esc(n.title)}</div>
                        <div class="s">${esc(n.owner_name || '')} · ${ago(n.updated_at)}</div></div></div>`).join('')}</div>
                        ${!c.documents.length && !c.notes.length ? `<div class="empty">${icon('documents')}${T('ui_no_docs')}</div>` : ''}`;
                }
                if (st.tab === 'warrants') {
                    return `<div class="list">${c.warrants.map(w => `<div class="list-item" data-warrant="${w.id}">${icon(w.kind === 'bolo' ? 'eye' : 'gavel')}
                        <div class="grow"><div class="t">${esc(w.title)}</div><div class="s mono">${esc(w.number)} · ${T('wtype_' + w.type)}</div></div>
                        <span class="chip st-${w.status}">${T('wstatus_' + w.status)}</span></div>`).join('') || `<div class="empty">${icon('gavel')}${T('ui_no_warrants')}</div>`}</div>`;
                }
                if (st.tab === 'weapons') {
                    return `<div class="list">${c.weapons.map(w => `<div class="list-item" data-weapon="${w.id}">${icon('weapons')}
                        <div class="grow"><div class="t">${esc(w.weapon)}</div><div class="s mono">${esc(w.serial)}${w.signature ? ' · ' + esc(w.signature) : ''}</div></div>
                        <span class="chip st-${w.status}">${T('wpstatus_' + w.status)}</span></div>`).join('') || `<div class="empty">${icon('weapons')}${T('ui_no_weapons')}</div>`}</div>`;
                }
                if (st.tab === 'archive') {
                    return `<div class="list">${(c.archive || []).map(a => `<div class="list-item" style="cursor:default">${icon('board')}
                        <div class="grow"><div class="t">${esc(a.title || a.caseNo)}</div><div class="s">${T('arch_' + a.status)}${a.archiveLabel ? ' · ' + esc(a.archiveLabel) : ''} · ${a.itemCount} ${T('ui_items')} · ${a.photoCount} ${T('ui_photos')}</div></div>
                        <span class="dim" style="font-size:11px">${fmtDate(a.storedAt || a.packedAt)}</span></div>`).join('') || `<div class="empty">${icon('board')}${T('ui_no_archive')}</div>`}</div>`;
                }
                return '';
            }

            win.body.addEventListener('click', async e => {
                const it = e.target.closest('[data-list] .list-item');
                if (it) return open(+it.dataset.id);
                const tab = e.target.closest('[data-tab]');
                if (tab) { st.tab = tab.dataset.tab; return render(); }
                const tlf = e.target.closest('[data-tlfilter]');
                if (tlf) {
                    st.tlFilter = tlf.dataset.tlfilter;
                    $$('[data-tlfilter]', win.body).forEach(b => b.classList.toggle('primary', b === tlf));
                    return paintTimeline();
                }
                const evEdit = e.target.closest('[data-evedit]');
                if (evEdit) return eventForm(st.tl.events[+evEdit.dataset.evedit]);
                const evDel = e.target.closest('[data-evdel]');
                if (evDel) {
                    if (!(await UI.confirm(T('ui_confirm_delete_event'), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('cases:eventDelete', { id: +evDel.dataset.evdel });
                    if (r.error) return UI.err(r);
                    return loadTimeline();
                }
                const tli = e.target.closest('[data-tli]');
                if (tli) {
                    const ev = st.tl.events[+tli.dataset.tli];
                    if (ev && ev.open) return OS.openApp(ev.open.app, ev.open.app === 'gallery' ? { view: 'case', id: ev.open.caseId, photo: ev.open.photo } : ev.open);
                    return;
                }
                const pf = e.target.closest('[data-pinfocus]');
                if (pf && st.map && st.pins) {
                    const p = st.pins.pins.find(x => x.id === +pf.dataset.pinfocus);
                    if (p) st.map.center(p.x, p.y, 0.6);
                    return;
                }
                const t = e.target.closest('[data-bag],[data-booking],[data-photo],[data-doc],[data-note],[data-warrant],[data-weapon]');
                if (t && !e.target.closest('[data-unlink-bag]')) {
                    if (t.dataset.bag) return OS.openApp('forensics', { bag: t.dataset.bag });
                    if (t.dataset.booking) return OS.openApp('prisoners', { bookingNo: t.dataset.booking });
                    if (t.dataset.photo) return OS.openApp('gallery', { view: 'case', id: st.current.id, photo: +t.dataset.photo });
                    if (t.dataset.doc) return OS.openApp('documents', { id: +t.dataset.doc });
                    if (t.dataset.note) return OS.openApp('notes', { id: +t.dataset.note });
                    if (t.dataset.warrant) return OS.openApp('warrants', { id: +t.dataset.warrant });
                    if (t.dataset.weapon) return OS.openApp('weapons', { id: +t.dataset.weapon });
                }
                const un = e.target.closest('[data-unlink],[data-unlink-bag]');
                if (un) {
                    const linkId = un.dataset.unlink || (st.current.links.find(l => l.kind === 'bag' && l.ref === un.dataset.unlinkBag) || {}).id;
                    if (!linkId || !(await UI.confirm(T('ui_confirm_unlink')))) return;
                    const r = await api('cases:unlink', { id: st.current.id, linkId: +linkId });
                    if (r.error) return UI.err(r);
                    return open(st.current.id);
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const c = st.current;
                if (a.dataset.a === 'mapAll') return mapAll();
                if (a.dataset.a === 'addEvent') return eventForm();
                if (a.dataset.a === 'tlPrint') return UI.print({ type: 'timeline', id: c.id, category: st.tlFilter }, c.caseNo);
                if (a.dataset.a === 'addPin') {
                    st.placing = true;
                    const mb = $('[data-map]', win.body);
                    if (mb) mb.classList.add('placing');
                    return UI.toast(T('ui_click_map'));
                }
                if (a.dataset.a === 'myPos') {
                    const loc = await post('myLocation');
                    if (!loc) return;
                    return pinForm({ x: loc.x, y: loc.y, label: [loc.street, loc.cross].filter(Boolean).join(' / ') || loc.zone || '', note: loc.zone || '' });
                }
                if (a.dataset.a === 'toCourt') {
                    let b = null;
                    const bs = c.bookings || [];
                    if (bs.length) {
                        b = await UI.modal({ title: T('court_file'), icon: 'gavel',
                            body: `<div class="muted" style="font-size:12px">${T('court_pick_booking')}</div><div class="pick-list">${bs.map((x, i) => `<div class="pick-item" data-i="${i}">
                                <div class="avatar" ${bg(x.photo)}>${x.photo ? '' : initials(x.name)}</div><span class="grow">${esc(x.name)}</span><span class="mono dim">${esc(x.bookingNo)}</span></div>`).join('')}</div>`,
                            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('court_other_person'), value: {} }],
                            onOpen(el, close) { el.addEventListener('click', e => { const it = e.target.closest('[data-i]'); if (it) close(bs[+it.dataset.i]); }); } });
                        if (!b) return;
                    }
                    let charges = [];
                    if (b && b.bookingNo) { const rec = await api('prisoners:get', { bookingNo: b.bookingNo, refresh: true }); if (rec && rec.record) charges = rec.record.charges || []; }
                    const res = await CourtFile({ title: c.title, caseId: c.id, caseNo: c.caseNo, bookingNo: b && b.bookingNo, defendant: b && b.name ? { name: b.name } : null, bookingCharges: charges });
                    if (res) OS.openApp('court', { id: res.id });
                    return;
                }
                if (a.dataset.a === 'export') {
                    if (!(await UI.confirm(T('ui_confirm_export', esc(c.caseNo))))) return;
                    const r = await api('cases:export', { id: c.id });
                    if (r.error) return UI.err(r);
                    return OS.toast({ title: T('ui_exported'), text: c.caseNo, type: 'success', app: 'cases' });
                }
                if (a.dataset.a === 'new') {
                    const v = await UI.modal({ title: T('ui_new_case'), icon: 'cases', wide: true, body: caseForm(), buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_create'), cls: 'primary', collect }] });
                    if (!v) return;
                    const r = await api('cases:create', v);
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('ui_case_created'), text: r.caseNo, type: 'success', app: 'cases' });
                    await load();
                    open(r.id);
                } else if (a.dataset.a === 'edit') {
                    const v = await UI.modal({ title: T('ui_edit_case'), icon: 'edit', wide: true, body: caseForm(c), buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect }] });
                    if (!v) return;
                    const r = await api('cases:update', { id: c.id, ...v });
                    if (r.error) return UI.err(r);
                    await load();
                    open(c.id);
                } else if (a.dataset.a === 'assign') {
                    const lead = await UI.pickOfficer({ title: T('ui_pick_lead') });
                    const team = await UI.pickOfficer({ title: T('ui_pick_team'), multi: true, selected: c.assigned });
                    if (lead === null && team === null) return;
                    const r = await api('cases:assign', { id: c.id, lead: lead ? lead.id : (c.lead && c.lead.id), assigned: team || c.assigned });
                    if (r.error) return UI.err(r);
                    open(c.id);
                } else if (a.dataset.a === 'link') {
                    const v = await UI.modal({
                        title: T('ui_link'), icon: 'link',
                        body: `<div class="field"><label>${T('f_type')}</label><select class="select" id="lk-kind">
                            ${OS.state.integrations.forensics ? `<option value="bag">${T('link_bag')}</option>` : ''}
                            ${OS.state.integrations.mugshot ? `<option value="booking">${T('link_booking')}</option>` : ''}
                            <option value="person">${T('link_person')}</option><option value="vehicle">${T('link_vehicle')}</option></select></div>
                            <div class="field"><label>${T('f_reference')}</label><input class="input" id="lk-ref" maxlength="80" placeholder="EV-00012 / LSPD-2026-000123 / ..."></div>
                            <div class="field"><label>${T('f_label_opt')}</label><input class="input" id="lk-label" maxlength="160"></div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_link'), cls: 'primary', collect: el => {
                            const ref = $('#lk-ref', el).value.trim();
                            return ref ? { kind: $('#lk-kind', el).value, ref, label: $('#lk-label', el).value.trim() } : false;
                        } }],
                    });
                    if (!v) return;
                    const r = await api('cases:link', { id: c.id, ...v });
                    if (r.error) return UI.err(r);
                    open(c.id);
                } else if (a.dataset.a === 'print') {
                    UI.print({ type: 'case', id: c.id }, c.caseNo);
                } else if (a.dataset.a === 'delete') {
                    if (!(await UI.confirm(T('ui_confirm_delete_case', esc(c.caseNo)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('cases:delete', { id: c.id });
                    if (r.error) return UI.err(r);
                    st.current = null;
                    $('[data-detail]', win.body).innerHTML = `<div class="empty" style="height:100%;justify-content:center">${icon('cases')}${T('ui_select_case')}</div>`;
                    load();
                }
            });

            load().then(() => { if (args && (args.id || args.ref)) open(+(args.id || args.ref)); });
        },
        onClose(win) { if (win.state.map) win.state.map.destroy(); },
        onArgs(win, args) { if (args.id || args.ref) win.state.open(+(args.id || args.ref)); },
    });
})();

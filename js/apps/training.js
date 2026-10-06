// ==========================================
// App: training - courses (materials + test), my progress, recruits (FTO), certification proposals
// ==========================================
(function () {
    const stChip = s => `<span class="chip ${s === 'passed' || s === 'completed' ? 'ok' : s === 'failed' ? 'bad' : 'info'}">${T('tr_status_' + s)}</span>`;
    const stars = n => `<span class="tr-stars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

    function evalCard(e, canDelete) {
        return `<div class="card"><div class="row between"><b>${fmtDT(e.created_at)} · ${esc(e.fto_name || '')}</b>
            <span class="row"><span class="chip ${e.recommendation === 'ready' ? 'ok' : e.recommendation === 'release' ? 'bad' : e.recommendation === 'extend' ? 'warn' : 'info'}">${T('tr_rec_' + e.recommendation)}</span>
            ${canDelete ? `<button class="icon-btn danger" data-evdel="${e.id}">${icon('trash', 'sm')}</button>` : ''}</span></div>
            <div class="tr-ratings">${Object.keys(e.ratings || {}).map(k => `<span>${T('eval_' + k)}</span>${stars(e.ratings[k])}`).join('')}</div>
            ${e.minutes ? `<div class="dim" style="font-size:11.5px">${T('tr_minutes', e.minutes)}</div>` : ''}
            ${e.notes ? `<div class="md">${md(e.notes)}</div>` : ''}</div>`;
    }

    // ---------- course editor ----------
    async function editCourse(c, ov) {
        const qs = (c && c.questions ? c.questions : []).map(q => ({ q: q.q, options: q.options.slice(), correct: q.correct.slice() }));
        const v = await UI.modal({
            title: c ? T('tr_edit_course') : T('tr_new_course'), icon: 'training', wide: true,
            body: `<div class="grid3"><div class="field"><label>${T('f_title')}</label><input class="input" id="ce-t" maxlength="120" value="${esc(c ? c.title : '')}"></div>
                <div class="field"><label>${T('f_category')}</label><input class="input" id="ce-c" maxlength="60" value="${esc(c ? c.category || '' : '')}"></div>
                <div class="field"><label>${T('tr_cert')}</label><select class="select" id="ce-cert"><option value="">-</option>${ov.certs.map(x => `<option value="${esc(x.id)}" ${c && c.cert === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div></div>
                <div class="grid3"><div class="field"><label>${T('tr_pass_score')} (%)</label><input class="input" type="number" min="1" max="100" id="ce-p" value="${c ? c.passScore : ov.defaults.passScore}"></div>
                <div class="field"><label>${T('tr_time_limit')} (min)</label><input class="input" type="number" min="1" max="120" id="ce-m" value="${c ? c.minutes : ov.defaults.minutes}"></div>
                <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="ce-a" ${!c || c.active ? 'checked' : ''}>${T('tr_active')}</label></div></div>
                <div class="field"><label>${T('tr_materials')}</label><textarea class="textarea mono" id="ce-d" maxlength="20000" style="min-height:160px">${esc(c ? c.description || '' : '')}</textarea></div>
                <div class="section-title">${T('tr_questions')}<span class="line"></span><button class="btn sm" id="ce-addq">${icon('plus', 'sm')}${T('tr_add_question')}</button></div>
                <div class="muted" style="font-size:11.5px">${T('tr_questions_hint')}</div><div class="col" id="ce-qs"></div>`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                const title = $('#ce-t', el).value.trim();
                if (!title) return false;
                return { id: c ? c.id : null, title, category: $('#ce-c', el).value.trim(), cert: $('#ce-cert', el).value || null, passScore: +$('#ce-p', el).value,
                    minutes: +$('#ce-m', el).value, active: $('#ce-a', el).checked, description: $('#ce-d', el).value,
                    questions: qs.filter(q => q.q.trim() && q.options.filter(o => o.trim()).length >= 2 && q.correct.length) };
            } }],
            onOpen(el) {
                const paint = () => {
                    $('#ce-qs', el).innerHTML = qs.map((q, i) => `<div class="tr-qedit" data-q="${i}"><div class="row"><b>${i + 1}.</b><input class="input" data-qt maxlength="300" value="${esc(q.q)}">
                        <button class="icon-btn danger" data-qdel>${icon('trash', 'sm')}</button></div>
                        ${q.options.map((o, j) => `<div class="row tr-opt"><label class="check" title="${T('tr_correct')}"><input type="checkbox" data-oc="${j}" ${q.correct.includes(j + 1) ? 'checked' : ''}></label>
                            <input class="input" data-ot="${j}" maxlength="160" value="${esc(o)}"><button class="icon-btn" data-odel="${j}">${icon('x', 'sm')}</button></div>`).join('')}
                        ${q.options.length < 6 ? `<button class="btn sm ghost" data-oadd>${icon('plus', 'sm')}${T('tr_add_option')}</button>` : ''}</div>`).join('') || `<span class="dim" style="font-size:12px">${T('tr_no_test')}</span>`;
                };
                paint();
                $('#ce-addq', el).onclick = () => { qs.push({ q: '', options: ['', ''], correct: [] }); paint(); };
                el.addEventListener('input', e => {
                    const box = e.target.closest('[data-q]');
                    if (!box) return;
                    const q = qs[+box.dataset.q];
                    if (e.target.matches('[data-qt]')) q.q = e.target.value;
                    if (e.target.matches('[data-ot]')) q.options[+e.target.dataset.ot] = e.target.value;
                });
                el.addEventListener('change', e => {
                    const box = e.target.closest('[data-q]');
                    if (!box || !e.target.matches('[data-oc]')) return;
                    const q = qs[+box.dataset.q], n = +e.target.dataset.oc + 1;
                    q.correct = e.target.checked ? q.correct.concat(n) : q.correct.filter(x => x !== n);
                });
                el.addEventListener('click', e => {
                    const box = e.target.closest('[data-q]');
                    if (!box) return;
                    const i = +box.dataset.q, q = qs[i];
                    if (e.target.closest('[data-qdel]')) { qs.splice(i, 1); paint(); }
                    else if (e.target.closest('[data-oadd]')) { q.options.push(''); paint(); }
                    else if (e.target.closest('[data-odel]')) {
                        const j = +e.target.closest('[data-odel]').dataset.odel;
                        if (q.options.length <= 2) return;
                        q.options.splice(j, 1);
                        q.correct = q.correct.filter(x => x !== j + 1).map(x => (x > j + 1 ? x - 1 : x));
                        paint();
                    }
                });
            },
        });
        if (!v) return null;
        const r = await api('training:courseSave', v);
        if (r.error) { UI.err(r); return null; }
        OS.toast({ title: T('ui_saved'), text: v.title, type: 'success', app: 'training' });
        return r.id;
    }

    async function evaluate(person, ov) {
        const v = await UI.modal({
            title: T('tr_new_eval') + ' · ' + esc(person.name), icon: 'training', wide: true,
            body: `<div class="tr-rate">${ov.ratings.map(k => `<span>${T('eval_' + k)}</span><div class="tr-rbtns" data-r="${k}">${[1, 2, 3, 4, 5].map(n => `<button class="btn sm ${n === 3 ? 'primary' : ''}" data-v="${n}">${n}</button>`).join('')}</div>`).join('')}</div>
                <div class="grid2"><div class="field"><label>${T('tr_patrol_minutes')}</label><input class="input" type="number" min="0" max="1440" id="ev-m" value="60"></div>
                <div class="field"><label>${T('tr_recommendation')}</label><select class="select" id="ev-r">${['continue', 'ready', 'extend', 'release'].map(x => `<option value="${x}">${T('tr_rec_' + x)}</option>`).join('')}</select></div></div>
                <div class="field"><label>${T('f_notes')}</label><textarea class="textarea" id="ev-n" maxlength="4000" style="min-height:120px"></textarea></div>`,
            buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect: el => {
                const ratings = {};
                $$('[data-r]', el).forEach(g => { const on = $('.primary', g); ratings[g.dataset.r] = on ? +on.dataset.v : 3; });
                return { id: person.id, name: person.name, ratings, minutes: +$('#ev-m', el).value || 0, recommendation: $('#ev-r', el).value, notes: $('#ev-n', el).value };
            } }],
            onOpen(el) {
                el.addEventListener('click', e => {
                    const b = e.target.closest('[data-r] [data-v]');
                    if (!b) return;
                    $$('[data-v]', b.parentElement).forEach(x => x.classList.toggle('primary', x === b));
                });
            },
        });
        if (!v) return false;
        const r = await api('training:evaluate', v);
        if (r.error) { UI.err(r); return false; }
        return true;
    }

    Apps.define('training', {
        w: 1120, h: 720,
        mount(win, args) {
            const st = win.state = { tab: 'courses', course: null, person: null, ov: null, query: '' };
            win.body.innerHTML = `<div class="app"><div class="tabs" data-tabs></div><div data-view style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>`;

            async function overview() {
                const r = await api('training:overview');
                if (r.error) { UI.err(r); return null; }
                st.ov = r;
                const tabs = [['courses', 'book', T('tr_tab_courses')], ['mine', 'user', T('tr_tab_mine')]];
                if (r.can.fto) tabs.push(['recruits', 'users', T('tr_tab_recruits')]);
                if (r.can.certs) tabs.push(['certs', 'badge', T('tr_tab_certs'), r.proposals]);
                $('[data-tabs]', win.body).innerHTML = tabs.map(([id, ic, l, n]) => `<button class="tab ${st.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic, 'sm')}${l}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('');
                return r;
            }

            // ---------- courses ----------
            function coursesView() {
                const ov = st.ov;
                const cats = {};
                ov.courses.forEach(c => { (cats[c.category || '-'] = cats[c.category || '-'] || []).push(c); });
                $('[data-view]', win.body).innerHTML = `<div class="app-toolbar"><div class="grow"></div>${ov.can.manage ? `<button class="btn primary" data-a="newCourse">${icon('plus', 'sm')}${T('tr_new_course')}</button>` : ''}</div>
                    <div class="app-body"><div class="app-list">${Object.keys(cats).map(k => `<div class="side-title" style="padding:8px 12px 2px">${esc(k)}</div>${cats[k].map(c => `<div class="list-item ${st.course === c.id ? 'active' : ''}" data-course="${c.id}">
                        ${icon('book')}<div class="grow"><div class="t ellipsis">${esc(c.title)}</div><div class="s">${c.questionCount ? T('tr_q_count', c.questionCount) : T('tr_practical')}${c.certLabel ? ' · ' + esc(c.certLabel) : ''}${c.active ? '' : ' · ' + T('tr_inactive')}</div></div></div>`).join('')}`).join('')
                        || `<div class="empty">${T('tr_no_courses')}</div>`}</div><div class="app-detail" data-detail><div class="empty" style="height:100%;justify-content:center">${icon('book')}${T('tr_pick_course')}</div></div></div>`;
                if (st.course) openCourse(st.course);
            }

            async function openCourse(id) {
                const r = await api('training:course', { id });
                if (r.error) return UI.err(r);
                const c = r.item, ov = st.ov;
                st.course = c.id;
                st.courseData = c;
                $$('[data-course]', win.body).forEach(x => x.classList.toggle('active', +x.dataset.course === id));
                const mine = ov.mine.find(m => m.course_id === c.id);
                $('[data-detail]', win.body).innerHTML = `<div class="detail-head"><div class="grow"><h2>${esc(c.title)}</h2><div class="sub">${esc(c.category || '')}
                    ${c.certLabel ? `<span class="chip accent">${icon('badge', 'sm')}${esc(c.certLabel)}</span>` : ''}${mine ? stChip(mine.status) : ''}</div></div>
                    <div class="detail-actions">${mine && (mine.status === 'passed' || mine.status === 'completed') ? `<button class="btn sm" data-a="cert">${icon('printer', 'sm')}${T('tr_print_cert')}</button>` : ''}
                        ${ov.can.manage ? `<button class="btn sm" data-a="editCourse">${icon('edit', 'sm')}${T('ui_edit')}</button><button class="btn sm danger" data-a="delCourse">${icon('trash', 'sm')}</button>` : ''}</div></div>
                    <div class="detail-body"><div class="card"><div class="kv"><span>${T('tr_test')}</span><span>${c.questionCount ? T('tr_test_info', c.questionCount, c.passScore, c.minutes) : T('tr_practical')}</span>
                        ${mine ? `<span>${T('tr_my_result')}</span><span>${mine.score != null ? mine.score + ' %' : '-'} · ${T('tr_attempts', mine.attempts)}</span>` : ''}</div>
                        <div class="dim" style="font-size:11.5px;margin-top:6px">${T('tr_test_by_fto')}</div></div>
                        <div class="card"><div class="md">${md(c.description || '-')}</div></div></div>`;
            }

            // ---------- mine ----------
            function mineView() {
                const ov = st.ov;
                $('[data-view]', win.body).innerHTML = `<div class="app-scroll"><div class="pad col">
                    <div class="section-title">${T('tr_my_courses')}<span class="line"></span></div>
                    ${ov.mine.length ? `<table class="tbl"><thead><tr><th>${T('tr_course')}</th><th>${T('f_status')}</th><th>${T('tr_result')}</th><th>FTO</th><th>${T('f_updated')}</th><th></th></tr></thead><tbody>
                        ${ov.mine.map(m => `<tr><td>${esc(m.title)}</td><td>${stChip(m.status)}${m.cert_status ? ` <span class="chip">${T('tr_cert_' + m.cert_status)}</span>` : ''}</td>
                        <td>${m.score != null ? m.score + ' %' : '-'}</td><td>${esc(m.fto_name || '-')}</td><td>${fmtDate(m.updated_at)}</td>
                        <td>${m.status === 'passed' || m.status === 'completed' ? `<button class="icon-btn" data-printcert="${m.course_id}">${icon('printer', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
                        : `<div class="empty">${T('tr_nothing_yet')}</div>`}
                    <div class="section-title">${T('tr_my_evals')}<span class="line"></span></div>
                    ${ov.evaluations.map(e => evalCard(e, false)).join('') || `<div class="empty">${T('tr_no_evals')}</div>`}</div></div>`;
            }

            // ---------- recruits ----------
            async function recruitsView() {
                $('[data-view]', win.body).innerHTML = `<div class="app-toolbar"><div class="search">${icon('search')}<input class="input" data-q value="${esc(st.query)}" placeholder="${T('ui_search_name')}"></div>
                    <div class="grow"></div><button class="btn primary" data-a="addPerson">${icon('plus', 'sm')}${T('tr_add_person')}</button></div>
                    <div class="app-body"><div class="app-list" data-people></div><div class="app-detail" data-detail><div class="empty" style="height:100%;justify-content:center">${icon('users')}${T('tr_pick_person')}</div></div></div>`;
                const q = $('[data-q]', win.body);
                q.addEventListener('input', debounce(() => { st.query = q.value; loadPeople(); }, 300));
                await loadPeople();
                if (st.person) openPerson(st.person.id, st.person.name);
            }

            async function loadPeople() {
                const r = await api('training:people', { query: st.query });
                if (r.error) return UI.err(r);
                const box = $('[data-people]', win.body);
                if (!box) return;
                box.innerHTML = r.list.map(p => `<div class="list-item ${st.person && st.person.id === p.identifier ? 'active' : ''}" data-person="${esc(p.identifier)}" data-n="${esc(p.name)}">
                    <div class="avatar">${initials(p.name)}</div><div class="grow"><div class="row between"><span class="t ellipsis">${esc(p.name)}</span>${p.online ? `<span class="chip ok"><span class="dot"></span>${T('ui_online')}</span>` : ''}</div>
                    <div class="s">${esc(p.dept || '')} · ${T('tr_done_of', Number(p.done) || 0, Number(p.courses) || 0)}${p.last_eval ? ' · ' + T('tr_last_eval', fmtDate(p.last_eval)) : ''}</div></div></div>`).join('')
                    || `<div class="empty">${T('tr_no_people')}</div>`;
            }

            async function openPerson(id, name) {
                const r = await api('training:person', { id, name });
                if (r.error) return UI.err(r);
                const ov = st.ov, p = r.person;
                st.person = p;
                $$('[data-person]', win.body).forEach(x => x.classList.toggle('active', x.dataset.person === id));
                $('[data-detail]', win.body).innerHTML = `<div class="detail-head"><div class="avatar" style="width:44px;height:44px">${initials(p.name)}</div><div class="grow"><h2>${esc(p.name)}</h2>
                    <div class="sub">${p.online ? `<span class="chip ok"><span class="dot"></span>${T('ui_online')}</span>` : `<span class="chip">${T('ui_offline')}</span>`}
                    ${(p.certs || []).map(c => `<span class="chip accent">${icon('badge', 'sm')}${esc((ov.certs.find(x => x.id === c) || {}).label || c)}</span>`).join('')}</div></div>
                    <div class="detail-actions"><button class="btn sm" data-a="assign">${icon('plus', 'sm')}${T('tr_assign')}</button><button class="btn sm primary" data-a="evaluate">${icon('edit', 'sm')}${T('tr_new_eval')}</button></div></div>
                    <div class="detail-body">
                        <div class="card"><div class="card-title">${icon('book', 'sm')}${T('tr_tab_courses')}</div>${r.rows.length ? `<table class="tbl"><tbody>${r.rows.map(x => `<tr>
                            <td>${esc(x.title)}</td><td>${stChip(x.status)}${x.cert_status ? ` <span class="chip">${T('tr_cert_' + x.cert_status)}</span>` : ''}</td><td>${x.score != null ? x.score + ' %' : '-'} · ${T('tr_attempts', x.attempts)}</td>
                            <td class="row" style="justify-content:flex-end">${Number(x.has_test) ? `<button class="btn sm" data-test="${x.course_id}" ${p.online ? '' : 'disabled'}>${icon('training', 'sm')}${T('tr_start_test')}</button>` : ''}
                                ${x.status !== 'passed' && x.status !== 'completed' ? `<button class="btn sm ok" data-done="${x.course_id}">${icon('check', 'sm')}</button><button class="btn sm" data-fail="${x.course_id}">${icon('x', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
                            : `<span class="dim">${T('tr_nothing_yet')}</span>`}</div>
                        <div class="card"><div class="card-title">${icon('list', 'sm')}${T('tr_tests')}</div>${r.tests.length ? `<table class="tbl"><tbody>${r.tests.map(t => `<tr><td>${fmtDT(t.started_at)}</td><td>${esc(t.title || '')}</td>
                            <td><span class="chip ${Number(t.passed) ? 'ok' : t.status === 'running' ? 'info' : 'bad'}">${t.status === 'done' ? (Number(t.passed) ? T('test_passed') : T('test_failed')) : T('tr_test_' + t.status)}</span></td>
                            <td>${t.score != null ? t.score + ' %' : '-'}</td><td class="dim">${esc(t.fto_name || '')}</td></tr>`).join('')}</tbody></table>` : `<span class="dim">-</span>`}</div>
                        <div class="section-title">${T('tr_evals')}<span class="line"></span></div>
                        ${r.evaluations.map(e => evalCard(e, ov.can.manage)).join('') || `<div class="dim">${T('tr_no_evals')}</div>`}
                    </div>`;
            }

            // ---------- certification proposals ----------
            async function certsView() {
                const r = await api('training:proposals');
                if (r.error) return UI.err(r);
                $('[data-view]', win.body).innerHTML = `<div class="app-scroll"><div class="pad"><div class="muted" style="font-size:12px;margin-bottom:10px">${T('tr_certs_hint')}</div>
                    ${r.list.length ? `<table class="tbl"><thead><tr><th>${T('tr_person')}</th><th>${T('tr_course')}</th><th>${T('tr_cert')}</th><th>${T('tr_result')}</th><th>FTO</th><th></th></tr></thead><tbody>
                    ${r.list.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.title)}</td><td><span class="chip accent">${esc(x.certLabel || x.cert)}</span></td><td>${x.score != null ? x.score + ' %' : '-'}</td>
                        <td class="dim">${esc(x.fto_name || '')}</td><td class="row" style="justify-content:flex-end"><button class="btn sm ok" data-prop="${x.id}" data-ok="1">${icon('check', 'sm')}${T('tr_grant')}</button>
                        <button class="btn sm" data-prop="${x.id}" data-ok="0">${icon('x', 'sm')}</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${icon('badge')}${T('tr_no_proposals')}</div>`}</div></div>`;
            }

            async function setTab(t) {
                st.tab = t;
                const ov = await overview();
                if (!ov) return;
                if (t === 'courses') coursesView();
                else if (t === 'mine') mineView();
                else if (t === 'recruits' && ov.can.fto) recruitsView();
                else if (t === 'certs' && ov.can.certs) certsView();
                else { st.tab = 'courses'; coursesView(); }
            }
            win.refresh = () => setTab(st.tab);

            async function personAction(fn) {
                const ok = await fn();
                if (ok !== false && st.person) { await loadPeople(); openPerson(st.person.id, st.person.name); }
            }

            win.body.addEventListener('click', async e => {
                const tab = e.target.closest('[data-tab]');
                if (tab) return setTab(tab.dataset.tab);
                const c = e.target.closest('[data-course]');
                if (c) return openCourse(+c.dataset.course);
                const pr = e.target.closest('[data-person]');
                if (pr) return openPerson(pr.dataset.person, pr.dataset.n);
                const pc = e.target.closest('[data-printcert]');
                if (pc) return UI.print({ type: 'certificate', id: +pc.dataset.printcert }, T('tr_print_cert'));
                const tb = e.target.closest('[data-test]');
                if (tb) {
                    if (!(await UI.confirm(T('tr_confirm_test', esc(st.person.name))))) return;
                    const r = await api('training:startTest', { id: st.person.id, courseId: +tb.dataset.test });
                    if (r.error) return UI.err(r);
                    OS.toast({ title: T('tr_test_started'), text: st.person.name, type: 'success', app: 'training' });
                    return personAction(() => true);
                }
                const dn = e.target.closest('[data-done],[data-fail]');
                if (dn) {
                    const passed = !!dn.dataset.done;
                    const note = await UI.prompt(passed ? T('tr_mark_done') : T('tr_mark_failed'), '', { label: T('f_notes'), max: 500 });
                    if (note === null) return;
                    return personAction(async () => {
                        const r = await api('training:complete', { id: st.person.id, name: st.person.name, courseId: +(dn.dataset.done || dn.dataset.fail), passed, note });
                        if (r.error) { UI.err(r); return false; }
                    });
                }
                const ed = e.target.closest('[data-evdel]');
                if (ed) {
                    if (!(await UI.confirm(T('tr_confirm_eval_delete'), { danger: true }))) return;
                    return personAction(async () => { const r = await api('training:evalDelete', { id: +ed.dataset.evdel }); if (r.error) { UI.err(r); return false; } });
                }
                const prop = e.target.closest('[data-prop]');
                if (prop) {
                    const r = await api('training:proposal', { id: +prop.dataset.prop, approve: prop.dataset.ok === '1' });
                    if (r.error) return UI.err(r);
                    return setTab('certs');
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                const ov = st.ov;
                if (a.dataset.a === 'newCourse') { const id = await editCourse(null, ov); if (id) { st.course = id; setTab('courses'); } return; }
                if (a.dataset.a === 'editCourse') { const id = await editCourse(st.courseData, ov); if (id) setTab('courses'); return; }
                if (a.dataset.a === 'delCourse') {
                    if (!(await UI.confirm(T('tr_confirm_course_delete', esc(st.courseData.title)), { danger: true, ok: T('ui_delete') }))) return;
                    const r = await api('training:courseDelete', { id: st.course });
                    if (r.error) return UI.err(r);
                    st.course = null;
                    return setTab('courses');
                }
                if (a.dataset.a === 'cert') return UI.print({ type: 'certificate', id: st.course }, T('tr_print_cert'));
                if (a.dataset.a === 'addPerson') {
                    const p = await UI.pickOfficer({ title: T('tr_add_person') });
                    if (p) { st.person = p; openPerson(p.id, p.name); }
                    return;
                }
                if (a.dataset.a === 'evaluate') return personAction(() => evaluate(st.person, ov));
                if (a.dataset.a === 'assign') {
                    const c = await UI.modal({ title: T('tr_assign'), icon: 'book',
                        body: `<div class="pick-list">${ov.courses.filter(x => x.active).map(x => `<div class="pick-item" data-cid="${x.id}">${icon('book')}<span class="grow">${esc(x.title)}</span><span class="dim">${esc(x.category || '')}</span></div>`).join('')}</div>`,
                        buttons: [{ label: T('ui_cancel'), value: null }],
                        onOpen(el, close) { el.addEventListener('click', ev => { const it = ev.target.closest('[data-cid]'); if (it) close(+it.dataset.cid); }); } });
                    if (!c) return;
                    return personAction(async () => { const r = await api('training:assign', { id: st.person.id, name: st.person.name, courseId: c }); if (r.error) { UI.err(r); return false; } });
                }
            });

            if (args && args.ref) st.tab = 'mine';
            setTab(st.tab);
        },
        onArgs(win) { win.refresh && win.refresh(); },
    });
})();

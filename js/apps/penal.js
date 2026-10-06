// ==========================================
// App: penal code + calculator
// ==========================================
(function () {
    const TYPES = ['infraction', 'misdemeanor', 'felony'];

    Apps.define('penal', {
        w: 1120, h: 680,
        async mount(win) {
            const st = win.state = { list: [], cat: '', query: '', calc: [], canEdit: false };
            win.body.innerHTML = `<div class="app"><div class="app-body"><div class="app-side" data-side></div>
                <div class="grow" style="display:flex;flex-direction:column;min-width:0">
                    <div class="app-toolbar"><div class="search" style="width:320px">${icon('search')}<input class="input" data-q placeholder="${T('pe_search')}"></div><div class="grow"></div>
                        <button class="btn sm hidden" data-a="new">${icon('plus', 'sm')}${T('pe_new')}</button></div>
                    <div class="pen-row" style="cursor:default;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);font-weight:700">
                        <span>${T('pe_code')}</span><span>${T('pe_title')}</span><span>${T('pe_type')}</span><span>${T('pe_fine')}</span><span>${T('pe_jail')}</span></div>
                    <div class="app-scroll" data-list></div></div>
                <div class="pen-calc"><div class="app-toolbar"><h3>${icon('penal', 'sm')} ${T('pe_calc')}</h3><div class="grow"></div><button class="icon-btn" data-a="clear">${icon('trash', 'sm')}</button></div>
                    <div class="items" data-calc></div><div class="tot" data-tot></div></div></div></div>`;
            const q = $('[data-q]', win.body);
            q.addEventListener('input', () => { st.query = q.value.toLowerCase(); render(); });

            async function load() {
                const res = await api('penal:list');
                if (res.error) return UI.err(res);
                st.list = res.list;
                st.canEdit = res.canEdit;
                $('[data-a="new"]', win.body).classList.toggle('hidden', !st.canEdit);
                const cats = [...new Set(st.list.map(c => c.category || T('pe_other')))];
                $('[data-side]', win.body).innerHTML = `<button class="side-item ${!st.cat ? 'on' : ''}" data-cat="">${icon('list')}${T('ui_all')}<span class="n">${st.list.length}</span></button>
                    <div class="side-title">${T('pe_categories')}</div>
                    ${cats.map(c => `<button class="side-item ${st.cat === c ? 'on' : ''}" data-cat="${esc(c)}">${icon('folder')}<span class="ellipsis">${esc(c)}</span>
                        <span class="n">${st.list.filter(x => (x.category || T('pe_other')) === c).length}</span></button>`).join('')}
                    <div class="side-title">${T('pe_type')}</div>
                    ${TYPES.map(t => `<div class="side-item" style="cursor:default"><span class="type-${t}">●</span>${T('ptype_' + t)}</div>`).join('')}`;
                render();
            }

            function render() {
                const rows = st.list.filter(c => (!st.cat || (c.category || T('pe_other')) === st.cat)
                    && (!st.query || (c.code + ' ' + c.title + ' ' + (c.description || '')).toLowerCase().includes(st.query)));
                $('[data-list]', win.body).innerHTML = rows.map(c => `<div class="pen-row ${st.calc.find(x => x.id === c.id) ? 'on' : ''}" data-id="${c.id}">
                    <span class="code">${esc(c.code)}</span><div><div>${esc(c.title)}</div>${c.description ? `<div class="d">${esc(c.description)}</div>` : ''}</div>
                    <span class="type-${c.type}">${T('ptype_' + c.type)}</span><span>${money(c.fine)}</span><span class="row between">${c.jail} ${T('months_short')}
                    ${st.canEdit ? `<button class="icon-btn" data-edit="${c.id}" style="width:24px;height:24px">${icon('edit', 'sm')}</button>` : ''}</span></div>`).join('')
                    || `<div class="empty">${T('ui_nothing_found')}</div>`;
                calc();
            }

            function calc() {
                $('[data-calc]', win.body).innerHTML = st.calc.map((c, i) => `<div class="ci"><span class="mono accent">${esc(c.code)}</span><span class="grow ellipsis">${esc(c.title)}</span>
                    <div class="qty"><button data-dec="${i}">−</button><b style="width:18px;text-align:center">${c.count}</b><button data-inc="${i}">+</button></div></div>`).join('')
                    || `<div class="empty" style="padding:20px">${T('pe_calc_hint')}</div>`;
                const fine = st.calc.reduce((s, c) => s + c.fine * c.count, 0), jail = st.calc.reduce((s, c) => s + c.jail * c.count, 0);
                $('[data-tot]', win.body).innerHTML = `<div class="row between"><span class="muted">${T('pe_total_fine')}</span><b>${money(fine)}</b></div>
                    <div class="row between"><span class="muted">${T('pe_total_jail')}</span><b>${jail} ${T('months_short')}</b></div>
                    <div class="row"><button class="btn sm grow" data-a="copy" ${st.calc.length ? '' : 'disabled'}>${icon('copy', 'sm')}${T('pe_copy')}</button>
                    <button class="btn sm grow" data-a="print" ${st.calc.length ? '' : 'disabled'}>${icon('printer', 'sm')}${T('ui_print')}</button></div>`;
            }

            function form(c = {}) {
                return `<div class="grid2"><div class="field"><label>${T('pe_code')}</label><input class="input mono" id="p-code" maxlength="30" value="${esc(c.code || '')}"></div>
                    <div class="field"><label>${T('pe_type')}</label><select class="select" id="p-type">${TYPES.map(t => `<option value="${t}" ${t === (c.type || 'misdemeanor') ? 'selected' : ''}>${T('ptype_' + t)}</option>`).join('')}</select></div></div>
                    <div class="field"><label>${T('pe_title')}</label><input class="input" id="p-title" maxlength="120" value="${esc(c.title || '')}"></div>
                    <div class="field"><label>${T('pe_category')}</label><input class="input" id="p-cat" maxlength="60" value="${esc(c.category || st.cat || '')}"></div>
                    <div class="grid2"><div class="field"><label>${T('pe_fine')}</label><input class="input" id="p-fine" type="number" min="0" value="${c.fine || 0}"></div>
                    <div class="field"><label>${T('pe_jail')} (${T('months')})</label><input class="input" id="p-jail" type="number" min="0" value="${c.jail || 0}"></div></div>
                    <div class="field"><label>${T('f_description')}</label><textarea class="textarea" id="p-desc" maxlength="2000">${esc(c.description || '')}</textarea></div>`;
            }
            const collect = el => {
                const code = $('#p-code', el).value.trim(), title = $('#p-title', el).value.trim();
                if (!code || !title) return false;
                return { code, title, type: $('#p-type', el).value, category: $('#p-cat', el).value.trim(), fine: +$('#p-fine', el).value || 0,
                    jail: +$('#p-jail', el).value || 0, description: $('#p-desc', el).value };
            };

            win.body.addEventListener('click', async e => {
                const cat = e.target.closest('[data-cat]');
                if (cat) { st.cat = cat.dataset.cat; $$('[data-cat]', win.body).forEach(b => b.classList.toggle('on', b === cat)); return render(); }
                const plus = e.target.closest('[data-inc]'), minus = e.target.closest('[data-dec]');
                if (plus) { st.calc[+plus.dataset.inc].count++; return calc(); }
                if (minus) { const i = +minus.dataset.dec; if (--st.calc[i].count <= 0) st.calc.splice(i, 1); return render(); }
                const ed = e.target.closest('[data-edit]');
                if (ed) {
                    const c = st.list.find(x => x.id === +ed.dataset.edit);
                    {
                        const v = await UI.modal({ title: T('pe_edit'), icon: 'penal', body: form(c), buttons: [
                            { label: T('ui_delete'), value: 'delete', cls: 'danger' }, { label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect }] });
                        if (v === 'delete') {
                            if (!(await UI.confirm(T('pe_confirm_delete'), { danger: true }))) return;
                            const r = await api('penal:delete', { id: c.id });
                            if (r.error) return UI.err(r);
                        } else if (v) {
                            const r = await api('penal:save', { id: c.id, ...v });
                            if (r.error) return UI.err(r);
                        } else return;
                        return load();
                    }
                }
                const row = e.target.closest('.pen-row[data-id]');
                if (row) {
                    const c = st.list.find(x => x.id === +row.dataset.id);
                    const ex = st.calc.find(x => x.id === c.id);
                    if (ex) ex.count++; else st.calc.push({ ...c, count: 1 });
                    return render();
                }
                const a = e.target.closest('[data-a]');
                if (!a) return;
                if (a.dataset.a === 'clear') { st.calc = []; return render(); }
                if (a.dataset.a === 'new') {
                    const v = await UI.modal({ title: T('pe_new'), icon: 'penal', body: form(), buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_save'), cls: 'primary', collect }] });
                    if (!v) return;
                    const r = await api('penal:save', v);
                    if (r.error) return UI.err(r);
                    return load();
                }
                if (a.dataset.a === 'copy') {
                    const text = st.calc.map(c => `${c.code} ${c.title} x${c.count}`).join('\n');
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                    return OS.toast({ title: T('pe_copied'), type: 'success', app: 'penal' });
                }
                if (a.dataset.a === 'print') {
                    const subject = await UI.prompt(T('pe_print_subject'), '', { label: T('f_subject') });
                    if (subject === null) return;
                    UI.print({ type: 'penal', subject, charges: st.calc.map(c => ({ id: c.id, count: c.count })) }, T('pe_calc'));
                }
            });

            win.refresh = load;
            load();
        },
    });
})();

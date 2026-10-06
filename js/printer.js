// ==========================================
// Printer panel: status, paper / toner, queue, tray (pick up), copy, scan
// ==========================================
const PrinterUI = { data: null, tab: 'copy', sel: null, caseSel: null };

PrinterUI.open = function (data) {
    PrinterUI.data = data;
    if (!data.can.copy && data.can.scan) PrinterUI.tab = 'scan';
    PrinterUI.sel = null;
    $('#printer').classList.remove('hidden');
    PrinterUI.render();
};

PrinterUI.close = function () {
    $('#printer').classList.add('hidden');
    post('close', { layer: 'printer' });
};

PrinterUI.render = function () {
    const d = PrinterUI.data;
    const busy = d.queue.some(q => q.printing);
    const scr = d.err ? T('perr_' + d.err) : busy ? T('pr_printing') : T('pr_ready');
    const meter = (label, val, max, what, items) => {
        const pct = Math.round((val / max) * 100);
        return `<div class="meter"><div class="l"><span>${label}</span><b>${what === 'toner' ? val + ' %' : `${val} / ${max}`}</b></div>
            <div class="bar-h"><i class="${pct < 15 ? 'low' : ''}" style="width:${pct}%"></i></div>
            ${d.can.service ? `<button class="btn sm" data-refill="${what}" ${items ? '' : 'disabled'}>${icon('plus', 'sm')}${what === 'toner' ? T('pr_change_toner') : T('pr_add_paper', d.perPack)} <span class="dim">(${items})</span></button>` : ''}</div>`;
    };
    const papers = d.papers.filter(p => PrinterUI.tab === 'copy' || p.scan);
    $('#printer').innerHTML = `<div class="panel pr-panel">
        <div class="panel-head"><div class="logo">${icon('printer')}</div><div class="grow"><div class="ttl">${esc(d.label)}</div><div class="sub">${T('pr_panel_sub')}</div></div>
            <button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="panel-body">
            <div class="pr-side">
                <div class="pr-art ${busy ? 'busy' : ''}"><div class="scr ${d.err ? 'err' : ''}">${esc(scr)}</div><div class="tray"></div><div class="sheet"></div></div>
                ${d.paper != null ? meter(T('ui_paper'), d.paper, d.capacity, 'paper', d.paperItem) : ''}
                ${d.toner != null ? meter(T('ui_toner'), d.toner, 100, 'toner', d.tonerItem) : ''}
                <div><div class="section-title">${T('ui_queue')} (${d.queue.length})<span class="line"></span></div>
                    ${d.queue.map((q, i) => `<div class="q-item">${q.printing ? '<div class="spinner" style="width:12px;height:12px;border-width:2px"></div>' : icon('clock', 'sm')}
                        <span class="grow ellipsis">${esc(q.title)}${q.count > 1 ? ' ×' + q.count : ''}</span><span class="dim ellipsis" style="max-width:80px">${esc(q.owner || '')}</span>
                        ${!q.printing ? `<button class="icon-btn" data-cancel="${i - (d.queue[0] && d.queue[0].printing ? 1 : 0) + 1}" style="width:22px;height:22px">${icon('x', 'sm')}</button>` : ''}</div>`).join('') || `<div class="dim" style="font-size:11.5px">${T('pr_queue_empty')}</div>`}</div>
                <div><div class="section-title">${T('ui_tray')} (${d.tray.length})<span class="line"></span></div>
                    ${d.tray.map(t => `<div class="q-item">${icon('documents', 'sm')}<span class="grow ellipsis">${esc(t.title)}${t.count > 1 ? ' ×' + t.count : ''}</span>
                        ${t.mine ? `<span class="chip accent">${T('pr_yours')}</span>` : `<span class="dim">${esc(t.owner || '')}</span>`}</div>`).join('') || `<div class="dim" style="font-size:11.5px">${T('pr_tray_empty')}</div>`}
                    ${d.tray.length ? `<button class="btn primary" data-pickup style="width:100%;margin-top:8px">${icon('download', 'sm')}${T('pr_pickup')}</button>` : ''}</div>
            </div>
            <div class="pr-main">
                <div class="tabs">${d.can.copy ? `<button class="tab ${PrinterUI.tab === 'copy' ? 'on' : ''}" data-ptab="copy">${icon('copy', 'sm')}${T('pr_copy')}</button>` : ''}
                    ${d.can.scan ? `<button class="tab ${PrinterUI.tab === 'scan' ? 'on' : ''}" data-ptab="scan">${icon('scan', 'sm')}${T('pr_scan')}</button>` : ''}</div>
                ${d.can.copy || d.can.scan ? `<div class="pr-items">${papers.map((p, i) => `<div class="pr-item ${PrinterUI.sel === i ? 'on' : ''}" data-paper="${d.papers.indexOf(p)}">
                    <div class="img" ${bg(p.image || p.icon)}></div><div class="grow" style="min-width:0"><div class="t ellipsis">${esc(p.label)}</div><div class="s">${esc((p.description || '').split('\n')[0])}</div></div>
                    ${p.copy ? `<span class="chip warn">${T('pr_is_copy')}</span>` : ''}${PrinterUI.tab === 'scan' ? `<span class="chip">${p.scan === 'photo' ? T('pr_to_gallery') : T('pr_to_docs')}</span>` : ''}</div>`).join('')
                    || `<div class="empty">${icon('documents')}${T('pr_no_papers')}</div>`}</div>
                <div class="pr-foot">${PrinterUI.tab === 'copy' ? `<span class="muted">${T('ui_copies')}</span><input class="input" type="number" min="1" max="${d.maxCopies}" value="1" data-copies style="width:70px">
                    <div class="grow"></div><button class="btn primary" data-do="copy" ${PrinterUI.sel == null ? 'disabled' : ''}>${icon('copy', 'sm')}${T('pr_do_copy')}</button>`
                    : `${PrinterUI.selected() && PrinterUI.selected().scan === 'photo' && d.can.gallery ? `<select class="select" data-cat style="width:170px"><option value="">${T('ga_uncategorized')}</option>
                        ${d.categories.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select>` : ''}
                    <span class="chip accent" data-casechip>${PrinterUI.caseSel ? esc(PrinterUI.caseSel.case_no) : T('ui_no_case')}</span><button class="btn sm" data-pickcase>${icon('cases', 'sm')}</button>
                    <div class="grow"></div><button class="btn primary" data-do="scan" ${PrinterUI.sel == null ? 'disabled' : ''}>${icon('scan', 'sm')}${T('pr_do_scan')}</button>`}</div>`
                    : `<div class="empty">${T('err_no_permission')}</div>`}
            </div></div></div>`;
};

PrinterUI.selected = () => (PrinterUI.sel != null ? PrinterUI.data.papers[PrinterUI.sel] : null);

// case picker for the scan (no PC session at the printer -> own callback)
PrinterUI.pickCase = function () {
    return UI.modal({
        title: T('ui_pick_case'), icon: 'cases',
        body: `<div class="search">${icon('search')}<input class="input" id="pk-q" placeholder="${T('ui_search_case')}"></div><div class="pick-list" id="pk-list"></div>`,
        buttons: [{ label: T('ui_cancel'), value: null }, { label: T('ui_no_case'), value: { none: true } }],
        onOpen(el, close) {
            const load = async q => {
                const res = await srv('printer:scanCases', { id: PrinterUI.data.id, query: q });
                const list = (res && res.cases) || [];
                $('#pk-list', el).innerHTML = list.map((c, i) => `<div class="pick-item" data-i="${i}">${icon('folder')}<div class="grow"><div class="t">${esc(c.title)}</div>
                    <div class="s mono muted">${esc(c.case_no)}</div></div></div>`).join('') || `<div class="empty">${T('ui_nothing_found')}</div>`;
                el.onclick = e => { const it = e.target.closest('[data-i]'); if (it) close(list[+it.dataset.i]); };
            };
            $('#pk-q', el).addEventListener('input', debounce(e => load(e.target.value), 250));
            load('');
        },
    });
};

$('#printer').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return PrinterUI.close();
    const t = e.target.closest('[data-ptab]');
    if (t) { PrinterUI.tab = t.dataset.ptab; PrinterUI.sel = null; return PrinterUI.render(); }
    const p = e.target.closest('[data-paper]');
    if (p) { PrinterUI.sel = +p.dataset.paper; return PrinterUI.render(); }
    if (e.target.closest('[data-pickcase]')) {
        const c = await PrinterUI.pickCase();
        if (c) { PrinterUI.caseSel = c.none ? null : c; PrinterUI.render(); }
        return;
    }
    const d = PrinterUI.data;
    const act = (name, extra = {}) => { $('#printer').classList.add('hidden'); post('printerDo', { action: name, ...extra }); };
    if (e.target.closest('[data-pickup]')) return act('pickup');
    const rf = e.target.closest('[data-refill]');
    if (rf) return act('refill', { what: rf.dataset.refill });
    const cn = e.target.closest('[data-cancel]');
    if (cn) return act('cancel', { index: +cn.dataset.cancel });
    const go = e.target.closest('[data-do]');
    if (go) {
        const it = PrinterUI.selected();
        if (!it) return;
        if (go.dataset.do === 'copy') return act('copy', { item: it.name, slot: it.slot, inv: it.inv || false, copies: +$('[data-copies]').value || 1 });
        const cat = $('[data-cat]');
        return act('scan', { item: it.name, slot: it.slot, inv: it.inv || false, dest: it.scan, categoryId: cat ? (+cat.value || null) : null,
            caseId: PrinterUI.caseSel ? PrinterUI.caseSel.id : null });
    }
});

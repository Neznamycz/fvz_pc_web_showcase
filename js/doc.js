// ==========================================
// Printed document (police_document item): paper view, show to someone nearby, /policedocs list
// ==========================================
const Doc = { current: null };

Doc.kindLabel = k => T('dkind_' + (k || 'document'));

Doc.open = function (d) {
    Doc.current = d;
    if (d.poster) return Doc.poster(d);
    const fields = (d.fields || []).map(f => `<span>${esc(f.label)}</span><span>${esc(f.value)}</span>`).join('');
    const el = $('#doc');
    el.innerHTML = `<div class="doc-wrap">
        <div class="paper">
            ${d.copy ? `<div class="copy-mark"><span>${T('doc_copy_mark')}</span></div>` : ''}
            ${d.danger ? `<div class="danger">${T('doc_danger')}</div>` : ''}
            <div class="p-head"><div><div class="p-dept">${esc(d.dept || '')}</div><div class="p-kind">${esc(Doc.kindLabel(d.kind))}</div><div class="p-title">${esc(d.title || '')}</div></div>
                <div class="p-no">${esc(d.docNo || '')}<span>${esc(d.date || '')}</span></div></div>
            ${d.photo ? `<div class="p-photo" ${bg(d.photo)}></div>` : ''}
            ${fields ? `<div class="p-fields">${fields}</div>` : ''}
            <div class="md">${md(d.body || '')}</div>
            <div class="p-sign"><div>${T('doc_issued_by')}<br><b style="color:#1d2128">${esc(d.author || '')}</b></div>
                ${(d.signatures || []).length ? '' : `<div style="text-align:center"><div class="sig">${esc(d.signed || d.author || '')}</div>${T('doc_signature')}</div>`}</div>
            ${SignPad.list(d.signatures)}
            ${d.stamp ? `<div class="stamp ${d.stamp === 'approved' || d.stamp === 'court' ? 'ok' : ''}">${esc(T('doc_stamp_' + d.stamp))}</div>` : ''}
        </div>
        <div class="doc-side">
            ${d.shownBy ? `<div class="card"><div class="muted" style="font-size:11.5px">${T('doc_shown_by')}</div><b>${esc(d.shownBy)}</b></div>` : ''}
            ${d.copy ? `<div class="card"><span class="chip warn">${T('doc_is_copy')}</span></div>` : ''}
            ${d.canShow ? `<button class="btn" data-show>${icon('users', 'sm')}${T('doc_show')}</button>` : ''}
            ${d.canSign ? `<button class="btn primary" data-sign>${icon('edit', 'sm')}${T('sig_sign_doc')}</button>` : ''}
            <button class="btn" data-close>${icon('close', 'sm')}${T('ui_close')}</button></div></div>`;
    el.classList.remove('hidden');
};

// Most wanted poster
Doc.poster = function (d) {
    const el = $('#doc');
    el.innerHTML = `<div class="doc-wrap"><div class="paper poster">
            ${d.copy ? `<div class="copy-mark"><span>${T('doc_copy_mark')}</span></div>` : ''}
            <div class="ps-dept">${esc(d.dept || '')}</div><div class="ps-title">${T('wanted_title')}</div>
            <div class="ps-photo" ${bg(d.photo)}>${d.photo ? '' : icon('user', 'lg')}</div>
            <div class="ps-name">${esc(d.title || '')}</div>
            ${d.danger ? `<div class="ps-danger">${T('wanted_danger')}</div>` : ''}
            <div class="p-fields">${(d.fields || []).map(f => `<span>${esc(f.label)}</span><span>${esc(f.value)}</span>`).join('')}</div>
            <div class="ps-text">${md(d.body || '')}</div>
            <div class="ps-foot"><span class="mono">${esc(d.docNo || '')}</span><span>${esc(d.date || '')}</span></div></div>
        <div class="doc-side">${d.shownBy ? `<div class="card"><div class="muted" style="font-size:11.5px">${T('doc_shown_by')}</div><b>${esc(d.shownBy)}</b></div>` : ''}
            ${d.canShow ? `<button class="btn" data-show>${icon('users', 'sm')}${T('doc_show')}</button>` : ''}
            <button class="btn" data-close>${icon('close', 'sm')}${T('ui_close')}</button></div></div>`;
    el.classList.remove('hidden');
};

Doc.list = function (docs) {
    const el = $('#doc');
    el.innerHTML = `<div class="panel doc-list" style="height:auto;max-height:80vh">
        <div class="panel-head"><div class="logo">${icon('documents')}</div><div class="grow"><div class="ttl">${T('doc_list_title')}</div></div><button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="app-scroll">${docs.map(d => `<div class="list-item" data-slot="${d.slot}" data-inv="${esc(d.inv || '')}">${icon('documents')}
            <div class="grow"><div class="t">${esc(d.title)}</div><div class="s"><span class="mono">${esc(d.docNo || '')}</span> · ${esc(Doc.kindLabel(d.kind))} · ${esc(d.date || '')}</div></div>
            ${d.copy ? `<span class="chip warn">${T('doc_is_copy')}</span>` : ''}</div>`).join('')}</div></div>`;
    el.classList.remove('hidden');
};

Doc.close = function () {
    $('#doc').classList.add('hidden');
    if (!OS.isOpen) post('close', { layer: 'doc' });
};

$('#doc').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return Doc.close();
    const it = e.target.closest('[data-slot]');
    if (it) return post('docOpen', { slot: +it.dataset.slot, inv: it.dataset.inv || false });
    if (e.target.closest('[data-sign]')) {
        const path = await SignPad.open({ title: T('sig_sign_doc'), text: esc(Doc.current.title) });
        if (!path) return;
        const r = await srv('doc:sign', { path });
        if (!r || r.error) post('notify', { msg: errMsg(r), type: 'error' });
        return;
    }
    if (e.target.closest('[data-show]')) {
        const res = await post('docNearby');
        const people = (res && res.people) || [];
        if (!people.length) return post('notify', { msg: T('doc_nobody'), type: 'error' });
        const target = await UI.modal({
            title: T('doc_show'), icon: 'users',
            body: `<div class="pick-list">${people.map(p => `<div class="pick-item" data-pid="${p.id}">${icon('user')}<span class="grow">${esc(p.name)}</span></div>`).join('')}</div>`,
            buttons: [{ label: T('ui_cancel'), value: null }],
            onOpen(m, close) { m.addEventListener('click', ev => { const x = ev.target.closest('[data-pid]'); if (x) close(+x.dataset.pid); }); },
        });
        if (target) post('docShow', { target, docNo: Doc.current.docNo, title: Doc.current.title });
    }
});

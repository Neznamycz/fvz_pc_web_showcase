// ==========================================
// Admin panel (/fzpc): workplaces, computers + printers (raycast placement), roles, certifications
// ==========================================
const Admin = { data: null, tab: 'points', roleSel: 0, certSel: 0, dirty: false, form: null };

Admin.open = function (data) {
    Admin.data = data;
    Admin.tab = data.tab || Admin.tab;
    Admin.roles = JSON.parse(JSON.stringify(data.roles.roles));
    Admin.certs = JSON.parse(JSON.stringify(data.roles.certs));
    Admin.jobs = JSON.parse(JSON.stringify(data.roles.jobs));
    // an empty Lua table arrives as [] -> grade map must be an object
    Admin.jobs.forEach(j => { if (!j.map || Array.isArray(j.map)) j.map = Object.assign({}, j.map || {}); });
    Admin.dirty = false;
    Admin.form = null;
    $('#admin').classList.remove('hidden');
    Admin.render();
};

Admin.close = async function () {
    if (Admin.dirty && !(await UI.confirm(T('adm_unsaved')))) return;
    $('#admin').classList.add('hidden');
    post('close', { layer: 'admin' });
};

Admin.render = function () {
    const d = Admin.data;
    const nav = (id, ico, label) => `<button class="side-item ${Admin.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ico)}${label}</button>`;
    $('#admin').innerHTML = `<div class="panel">
        <div class="panel-head"><div class="logo">${icon('shield')}</div><div class="grow"><div class="ttl">FiveZone Police PC</div><div class="sub">${T('adm_sub')}</div></div>
            <div class="int-status">${[['forensics', 'fz_forensics'], ['mugshot', 'fz_mugshot'], ['board', 'fz_evidence_board']].map(([k, n]) => `<span class="chip ${d.integrations[k] ? 'ok' : ''}"><span class="dot"></span>${n}</span>`).join('')}</div>
            <button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="panel-body"><div class="adm-nav">${nav('points', 'mdt', T('adm_points'))}${nav('workplaces', 'pin', T('adm_workplaces'))}
            ${nav('roles', 'shield', T('adm_roles'))}${nav('mapping', 'list', T('adm_mapping'))}${nav('certs', 'badge', T('adm_certs'))}
            <div class="grow"></div>${['roles', 'mapping', 'certs'].includes(Admin.tab) ? `<button class="btn sm danger" data-a="reset">${T('adm_reset')}</button>
            <button class="btn primary" data-a="saveRoles" style="margin-top:6px">${icon('check', 'sm')}${T('adm_save_roles')}</button>` : ''}</div>
            <div class="adm-main">${Admin['tab_' + Admin.tab]()}</div></div></div>`;
};

// ---------- computers + printers + other points ----------
const PT_KINDS = { pc: ['mdt', 'adm_new_pc'], printer: ['printer', 'adm_new_printer'], interrogation: ['interrogations', 'adm_new_int'],
    public: ['desk', 'adm_new_public'], armory: ['armory', 'adm_new_armory'], screen: ['eye', 'adm_new_screen'] };
Admin.tab_points = function () {
    const d = Admin.data;
    if (!d.workplaces.length) return `<div class="empty">${icon('pin')}${T('adm_no_workplaces')}<button class="btn primary" data-tab="workplaces">${T('adm_create_workplace')}</button></div>`;
    const f = Admin.form;
    const form = f && f.type === 'point' ? `<div class="adm-form">
        <div style="font-weight:700">${f.id ? T('adm_edit_point') : T((PT_KINDS[f.kind] || PT_KINDS.pc)[1])}</div>
        <div class="grid3"><div class="field"><label>${T('adm_workplace')}</label><select class="select" id="af-wp">${d.workplaces.map(w => `<option value="${esc(w.id)}" ${w.id === f.workplace ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}</select></div>
            <div class="field"><label>${T('adm_label')}</label><input class="input" id="af-label" maxlength="80" value="${esc(f.label || '')}"></div>
            <div class="field"><label>${T('adm_prop')}</label><select class="select" id="af-prop">${(d.props[f.kind] || []).map(p => `<option value="${esc(p.model || '')}" ${(p.model || '') === (f.prop || '') ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
                ${f.prop && !(d.props[f.kind] || []).find(p => p.model === f.prop) ? `<option value="${esc(f.prop)}" selected>${esc(f.prop)}</option>` : ''}</select></div></div>
        ${f.kind === 'screen' ? `<div class="field"><label>${T('adm_screen_size')}</label><input class="input" id="af-size" type="number" min="0.4" max="8" step="0.1" value="${f.size || 1.6}">
            <div class="muted" style="font-size:11px">${T('adm_screen_hint')}</div></div>` : ''}
        ${f.kind === 'public' ? `<div class="muted" style="font-size:11px">${T('adm_public_hint')}</div>` : ''}
        ${f.kind === 'interrogation' ? `<div class="field"><label>${T('adm_int_radius')}</label><input class="input" id="af-radius" type="number" min="1.5" max="15" step="0.5" value="${f.radius || 4}">
            <div class="muted" style="font-size:11px">${T('adm_int_radius_hint')}</div></div>` : ''}
        <div class="field"><label>${T('adm_custom_prop')}</label><input class="input mono" id="af-custom" maxlength="64" placeholder="prop_name (${T('adm_optional')})"></div>
        <div class="muted" style="font-size:11.5px">${T('adm_place_hint')}</div>
        <div class="row"><button class="btn primary" data-a="place">${icon('pin', 'sm')}${f.id ? T('adm_move') : T('adm_place')}</button>
            ${f.id ? `<button class="btn" data-a="savePoint">${icon('check', 'sm')}${T('adm_save_only')}</button>` : ''}
            <button class="btn ghost" data-a="cancelForm">${T('ui_cancel')}</button></div></div>` : '';
    return `<div class="row"><button class="btn primary" data-a="newPc">${icon('mdt', 'sm')}${T('adm_new_pc')}</button>
            <button class="btn" data-a="newPrinter">${icon('printer', 'sm')}${T('adm_new_printer')}</button>
            <button class="btn" data-a="newInt">${icon('interrogations', 'sm')}${T('adm_new_int')}</button>
            <button class="btn" data-a="newPublic">${icon('desk', 'sm')}${T('adm_new_public')}</button>
            <button class="btn" data-a="newArmory">${icon('armory', 'sm')}${T('adm_new_armory')}</button>
            <button class="btn" data-a="newScreen">${icon('eye', 'sm')}${T('adm_new_screen')}</button></div>${form}
        ${d.workplaces.map(w => {
            const pts = d.points.filter(p => p.workplace === w.id);
            return `<div><div class="section-title">${icon('pin', 'sm')}${esc(w.label)}<span class="line"></span><span class="dim">${pts.length}</span></div>
                <div class="col">${pts.map(p => `<div class="adm-row"><div class="ic">${icon((PT_KINDS[p.kind] || PT_KINDS.pc)[0])}</div>
                    <div class="grow"><div class="t">${esc(p.label)} ${p.source === 'config' ? `<span class="chip">config</span>` : ''}</div>
                    <div class="s mono">${esc(p.id)} · ${p.prop ? esc(p.prop) : T('adm_no_prop')} · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}${p.radius ? ' · r ' + p.radius + ' m' : ''}</div></div>
                    <button class="btn sm" data-tp="${esc(p.id)}">${icon('pin', 'sm')}${T('adm_teleport')}</button>
                    ${p.source === 'db' ? `<button class="btn sm" data-editpt="${esc(p.id)}">${icon('edit', 'sm')}</button><button class="btn sm danger" data-delpt="${esc(p.id)}">${icon('trash', 'sm')}</button>` : ''}</div>`).join('')
                    || `<div class="dim" style="font-size:12px">${T('adm_no_points')}</div>`}</div></div>`;
        }).join('')}`;
};

// ---------- workplaces ----------
Admin.tab_workplaces = function () {
    const d = Admin.data, f = Admin.form;
    const form = f && f.type === 'wp' ? `<div class="adm-form">
        <div style="font-weight:700">${f.id ? T('adm_edit_workplace') : T('adm_create_workplace')}</div>
        <div class="field"><label>${T('adm_label')}</label><input class="input" id="aw-label" maxlength="80" value="${esc(f.label || '')}" placeholder="Mission Row PD"></div>
        <div class="field"><label>${T('adm_jobs')}</label><div class="jobs-pick" id="aw-jobs">${d.jobs.map(j => `<span class="chip ${(f.jobs || []).includes(j.id) ? 'accent' : ''}" data-job="${esc(j.id)}">${esc(j.short || j.id)}</span>`).join('')}</div>
            <div class="muted" style="font-size:11px">${T('adm_jobs_hint')}</div></div>
        <div class="row"><button class="btn primary" data-a="saveWp">${icon('check', 'sm')}${T('ui_save')}</button><button class="btn ghost" data-a="cancelForm">${T('ui_cancel')}</button></div></div>` : '';
    return `<div class="row"><button class="btn primary" data-a="newWp">${icon('plus', 'sm')}${T('adm_create_workplace')}</button></div>${form}
        <div class="col">${d.workplaces.map(w => `<div class="adm-row"><div class="ic">${icon('pin')}</div><div class="grow"><div class="t">${esc(w.label)} ${w.source === 'config' ? '<span class="chip">config</span>' : ''}</div>
            <div class="s">${w.jobs && w.jobs.length ? w.jobs.map(esc).join(', ') : T('adm_all_depts')} · ${d.points.filter(p => p.workplace === w.id).length} ${T('adm_points_n')}</div></div>
            ${w.source === 'db' ? `<button class="btn sm" data-editwp="${esc(w.id)}">${icon('edit', 'sm')}</button><button class="btn sm danger" data-delwp="${esc(w.id)}">${icon('trash', 'sm')}</button>` : ''}</div>`).join('')
            || `<div class="empty">${T('adm_no_workplaces')}</div>`}</div>`;
};

// ---------- roles ----------
function permGrid(perms, prefix) {
    const set = new Set(perms);
    const all = set.has('*');
    return `<label class="check" style="margin-bottom:6px"><input type="checkbox" data-${prefix}all ${all ? 'checked' : ''}>${T('adm_all_perms')}</label>
        <div class="perm-grid" ${all ? 'style="opacity:.4;pointer-events:none"' : ''}>${Admin.data.roles.catalog.map(a => `<div class="pg-app">${appIcon(a.app === 'bolo' ? 'warrants' : a.app === 'printer' ? 'documents' : a.app, 'sm', a.app === 'bolo' ? 'eye' : a.app === 'printer' ? 'printer' : undefined)}${T('app_' + a.app)}</div>
            <div class="acts">${a.actions.map(act => { const p = a.app + '.' + act; return `<label class="check"><input type="checkbox" data-${prefix}perm="${p}" ${set.has(p) || set.has(a.app + '.*') ? 'checked' : ''}>${T('act_' + act)}</label>`; }).join('')}</div>`).join('')}</div>`;
}

Admin.tab_roles = function () {
    const r = Admin.roles[Admin.roleSel];
    return `<div class="role-tabs">${Admin.roles.map((x, i) => `<button class="role-tab ${i === Admin.roleSel ? 'on' : ''}" data-role="${i}"><i style="background:${esc(x.color)}"></i>${esc(x.label)}</button>`).join('')}
        <button class="role-tab" data-a="addRole">${icon('plus', 'sm')}${T('adm_add_role')}</button></div>
        ${r ? `<div class="grid3"><div class="field"><label>ID</label><input class="input mono" data-rf="id" maxlength="30" value="${esc(r.id)}"></div>
            <div class="field"><label>${T('adm_label')}</label><input class="input" data-rf="label" maxlength="40" value="${esc(r.label)}"></div>
            <div class="field"><label>${T('f_color')}</label><div class="row"><input class="input mono" data-rf="color" maxlength="7" value="${esc(r.color)}"><button class="btn sm danger" data-a="delRole">${icon('trash', 'sm')}</button></div></div></div>
            ${permGrid(r.perms, 'r')}` : ''}`;
};

Admin.tab_mapping = function () {
    return `<div class="muted" style="font-size:12px">${T('adm_mapping_hint')}</div>
        ${Admin.jobs.map(j => `<div class="card"><div class="card-title">${esc(j.label)} <span class="chip">${esc(j.id)}</span></div>
            <div class="map-grid"><span class="h">${T('adm_grade')}</span><span class="h">${T('ro_rank')}</span><span class="h">${T('adm_role')}</span>
            ${j.grades.map(g => `<span class="mono">${g.grade}</span><span>${esc(g.label)}</span><select class="select" data-map="${esc(j.id)}" data-grade="${g.grade}">
                <option value="">${T('adm_inherit')}</option>${Admin.roles.map(r => `<option value="${esc(r.id)}" ${j.map[String(g.grade)] === r.id ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>`).join('')}</div></div>`).join('')}`;
};

Admin.tab_certs = function () {
    const c = Admin.certs[Admin.certSel];
    return `<div class="muted" style="font-size:12px">${T('adm_certs_hint')}</div>
        <div class="role-tabs">${Admin.certs.map((x, i) => `<button class="role-tab ${i === Admin.certSel ? 'on' : ''}" data-cert="${i}">${icon('badge', 'sm')}${esc(x.label)}</button>`).join('')}
        <button class="role-tab" data-a="addCert">${icon('plus', 'sm')}${T('adm_add_cert')}</button></div>
        ${c ? `<div class="grid2"><div class="field"><label>ID</label><input class="input mono" data-cf="id" maxlength="30" value="${esc(c.id)}"></div>
            <div class="field"><label>${T('adm_label')}</label><div class="row"><input class="input" data-cf="label" maxlength="40" value="${esc(c.label)}"><button class="btn sm danger" data-a="delCert">${icon('trash', 'sm')}</button></div></div></div>
            ${permGrid(c.perms, 'c')}` : ''}`;
};

// ---------- events ----------
$('#admin').addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return Admin.close();
    const tab = e.target.closest('[data-tab]');
    if (tab) { Admin.tab = tab.dataset.tab; Admin.form = null; return Admin.render(); }
    const d = Admin.data;
    const role = e.target.closest('[data-role]');
    if (role) { Admin.roleSel = +role.dataset.role; return Admin.render(); }
    const cert = e.target.closest('[data-cert]');
    if (cert) { Admin.certSel = +cert.dataset.cert; return Admin.render(); }
    const job = e.target.closest('[data-job]');
    if (job) {
        const f = Admin.form;
        f.jobs = f.jobs || [];
        const i = f.jobs.indexOf(job.dataset.job);
        if (i >= 0) f.jobs.splice(i, 1); else f.jobs.push(job.dataset.job);
        job.classList.toggle('accent', i < 0);
        return;
    }
    const tp = e.target.closest('[data-tp]');
    if (tp) return post('adminTeleport', { id: tp.dataset.tp });
    const ep = e.target.closest('[data-editpt]');
    if (ep) { const p = d.points.find(x => x.id === ep.dataset.editpt); Admin.form = { type: 'point', ...p }; return Admin.render(); }
    const dp = e.target.closest('[data-delpt]');
    if (dp) {
        if (!(await UI.confirm(T('adm_confirm_delete'), { danger: true }))) return;
        const r = await srv('admin:pointDelete', { id: dp.dataset.delpt });
        if (r && !r.error) { Admin.data = { ...d, ...r }; return Admin.render(); }
        return post('notify', { msg: errMsg(r), type: 'error' });
    }
    const ew = e.target.closest('[data-editwp]');
    if (ew) { const w = d.workplaces.find(x => x.id === ew.dataset.editwp); Admin.form = { type: 'wp', ...w, jobs: (w.jobs || []).slice() }; return Admin.render(); }
    const dw = e.target.closest('[data-delwp]');
    if (dw) {
        if (!(await UI.confirm(T('adm_confirm_delete'), { danger: true }))) return;
        const r = await srv('admin:workplaceDelete', { id: dw.dataset.delwp });
        if (r && !r.error) { Admin.data = { ...d, ...r }; return Admin.render(); }
        return post('notify', { msg: errMsg(r), type: 'error' });
    }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const act = a.dataset.a;
    const NEW = { newPc: 'pc', newPrinter: 'printer', newInt: 'interrogation', newPublic: 'public', newArmory: 'armory', newScreen: 'screen' };
    if (NEW[act]) {
        Admin.form = { type: 'point', kind: NEW[act], workplace: d.workplaces[0].id, label: '' };
        return Admin.render();
    }
    if (act === 'cancelForm') { Admin.form = null; return Admin.render(); }
    if (act === 'place' || act === 'savePoint') {
        const f = Admin.form;
        const custom = $('#af-custom').value.trim();
        const payload = { id: f.id, kind: f.kind, workplace: $('#af-wp').value, label: $('#af-label').value.trim(), prop: custom || $('#af-prop').value };
        if (f.kind === 'interrogation') payload.radius = +$('#af-radius').value || 4;
        if (f.kind === 'screen') payload.size = +$('#af-size').value || 1.6;
        if (act === 'savePoint') {
            const r = await srv('admin:pointSave', payload);
            if (r && !r.error) { Admin.data = { ...d, ...r }; Admin.form = null; return Admin.render(); }
            return post('notify', { msg: errMsg(r), type: 'error' });
        }
        $('#admin').classList.add('hidden');
        return post('adminPlace', payload);
    }
    if (act === 'newWp') { Admin.form = { type: 'wp', label: '', jobs: [] }; return Admin.render(); }
    if (act === 'saveWp') {
        const f = Admin.form;
        const r = await srv('admin:workplaceSave', { id: f.id, label: $('#aw-label').value.trim(), jobs: f.jobs });
        if (r && !r.error) { Admin.data = { ...d, ...r }; Admin.form = null; return Admin.render(); }
        return post('notify', { msg: errMsg(r), type: 'error' });
    }
    if (act === 'addRole') { Admin.roles.push({ id: 'role' + (Admin.roles.length + 1), label: T('adm_new_role'), color: '#95a5a6', perms: [] }); Admin.roleSel = Admin.roles.length - 1; Admin.dirty = true; return Admin.render(); }
    if (act === 'delRole') { if (Admin.roles.length > 1 && (await UI.confirm(T('adm_confirm_delete'), { danger: true }))) { Admin.roles.splice(Admin.roleSel, 1); Admin.roleSel = 0; Admin.dirty = true; } return Admin.render(); }
    if (act === 'addCert') { Admin.certs.push({ id: 'cert' + (Admin.certs.length + 1), label: T('adm_new_cert'), perms: [] }); Admin.certSel = Admin.certs.length - 1; Admin.dirty = true; return Admin.render(); }
    if (act === 'delCert') { if (await UI.confirm(T('adm_confirm_delete'), { danger: true })) { Admin.certs.splice(Admin.certSel, 1); Admin.certSel = 0; Admin.dirty = true; } return Admin.render(); }
    if (act === 'saveRoles') {
        const jobs = {};
        Admin.jobs.forEach(j => { jobs[j.id] = j.map; });
        const r = await srv('admin:rolesSave', { roles: Admin.roles, certs: Admin.certs, jobs });
        if (r && !r.error) { Admin.open({ ...r, tab: Admin.tab }); return post('notify', { msg: T('adm_saved'), type: 'success' }); }
        return post('notify', { msg: errMsg(r), type: 'error' });
    }
    if (act === 'reset') {
        if (!(await UI.confirm(T('adm_confirm_reset'), { danger: true }))) return;
        const r = await srv('admin:rolesReset');
        if (r && !r.error) Admin.open({ ...r, tab: Admin.tab });
    }
});

$('#admin').addEventListener('change', e => {
    const t = e.target;
    const toggle = (list, p, on) => { const i = list.indexOf(p); if (on && i < 0) list.push(p); if (!on && i >= 0) list.splice(i, 1); };
    if (t.dataset.rperm) { toggle(Admin.roles[Admin.roleSel].perms, t.dataset.rperm, t.checked); Admin.dirty = true; }
    if (t.dataset.cperm) { toggle(Admin.certs[Admin.certSel].perms, t.dataset.cperm, t.checked); Admin.dirty = true; }
    if (t.hasAttribute('data-rall')) { toggle(Admin.roles[Admin.roleSel].perms, '*', t.checked); Admin.dirty = true; Admin.render(); }
    if (t.hasAttribute('data-call')) { toggle(Admin.certs[Admin.certSel].perms, '*', t.checked); Admin.dirty = true; Admin.render(); }
    if (t.dataset.rf) { Admin.roles[Admin.roleSel][t.dataset.rf] = t.value.trim(); Admin.dirty = true; }
    if (t.dataset.cf) { Admin.certs[Admin.certSel][t.dataset.cf] = t.value.trim(); Admin.dirty = true; }
    if (t.dataset.map) {
        const j = Admin.jobs.find(x => x.id === t.dataset.map);
        if (t.value) j.map[t.dataset.grade] = t.value; else delete j.map[t.dataset.grade];
        Admin.dirty = true;
    }
});

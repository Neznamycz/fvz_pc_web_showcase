// ==========================================
// Map view (GTA map image of fz_evidence_board, same calibration)
// MapView.create(container, cfg, { onClick(world), onMarker(marker), view, onView(view) })
//   .set(markers, routes) - markers { x, y, color, label, note, at, icon }, routes { color, points: [{x, y}] }
// Pan with the mouse, zoom with the wheel (around the cursor). Markers keep their size.
// ==========================================
const MapView = {};

MapView.create = function (box, cfg, opts = {}) {
    const size = cfg.size || 4096, cal = cfg.calibration, k = size / 256;
    const toMap = (x, y) => ({ px: (cal.sx * x + cal.cx) * k, py: (-cal.sy * y + cal.cy) * k });
    const toWorld = (px, py) => ({ x: (px / k - cal.cx) / cal.sx, y: (cal.cy - py / k) / cal.sy });

    box.classList.add('mv');
    box.innerHTML = `<div class="mv-stage"><img src="${esc(cfg.image)}" draggable="false"></div>
        <svg class="mv-lines"></svg><div class="mv-pins"></div><div class="mv-tip hidden"></div>
        <div class="mv-zoom"><button class="icon-btn" data-z="1">${icon('plus', 'sm')}</button><button class="icon-btn" data-z="-1">${icon('min', 'sm')}</button>
        <button class="icon-btn" data-z="0">${icon('grid', 'sm')}</button></div>`;
    const stage = $('.mv-stage', box), pinsEl = $('.mv-pins', box), svg = $('.mv-lines', box), tip = $('.mv-tip', box);
    const v = Object.assign({ s: 0, tx: 0, ty: 0 }, opts.view || {});
    let markers = [], routes = [];

    function fit() {
        const w = box.clientWidth || 600, h = box.clientHeight || 400;
        if (markers.length) {
            const pts = markers.map(m => toMap(m.x, m.y));
            const minX = Math.min(...pts.map(p => p.px)), maxX = Math.max(...pts.map(p => p.px));
            const minY = Math.min(...pts.map(p => p.py)), maxY = Math.max(...pts.map(p => p.py));
            const pad = 260;
            v.s = Math.min(1.4, Math.max(0.12, Math.min(w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2))));
            v.tx = w / 2 - ((minX + maxX) / 2) * v.s;
            v.ty = h / 2 - ((minY + maxY) / 2) * v.s;
        } else {
            v.s = Math.max(w / size, h / size);
            v.tx = (w - size * v.s) / 2;
            v.ty = (h - size * v.s) / 2;
        }
    }

    function render() {
        stage.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.s})`;
        const scr = (x, y) => { const p = toMap(x, y); return { x: p.px * v.s + v.tx, y: p.py * v.s + v.ty }; };
        pinsEl.innerHTML = markers.map((m, i) => {
            const p = scr(m.x, m.y);
            return `<div class="mv-pin ${m.auto ? 'auto' : ''}" data-i="${i}" style="left:${p.x}px;top:${p.y}px;--c:${esc(m.color || '#f1c40f')}">
                ${m.icon ? icon(m.icon, 'sm') : ''}${m.short ? `<b>${esc(m.short)}</b>` : ''}</div>`;
        }).join('');
        svg.innerHTML = routes.map(r => {
            const pts = r.points.map(pt => { const p = scr(pt.x, pt.y); return `${p.x},${p.y}`; }).join(' ');
            return `<polyline points="${pts}" fill="none" stroke="${esc(r.color || '#f1c40f')}" stroke-width="2" stroke-dasharray="6 4" stroke-linecap="round"/>`;
        }).join('');
        if (opts.onView) opts.onView({ ...v });
    }

    function zoomAt(f, cx, cy) {
        const ns = Math.min(2.5, Math.max(0.08, v.s * f));
        v.tx = cx - (cx - v.tx) * (ns / v.s);
        v.ty = cy - (cy - v.ty) * (ns / v.s);
        v.s = ns;
        render();
    }

    box.addEventListener('wheel', e => {
        e.preventDefault();
        const r = box.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    let drag = null;
    box.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.closest('.mv-zoom') || e.target.closest('.mv-pin')) return;
        drag = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
        box.classList.add('dragging');
    });
    const move = e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        v.tx = drag.tx + dx;
        v.ty = drag.ty + dy;
        render();
    };
    const up = e => {
        if (!drag) return;
        const d = drag;
        drag = null;
        box.classList.remove('dragging');
        if (!d.moved && opts.onClick && box.contains(e.target)) {
            const r = box.getBoundingClientRect();
            const px = (e.clientX - r.left - v.tx) / v.s, py = (e.clientY - r.top - v.ty) / v.s;
            opts.onClick(toWorld(px, py));
        }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);

    box.addEventListener('click', e => {
        const z = e.target.closest('[data-z]');
        if (z) {
            const n = +z.dataset.z;
            if (n === 0) { fit(); render(); } else zoomAt(n > 0 ? 1.4 : 1 / 1.4, box.clientWidth / 2, box.clientHeight / 2);
            return;
        }
        const pin = e.target.closest('.mv-pin');
        if (pin && opts.onMarker) opts.onMarker(markers[+pin.dataset.i]);
    });
    box.addEventListener('mouseover', e => {
        const pin = e.target.closest('.mv-pin');
        if (!pin) return tip.classList.add('hidden');
        const m = markers[+pin.dataset.i];
        tip.innerHTML = `<b>${esc(m.label || '')}</b>${m.note ? `<div>${esc(m.note)}</div>` : ''}${m.sub ? `<div class="dim">${esc(m.sub)}</div>` : ''}`;
        tip.style.left = (parseFloat(pin.style.left) + 14) + 'px';
        tip.style.top = (parseFloat(pin.style.top) - 10) + 'px';
        tip.classList.remove('hidden');
    });
    box.addEventListener('mouseleave', () => tip.classList.add('hidden'));

    const inst = {
        toMap, toWorld,
        set(list, routeList) {
            markers = list || [];
            routes = routeList || [];
            if (!v.s) fit();
            render();
        },
        fit() { fit(); render(); },
        center(x, y, s) {
            const p = toMap(x, y);
            if (s) v.s = s;
            v.tx = box.clientWidth / 2 - p.px * v.s;
            v.ty = box.clientHeight / 2 - p.py * v.s;
            render();
        },
        destroy() {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        },
    };
    return inst;
};

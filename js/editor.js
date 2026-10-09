/* Cozy Notebook – page editor: selection, move/resize/rotate, text editing, history, clipboard */
(function () {
  const NB = window.NB;
  const { h, uid, clamp } = NB;

  const E = (NB.editor = {});
  const CLIP_MARK = '[[cozy-notebook-items]]';
  const TEXTLIKE = new Set(['text', 'sticky', 'shape']);

  let page = null, ctx = null, pageEl = null, layer = null, ink = null;
  let refs = { workspace: null, sizer: null, book: null };
  let scale = 1;
  let selected = [];
  const els = new Map();
  let editing = null;
  let hist = { undo: [], redo: [], last: '' };
  let savedRange = null;
  let drag = null;

  E.hooks = { selection() {}, history() {}, page() {}, layout() {} };
  E.page = () => page;
  E.ink = () => ink;
  E.scale = () => scale;
  E.selection = () => selected.map((id) => byId(id)).filter(Boolean);
  E.isEditing = () => !!editing;
  E.el = (id) => els.get(id);
  E.pageEl = () => pageEl;

  const byId = (id) => page && page.items.find((i) => i.id === id);
  const S = () => NB.state.settings;
  const api = {
    changed(soft) {
      if (page) page.updated = Date.now();
      NB.markDirty();
    },
    commit() { E.commit(); },
  };

  E.init = function (r) {
    refs = r;
    document.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('selectionchange', () => {
      if (!editing) return;
      const sel = getSelection();
      const c = editableOf(editing);
      if (sel.rangeCount && c && c.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    });
    refs.workspace.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    refs.workspace.addEventListener('drop', async (e) => {
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => f.type.startsWith('image/'));
      if (!files.length || !page) return;
      e.preventDefault();
      const pt = toPage(e);
      let i = 0;
      for (const f of files) await E.addImageFile(f, [pt[0] + i * 24, pt[1] + i * 24]), i++;
    });
  };

  /* ---------------- coordinates / layout ---------------- */
  function toPage(e) {
    const r = pageEl.getBoundingClientRect();
    const k = pageEl.offsetWidth / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  }

  E.viewCenter = function () {
    const ws = refs.workspace.getBoundingClientRect();
    const pr = pageEl.getBoundingClientRect();
    const k = pageEl.offsetWidth / pr.width;
    const cx = clamp((ws.left + ws.width / 2 - pr.left) * k, 60, S().pageWidth - 60);
    const cy = clamp((ws.top + ws.height / 2 - pr.top) * k, 120, page.h - 60);
    return [cx, cy];
  };

  E.layout = function () {
    if (!page) return;
    const W = S().pageWidth;
    const bookW = 34 + W + 100;
    refs.sizer.style.width = bookW * scale + 'px';
    refs.sizer.style.height = (page.h + 70) * scale + 'px';
    refs.book.style.width = bookW + 'px';
    refs.book.style.height = page.h + 70 + 'px';
    refs.book.style.transform = `scale(${scale})`;
    refs.book.style.setProperty('--inv', String(1 / scale));
    refs.book.style.setProperty('--pw', W + 'px');
    pageEl.style.height = page.h + 'px';
    pageEl.style.width = W + 'px';
    E.hooks.layout();
  };

  E.setScale = function (s) {
    scale = clamp(s, 0.3, 3);
    E.layout();
    clearTimeout(E._rz);
    E._rz = setTimeout(() => ink && ink.resize(), 120);
    return scale;
  };

  E.extendPage = function (by = 500) {
    page.h += by;
    E.layout();
    ink.resize();
    E.commit();
  };

  function ensureRoom() {
    if (!S().autoExtend) return;
    let bottom = 0;
    for (const it of page.items) {
      const el = els.get(it.id);
      const hh = el ? Math.max(it.h, el.offsetHeight) : it.h;
      bottom = Math.max(bottom, it.y + hh);
    }
    if (bottom > page.h - 60) {
      page.h = Math.round(bottom + 320);
      E.layout();
      ink.resize();
    }
  }

  /* ---------------- open / close a page ---------------- */
  const snap = () => JSON.stringify([page.items, page.strokes, page.h, page.paper, page.color]);

  E.open = function (pg, context) {
    E.stopEdit(true);
    page = pg;
    ctx = context;
    selected = [];
    els.clear();
    drag = null;
    hist = { undo: [], redo: [], last: snap() };

    pageEl = h('div', { class: 'page' });
    const head = h('div', { class: 'page-head' });
    if (ctx.isBoard) {
      head.appendChild(h('div', { class: 'board-title' }, '📌 ' + ctx.sec.name + ' — board'));
    } else {
      const title = h('input', {
        class: 'page-title', value: pg.title || '', placeholder: 'Untitled page', spellcheck: 'false', maxlength: 120,
        onInput: (e) => { pg.title = e.target.value; pg.updated = Date.now(); NB.markDirty(); E.hooks.page('title'); },
      });
      head.appendChild(title);
      if (S().showDate) head.appendChild(h('div', { class: 'page-date' }, NB.formatDate(pg.created)));
    }
    layer = h('div', { class: 'items-layer' });
    const canvas = h('canvas', { class: 'ink-canvas' });
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'ink-overlay');
    pageEl.append(head, layer, canvas, overlay);

    E.applyPageStyle();
    E.layout();
    for (const it of pg.items) {
      const el = NB.items.build(it, api);
      els.set(it.id, el);
      layer.appendChild(el);
    }
    reindex();

    ink = new NB.Ink({
      canvas, overlay,
      page: () => page,
      scale: () => scale,
      scroller: () => refs.workspace,
      isDark: () => NB.luminance(page.color) < 0.4,
      onChange: () => E.commit(),
      onExtend: () => {
        const last = page.strokes[page.strokes.length - 1];
        const y = last ? last.pts[last.pts.length - 1][1] : page.h;
        page.h = Math.round(y + 400);
        E.layout();
      },
    });
    ink.updateTool();

    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('dblclick', onDbl);
    E.hooks.selection();
    E.hooks.history();
    return pageEl;
  };

  E.applyPageStyle = function () {
    if (!pageEl) return;
    pageEl.className = 'page paper-' + page.paper + (NB.luminance(page.color) < 0.4 ? ' dark-paper' : '');
    pageEl.style.setProperty('--paper', page.color);
    pageEl.style.width = S().pageWidth + 'px';
  };

  function reindex() {
    page.items.forEach((it, i) => {
      const el = els.get(it.id);
      if (el) el.style.zIndex = i + 1;
    });
  }

  /* ---------------- history ---------------- */
  E.commit = function () {
    if (!page) return;
    const s = snap();
    if (s === hist.last) return;
    hist.undo.push(hist.last);
    if (hist.undo.length > 120) hist.undo.shift();
    hist.redo = [];
    hist.last = s;
    page.updated = Date.now();
    NB.markDirty();
    E.hooks.history();
  };

  function restore(s) {
    const [items, strokes, hh, paper, color] = JSON.parse(s);
    page.items = items;
    page.strokes = strokes;
    page.h = hh;
    page.paper = paper;
    page.color = color;
    const keep = selected.filter((id) => items.some((i) => i.id === id));
    editing = null;
    els.clear();
    layer.innerHTML = '';
    for (const it of items) {
      const el = NB.items.build(it, api);
      els.set(it.id, el);
      layer.appendChild(el);
    }
    reindex();
    E.applyPageStyle();
    E.layout();
    ink.resize();
    E.select(keep);
    NB.markDirty();
    E.hooks.history();
    E.hooks.page('restore');
  }

  E.undo = function () {
    E.stopEdit(true);
    if (!hist.undo.length) return;
    hist.redo.push(hist.last);
    hist.last = hist.undo.pop();
    restore(hist.last);
  };
  E.redo = function () {
    E.stopEdit(true);
    if (!hist.redo.length) return;
    hist.undo.push(hist.last);
    hist.last = hist.redo.pop();
    restore(hist.last);
  };
  E.canUndo = () => hist.undo.length > 0;
  E.canRedo = () => hist.redo.length > 0;

  /* ---------------- selection ---------------- */
  E.select = function (ids) {
    ids = ids.filter((id) => els.has(id));
    if (editing && !(ids.length === 1 && ids[0] === editing)) E.stopEdit();
    selected = ids;
    paintSelection();
    E.hooks.selection();
  };
  E.selectedIds = () => selected.slice();

  const HANDLE_SETS = {
    all: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    line: ['w', 'e'],
  };

  function paintSelection() {
    els.forEach((el, id) => {
      el.classList.toggle('selected', selected.includes(id));
      el.querySelectorAll(':scope > .handle, :scope > .rot-stem').forEach((n) => n.remove());
    });
    if (selected.length === 1 && !editing) {
      const it = byId(selected[0]);
      const el = els.get(selected[0]);
      if (it && el && !it.locked) {
        const set = it.type === 'shape' && (it.kind === 'line' || it.kind === 'arrow') ? HANDLE_SETS.line : HANDLE_SETS.all;
        set.forEach((d) => el.appendChild(h('div', { class: 'handle h-' + d, 'data-h': d })));
        el.appendChild(h('div', { class: 'rot-stem' }));
        el.appendChild(h('div', { class: 'handle rot', 'data-h': 'rot', title: 'Rotate (Shift = snap)' }));
      }
    }
  }

  /* ---------------- items: add / remove / update ---------------- */
  E.addItem = function (it, opts = {}) {
    page.items.push(it);
    const el = NB.items.build(it, api);
    els.set(it.id, el);
    layer.appendChild(el);
    reindex();
    ensureRoom();
    E.select([it.id]);
    E.commit();
    if (opts.edit) E.startEdit(it.id, true);
    return it;
  };

  /** Refresh an item's DOM after a property change. */
  E.refresh = function (it, rebuild = true) {
    const el = els.get(it.id);
    if (!el) return;
    if (rebuild) NB.items.fill(el, it, api);
    NB.items.applyGeom(el, it);
    paintSelection();
    NB.markDirty();
  };

  E.deleteSelection = function () {
    if (!selected.length) return;
    const ids = new Set(selected);
    page.items = page.items.filter((i) => !ids.has(i.id));
    ids.forEach((id) => { const el = els.get(id); el && el.remove(); els.delete(id); });
    editing = null;
    selected = [];
    reindex();
    paintSelection();
    E.hooks.selection();
    E.commit();
  };

  E.duplicate = function () {
    if (!selected.length) return;
    const copies = selected.map((id) => {
      const c = NB.clone(byId(id));
      c.id = uid('i');
      c.x += 26;
      c.y += 26;
      c.locked = false;
      return c;
    });
    pasteItems(copies, false);
  };

  function pasteItems(items, offset) {
    E.stopEdit(true);
    const ids = [];
    for (const src of items) {
      const c = NB.clone(src);
      c.id = uid('i');
      if (offset) { c.x += 30; c.y += 30; }
      page.items.push(c);
      const el = NB.items.build(c, api);
      els.set(c.id, el);
      layer.appendChild(el);
      ids.push(c.id);
    }
    reindex();
    ensureRoom();
    E.select(ids);
    E.commit();
  }

  E.zOrder = function (dir) {
    if (!selected.length) return;
    const sel = new Set(selected);
    const picked = page.items.filter((i) => sel.has(i.id));
    const rest = page.items.filter((i) => !sel.has(i.id));
    if (dir === 'front') page.items = [...rest, ...picked];
    else if (dir === 'back') page.items = [...picked, ...rest];
    else {
      const items = page.items;
      if (dir === 'up') for (let i = items.length - 2; i >= 0; i--) if (sel.has(items[i].id) && !sel.has(items[i + 1].id)) [items[i], items[i + 1]] = [items[i + 1], items[i]];
      if (dir === 'down') for (let i = 1; i < items.length; i++) if (sel.has(items[i].id) && !sel.has(items[i - 1].id)) [items[i], items[i - 1]] = [items[i - 1], items[i]];
    }
    page.items.forEach((it) => layer.appendChild(els.get(it.id)));
    reindex();
    E.commit();
  };

  E.align = function (how) {
    const sel = E.selection();
    if (sel.length < 2) return;
    const box = (it) => { const el = els.get(it.id); return { l: it.x, t: it.y, r: it.x + it.w, b: it.y + Math.max(it.h, el ? el.offsetHeight : 0) }; };
    const bs = sel.map(box);
    const L = Math.min(...bs.map((b) => b.l)), R = Math.max(...bs.map((b) => b.r));
    const T = Math.min(...bs.map((b) => b.t)), B = Math.max(...bs.map((b) => b.b));
    sel.forEach((it, i) => {
      const b = bs[i];
      if (how === 'left') it.x = L;
      if (how === 'right') it.x = R - (b.r - b.l);
      if (how === 'center') it.x = (L + R) / 2 - (b.r - b.l) / 2;
      if (how === 'top') it.y = T;
      if (how === 'bottom') it.y = B - (b.b - b.t);
      if (how === 'middle') it.y = (T + B) / 2 - (b.b - b.t) / 2;
      NB.items.applyGeom(els.get(it.id), it);
    });
    if (how === 'hdist' || how === 'vdist') {
      const key = how === 'hdist' ? 'x' : 'y';
      const sorted = sel.slice().sort((a, b) => a[key] - b[key]);
      const first = sorted[0][key], last = sorted[sorted.length - 1][key];
      sorted.forEach((it, i) => { it[key] = first + ((last - first) * i) / (sorted.length - 1); NB.items.applyGeom(els.get(it.id), it); });
    }
    E.commit();
  };

  /* ---------------- images ---------------- */
  E.addImageFile = async function (file, at) {
    try {
      NB.toast('Adding image…');
      const { data, w, h: ih } = await NB.processImageFile(file);
      const asset = await NB.addAsset(data);
      const k = Math.min(1, 380 / w, 420 / ih);
      const pt = at || E.viewCenter();
      const it = NB.makeItem('image', { asset, nat: { w, h: ih }, w: Math.round(w * k), h: Math.round(ih * k) });
      it.x = Math.round(clamp(pt[0] - it.w / 2, 10, S().pageWidth - it.w - 10));
      it.y = Math.round(Math.max(110, pt[1] - it.h / 2));
      E.addItem(it);
      NB.toast('Image added – drag the handles to resize, double-click to crop');
      return it;
    } catch (err) {
      console.error(err);
      NB.toast('Could not add that image');
    }
  };

  E.addImageUrl = async function (url) {
    try {
      const img = await NB.loadImage(url);
      const w = img.naturalWidth, ih = img.naturalHeight, k = Math.min(1, 380 / w, 420 / ih);
      const pt = E.viewCenter();
      const it = NB.makeItem('image', { url, nat: { w, h: ih }, w: Math.round(w * k), h: Math.round(ih * k) });
      it.x = Math.round(pt[0] - it.w / 2);
      it.y = Math.round(Math.max(110, pt[1] - it.h / 2));
      E.addItem(it);
    } catch (e) {
      NB.toast('Could not load that image address');
    }
  };

  /* ---------------- pointer interaction ---------------- */
  function editableOf(id) {
    const el = els.get(id);
    return el && el.querySelector('.editable');
  }

  function onDown(e) {
    if (e.button === 2) return;
    if (NB.INK_TOOLS.includes(NB.tool.name)) return;
    const itemEl = e.target.closest('.item');
    const t = NB.tool.name;

    if (itemEl && !(t === 'shape')) {
      const it = byId(itemEl.dataset.id);
      if (!it) return;
      const handle = e.target.closest('.handle');
      if (handle) return startHandle(e, it, handle.dataset.h);
      if (editing === it.id && e.target.closest('.editable')) return; // native caret handling
      if (e.target.closest('input, textarea, button, select')) {
        if (editing) E.stopEdit();
        if (!selected.includes(it.id)) E.select([it.id]);
        return;
      }
      if (editing && editing !== it.id) E.stopEdit();
      const wasSel = selected.includes(it.id);
      if (e.shiftKey) {
        E.select(wasSel ? selected.filter((i) => i !== it.id) : [...selected, it.id]);
        return;
      }
      if (!wasSel) E.select([it.id]);
      if (it.locked) return;
      e.preventDefault();
      startMove(e, wasSel && selected.length === 1 ? it : null);
      return;
    }

    // empty area
    if (editing) E.stopEdit();
    NB.closeMenu();
    const pt = toPage(e);
    if (t === 'text' || t === 'sticky') {
      e.preventDefault();
      return startPlace(e, t, pt);
    }
    if (t === 'shape') {
      e.preventDefault();
      return startShape(e, pt);
    }
    e.preventDefault();
    startMarquee(e, pt);
  }

  function onDbl(e) {
    const itemEl = e.target.closest('.item');
    if (!itemEl) return;
    const it = byId(itemEl.dataset.id);
    if (!it || it.locked) return;
    if (it.type === 'image') return NB.openCrop && NB.openCrop(it);
    if (it.type === 'todo') { const i = itemEl.querySelector('.todo-title'); i && i.focus(); return; }
    if (TEXTLIKE.has(it.type)) E.startEdit(it.id);
  }

  function listen(move, up) {
    const mv = (e) => move(e);
    const u = (e) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', u);
      window.removeEventListener('pointercancel', u);
      up(e);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', u);
    window.addEventListener('pointercancel', u);
  }

  const snapV = (v) => (S().snap ? Math.round(v / S().grid) * S().grid : v);

  function startMove(e, clickToEdit) {
    const start = toPage(e);
    const sel = E.selection().filter((i) => !i.locked);
    const orig = sel.map((i) => [i, i.x, i.y]);
    let moved = false;
    listen(
      (ev) => {
        const p = toPage(ev);
        const dx = p[0] - start[0], dy = p[1] - start[1];
        if (!moved && Math.hypot(dx, dy) * scale < 4) return;
        moved = true;
        orig.forEach(([it, x, y], idx) => {
          it.x = Math.round(snapV(x + dx) * 10) / 10;
          it.y = Math.round(snapV(y + dy) * 10) / 10;
          if (idx > 0 && S().snap) { it.x = x + (orig[0][0].x - orig[0][1]); it.y = y + (orig[0][0].y - orig[0][2]); }
          const el = els.get(it.id);
          el.style.left = it.x + 'px';
          el.style.top = it.y + 'px';
        });
        const f = refs.workspace.getBoundingClientRect();
        if (ev.clientY > f.bottom - 30) refs.workspace.scrollTop += 12;
        else if (ev.clientY < f.top + 30) refs.workspace.scrollTop -= 12;
      },
      () => {
        if (moved) { ensureRoom(); E.commit(); }
        else if (clickToEdit && TEXTLIKE.has(clickToEdit.type) && !e.shiftKey) E.startEdit(clickToEdit.id);
      }
    );
  }

  function startHandle(e, it, dir) {
    e.preventDefault();
    e.stopPropagation();
    const el = els.get(it.id);
    if (dir === 'rot') {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      listen(
        (ev) => {
          let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
          if (ev.shiftKey) a = Math.round(a / 15) * 15;
          else for (const q of [0, 90, 180, -90, -180, 270]) if (Math.abs(a - q) < 3.5) a = q;
          a = ((a + 180) % 360 + 360) % 360 - 180;
          it.rot = Math.round(a * 10) / 10;
          el.style.transform = `rotate(${it.rot}deg)`;
          E.hooks.selection(true);
        },
        () => E.commit()
      );
      return;
    }
    const st = { x: it.x, y: it.y, w: it.w, h: NB.items.AUTO_H.has(it.type) ? Math.max(it.h, el.offsetHeight) : it.h };
    const rad = ((it.rot || 0) * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const p0 = toPage(e);
    const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
    const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
    const corner = sx !== 0 && sy !== 0;
    const keepRatio = it.type === 'image' || it.type === 'sticker' || it.type === 'deco';
    const isLine = it.type === 'shape' && (it.kind === 'line' || it.kind === 'arrow');
    const minW = it.type === 'deco' ? 16 : 28, minH = it.type === 'deco' ? 16 : 20;
    listen(
      (ev) => {
        const p = toPage(ev);
        const dx = p[0] - p0[0], dy = p[1] - p0[1];
        const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
        let nw = st.w + sx * lx, nh = st.h + sy * ly;
        if (corner && (keepRatio ? !ev.altKey : ev.shiftKey)) {
          const k = Math.max(nw / st.w, nh / st.h);
          nw = st.w * k;
          nh = st.h * k;
        } else if (keepRatio && !ev.altKey && !corner) {
          // edge handles on locked-ratio items scale uniformly
          const k = sx !== 0 ? nw / st.w : nh / st.h;
          nw = st.w * k;
          nh = st.h * k;
        }
        nw = Math.max(minW, nw);
        nh = isLine ? st.h : Math.max(minH, nh);
        if (S().snap) { nw = Math.max(minW, Math.round(nw / S().grid) * S().grid); if (!keepRatio) nh = Math.max(minH, Math.round(nh / S().grid) * S().grid); }
        const dcx = (sx * (nw - st.w)) / 2, dcy = (sy * (nh - st.h)) / 2;
        const ncx = st.x + st.w / 2 + dcx * cos - dcy * sin;
        const ncy = st.y + st.h / 2 + dcx * sin + dcy * cos;
        it.w = Math.round(nw * 10) / 10;
        it.h = Math.round(nh * 10) / 10;
        it.x = Math.round((ncx - nw / 2) * 10) / 10;
        it.y = Math.round((ncy - nh / 2) * 10) / 10;
        NB.items.applyGeom(el, it);
        E.hooks.selection(true);
      },
      () => { ensureRoom(); E.commit(); }
    );
  }

  function startMarquee(e, pt) {
    const add = e.shiftKey;
    const base = add ? selected.slice() : [];
    if (!add) E.select([]);
    const box = h('div', { class: 'marquee' });
    let on = false;
    listen(
      (ev) => {
        const p = toPage(ev);
        if (!on && Math.hypot(p[0] - pt[0], p[1] - pt[1]) * scale < 4) return;
        if (!on) { on = true; layer.appendChild(box); }
        const x = Math.min(pt[0], p[0]), y = Math.min(pt[1], p[1]), w = Math.abs(p[0] - pt[0]), hh = Math.abs(p[1] - pt[1]);
        Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
        const ids = [];
        els.forEach((el, id) => {
          const r = el.getBoundingClientRect();
          const a = toPage({ clientX: r.left, clientY: r.top }), b = toPage({ clientX: r.right, clientY: r.bottom });
          if (a[0] < x + w && b[0] > x && a[1] < y + hh && b[1] > y) ids.push(id);
        });
        selected = Array.from(new Set([...base, ...ids]));
        paintSelection();
        E.hooks.selection();
      },
      () => box.remove()
    );
  }

  function startPlace(e, type, pt) {
    let dragged = false;
    listen(
      (ev) => { const p = toPage(ev); if (Math.abs(p[0] - pt[0]) > 20) dragged = true; },
      (ev) => {
        const p = toPage(ev);
        const it = NB.makeItem(type);
        if (type === 'text') {
          it.w = dragged ? Math.max(120, Math.abs(p[0] - pt[0])) : 300;
          it.x = dragged ? Math.min(pt[0], p[0]) : pt[0] - 8;
          it.y = pt[1] - 14;
        } else {
          it.x = pt[0] - it.w / 2;
          it.y = pt[1] - it.h / 2;
        }
        it.x = Math.round(clamp(snapV(it.x), 0, S().pageWidth - it.w));
        it.y = Math.round(Math.max(0, snapV(it.y)));
        NB.setTool('select');
        E.addItem(it, { edit: true });
      }
    );
  }

  function startShape(e, pt) {
    const kind = NB.shapeKind || 'rect';
    const isLine = kind === 'line' || kind === 'arrow';
    let it = null, el = null;
    listen(
      (ev) => {
        const p = toPage(ev);
        const dx = p[0] - pt[0], dy = p[1] - pt[1];
        if (!it && Math.hypot(dx, dy) * scale < 6) return;
        if (!it) {
          it = NB.makeItem('shape', { kind, fill: isLine ? '' : (NB.shapeFill || '') });
          if (kind === 'heart' || kind === 'star') it.fill = it.fill || '#ffd6e0';
          page.items.push(it);
          el = NB.items.build(it, api);
          els.set(it.id, el);
          layer.appendChild(el);
          reindex();
        }
        if (isLine) {
          const len = Math.max(20, Math.hypot(dx, dy));
          let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
          it.w = len; it.h = 30; it.rot = Math.round(ang * 10) / 10;
          it.x = pt[0] + dx / 2 - len / 2;
          it.y = pt[1] + dy / 2 - 15;
          if (ev.shiftKey) {
            const a = (ang * Math.PI) / 180;
            it.x = pt[0] + (Math.cos(a) * len) / 2 - len / 2;
            it.y = pt[1] + (Math.sin(a) * len) / 2 - 15;
          }
        } else {
          let w = Math.abs(dx), hh = Math.abs(dy);
          if (ev.shiftKey) w = hh = Math.max(w, hh);
          it.w = Math.max(10, w); it.h = Math.max(10, hh);
          it.x = dx < 0 ? pt[0] - it.w : pt[0];
          it.y = dy < 0 ? pt[1] - it.h : pt[1];
        }
        NB.items.applyGeom(el, it);
      },
      () => {
        NB.setTool('select');
        if (!it) {
          const base = isLine ? { w: 180, h: 30 } : { w: 170, h: 120 };
          it = NB.makeItem('shape', Object.assign({ kind, x: pt[0] - base.w / 2, y: pt[1] - base.h / 2, fill: kind === 'heart' || kind === 'star' ? '#ffd6e0' : '' }, base));
          E.addItem(it);
        } else {
          ensureRoom();
          E.select([it.id]);
          E.commit();
        }
      }
    );
  }

  /* ---------------- text editing ---------------- */
  E.startEdit = function (id, selectAll) {
    const it = byId(id), el = els.get(id), c = editableOf(id);
    if (!it || !c || it.locked) return;
    if (editing && editing !== id) E.stopEdit();
    editing = id;
    if (selected.length !== 1 || selected[0] !== id) { selected = [id]; E.hooks.selection(); }
    el.classList.add('editing');
    c.contentEditable = 'true';
    c.focus();
    const range = document.createRange();
    range.selectNodeContents(c);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
    try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* ignore */ }
    c.oninput = () => {
      if (it.type === 'shape') it.label = c.innerText;
      else it.html = c.innerHTML;
      page.updated = Date.now();
      NB.markDirty();
      clearTimeout(E._ed);
      E._ed = setTimeout(E.commit, 700);
    };
    c.onpaste = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const html = ev.clipboardData.getData('text/html');
      const text = ev.clipboardData.getData('text/plain');
      if (text === CLIP_MARK) return;
      if (html && it.type !== 'shape') document.execCommand('insertHTML', false, NB.sanitize(html));
      else document.execCommand('insertText', false, text);
    };
    paintSelection();
    E.hooks.selection();
  };

  E.stopEdit = function (silent) {
    if (!editing) return;
    const id = editing;
    editing = null;
    clearTimeout(E._ed);
    const it = byId(id), el = els.get(id), c = editableOf(id);
    if (c) {
      c.contentEditable = 'false';
      c.oninput = c.onpaste = null;
    }
    if (el) el.classList.remove('editing');
    getSelection().removeAllRanges();
    if (it && c) {
      if (it.type === 'shape') it.label = c.innerText.replace(/\n+$/, '');
      else {
        it.html = NB.sanitize(c.innerHTML);
        c.innerHTML = it.html;
      }
      const empty = it.type === 'text' && !NB.htmlToText(it.html).trim();
      if (empty && !silent) {
        selected = [id];
        E.deleteSelection();
        return;
      }
    }
    E.commit();
    if (!silent) { paintSelection(); E.hooks.selection(); }
  };

  E.captureRange = function () {
    if (!editing) return;
    const sel = getSelection(), c = editableOf(editing);
    if (sel.rangeCount && c && c.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  };

  function restoreRange() {
    if (!editing) return false;
    const c = editableOf(editing);
    if (!c) return false;
    c.focus();
    if (savedRange) {
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    return true;
  }

  /** Rich-text commands from the format bar. */
  E.format = function (cmd, val) {
    if (editing && restoreRange()) {
      const c = editableOf(editing);
      const it = byId(editing);
      try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* ignore */ }
      if (cmd === 'fontSize') {
        document.execCommand('fontSize', false, '7');
        c.querySelectorAll('font[size="7"], span[style*="-webkit-xxx-large"], span[style*="xxx-large"]').forEach((f) => {
          const span = document.createElement('span');
          span.style.fontSize = val + 'px';
          while (f.firstChild) span.appendChild(f.firstChild);
          f.replaceWith(span);
        });
        c.querySelectorAll('span').forEach((s) => { if (s.style.fontSize.includes('xxx-large')) s.style.fontSize = val + 'px'; });
      } else if (cmd === 'checklist') {
        document.execCommand('insertText', false, '☐ ');
      } else document.execCommand(cmd, false, val);
      if (it.type === 'shape') it.label = c.innerText; else it.html = c.innerHTML;
      savedRange = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : savedRange;
      NB.markDirty();
      clearTimeout(E._ed);
      E._ed = setTimeout(E.commit, 500);
      return true;
    }
    return false;
  };

  /** Whole-item text styling when not editing (or alongside). */
  E.setTextProp = function (prop, val) {
    const items = E.selection().filter((i) => ['text', 'sticky', 'shape', 'todo'].includes(i.type));
    if (!items.length) return false;
    items.forEach((it) => { it[prop] = val; E.refresh(it); });
    E.commit();
    return true;
  };

  /* ---------------- keyboard / clipboard ---------------- */
  function typing(e) {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  function onKey(e) {
    if (!page || !refs.book.offsetParent) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (editing) { E.stopEdit(); e.preventDefault(); return; }
      if (selected.length) { E.select([]); return; }
      if (NB.tool.name !== 'select') NB.setTool('select');
      return;
    }
    if (typing(e)) {
      if (mod && !editing) return; // let app-level shortcuts (undo within inputs stay native)
      return;
    }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); E.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); E.redo(); return; }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      E.select(page.items.map((i) => i.id));
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); E.duplicate(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (NB.tool.name === 'lasso' && ink.sel.size) { e.preventDefault(); ink.deleteSelection(); return; }
      if (selected.length) { e.preventDefault(); E.deleteSelection(); }
      return;
    }
    if (e.key === 'Enter' && selected.length === 1) {
      const it = byId(selected[0]);
      if (it && TEXTLIKE.has(it.type)) { e.preventDefault(); E.startEdit(it.id); }
      return;
    }
    if (e.key.startsWith('Arrow') && selected.length) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      E.selection().forEach((it) => { if (!it.locked) { it.x += dx; it.y += dy; NB.items.applyGeom(els.get(it.id), it); } });
      clearTimeout(E._nudge);
      E._nudge = setTimeout(E.commit, 400);
      return;
    }
    if (!mod && e.key === ']') E.zOrder('up');
    else if (!mod && e.key === '[') E.zOrder('down');
  }

  function onCopy(e) {
    if (!page || typing(e) || !selected.length) return;
    if (NB.tool.name === 'lasso') return;
    const sel = E.selection();
    NB.clip = NB.clone(sel);
    e.clipboardData.setData('text/plain', CLIP_MARK);
    e.preventDefault();
    if (e.type === 'cut') E.deleteSelection();
    else NB.toast('Copied');
  }

  async function onPaste(e) {
    if (!page || !refs.book.offsetParent) return;
    if (typing(e)) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []).filter((f) => f.type.startsWith('image/'));
    const text = cd.getData('text/plain');
    e.preventDefault();
    if (files.length) {
      for (const f of files) await E.addImageFile(f);
    } else if (text === CLIP_MARK && NB.clip) {
      pasteItems(NB.clip, true);
    } else if (text && text.trim()) {
      const pt = E.viewCenter();
      const it = NB.makeItem('text', { x: pt[0] - 150, y: pt[1] - 20 });
      it.html = NB.escapeHtml(text).replace(/\n/g, '<br>');
      E.addItem(it);
    }
  }

  E.clearSelectionIfDesk = () => { if (editing) E.stopEdit(); E.select([]); };
})();

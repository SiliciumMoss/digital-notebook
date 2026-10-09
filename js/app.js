/* Cozy Notebook – application shell: bookshelf, open-book spread, page turning, sections */
(function () {
  const NB = window.NB;
  const { h, $, $$, uid } = NB;
  const E = NB.E;
  const S = () => NB.state.settings;
  const UI = () => NB.state.ui;

  const app = (NB.app = {});

  /** the context of the page the user is working on (active side of the spread) */
  NB.ctxNow = function () {
    const nb = NB.currentNotebook(), sec = NB.currentSection();
    const page = NB.currentPage();
    return { nb, sec, isBoard: !!sec && page === sec.board, page };
  };

  function showView(name) {
    $('#shelf-view').classList.toggle('hidden', name !== 'shelf');
    $('#nb-view').classList.toggle('hidden', name !== 'notebook');
    UI().view = name;
  }

  app.showShelf = function () {
    NB.editors && NB.editors.forEach((e) => e.stopEdit(true));
    NB.saveNow();
    renderShelf();
    showView('shelf');
  };

  /** jump to a page by id ('board' = the section's pin-board) */
  app.goTo = function (nbId, secId, pageId) {
    UI().nb = nbId;
    UI().sec = secId;
    const sec = NB.currentSection();
    const idx = pageId === 'board' ? 0 : sec.pages.findIndex((p) => p.id === pageId) + 1;
    UI().spread = Math.floor(Math.max(0, idx) / 2);
    sec.last = UI().spread;
    app.openNotebook(nbId, true);
  };


  /* ====================================================================
   *  Bookshelf
   * ==================================================================== */
  const TEXTURES = [['leather', 'Leather'], ['linen', 'Linen'], ['plain', 'Matte'], ['dots', 'Polka'], ['stripes', 'Stripes'], ['floral', 'Floral']];
  const BINDERS = [['rings3', '3-ring binder'], ['rings6', '6-ring planner'], ['spiral', 'Spiral'], ['stitched', 'Stitched'], ['none', 'Plain book']];
  const COVERS = ['#8c5a3c', '#5f7f5b', '#3f7ea6', '#b5533c', '#7a5c9e', '#c0626f', '#2f3e46', '#d9a441', '#6b8e8e', '#444444'];

  function renderShelf() {
    const shelf = $('#shelf');
    shelf.innerHTML = '';
    const books = NB.state.notebooks.map((nb) => {
      const pages = nb.sections.reduce((n, s) => n + s.pages.length, 0);
      const cover = h('div', { class: `cover tex-${nb.texture} bind-${nb.binder}`, style: { '--cover': nb.cover } },
        h('div', { class: 'cover-bind' }),
        h('div', { class: 'cover-label' }, h('div', { class: 'cl-emoji' }, nb.emoji || '📓'), h('div', { class: 'cl-name' }, nb.name)),
        nb.texture === 'leather' ? h('div', { class: 'elastic' }) : null);
      const more = h('button', { class: 'book-more', title: 'More', onClick: (e) => { e.stopPropagation(); notebookMenu(nb, e.currentTarget); } }, '⋯');
      return h('div', { class: 'book-slot', tabindex: 0, onClick: () => app.openNotebook(nb.id), onKeydown: (e) => { if (e.key === 'Enter') app.openNotebook(nb.id); } },
        cover, more, h('div', { class: 'book-meta' }, h('b', null, nb.name), h('small', null, `${nb.sections.length} sections · ${pages} pages`)));
    });
    const add = h('button', { class: 'book-slot new', onClick: () => notebookDialog() }, h('div', { class: 'cover new-cover' }, h('span', null, '＋')), h('div', { class: 'book-meta' }, h('b', null, 'New notebook'), h('small', null, 'Pick a cover & binding')));
    // arrange on planks, 5 per row
    const per = Math.max(2, Math.floor((window.innerWidth - 80) / 230));
    const all = [...books, add];
    for (let i = 0; i < all.length; i += per) shelf.appendChild(h('div', { class: 'plank' }, all.slice(i, i + per)));
  }
  window.addEventListener('resize', NB.debounce(() => { if (UI().view === 'shelf') renderShelf(); }, 200));

  function notebookMenu(nb, anchor) {
    NB.menu([
      { icon: '📖', label: 'Open', fn: () => app.openNotebook(nb.id) },
      { icon: '🎨', label: 'Cover & binding…', fn: () => notebookDialog(nb) },
      { icon: '⧉', label: 'Duplicate', fn: () => duplicateNotebook(nb) },
      { icon: '📤', label: 'Export…', fn: () => app.exportNotebook(nb.id) },
      { sep: true },
      { icon: '🗑', label: 'Delete notebook', danger: true, fn: async () => { if (await NB.confirm(`Delete “${nb.name}” and everything in it?`)) { NB.state.notebooks = NB.state.notebooks.filter((n) => n !== nb); NB.markDirty(); renderShelf(); } } },
    ], anchor);
  }

  function duplicateNotebook(nb) {
    const copy = NB.clone(nb);
    copy.id = uid('n');
    copy.name += ' (copy)';
    copy.sections.forEach((s) => { s.id = uid('s'); s.board.id = uid('p'); s.pages.forEach((p) => (p.id = uid('p'))); s.last = null; });
    NB.state.notebooks.push(copy);
    NB.markDirty();
    renderShelf();
  }

  function notebookDialog(nb) {
    const isNew = !nb;
    const d = nb ? { ...nb } : { name: '', emoji: '📓', cover: COVERS[Math.floor(Math.random() * COVERS.length)], texture: 'leather', binder: 'rings3' };
    const name = h('input', { type: 'text', class: 'text-input', value: d.name, placeholder: 'e.g. Recipes, Uni 2026, Garden journal…' });
    const emoji = h('input', { type: 'text', class: 'text-input emoji-input', value: d.emoji, maxlength: 4 });
    const preview = h('div', { class: 'preview-wrap' });
    const paint = () => {
      d.name = name.value; d.emoji = emoji.value || '📓';
      preview.innerHTML = '';
      preview.append(h('div', { class: `cover tex-${d.texture} bind-${d.binder}`, style: { '--cover': d.cover } }, h('div', { class: 'cover-bind' }), h('div', { class: 'cover-label' }, h('div', { class: 'cl-emoji' }, d.emoji), h('div', { class: 'cl-name' }, d.name || 'Untitled')), d.texture === 'leather' ? h('div', { class: 'elastic' }) : null));
    };
    name.addEventListener('input', paint); emoji.addEventListener('input', paint);
    const chips = (list, key) => { const box = h('div', { class: 'chip-row' }); const draw = () => { box.innerHTML = ''; list.forEach(([k, l]) => box.appendChild(h('button', { class: 'chip' + (d[key] === k ? ' on' : ''), onClick: () => { d[key] = k; draw(); paint(); } }, l))); }; draw(); return box; };
    const colors = h('div', { class: 'swatch-row' });
    const drawColors = () => { colors.innerHTML = ''; COVERS.forEach((c) => colors.appendChild(h('button', { class: 'swatch' + (d.cover === c ? ' on' : ''), style: { background: c }, onClick: () => { d.cover = c; drawColors(); paint(); } }))); const cu = h('input', { type: 'color', class: 'color-custom', value: d.cover }); cu.addEventListener('input', () => { d.cover = cu.value; paint(); }); colors.appendChild(cu); };
    drawColors(); paint();
    const quick = h('div', { class: 'emoji-quick' }, '📓 📔 📒 📕 📗 📘 📙 🌿 ☕ 🍳 ✈️ 🎨 💼 🎓 💡 🏡 🐾 🎵 🌙 ❤️'.split(' ').map((g) => h('button', { class: 'emoji-opt small', onClick: () => { emoji.value = g; paint(); } }, g)));
    const body = h('div', { class: 'nb-dialog' }, h('div', { class: 'nbd-left' }, h('label', null, 'Name'), name, h('label', null, 'Cover emoji'), emoji, quick, h('label', null, 'Cover colour'), colors, h('label', null, 'Texture'), chips(TEXTURES, 'texture'), h('label', null, 'Binding'), chips(BINDERS, 'binder')), h('div', { class: 'nbd-right' }, preview));
    NB.modal({
      title: isNew ? 'New notebook' : 'Cover & binding', body, wide: true,
      buttons: [{ label: 'Cancel' }, { label: isNew ? 'Create notebook' : 'Save', primary: true, fn: () => {
        if (!d.name.trim()) d.name = 'Untitled notebook';
        if (isNew) {
          const n = NB.newNotebook(Object.assign({}, d));
          const sec = NB.newSection('Section 1', NB.SECTION_COLORS[0]);
          sec.pages.push(NB.newPage({ title: '' }));
          n.sections.push(sec);
          NB.state.notebooks.push(n);
          NB.markDirty();
          app.openNotebook(n.id);
        } else {
          Object.assign(nb, { name: d.name, emoji: d.emoji, cover: d.cover, texture: d.texture, binder: d.binder });
          NB.markDirty();
          if (UI().view === 'notebook') app.openNotebookView(); else renderShelf();
        }
      } }],
    });
  }


  /* ====================================================================
   *  The open notebook: two facing pages, a binding down the middle
   * ==================================================================== */
  const PAD = 22; // cover margin around the pages
  let L = null, R = null; // left / right page editors
  let book = null, spreadEl = null, flipLayer = null, tabsEl = null;
  const leafEl = {};
  let flipping = false;
  let scale = 1;
  let userZoomed = false;

  const dims = () => ({ W: S().pageWidth, H: S().pageHeight });
  const secLeaves = () => NB.leaves(NB.currentSection());
  const maxSpread = () => Math.floor((secLeaves().length - 1) / 2);
  const clampSpread = (k) => Math.max(0, Math.min(maxSpread(), k | 0));
  const editorFor = (side) => (side === 'left' ? L : R);

  function ensureEditors() {
    if (L) return;
    L = NB.makeEditor('left');
    R = NB.makeEditor('right');
    NB.editors = [L, R];
    NB.editor = R;
    NB.editors.forEach((ed) => { ed.init({ workspace: $('#workspace') }); wireEditor(ed); });
  }

  function wireEditor(ed) {
    ed.hooks.selection = (live) => {
      if (ed !== NB.editor || live) return;
      NB.inspector.render();
      NB.syncFormatBar();
    };
    ed.hooks.history = () => {
      if (ed === NB.editor) updateUndoButtons();
      if (!app._pp) app._pp = NB.debounce(renderPagesPanel, 700);
      app._pp();
    };
    ed.hooks.page = (what) => {
      if (what === 'title') { if (!app._pp) app._pp = NB.debounce(renderPagesPanel, 700); app._pp(); }
      if (what === 'restore' && ed === NB.editor) NB.inspector.render();
    };
  }

  function updateUndoButtons() {
    const ed = NB.editor;
    $('#btn-undo').disabled = !(ed && ed.canUndo());
    $('#btn-redo').disabled = !(ed && ed.canRedo());
  }

  /** Make one side of the spread the one the toolbar & inspector talk to. */
  function activate(ed) {
    if (NB.editor === ed || !ed.page()) return;
    const old = NB.editor;
    if (old && old.page()) {
      old.stopEdit(true);
      old.select([]);
      old.ink() && old.ink().clearSelection();
    }
    NB.editor = ed;
    NB.inspector.render();
    NB.syncFormatBar();
    updateUndoButtons();
    $$('.leaf').forEach((l) => l.classList.toggle('active', l === leafEl[ed.side]));
  }

  /* ---------------- opening / building ---------------- */
  app.openNotebook = function (id, keepSpread) {
    const nb = NB.findNotebook(id);
    if (!nb) return;
    const fromShelf = UI().view !== 'notebook';
    UI().nb = id;
    if (!nb.sections.length) {
      const s = NB.newSection('Section 1');
      s.pages.push(NB.newPage());
      nb.sections.push(s);
    }
    const sec = nb.sections.find((s) => s.id === UI().sec) || nb.sections[0];
    UI().sec = sec.id;
    ensureEditors();
    if (!keepSpread) UI().spread = clampSpread(typeof sec.last === 'number' ? sec.last : 0);
    else UI().spread = clampSpread(UI().spread);
    showView('notebook');
    $('#nb-title').value = nb.name;
    buildBook();
    if (fromShelf) playCover(true);
    NB.markDirty();
  };

  app.openNotebookView = () => { if (NB.currentNotebook()) buildBook(); };

  function buildBinding(nb) {
    const { W, H } = dims();
    const el = h('div', { class: 'binding bind-' + (S().showRings ? nb.binder : 'none') });
    if (!S().showRings) return el;
    const hole = (x, y) => h('div', { class: 'hole', style: { left: x - 9 + 'px', top: y - 9 + 'px' } });
    if (nb.binder === 'rings3' || nb.binder === 'rings6') {
      const n = nb.binder === 'rings3' ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const y = n === 3 ? H * (0.17 + 0.33 * i) : (H * (i + 0.5)) / n;
        el.append(hole(W - 24, y), hole(W + 24, y), h('div', { class: 'ring', style: { left: W - 42 + 'px', top: y - 17 + 'px' } }));
      }
    } else if (nb.binder === 'spiral') {
      const n = Math.floor((H - 24) / 27);
      for (let i = 0; i < n; i++) {
        const y = 22 + i * 27;
        el.append(hole(W - 20, y), hole(W + 20, y), h('div', { class: 'coil', style: { left: W - 36 + 'px', top: y - 6 + 'px' } }));
      }
    } else if (nb.binder === 'stitched') {
      el.append(h('div', { class: 'stitch', style: { left: W - 14 + 'px' } }), h('div', { class: 'stitch', style: { left: W + 12 + 'px' } }));
    }
    return el;
  }

  function buildBook() {
    const nb = NB.currentNotebook();
    const { W, H } = dims();
    book = $('#book');
    book.innerHTML = '';
    book.className = 'book';
    book.style.setProperty('--cover', nb.cover);
    book.style.width = 2 * W + 2 * PAD + 'px';
    book.style.height = H + 2 * PAD + 'px';

    const board = h('div', { class: 'book-board tex-' + nb.texture, style: { left: -PAD + 'px', top: -PAD + 'px', width: 2 * W + 2 * PAD + 'px', height: H + 2 * PAD + 'px' } });
    leafEl.left = h('div', { class: 'leaf left', style: { left: 0, width: W + 'px', height: H + 'px' } });
    leafEl.right = h('div', { class: 'leaf right', style: { left: W + 'px', width: W + 'px', height: H + 'px' } });
    leafEl.left.addEventListener('pointerdown', () => activate(L), true);
    leafEl.right.addEventListener('pointerdown', () => activate(R), true);
    flipLayer = h('div', { class: 'flip-layer' });
    tabsEl = h('div', { class: 'tabs', style: { left: 2 * W - 4 + 'px' } });
    const corner = (side) => h('button', { class: 'turn turn-' + side, title: side === 'left' ? 'Previous pages' : 'Next pages', 'aria-label': side === 'left' ? 'Previous pages' : 'Next pages' }, h('span', { class: 'curl' }));
    const tl = corner('left'), tr = corner('right');
    tl.addEventListener('pointerdown', (e) => startTurnDrag(e, -1));
    tr.addEventListener('pointerdown', (e) => startTurnDrag(e, 1));
    spreadEl = h('div', { class: 'spread', style: { width: 2 * W + 'px', height: H + 'px', left: PAD + 'px', top: PAD + 'px' } },
      board, leafEl.left, leafEl.right, h('div', { class: 'crease' }), buildBinding(nb), tabsEl, tl, tr, flipLayer);
    book.appendChild(spreadEl);
    mountSpread();
    layoutBook();
    if (!userZoomed) app.fit();
  }

  /* ---------------- leaves ---------------- */
  function pageCtx(pg, idx) {
    const sec = NB.currentSection();
    return { sec, nb: NB.currentNotebook(), isBoard: idx === 0, num: idx };
  }

  function ghost(idx, live) {
    const el = h('div', { class: 'ghost-page' + (live ? '' : ' static'), style: { width: S().pageWidth + 'px', height: S().pageHeight + 'px' } });
    if (live) {
      el.append(
        h('div', { class: 'ghost-inner' },
          h('button', { class: 'ghost-add', onClick: () => addPage(null, idx) }, h('b', null, '＋'), h('span', null, 'Add a page')),
          h('button', { class: 'btn', onClick: () => templateDialog(idx) }, '🗒 From template…'))
      );
    }
    el.append(h('div', { class: 'page-num' }, idx));
    return el;
  }

  /** Non-interactive rendering of a page – used on the faces of a turning leaf. */
  function staticPage(pg, idx) {
    const { W, H } = dims();
    if (!pg) return ghost(idx, false);
    const sec = NB.currentSection();
    const el = h('div', { class: 'page paper-' + pg.paper + (NB.luminance(pg.color) < 0.4 ? ' dark-paper' : ''), style: { '--paper': pg.color, width: W + 'px', height: H + 'px' } });
    const head = h('div', { class: 'page-head' });
    if (idx === 0) head.append(h('div', { class: 'board-title' }, '📌 ' + sec.name + ' — board'));
    else {
      head.append(h('div', { class: 'page-title static' }, pg.title || ''));
      if (S().showDate) head.append(h('div', { class: 'page-date' }, NB.formatDate(pg.created)));
    }
    const layer = h('div', { class: 'items-layer' });
    const noop = { changed() {}, commit() {} };
    pg.items.forEach((it) => layer.appendChild(NB.items.build(it, noop)));
    layer.childNodes.forEach((n, i) => (n.style.zIndex = i + 1));
    const canvas = h('canvas', { class: 'ink-canvas' });
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'ink-overlay');
    el.append(head, layer, canvas, overlay);
    new NB.Ink({ canvas, overlay, page: () => pg, scale: () => 1, scroller: () => document.body, isDark: () => NB.luminance(pg.color) < 0.4, onChange() {}, onExtend() {} });
    if (idx > 0) el.append(h('div', { class: 'page-num' }, idx));
    return el;
  }

  function mountLeaf(side, idx) {
    const ed = editorFor(side), slot = leafEl[side];
    slot.innerHTML = '';
    const pg = secLeaves()[idx];
    if (!pg) {
      ed.clear();
      slot.append(ghost(idx, true));
      return;
    }
    const el = ed.open(pg, pageCtx(pg, idx));
    el.append(h('div', { class: 'page-num' }, idx > 0 ? idx : ''));
    slot.append(el);
    ed.setScale(scale);
  }

  function mountSpread() {
    const k = UI().spread;
    const N = secLeaves().length;
    mountLeaf('left', 2 * k);
    mountLeaf('right', 2 * k + 1);
    const thick = (n) => Math.min(12, Math.round(n * 1.4));
    spreadEl.style.setProperty('--sl', thick(2 * k) + 'px');
    spreadEl.style.setProperty('--sr', thick(N - (2 * k + 2)) + 'px');
    const act = R.page() ? R : L;
    NB.editor = act;
    $$('.leaf').forEach((l) => l.classList.toggle('active', l === leafEl[act.side]));
    renderTabs();
    updatePager();
    renderPagesPanel();
    NB.inspector.render();
    NB.syncFormatBar();
    updateUndoButtons();
    NB.currentSection().last = k;
    NB.state.ui.spread = k;
  }

  function updatePager() {
    const k = UI().spread, N = secLeaves().length;
    const name = (i) => (i === 0 ? 'Board' : i < N ? String(i) : '–');
    $('#pager-label').textContent = `${name(2 * k)}  ·  ${2 * k + 1 < N ? name(2 * k + 1) : '–'}`;
    $('#pg-first').disabled = $('#pg-prev').disabled = k === 0;
    $('#pg-last').disabled = k >= maxSpread();
    $$('.turn-left').forEach((b) => b.classList.toggle('off', k === 0));
  }

  /* ---------------- section tabs ---------------- */
  function renderTabs() {
    const nb = NB.currentNotebook(), cur = NB.currentSection();
    const { H } = dims();
    tabsEl.innerHTML = '';
    const tabH = Math.max(30, Math.min(46, Math.floor((H - 90) / (nb.sections.length + 1)) - 6));
    nb.sections.forEach((sec) => {
      tabsEl.appendChild(h('button', {
        class: 'tab' + (sec === cur ? ' on' : ''), style: { '--tab': sec.color, height: tabH + 'px' }, title: sec.name + ' – right-click for options',
        onClick: () => app.openSection(sec.id),
        onContextmenu: (e) => { e.preventDefault(); sectionMenu(sec, { x: e.clientX, y: e.clientY }); },
        onDblclick: () => renameSection(sec),
      }, h('span', { class: 'tab-name' }, sec.name)));
    });
    tabsEl.appendChild(h('button', { class: 'tab add', title: 'New section', onClick: addSection }, '＋'));
  }

  app.openSection = function (secId) {
    if (flipping) return;
    const nb = NB.currentNotebook();
    const sec = nb.sections.find((s) => s.id === secId);
    if (!sec || sec.id === UI().sec) return;
    NB.editors.forEach((e) => e.stopEdit(true));
    UI().sec = secId;
    UI().spread = clampSpread(typeof sec.last === 'number' ? sec.last : 0);
    mountSpread();
    spreadEl.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220 });
    NB.markDirty();
  };

  async function addSection() {
    const nb = NB.currentNotebook();
    const name = await NB.ask('New section name', '', 'e.g. Recipes');
    if (!name) return;
    const sec = NB.newSection(name, NB.SECTION_COLORS[nb.sections.length % NB.SECTION_COLORS.length]);
    sec.pages.push(NB.newPage());
    nb.sections.push(sec);
    sec.last = 0;
    UI().sec = sec.id;
    UI().spread = 0;
    mountSpread();
    NB.markDirty();
    NB.toast('Section created – its left page is a pin-board for sticky notes');
  }

  async function renameSection(sec) {
    const name = await NB.ask('Rename section', sec.name);
    if (!name) return;
    sec.name = name;
    NB.markDirty();
    mountSpread();
  }

  function sectionMenu(sec, where) {
    const nb = NB.currentNotebook();
    const idx = nb.sections.indexOf(sec);
    NB.menu([
      { icon: '✏️', label: 'Rename…', fn: () => renameSection(sec) },
      { icon: '🎨', label: 'Tab colour…', fn: () => NB.colorPicker(document.body, sec.color, (c) => { sec.color = c; NB.markDirty(); renderTabs(); renderPagesPanel(); }, { colors: NB.SECTION_COLORS }) },
      { icon: '⬆', label: 'Move up', disabled: idx === 0, fn: () => { nb.sections.splice(idx, 1); nb.sections.splice(idx - 1, 0, sec); NB.markDirty(); renderTabs(); } },
      { icon: '⬇', label: 'Move down', disabled: idx === nb.sections.length - 1, fn: () => { nb.sections.splice(idx, 1); nb.sections.splice(idx + 1, 0, sec); NB.markDirty(); renderTabs(); } },
      { sep: true },
      { icon: '🗑', label: 'Delete section', danger: true, disabled: nb.sections.length < 2, fn: async () => {
        if (!(await NB.confirm(`Delete section “${sec.name}” with ${sec.pages.length} pages?`))) return;
        nb.sections = nb.sections.filter((s) => s !== sec);
        if (UI().sec === sec.id) { UI().sec = nb.sections[0].id; UI().spread = clampSpread(nb.sections[0].last || 0); }
        mountSpread();
        NB.markDirty();
      } },
    ], where);
  }

  /* ====================================================================
   *  Page turning
   * ==================================================================== */
  const EASE = 'cubic-bezier(.5,.05,.2,1)';

  /** Start turning towards `dir` (+1 forward / -1 back). Returns a controller or null. */
  function beginTurn(dir) {
    if (flipping) return null;
    const sec = NB.currentSection();
    const cur = UI().spread;
    const target = cur + dir;
    if (target < 0) return null;
    const { W, H } = dims();
    const leaves = NB.leaves(sec);
    let pending = null;
    if (target > maxSpread()) { // turning past the last page: a fresh blank page is waiting
      pending = NB.newPage();
      leaves.push(pending);
    }
    NB.editors.forEach((e) => e.stopEdit(true));
    flipping = true;
    const frontIdx = dir > 0 ? 2 * cur + 1 : 2 * cur;
    const backIdx = dir > 0 ? 2 * target : 2 * target + 1;
    const shade = () => h('div', { class: 'shade' });
    const front = h('div', { class: 'face front' }, staticPage(leaves[frontIdx], frontIdx), shade());
    const back = h('div', { class: 'face back' }, staticPage(leaves[backIdx], backIdx), shade());
    const flipper = h('div', { class: 'flipper ' + (dir > 0 ? 'fwd' : 'bwd'), style: { left: (dir > 0 ? W : 0) + 'px', width: W + 'px', height: H + 'px' } }, front, back);
    flipLayer.appendChild(flipper);
    // reveal the page that will be underneath once the leaf has turned
    if (dir > 0) { if (pending) sec.pages.push(pending); mountLeaf('right', 2 * target + 1); }
    else mountLeaf('left', 2 * target);
    const sign = dir > 0 ? -1 : 1;
    const setProgress = (p) => {
      flipper.style.transform = `rotateY(${sign * 180 * p}deg)`;
      front.lastChild.style.opacity = String(Math.min(0.55, p * 1.1));
      back.lastChild.style.opacity = String(Math.min(0.55, (1 - p) * 1.1));
    };
    setProgress(0);
    return {
      progress: 0,
      set(p) { this.progress = Math.max(0, Math.min(1, p)); setProgress(this.progress); },
      async animateTo(to) {
        const from = this.progress;
        const dur = Math.max(160, 760 * Math.abs(to - from));
        const frames = [0, 0.25, 0.5, 0.75, 1].map((t) => { const p = from + (to - from) * t; return { transform: `rotateY(${sign * 180 * p}deg)` }; });
        flipper.style.transform = '';
        const anim = flipper.animate(frames, { duration: dur, easing: EASE, fill: 'forwards' });
        const fa = front.lastChild.animate([{ opacity: Math.min(0.55, from * 1.1) }, { opacity: Math.min(0.55, to * 1.1) }], { duration: dur, easing: EASE, fill: 'forwards' });
        const ba = back.lastChild.animate([{ opacity: Math.min(0.55, (1 - from) * 1.1) }, { opacity: Math.min(0.55, (1 - to) * 1.1) }], { duration: dur, easing: EASE, fill: 'forwards' });
        await anim.finished.catch(() => {});
        void fa; void ba;
        this.progress = to;
      },
      finish() {
        UI().spread = target;
        if (dir > 0) mountLeaf('left', 2 * target); else mountLeaf('right', 2 * target + 1);
        flipper.remove();
        flipping = false;
        mountSpread();
        NB.markDirty();
      },
      cancel() {
        if (pending) sec.pages = sec.pages.filter((p) => p !== pending);
        if (dir > 0) mountLeaf('right', 2 * cur + 1); else mountLeaf('left', 2 * cur);
        flipper.remove();
        flipping = false;
        mountSpread();
      },
    };
  }

  app.turn = async function (dir) {
    const t = beginTurn(dir);
    if (!t) return;
    await t.animateTo(1);
    t.finish();
  };

  app.turnTo = async function (k) {
    k = clampSpread(k);
    let cur = UI().spread;
    if (flipping || k === cur) return;
    if (Math.abs(k - cur) === 1) return app.turn(k > cur ? 1 : -1);
    // jumping several spreads: swap quickly with a single page flip in the right direction
    const dir = k > cur ? 1 : -1;
    UI().spread = k - dir;          // pretend we are one spread away so the flip lands on k
    mountSpread();
    await app.turn(dir);
  };

  function startTurnDrag(e, dir) {
    if (flipping || e.button > 0) return;
    if (dir < 0 && UI().spread === 0) return;
    e.preventDefault();
    const { W } = dims();
    const startX = e.clientX;
    let t = null, moved = false;
    const px = () => W * scale * 0.9;
    const mv = (ev) => {
      const d = (dir > 0 ? startX - ev.clientX : ev.clientX - startX) / px();
      if (!t && Math.abs(ev.clientX - startX) > 6) { t = beginTurn(dir); moved = true; }
      if (t) t.set(d);
    };
    const up = async () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      if (!t) { await app.turn(dir); return; }
      if (t.progress > 0.3) { await t.animateTo(1); t.finish(); } else { await t.animateTo(0); t.cancel(); }
      void moved;
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }

  /* ====================================================================
   *  Cover: opening and closing the notebook
   * ==================================================================== */
  app.coverEl = function (nb) {
    return h('div', { class: `cover tex-${nb.texture} bind-${nb.binder}`, style: { '--cover': nb.cover } },
      h('div', { class: 'cover-bind' }),
      h('div', { class: 'cover-label' }, h('div', { class: 'cl-emoji' }, nb.emoji || '📓'), h('div', { class: 'cl-name' }, nb.name)),
      nb.texture === 'leather' ? h('div', { class: 'elastic' }) : null);
  };

  function playCover(opening) {
    const nb = NB.currentNotebook();
    const { W, H } = dims();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { if (!opening) app.showShelf(); return Promise.resolve(); }
    flipping = true;
    const cov = app.coverEl(nb);
    cov.style.transformOrigin = '0 0';
    cov.style.transform = `scale(${W / 200}, ${H / 270})`;
    const front = h('div', { class: 'face front' }, cov);
    const back = h('div', { class: 'face back endpaper' }, h('div', { class: 'endpaper-label' }, nb.emoji || '📓'));
    const flipper = h('div', { class: 'flipper fwd cover-flip', style: { left: W + 'px', width: W + 'px', height: H + 'px' } }, front, back);
    flipLayer.appendChild(flipper);
    const dur = 1000;
    const fwd = opening ? 'normal' : 'reverse';
    const opts = { duration: dur, easing: EASE, fill: 'both', direction: fwd };
    const a = flipper.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], opts);
    spreadEl.animate([{ transform: `translateX(${-W / 2}px)` }, { transform: 'translateX(0)' }], opts);
    const fade = { duration: dur * 0.5, easing: 'ease-out', fill: 'both', delay: opening ? dur * 0.5 : 0, direction: fwd };
    [leafEl.left, spreadEl.querySelector('.binding'), tabsEl, spreadEl.querySelector('.crease')].forEach((n) => n && n.animate([{ opacity: 0 }, { opacity: 1 }], opening ? fade : { ...fade, delay: 0, duration: dur * 0.5 }));
    spreadEl.querySelector('.book-board').animate([{ clipPath: 'inset(0 0 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], opts);
    return a.finished.catch(() => {}).then(() => {
      flipper.remove();
      flipping = false;
      if (!opening) app.showShelf();
    });
  }

  app.closeBook = function () {
    if (flipping) return;
    NB.editors.forEach((e) => e.stopEdit(true));
    playCover(false);
  };

  /* ====================================================================
   *  Pages: add / delete / templates / list
   * ==================================================================== */
  /** the leaf index (0 = board) of whatever the user is working on */
  function activeLeaf() {
    const k = UI().spread;
    return NB.editor === L ? 2 * k : 2 * k + 1;
  }

  function addPage(tpl, atLeaf) {
    const sec = NB.currentSection();
    const opts = {};
    if (tpl && tpl.paper) opts.paper = tpl.paper;
    if (tpl && tpl.title) opts.title = tpl.title;
    const pg = NB.newPage(opts);
    if (tpl) pg.items = tpl.build();
    const leaf = atLeaf != null ? atLeaf : Math.min(secLeaves().length, activeLeaf() + 1);
    sec.pages.splice(Math.max(0, leaf - 1), 0, pg);
    UI().spread = clampSpread(Math.floor(leaf / 2));
    mountSpread();
    activate(leaf % 2 === 0 ? L : R);
    NB.markDirty();
    return pg;
  }
  app.addPage = addPage;

  function templateDialog(atLeaf) {
    const grid = h('div', { class: 'tpl-grid' });
    let m;
    NB.TEMPLATES.forEach((t) => grid.appendChild(h('button', { class: 'tpl', onClick: () => { m.close(); addPage(t, atLeaf); } }, h('div', { class: 'tpl-icon' }, t.icon), h('b', null, t.name))));
    m = NB.modal({ title: 'New page from template', body: grid, wide: true });
  }

  function currentPageObj() { return NB.editor && NB.editor.page(); }

  app.duplicatePage = function () {
    const sec = NB.currentSection(), pg = currentPageObj();
    if (!pg || pg === sec.board) return NB.toast('The section board can’t be duplicated');
    const c = NB.clone(pg);
    c.id = uid('p');
    c.title = (pg.title || 'Untitled') + ' (copy)';
    c.items.forEach((i) => (i.id = uid('i')));
    c.created = Date.now();
    const at = sec.pages.indexOf(pg) + 1;
    sec.pages.splice(at, 0, c);
    UI().spread = clampSpread(Math.floor((at + 1) / 2));
    mountSpread();
    NB.markDirty();
  };

  app.deleteCurrentPage = async function () {
    const sec = NB.currentSection(), pg = currentPageObj();
    if (!pg || pg === sec.board) return NB.toast('The section board stays – clear it by deleting its notes');
    deletePage(pg);
  };

  async function deletePage(pg) {
    const sec = NB.currentSection();
    if (!(await NB.confirm(`Tear out page “${pg.title || 'Untitled'}”?`, 'Tear out'))) return;
    sec.pages = sec.pages.filter((p) => p !== pg);
    UI().spread = clampSpread(UI().spread);
    mountSpread();
    NB.markDirty();
  }

  function renderPagesPanel() {
    const sec = NB.currentSection();
    if (!sec) return;
    const p = $('#pages-panel');
    p.innerHTML = '';
    p.style.setProperty('--sec', sec.color);
    const k = UI().spread;
    const leaves = NB.leaves(sec);
    p.append(
      h('div', { class: 'pp-head' }, h('span', { class: 'pp-dot' }), h('b', { class: 'pp-title', title: 'Double-click to rename', onDblclick: () => renameSection(sec) }, sec.name), h('button', { class: 'icon-btn small', title: 'Section options', onClick: (e) => sectionMenu(sec, e.currentTarget) }, '⋯'))
    );
    const list = h('div', { class: 'page-list' });
    leaves.forEach((pg, idx) => {
      const board = idx === 0;
      const on = Math.floor(idx / 2) === k;
      const row = h('div', { class: 'page-row' + (on ? ' on' : '') + (board ? ' board' : ''), draggable: board ? null : 'true', onClick: () => app.turnTo(Math.floor(idx / 2)), onContextmenu: (e) => { e.preventDefault(); if (!board) pageMenu(pg, { x: e.clientX, y: e.clientY }); } },
        h('span', { class: 'pr-num' }, board ? '📌' : idx),
        h('div', { class: 'pr-main' }, h('b', null, board ? 'Section board' : pg.title || 'Untitled page'), h('small', null, board ? (pg.items.length ? pg.items.length + ' notes pinned' : 'Pin notes for this section') : preview(pg))),
        board ? null : h('button', { class: 'pr-more', title: 'Page options', onClick: (e) => { e.stopPropagation(); pageMenu(pg, e.currentTarget); } }, '⋯'));
      if (!board) {
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-cozy-page', String(idx)); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
      }
      row.addEventListener('dragover', (e) => { if (!board && e.dataTransfer.types.includes('text/x-cozy-page')) { e.preventDefault(); row.classList.add('over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('over');
        const from = parseInt(e.dataTransfer.getData('text/x-cozy-page'), 10);
        if (isNaN(from) || from === idx || board) return;
        const [m] = sec.pages.splice(from - 1, 1);
        sec.pages.splice(idx - 1, 0, m);
        NB.markDirty();
        mountSpread();
      });
      list.appendChild(row);
    });
    p.append(list);
    p.append(h('div', { class: 'pp-foot' }, h('button', { class: 'btn primary wide', onClick: () => addPage() }, '＋ New page'), h('button', { class: 'btn wide', onClick: () => templateDialog() }, '🗒 From template…')));
  }
  app.renderPagesPanel = renderPagesPanel;

  function preview(pg) {
    const t = pg.items.map((i) => NB.htmlToText(i.html || '') || i.label || i.title || '').find((x) => x && x.trim());
    const bits = [];
    if (t) bits.push(t.trim().slice(0, 40));
    if (pg.strokes.length) bits.push('✎');
    if (pg.items.some((i) => i.type === 'image')) bits.push('🖼');
    return bits.join(' ') || 'Empty page';
  }

  function pageMenu(pg, where) {
    const nb = NB.currentNotebook(), sec = NB.currentSection();
    const others = nb.sections.filter((s) => s !== sec);
    NB.menu([
      { icon: '✏️', label: 'Rename', fn: async () => { const n = await NB.ask('Page title', pg.title); if (n != null) { pg.title = n; NB.markDirty(); mountSpread(); } } },
      { icon: '⧉', label: 'Duplicate', fn: () => { const idx = sec.pages.indexOf(pg); UI().spread = clampSpread(Math.floor((idx + 1) / 2)); mountSpread(); activate(((idx + 1) % 2 === 0) ? L : R); app.duplicatePage(); } },
      ...others.map((s) => ({ icon: '➡', label: 'Move to “' + s.name + '”', fn: () => { sec.pages = sec.pages.filter((p) => p !== pg); s.pages.push(pg); UI().spread = clampSpread(UI().spread); mountSpread(); NB.markDirty(); NB.toast('Moved to ' + s.name); } })),
      { sep: true },
      { icon: '🗑', label: 'Tear out page', danger: true, fn: () => deletePage(pg) },
    ], where);
  }

  /* ---------------- zoom ---------------- */
  function layoutBook() {
    const { W, H } = dims();
    $('#sizer').style.width = (2 * W + 2 * PAD + 120) * scale + 'px';
    $('#sizer').style.height = (H + 2 * PAD + 20) * scale + 'px';
    book.style.transform = `scale(${scale})`;
    book.style.setProperty('--inv', String(1 / scale));
  }

  function setZoom(s, manual) {
    scale = Math.max(0.25, Math.min(2.5, s));
    if (manual) userZoomed = true;
    if (book) layoutBook();
    NB.editors && NB.editors.forEach((e) => e.page() && e.setScale(scale));
    $('#zoom-label').textContent = Math.round(scale * 100) + '%';
  }

  app.fit = function () {
    userZoomed = false;
    const ws = $('#workspace');
    const { W, H } = dims();
    const sw = (ws.clientWidth - 30) / (2 * W + 2 * PAD + 120);
    const sh = (ws.clientHeight - 30) / (H + 2 * PAD + 20);
    setZoom(Math.min(sw, sh, 1.6));
  };

  app.relayout = function () {
    // page size changed in settings
    S().pageHeight = Math.round(S().pageWidth * 1.357);
    NB.markDirty();
    buildBook();
  };

  app.reopenPage = () => mountSpread();

  /* ---------------- print / export / import ---------------- */
  app.printPage = async function () {
    NB.editors.forEach((e) => { e.stopEdit(true); e.select([]); });
    document.body.classList.add('printing');
    await new Promise((r) => setTimeout(r, 150));
    try {
      if (window.native) {
        const title = (NB.currentNotebook().name + ' ' + NB.currentSection().name).replace(/[^\w\- ]+/g, '');
        const f = await window.native.printPdf(title + '.pdf');
        if (f) NB.toast('Saved ' + f);
      } else window.print();
    } finally {
      document.body.classList.remove('printing');
    }
  };

  app.exportNotebook = async function (id) {
    const data = NB.exportData(id ? [id] : null);
    const name = id ? NB.findNotebook(id).name.replace(/[^\w\- ]+/g, '') : 'all-notebooks';
    const f = await NB.saveText(name + '.cozynotebook.json', data, 'json', 'Cozy Notebook backup');
    if (f) NB.toast('Backup saved');
  };

  app.importFile = async function () {
    try {
      const text = await NB.openText('json', 'Cozy Notebook backup');
      if (!text) return;
      const n = await NB.importData(text);
      NB.toast(`Imported ${n} notebook${n === 1 ? '' : 's'}`);
      if (UI().view === 'shelf') renderShelf(); else app.showShelf();
    } catch (e) {
      console.error(e);
      NB.toast('Import failed: ' + e.message, 4000);
    }
  };

  /* ====================================================================
   *  Wiring
   * ==================================================================== */
  function editorAt(e) {
    for (const ed of [L, R]) {
      if (ed && ed.pageEl() && ed.pageEl().contains(e.target)) return ed;
    }
    const x = e.clientX;
    const r = leafEl.left.getBoundingClientRect();
    return x < r.right ? L : R;
  }

  function wire() {
    $('#btn-shelf').addEventListener('click', () => app.closeBook());
    $('#btn-pages-toggle').addEventListener('click', () => { $('#main').classList.toggle('show-pages'); NB.debounce(() => !userZoomed && app.fit(), 60)(); });
    $('#btn-inspector').addEventListener('click', () => { S().inspectorOpen = !S().inspectorOpen; applyPanels(); NB.markDirty(); });
    $('#nb-title').addEventListener('input', (e) => { NB.currentNotebook().name = e.target.value; NB.markDirty(); });
    $('#btn-undo').addEventListener('click', () => NB.editor && NB.editor.undo());
    $('#btn-redo').addEventListener('click', () => NB.editor && NB.editor.redo());
    $('#zoom-in').addEventListener('click', () => setZoom(scale * 1.15, true));
    $('#zoom-out').addEventListener('click', () => setZoom(scale / 1.15, true));
    $('#zoom-label').addEventListener('click', app.fit);
    $('#pg-first').addEventListener('click', () => app.turnTo(0));
    $('#pg-prev').addEventListener('click', () => app.turn(-1));
    $('#pg-next').addEventListener('click', () => app.turn(1));
    $('#pg-last').addEventListener('click', () => app.turnTo(maxSpread()));
    $('#btn-search').addEventListener('click', NB.openSearch);
    $('#btn-export').addEventListener('click', (e) => NB.exportMenu(e.currentTarget));
    $('#btn-settings').addEventListener('click', NB.openSettings);
    $('#shelf-search').addEventListener('click', NB.openSearch);
    $('#shelf-import').addEventListener('click', app.importFile);
    $('#shelf-settings').addEventListener('click', NB.openSettings);

    const ws = $('#workspace');
    ws.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08), true);
    }, { passive: false });
    ws.addEventListener('pointerdown', (e) => {
      if (e.target === ws || e.target.id === 'stage' || e.target.id === 'sizer' || e.target.id === 'book') NB.editors.forEach((ed) => ed.page() && ed.clearSelectionIfDesk());
    });
    ws.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    ws.addEventListener('drop', async (e) => {
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const ed = editorAt(e);
      if (!ed || !ed.page()) return;
      activate(ed);
      const r = ed.pageEl().getBoundingClientRect(), k = ed.pageEl().offsetWidth / r.width;
      let i = 0;
      for (const f of files) await ed.addImageFile(f, [(e.clientX - r.left) * k + i * 24, (e.clientY - r.top) * k + i * 24]), i++;
    });
    window.addEventListener('resize', NB.debounce(() => { if (UI().view === 'notebook' && !userZoomed) app.fit(); }, 150));
    window.addEventListener('beforeunload', () => { NB.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) NB.saveNow(); });
    NB.onInkSelection = () => {};
    document.addEventListener('keydown', onGlobalKey);
    window.addEventListener('contextmenu', (e) => { if (e.target.closest('.ink-canvas')) e.preventDefault(); });
  }

  function onGlobalKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    const typing = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); NB.openSearch(); return; }
    if (UI().view !== 'notebook') return;
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); app.printPage(); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(scale * 1.15, true); return; }
    if (mod && e.key === '-') { e.preventDefault(); setZoom(scale / 1.15, true); return; }
    if (mod && e.key === '0') { e.preventDefault(); app.fit(); return; }
    if (typing || document.querySelector('.modal-back')) return;
    if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) { e.preventDefault(); app.turn(1); return; }
    if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) { e.preventDefault(); app.turn(-1); return; }
    if (mod || e.altKey) return;
    const map = { v: 'select', t: 'text', n: 'sticky', p: 'pen', y: 'pencil', h: 'hl', e: 'eraser', l: 'lasso' };
    const k = e.key.toLowerCase();
    if (map[k]) { NB.setTool(map[k]); return; }
    if (k === 's') { toolbarClick('shape'); return; }
    if (k === 'i') { toolbarClick('image'); return; }
    if (e.key === '?') NB.showShortcuts();
  }
  function toolbarClick(id) { const b = $(`#toolbar .tool[data-tool="${id}"]`); b && b.click(); }

  function applyPanels() {
    $('#main').classList.toggle('no-inspector', !S().inspectorOpen);
    if (UI().view === 'notebook' && !userZoomed) setTimeout(app.fit, 30);
  }

  /* ====================================================================
   *  Boot
   * ==================================================================== */
  async function boot() {
    await NB.load();
    NB.applyTheme();
    NB.ui.buildToolbar();
    NB.ui.buildFormatBar();
    wire();
    $('#main').classList.toggle('no-inspector', !S().inspectorOpen);
    NB.setStatus('saved');
    renderShelf();
    showView('shelf');
    document.documentElement.classList.add('ready');
  }

  document.addEventListener('DOMContentLoaded', () => boot().catch((e) => { console.error(e); document.body.prepend(h('pre', { style: { color: 'red', padding: '20px' } }, 'Failed to start: ' + e.stack)); }));
})();

/* Cozy Notebook – application shell: bookshelf, notebook view, sections, pages */
(function () {
  const NB = window.NB;
  const { h, $, $$, uid } = NB;
  const E = NB.editor;
  const S = () => NB.state.settings;
  const UI = () => NB.state.ui;

  const app = (NB.app = {});

  NB.ctxNow = function () {
    const nb = NB.currentNotebook(), sec = NB.currentSection();
    return { nb, sec, isBoard: UI().page === 'board', page: NB.currentPage() };
  };

  /* ====================================================================
   *  Views
   * ==================================================================== */
  function showView(name) {
    $('#shelf-view').classList.toggle('hidden', name !== 'shelf');
    $('#nb-view').classList.toggle('hidden', name !== 'notebook');
    UI().view = name;
  }

  app.showShelf = function () {
    E.stopEdit(true);
    NB.saveNow();
    renderShelf();
    showView('shelf');
  };

  app.goTo = function (nbId, secId, pageId) {
    UI().nb = nbId;
    UI().sec = secId;
    UI().page = pageId;
    const sec = NB.currentSection();
    if (sec) sec.last = pageId;
    app.openNotebookView();
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
   *  Notebook view
   * ==================================================================== */
  app.openNotebook = function (id) {
    const nb = NB.findNotebook(id);
    if (!nb) return;
    UI().nb = id;
    if (!nb.sections.length) {
      const s = NB.newSection('Section 1');
      s.pages.push(NB.newPage());
      nb.sections.push(s);
    }
    let sec = nb.sections.find((s) => s.id === UI().sec) || nb.sections[0];
    UI().sec = sec.id;
    const pid = UI().page;
    if (pid !== 'board' && !sec.pages.some((p) => p.id === pid)) UI().page = sec.last && (sec.last === 'board' || sec.pages.some((p) => p.id === sec.last)) ? sec.last : sec.pages.length ? sec.pages[0].id : 'board';
    app.openNotebookView();
  };

  app.openNotebookView = function () {
    const nb = NB.currentNotebook();
    if (!nb) return app.showShelf();
    let sec = NB.currentSection();
    if (!sec) { sec = nb.sections[0]; UI().sec = sec.id; }
    if (UI().page !== 'board' && !sec.pages.some((p) => p.id === UI().page)) UI().page = sec.pages.length ? sec.pages[0].id : 'board';
    sec.last = UI().page;
    showView('notebook');
    $('#nb-title').value = nb.name;
    $('#nb-view').dataset.binder = nb.binder;
    renderPagesPanel();
    renderBook();
    NB.markDirty();
  };

  app.reopenPage = () => renderBook();
  app.relayout = () => { E.applyPageStyle(); E.layout(); E.ink() && E.ink().resize(); renderBook(true); };

  /* ---------------- book (binding + page + tabs) ---------------- */
  let bindingEl = null, tabsEl = null;

  function ringPositions(kind, height) {
    const out = [];
    const [start, gap] = kind === 'rings6' ? [100, 190] : kind === 'rings2' ? [220, 640] : [150, 360];
    for (let y = start; y < height - 40; y += gap) out.push(y);
    return out;
  }

  function buildBinding() {
    const nb = NB.currentNotebook();
    const page = E.page();
    const el = h('div', { class: 'binding bind-' + (S().showRings ? nb.binder : 'none'), style: { height: page.h + 'px' } });
    if (!S().showRings) return el;
    if (nb.binder === 'rings3' || nb.binder === 'rings6') {
      ringPositions(nb.binder, page.h).forEach((y) => el.appendChild(h('div', { class: 'ring-wrap', style: { top: y + 'px' } }, h('div', { class: 'hole' }), h('div', { class: 'ring' }))));
      el.appendChild(h('div', { class: 'ring-strip' }));
    } else if (nb.binder === 'spiral') {
      const n = Math.floor(page.h / 30);
      for (let i = 0; i < n; i++) el.appendChild(h('div', { class: 'coil', style: { top: 14 + i * 30 + 'px' } }, h('i'), h('b')));
    } else if (nb.binder === 'stitched') {
      el.appendChild(h('div', { class: 'stitch' }));
    }
    return el;
  }

  function buildTabs() {
    const nb = NB.currentNotebook();
    const cur = NB.currentSection();
    const wrap = h('div', { class: 'tabs' });
    const max = Math.max(5, Math.floor((E.page().h - 40) / 52));
    const tabH = nb.sections.length > max ? Math.max(30, Math.floor((E.page().h - 60) / nb.sections.length) - 6) : 46;
    nb.sections.forEach((sec) => {
      const t = h('button', { class: 'tab' + (sec === cur ? ' on' : ''), style: { '--tab': sec.color, height: tabH + 'px' }, title: sec.name + ' – right-click for options', onClick: () => app.openSection(sec.id), onContextmenu: (e) => { e.preventDefault(); sectionMenu(sec, { x: e.clientX, y: e.clientY }); }, onDblclick: () => renameSection(sec) },
        h('span', { class: 'tab-name' }, sec.name));
      wrap.appendChild(t);
    });
    wrap.appendChild(h('button', { class: 'tab add', title: 'New section', onClick: addSection }, '＋'));
    return wrap;
  }

  function renderBook(keepPage) {
    const nb = NB.currentNotebook();
    const book = $('#book');
    const ctx = NB.ctxNow();
    if (!keepPage) {
      book.innerHTML = '';
      book.className = 'book cover-' + nb.texture;
      book.style.setProperty('--cover', nb.cover);
      const pageEl = E.open(ctx.page, { sec: ctx.sec, nb, isBoard: ctx.isBoard });
      bindingEl = buildBinding();
      tabsEl = buildTabs();
      book.append(bindingEl, pageEl, tabsEl);
      E.layout();
      const ink = E.ink();
      ink && ink.resize();
      NB.setTool(NB.tool.name === 'stickers' || NB.tool.name === 'image' ? 'select' : NB.tool.name);
      if (!app._fitted) { app.fit(); app._fitted = true; }
      $('#workspace').scrollTop = 0;
      NB.inspector.render();
      NB.syncFormatBar();
    } else {
      const nbk = NB.currentNotebook();
      const nb2 = buildBinding(); const t2 = buildTabs();
      bindingEl && bindingEl.replaceWith(nb2); tabsEl && tabsEl.replaceWith(t2);
      bindingEl = nb2; tabsEl = t2;
      void nbk;
    }
  }

  E.hooks.layout = () => {
    if (!bindingEl || !bindingEl.isConnected) return;
    const ctx = NB.ctxNow();
    if (!ctx.page) return;
    const b = buildBinding();
    bindingEl.replaceWith(b);
    bindingEl = b;
  };

  /* ---------------- sections ---------------- */
  app.openSection = function (secId) {
    E.stopEdit(true);
    const nb = NB.currentNotebook();
    const sec = nb.sections.find((s) => s.id === secId);
    if (!sec) return;
    UI().sec = secId;
    const last = sec.last;
    UI().page = last && (last === 'board' || sec.pages.some((p) => p.id === last)) ? last : sec.pages.length ? sec.pages[0].id : 'board';
    app.openNotebookView();
  };

  async function addSection() {
    const nb = NB.currentNotebook();
    const name = await NB.ask('New section name', '', 'e.g. Recipes');
    if (!name) return;
    const sec = NB.newSection(name, NB.SECTION_COLORS[nb.sections.length % NB.SECTION_COLORS.length]);
    const pg = NB.newPage();
    sec.pages.push(pg);
    nb.sections.push(sec);
    sec.last = 'board';
    UI().sec = sec.id;
    UI().page = 'board';
    app.openNotebookView();
    NB.toast('Section created – the board is the place for sticky notes about the whole section');
  }

  async function renameSection(sec) {
    const name = await NB.ask('Rename section', sec.name);
    if (!name) return;
    sec.name = name;
    NB.markDirty();
    app.openNotebookView();
  }

  function sectionMenu(sec, where) {
    const nb = NB.currentNotebook();
    const idx = nb.sections.indexOf(sec);
    NB.menu([
      { icon: '✏️', label: 'Rename…', fn: () => renameSection(sec) },
      { icon: '🎨', label: 'Tab colour…', fn: () => NB.colorPicker(document.body, sec.color, (c) => { sec.color = c; NB.markDirty(); renderBook(true); renderPagesPanel(); }, { colors: NB.SECTION_COLORS }) },
      { icon: '⬆', label: 'Move up', disabled: idx === 0, fn: () => { nb.sections.splice(idx, 1); nb.sections.splice(idx - 1, 0, sec); NB.markDirty(); renderBook(true); } },
      { icon: '⬇', label: 'Move down', disabled: idx === nb.sections.length - 1, fn: () => { nb.sections.splice(idx, 1); nb.sections.splice(idx + 1, 0, sec); NB.markDirty(); renderBook(true); } },
      { sep: true },
      { icon: '🗑', label: 'Delete section', danger: true, disabled: nb.sections.length < 2, fn: async () => { if (await NB.confirm(`Delete section “${sec.name}” with ${sec.pages.length} pages?`)) { nb.sections = nb.sections.filter((s) => s !== sec); if (UI().sec === sec.id) UI().sec = nb.sections[0].id; app.openSection(UI().sec); } } },
    ], where);
  }

  /* ---------------- pages panel ---------------- */
  function renderPagesPanel() {
    const nb = NB.currentNotebook(), sec = NB.currentSection();
    const p = $('#pages-panel');
    p.innerHTML = '';
    p.style.setProperty('--sec', sec.color);
    p.append(
      h('div', { class: 'pp-head' }, h('span', { class: 'pp-dot' }), h('b', { class: 'pp-title', title: 'Double-click to rename', onDblclick: () => renameSection(sec) }, sec.name), h('button', { class: 'icon-btn small', title: 'Section options', onClick: (e) => sectionMenu(sec, e.currentTarget) }, '⋯')),
      h('button', { class: 'board-entry' + (UI().page === 'board' ? ' on' : ''), onClick: () => openPage('board') }, h('span', null, '📌'), h('div', null, h('b', null, 'Section board'), h('small', null, sec.board.items.length ? sec.board.items.length + ' notes pinned' : 'Pin notes for this section')))
    );
    const list = h('div', { class: 'page-list' });
    sec.pages.forEach((pg, i) => {
      const row = h('div', { class: 'page-row' + (UI().page === pg.id ? ' on' : ''), draggable: 'true', 'data-i': i, onClick: () => openPage(pg.id), onContextmenu: (e) => { e.preventDefault(); pageMenu(pg, { x: e.clientX, y: e.clientY }); } },
        h('span', { class: 'pr-num' }, i + 1),
        h('div', { class: 'pr-main' }, h('b', null, pg.title || 'Untitled page'), h('small', null, preview(pg))),
        h('button', { class: 'pr-more', title: 'Page options', onClick: (e) => { e.stopPropagation(); pageMenu(pg, e.currentTarget); } }, '⋯'));
      row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-cozy-page', String(i)); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-cozy-page')) { e.preventDefault(); row.classList.add('over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('over');
        const from = parseInt(e.dataTransfer.getData('text/x-cozy-page'), 10);
        if (isNaN(from) || from === i) return;
        const [m] = sec.pages.splice(from, 1);
        sec.pages.splice(i, 0, m);
        NB.markDirty();
        renderPagesPanel();
      });
      list.appendChild(row);
    });
    p.append(list);
    p.append(h('div', { class: 'pp-foot' }, h('button', { class: 'btn primary wide', onClick: () => newPage() }, '＋ New page'), h('button', { class: 'btn wide', onClick: templateDialog }, '🗒 From template…')));
    void nb;
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

  function openPage(id) {
    if (UI().page === id) return;
    E.stopEdit(true);
    UI().page = id;
    app.openNotebookView();
  }

  function newPage(tpl, after) {
    const sec = NB.currentSection();
    const opts = {};
    if (tpl && tpl.paper) opts.paper = tpl.paper;
    if (tpl && tpl.title) opts.title = tpl.title;
    const pg = NB.newPage(opts);
    if (tpl) pg.items = tpl.build();
    const curIdx = sec.pages.findIndex((p) => p.id === UI().page);
    sec.pages.splice(after != null ? after : curIdx >= 0 ? curIdx + 1 : sec.pages.length, 0, pg);
    UI().page = pg.id;
    app.openNotebookView();
    return pg;
  }

  function templateDialog() {
    const grid = h('div', { class: 'tpl-grid' });
    let m;
    NB.TEMPLATES.forEach((t) => grid.appendChild(h('button', { class: 'tpl', onClick: () => { m.close(); newPage(t); } }, h('div', { class: 'tpl-icon' }, t.icon), h('b', null, t.name))));
    m = NB.modal({ title: 'New page from template', body: grid, wide: true });
  }

  app.duplicatePage = function () {
    const sec = NB.currentSection();
    const pg = sec.pages.find((p) => p.id === UI().page);
    if (!pg) return;
    const c = NB.clone(pg);
    c.id = uid('p');
    c.title = (pg.title || 'Untitled') + ' (copy)';
    c.items.forEach((i) => (i.id = uid('i')));
    c.created = Date.now();
    sec.pages.splice(sec.pages.indexOf(pg) + 1, 0, c);
    UI().page = c.id;
    app.openNotebookView();
  };

  function pageMenu(pg, where) {
    const nb = NB.currentNotebook(), sec = NB.currentSection();
    const others = nb.sections.filter((s) => s !== sec);
    NB.menu([
      { icon: '✏️', label: 'Rename', fn: async () => { const n = await NB.ask('Page title', pg.title); if (n != null) { pg.title = n; NB.markDirty(); app.openNotebookView(); } } },
      { icon: '⧉', label: 'Duplicate', fn: () => { UI().page = pg.id; app.duplicatePage(); } },
      ...others.map((s) => ({ icon: '➡', label: 'Move to “' + s.name + '”', fn: () => { sec.pages = sec.pages.filter((p) => p !== pg); s.pages.push(pg); if (UI().page === pg.id) UI().page = sec.pages[0] ? sec.pages[0].id : 'board'; NB.markDirty(); app.openNotebookView(); NB.toast('Moved to ' + s.name); } })),
      { sep: true },
      { icon: '🗑', label: 'Delete page', danger: true, fn: async () => { if (await NB.confirm(`Delete page “${pg.title || 'Untitled'}”?`)) { const i = sec.pages.indexOf(pg); sec.pages.splice(i, 1); if (UI().page === pg.id) UI().page = (sec.pages[i] || sec.pages[i - 1] || { id: 'board' }).id; app.openNotebookView(); } } },
    ], where);
  }

  /* ---------------- zoom ---------------- */
  app.fit = function () {
    const ws = $('#workspace');
    const bookW = 34 + S().pageWidth + 100;
    const s = Math.min(1.4, Math.max(0.35, (ws.clientWidth - 24) / bookW));
    setZoom(s);
  };
  function setZoom(s) {
    const z = E.setScale(s);
    $('#zoom-label').textContent = Math.round(z * 100) + '%';
  }

  /* ---------------- print / export / import ---------------- */
  app.printPage = async function () {
    E.stopEdit(true);
    E.select([]);
    document.body.classList.add('printing');
    await new Promise((r) => setTimeout(r, 150));
    try {
      if (window.native) {
        const title = (E.page().title || NB.currentSection().name || 'page').replace(/[^\w\- ]+/g, '');
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
  function wire() {
    $('#btn-shelf').addEventListener('click', app.showShelf);
    $('#btn-pages-toggle').addEventListener('click', () => $('#main').classList.toggle('no-pages'));
    $('#btn-inspector').addEventListener('click', () => { S().inspectorOpen = !S().inspectorOpen; applyPanels(); NB.markDirty(); });
    $('#nb-title').addEventListener('input', (e) => { NB.currentNotebook().name = e.target.value; NB.markDirty(); });
    $('#btn-undo').addEventListener('click', () => E.undo());
    $('#btn-redo').addEventListener('click', () => E.redo());
    $('#zoom-in').addEventListener('click', () => setZoom(E.scale() * 1.15));
    $('#zoom-out').addEventListener('click', () => setZoom(E.scale() / 1.15));
    $('#zoom-label').addEventListener('click', app.fit);
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
      setZoom(E.scale() * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });
    ws.addEventListener('pointerdown', (e) => {
      if (e.target === ws || e.target.id === 'stage' || e.target.id === 'sizer') E.clearSelectionIfDesk();
    });
    window.addEventListener('resize', NB.debounce(() => { if (UI().view === 'notebook' && !app._userZoom) app.fit(); }, 200));
    window.addEventListener('beforeunload', () => { NB.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) NB.saveNow(); });

    E.hooks.selection = (live) => {
      if (live) return;
      NB.inspector.render();
      NB.syncFormatBar();
    };
    E.hooks.history = () => {
      $('#btn-undo').disabled = !E.canUndo();
      $('#btn-redo').disabled = !E.canRedo();
      if (!E._pp) E._pp = NB.debounce(renderPagesPanel, 600);
      E._pp();
    };
    E.hooks.page = (what) => {
      if (what === 'title') { if (!E._pp) E._pp = NB.debounce(renderPagesPanel, 600); E._pp(); }
      if (what === 'restore') { NB.inspector.render(); }
    };
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
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(E.scale() * 1.15); return; }
    if (mod && e.key === '-') { e.preventDefault(); setZoom(E.scale() / 1.15); return; }
    if (mod && e.key === '0') { e.preventDefault(); app.fit(); return; }
    if (typing || mod || e.altKey || document.querySelector('.modal-back')) return;
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
  }

  /* ====================================================================
   *  Boot
   * ==================================================================== */
  async function boot() {
    await NB.load();
    NB.applyTheme();
    NB.ui.buildToolbar();
    NB.ui.buildFormatBar();
    E.init({ workspace: $('#workspace'), sizer: $('#sizer'), book: $('#book') });
    wire();
    applyPanels();
    NB.setStatus('saved');
    if (window.innerWidth < 1100) $('#main').classList.add('no-pages');
    const st = NB.state.ui;
    if (st.view === 'notebook' && NB.currentNotebook()) app.openNotebook(st.nb);
    else { renderShelf(); showView('shelf'); }
    document.documentElement.classList.add('ready');
  }

  document.addEventListener('DOMContentLoaded', () => boot().catch((e) => { console.error(e); document.body.prepend(h('pre', { style: { color: 'red', padding: '20px' } }, 'Failed to start: ' + e.stack)); }));
})();

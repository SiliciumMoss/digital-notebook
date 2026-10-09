/* Cozy Notebook – toolbar, draw bar, format bar, sticker panel, search, settings, export */
(function () {
  const NB = window.NB;
  const { h, $, $$ } = NB;
  const E = NB.E;
  const S = () => NB.state.settings;

  /* ====================================================================
   *  Native-or-browser file helpers
   * ==================================================================== */
  NB.saveText = async function (name, text, ext, label) {
    if (window.native) return window.native.saveFile(name, text, [{ name: label, extensions: [ext] }]);
    NB.downloadFile(name, text, 'application/json');
    return name;
  };
  NB.openText = async function (ext, label) {
    if (window.native) return window.native.openFile([{ name: label, extensions: [ext, 'json'] }]);
    const [f] = await NB.pickFile('.' + ext + ',.json');
    return f ? await f.text() : null;
  };

  /* ====================================================================
   *  Theme
   * ==================================================================== */
  NB.THEMES = [
    ['cozy', 'Cozy Cabin', '#f5ead8', '#8c5a3c'],
    ['sage', 'Sage Garden', '#e3ecdc', '#5f7f5b'],
    ['rose', 'Rose Tea', '#fbe6e8', '#c0626f'],
    ['ocean', 'Quiet Ocean', '#dfeaf2', '#3f7ea6'],
    ['midnight', 'Midnight', '#2b2a38', '#e0a64f'],
    ['paper', 'Plain Paper', '#f4f4f2', '#555'],
  ];
  NB.applyTheme = function () {
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim() + ' theme-' + S().theme;
  };

  /* ====================================================================
   *  Tools
   * ==================================================================== */
  const TOOLS = [
    ['select', '↖', 'Select & move  (V)'],
    ['text', 'T', 'Text box  (T)'],
    ['sticky', '📝', 'Sticky note  (N)'],
    ['image', '🖼', 'Insert image  (I)'],
    ['shape', '◻', 'Shapes & arrows  (S)'],
    ['stickers', '😊', 'Stickers, paper clips & washi tape'],
    ['-'],
    ['pen', '✒️', 'Pen – pressure sensitive  (P)'],
    ['pencil', '✏️', 'Pencil  (Y)'],
    ['hl', '🖍️', 'Highlighter  (H)'],
    ['eraser', '🧽', 'Eraser  (E)'],
    ['lasso', '➰', 'Lasso: select & move ink  (L)'],
  ];

  NB.setTool = function (name) {
    if (['image', 'stickers'].includes(name)) return;
    if (name !== 'select') (NB.editors || []).forEach((ed) => ed.isEditing() && ed.stopEdit());
    NB.tool.name = name;
    $$('#toolbar .tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
    document.body.dataset.tool = name;
    (NB.editors || []).forEach((ed) => { if (ed.ink()) ed.ink().updateTool(); if (name !== 'select' && !NB.INK_TOOLS.includes(name)) ed.select([]); });
    renderDrawBar();
  };

  const SHAPE_GLYPH = { rect: '▭', round: '▢', ellipse: '◯', triangle: '△', diamond: '◇', star: '☆', heart: '♡', bubble: '💬', line: '╱', arrow: '➔' };

  function buildToolbar() {
    const bar = $('#toolbar');
    bar.innerHTML = '';
    TOOLS.forEach(([id, icon, title]) => {
      if (id === '-') return bar.appendChild(h('div', { class: 'tool-sep' }));
      const b = h('button', { class: 'tool', 'data-tool': id, title }, icon);
      b.addEventListener('click', () => toolClick(id, b));
      bar.appendChild(b);
    });
    bar.appendChild(h('div', { class: 'grow' }));
    bar.appendChild(h('button', { class: 'tool', title: 'Keyboard shortcuts  (?)', onClick: showShortcuts }, '⌨'));
  }

  function toolClick(id, btn) {
    if (id === 'image') {
      return NB.menu(
        [
          { icon: '📁', label: 'From a file…', fn: async () => { const files = await NB.pickFile('image/*', true); for (const f of files) await E.addImageFile(f); } },
          { icon: '🔗', label: 'From a web address…', fn: async () => { const u = await NB.ask('Image address (https://…)', '', 'https://'); if (u) E.addImageUrl(u); } },
          { icon: '📋', label: 'Paste from clipboard (Ctrl+V)', fn: () => NB.toast('Copy an image anywhere, then press Ctrl+V on the page') },
          { header: 'Tip: you can also drag & drop pictures onto the page.' },
        ],
        btn
      );
    }
    if (id === 'shape') {
      const grid = h('div', { class: 'shape-pop' }, NB.SHAPES.map(([k, l]) => h('button', { class: 'shape-opt', title: l, onClick: () => { NB.shapeKind = k; NB.closeMenu(); NB.setTool('shape'); NB.toast('Drag on the page to draw ' + l.toLowerCase() + ' (Shift = straight / square)'); } }, SHAPE_GLYPH[k])));
      return NB.popover(grid, btn);
    }
    if (id === 'stickers') return openStickerPanel(btn);
    NB.setTool(id);
  }

  /* ---------------- sticker panel ---------------- */
  function openStickerPanel(anchor) {
    const body = h('div', { class: 'sticker-body' });
    const tabs = h('div', { class: 'sticker-tabs' });
    const cats = Object.keys(NB.EMOJI);
    const pages = ['Clips & pins', 'Washi tape', 'Labels', ...cats];
    const add = (it) => { const pt = E.viewCenter(); it.x = Math.round(pt[0] - it.w / 2 + NB.rand(-30, 30)); it.y = Math.round(pt[1] - it.h / 2 + NB.rand(-30, 30)); it.rot = it.rot || Math.round(NB.rand(-8, 8)); E.addItem(it); };
    function show(name) {
      $$('.chip', tabs).forEach((c) => c.classList.toggle('on', c.textContent === name));
      body.innerHTML = '';
      if (name === 'Clips & pins') {
        body.append(h('div', { class: 'deco-grid' }, NB.DECOS.clips.map(([k, l, svg, w, hh]) => { const b = h('button', { class: 'deco-opt', title: l, onClick: () => add(NB.makeItem('deco', { kind: k, w, h: hh })) }); b.innerHTML = '<div class="deco-prev">' + svg + '</div>'; return b; })));
        body.append(h('p', { class: 'hint' }, 'Tip: drag a clip over the corner of a photo or note. Use the Order buttons to put it on top.'));
      } else if (name === 'Washi tape') {
        body.append(h('div', { class: 'tape-grid' }, NB.DECOS.tapes.map(([k, l]) => { const it = NB.makeItem('deco', { kind: k }); const el = NB.items.build(it, {}); el.style.cssText = ''; el.className = 'item item-deco tape-prev'; const b = h('button', { class: 'tape-opt', title: l, onClick: () => { const [w, hh] = NB.decoSize(k); add(NB.makeItem('deco', { kind: k, w, h: hh })); } }, el); return b; })));
      } else if (name === 'Labels') {
        body.append(h('div', { class: 'tape-grid' }, NB.DECOS.labels.map(([k]) => { const it = NB.makeItem('deco', { kind: k }); const el = NB.items.build(it, {}); el.style.cssText = ''; el.className = 'item item-deco tape-prev'; return h('button', { class: 'tape-opt', onClick: () => { const [w, hh] = NB.decoSize(k); add(NB.makeItem('deco', { kind: k, w, h: hh })); } }, el); })));
      } else {
        body.append(h('div', { class: 'emoji-grid' }, NB.EMOJI[name].map((g) => h('button', { class: 'emoji-opt', onClick: () => add(NB.makeItem('sticker', { glyph: g })) }, g))));
      }
    }
    pages.forEach((p) => tabs.appendChild(h('button', { class: 'chip', onClick: () => show(p) }, p)));
    const pop = NB.popover(h('div', { class: 'sticker-panel' }, h('div', { class: 'sticker-title' }, 'Stickers & decorations'), tabs, body), anchor, 'wide');
    show('Clips & pins');
    return pop;
  }

  /* ====================================================================
   *  Draw bar
   * ==================================================================== */
  const INK_COLORS = ['#2b2a33', '#6b6b6b', '#e5484d', '#f97316', '#f5c518', '#7ab648', '#2a9d8f', '#3b82f6', '#7c5cff', '#e879a9', '#8b5e3c', '#ffffff'];
  const HL_COLORS = ['#ffe14d', '#ff9ecb', '#8fe388', '#7fd4ff', '#ffb066', '#d2a8ff'];

  function renderDrawBar() {
    const bar = $('#drawbar');
    const t = NB.tool.name;
    if (!NB.INK_TOOLS.includes(t)) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = '';
    const T = NB.tool[t];
    const label = { pen: 'Pen', pencil: 'Pencil', hl: 'Highlighter', eraser: 'Eraser', lasso: 'Lasso' }[t];
    bar.append(h('strong', { class: 'db-label' }, label));
    if (t === 'eraser') {
      bar.append(h('span', { class: 'db-text' }, 'Size'), sizeSlider(NB.tool.eraser, 'size', 8, 80), h('span', { class: 'db-text muted' }, 'Wipes whole strokes it touches. Pen users: flip your stylus for a quick eraser.'));
    } else if (t === 'lasso') {
      bar.append(h('span', { class: 'db-text muted' }, 'Draw a loop around ink to select it, then drag it. Press Delete to remove.'));
      const swatches = h('div', { class: 'ink-swatches' }, INK_COLORS.map((c) => h('button', { class: 'swatch', style: { background: c }, title: 'Recolour selection', onClick: () => E.ink().recolorSelection(c) })));
      bar.append(swatches, h('button', { class: 'chip danger', onClick: () => E.ink().deleteSelection() }, '🗑 Delete selection'));
    } else {
      const colors = t === 'hl' ? HL_COLORS : INK_COLORS;
      const sw = h('div', { class: 'ink-swatches' });
      const paint = () => {
        sw.innerHTML = '';
        colors.forEach((c) => sw.appendChild(h('button', { class: 'swatch' + (c.toLowerCase() === T.color.toLowerCase() ? ' on' : ''), style: { background: c }, title: c, onClick: () => { T.color = c; paint(); preview(); } })));
        const cust = h('input', { type: 'color', class: 'color-custom', value: /^#[0-9a-f]{6}$/i.test(T.color) ? T.color : '#000000', title: 'Custom colour' });
        cust.addEventListener('input', () => { T.color = cust.value; preview(); sw.querySelectorAll('.swatch.on').forEach((n) => n.classList.remove('on')); });
        sw.appendChild(cust);
      };
      const prev = h('div', { class: 'stroke-preview' });
      const preview = () => {
        prev.innerHTML = '';
        const d = Math.min(36, T.size * (t === 'hl' ? 1 : 1.2));
        prev.appendChild(h('span', { style: { width: d + 'px', height: d + 'px', background: T.color, opacity: t === 'hl' ? 0.45 : 1 } }));
      };
      paint();
      preview();
      bar.append(sw, h('span', { class: 'db-text' }, 'Size'), sizeSlider(T, 'size', t === 'hl' ? 6 : 1, t === 'hl' ? 50 : 24, preview), prev);
    }
    bar.append(h('span', { class: 'spacer' }));
    bar.append(
      h('button', { class: 'chip' + (S().penOnly ? ' on' : ''), title: 'Palm rejection: only the stylus draws, finger drags scroll the page', onClick: () => { S().penOnly = !S().penOnly; NB.markDirty(); renderDrawBar(); } }, '✋ Stylus only'),
      h('button', { class: 'chip' + (S().pressure ? ' on' : ''), title: 'Line width follows pen pressure', onClick: () => { S().pressure = !S().pressure; NB.markDirty(); renderDrawBar(); } }, '〰 Pressure'),
      h('button', { class: 'chip' + (S().holdStraight ? ' on' : ''), title: 'Hold still at the end of a stroke to snap it to a straight line', onClick: () => { S().holdStraight = !S().holdStraight; NB.markDirty(); renderDrawBar(); } }, '📏 Hold to straighten')
    );
  }
  NB.renderDrawBar = renderDrawBar;

  function sizeSlider(obj, key, min, max, onInput) {
    const out = h('span', { class: 'range-val' }, obj[key]);
    const r = h('input', { type: 'range', min, max, step: 1, value: obj[key], class: 'db-range' });
    r.addEventListener('input', () => { obj[key] = parseFloat(r.value); out.textContent = r.value; onInput && onInput(); });
    return h('span', { class: 'db-slider' }, r, out);
  }

  /* ====================================================================
   *  Format bar
   * ==================================================================== */
  function buildFormatBar() {
    const font = $('#fmt-font');
    font.innerHTML = '';
    NB.FONTS.forEach((f) => font.appendChild(h('option', { value: f.css }, f.name)));
    $('#fmtbar').addEventListener('pointerdown', () => E.captureRange(), true);
    const keep = (e) => e.preventDefault();
    $$('#fmtbar .fmt, #fmtbar .fmt *').forEach((b) => b.addEventListener('mousedown', keep));

    font.addEventListener('change', () => { if (!E.format('fontName', font.value)) E.setTextProp('font', font.value); });
    const size = $('#fmt-size');
    const applySize = () => { const v = Math.max(8, Math.min(160, parseInt(size.value, 10) || 20)); if (!E.format('fontSize', v)) E.setTextProp('size', v); };
    size.addEventListener('change', applySize);
    size.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySize(); } });

    $$('#fmtbar .fmt[data-cmd]').forEach((b) => {
      b.addEventListener('click', () => {
        const cmd = b.dataset.cmd;
        if (E.format(cmd)) return updateFmtState();
        const al = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' }[cmd];
        if (al && E.setTextProp('align', al)) return;
        NB.toast('Double-click a text box or sticky note, then format the selected words');
      });
    });
    $('#fmt-color').addEventListener('click', (e) => {
      NB.colorPicker(e.currentTarget, $('#fmt-color-bar').style.background, (c) => {
        $('#fmt-color-bar').style.background = c;
        if (!E.format('foreColor', c)) E.setTextProp('textColor', c);
      }, { allowNone: false });
    });
    $('#fmt-hilite').addEventListener('click', (e) => {
      NB.colorPicker(e.currentTarget, '', (c) => {
        $('#fmt-hilite-bar').style.background = c;
        if (!E.format('hiliteColor', c)) E.setTextProp('bg', c);
      }, { colors: ['#fff176', '#ffcc80', '#f8bbd0', '#c5e1a5', '#b3e5fc', '#d1c4e9', '#ffffff'], allowNone: true });
    });
    $('#fmt-color-bar').style.background = '#2b2a33';
    $('#fmt-hilite-bar').style.background = '#fff176';
    document.addEventListener('selectionchange', updateFmtState);
  }

  function updateFmtState() {
    if (!E.isEditing()) {
      $$('#fmtbar .fmt[data-cmd]').forEach((b) => b.classList.remove('on'));
      return;
    }
    $$('#fmtbar .fmt[data-cmd]').forEach((b) => {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch (e) { /* ignore */ }
      b.classList.toggle('on', !!on);
    });
  }

  NB.syncFormatBar = function () {
    const sel = E.selection();
    const it = sel[0];
    const hint = $('#fmt-hint');
    const textual = it && ['text', 'sticky', 'shape', 'todo'].includes(it.type);
    $('#fmtbar').classList.toggle('active', E.isEditing() || !!textual);
    if (E.isEditing()) hint.textContent = 'Editing – format the selected words. Esc to finish';
    else if (textual) hint.textContent = 'Formatting applies to the whole box (double-click to style words)';
    else hint.textContent = 'Double-click a text box to edit it';
    if (textual && !E.isEditing()) {
      $('#fmt-size').value = it.size || 20;
      const f = NB.FONTS.find((x) => x.css === it.font);
      if (f) $('#fmt-font').value = f.css;
    }
    updateFmtState();
  };

  /* ====================================================================
   *  Keyboard shortcuts help
   * ==================================================================== */
  function showShortcuts() {
    const rows = [
      ['V / T / N', 'Select · Text box · Sticky note'], ['P / Y / H / E / L', 'Pen · Pencil · Highlighter · Eraser · Lasso'], ['S', 'Shapes'],
      ['Double-click', 'Edit text / crop an image / type in a shape'], ['Shift + click', 'Select several items'], ['Drag empty space', 'Rubber-band select'],
      ['Ctrl + C / X / V', 'Copy · Cut · Paste (also pastes screenshots & images)'], ['Ctrl + D', 'Duplicate'], ['Delete', 'Delete selected'],
      ['Arrow keys', 'Nudge (Shift = 10px)'], ['[ and ]', 'Send backward / bring forward'], ['Ctrl + Z / Y', 'Undo / Redo'],
      ['Ctrl + K', 'Search everything'], ['Ctrl + wheel', 'Zoom'], ['Ctrl + P', 'Print / save as PDF'], ['Esc', 'Finish editing / deselect / back to Select'],
      ['Hold pen still', 'Snap a stroke to a straight line'], ['Flip stylus', 'Eraser (on tablets that support it)'],
    ];
    NB.modal({ title: 'Keyboard & pen shortcuts', body: h('table', { class: 'keys' }, rows.map(([k, d]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, d)))), buttons: [{ label: 'Close', primary: true }] });
  }
  NB.showShortcuts = showShortcuts;

  /* ====================================================================
   *  Search
   * ==================================================================== */
  NB.openSearch = function () {
    const input = h('input', { type: 'search', class: 'text-input big', placeholder: 'Search pages, notes, stickies, checklists…' });
    const list = h('div', { class: 'search-results' });
    const m = NB.modal({ title: 'Search', body: h('div', null, input, list), wide: true });
    const run = () => {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (q.length < 2) return list.appendChild(h('p', { class: 'hint' }, 'Type at least two letters.'));
      let n = 0;
      for (const nb of NB.state.notebooks) {
        for (const sec of nb.sections) {
          const pages = [{ pg: sec.board, board: true }, ...sec.pages.map((pg) => ({ pg }))];
          for (const { pg, board } of pages) {
            const texts = [];
            if (pg.title) texts.push(pg.title);
            for (const it of pg.items) {
              if (it.html) texts.push(NB.htmlToText(it.html));
              if (it.label) texts.push(it.label);
              if (it.caption) texts.push(it.caption);
              if (it.title) texts.push(it.title);
              if (it.items) it.items.forEach((r) => texts.push(r.t));
            }
            const hit = texts.find((t) => t.toLowerCase().includes(q));
            const nameHit = (!board && pg.title || '').toLowerCase().includes(q);
            if (!hit && !nameHit) continue;
            if (++n > 60) break;
            const text = hit || pg.title;
            const i = text.toLowerCase().indexOf(q);
            const snip = text.slice(Math.max(0, i - 30), i + 70).replace(/\s+/g, ' ');
            list.appendChild(
              h('button', { class: 'result', onClick: () => { m.close(); NB.app.goTo(nb.id, sec.id, board ? 'board' : pg.id); } },
                h('span', { class: 'r-dot', style: { background: sec.color } }),
                h('span', { class: 'r-main' }, h('b', null, (board ? '📌 ' + sec.name + ' board' : pg.title || 'Untitled page')), h('small', null, nb.name + ' › ' + sec.name)),
                h('span', { class: 'r-snip' }, '…' + snip + '…'))
            );
          }
        }
      }
      if (!n) list.appendChild(h('p', { class: 'hint' }, 'Nothing found.'));
    };
    input.addEventListener('input', NB.debounce(run, 120));
    run();
  };

  /* ====================================================================
   *  Export / import / print
   * ==================================================================== */
  NB.exportMenu = function (anchor) {
    const nb = NB.currentNotebook();
    NB.menu(
      [
        { icon: '🖨', label: 'Print / save this page as PDF…', fn: () => NB.app.printPage() },
        { sep: true },
        { icon: '📤', label: 'Export this notebook (backup file)…', fn: () => NB.app.exportNotebook(nb.id) },
        { icon: '🗃', label: 'Export every notebook…', fn: () => NB.app.exportNotebook() },
        { icon: '📥', label: 'Import notebooks from backup…', fn: () => NB.app.importFile() },
        ...(window.native ? [{ sep: true }, { icon: '📂', label: 'Open data folder', fn: () => window.native.reveal() }] : []),
      ],
      anchor
    );
  };

  /* ====================================================================
   *  Settings
   * ==================================================================== */
  NB.openSettings = function () {
    const body = h('div', { class: 'settings' });
    const group = (t, ...k) => h('section', { class: 'set-group' }, h('h3', null, t), k);
    const row = (l, ctl, hint) => h('div', { class: 'set-row' }, h('label', null, l, hint ? h('small', null, hint) : null), h('div', { class: 'set-ctl' }, ctl));
    const check = (key, cb) => { const c = h('input', { type: 'checkbox', checked: !!S()[key] }); c.addEventListener('change', () => { S()[key] = c.checked; NB.markDirty(); cb && cb(); }); return c; };

    const themeCards = h('div', { class: 'theme-cards' }, NB.THEMES.map(([id, name, bg, fg]) => h('button', { class: 'theme-card' + (S().theme === id ? ' on' : ''), style: { background: bg, color: id === 'midnight' ? '#f2e8d5' : '#3a2e26' }, onClick: (e) => { S().theme = id; NB.applyTheme(); NB.markDirty(); $$('.theme-card', themeCards).forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); } }, h('span', { class: 'tc-dot', style: { background: fg } }), name)));

    const paperSel = h('select', null, ['blank', 'lined', 'grid', 'dots', 'cornell', 'legal', 'music'].map((p) => h('option', { value: p, selected: S().defaultPaper === p }, p[0].toUpperCase() + p.slice(1))));
    paperSel.addEventListener('change', () => { S().defaultPaper = paperSel.value; NB.markDirty(); });
    const fontSel = h('select', null, NB.FONTS.map((f) => h('option', { value: f.css, selected: f.css === S().textFont }, f.name)));
    fontSel.addEventListener('change', () => { S().textFont = fontSel.value; NB.markDirty(); });
    const sizeIn = h('input', { type: 'number', class: 'num', min: 10, max: 60, value: S().textSize });
    sizeIn.addEventListener('change', () => { S().textSize = Math.max(10, Math.min(60, +sizeIn.value || 20)); NB.markDirty(); });
    const gridIn = h('input', { type: 'number', class: 'num', min: 5, max: 100, value: S().grid });
    gridIn.addEventListener('change', () => { S().grid = Math.max(5, Math.min(100, +gridIn.value || 20)); NB.markDirty(); });
    const pageCol = h('div', { class: 'swatch-row' }, NB.PAGE_COLORS.map((c) => h('button', { class: 'swatch' + (S().defaultPageColor === c ? ' on' : ''), style: { background: c }, onClick: (e) => { S().defaultPageColor = c; NB.markDirty(); $$('.swatch', pageCol).forEach((s) => s.classList.remove('on')); e.currentTarget.classList.add('on'); } })));

    const sizeR = h('input', { type: 'range', min: 420, max: 760, step: 10, value: S().pageWidth });
    const sizeOut = h('span', { class: 'range-val' }, S().pageWidth + ' × ' + S().pageHeight);
    sizeR.addEventListener('input', () => { sizeOut.textContent = sizeR.value + ' × ' + Math.round(sizeR.value * 1.357); });
    sizeR.addEventListener('change', () => { S().pageWidth = +sizeR.value; NB.app.relayout(); });
    const pageSize = h('span', { class: 'set-ctl' }, sizeR, sizeOut);
    const storage = h('div', { class: 'set-ctl' });
    body.append(
      group('Look & feel', themeCards),
      group('New pages', row('Default paper', paperSel), row('Default page colour', pageCol), ),
      group('Writing', row('Default font', fontSel), row('Default text size', sizeIn)),
      group('Stylus & tablet', row('Pressure sensitivity', check('pressure', NB.renderDrawBar), 'Line width follows how hard you press'), row('Smooth lines', check('smoothing'), 'Steadier handwriting'), row('Hold to straighten', check('holdStraight'), 'Pause at the end of a stroke to make a straight line'), row('Stylus only (palm rejection)', check('penOnly', NB.renderDrawBar), 'Fingers scroll the page instead of drawing')),
      group('Layout', row('Snap to grid', check('snap')), row('Grid size', gridIn), row('Show page date', check('showDate', () => NB.app.reopenPage())), row('Show binder rings / spiral', check('showRings', () => NB.app.relayout())), row('Page size', pageSize, 'Width of one page – height follows')),
      group('Your data', h('p', { class: 'hint' }, window.native ? 'Notebooks are saved automatically on this computer as you work.' : 'Saved automatically in this browser profile.'), h('div', { class: 'set-actions' }, h('button', { class: 'btn', onClick: () => NB.app.exportNotebook() }, '📤 Backup everything'), h('button', { class: 'btn', onClick: () => NB.app.importFile() }, '📥 Import backup'), window.native ? h('button', { class: 'btn', onClick: () => window.native.reveal() }, '📂 Open data folder') : null, h('button', { class: 'btn danger', onClick: async () => { if (await NB.confirm('This permanently deletes ALL notebooks on this computer. Make a backup first!', 'Erase everything')) { await NB.storage.clearAll(); location.reload(); } } }, '🗑 Erase everything')), storage)
    );
    NB.modal({ title: 'Settings', body, wide: true, buttons: [{ label: 'Done', primary: true }], cls: 'settings-modal' });
  };

  NB.ui = { buildToolbar, buildFormatBar, renderDrawBar, showShortcuts };
})();

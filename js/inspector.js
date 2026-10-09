/* Cozy Notebook – properties inspector + image crop dialog */
(function () {
  const NB = window.NB;
  const { h, clamp } = NB;
  const E = NB.editor;

  const ICON = { text: '🅣 Text box', sticky: '📝 Sticky note', image: '🖼 Image', shape: '◻ Shape', sticker: '😊 Sticker', deco: '📎 Decoration', todo: '☑ Checklist' };

  /* ---------- tiny control builders ---------- */
  const row = (label, ...ctl) => h('div', { class: 'ins-row' }, label ? h('label', null, label) : null, h('div', { class: 'ins-ctl' }, ctl));
  const group = (title, ...kids) => h('section', { class: 'ins-group' }, h('h3', null, title), kids);

  function range(val, min, max, step, onInput, onChange, unit = '') {
    const out = h('span', { class: 'range-val' }, Math.round(val * 100) / 100 + unit);
    const r = h('input', { type: 'range', min, max, step, value: val });
    r.addEventListener('input', () => { const v = parseFloat(r.value); out.textContent = Math.round(v * 100) / 100 + unit; onInput(v); });
    r.addEventListener('change', () => onChange && onChange());
    return [r, out];
  }

  function colorBtn(cur, onPick, opts = {}) {
    const b = h('button', { class: 'color-btn' + (cur ? '' : ' none'), title: opts.title || 'Pick colour', style: { background: cur || '' } }, cur ? '' : '∅');
    b.addEventListener('click', () => NB.colorPicker(b, cur, (c) => { onPick(c); b.style.background = c; b.classList.toggle('none', !c); b.textContent = c ? '' : '∅'; }, opts));
    return b;
  }

  function swatchRow(colors, cur, onPick, opts) {
    return h('div', { class: 'swatch-row' }, colors.map((c) => h('button', { class: 'swatch' + (c.toLowerCase() === (cur || '').toLowerCase() ? ' on' : ''), style: { background: c }, title: c, onClick: () => onPick(c) })), colorBtn(cur, onPick, opts));
  }

  const toggle = (label, on, fn) => h('button', { class: 'chip' + (on ? ' on' : ''), onClick: () => fn(!on) }, label);
  const btn = (label, fn, title, cls = '') => h('button', { class: 'chip ' + cls, title, onClick: fn }, label);

  function fontSelect(cur, fn) {
    const sel = h('select', null, NB.FONTS.map((f) => h('option', { value: f.css, selected: f.css === cur }, f.name)));
    sel.addEventListener('change', () => fn(sel.value));
    return sel;
  }

  function numInput(val, min, max, fn) {
    const i = h('input', { type: 'number', class: 'num', min, max, value: Math.round(val) });
    i.addEventListener('change', () => { const v = clamp(parseFloat(i.value) || min, min, max); i.value = v; fn(v); });
    return i;
  }

  /* ---------- apply helpers ---------- */
  function mutate(targets, fn, rebuild = true, commit = true) {
    targets.forEach((it) => { fn(it); E.refresh(it, rebuild); });
    if (commit) E.commit();
  }

  /* ---------- sections ---------- */
  function common(sel) {
    const it = sel[0];
    const same = sel;
    const g = group(sel.length > 1 ? `${sel.length} items selected` : ICON[it.type] || 'Item');
    if (sel.length === 1) {
      g.append(
        row('Rotate', ...range(it.rot || 0, -180, 180, 1, (v) => { it.rot = v; E.refresh(it, false); }, () => E.commit(), '°'), btn('⟲', () => mutate(same, (i) => (i.rot = Math.round((((i.rot || 0) - 90 + 180) % 360 + 360) % 360 - 180)), false), 'Rotate left 90°'), btn('⟳', () => mutate(same, (i) => (i.rot = Math.round((((i.rot || 0) + 90 + 180) % 360 + 360) % 360 - 180)), false), 'Rotate right 90°'))
      );
    }
    g.append(
      row('Opacity', ...range(it.opacity == null ? 1 : it.opacity, 0.1, 1, 0.05, (v) => { same.forEach((i) => { i.opacity = v; E.refresh(i, false); }); }, () => E.commit())),
      row('Order', btn('⤒', () => E.zOrder('front'), 'Bring to front'), btn('↑', () => E.zOrder('up'), 'Forward'), btn('↓', () => E.zOrder('down'), 'Backward'), btn('⤓', () => E.zOrder('back'), 'Send to back')),
      row('', btn('⧉ Duplicate', () => E.duplicate()), toggle(it.locked ? '🔒 Locked' : '🔓 Lock', !!it.locked, (v) => mutate(same, (i) => (i.locked = v))), btn('🗑 Delete', () => E.deleteSelection(), 'Delete', 'danger'))
    );
    if (sel.length > 1) {
      g.append(
        row('Align', btn('⇤', () => E.align('left'), 'Left'), btn('⇹', () => E.align('center'), 'Centre'), btn('⇥', () => E.align('right'), 'Right'), btn('⤒', () => E.align('top'), 'Top'), btn('↕', () => E.align('middle'), 'Middle'), btn('⤓', () => E.align('bottom'), 'Bottom')),
        row('Spread', btn('↔ Horizontally', () => E.align('hdist')), btn('↕ Vertically', () => E.align('vdist')))
      );
    }
    return g;
  }

  function textGroup(targets, it, { bg, border } = {}) {
    const g = group('Text');
    g.append(
      row('Font', fontSelect(it.font, (v) => mutate(targets, (i) => (i.font = v)))),
      row('Size', ...range(it.size || 20, 10, 90, 1, (v) => targets.forEach((i) => { i.size = v; E.refresh(i, false); const el = E.el(i.id); NB.items.fill(el, i, {}); }), () => E.commit(), 'px')),
      row('Colour', colorBtn(it.textColor, (c) => mutate(targets, (i) => (i.textColor = c)), { allowNone: true, title: 'Text colour' }))
    );
    if (it.type === 'text' || it.type === 'sticky') {
      g.append(row('Align', ...['left', 'center', 'right'].map((a) => toggle({ left: '⬅', center: '↔', right: '➡' }[a], (it.align || 'left') === a, () => mutate(targets, (i) => (i.align = a))))));
    }
    if (bg) g.append(row('Background', swatchRow(NB.STICKY_COLORS, it.bg, (c) => mutate(targets, (i) => (i.bg = c)), { allowNone: true, colors: NB.STICKY_COLORS })));
    if (border) g.append(row('Outline', toggle('Show border', !!it.border, (v) => mutate(targets, (i) => (i.border = v)))));
    return g;
  }

  function stickyGroup(targets, it) {
    return group(
      'Sticky note',
      row('Paper', swatchRow(NB.STICKY_COLORS, it.color, (c) => mutate(targets, (i) => (i.color = c)), { colors: NB.STICKY_COLORS })),
      row('Style', ...[['curl', 'Curled'], ['plain', 'Plain'], ['pin', '📌 Pinned'], ['tape', 'Taped']].map(([k, l]) => toggle(l, (it.style || 'curl') === k, () => mutate(targets, (i) => (i.style = k)))))
    );
  }

  const PRESETS = {
    Original: { brightness: 100, contrast: 100, saturate: 100 },
    'B&W': { brightness: 105, contrast: 115, saturate: 100, gray: 100 },
    Sepia: { brightness: 105, contrast: 95, saturate: 110, sepia: 80 },
    Vivid: { brightness: 105, contrast: 115, saturate: 150 },
    Fade: { brightness: 112, contrast: 80, saturate: 80 },
    Cool: { brightness: 100, contrast: 105, saturate: 105, hue: 340 },
    Warm: { brightness: 105, contrast: 100, saturate: 120, sepia: 25 },
    Dreamy: { brightness: 112, contrast: 90, saturate: 120, blur: 1 },
  };

  function imageGroup(targets, it) {
    const f = (it.f = it.f || { brightness: 100, contrast: 100, saturate: 100 });
    const sl = (label, key, min, max, def, unit = '') => row(label, ...range(f[key] == null ? def : f[key], min, max, 1, (v) => { f[key] = v; E.refresh(it, true); }, () => E.commit(), unit));
    const g = group(
      'Image',
      row('', btn('✂ Crop…', () => NB.openCrop(it)), btn('🔄 Replace…', async () => {
        const [file] = await NB.pickFile('image/*');
        if (!file) return;
        const { data } = await NB.processImageFile(file);
        it.asset = await NB.addAsset(data); it.url = null; E.refresh(it); E.commit();
      })),
      row('Flip', toggle('↔ Horizontal', !!it.flipX, (v) => mutate(targets, (i) => (i.flipX = v))), toggle('↕ Vertical', !!it.flipY, (v) => mutate(targets, (i) => (i.flipY = v)))),
      row('Frame', ...[['none', 'None'], ['polaroid', 'Polaroid'], ['tape', 'Taped']].map(([k, l]) => toggle(l, (it.frame || 'none') === k, () => mutate(targets, (i) => (i.frame = k))))),
      it.frame === 'polaroid' ? row('Caption', (() => { const i = h('input', { type: 'text', class: 'text-input', value: it.caption || '', placeholder: 'Write a caption…' }); i.addEventListener('input', () => { it.caption = i.value; const c = E.el(it.id).querySelector('.polaroid-cap'); if (c) c.textContent = i.value; NB.markDirty(); }); i.addEventListener('change', () => E.commit()); return i; })()) : null,
      row('Corners', ...range(it.radius || 0, 0, 50, 1, (v) => { it.radius = v; E.refresh(it, true); }, () => E.commit(), '%')),
      row('Border', ...range(it.bw || 0, 0, 24, 1, (v) => { it.bw = v; E.refresh(it, true); }, () => E.commit(), 'px'), colorBtn(it.bc || '#ffffff', (c) => mutate(targets, (i) => (i.bc = c)))),
      row('Shadow', toggle('Drop shadow', it.shadow !== false, (v) => mutate(targets, (i) => (i.shadow = v))))
    );
    const fg = group('Adjust', row('Presets', h('div', { class: 'preset-row' }, Object.keys(PRESETS).map((k) => btn(k, () => { it.f = Object.assign({}, PRESETS[k]); E.refresh(it); E.commit(); NB.inspector.render(); })))), sl('Brightness', 'brightness', 30, 200, 100, '%'), sl('Contrast', 'contrast', 30, 200, 100, '%'), sl('Saturation', 'saturate', 0, 250, 100, '%'), sl('Hue', 'hue', 0, 360, 0, '°'), sl('Blur', 'blur', 0, 12, 0, 'px'), sl('Grayscale', 'gray', 0, 100, 0, '%'), sl('Sepia', 'sepia', 0, 100, 0, '%'), sl('Invert', 'invert', 0, 100, 0, '%'), row('', btn('↺ Reset adjustments', () => { it.f = { brightness: 100, contrast: 100, saturate: 100 }; E.refresh(it); E.commit(); NB.inspector.render(); })));
    return [g, fg];
  }

  function shapeGroup(targets, it) {
    const g = group('Shape');
    g.append(row('Kind', (() => { const s = h('select', null, NB.SHAPES.map(([k, l]) => h('option', { value: k, selected: k === it.kind }, l))); s.addEventListener('change', () => { mutate(targets, (i) => (i.kind = s.value)); NB.inspector.render(); }); return s; })()));
    const isLine = it.kind === 'line' || it.kind === 'arrow';
    if (!isLine) g.append(row('Fill', swatchRow(['#ffffff', '#fff2a8', '#ffd6e0', '#d7f0c2', '#bfe6ff', '#e2d4ff', '#2b2a33'], it.fill, (c) => mutate(targets, (i) => (i.fill = c)), { allowNone: true })));
    g.append(
      row('Line', colorBtn(it.stroke, (c) => mutate(targets, (i) => (i.stroke = c))), ...range(it.sw == null ? 3 : it.sw, 0, 16, 1, (v) => { targets.forEach((i) => { i.sw = v; E.refresh(i, true); }); }, () => E.commit(), 'px')),
      row('Style', toggle('Dashed', !!it.dash, (v) => mutate(targets, (i) => (i.dash = v))), toggle('Shadow', !!it.shadow, (v) => mutate(targets, (i) => (i.shadow = v))))
    );
    if (!isLine) {
      g.append(
        row('Label', fontSelect(it.font, (v) => mutate(targets, (i) => (i.font = v)))),
        row('Label size', ...range(it.size || 20, 10, 80, 1, (v) => targets.forEach((i) => { i.size = v; E.refresh(i, true); }), () => E.commit(), 'px')),
        row('Label colour', colorBtn(it.textColor, (c) => mutate(targets, (i) => (i.textColor = c)), { allowNone: true })),
        h('p', { class: 'hint' }, 'Double-click the shape to type inside it.')
      );
    }
    return g;
  }

  function sizeGroup(targets, it) {
    return group('Size', row('Width', numInput(it.w, 10, 2000, (v) => mutate(targets, (i) => { const k = v / i.w; i.w = v; if (i.type === 'sticker' || i.type === 'deco' || i.type === 'image') i.h = Math.round(i.h * k); }, false))), row('Height', numInput(it.h, 10, 3000, (v) => mutate(targets, (i) => (i.h = v), false))));
  }

  /* ---------- page properties ---------- */
  const PAPERS = [['blank', 'Blank'], ['lined', 'Lined'], ['grid', 'Grid'], ['dots', 'Dotted'], ['cornell', 'Cornell'], ['legal', 'Legal'], ['music', 'Music']];

  function pageGroup() {
    const page = E.page();
    const ctx = NB.ctxNow();
    const out = [];
    if (ctx.isBoard) {
      out.push(group('Section board', h('p', { class: 'hint' }, 'A pin-board for this whole section. Stick notes, photos and clips here – it’s the first thing you see when you open the section.'), row('Surface', swatchRow(['#c8975f', '#b98550', '#6f8f72', '#4a5568', '#e8dcc8', '#f6efe0'], page.color, (c) => setPage({ color: c })))));
    } else {
      out.push(group('Page paper', h('div', { class: 'paper-grid' }, PAPERS.map(([k, l]) => h('button', { class: 'paper-opt paper-' + k + (page.paper === k ? ' on' : ''), onClick: () => setPage({ paper: k }) }, h('span', null, l))))), row('Colour', swatchRow(NB.PAGE_COLORS, page.color, (c) => setPage({ color: c }))));
    }
    out.push(group('Page', row('', btn('⤓ Add more space', () => E.extendPage(500)), btn('🧽 Clear all ink', async () => { if (page.strokes.length && (await NB.confirm('Erase every pen stroke on this page?', 'Clear ink'))) { page.strokes = []; E.ink().redraw(); E.commit(); } })), !ctx.isBoard ? row('', btn('⧉ Duplicate page', () => NB.app.duplicatePage()), btn('🖨 Print / PDF', () => NB.app.printPage())) : null));
    return out;
  }

  function setPage(props) {
    Object.assign(E.page(), props);
    E.applyPageStyle();
    E.ink().redraw();
    E.commit();
    NB.inspector.render();
  }

  /* ---------- main render ---------- */
  NB.inspector = {
    render() {
      const root = NB.$('#inspector-body');
      if (!root || !E.page()) return;
      const keepScroll = root.scrollTop;
      root.innerHTML = '';
      const sel = E.selection();
      if (!sel.length) {
        root.append(...pageGroup());
        if (NB.tool.name === 'lasso' || NB.inkSelCount) { /* ink hints in draw bar */ }
      } else {
        const it = sel[0];
        const sameType = sel.every((s) => s.type === it.type);
        const targets = sameType ? sel : [it];
        root.append(common(sel));
        if (sameType) {
          if (it.type === 'text') root.append(textGroup(targets, it, { bg: true, border: true }), sizeGroup(targets, it));
          if (it.type === 'sticky') root.append(stickyGroup(targets, it), textGroup(targets, it), sizeGroup(targets, it));
          if (it.type === 'image') root.append(...imageGroup(targets, it), sizeGroup(targets, it));
          if (it.type === 'shape') root.append(shapeGroup(targets, it), sizeGroup(targets, it));
          if (it.type === 'sticker') {
            root.append(group('Sticker', row('Emoji', (() => { const i = h('input', { type: 'text', class: 'text-input', value: it.glyph, maxlength: 8 }); i.addEventListener('input', () => { if (i.value) { it.glyph = i.value; E.refresh(it); } }); i.addEventListener('change', () => E.commit()); return i; })())), sizeGroup(targets, it));
          }
          if (it.type === 'deco') root.append(sizeGroup(targets, it));
          if (it.type === 'todo') {
            root.append(group('Checklist', row('Paper', swatchRow(NB.STICKY_COLORS, it.color, (c) => mutate(targets, (i) => (i.color = c)))), row('Font', fontSelect(it.font, (v) => mutate(targets, (i) => (i.font = v)))), row('Size', ...range(it.size || 20, 12, 40, 1, (v) => targets.forEach((i) => { i.size = v; E.refresh(i, true); }), () => E.commit(), 'px')), row('', btn('Uncheck all', () => mutate(targets, (i) => i.items.forEach((r) => (r.d = false)))), btn('Remove done', () => mutate(targets, (i) => (i.items = i.items.filter((r) => !r.d) || [])))) ), sizeGroup(targets, it));
          }
        }
      }
      root.scrollTop = keepScroll;
    },

    /** cheap refresh used while dragging handles */
    live() {
      const sel = E.selection();
      if (sel.length !== 1) return;
      NB.$$('#inspector-body input.num').forEach(() => {});
    },
  };

  /* ---------- crop dialog ---------- */
  NB.openCrop = async function (it) {
    const src = NB.assetSrc(it);
    if (!src) return;
    let nat;
    try {
      const im = await NB.loadImage(src);
      nat = { w: im.naturalWidth, h: im.naturalHeight };
    } catch (e) { return NB.toast('Cannot crop this image'); }
    let c = Object.assign({ x: 0, y: 0, w: 1, h: 1 }, it.crop);
    let ratio = null; // pixel aspect, null = free
    const img = h('img', { src, class: 'crop-img', draggable: false });
    const rect = h('div', { class: 'crop-rect' }, ['nw', 'ne', 'sw', 'se'].map((d) => h('div', { class: 'crop-h ' + d, 'data-d': d })));
    const wrap = h('div', { class: 'crop-wrap' }, img, rect);
    const paint = () => {
      rect.style.left = c.x * 100 + '%';
      rect.style.top = c.y * 100 + '%';
      rect.style.width = c.w * 100 + '%';
      rect.style.height = c.h * 100 + '%';
    };
    const K = () => nat.w / nat.h; // fractions: pxW/pxH = (w*nat.w)/(h*nat.h)
    function fit(r) {
      ratio = r;
      if (!r) return;
      let w = 1, hh = (w * nat.w) / (r * nat.h);
      if (hh > 1) { hh = 1; w = (hh * r * nat.h) / nat.w; }
      const cx = clamp(c.x + c.w / 2, w / 2, 1 - w / 2), cy = clamp(c.y + c.h / 2, hh / 2, 1 - hh / 2);
      c = { x: cx - w / 2, y: cy - hh / 2, w, h: hh };
      paint();
    }
    wrap.addEventListener('pointerdown', (e) => {
      const d = e.target.dataset.d || (e.target === rect ? 'move' : null);
      if (!d) return;
      e.preventDefault();
      const box = img.getBoundingClientRect();
      const o = Object.assign({}, c), sx = e.clientX, sy = e.clientY;
      const mv = (ev) => {
        const dx = (ev.clientX - sx) / box.width, dy = (ev.clientY - sy) / box.height;
        if (d === 'move') {
          c.x = clamp(o.x + dx, 0, 1 - o.w);
          c.y = clamp(o.y + dy, 0, 1 - o.h);
        } else {
          let l = o.x, t = o.y, r = o.x + o.w, b = o.y + o.h;
          if (d.includes('w')) l = clamp(o.x + dx, 0, r - 0.05);
          if (d.includes('e')) r = clamp(o.x + o.w + dx, l + 0.05, 1);
          if (d.includes('n')) t = clamp(o.y + dy, 0, b - 0.05);
          if (d.includes('s')) b = clamp(o.y + o.h + dy, t + 0.05, 1);
          if (ratio) {
            let w = r - l, hh = (w * nat.w) / (ratio * nat.h);
            const maxH = d.includes('n') ? b : 1 - t;
            if (hh > maxH) { hh = maxH; w = (hh * ratio * nat.h) / nat.w; }
            if (d.includes('w')) l = r - w; else r = l + w;
            if (d.includes('n')) t = b - hh; else b = t + hh;
          }
          c = { x: l, y: t, w: r - l, h: b - t };
        }
        paint();
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    paint();
    const ratios = [['Free', null], ['Original', K()], ['1 : 1', 1], ['4 : 3', 4 / 3], ['3 : 2', 3 / 2], ['16 : 9', 16 / 9], ['3 : 4', 3 / 4], ['9 : 16', 9 / 16]];
    const bar = h('div', { class: 'crop-bar' }, ratios.map(([l, r]) => h('button', { class: 'chip', onClick: () => fit(r) }, l)), h('button', { class: 'chip', onClick: () => { c = { x: 0, y: 0, w: 1, h: 1 }; ratio = null; paint(); } }, 'Reset'));
    NB.modal({
      title: 'Crop image', wide: true, body: h('div', null, bar, wrap),
      buttons: [{ label: 'Cancel' }, {
        label: 'Apply crop', primary: true, fn: () => {
          it.crop = c;
          const padX = (it.frame === 'polaroid' ? 20 : 0) + 2 * (it.bw || 0);
          const padY = (it.frame === 'polaroid' ? 48 : 0) + 2 * (it.bw || 0);
          const asp = (c.w * nat.w) / (c.h * nat.h);
          it.h = Math.round((it.w - padX) / asp + padY);
          E.refresh(it); E.commit();
        },
      }],
    });
  };
})();

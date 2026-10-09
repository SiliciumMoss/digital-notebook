/* Cozy Notebook – page items: rendering of every object type */
(function () {
  const NB = window.NB;
  const { h, uid } = NB;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const AUTO_H = new Set(['text', 'sticky', 'todo']);

  /* ---------------- decorations ---------------- */
  const clipSvg = (c1, c2) =>
    `<svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs><path d="M12 64 V24 a10 10 0 0 1 20 0 V78 a14 14 0 0 1 -28 0 V34" fill="none" stroke="url(#g)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const pinSvg = (c) =>
    `<svg viewBox="0 0 40 64"><ellipse cx="21" cy="60" rx="5" ry="2" fill="rgba(0,0,0,.25)"/><path d="M20 30 L20 60" stroke="#8d8d8d" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="18" r="15" fill="${c}"/><circle cx="20" cy="18" r="15" fill="url(#pg)" /><circle cx="14" cy="12" r="5" fill="#fff" opacity=".45"/><defs><radialGradient id="pg" cx=".65" cy=".7"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs></svg>`;
  const binderSvg = (c) =>
    `<svg viewBox="0 0 60 76"><path d="M13 34 C6 14 18 3 30 3 C42 3 54 14 47 34" fill="none" stroke="#b9bcc2" stroke-width="4.5" stroke-linecap="round"/><path d="M6 32 H54 L47 72 H13 Z" fill="${c}"/><path d="M6 32 H54 L52 44 H8 Z" fill="#fff" opacity=".12"/></svg>`;
  const ribbonSvg = (c) =>
    `<svg viewBox="0 0 30 100" preserveAspectRatio="none"><path d="M2 0 H28 V100 L15 84 L2 100 Z" fill="${c}"/><path d="M2 0 H28 V100 L15 84 L2 100 Z" fill="url(#rg)"/><defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs></svg>`;
  const heartClip = (c) =>
    `<svg viewBox="0 0 40 100"><path d="M12 64 V24 a10 10 0 0 1 20 0 V78 a14 14 0 0 1 -28 0 V34" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><path d="M20 62 c-9 -6 -12 -11 -9 -15 c3 -3 7 -1 9 2 c2 -3 6 -5 9 -2 c3 4 0 9 -9 15z" fill="${c}" transform="translate(0 6)"/></svg>`;

  const TAPES = {
    'tape-yellow': 'rgba(255,224,110,.82)',
    'tape-pink': 'rgba(255,170,195,.82)',
    'tape-blue': 'rgba(150,200,245,.82)',
    'tape-green': 'rgba(170,220,160,.82)',
    'tape-kraft': 'rgba(206,170,120,.85)',
    'tape-stripe': 'repeating-linear-gradient(45deg, rgba(255,255,255,.6) 0 7px, rgba(238,110,140,.8) 7px 14px)',
    'tape-dots': 'radial-gradient(circle, rgba(255,255,255,.85) 2.2px, transparent 3px) 0 0/13px 13px, rgba(120,170,230,.82)',
    'tape-check': 'linear-gradient(90deg, rgba(255,255,255,.4) 50%, transparent 50%) 0 0/20px 20px, linear-gradient(rgba(255,255,255,.4) 50%, transparent 50%) 0 0/20px 20px, rgba(244,150,100,.82)',
    'tape-wave': 'repeating-linear-gradient(90deg, rgba(120,190,170,.85) 0 10px, rgba(250,250,240,.85) 10px 20px)',
  };

  const LABELS = {
    'label-todo': ['TO DO', '#e5484d', '#fff'],
    'label-idea': ['IDEA 💡', '#f5c518', '#3b3000'],
    'label-important': ['IMPORTANT', '#7c5cff', '#fff'],
    'label-done': ['DONE ✔', '#7ab648', '#fff'],
    'label-note': ['NOTE', '#3b82f6', '#fff'],
    'label-wish': ['WISH LIST', '#e879a9', '#fff'],
  };

  NB.DECOS = {
    clips: [
      ['clip-silver', 'Paperclip', clipSvg('#8c9097', '#e4e6ea'), 34, 84],
      ['clip-gold', 'Gold clip', clipSvg('#b8892b', '#f3d27a'), 34, 84],
      ['clip-red', 'Red clip', clipSvg('#b3262c', '#f08a8d'), 34, 84],
      ['clip-blue', 'Blue clip', clipSvg('#2559a8', '#8fb6ee'), 34, 84],
      ['clip-green', 'Green clip', clipSvg('#2f7d3a', '#9ad9a2'), 34, 84],
      ['clip-pink', 'Pink clip', clipSvg('#c2457e', '#f5a8c9'), 34, 84],
      ['clip-heart', 'Heart clip', heartClip('#d9456b'), 34, 84],
      ['binder-black', 'Binder clip', binderSvg('#2a2a2e'), 56, 70],
      ['binder-red', 'Red binder clip', binderSvg('#c0392b'), 56, 70],
      ['binder-teal', 'Teal binder clip', binderSvg('#2a9d8f'), 56, 70],
      ['pin-red', 'Red pin', pinSvg('#e5484d'), 36, 56],
      ['pin-blue', 'Blue pin', pinSvg('#3b82f6'), 36, 56],
      ['pin-yellow', 'Yellow pin', pinSvg('#f5c518'), 36, 56],
      ['pin-green', 'Green pin', pinSvg('#4caf50'), 36, 56],
      ['ribbon-red', 'Bookmark', ribbonSvg('#c0392b'), 34, 120],
      ['ribbon-teal', 'Bookmark', ribbonSvg('#2a9d8f'), 34, 120],
      ['ribbon-gold', 'Bookmark', ribbonSvg('#d9a441'), 34, 120],
    ],
    tapes: Object.keys(TAPES).map((k) => [k, k.replace('tape-', 'Washi ')]),
    labels: Object.keys(LABELS).map((k) => [k, LABELS[k][0]]),
  };
  const DECO_INDEX = {};
  NB.DECOS.clips.forEach((d) => (DECO_INDEX[d[0]] = { svg: d[2], w: d[3], h: d[4] }));

  NB.decoSize = (kind) => {
    if (DECO_INDEX[kind]) return [DECO_INDEX[kind].w, DECO_INDEX[kind].h];
    if (TAPES[kind]) return [140, 34];
    return [130, 38];
  };

  function fillDeco(el, it) {
    el.innerHTML = '';
    const k = it.kind;
    if (DECO_INDEX[k]) {
      const wrap = h('div', { class: 'deco-svg' });
      wrap.innerHTML = DECO_INDEX[k].svg;
      el.appendChild(wrap);
    } else if (TAPES[k]) {
      el.appendChild(h('div', { class: 'deco-tape', style: { background: TAPES[k] } }));
    } else if (LABELS[k]) {
      const [txt, bg, fg] = LABELS[k];
      el.appendChild(h('div', { class: 'deco-label', style: { background: bg, color: fg } }, txt));
    }
  }

  /* ---------------- shapes ---------------- */
  NB.SHAPES = [
    ['rect', 'Rectangle'], ['round', 'Rounded'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['diamond', 'Diamond'],
    ['star', 'Star'], ['heart', 'Heart'], ['bubble', 'Speech bubble'], ['line', 'Line'], ['arrow', 'Arrow'],
  ];

  function shapeSvg(it) {
    const w = Math.max(4, it.w), hh = Math.max(4, it.h);
    const sw = it.sw == null ? 3 : it.sw;
    const p = sw / 2 + 1;
    const fill = it.fill || 'none';
    const stroke = sw > 0 ? it.stroke || '#2b2a33' : 'none';
    const dash = it.dash ? `stroke-dasharray="${sw * 2.5} ${sw * 2}"` : '';
    const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} stroke-linejoin="round" stroke-linecap="round"`;
    let body = '';
    const sx = (x) => p + (x / 100) * (w - 2 * p);
    const sy = (y) => p + (y / 100) * (hh - 2 * p);
    const poly = (pts) => `<polygon points="${pts.map(([x, y]) => sx(x) + ',' + sy(y)).join(' ')}" ${attrs}/>`;
    switch (it.kind) {
      case 'rect': body = `<rect x="${p}" y="${p}" width="${w - 2 * p}" height="${hh - 2 * p}" ${attrs}/>`; break;
      case 'round': body = `<rect x="${p}" y="${p}" width="${w - 2 * p}" height="${hh - 2 * p}" rx="${Math.min(22, hh / 3)}" ${attrs}/>`; break;
      case 'ellipse': body = `<ellipse cx="${w / 2}" cy="${hh / 2}" rx="${w / 2 - p}" ry="${hh / 2 - p}" ${attrs}/>`; break;
      case 'triangle': body = poly([[50, 0], [100, 100], [0, 100]]); break;
      case 'diamond': body = poly([[50, 0], [100, 50], [50, 100], [0, 50]]); break;
      case 'star': body = poly([[50, 2], [62, 36], [98, 37], [69, 59], [80, 94], [50, 73], [20, 94], [31, 59], [2, 37], [38, 36]]); break;
      case 'heart': {
        const m = (x, y) => `${sx(x)} ${sy(y)}`;
        body = `<path d="M${m(50, 92)} C${m(8, 62)} ${m(0, 30)} ${m(24, 14)} C${m(40, 5)} ${m(50, 20)} ${m(50, 28)} C${m(50, 20)} ${m(60, 5)} ${m(76, 14)} C${m(100, 30)} ${m(92, 62)} ${m(50, 92)}Z" ${attrs}/>`;
        break;
      }
      case 'bubble': {
        const m = (x, y) => `${sx(x)} ${sy(y)}`;
        body = `<path d="M${m(10, 4)} H${sx(90)} Q${sx(100)} ${sy(4)} ${sx(100)} ${sy(14)} V${sy(58)} Q${sx(100)} ${sy(68)} ${sx(90)} ${sy(68)} H${sx(44)} L${sx(24)} ${sy(96)} L${sx(26)} ${sy(68)} H${sx(10)} Q${sx(0)} ${sy(68)} ${sx(0)} ${sy(58)} V${sy(14)} Q${sx(0)} ${sy(4)} ${sx(10)} ${sy(4)}Z" ${attrs}/>`;
        break;
      }
      case 'line': body = `<line x1="${p}" y1="${hh / 2}" x2="${w - p}" y2="${hh / 2}" ${attrs} fill="none"/>`; break;
      case 'arrow': {
        const hs = Math.min(hh / 2 - 1, Math.max(10, sw * 4));
        body = `<line x1="${p}" y1="${hh / 2}" x2="${w - p - 2}" y2="${hh / 2}" ${attrs} fill="none"/><polyline points="${w - p - hs},${hh / 2 - hs * 0.7} ${w - p},${hh / 2} ${w - p - hs},${hh / 2 + hs * 0.7}" ${attrs} fill="none"/>`;
        break;
      }
      default: body = '';
    }
    return `<svg xmlns="${SVGNS}" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">${body}</svg>`;
  }

  function fillShape(el, it) {
    let svg = el.querySelector('.shape-svg');
    if (!svg) {
      el.innerHTML = '';
      svg = h('div', { class: 'shape-svg' });
      el.appendChild(svg);
      if (it.kind !== 'line' && it.kind !== 'arrow') {
        el.appendChild(h('div', { class: 'shape-label editable', spellcheck: 'false' }));
      }
    }
    svg.innerHTML = shapeSvg(it);
    if (it.shadow) svg.style.filter = 'drop-shadow(2px 4px 4px rgba(0,0,0,.25))';
    else svg.style.filter = '';
    const lab = el.querySelector('.shape-label');
    if (lab) {
      lab.style.fontFamily = it.font || '';
      lab.style.fontSize = (it.size || 20) + 'px';
      lab.style.color = it.textColor || '';
      if (lab.dataset.set !== '1' || el.dataset.relabel === '1') {
        lab.textContent = it.label || '';
        lab.dataset.set = '1';
        el.dataset.relabel = '';
      }
    }
  }

  /* ---------------- images ---------------- */
  function filterStr(f) {
    if (!f) return '';
    const parts = [];
    if (f.brightness != null && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
    if (f.contrast != null && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
    if (f.saturate != null && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
    if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
    if (f.blur) parts.push(`blur(${f.blur}px)`);
    if (f.gray) parts.push(`grayscale(${f.gray}%)`);
    if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
    if (f.invert) parts.push(`invert(${f.invert}%)`);
    return parts.join(' ');
  }
  NB.filterStr = filterStr;

  function fillImage(el, it) {
    el.innerHTML = '';
    const c = it.crop || { x: 0, y: 0, w: 1, h: 1 };
    const frame = h('div', { class: 'img-frame frame-' + (it.frame || 'none') });
    const clip = h('div', { class: 'img-clip' });
    const src = NB.assetSrc(it);
    const img = h('img', { src, draggable: false, alt: it.alt || '' });
    img.style.width = (100 / c.w) + '%';
    img.style.height = (100 / c.h) + '%';
    img.style.left = (-c.x / c.w * 100) + '%';
    img.style.top = (-c.y / c.h * 100) + '%';
    img.style.filter = filterStr(it.f);
    clip.style.transform = `scale(${it.flipX ? -1 : 1}, ${it.flipY ? -1 : 1})`;
    const radius = (it.radius || 0) + '%';
    frame.style.borderRadius = it.frame === 'polaroid' ? '3px' : radius;
    clip.style.borderRadius = it.frame === 'polaroid' ? '1px' : radius;
    if (it.bw) {
      frame.style.border = `${it.bw}px solid ${it.bc || '#ffffff'}`;
    }
    if (it.shadow !== false) frame.classList.add('shadowed');
    clip.appendChild(img);
    frame.appendChild(clip);
    if (it.frame === 'polaroid') frame.appendChild(h('div', { class: 'polaroid-cap' }, it.caption || ''));
    if (it.frame === 'tape') {
      frame.appendChild(h('div', { class: 'corner-tape tl' }));
      frame.appendChild(h('div', { class: 'corner-tape br' }));
    }
    el.appendChild(frame);
  }

  /* ---------------- todo ---------------- */
  function fillTodo(el, it, api) {
    el.innerHTML = '';
    const card = h('div', { class: 'todo-card' });
    card.style.background = it.color || '#fff';
    card.style.fontFamily = it.font || '';
    card.style.fontSize = (it.size || 20) + 'px';
    if (it.textColor) card.style.color = it.textColor;
    const title = h('input', {
      class: 'todo-title',
      value: it.title || '',
      placeholder: 'Checklist',
      onInput: (e) => { it.title = e.target.value; api.changed(true); },
      onChange: () => api.commit(),
    });
    card.appendChild(title);
    const list = h('div', { class: 'todo-list' });
    const redraw = () => fillTodo(el, it, api);
    (it.items = it.items || []).forEach((row, i) => {
      const box = h('input', {
        type: 'checkbox',
        checked: !!row.d,
        onChange: (e) => { row.d = e.target.checked; api.changed(); api.commit(); redraw(); },
      });
      const txt = h('input', {
        type: 'text',
        class: 'todo-text' + (row.d ? ' done' : ''),
        value: row.t,
        onInput: (e) => { row.t = e.target.value; api.changed(true); },
        onChange: () => api.commit(),
        onKeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            it.items.splice(i + 1, 0, { t: '', d: false });
            api.changed();
            redraw();
            const inputs = el.querySelectorAll('.todo-text');
            inputs[i + 1] && inputs[i + 1].focus();
          } else if (e.key === 'Backspace' && !row.t && it.items.length > 1) {
            e.preventDefault();
            it.items.splice(i, 1);
            api.changed();
            api.commit();
            redraw();
            const inputs = el.querySelectorAll('.todo-text');
            inputs[Math.max(0, i - 1)] && inputs[Math.max(0, i - 1)].focus();
          }
        },
      });
      list.appendChild(h('label', { class: 'todo-row' }, box, txt));
    });
    card.appendChild(list);
    const done = it.items.filter((r) => r.d).length;
    card.appendChild(
      h(
        'div',
        { class: 'todo-foot' },
        h('button', { class: 'todo-add', onClick: () => { it.items.push({ t: '', d: false }); api.changed(); api.commit(); redraw(); const ins = el.querySelectorAll('.todo-text'); ins[ins.length - 1].focus(); } }, '+ Add item'),
        h('span', { class: 'todo-prog' }, it.items.length ? `${done}/${it.items.length}` : '')
      )
    );
    el.appendChild(card);
  }

  /* ---------------- text & sticky ---------------- */
  function fillText(el, it) {
    let c = el.querySelector('.editable');
    if (!c) {
      el.innerHTML = '';
      if (it.type === 'sticky') {
        el.appendChild(h('div', { class: 'sticky-deco' }));
      }
      c = h('div', { class: 'editable rich', spellcheck: 'true' });
      c.innerHTML = NB.sanitize(it.html || '');
      el.appendChild(c);
    }
    c.style.fontFamily = it.font || '';
    c.style.fontSize = (it.size || 20) + 'px';
    c.style.textAlign = it.align || 'left';
    c.style.color = it.textColor || it.color_ || '';
    if (it.type === 'sticky') {
      el.style.setProperty('--sticky', it.color || '#fff2a8');
      el.dataset.style = it.style || 'curl';
      c.style.color = it.textColor || '#3a3326';
    } else {
      el.style.background = it.bg || 'transparent';
      el.classList.toggle('boxed', !!it.border);
      if (it.textColor) c.style.color = it.textColor;
      else c.style.color = '';
    }
  }

  function fillSticker(el, it) {
    el.innerHTML = '';
    el.appendChild(h('div', { class: 'sticker-glyph' }, it.glyph || '⭐'));
    const g = el.firstChild;
    g.style.fontSize = Math.max(8, Math.min(it.w, it.h) * 0.82) + 'px';
  }

  /* ---------------- public: build / update ---------------- */
  NB.items = {
    AUTO_H,

    build(it, api) {
      const el = h('div', { class: 'item item-' + it.type, 'data-id': it.id });
      this.fill(el, it, api);
      this.applyGeom(el, it);
      return el;
    },

    /** (Re)build the inner content. */
    fill(el, it, api) {
      switch (it.type) {
        case 'text':
        case 'sticky': fillText(el, it); break;
        case 'image': fillImage(el, it); break;
        case 'shape': fillShape(el, it); break;
        case 'sticker': fillSticker(el, it); break;
        case 'deco': fillDeco(el, it); break;
        case 'todo': fillTodo(el, it, api); break;
        default: break;
      }
      el.classList.toggle('locked', !!it.locked);
    },

    applyGeom(el, it) {
      el.style.left = it.x + 'px';
      el.style.top = it.y + 'px';
      el.style.width = it.w + 'px';
      if (AUTO_H.has(it.type)) {
        el.style.minHeight = it.h + 'px';
        el.style.height = 'auto';
      } else {
        el.style.height = it.h + 'px';
      }
      el.style.transform = it.rot ? `rotate(${it.rot}deg)` : '';
      el.style.opacity = it.opacity == null ? '' : it.opacity;
      if (it.type === 'sticker') {
        const g = el.firstChild;
        if (g) g.style.fontSize = Math.max(8, Math.min(it.w, it.h) * 0.82) + 'px';
      } else if (it.type === 'shape') {
        fillShape(el, it);
      }
    },
  };

  /* ---------------- item factory ---------------- */
  NB.makeItem = function (type, props = {}) {
    const S = NB.state.settings;
    const base = { id: uid('i'), type, x: 100, y: 120, w: 200, h: 100, rot: 0 };
    let d = {};
    switch (type) {
      case 'text': d = { w: 320, h: 56, html: '', font: S.textFont, size: S.textSize, textColor: '', align: 'left', bg: '', border: false }; break;
      case 'sticky': d = { w: 190, h: 170, rot: Math.round(NB.rand(-3, 3) * 10) / 10, color: NB.STICKY_COLORS[Math.floor(NB.rand(0, 6))], html: '', font: NB.FONTS[0].css, size: 26, textColor: '', style: 'curl' }; break;
      case 'image': d = { w: 320, h: 240, asset: null, crop: { x: 0, y: 0, w: 1, h: 1 }, f: { brightness: 100, contrast: 100, saturate: 100 }, frame: 'none', radius: 0, shadow: true }; break;
      case 'shape': d = { kind: 'rect', w: 200, h: 120, fill: '', stroke: '#2b2a33', sw: 3, dash: false, label: '', font: S.textFont, size: 20, textColor: '' }; break;
      case 'sticker': d = { glyph: '⭐', w: 90, h: 90 }; break;
      case 'deco': d = { kind: 'clip-silver', w: 34, h: 84 }; break;
      case 'todo': d = { w: 280, h: 140, color: '#ffffff', font: S.textFont, size: S.textSize, textColor: '', title: '', items: [{ t: '', d: false }] }; break;
      default: break;
    }
    return Object.assign(base, d, props);
  };
})();

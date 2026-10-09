/* Cozy Notebook – shared helpers */
(function () {
  const NB = (window.NB = window.NB || {});

  NB.uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  NB.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  NB.$ = (s, r = document) => r.querySelector(s);
  NB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  NB.clone = (o) => JSON.parse(JSON.stringify(o));
  NB.rand = (a, b) => a + Math.random() * (b - a);

  /** Tiny hyperscript helper */
  NB.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const sk of Object.keys(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }
        }
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (kid) => {
      if (kid == null || kid === false) return;
      if (Array.isArray(kid)) kid.forEach(add);
      else el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    };
    kids.forEach(add);
    return el;
  };
  const h = NB.h;

  NB.debounce = (fn, ms) => {
    let t;
    const d = (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
    d.flush = (...a) => {
      clearTimeout(t);
      fn(...a);
    };
    d.cancel = () => clearTimeout(t);
    return d;
  };

  NB.luminance = (hex) => {
    if (!hex || hex[0] !== '#') return 1;
    let c = hex.slice(1);
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };

  /* ---------- HTML sanitizer for rich text ---------- */
  const OK_TAGS = new Set(['B', 'I', 'U', 'S', 'STRIKE', 'STRONG', 'EM', 'FONT', 'SPAN', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'SUB', 'SUP', 'MARK', 'CODE', 'BLOCKQUOTE']);
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TEMPLATE', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS']);
  const OK_CSS = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-align'];

  function cleanNode(src, dst) {
    for (const n of Array.from(src.childNodes)) {
      if (n.nodeType === 3) {
        dst.appendChild(document.createTextNode(n.nodeValue));
      } else if (n.nodeType === 1) {
        const tag = n.tagName.toUpperCase();
        if (DROP_TAGS.has(tag)) continue;
        if (!OK_TAGS.has(tag)) {
          cleanNode(n, dst);
          continue;
        }
        const el = document.createElement(tag.toLowerCase());
        if (tag === 'A') {
          const href = n.getAttribute('href') || '';
          if (/^(https?:|mailto:)/i.test(href)) {
            el.setAttribute('href', href);
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }
        if (tag === 'FONT') {
          ['color', 'face', 'size'].forEach((a) => {
            const v = n.getAttribute(a);
            if (v && /^[\w#\s,'"-]+$/.test(v)) el.setAttribute(a, v);
          });
        }
        let css = '';
        for (const p of OK_CSS) {
          const v = n.style && n.style.getPropertyValue(p);
          if (v && !/url\(|expression|javascript|[<>]/i.test(v)) css += p + ':' + v + ';';
        }
        if (css) el.setAttribute('style', css);
        cleanNode(n, el);
        dst.appendChild(el);
      }
    }
  }

  NB.sanitize = function (html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    const box = document.createElement('div');
    cleanNode(doc.body, box);
    return box.innerHTML;
  };

  NB.htmlToText = function (html) {
    if (!html) return '';
    const d = document.createElement('div');
    d.innerHTML = NB.sanitize(html).replace(/<(br|\/div|\/p|\/li)>/gi, '$&\n');
    return d.textContent.replace(/ /g, ' ');
  };

  NB.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Toast ---------- */
  let toastTimer;
  NB.toast = function (msg, ms = 2200) {
    let t = NB.$('#toast');
    if (!t) {
      t = h('div', { id: 'toast', role: 'status' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };

  /* ---------- Popover menu ---------- */
  let openMenu = null;
  NB.closeMenu = function () {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escClose, true);
    }
  };
  function outside(e) {
    if (openMenu && !openMenu.contains(e.target)) NB.closeMenu();
  }
  function escClose(e) {
    if (e.key === 'Escape') NB.closeMenu();
  }
  /** Show a floating element near (x,y) or an anchor element */
  NB.popover = function (content, where, cls = '') {
    NB.closeMenu();
    const pop = h('div', { class: 'popover ' + cls }, content);
    document.body.appendChild(pop);
    openMenu = pop;
    let x, y;
    if (where instanceof Element) {
      const r = where.getBoundingClientRect();
      x = r.right + 6;
      y = r.top;
      if (cls.includes('below')) {
        x = r.left;
        y = r.bottom + 6;
      }
    } else {
      x = where.x;
      y = where.y;
    }
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    if (x + pw > innerWidth - 8) x = Math.max(8, (where instanceof Element ? where.getBoundingClientRect().left - pw - 6 : innerWidth - pw - 8));
    if (y + ph > innerHeight - 8) y = Math.max(8, innerHeight - ph - 8);
    pop.style.left = Math.max(8, x) + 'px';
    pop.style.top = Math.max(8, y) + 'px';
    setTimeout(() => {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', escClose, true);
    });
    return pop;
  };

  /** items: [{label, icon, fn, danger, sep, disabled}] */
  NB.menu = function (items, where) {
    const box = h(
      'div',
      { class: 'menu' },
      items.map((it) => {
        if (it.sep) return h('div', { class: 'menu-sep' });
        if (it.header) return h('div', { class: 'menu-head' }, it.header);
        return h(
          'button',
          {
            class: 'menu-item' + (it.danger ? ' danger' : ''),
            disabled: !!it.disabled,
            onClick: () => {
              NB.closeMenu();
              it.fn && it.fn();
            },
          },
          h('span', { class: 'mi-icon' }, it.icon || ''),
          h('span', null, it.label)
        );
      })
    );
    return NB.popover(box, where);
  };

  /* ---------- Colour picker ---------- */
  NB.PALETTE = ['#2b2a33', '#6b6b6b', '#a8a29e', '#ffffff', '#e5484d', '#f97316', '#f5c518', '#7ab648', '#2a9d8f', '#3b82f6', '#7c5cff', '#e879a9', '#8b5e3c', '#d9a066', '#14532d', '#1e3a8a'];
  NB.STICKY_COLORS = ['#fff2a8', '#ffd6a5', '#ffc2d1', '#d7f0c2', '#bfe6ff', '#e2d4ff', '#ffffff', '#c9f0e6', '#ffe0f0', '#f1e3c6'];
  NB.PAGE_COLORS = ['#fffaf0', '#ffffff', '#fff7cc', '#f3efe6', '#e9f3ea', '#e8f0fb', '#fbeaf0', '#f0ecff', '#2d2b36', '#1c2430'];

  NB.colorPicker = function (anchor, current, onPick, opts = {}) {
    const colors = opts.colors || NB.PALETTE;
    const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(current || '') ? current : '#000000', class: 'color-custom', title: 'Custom colour' });
    custom.addEventListener('input', () => onPick(custom.value));
    const grid = h(
      'div',
      { class: 'swatch-grid' },
      opts.allowNone ? h('button', { class: 'swatch none', title: 'None', onClick: () => { onPick(''); NB.closeMenu(); } }, '∅') : null,
      colors.map((c) => h('button', { class: 'swatch' + (c.toLowerCase() === (current || '').toLowerCase() ? ' on' : ''), style: { background: c }, title: c, onClick: () => { onPick(c); NB.closeMenu(); } })),
      custom
    );
    return NB.popover(grid, anchor, 'below colorpop');
  };

  /* ---------- Modal dialogs ---------- */
  NB.modal = function ({ title, body, buttons, wide, cls = '', onClose }) {
    const close = () => {
      back.remove();
      document.removeEventListener('keydown', key, true);
      onClose && onClose();
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const card = h(
      'div',
      { class: 'modal ' + (wide ? 'wide ' : '') + cls, role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'icon-btn', title: 'Close', onClick: close }, '✕')),
      h('div', { class: 'modal-body' }, body),
      buttons && buttons.length
        ? h(
            'div',
            { class: 'modal-foot' },
            buttons.map((b) =>
              h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onClick: () => { const r = b.fn ? b.fn() : undefined; if (r !== false) close(); } }, b.label)
            )
          )
        : null
    );
    const back = h('div', { class: 'modal-back', onPointerdown: (e) => { if (e.target === back) close(); } }, card);
    document.body.appendChild(back);
    document.addEventListener('keydown', key, true);
    const first = card.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, card };
  };

  NB.ask = function (title, value = '', placeholder = '') {
    return new Promise((resolve) => {
      let done = false;
      const input = h('input', { type: 'text', class: 'text-input', value, placeholder });
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      const m = NB.modal({
        title,
        body: input,
        buttons: [
          { label: 'Cancel', fn: () => finish(null) },
          { label: 'OK', primary: true, fn: () => finish(input.value.trim()) },
        ],
        onClose: () => finish(null),
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          finish(input.value.trim());
          m.close();
        }
      });
      setTimeout(() => input.select(), 40);
    });
  };

  NB.confirm = function (msg, okLabel = 'Delete') {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      NB.modal({
        title: 'Are you sure?',
        body: h('p', null, msg),
        buttons: [
          { label: 'Cancel', fn: () => finish(false) },
          { label: okLabel, danger: true, primary: true, fn: () => finish(true) },
        ],
        onClose: () => finish(false),
      });
    });
  };

  /* ---------- Files ---------- */
  NB.downloadFile = function (name, data, type = 'application/json') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  NB.pickFile = function (accept, multiple = false) {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
      input.addEventListener('change', () => {
        resolve(Array.from(input.files));
        input.remove();
      });
      input.addEventListener('cancel', () => { resolve([]); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  };

  NB.readAsDataURL = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });

  NB.loadImage = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Image failed to load'));
      img.src = src;
    });

  /** Load an image file, downscale if huge, return {data, w, h} */
  NB.processImageFile = async function (file, maxDim = 2000) {
    const raw = await NB.readAsDataURL(file);
    const img = await NB.loadImage(raw);
    const w = img.naturalWidth || 400, h2 = img.naturalHeight || 300;
    const keep = /image\/(gif|svg)/.test(file.type) && raw.length < 3e6;
    if (keep) return { data: raw, w, h: h2 };
    const k = Math.min(1, maxDim / Math.max(w, h2));
    if (k === 1 && raw.length < 1.2e6) return { data: raw, w, h: h2 };
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h2 * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const png = /image\/(png|webp)/.test(file.type);
    return { data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w: c.width, h: c.height };
  };

  NB.formatDate = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
})();

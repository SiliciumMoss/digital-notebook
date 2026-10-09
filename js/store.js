/* Cozy Notebook – data model + persistence */
(function () {
  const NB = window.NB;
  const { uid } = NB;

  NB.FONTS = [
    { name: 'Handwriting', css: "'Caveat', 'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive" },
    { name: 'Neat print', css: "'Patrick Hand', 'Segoe Print', 'Chalkboard SE', 'Comic Sans MS', cursive" },
    { name: 'Sans', css: "'Nunito', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { name: 'Serif', css: "'Lora', Georgia, 'Times New Roman', serif" },
    { name: 'Typewriter', css: "'Special Elite', 'Courier New', monospace" },
    { name: 'Marker', css: "'Permanent Marker', 'Marker Felt', 'Comic Sans MS', cursive" },
    { name: 'Script', css: "'Dancing Script', 'Brush Script MT', cursive" },
    { name: 'Mono', css: "ui-monospace, 'SF Mono', Consolas, monospace" },
  ];

  NB.DEFAULT_SETTINGS = {
    theme: 'cozy',
    pageWidth: 560,
    pageHeight: 760,
    defaultPaper: 'lined',
    defaultPageColor: '#fffaf0',
    textFont: NB.FONTS[1].css,
    textSize: 20,
    snap: false,
    grid: 20,
    penOnly: false,
    pressure: true,
    smoothing: true,
    holdStraight: true,
    showDate: true,
    autoExtend: false,
    showRings: true,
    inspectorOpen: true,
  };

  NB.state = null; // {version, settings, notebooks, ui:{nb,sec,page}}
  NB.assets = {}; // assetId -> dataURL
  NB.saveStatus = 'saved';

  /* ---------------- storage with fallback ---------------- */
  const DB_NAME = 'cozy-notebook';
  let dbp = null;
  let useLocal = false;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) {
        return reject(e);
      }
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('assets');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    return dbp;
  }

  async function idb(store, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(out && out.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }

  async function idbAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const s = tx.objectStore(store);
      const keys = s.getAllKeys();
      const vals = s.getAll();
      tx.oncomplete = () => resolve(keys.result.map((k, i) => [k, vals.result[i]]));
      tx.onerror = () => reject(tx.error);
    });
  }

  const LS = {
    get: (k) => { try { const v = localStorage.getItem('cozy:' + k); return v ? JSON.parse(v) : undefined; } catch (e) { return undefined; } },
    put: (k, v) => localStorage.setItem('cozy:' + k, JSON.stringify(v)),
    del: (k) => localStorage.removeItem('cozy:' + k),
    keys: (prefix) => Object.keys(localStorage).filter((k) => k.startsWith('cozy:' + prefix)).map((k) => k.slice(5)),
  };

  const N = window.native;
  const nativeStorage = N && {
    async getState() { const t = await N.getState(); return t ? JSON.parse(t) : undefined; },
    putState: (st) => N.putState(JSON.stringify(st)),
    allAssets: () => N.allAssets(),
    putAsset: (id, d) => N.putAsset(id, d),
    delAsset: (id) => N.delAsset(id),
    clearAll: () => N.clearAll(),
  };

  NB.storage = nativeStorage || {
    async getState() {
      if (!useLocal) {
        try { return await idb('kv', 'readonly', (s) => s.get('state')); } catch (e) { useLocal = true; }
      }
      return LS.get('state');
    },
    async putState(st) {
      if (!useLocal) {
        try { return await idb('kv', 'readwrite', (s) => s.put(st, 'state')); } catch (e) { useLocal = true; }
      }
      LS.put('state', st);
    },
    async allAssets() {
      if (!useLocal) {
        try { return await idbAll('assets'); } catch (e) { useLocal = true; }
      }
      return LS.keys('asset:').map((k) => [k.slice(6), LS.get(k)]);
    },
    async putAsset(id, data) {
      if (!useLocal) {
        try { return await idb('assets', 'readwrite', (s) => s.put(data, id)); } catch (e) { useLocal = true; }
      }
      LS.put('asset:' + id, data);
    },
    async delAsset(id) {
      if (!useLocal) {
        try { return await idb('assets', 'readwrite', (s) => s.delete(id)); } catch (e) { useLocal = true; }
      }
      LS.del('asset:' + id);
    },
    async clearAll() {
      try { await idb('kv', 'readwrite', (s) => s.clear()); await idb('assets', 'readwrite', (s) => s.clear()); } catch (e) { /* ignore */ }
      Object.keys(localStorage).filter((k) => k.startsWith('cozy:')).forEach((k) => localStorage.removeItem(k));
    },
  };

  /* ---------------- constructors ---------------- */
  NB.SECTION_COLORS = ['#e07a5f', '#f2a65a', '#e9c46a', '#81b29a', '#4a9d9c', '#6c9bd1', '#8e7dbe', '#d98cb3', '#a67c52', '#7d8597'];

  NB.newPage = function (opts = {}) {
    const S = NB.state ? NB.state.settings : NB.DEFAULT_SETTINGS;
    return Object.assign(
      { id: uid('p'), title: '', paper: S.defaultPaper, color: S.defaultPageColor, created: Date.now(), updated: Date.now(), h: S.pageHeight || 760, items: [], strokes: [] },
      opts
    );
  };

  NB.newSection = function (name, color) {
    return { id: uid('s'), name, color: color || NB.SECTION_COLORS[Math.floor(Math.random() * NB.SECTION_COLORS.length)], pages: [], board: NB.newPage({ paper: 'cork', color: '#c8975f', title: name }), last: null };
  };

  NB.newNotebook = function (o = {}) {
    return Object.assign(
      { id: uid('n'), name: 'Untitled notebook', emoji: '📓', cover: '#8c5a3c', texture: 'leather', binder: 'rings3', sections: [], created: Date.now() },
      o
    );
  };

  /* ---------------- persistence ---------------- */
  let saveTimer = null;
  const statusEls = () => NB.$$('.save-state');
  function setStatus(s) {
    NB.saveStatus = s;
    statusEls().forEach((el) => {
      el.dataset.state = s;
      el.textContent = s === 'saved' ? '✓ Saved' : s === 'saving' ? '… Saving' : s === 'error' ? '⚠ Not saved' : '● Unsaved';
    });
  }
  NB.setStatus = setStatus;

  NB.markDirty = function () {
    setStatus('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(NB.saveNow, 500);
  };

  NB.saveNow = async function () {
    clearTimeout(saveTimer);
    if (!NB.state) return;
    setStatus('saving');
    try {
      await NB.storage.putState(NB.clone(NB.state));
      setStatus('saved');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  NB.addAsset = async function (data) {
    const id = uid('a');
    NB.assets[id] = data;
    try { await NB.storage.putAsset(id, data); } catch (e) { NB.toast('Could not store image – storage full?'); }
    return id;
  };

  NB.assetSrc = (it) => (it.asset ? NB.assets[it.asset] || '' : it.url || '');

  /** every asset id referenced by the library */
  NB.usedAssets = function (st = NB.state) {
    const used = new Set();
    for (const nb of st.notebooks)
      for (const sec of nb.sections)
        for (const pg of [sec.board, ...sec.pages])
          for (const it of pg.items) if (it.asset) used.add(it.asset);
    return used;
  };

  /* ---------------- load ---------------- */
  NB.load = async function () {
    let st;
    try { st = await NB.storage.getState(); } catch (e) { st = null; }
    try {
      const all = await NB.storage.allAssets();
      all.forEach(([k, v]) => (NB.assets[k] = v));
    } catch (e) { /* ignore */ }
    if (!st || !st.notebooks) {
      st = { version: 2, settings: NB.clone(NB.DEFAULT_SETTINGS), notebooks: [], ui: {} };
      NB.state = st;
      NB.makeStarter();
    } else {
      st.settings = Object.assign({}, NB.DEFAULT_SETTINGS, st.settings || {});
      st.ui = st.ui || {};
      NB.state = st;
      if ((st.version || 1) < 2) NB.migrateV2(st);
    }
    // drop orphaned images
    const used = NB.usedAssets();
    for (const id of Object.keys(NB.assets)) if (!used.has(id)) { delete NB.assets[id]; NB.storage.delAsset(id); }
    return st;
  };

  /** v1 had one tall scrolling page (820 wide); v2 is a fixed-size two-page spread. */
  NB.fit = function (items, kx = 0.56, ky = 0.66, fs = 0.8) {
    items.forEach((it) => {
      const square = it.type === 'sticker' || it.type === 'deco' || it.type === 'image';
      it.x = Math.round(36 + it.x * kx);
      it.y = Math.round(22 + it.y * ky);
      if (it.type !== 'deco') { it.w = Math.round(it.w * kx); it.h = Math.round(it.h * (square ? kx : ky)); }
      if (it.size) it.size = Math.max(12, Math.round(it.size * fs));
    });
    return items;
  };

  NB.migrateV2 = function (st) {
    st.version = 2;
    st.settings.pageWidth = 560;
    st.settings.pageHeight = 760;
    st.settings.autoExtend = false;
    for (const nb of st.notebooks)
      for (const sec of nb.sections)
        for (const pg of [sec.board, ...sec.pages]) {
          if (pg.migrated) continue;
          NB.fit(pg.items);
          pg.strokes.forEach((s) => s.pts.forEach((p) => { p[0] = Math.round((36 + p[0] * 0.56) * 10) / 10; p[1] = Math.round((22 + p[1] * 0.66) * 10) / 10; }));
          pg.h = 760;
          pg.migrated = true;
        }
    st.ui.spread = 0;
    delete st.ui.page;
  };

  /* ---------------- lookups ---------------- */
  NB.findNotebook = (id) => NB.state.notebooks.find((n) => n.id === id);
  NB.currentNotebook = () => NB.findNotebook(NB.state.ui.nb);
  NB.currentSection = () => {
    const nb = NB.currentNotebook();
    return nb && (nb.sections.find((s) => s.id === NB.state.ui.sec) || nb.sections[0]);
  };
  /** The ordered leaves of a section: its pin-board, then its pages. A spread shows two of them. */
  NB.leaves = (sec) => [sec.board, ...sec.pages];
  NB.currentPage = () => (NB.editor && NB.editor.page()) || null;

  /* ---------------- import / export ---------------- */
  NB.exportData = function (notebookIds) {
    const nbs = NB.state.notebooks.filter((n) => !notebookIds || notebookIds.includes(n.id));
    const sub = { notebooks: nbs };
    const used = NB.usedAssets(sub);
    const assets = {};
    used.forEach((id) => { if (NB.assets[id]) assets[id] = NB.assets[id]; });
    return JSON.stringify({ app: 'cozy-notebook', version: 1, exported: new Date().toISOString(), notebooks: nbs, assets });
  };

  NB.importData = async function (text) {
    const data = JSON.parse(text);
    if (data.app !== 'cozy-notebook' || !Array.isArray(data.notebooks)) throw new Error('Not a Cozy Notebook backup file');
    const remap = {};
    for (const [oldId, d] of Object.entries(data.assets || {})) {
      if (typeof d !== 'string' || !d.startsWith('data:image/')) continue;
      remap[oldId] = await NB.addAsset(d);
    }
    let count = 0;
    for (const nb of data.notebooks) {
      nb.id = uid('n');
      nb.sections = (nb.sections || []).map((s) => {
        s.id = uid('s');
        s.pages = s.pages || [];
        s.board = s.board || NB.newPage({ paper: 'cork', color: '#c8975f' });
        for (const pg of [s.board, ...s.pages]) {
          pg.items = (pg.items || []).filter((it) => it && typeof it === 'object');
          pg.strokes = pg.strokes || [];
          for (const it of pg.items) {
            if (it.asset) it.asset = remap[it.asset] || null;
            if (it.html) it.html = NB.sanitize(it.html);
          }
        }
        s.pages.forEach((p) => (p.id = uid('p')));
        s.board.id = uid('p');
        s.last = null;
        return s;
      });
      NB.state.notebooks.push(nb);
      count++;
    }
    NB.markDirty();
    return count;
  };

  /* ---------------- starter content ---------------- */
  NB.makeStarter = function () {
    const nb = NB.newNotebook({ name: 'My Cozy Notebook', emoji: '🌿', cover: '#5f7f5b', texture: 'linen', binder: 'rings3' });
    const home = NB.newSection('Welcome', '#e07a5f');
    const ideas = NB.newSection('Ideas', '#e9c46a');
    const life = NB.newSection('Daily life', '#6c9bd1');
    nb.sections.push(home, ideas, life);

    const welcome = NB.newPage({ title: 'Welcome to your notebook ☕', paper: 'lined' });
    welcome.items = NB.starterItems();
    home.pages.push(welcome);
    ideas.pages.push(NB.newPage({ title: 'Brainstorm', paper: 'dots' }));
    life.pages.push(NB.newPage({ title: 'This week', paper: 'grid' }));

    const board = home.board;
    const st = (o) => Object.assign({ id: uid('i'), type: 'sticky', font: NB.FONTS[0].css, size: 22, textColor: '' }, o);
    board.items = [
      st({ x: 44, y: 96, w: 190, h: 150, rot: -3, color: '#fff2a8', html: 'Section boards are for the <b>big picture</b> – pin sticky notes here!', style: 'pin' }),
      st({ x: 270, y: 120, w: 190, h: 140, rot: 2.5, color: '#ffc2d1', html: 'Goals for this section 🎯', style: 'tape' }),
      st({ x: 70, y: 300, w: 180, h: 130, rot: -1.5, color: '#bfe6ff', html: 'Drag, resize and rotate me', style: 'curl' }),
    ];
    NB.state.notebooks.push(nb);
    NB.state.ui = { nb: nb.id, sec: home.id, spread: 0, view: 'shelf' };
  };

  /** Welcome page, laid out directly for a 560 x 760 page. */
  NB.starterItems = function () {
    const F = NB.FONTS;
    const mk = (o) => Object.assign({ id: uid('i'), rot: 0 }, o);
    return [
      mk({ type: 'text', x: 60, y: 92, w: 440, h: 100, html: 'Hello! 👋 This is a <b>movable text box</b>.<br>Double-click to type, drag its edge to move it, use the handles to resize and the round one to rotate.', font: F[1].css, size: 18, textColor: '', align: 'left', bg: '', border: false }),
      mk({ type: 'todo', x: 60, y: 232, w: 250, h: 176, color: '#ffffff', font: F[1].css, size: 17, title: 'Try these', items: [{ t: 'Add a picture 🖼', d: false }, { t: 'Draw with a pen ✒️', d: false }, { t: 'Stick on a sticker 📎', d: false }, { t: 'Turn the page ▶', d: false }] }),
      mk({ type: 'deco', kind: 'clip-red', x: 250, y: 212, w: 30, h: 74, rot: 10 }),
      mk({ type: 'sticky', x: 340, y: 232, w: 150, h: 128, rot: 3, color: '#fff2a8', html: 'Sticky notes work on pages <i>and</i> on section boards ✨', font: F[0].css, size: 21, textColor: '', style: 'curl' }),
      mk({ type: 'deco', kind: 'tape-stripe', x: 352, y: 222, w: 100, h: 26, rot: -6 }),
      mk({ type: 'sticker', glyph: '🌿', x: 350, y: 392, w: 72, h: 72, rot: -8 }),
      mk({ type: 'sticker', glyph: '☕', x: 426, y: 402, w: 66, h: 66, rot: 6 }),
      mk({ type: 'shape', kind: 'round', x: 60, y: 450, w: 270, h: 72, fill: '#e9f3ea', stroke: '#5f7f5b', sw: 3, dash: true, label: 'Shapes can hold text too', font: F[1].css, size: 18, textColor: '#2f4a2c' }),
    ];
  };
})();

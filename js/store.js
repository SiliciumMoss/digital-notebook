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
    pageWidth: 820,
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
    autoExtend: true,
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
      { id: uid('p'), title: '', paper: S.defaultPaper, color: S.defaultPageColor, created: Date.now(), updated: Date.now(), h: 1100, items: [], strokes: [] },
      opts
    );
  };

  NB.newSection = function (name, color) {
    return { id: uid('s'), name, color: color || NB.SECTION_COLORS[Math.floor(Math.random() * NB.SECTION_COLORS.length)], pages: [], board: NB.newPage({ paper: 'cork', color: '#c8975f', title: name, h: 900 }), last: null };
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
      st = { version: 1, settings: NB.clone(NB.DEFAULT_SETTINGS), notebooks: [], ui: {} };
      NB.state = st;
      NB.makeStarter();
    } else {
      st.settings = Object.assign({}, NB.DEFAULT_SETTINGS, st.settings || {});
      st.ui = st.ui || {};
      NB.state = st;
    }
    // drop orphaned images
    const used = NB.usedAssets();
    for (const id of Object.keys(NB.assets)) if (!used.has(id)) { delete NB.assets[id]; NB.storage.delAsset(id); }
    return st;
  };

  /* ---------------- lookups ---------------- */
  NB.findNotebook = (id) => NB.state.notebooks.find((n) => n.id === id);
  NB.currentNotebook = () => NB.findNotebook(NB.state.ui.nb);
  NB.currentSection = () => {
    const nb = NB.currentNotebook();
    return nb && (nb.sections.find((s) => s.id === NB.state.ui.sec) || nb.sections[0]);
  };
  NB.currentPage = () => {
    const sec = NB.currentSection();
    if (!sec) return null;
    if (NB.state.ui.page === 'board') return sec.board;
    return sec.pages.find((p) => p.id === NB.state.ui.page) || null;
  };

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
    board.items = [
      { id: uid('i'), type: 'sticky', x: 70, y: 90, w: 210, h: 170, rot: -3, color: '#fff2a8', html: 'Section boards are for the <b>big picture</b> – pin sticky notes here!', font: NB.FONTS[0].css, size: 26, textColor: '', style: 'pin' },
      { id: uid('i'), type: 'sticky', x: 330, y: 150, w: 200, h: 160, rot: 2.5, color: '#ffc2d1', html: 'Goals for this section 🎯', font: NB.FONTS[0].css, size: 26, textColor: '', style: 'tape' },
      { id: uid('i'), type: 'sticky', x: 580, y: 80, w: 190, h: 160, rot: -1.5, color: '#bfe6ff', html: 'Drag, resize and rotate me', font: NB.FONTS[0].css, size: 26, textColor: '', style: 'curl' },
    ];
    NB.state.notebooks.push(nb);
    NB.state.ui = { nb: nb.id, sec: home.id, page: welcome.id, view: 'shelf' };
  };

  NB.starterItems = function () {
    const F = NB.FONTS;
    const mk = (o) => Object.assign({ id: uid('i'), rot: 0 }, o);
    return [
      mk({ type: 'text', x: 90, y: 120, w: 520, h: 140, html: 'Hello! 👋 This is a <b>movable text box</b>.<br>Click it twice to edit, drag it by its edge, resize it with the handles, rotate it with the round handle.', font: F[1].css, size: 22, color: '', align: 'left', bg: '', border: false }),
      mk({ type: 'sticky', x: 620, y: 110, w: 170, h: 150, rot: 3, color: '#fff2a8', html: 'Sticky notes work on pages <i>and</i> on section boards ✨', font: F[0].css, size: 25, textColor: '', style: 'curl' }),
      mk({ type: 'todo', x: 90, y: 320, w: 300, h: 150, color: '#ffffff', font: F[1].css, size: 20, title: 'Try these', items: [{ t: 'Add an image (🖼 tool)', d: false }, { t: 'Draw with a pen or tablet ✒️', d: false }, { t: 'Decorate with stickers & clips 📎', d: false }, { t: 'Make a new notebook', d: false }] }),
      mk({ type: 'deco', kind: 'clip-red', x: 300, y: 296, w: 34, h: 80, rot: 12 }),
      mk({ type: 'sticker', glyph: '🌿', x: 440, y: 330, w: 90, h: 90, rot: -8 }),
      mk({ type: 'sticker', glyph: '☕', x: 540, y: 350, w: 90, h: 90, rot: 6 }),
      mk({ type: 'deco', kind: 'tape-stripe', x: 600, y: 90, w: 120, h: 32, rot: -6 }),
      mk({ type: 'shape', kind: 'round', x: 90, y: 640, w: 400, h: 90, fill: '#e9f3ea', stroke: '#5f7f5b', sw: 3, dash: true, label: 'Shapes can hold text too', font: F[1].css, size: 22, textColor: '#2f4a2c' }),
    ];
  };
})();

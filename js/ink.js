/* Cozy Notebook – vector ink layer (pen / pencil / highlighter / eraser / lasso) with pressure support */
(function () {
  const NB = window.NB;
  const SVGNS = 'http://www.w3.org/2000/svg';

  NB.tool = {
    name: 'select',
    pen: { color: '#2b2a33', size: 3 },
    pencil: { color: '#4b4b55', size: 2 },
    hl: { color: '#ffe14d', size: 18 },
    eraser: { size: 22 },
  };
  NB.INK_TOOLS = ['pen', 'pencil', 'hl', 'eraser', 'lasso'];

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const x = a[0] + t * dx, y = a[1] + t * dy;
    return Math.hypot(px - x, py - y);
  }

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function strokeBounds(s) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of s.pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    const pad = s.size;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  class Ink {
    /**
     * opts: {canvas, overlay, page: ()=>page, scale: ()=>number, scroller: ()=>Element,
     *        isDark: ()=>bool, onChange: ()=>void, onExtend: (y)=>void}
     */
    constructor(opts) {
      this.o = opts;
      this.canvas = opts.canvas;
      this.overlay = opts.overlay;
      this.ctx = this.canvas.getContext('2d');
      this.sel = new Set();
      this.cur = null; // active interaction
      this.dpr = 1;
      this._bind();
      this._buildOverlay();
      this.resize();
    }

    get page() { return this.o.page(); }
    get S() { return NB.state.settings; }

    _buildOverlay() {
      const o = this.overlay;
      o.innerHTML = '';
      this.lassoPath = document.createElementNS(SVGNS, 'polyline');
      this.lassoPath.setAttribute('class', 'lasso-path');
      this.selRect = document.createElementNS(SVGNS, 'rect');
      this.selRect.setAttribute('class', 'lasso-sel');
      this.selRect.style.display = 'none';
      this.eCur = document.createElementNS(SVGNS, 'circle');
      this.eCur.setAttribute('class', 'eraser-cursor');
      this.eCur.style.display = 'none';
      o.append(this.selRect, this.lassoPath, this.eCur);
    }

    /** Fit the canvas to the page size and device resolution */
    resize() {
      const W = this.S.pageWidth, H = this.page.h;
      const want = Math.min(3, (window.devicePixelRatio || 1) * Math.max(1, this.o.scale()));
      this.dpr = Math.min(want, Math.sqrt(2.2e7 / (W * H)));
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
      this.canvas.width = Math.round(W * this.dpr);
      this.canvas.height = Math.round(H * this.dpr);
      this.overlay.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this.overlay.style.width = W + 'px';
      this.overlay.style.height = H + 'px';
      this.redraw();
    }

    updateTool() {
      const t = NB.tool.name;
      const active = NB.INK_TOOLS.includes(t);
      this.canvas.classList.toggle('active', active);
      this.canvas.dataset.tool = t;
      this.eCur.style.display = 'none';
      if (!active) this.clearSelection();
      else if (t !== 'lasso') this.clearSelection();
    }

    /* ---------------- drawing ---------------- */
    redraw() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const s of this.page.strokes) this.drawStroke(s);
    }

    _width(s, p) {
      if (s.tool === 'hl' || !this.S.pressure) return s.size;
      return s.size * (0.35 + 1.3 * (p == null ? 0.5 : p));
    }

    drawStroke(s) {
      const ctx = this.ctx, pts = s.pts, n = pts.length;
      if (!n) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle = s.color;
      if (s.tool === 'hl') {
        ctx.globalAlpha = 0.38;
        if (!this.o.isDark()) ctx.globalCompositeOperation = 'multiply';
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        if (n === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
        for (let i = 1; i < n - 1; i++) {
          const m = mid(pts[i], pts[i + 1]);
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
        }
        if (n > 1) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
        ctx.stroke();
      } else {
        if (s.tool === 'pencil') {
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 0.7;
        }
        if (n === 1) {
          ctx.beginPath();
          ctx.arc(pts[0][0], pts[0][1], this._width(s, pts[0][2]) / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (n === 2) {
          ctx.lineWidth = this._width(s, pts[1][2]);
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          ctx.lineTo(pts[1][0], pts[1][1]);
          ctx.stroke();
        } else {
          this._seg(s, -1);
          for (let i = 1; i < n - 1; i++) this._seg(s, i);
          this._seg(s, n - 1);
        }
      }
      ctx.restore();
    }

    /** i = -1 first half-segment, i = n-1 last half-segment, else curve around point i */
    _seg(s, i) {
      const ctx = this.ctx, pts = s.pts, n = pts.length;
      ctx.lineWidth = this._width(s, pts[Math.max(0, i)][2]);
      ctx.beginPath();
      if (i === -1) {
        const m = mid(pts[0], pts[1]);
        ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(m[0], m[1]);
      } else if (i === n - 1) {
        const m = mid(pts[n - 2], pts[n - 1]);
        ctx.lineWidth = this._width(s, pts[n - 1][2]);
        ctx.moveTo(m[0], m[1]);
        ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
      } else {
        const a = mid(pts[i - 1], pts[i]), b = mid(pts[i], pts[i + 1]);
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], b[0], b[1]);
      }
      ctx.stroke();
    }

    _liveDraw(s) {
      if (s.tool === 'hl') return this.redraw();
      const n = s.pts.length;
      const ctx = this.ctx;
      ctx.save();
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle = s.color;
      if (s.tool === 'pencil') { ctx.shadowColor = s.color; ctx.shadowBlur = 0.7; }
      if (n === 1) {
        ctx.beginPath();
        ctx.arc(s.pts[0][0], s.pts[0][1], this._width(s, s.pts[0][2]) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (n === 2) {
        ctx.lineWidth = this._width(s, s.pts[1][2]);
        ctx.beginPath();
        ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        ctx.lineTo(s.pts[1][0], s.pts[1][1]);
        ctx.stroke();
      } else {
        if (n === 3) this._seg(s, -1);
        this._seg(s, n - 2);
      }
      ctx.restore();
    }

    /* ---------------- input ---------------- */
    _pt(e) {
      const r = this.canvas.getBoundingClientRect();
      const k = this.canvas.clientWidth / r.width;
      return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this._down(e));
      c.addEventListener('pointermove', (e) => this._move(e));
      c.addEventListener('pointerup', (e) => this._up(e));
      c.addEventListener('pointercancel', (e) => this._up(e));
      c.addEventListener('pointerleave', () => (this.eCur.style.display = 'none'));
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _toolFor(e) {
      let t = NB.tool.name;
      if (e.pointerType === 'pen' && (e.buttons & 32 || e.button === 5)) t = 'eraser';
      return t;
    }

    _down(e) {
      if (this.cur) return;
      if (e.button > 0 && e.pointerType !== 'pen') return;
      if (e.pointerType === 'touch' && this.S.penOnly) {
        const sc = this.o.scroller();
        this.cur = { mode: 'scroll', id: e.pointerId, x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop, sc };
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      e.preventDefault();
      const tool = this._toolFor(e);
      const pt = this._pt(e);
      this.canvas.setPointerCapture(e.pointerId);
      NB.closeMenu();
      if (tool === 'eraser') {
        this.cur = { mode: 'erase', id: e.pointerId, hit: false };
        this._erase(pt);
      } else if (tool === 'lasso') {
        if (this.sel.size && this._inSel(pt)) {
          const orig = new Map();
          for (const s of this.page.strokes) if (this.sel.has(s.id)) orig.set(s.id, s.pts.map((p) => p.slice()));
          this.cur = { mode: 'move', id: e.pointerId, start: pt, orig };
        } else {
          this.clearSelection();
          this.cur = { mode: 'lasso', id: e.pointerId, path: [pt] };
        }
      } else {
        const T = NB.tool[tool];
        const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
        const s = { id: NB.uid('k'), tool, color: T.color, size: T.size, pts: [[pt[0], pt[1], p]] };
        this.page.strokes.push(s);
        this.cur = { mode: 'draw', id: e.pointerId, s, hold: null, straight: false, last: pt };
        this._liveDraw(s);
      }
    }

    _move(e) {
      const cur = this.cur;
      if (!cur) {
        if (NB.tool.name === 'eraser') this._showEraser(this._pt(e));
        return;
      }
      if (e.pointerId !== cur.id) return;
      if (cur.mode === 'scroll') {
        cur.sc.scrollTop = cur.st - (e.clientY - cur.y);
        cur.sc.scrollLeft = cur.sl - (e.clientX - cur.x);
        return;
      }
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      const list = events.length ? events : [e];
      for (const ev of list) this._moveOne(ev, cur);
      if (cur.mode === 'erase') this._showEraser(this._pt(e));
    }

    _moveOne(e, cur) {
      const pt = this._pt(e);
      if (cur.mode === 'draw') {
        const s = cur.s;
        const raw = pt;
        const last = s.pts[s.pts.length - 1];
        if (cur.straight) {
          s.pts = [s.pts[0], [raw[0], raw[1], 0.5]];
          this.redraw();
          return;
        }
        let x = raw[0], y = raw[1];
        if (this.S.smoothing) {
          x = last[0] + (raw[0] - last[0]) * 0.6;
          y = last[1] + (raw[1] - last[1]) * 0.6;
        }
        if (Math.hypot(x - last[0], y - last[1]) < 0.7) return;
        const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
        s.pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100]);
        if (this.S.autoExtend && y > this.page.h - 80) {
          this.o.onExtend(y);
          this.resize();
        } else this._liveDraw(s);
        if (this.S.holdStraight && s.tool !== 'pencil') {
          clearTimeout(cur.hold);
          cur.hold = setTimeout(() => {
            if (this.cur === cur && s.pts.length > 3) {
              cur.straight = true;
              s.pts = [s.pts[0], s.pts[s.pts.length - 1]];
              this.redraw();
            }
          }, 550);
        }
      } else if (cur.mode === 'erase') {
        this._erase(pt);
      } else if (cur.mode === 'lasso') {
        cur.path.push(pt);
        this.lassoPath.setAttribute('points', cur.path.map((p) => p.join(',')).join(' '));
      } else if (cur.mode === 'move') {
        const dx = pt[0] - cur.start[0], dy = pt[1] - cur.start[1];
        for (const s of this.page.strokes) {
          const o = cur.orig.get(s.id);
          if (o) s.pts = o.map((p) => [p[0] + dx, p[1] + dy, p[2]]);
        }
        this.redraw();
        this._drawSel();
      }
    }

    _up(e) {
      const cur = this.cur;
      if (!cur || e.pointerId !== cur.id) return;
      this.cur = null;
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (cur.mode === 'draw') {
        clearTimeout(cur.hold);
        this.redraw();
        this.o.onChange();
      } else if (cur.mode === 'erase') {
        if (cur.hit) this.o.onChange();
      } else if (cur.mode === 'lasso') {
        this.lassoPath.setAttribute('points', '');
        this._selectInside(cur.path);
      } else if (cur.mode === 'move') {
        this.o.onChange();
      }
    }

    /* ---------------- eraser ---------------- */
    _showEraser(pt) {
      this.eCur.setAttribute('cx', pt[0]);
      this.eCur.setAttribute('cy', pt[1]);
      this.eCur.setAttribute('r', NB.tool.eraser.size / 2);
      this.eCur.style.display = '';
    }

    _erase(pt) {
      const r = NB.tool.eraser.size / 2;
      const strokes = this.page.strokes;
      const keep = strokes.filter((s) => {
        const reach = r + s.size / 2;
        const b = strokeBounds(s);
        if (pt[0] < b.x0 - r || pt[0] > b.x1 + r || pt[1] < b.y0 - r || pt[1] > b.y1 + r) return true;
        if (s.pts.length === 1) return Math.hypot(pt[0] - s.pts[0][0], pt[1] - s.pts[0][1]) > reach;
        for (let i = 1; i < s.pts.length; i++) if (segDist(pt[0], pt[1], s.pts[i - 1], s.pts[i]) <= reach) return false;
        return true;
      });
      if (keep.length !== strokes.length) {
        this.page.strokes = keep;
        if (this.cur) this.cur.hit = true;
        this.redraw();
      }
    }

    /* ---------------- lasso selection ---------------- */
    _selectInside(path) {
      this.sel.clear();
      if (path.length > 3) {
        for (const s of this.page.strokes) {
          const inside = s.pts.filter((p) => inPoly(p[0], p[1], path)).length;
          if (inside >= Math.max(1, s.pts.length * 0.5)) this.sel.add(s.id);
        }
      }
      this._drawSel();
      NB.onInkSelection && NB.onInkSelection(this.sel.size);
    }

    _selBounds() {
      let b = null;
      for (const s of this.page.strokes) {
        if (!this.sel.has(s.id)) continue;
        const sb = strokeBounds(s);
        b = b ? { x0: Math.min(b.x0, sb.x0), y0: Math.min(b.y0, sb.y0), x1: Math.max(b.x1, sb.x1), y1: Math.max(b.y1, sb.y1) } : sb;
      }
      return b;
    }

    _inSel(pt) {
      const b = this._selBounds();
      return !!b && pt[0] >= b.x0 && pt[0] <= b.x1 && pt[1] >= b.y0 && pt[1] <= b.y1;
    }

    _drawSel() {
      const b = this.sel.size ? this._selBounds() : null;
      if (!b) {
        this.selRect.style.display = 'none';
        return;
      }
      this.selRect.style.display = '';
      this.selRect.setAttribute('x', b.x0);
      this.selRect.setAttribute('y', b.y0);
      this.selRect.setAttribute('width', b.x1 - b.x0);
      this.selRect.setAttribute('height', b.y1 - b.y0);
    }

    clearSelection() {
      if (!this.sel.size) return;
      this.sel.clear();
      this._drawSel();
      NB.onInkSelection && NB.onInkSelection(0);
    }

    deleteSelection() {
      if (!this.sel.size) return false;
      this.page.strokes = this.page.strokes.filter((s) => !this.sel.has(s.id));
      this.clearSelection();
      this.redraw();
      this.o.onChange();
      return true;
    }

    recolorSelection(color) {
      if (!this.sel.size) return false;
      for (const s of this.page.strokes) if (this.sel.has(s.id)) s.color = color;
      this.redraw();
      this.o.onChange();
      return true;
    }

    /** Render the strokes to PNG-able canvas for export (page-sized) */
    destroy() {
      this.cur = null;
    }
  }

  NB.Ink = Ink;
})();

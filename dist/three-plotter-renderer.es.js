import { Vector2 as W, WebGLRenderTarget as ht, NearestFilter as Q, MeshNormalMaterial as Xt, MeshDepthMaterial as Yt, RGBADepthPacking as Tt, Vector3 as I, UnsignedByteType as zt, RGBAFormat as qt, ShaderMaterial as At, DoubleSide as Dt, BufferGeometry as Wt, BufferAttribute as xt, Mesh as Bt, Scene as Ht, Raycaster as Rt, Color as Lt, Camera as Vt, Object3D as bt } from "three";
function Nt(i, t, e, n = {}) {
  const {
    resolution: o = 2,
    // Render at 2x for smooth boundaries
    normalBuckets: s = 12,
    // Quantize normals into N directions
    minArea: c = 100,
    // Minimum region area in pixels (at output scale)
    simplifyTolerance: a = 2,
    insetPixels: l = 0
    // Inset boundaries by this many pixels (GPU erosion)
  } = n, h = i.getSize(new W()), r = Math.floor(h.x * o), f = Math.floor(h.y * o), u = Math.round(l * o), d = jt(i, t, e, r, f), g = Jt(i, t, e, r, f), { regionMap: m, normalLookup: b } = Qt(d, r, f), { labels: p, regionCount: x } = _t(m, r, f);
  u > 0 && Kt(m, r, f, u);
  const y = [];
  for (let w = 1; w <= x; w++) {
    const S = Gt(p, r, f, w);
    if (S.length < 3) continue;
    const E = ct(S, a), v = Math.abs(ee(E));
    if (v < c) continue;
    const P = Ut(p, m, b, r, f, w), k = Zt(p, g, r, f, w);
    y.push({
      boundary: E.map((C) => new W(
        C.x / o - h.x / 2,
        C.y / o - h.y / 2
        // Y already flipped during readback
      )),
      normal: P,
      depth: k,
      // 0-1 normalized depth
      area: v / (o * o),
      regionId: w
    });
  }
  return y;
}
function jt(i, t, e, n, o) {
  const s = new ht(n, o, {
    minFilter: Q,
    magFilter: Q
  }), c = new Xt({ flatShading: !0 }), a = /* @__PURE__ */ new Map(), l = [];
  t.traverse((r) => {
    r.isMesh ? (a.set(r, r.material), r.material = c) : (r.isLineSegments || r.isLine || r.isPoints) && r.visible && (l.push(r), r.visible = !1);
  }), i.setRenderTarget(s), i.render(t, e), t.traverse((r) => {
    r.isMesh && a.has(r) && (r.material = a.get(r));
  });
  for (const r of l)
    r.visible = !0;
  i.setRenderTarget(null);
  const h = new Uint8Array(n * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, n, o, h), s.dispose(), c.dispose(), h;
}
function Jt(i, t, e, n, o) {
  const s = new ht(n, o, {
    minFilter: Q,
    magFilter: Q
  }), c = new Yt({ depthPacking: Tt }), a = /* @__PURE__ */ new Map(), l = [];
  t.traverse((r) => {
    r.isMesh ? (a.set(r, r.material), r.material = c) : (r.isLineSegments || r.isLine || r.isPoints) && r.visible && (l.push(r), r.visible = !1);
  }), i.setRenderTarget(s), i.render(t, e), t.traverse((r) => {
    r.isMesh && a.has(r) && (r.material = a.get(r));
  });
  for (const r of l)
    r.visible = !0;
  i.setRenderTarget(null);
  const h = new Uint8Array(n * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, n, o, h), s.dispose(), c.dispose(), h;
}
function Zt(i, t, e, n, o) {
  let s = 0, c = 0;
  for (let a = 0; a < n; a++)
    for (let l = 0; l < e; l++)
      if (i[a * e + l] === o) {
        const h = (a * e + l) * 4, r = t[h] / 255, f = t[h + 1] / 255, u = t[h + 2] / 255, d = t[h + 3] / 255, g = r + f / 256 + u / 65536 + d / 16777216;
        s += g, c++;
      }
  return c > 0 ? s / c : 0.5;
}
function Kt(i, t, e, n) {
  let o = i;
  for (let s = 0; s < n; s++) {
    const c = new Uint16Array(o);
    for (let a = 1; a < e - 1; a++)
      for (let l = 1; l < t - 1; l++) {
        const h = a * t + l;
        if (o[h] === 0) continue;
        const f = o[h - 1], u = o[h + 1], d = o[h - t], g = o[h + t];
        (f === 0 || u === 0 || d === 0 || g === 0) && (c[h] = 0);
      }
    o = c;
  }
  return o;
}
function Qt(i, t, e, n) {
  const o = new Uint16Array(t * e), s = {};
  let c = 1;
  const a = {};
  for (let l = 0; l < t * e; l++) {
    const h = l * 4, r = i[h], f = i[h + 1], u = i[h + 2];
    if (r < 5 && f < 5 && u < 5) {
      o[l] = 0;
      continue;
    }
    const d = r / 255 * 2 - 1, g = f / 255 * 2 - 1, m = u / 255 * 2 - 1, b = 4, p = Math.round(r / b) * b, x = Math.round(f / b) * b, y = Math.round(u / b) * b, w = `${p}|${x}|${y}`;
    a[w] || (a[w] = c, s[c] = new I(d, g, m).normalize(), c++), o[l] = a[w];
  }
  return { regionMap: o, normalLookup: s };
}
function _t(i, t, e) {
  const n = new Uint32Array(t * e), o = [];
  let s = 1;
  function c(r) {
    return o[r] !== r && (o[r] = c(o[r])), o[r];
  }
  function a(r, f) {
    const u = c(r), d = c(f);
    u !== d && (o[d] = u);
  }
  for (let r = 0; r < e; r++)
    for (let f = 0; f < t; f++) {
      const u = r * t + f, d = i[u];
      if (d === 0) continue;
      const g = [];
      if (f > 0 && i[u - 1] === d && n[u - 1] > 0 && g.push(n[u - 1]), r > 0 && i[u - t] === d && n[u - t] > 0 && g.push(n[u - t]), g.length === 0)
        n[u] = s, o[s] = s, s++;
      else {
        const m = Math.min(...g);
        n[u] = m;
        for (const b of g)
          a(m, b);
      }
    }
  const l = {};
  let h = 0;
  for (let r = 0; r < t * e; r++) {
    if (n[r] === 0) continue;
    const f = c(n[r]);
    l[f] === void 0 && (h++, l[f] = h), n[r] = l[f];
  }
  return { labels: n, regionCount: h };
}
function Gt(i, t, e, n) {
  const o = [];
  let s = -1, c = -1;
  t: for (let g = 0; g < e; g++)
    for (let m = 0; m < t; m++)
      if (i[g * t + m] === n && (m === 0 || i[g * t + m - 1] !== n || g === 0 || i[(g - 1) * t + m] !== n)) {
        s = m, c = g;
        break t;
      }
  if (s === -1) return o;
  const a = [1, 1, 0, -1, -1, -1, 0, 1], l = [0, 1, 1, 1, 0, -1, -1, -1];
  let h = s, r = c, f = 7;
  const u = t * e * 2;
  let d = 0;
  do {
    o.push({ x: h, y: r });
    let g = !1;
    for (let m = 0; m < 8; m++) {
      const b = (f + 6 + m) % 8, p = h + a[b], x = r + l[b];
      if (p >= 0 && p < t && x >= 0 && x < e && i[x * t + p] === n) {
        h = p, r = x, f = b, g = !0;
        break;
      }
    }
    if (!g) break;
    d++;
  } while ((h !== s || r !== c) && d < u);
  return o;
}
function Ut(i, t, e, n, o, s) {
  let c = 0, a = 0, l = 0;
  for (let d = 0; d < o; d++)
    for (let g = 0; g < n; g++)
      i[d * n + g] === s && (c += g, a += d, l++);
  if (l === 0) return new I(0, 0, 1);
  const h = Math.round(c / l), f = Math.round(a / l) * n + h, u = t[f];
  return e[u] || new I(0, 0, 1);
}
function ct(i, t) {
  if (i.length < 3) return i;
  let e = 0, n = 0;
  const o = i[0], s = i[i.length - 1];
  for (let c = 1; c < i.length - 1; c++) {
    const a = te(i[c], o, s);
    a > e && (e = a, n = c);
  }
  if (e > t) {
    const c = ct(i.slice(0, n + 1), t), a = ct(i.slice(n), t);
    return c.slice(0, -1).concat(a);
  } else
    return [o, s];
}
function te(i, t, e) {
  const n = e.x - t.x, o = e.y - t.y, s = n * n + o * o;
  if (s < 1e-10)
    return Math.sqrt((i.x - t.x) ** 2 + (i.y - t.y) ** 2);
  let c = ((i.x - t.x) * n + (i.y - t.y) * o) / s;
  c = Math.max(0, Math.min(1, c));
  const a = t.x + c * n, l = t.y + c * o;
  return Math.sqrt((i.x - a) ** 2 + (i.y - l) ** 2);
}
function ee(i) {
  let t = 0;
  for (let e = 0; e < i.length; e++) {
    const n = (e + 1) % i.length;
    t += i[e].x * i[n].y, t -= i[n].x * i[e].y;
  }
  return t / 2;
}
function ne(i, t, e, n) {
  const o = e / 2, s = n / 2, c = new I(0, 1, 0), a = new I(0, 0, 1);
  let l;
  Math.abs(i.y) > 0.9 ? l = a.clone() : (l = new I().crossVectors(c, i).normalize(), l.lengthSq() < 0.01 && (l = a.clone()));
  const h = new I(0, 0, 0), r = l.clone().multiplyScalar(100), f = h.clone().project(t), u = r.clone().project(t), d = new W(
    f.x * o,
    -f.y * s
  ), m = new W(
    u.x * o,
    -u.y * s
  ).clone().sub(d).normalize(), p = l.clone().multiplyScalar(1e5).clone().project(t);
  let x = null;
  return Math.abs(p.x) < 100 && Math.abs(p.y) < 100 && p.z < 1 && (x = new W(
    p.x * o,
    -p.y * s
  )), { direction: m, vanishingPoint: x };
}
function oe(i, t, e = {}) {
  const {
    baseSpacing: n = 8,
    // Base spacing in screen pixels
    minSpacing: o = 3,
    // Minimum spacing
    maxSpacing: s = 20,
    // Maximum spacing
    depthFactor: c = 0.5,
    // How much depth affects density
    screenWidth: a = 1200,
    screenHeight: l = 800,
    axisSettings: h = {}
    // { x: { rotation: 0, spacing: 10 }, y: ... }
  } = e, { boundary: r, normal: f, depth: u = 0.5 } = i;
  if (r.length < 3) return [];
  const d = Math.abs(f.x), g = Math.abs(f.y), m = Math.abs(f.z);
  let b = "y";
  d >= g && d >= m ? b = "x" : m >= g && m >= d && (b = "z");
  const p = h[b] || {}, x = p.rotation || 0, y = p.spacing;
  console.log(`[Hatch] normal=(${f.x.toFixed(2)}, ${f.y.toFixed(2)}, ${f.z.toFixed(2)}) => axis=${b}, rotation=${x}, spacing=${y}`);
  const { direction: w, vanishingPoint: S } = ne(
    f,
    t,
    a,
    l
  );
  let E = w;
  if (x !== 0) {
    const T = x * (Math.PI / 180), B = Math.cos(T), R = Math.sin(T);
    E = new W(
      w.x * B - w.y * R,
      w.x * R + w.y * B
    );
  }
  const v = new W(-E.y, E.x), k = Math.max(o, Math.min(
    s,
    (y !== void 0 ? y : n) + u * c * (s - o)
  ));
  let C = 1 / 0, F = -1 / 0, H = 1 / 0, $ = -1 / 0;
  for (const T of r)
    C = Math.min(C, T.x), F = Math.max(F, T.x), H = Math.min(H, T.y), $ = Math.max($, T.y);
  const z = (C + F) / 2, X = (H + $) / 2, Y = new W(z, X), A = Math.sqrt((F - C) ** 2 + ($ - H) ** 2), q = [];
  if (S && Math.abs(x) < 5 && S.distanceTo(Y) < A * 5) {
    const T = S.distanceTo(Y), B = Math.ceil(A / k) * 2, V = Math.atan2(A, T) * 2 / B, j = Math.atan2(
      X - S.y,
      z - S.x
    );
    for (let J = -B; J <= B; J++) {
      const K = j + J * V, _ = new W(Math.cos(K), Math.sin(K)), et = S.clone(), nt = S.clone().add(_.clone().multiplyScalar(T * 10)), ot = gt({ start: et, end: nt }, r);
      q.push(...ot);
    }
  } else {
    const T = Math.ceil(A / k) + 2;
    for (let B = -T; B <= T; B++) {
      const R = v.clone().multiplyScalar(B * k), V = Y.clone().add(R), j = V.clone().add(E.clone().multiplyScalar(-A)), J = V.clone().add(E.clone().multiplyScalar(A)), K = gt({ start: j, end: J }, r);
      q.push(...K);
    }
  }
  return q;
}
function gt(i, t) {
  const e = [], n = t.length;
  for (let s = 0; s < n; s++) {
    const c = t[s], a = t[(s + 1) % n], l = ce(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      c.x,
      c.y,
      a.x,
      a.y
    );
    l && e.push({
      point: new W(l.x, l.y),
      t: l.t
    });
  }
  if (e.length < 2) return [];
  e.sort((s, c) => s.t - c.t);
  const o = [];
  for (let s = 0; s < e.length - 1; s++) {
    const c = (e[s].point.x + e[s + 1].point.x) / 2, a = (e[s].point.y + e[s + 1].point.y) / 2;
    U(c, a, t) && o.push({
      start: e[s].point,
      end: e[s + 1].point
    });
  }
  return o;
}
function se(i, t) {
  const e = [], n = t.length, o = U(i.start.x, i.start.y, t), s = U(i.end.x, i.end.y, t);
  e.push({ point: i.start.clone(), t: 0, inside: o });
  for (let l = 0; l < n; l++) {
    const h = t[l], r = t[(l + 1) % n], f = ie(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      h.x,
      h.y,
      r.x,
      r.y
    );
    f && f.t > 0 && f.t < 1 && e.push({
      point: new W(f.x, f.y),
      t: f.t,
      inside: null
      // will be determined by neighbors
    });
  }
  e.push({ point: i.end.clone(), t: 1, inside: s }), e.sort((l, h) => l.t - h.t);
  const c = [e[0]];
  for (let l = 1; l < e.length; l++)
    e[l].t - c[c.length - 1].t > 1e-4 && c.push(e[l]);
  if (c.length < 2) return [i];
  const a = [];
  for (let l = 0; l < c.length - 1; l++) {
    const h = (c[l].t + c[l + 1].t) / 2, r = i.start.x + h * (i.end.x - i.start.x), f = i.start.y + h * (i.end.y - i.start.y);
    U(r, f, t) || a.push({
      start: c[l].point.clone(),
      end: c[l + 1].point.clone()
    });
  }
  return a;
}
function ie(i, t, e, n, o, s, c, a) {
  const l = (i - e) * (s - a) - (t - n) * (o - c);
  if (Math.abs(l) < 1e-10) return null;
  const h = ((i - o) * (s - a) - (t - s) * (o - c)) / l, r = -((i - e) * (t - s) - (t - n) * (i - o)) / l;
  return h >= 0 && h <= 1 && r >= 0 && r <= 1 ? {
    x: i + h * (e - i),
    y: t + h * (n - t),
    t: h
  } : null;
}
function ce(i, t, e, n, o, s, c, a) {
  const l = (i - e) * (s - a) - (t - n) * (o - c);
  if (Math.abs(l) < 1e-10) return null;
  const h = ((i - o) * (s - a) - (t - s) * (o - c)) / l, r = -((i - e) * (t - s) - (t - n) * (i - o)) / l;
  return r >= 0 && r <= 1 ? {
    x: i + h * (e - i),
    y: t + h * (n - t),
    t: h
  } : null;
}
function U(i, t, e) {
  let n = !1;
  const o = e.length;
  for (let s = 0, c = o - 1; s < o; c = s++) {
    const a = e[s].x, l = e[s].y, h = e[c].x, r = e[c].y;
    l > t != r > t && i < (h - a) * (t - l) / (r - l) + a && (n = !n);
  }
  return n;
}
const yt = 1e-3;
class O {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(t, e) {
    this.x = t, this.y = e;
  }
  /**
   * @param {Point} pt
   */
  static clone(t) {
    return new O(t.x, t.y);
  }
}
class rt {
  /**
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   */
  constructor(t, e, n, o) {
    this.minX = t, this.minY = e, this.maxX = n, this.maxY = o;
  }
  width() {
    return Math.abs(this.maxX - this.minX);
  }
  height() {
    return Math.abs(this.maxY - this.minY);
  }
}
class re {
  /**
   *
   * @param {number} r radius
   */
  constructor(t = 0) {
    this.r = t;
  }
}
class D {
  /**
   *
   * @param {Point} a start point
   * @param {Point} b end point
   */
  constructor(t, e) {
    this.a = t, this.b = e, this.tags = {};
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static isEqual(t, e) {
    return M.pointsEqual(t.a, e.a) && M.pointsEqual(t.b, e.b) || M.pointsEqual(t.b, e.a) && M.pointsEqual(t.a, e.b);
  }
  /**
   * @param {Segment} seg
   */
  static clone(t) {
    return new D(new O(t.a.x, t.a.y), new O(t.b.x, t.b.y));
  }
}
class ae {
  constructor() {
    this.pivot = { x: 0, y: 0 }, this.rotation = 0, this.isOpen = !0, this.isGroup = !1, this.isStrong = !1, this._makeAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n, o) => {
        const s = { x: n.x, y: n.y };
        M.rotatePoint(s, e), s.x += this.pivot.x, s.y += this.pivot.y, t[o] = s;
      });
    }, this._makeSegsAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n) => {
        const o = { x: n.a.x, y: n.a.y }, s = { x: n.b.x, y: n.b.y };
        M.rotatePoint(o, e), M.rotatePoint(s, e), M.addToPoint(o, this.pivot), M.addToPoint(s, this.pivot), n.a = o, n.b = s;
      });
    };
  }
  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(t = !1) {
    throw "not implemented";
  }
  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(t = !1) {
    throw "not implemented";
  }
  /**
   *
   * @param {boolean} local
   * @returns {BoundingBox}
   */
  getBoundingBox(t = !1) {
    const e = new rt(1e6, 1e6, -1e6, -1e6);
    return this.toPoints(t).forEach((o) => {
      e.minX = Math.min(e.minX, o.x), e.minY = Math.min(e.minY, o.y), e.maxX = Math.max(e.maxX, o.x), e.maxY = Math.max(e.maxY, o.y);
    }), e;
  }
  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const t = new re();
    return this.toPoints(!0).forEach((n) => {
      t.r = Math.max(t.r, Math.sqrt(n.x * n.x + n.y * n.y));
    }), t;
  }
}
class G extends ae {
  /**
   *
   * @param {Segment[]} segments
   */
  constructor(t) {
    super(), this._segments = t;
  }
  /**
   * @param {Segment[]} segs
   */
  add(...t) {
    this._segments = this._segments.concat(t);
  }
  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(t = !1) {
    return this.toSegments(t).reduce((e, n) => n ? e.concat([n.a, n.b]) : e, []);
  }
  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(t = !1) {
    let e = this._segments.reduce((n, o) => o ? n.concat(D.clone(o)) : n, []);
    return t || this._makeSegsAbsolute(e), e;
  }
  bake() {
  }
  result() {
    return G.clone(this);
  }
  /**
   *
   * @param {Segments} segs
   */
  static clone(t) {
    let e = t._segments, n = [], o = e.length;
    for (; o--; )
      n.unshift(D.clone(e[o]));
    let s = new G(n);
    return s.pivot.x = t.pivot.x, s.pivot.y = t.pivot.y, s.rotation = t.rotation, s;
  }
}
class M {
  /**
   *
   * @param {number} a
   * @param {number} b
   * @param {number} d
   * @returns {number}
   */
  static lerp(t, e, n) {
    return (1 - n) * t + n * e;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static angleBetween(t, e) {
    return Math.atan2(e.y - t.y, e.x - t.x);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngle(t, e) {
    let n = M.angleBetween(t.a, t.b), o = M.angleBetween(e.a, e.b);
    return Math.abs(n - o) < yt;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(t, e) {
    let n = M.angleBetween(t.a, t.b), o = M.angleBetween(e.b, e.a);
    return Math.abs(n - o) < yt;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} d
   * @returns {Point}
   */
  static lerpPoints(t, e, n) {
    return {
      x: M.lerp(t.x, e.x, n),
      y: M.lerp(t.y, e.y, n)
    };
  }
  /**
   *
   * @param {Point} pt the point to rotate in place
   * @param {number} deg angle in degrees
   */
  static rotatePointDeg(t, e) {
    M.rotatePoint(t, e * Math.PI / 180);
  }
  /**
   *
   * @param {Point} pt
   * @param {*} rad
   */
  static rotatePoint(t, e) {
    const n = Math.cos(e), o = Math.sin(e), s = t.y, c = t.x;
    t.y = n * s - o * c, t.x = o * s + n * c;
  }
  /**
   *
   * @param {number} rad
   * @param  {...Point} points
   */
  static rotatePoints(t, ...e) {
    e.forEach((n) => {
      M.rotatePoint(n, t);
    });
  }
  /**
   *
   * @param {number} deg
   * @param  {...Point} points
   */
  static rotatePointsDeg(t, ...e) {
    let n = t * Math.PI / 180;
    e.forEach((o) => {
      M.rotatePoint(o, n);
    });
  }
  // Based on http://stackoverflow.com/a/12037737
  static outerTangents(t, e, n, o) {
    var s = n.x - t.x, c = n.y - t.y, a = Math.sqrt(s * s + c * c);
    if (a <= Math.abs(o - e)) return [];
    var l = Math.atan2(c, s), h = Math.acos((e - o) / a);
    return [
      new D(
        {
          x: t.x + e * Math.cos(l + h),
          y: t.y + e * Math.sin(l + h)
        },
        {
          x: n.x + o * Math.cos(l + h),
          y: n.y + o * Math.sin(l + h)
        }
      ),
      new D(
        {
          x: t.x + e * Math.cos(l - h),
          y: t.y + e * Math.sin(l - h)
        },
        {
          x: n.x + o * Math.cos(l - h),
          y: n.y + o * Math.sin(l - h)
        }
      )
    ];
  }
  /**
   *
   * @param {Point} pt
   */
  static cartesian2Polar(t) {
    const e = Math.sqrt(t.x * t.x + t.y * t.y), n = Math.atan2(t.y, t.x);
    t.x = e, t.y = n;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} [scale]
   */
  static pointsEqual(t, e, n = 1) {
    return Math.round(t.x * 1e4 / n) == Math.round(e.x * 1e4 / n) && Math.round(t.y * 1e4 / n) == Math.round(e.y * 1e4 / n);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetween(t, e) {
    const n = e.x - t.x, o = e.y - t.y;
    return Math.sqrt(n * n + o * o);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetweenSquared(t, e) {
    const n = e.x - t.x, o = e.y - t.y;
    return n * n + o * o;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} numSegs
   * @returns {Point[]}
   */
  static interpolatePoints(t, e, n) {
    let o = [{ x: t.x, y: t.y }], s = 1 / n, c = (e.x - t.x) * s, a = (e.y - t.y) * s;
    for (var l = 1; l < n; l++)
      o.push(new O(t.x + c * l, t.y + a * l));
    return o.push({ x: e.x, y: e.y }), o;
  }
  /**
   *
   * @param  {...Point} pts
   */
  static averagePoints(...t) {
    let e = new O(0, 0);
    return t.forEach((n) => {
      e.x += n.x, e.y += n.y;
    }), e.x /= t.length, e.y /= t.length, e;
  }
  /**
   *
   * @param {Point} targetPt the point that will be added to
   * @param {Point} sourcePt the point to add to the target
   */
  static addToPoint(t, e) {
    t.x += e.x, t.y += e.y;
  }
  /**
   *
   * @param {Point} targetPt the point that will be subtracted from
   * @param {Point} sourcePt the point tosubtract from the target
   */
  static subFromPoint(t, e) {
    t.x -= e.x, t.y -= e.y;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} delta
   * @returns {Point[]}
   */
  static subdivideByDistance(t, e, n) {
    if (n === 0)
      return [t, e];
    let o = [{ x: t.x, y: t.y }], s = M.distanceBetween(t, e), c = n / s, a = Math.floor(1 / c), l = s % n;
    n += l / a, c = n / s;
    let h = c, r = 1, f = (e.x - t.x) * c, u = (e.y - t.y) * c;
    for (; h < 1; )
      o.push(new O(t.x + f * r, t.y + u * r)), h += c, r++;
    return o.push({ x: e.x, y: e.y }), o;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @param {number} [scale]
   */
  static segmentsConnected(t, e, n = 1) {
    return M.pointsEqual(t.b, e.a, n) || M.pointsEqual(t.a, e.b, n);
  }
  /**
   *
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentsToPoints(t) {
    let e = t.reduce((o, s) => o.concat(s.a, s.b), []), n = e.length;
    for (; n--; ) {
      let o = e[n];
      n > 0 && M.pointsEqual(o, e[n - 1]) && e.splice(n, 1);
    }
    return e;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {number}
   */
  static polygonArea(t) {
    let e = 0, n = t.length - 1;
    for (var o = 0; o < t.length; o++)
      e += t[o].x * t[n].y, e -= t[n].x * t[o].y, n = o;
    return e / 2;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {BoundingBox}
   */
  static pointsBoundingBox(t) {
    const e = new rt(1e6, 1e6, -1e6, -1e6);
    return t.forEach((n) => {
      e.minX = Math.min(e.minX, n.x), e.minY = Math.min(e.minY, n.y), e.maxX = Math.max(e.maxX, n.x), e.maxY = Math.max(e.maxY, n.y);
    }), e;
  }
  /**
   *
   * @param {BoundingBox[]} bbs
   * @returns {BoundingBox}
   */
  static boundingBoxesBoundingBox(t) {
    const e = new rt(1e6, 1e6, -1e6, -1e6);
    return t.forEach((n) => {
      e.minX = Math.min(e.minX, n.minX), e.minY = Math.min(e.minY, n.minY), e.maxX = Math.max(e.maxX, n.maxX), e.maxY = Math.max(e.maxY, n.maxY);
    }), e;
  }
  /**
   *
   * @param {Segment[]} segs
   * @returns {BoundingBox}
   */
  static segmentsBoundingBox(t) {
    const e = [];
    return t.forEach((n) => {
      e.push(n.a), e.push(n.b);
    }), M.pointsBoundingBox(e);
  }
  /**
   *
   * @param {BoundingBox} ab
   * @param {BoundingBox} bb
   */
  static boundingBoxesIntersect(t, e) {
    return t.maxX >= e.minX && t.maxY >= e.minY && t.minX <= e.maxX && t.minY <= e.maxY;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {boolean}
   */
  static polygonIsClockwise(t) {
    return M.polygonArea(t) > 0;
  }
  /**
   *
   * @param {Point} p1
   * @param {Point} p2
   * @param {Point} p3
   */
  static ccw(t, e, n) {
    return (n.y - t.y) * (e.x - t.x) > (e.y - t.y) * (n.x - t.x);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {boolean}
   */
  static segmentsIntersect(t, e) {
    const n = M.ccw;
    return n(t.a, e.a, e.b) != n(t.b, e.a, e.b) && n(t.a, t.b, e.a) != n(t.a, t.b, e.b);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {Point}
   */
  static segmentSegmentIntersect(t, e, n = !1) {
    const o = t.a.x, s = t.a.y, c = t.b.x, a = t.b.y, l = e.a.x, h = e.a.y, r = e.b.x, f = e.b.y, u = c - o, d = a - s, g = r - l, m = f - h, b = (-d * (o - l) + u * (s - h)) / (-g * d + u * m), p = (g * (s - h) - m * (o - l)) / (-g * d + u * m);
    if (b >= 0 && b <= 1 && p >= 0 && p <= 1) {
      const x = o + p * u, y = s + p * d;
      let w = { x, y };
      return n && (M.pointsEqual(w, e.a) || M.pointsEqual(w, e.b) || M.pointsEqual(w, t.a) || M.pointsEqual(w, t.b)) ? void 0 : w;
    }
    return null;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentSegmentsIntersections(t, e, n = !1) {
    let o = [];
    return e.forEach((s) => {
      if (s == t)
        return;
      let c = M.segmentSegmentIntersect(t, s, n);
      c && o.push(c);
    }), o;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static dot(t, e) {
    return t.x * e.x + t.y * e.y;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static cross(t, e) {
    return t.x * e.y - t.y * e.x;
  }
  /**
   * 
   * @param {Point} pt 
   * @param {Point} ptA 
   * @param {Point} ptB 
   */
  static lineSide(t, e, n) {
    return Math.round(((n.x - e.x) * (t.y - e.y) - (n.y - e.y) * (t.x - e.x)) * 100) / 100;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static sub(t, e) {
    return new O(t.x - e.x, t.y - e.y);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static add(t, e) {
    return new O(t.x + e.x, t.y + e.y);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   * @returns {Point}
   */
  static closestPtPointSegment(t, e) {
    var n = M.sub(e.b, e.a), o = M.sub(t, e.a), s = M.dot(o, n);
    if (s < 0)
      t = e.a;
    else {
      var c = M.dot(n, n);
      s >= c ? t = e.b : (s /= c, o.x = e.a.x + s * n.x, o.y = e.a.y + s * n.y, t = o);
    }
    return O.clone(t);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   */
  static distancePointSegment(t, e) {
    return M.distanceBetween(t, M.closestPtPointSegment(t, e));
  }
  /**
   *
   * @param {*} pt
   * @param {*} boundingBox
   * @returns {boolean}
   */
  static pointWithinBoundingBox(t, e) {
    return t.x >= e.minX && t.y >= e.minY && t.x <= e.maxX && t.y <= e.maxY;
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static pointWithinPolygon(t, e, n) {
    const o = M.segmentsBoundingBox(e);
    if (!this.pointWithinBoundingBox(t, o))
      return !1;
    let s = new O(1e5, 1e5), c = new D(s, t), a = M.segmentSegmentsIntersections(c, e);
    return a.length % 2 != 0 && n && M.pointsEqual(t, a[0]) ? !1 : a.length % 2 != 0;
  }
  /**
   *
   * @param {Segment} seg
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static segmentWithinPolygon(t, e) {
    let n = this.pointWithinPolygon(t.a, e, !1), o = this.pointWithinPolygon(t.b, e, !1), s = this.pointWithinPolygon(t.a, e, !0), c = this.pointWithinPolygon(t.b, e, !0);
    return s && c || s && o || c && n;
  }
  static sign(t, e, n) {
    return (t.x - n.x) * (e.y - n.y) - (e.x - n.x) * (t.y - n.y);
  }
  /**
   *
   * @param {Point} pt
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static pointWithinTriangle(t, e, n, o, s) {
    const c = M.sign(t, e, n), a = M.sign(t, n, o), l = M.sign(t, o, e), h = c < 0 || a < 0 || l < 0, r = c > 0 || a > 0 || l > 0;
    if (!(h && r) && s) {
      let f = { a: e, b: n, tags: null };
      if (M.distancePointSegment(t, f) < 1 || (f.a = n, f.b = o, M.distancePointSegment(t, f) < 1) || (f.a = o, f.b = e, M.distancePointSegment(t, f) < 1)) return !1;
    }
    return !(h && r);
  }
  /**
   *
   * @param {Segment} seg
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static segmentWithinTriangle(t, e, n, o) {
    let s = this.pointWithinTriangle(t.a, e, n, o, !1), c = this.pointWithinTriangle(t.b, e, n, o, !1), a = this.pointWithinTriangle(t.a, e, n, o, !0), l = this.pointWithinTriangle(t.b, e, n, o, !0);
    return M.averagePoints(t.a, t.b), a && l || a && c || l && s || s && c;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {Segment[]}
   */
  static pointsToClosedPolySegments(...t) {
    let e = [];
    for (let n = 0; n < t.length; n++)
      e.push(new D(t[n], n < t.length - 1 ? t[n + 1] : t[0]));
    return e;
  }
  /**
   *
   * @param {Segment[]} polySegsA
   * @param {Segment[]} polySegsB
   * @returns {boolean}
   */
  static polygonWithinPolygon(t, e) {
    const n = M.segmentsBoundingBox(t), o = M.segmentsBoundingBox(e);
    if (!M.boundingBoxesIntersect(n, o))
      return !1;
    new O(o.minX - 100, o.minY - 100);
    for (let s = 0; s < t.length; s++) {
      let c = t[s];
      if (M.segmentSegmentsIntersections(c, e).length % 2 == 0)
        return !1;
    }
    return !0;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {Point} ptC
   * @param {number} iterations
   */
  static splinePoints(t, e, n, o = 0) {
    let s = (a) => {
      let l = [a[0]];
      for (let h = 0; h < a.length - 1; h++) {
        let r = new O(0, 0);
        h + 1 < a.length * 0.4 ? (r.x = (a[h].x * 40 + a[h + 1].x * 60) * 0.01, r.y = (a[h].y * 40 + a[h + 1].y * 60) * 0.01) : h + 1 > a.length * 0.6 ? (r.x = (a[h].x * 60 + a[h + 1].x * 40) * 0.01, r.y = (a[h].y * 60 + a[h + 1].y * 40) * 0.01) : (r.x = (a[h].x + a[h + 1].x) * 0.5, r.y = (a[h].y + a[h + 1].y) * 0.5), l.push(r);
      }
      return l.push(a[a.length - 1]), l;
    }, c = [t, e, n];
    for (let a = 0; a < o; a++)
      c = s(c);
    return c;
  }
}
class Z {
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {{ originalPts: Object.<string, Point>, pts: string[], cxs: Object.<string,string[]> }}
   */
  static getSegsAndConnections(t, e = !1, n = !1) {
    let o = {}, s = [], c = {}, a = (l) => {
      let h = `${Math.round(l.x * 1)}|${Math.round(l.y * 1)}`;
      return c[h] = l, h;
    };
    if (e) {
      let l = t.reduce((f, u) => f.concat(u.a, u.b), []), h = l.length;
      for (; h--; ) {
        let f = l[h], u = h;
        for (; u--; ) {
          let d = l[u];
          if (M.pointsEqual(f, d)) {
            l.splice(h, 1);
            break;
          }
        }
      }
      let r = t.length;
      for (; r--; ) {
        let f = t[r], u = [];
        if (l.forEach((d) => {
          M.distancePointSegment(d, f) < 0.1 && !M.pointsEqual(d, f.a) && !M.pointsEqual(d, f.b) && u.push(d);
        }), u.length) {
          u.sort((m, b) => {
            const p = M.distanceBetweenSquared(m, f.a), x = M.distanceBetweenSquared(b, f.a);
            return p < x ? -1 : p > x ? 1 : 0;
          });
          const d = [];
          let g = f.a;
          for (let m = 0; m < u.length; m++) {
            let b = u[m];
            d.push(new D(g, b)), g = b;
          }
          d.push(new D(g, f.b)), t.splice(r, 1, ...d);
        }
      }
    }
    if (n) {
      let l = t.length;
      for (; l--; ) {
        let h = l, r = !1;
        for (; h--; ) {
          let f = t[l], u = t[h], d = M.segmentSegmentIntersect(f, u, !0);
          d && (r = !0, t.splice(l, 1, new D(O.clone(f.a), O.clone(d)), new D(O.clone(d), O.clone(f.b))), t.splice(h, 1, new D(O.clone(u.a), O.clone(d)), new D(O.clone(d), O.clone(u.b))));
        }
        r && (l = t.length);
      }
    }
    return t.forEach((l) => {
      let h = a(l.a), r = a(l.b);
      o[h] || (o[h] = []), o[r] || (o[r] = []), o[h].indexOf(r) === -1 && o[h].push(r), o[r].indexOf(h) === -1 && o[r].push(h), s.indexOf(h) === -1 && s.push(h), s.indexOf(r) === -1 && s.push(r);
    }), {
      originalPts: c,
      pts: s,
      cxs: o
    };
  }
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {Segment[]}
   */
  static pathOrder(t, e = !1, n = !1) {
    let o = [], { originalPts: s, pts: c, cxs: a } = Z.getSegsAndConnections(t, e, n), l = (r) => s[r], h = (r, f) => a[r].length > a[f].length ? 1 : a[r].length < a[f].length ? -1 : 0;
    for (c.sort(h); c.length; ) {
      c.sort(h);
      let r = c.shift();
      for (; r; )
        if (a[r].length) {
          a[r].sort(h);
          let f = a[r].shift(), u = a[f].indexOf(r);
          u !== -1 && a[f].splice(u, 1), o.push(new D(l(r), l(f))), a[r].length && c.unshift(r), r = f;
        } else
          r = null;
    }
    return o;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} offset
   * @returns {Point[]}
   */
  static getEndingSegmentPoints(t, e = 0) {
    t = t.concat(), t = Z.pathOrder(t, !0, !0);
    let { originalPts: n, pts: o, cxs: s } = Z.getSegsAndConnections(t, !0), c = (h) => n[h];
    const a = o.filter((h) => s[h].length === 1), l = [];
    return a.forEach((h) => {
      const r = O.clone(c(h));
      if (e === 0) {
        l.push(r);
        return;
      }
      const f = c(s[h]), u = M.angleBetween(f, r), d = new O(0, e);
      M.rotatePoint(d, Math.PI * 0.5 - u), M.addToPoint(r, d), l.push(r);
    }), l;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills(t, e = 5) {
    t = t.concat();
    let { originalPts: n, cxs: o } = Z.getSegsAndConnections(t, !0, !0), s = (x) => {
      let y = `${Math.round(x.x * 1)}|${Math.round(x.y * 1)}`;
      return n[y] = x, y;
    }, c = [], a = [], l = 1e5, h = 1e5, r = -1e5, f = -1e5, u = 1e5, d = 1e5, g = [];
    for (let x in n) {
      let y = n[x];
      g.push(y), l = Math.min(l, y.x), h = Math.min(h, y.y), r = Math.max(r, y.x), f = Math.max(f, y.y);
    }
    g.sort((x, y) => x.x < y.x ? -1 : x.x > y.x ? 1 : 0), g.forEach((x, y) => {
      if (y > 0) {
        let w = g[y - 1], S = Math.round(Math.abs(x.x - w.x));
        S > 1 && (u = Math.min(u, S));
      }
    }), g.sort((x, y) => x.y < y.y ? -1 : x.y > y.y ? 1 : 0), g.forEach((x, y) => {
      if (y > 0) {
        let w = g[y - 1], S = Math.round(Math.abs(x.y - w.y));
        S > 1 && (d = Math.min(d, S));
      }
    });
    let m = u * 0.5, b = d * 0.5, p = [];
    for (let x = h; x < f; x += d)
      for (let y = l; y < r; y += u)
        p.push(new O(y + m, x + b));
    return p.forEach((x) => {
      let y = [];
      if (g.forEach((E) => {
        let v = M.distanceBetween(E, x);
        if (v < Math.max(u, d) * e) {
          let P = M.angleBetween(E, x);
          y.push({
            pt: E,
            dist: v,
            ang: P
          });
        }
      }), y.length < 4)
        return;
      let w = y.length;
      for (; w--; ) {
        let E = y[w].pt, v = new D(x, E);
        M.segmentSegmentsIntersections(v, t, !0).length > 0 && y.splice(w, 1);
      }
      for (y.sort((E, v) => E.ang < v.ang ? -1 : E.ang > v.ang ? 1 : 0), w = y.length; w--; ) {
        let E = y[w].pt, v = s(E), P = y.length, k = !1;
        for (; P--; ) {
          if (w === P)
            continue;
          let C = y[P].pt, F = s(C);
          if (o[v].indexOf(F) === -1) {
            k = !0;
            break;
          }
        }
        k || y.splice(w, 1);
      }
      let S = !0;
      if (y.forEach((E, v) => {
        let P = y[(v + 1) % y.length], k = s(E.pt), C = s(P.pt);
        o[k].indexOf(C) === -1 && (S = !1);
      }), S) {
        let E = y.map((k) => k.pt), v = M.averagePoints(...E), P = s(v);
        c.indexOf(P) === -1 && (c.push(P), a.push(E));
      }
    }), a;
  }
}
class tt {
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [noSplit]
   * @param {boolean} [trimSmall]
   * @param {number} [smallDist]
   * @param {boolean} [optimizePathOrder]
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollections(t, e = !1, n = !0, o = 1, s = !1, c = !1, a = !1) {
    let l = t.reduce((h, r) => h.concat(r.toSegments()), []);
    return tt.segments(l, e, n, o, s, c, a);
  }
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollectionsPathOrder(t, e = !1, n = !1) {
    let o = t.reduce((s, c) => s.concat(c.toSegments()), []);
    return new G(Z.pathOrder(o, e, n));
  }
  /**
   *
   * @param {Segment[]} segs
   * @param {boolean} [noSplitColinear]
   * @param {boolean} [trimSmall]
   * @param {number} [smallDist]
   * @param {boolean} [optimizePathOrder]
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segments(t, e = !1, n = !0, o = 1, s = !1, c = !1, a = !1) {
    return t = tt._segments(t, e, n, o), s && (t = Z.pathOrder(t, c, a)), new G(t);
  }
  /**
   * JS fallback for segment optimization  
   * @private
   */
  static _segments(t, e, n, o) {
    const s = t;
    for (t = []; s.length; ) {
      let a = s.shift(), l = t.length, h = !1;
      for (; l--; ) {
        const r = t[l];
        if (D.isEqual(a, r)) {
          h = !0;
          break;
        }
      }
      h || t.push(a);
    }
    if (!e)
      for (let a = 0; a < 3; a++) {
        let l = t.length;
        for (; l--; ) {
          let h = t[l], r, f, u, d, g;
          for (let m = l - 1; m >= 0; m--) {
            let b = t[m], p = !1, x = !1;
            if (M.sameAngle(h, b) ? (p = !0, r = O.clone(h.a), f = O.clone(h.b), u = O.clone(b.a), d = O.clone(b.b)) : M.sameAngleRev(h, b) && (p = x = !0, r = O.clone(h.b), f = O.clone(h.a), u = O.clone(b.a), d = O.clone(b.b)), p && (g = M.angleBetween(r, f), M.rotatePoints(g, r, f, u, d), Math.abs(r.y - u.y) < 0.1 && f.x >= u.x - 1e-4 && r.x <= d.x + 1e-4)) {
              r.x < u.x && (x ? b.a = h.b : b.a = h.a), f.x > d.x && (x ? b.b = h.a : b.b = h.b), t.splice(l, 1);
              break;
            }
          }
        }
      }
    let c = t.length;
    for (; c--; ) {
      let a = t[c];
      if (!a) {
        t.splice(c, 1);
        continue;
      }
      if (n && M.distanceBetween(a.a, a.b) < o) {
        t.splice(c, 1);
        continue;
      }
    }
    return console.log(`[JS] Optimize: ${s.length + t.length} -> ${t.length} segments`), t;
  }
}
function wt(i, t) {
  const e = i.geometry, n = e.attributes.position, o = e.index;
  if (!n) return [];
  const s = /* @__PURE__ */ new Map(), c = 1e3, a = (f, u) => {
    const d = Math.round(f.x * c), g = Math.round(f.y * c), m = Math.round(f.z * c), b = Math.round(u.x * c), p = Math.round(u.y * c), x = Math.round(u.z * c), y = `${d},${g},${m}`, w = `${b},${p},${x}`;
    return y < w ? `${y}|${w}` : `${w}|${y}`;
  }, l = (f) => new I(
    n.getX(f),
    n.getY(f),
    n.getZ(f)
  ).applyMatrix4(i.matrixWorld), h = (f, u, d) => {
    const g = new I().subVectors(u, f), m = new I().subVectors(d, f);
    return new I().crossVectors(g, m).normalize();
  }, r = o ? o.count / 3 : n.count / 3;
  for (let f = 0; f < r; f++) {
    let u, d, g;
    o ? (u = o.getX(f * 3), d = o.getX(f * 3 + 1), g = o.getX(f * 3 + 2)) : (u = f * 3, d = f * 3 + 1, g = f * 3 + 2);
    const m = l(u), b = l(d), p = l(g), x = h(m, b, p), y = new I().addVectors(m, b).add(p).divideScalar(3), w = new I().subVectors(t, y);
    if (x.dot(w) <= 0)
      continue;
    const S = [
      [m, b],
      [b, p],
      [p, m]
    ];
    for (const [E, v] of S) {
      const P = a(E, v);
      if (s.has(P)) {
        const k = s.get(P);
        k && !k.normal2 && (k.normal2 = x.clone(), k.faceIdx2 = f);
      } else
        s.set(P, {
          a: E.clone(),
          b: v.clone(),
          normal1: x.clone(),
          faceIdx1: f,
          mesh: i
        });
    }
  }
  return Array.from(s.values());
}
function Mt(i, t) {
  return i.filter((e) => {
    const n = new I().addVectors(e.a, e.b).multiplyScalar(0.5), o = new I().subVectors(t, n).normalize(), s = e.normal1.dot(o) > 0;
    if (!e.normal2)
      return !0;
    const c = e.normal2.dot(o) > 0;
    return s || c;
  });
}
function vt(i, t, e = 0.99) {
  const n = [], o = [];
  for (const s of i) {
    const c = new I().addVectors(s.a, s.b).multiplyScalar(0.5), a = new I().subVectors(t, c).normalize(), l = s.normal1.dot(a) > 0, h = s.normal2 ? s.normal2.dot(a) > 0 : !0;
    if (l !== h || !s.normal2) {
      n.push(s);
      continue;
    }
    s.normal2 && s.normal1.dot(s.normal2) < e && o.push(s);
  }
  return console.log(`classifyEdges: ${n.length} profiles, ${o.length} smooth/crease edges`), { profiles: n, smoothFiltered: o };
}
function at(i, t, e, n, o = 1) {
  const s = e / 2, c = n / 2, a = (l) => {
    const h = l.clone().project(t);
    return new W(
      h.x * s * o,
      -h.y * c * o
    );
  };
  return i.map((l) => ({
    a: a(l.a),
    b: a(l.b),
    a3d: l.a.clone(),
    b3d: l.b.clone(),
    midpoint3d: new I().addVectors(l.a, l.b).multiplyScalar(0.5),
    isProfile: !1,
    // Will be set by classifyEdges
    visible: !0,
    faceIdx: l.faceIdx1,
    faceIdx2: l.faceIdx2,
    mesh: l.mesh,
    isHatch: l.isHatch,
    normal1: l.normal1,
    // Propagate normals for straggler detection
    normal2: l.normal2
  }));
}
class le {
  /**
   * @param {number} cellSize 
   */
  constructor(t) {
    this.cellSize = t, this.cells = /* @__PURE__ */ new Map();
  }
  /**
   * Get cell key for a point
   * @param {number} x 
   * @param {number} y 
   * @returns {string}
   */
  getCellKey(t, e) {
    const n = Math.floor(t / this.cellSize), o = Math.floor(e / this.cellSize);
    return `${n},${o}`;
  }
  /**
   * Get all cells an edge crosses
   * @param {Edge2D} edge 
   * @returns {string[]}
   */
  getCellsCrossed(t) {
    const e = /* @__PURE__ */ new Set(), n = Math.abs(t.b.x - t.a.x), o = Math.abs(t.b.y - t.a.y), s = Math.max(n, o) / this.cellSize + 1;
    for (let c = 0; c <= s; c++) {
      const a = c / s, l = t.a.x + a * (t.b.x - t.a.x), h = t.a.y + a * (t.b.y - t.a.y);
      e.add(this.getCellKey(l, h));
    }
    return Array.from(e);
  }
  /**
   * Insert an edge into the spatial hash
   * @param {Edge2D} edge 
   */
  insert(t) {
    var n;
    const e = this.getCellsCrossed(t);
    for (const o of e)
      this.cells.has(o) || this.cells.set(o, []), (n = this.cells.get(o)) == null || n.push(t);
  }
  /**
   * Get all edges in a cell
   * @param {string} key 
   * @returns {Edge2D[]}
   */
  query(t) {
    return this.cells.get(t) || [];
  }
  /**
   * Get all cell keys
   * @returns {string[]}
   */
  getAllCells() {
    return Array.from(this.cells.keys());
  }
  clear() {
    this.cells.clear();
  }
}
function he(i, t) {
  const e = i.a.x, n = i.a.y, o = i.b.x, s = i.b.y, c = t.a.x, a = t.a.y, l = t.b.x, h = t.b.y, r = (e - o) * (a - h) - (n - s) * (c - l);
  if (Math.abs(r) < 1e-10) return null;
  const f = ((e - c) * (a - h) - (n - a) * (c - l)) / r, u = -((e - o) * (n - a) - (n - s) * (e - c)) / r, d = 1e-3;
  return f > d && f < 1 - d && u > d && u < 1 - d ? {
    t1: f,
    t2: u,
    point: new W(
      e + f * (o - e),
      n + f * (s - n)
    )
  } : null;
}
function Et(i) {
  var c, a, l, h, r, f;
  const t = /* @__PURE__ */ new Map(), e = 0.01, n = (u, d) => {
    const g = d.b.x - d.a.x, m = d.b.y - d.a.y, b = g * g + m * m;
    if (b < 1e-10) return null;
    const p = ((u.x - d.a.x) * g + (u.y - d.a.y) * m) / b;
    if (p <= e || p >= 1 - e) return null;
    const x = d.a.x + p * g, y = d.a.y + p * m;
    return (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y) < 1 ? p : null;
  }, o = /* @__PURE__ */ new Set();
  for (let u = 0; u < i.length; u++)
    for (let d = u + 1; d < i.length; d++) {
      const g = he(i[u], i[d]);
      if (g)
        t.has(i[u]) || t.set(i[u], []), t.has(i[d]) || t.set(i[d], []), (c = t.get(i[u])) == null || c.push({ t: g.t1, point: g.point }), (a = t.get(i[d])) == null || a.push({ t: g.t2, point: g.point });
      else {
        const m = n(i[u].a, i[d]);
        m !== null && (t.has(i[d]) || t.set(i[d], []), (l = t.get(i[d])) == null || l.push({ t: m, point: i[u].a.clone() }), o.add(i[u]), o.add(i[d]));
        const b = n(i[u].b, i[d]);
        b !== null && (t.has(i[d]) || t.set(i[d], []), (h = t.get(i[d])) == null || h.push({ t: b, point: i[u].b.clone() }), o.add(i[u]), o.add(i[d]));
        const p = n(i[d].a, i[u]);
        p !== null && (t.has(i[u]) || t.set(i[u], []), (r = t.get(i[u])) == null || r.push({ t: p, point: i[d].a.clone() }), o.add(i[u]), o.add(i[d]));
        const x = n(i[d].b, i[u]);
        x !== null && (t.has(i[u]) || t.set(i[u], []), (f = t.get(i[u])) == null || f.push({ t: x, point: i[d].b.clone() }), o.add(i[u]), o.add(i[d]));
      }
    }
  console.log(`T-junction detection: ${o.size} potential straggler edges`);
  const s = [];
  for (const u of i) {
    const d = t.get(u), g = o.has(u);
    if (!d || d.length === 0) {
      u.isTJunctionStraggler = g, s.push(u);
      continue;
    }
    d.sort((p, x) => p.t - x.t);
    let m = u.a, b = u.a3d;
    for (const p of d) {
      const x = new I().lerpVectors(u.a3d, u.b3d, p.t);
      s.push({
        a: m.clone(),
        b: p.point.clone(),
        a3d: b.clone(),
        b3d: x.clone(),
        midpoint3d: new I().addVectors(b, x).multiplyScalar(0.5),
        isProfile: u.isProfile,
        visible: u.visible,
        faceIdx: u.faceIdx,
        mesh: u.mesh,
        isHatch: u.isHatch,
        normal1: u.normal1,
        // Propagate normal for smooth filter
        isTJunctionStraggler: g
      }), p.t, m = p.point, b = x;
    }
    s.push({
      a: m.clone(),
      b: u.b.clone(),
      a3d: b.clone(),
      b3d: u.b3d.clone(),
      midpoint3d: new I().addVectors(b, u.b3d).multiplyScalar(0.5),
      isProfile: u.isProfile,
      visible: u.visible,
      faceIdx: u.faceIdx,
      mesh: u.mesh,
      isHatch: u.isHatch,
      normal1: u.normal1,
      // Propagate normal for smooth filter
      isTJunctionStraggler: g
    });
  }
  return s;
}
function ue(i, t, e, n, o, s, c = !1) {
  if (c)
    return i.forEach((g) => g.visible = !0), i;
  const a = [];
  if (!s)
    return console.warn("No renderer provided, skipping occlusion test"), i;
  const l = new ht(n, o, {
    minFilter: Q,
    magFilter: Q,
    format: qt,
    type: zt
  }), h = new At({
    vertexShader: `
            attribute vec3 faceColor;
            varying vec3 vFaceColor;
            void main() {
                vFaceColor = faceColor;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            varying vec3 vFaceColor;
            void main() {
                gl_FragColor = vec4(vFaceColor, 1.0);
            }
        `,
    side: Dt
  }), r = [];
  let f = 0;
  for (const g of t) {
    g.__globalFaceOffset = f;
    const m = g.geometry, b = m.attributes.position, p = m.index, x = p ? p.count / 3 : b.count / 3, y = [], w = [];
    for (let v = 0; v < x; v++) {
      let P, k, C;
      p ? (P = p.getX(v * 3), k = p.getX(v * 3 + 1), C = p.getX(v * 3 + 2)) : (P = v * 3, k = v * 3 + 1, C = v * 3 + 2);
      const F = new I(b.getX(P), b.getY(P), b.getZ(P)), H = new I(b.getX(k), b.getY(k), b.getZ(k)), $ = new I(b.getX(C), b.getY(C), b.getZ(C));
      F.applyMatrix4(g.matrixWorld), H.applyMatrix4(g.matrixWorld), $.applyMatrix4(g.matrixWorld), y.push(F.x, F.y, F.z, H.x, H.y, H.z, $.x, $.y, $.z);
      const z = f + v + 1, X = (z & 255) / 255, Y = (z >> 8 & 255) / 255, A = (z >> 16 & 255) / 255;
      w.push(X, Y, A, X, Y, A, X, Y, A);
    }
    const S = new Wt();
    S.setAttribute("position", new xt(new Float32Array(y), 3)), S.setAttribute("faceColor", new xt(new Float32Array(w), 3));
    const E = new Bt(S, h);
    r.push(E), f += x;
  }
  const u = new Ht();
  for (const g of r)
    u.add(g);
  s.setRenderTarget(l), s.setClearColor(0, 1), s.clear(), s.render(u, e);
  const d = new Uint8Array(n * o * 4);
  s.readRenderTargetPixels(l, 0, 0, n, o, d), s.setRenderTarget(null);
  for (const g of i) {
    const m = (g.a.x + g.b.x) / 2, b = (g.a.y + g.b.y) / 2, p = Math.round(m + n / 2), x = Math.round(o / 2 + b);
    if (p < 0 || p >= n || x < 0 || x >= o) {
      g.visible = !0, a.push(g);
      continue;
    }
    const y = ((o - 1 - x) * n + p) * 4, w = d[y], S = d[y + 1], E = d[y + 2], v = w + (S << 8) + (E << 16);
    if (v === 0) {
      g.visible = !0, a.push(g);
      continue;
    }
    const P = g.mesh.__globalFaceOffset || 0, k = P + g.faceIdx + 1;
    if (v === k)
      g.visible = !0, a.push(g);
    else {
      if (g.faceIdx2 !== void 0) {
        const C = P + g.faceIdx2 + 1;
        if (v === C) {
          g.visible = !0, a.push(g);
          continue;
        }
      }
      g.visible = !1;
    }
  }
  l.dispose(), h.dispose();
  for (const g of r)
    g.geometry.dispose();
  return a;
}
function fe(i, t, e, n) {
  const o = (r, f, u) => (r.x - u.x) * (f.y - u.y) - (f.x - u.x) * (r.y - u.y), s = o(i, t, e), c = o(i, e, n), a = o(i, n, t), l = s < 0 || c < 0 || a < 0, h = s > 0 || c > 0 || a > 0;
  return !(l && h);
}
function de(i, t, e, n, o = 2) {
  const s = n.x - e.x, c = n.y - e.y, a = s * s + c * c;
  if (a < 1e-10) return !1;
  const l = (h) => {
    const r = ((h.x - e.x) * s + (h.y - e.y) * c) / a, f = e.x + r * s, u = e.y + r * c;
    return (h.x - f) * (h.x - f) + (h.y - u) * (h.y - u) < o * o && r >= -0.01 && r <= 1.01;
  };
  return l(i) && l(t);
}
function xe(i, t) {
  const e = [];
  for (const n of t) {
    const o = [
      { a: n.a2d, b: n.b2d, name: "AB" },
      { a: n.b2d, b: n.c2d, name: "BC" },
      { a: n.c2d, b: n.a2d, name: "CA" }
    ];
    for (const s of o)
      if (de(i.a, i.b, s.a, s.b)) {
        e.push({
          face: n,
          matchedEdge: s.name,
          matchType: "collinear"
        });
        break;
      }
  }
  return e;
}
function ge(i, t, e, n, o, s, c) {
  const a = { x: n.x - t.x, y: n.y - t.y }, l = { x: e.x - t.x, y: e.y - t.y }, h = { x: i.x - t.x, y: i.y - t.y }, r = a.x * a.x + a.y * a.y, f = a.x * l.x + a.y * l.y, u = a.x * h.x + a.y * h.y, d = l.x * l.x + l.y * l.y, g = l.x * h.x + l.y * h.y, m = r * d - f * f;
  if (Math.abs(m) < 1e-10) return 1 / 0;
  const b = (d * u - f * g) / m, p = (r * g - f * u) / m;
  return (1 - b - p) * o + p * s + b * c;
}
function ye(i, t, e = 0.99, n = 0.5) {
  const o = [];
  let s = 0;
  for (const c of i) {
    const a = xe(c, t);
    c.adjacentFaceCount = a.length;
    let l = !1;
    if (a.length === 2) {
      const h = a[0].face, r = a[1].face, f = h.normal, u = r.normal;
      if (f && u) {
        const d = f.dot(u), g = Math.abs(d);
        c.faceSimilarity = g;
        let m;
        d > 0 ? m = Math.abs(h.constant - r.constant) : m = Math.abs(h.constant + r.constant), g >= e && m < n && (l = !0, s++);
      }
    } else if (a.length > 2) {
      const h = a.map((r) => r.face).filter((r) => r.normal);
      if (h.length >= 2) {
        let r = !0, f = 1;
        for (let u = 1; u < h.length; u++) {
          const d = h[0].normal.dot(h[u].normal), g = Math.abs(d);
          let m;
          if (d > 0 ? m = Math.abs(h[0].constant - h[u].constant) : m = Math.abs(h[0].constant + h[u].constant), f = Math.min(f, g), g < e || m >= n) {
            r = !1;
            break;
          }
        }
        c.faceSimilarity = f, r && (l = !0, s++);
      }
    }
    l || o.push(c);
  }
  return console.log(`Geometric straggler filter: removed ${s} coplanar edges`), o;
}
function pe(i, t, e) {
  const n = e.position, o = e.matrixWorldInverse;
  return me(i, t, n, o);
}
function me(i, t, e, n) {
  const o = [];
  let s = 0, c = 0;
  for (const a of i) {
    const l = new W(
      (a.a.x + a.b.x) / 2,
      (a.a.y + a.b.y) / 2
    ), h = a.midpoint3d;
    let r;
    n ? r = -h.clone().applyMatrix4(n).z : r = e.distanceTo(h);
    let f = !1;
    for (const u of t) {
      if (u.mesh === a.mesh && (u.faceIdx === a.faceIdx || u.faceIdx === a.faceIdx2) || !fe(l, u.a2d, u.b2d, u.c2d))
        continue;
      if (ge(
        l,
        u.a2d,
        u.b2d,
        u.c2d,
        u.depthA,
        u.depthB,
        u.depthC
      ) < r - 1e-3) {
        f = !0, c++;
        break;
      }
      s++;
    }
    f ? a.visible = !1 : (a.visible = !0, o.push(a));
  }
  return console.log(`[JS] Occlusion debug: ${s} point-in-triangle hits, ${c} occluded`), o;
}
function be(i, t, e, n = 0.05) {
  const o = new Rt(), s = [], c = [];
  t.traverse((a) => {
    a.isMesh && c.push(a);
  });
  for (const a of i) {
    const l = new I().subVectors(a.midpoint3d, e.position), h = l.clone().normalize(), r = l.length(), f = r * n;
    o.set(e.position.clone(), h);
    const u = o.intersectObjects(c, !0);
    if (u.length === 0)
      a.visible = !0, s.push(a);
    else {
      let d = !1;
      for (const g of u)
        if (!(g.distance >= r - f) && !(g.object === a.mesh && g.faceIndex === a.faceIdx)) {
          d = !0;
          break;
        }
      d ? a.visible = !1 : (a.visible = !0, s.push(a));
    }
  }
  return s;
}
function St(i, t = 0.5) {
  const e = /* @__PURE__ */ new Map(), n = (s) => `${Math.round(s.x / t)},${Math.round(s.y / t)}`, o = (s) => {
    const c = n(s.a), a = n(s.b);
    return c < a ? `${c}-${a}` : `${a}-${c}`;
  };
  for (const s of i) {
    const c = o(s);
    e.has(c) || e.set(c, s);
  }
  return Array.from(e.values());
}
function Pt(i, t = 1, e = 50) {
  const n = (p) => `${Math.round(p.x / t)},${Math.round(p.y / t)}`, o = /* @__PURE__ */ new Map();
  for (const p of i)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = x === "a" ? p.a : p.b, w = n(y);
      o.has(w) || o.set(w, { edges: [], point: { x: y.x, y: y.y } }), o.get(w).edges.push({ edge: p, endpoint: x });
    }
  const s = [];
  for (const [p, x] of o)
    if (x.edges.length === 1) {
      const { edge: y, endpoint: w } = x.edges[0], S = x.point, E = w === "a" ? y.b : y.a, v = S.x - E.x, P = S.y - E.y, k = Math.sqrt(v * v + P * P);
      if (k < 1e-3) continue;
      s.push({
        key: p,
        edge: y,
        endpoint: w,
        point: S,
        otherPoint: E,
        dirX: v / k,
        dirY: P / k,
        len: k
      });
    }
  if (console.log(`Edge cleanup: found ${s.length} orphaned endpoints`), s.length === 0) return i;
  const c = (p, x, y, w) => {
    const S = x.x * w.y - x.y * w.x;
    if (Math.abs(S) < 1e-4) return null;
    const E = y.x - p.x, v = y.y - p.y, P = (E * w.y - v * w.x) / S, k = (E * x.y - v * x.x) / S;
    return { t1: P, t2: k };
  };
  let a = 0;
  const l = /* @__PURE__ */ new Set();
  for (let p = 0; p < s.length; p++) {
    const x = s[p];
    if (l.has(x.key)) continue;
    let y = null, w = null, S = 1 / 0;
    for (let E = 0; E < s.length; E++) {
      if (p === E) continue;
      const v = s[E];
      if (l.has(v.key) || Math.sqrt(
        (v.point.x - x.point.x) ** 2 + (v.point.y - x.point.y) ** 2
      ) > e * 2) continue;
      const k = c(
        { x: x.point.x, y: x.point.y },
        { x: x.dirX, y: x.dirY },
        { x: v.point.x, y: v.point.y },
        { x: v.dirX, y: v.dirY }
      );
      if (!k || k.t1 < -0.1 || k.t2 < -0.1 || k.t1 > e || k.t2 > e) continue;
      const C = x.point.x + k.t1 * x.dirX, F = x.point.y + k.t1 * x.dirY, H = k.t1 + k.t2;
      H < S && (S = H, y = v, w = { x: C, y: F });
    }
    if (y && w) {
      const E = pt(
        x.point,
        w,
        i,
        x.edge,
        y.edge
      ), v = pt(
        y.point,
        w,
        i,
        x.edge,
        y.edge
      );
      if (E || v)
        continue;
      x.endpoint === "a" ? (x.edge.a.x = w.x, x.edge.a.y = w.y) : (x.edge.b.x = w.x, x.edge.b.y = w.y), y.endpoint === "a" ? (y.edge.a.x = w.x, y.edge.a.y = w.y) : (y.edge.b.x = w.x, y.edge.b.y = w.y), l.add(x.key), l.add(y.key), a++;
    }
  }
  console.log(`Edge cleanup: extended ${a} pairs of edges to intersections`);
  let h = 0;
  for (const p of i) {
    const x = p.b.x - p.a.x, y = p.b.y - p.a.y;
    h += Math.sqrt(x * x + y * y);
  }
  const r = h / i.length, f = r / 8;
  console.log(`Edge cleanup: average edge length = ${r.toFixed(2)}, snap threshold = ${f.toFixed(2)}`);
  const u = /* @__PURE__ */ new Map();
  for (const p of i)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = x === "a" ? p.a : p.b, w = n(y);
      u.has(w) || u.set(w, { edges: [], point: y }), u.get(w).edges.push({ edge: p, endpoint: x });
    }
  const d = [];
  for (const [p, x] of u)
    x.edges.length === 1 && d.push({ key: p, ...x.edges[0], point: x.point });
  console.log(`Edge cleanup: ${d.length} orphaned endpoints before snap pass`);
  let g = 0;
  const m = /* @__PURE__ */ new Set();
  for (let p = 0; p < d.length; p++) {
    const x = d[p];
    if (m.has(x.key)) continue;
    let y = null, w = 1 / 0;
    for (let S = 0; S < d.length; S++) {
      if (p === S) continue;
      const E = d[S];
      if (m.has(E.key)) continue;
      const v = Math.sqrt(
        (E.point.x - x.point.x) ** 2 + (E.point.y - x.point.y) ** 2
      );
      v < w && (w = v, y = E);
    }
    if (y && w < f) {
      const S = (x.point.x + y.point.x) / 2, E = (x.point.y + y.point.y) / 2;
      x.endpoint === "a" ? (x.edge.a.x = S, x.edge.a.y = E) : (x.edge.b.x = S, x.edge.b.y = E), y.endpoint === "a" ? (y.edge.a.x = S, y.edge.a.y = E) : (y.edge.b.x = S, y.edge.b.y = E), m.add(x.key), m.add(y.key), g++;
    }
  }
  console.log(`Edge cleanup: snapped ${g} pairs of nearby orphans`);
  const b = d.length - g * 2;
  return console.log(`Edge cleanup: ${b} orphaned endpoints remaining`), i;
}
function we(i, t = 1) {
  const e = (c) => `${Math.round(c.x / t)},${Math.round(c.y / t)}`, n = /* @__PURE__ */ new Map();
  for (const c of i) {
    const a = e(c.a), l = e(c.b);
    n.set(a, (n.get(a) || 0) + 1), n.set(l, (n.get(l) || 0) + 1);
  }
  const o = i.filter((c) => {
    const a = e(c.a), l = e(c.b), h = n.get(a) || 0, r = n.get(l) || 0;
    return h >= 2 || r >= 2;
  }), s = i.length - o.length;
  return s > 0 && console.log(`Edge cleanup: removed ${s} isolated edges (orphaned at both ends)`), o;
}
function pt(i, t, e, n, o) {
  for (const c of e) {
    if (c === n || c === o) continue;
    const a = t.x - i.x, l = t.y - i.y, h = c.b.x - c.a.x, r = c.b.y - c.a.y, f = a * r - l * h;
    if (Math.abs(f) < 1e-3) continue;
    const u = c.a.x - i.x, d = c.a.y - i.y, g = (u * r - d * h) / f, m = (u * l - d * a) / f;
    if (g > 1e-3 && g < 1 - 1e-3 && m > 1e-3 && m < 1 - 1e-3)
      return !0;
  }
  return !1;
}
function Pe(i, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    occlusionEpsilon: c = 0.01,
    // 1% depth tolerance for depth buffer
    skipOcclusion: a = !1,
    width: l = 800,
    height: h = 600,
    renderer: r = null
  } = n;
  console.time("extractEdges");
  const f = wt(i, t.position);
  console.timeEnd("extractEdges"), console.log(`Extracted ${f.length} edges`), console.time("filterBackfacing");
  const u = Mt(f, t.position);
  console.timeEnd("filterBackfacing"), console.log(`After backface filter: ${u.length} edges`), console.time("classifyEdges");
  const { profiles: d, smoothFiltered: g } = vt(u, t.position, o);
  console.timeEnd("classifyEdges"), console.log(`Profiles: ${d.length}, Smooth edges: ${g.length}`);
  const m = [...d, ...g];
  console.time("projectEdges");
  let b = at(m, t, l, h);
  console.timeEnd("projectEdges");
  for (let P = 0; P < d.length; P++)
    b[P].isProfile = !0;
  console.time("spatialHash");
  const p = Math.max(l, h) / s, x = new le(p);
  for (const P of b)
    x.insert(P);
  console.timeEnd("spatialHash"), console.time("splitIntersections");
  const y = /* @__PURE__ */ new Set();
  let w = [];
  for (const P of x.getAllCells()) {
    const k = x.query(P).filter((F) => !y.has(F)), C = Et(k);
    w.push(...C);
    for (const F of k) y.add(F);
  }
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${w.length} edges`);
  let S;
  if (a)
    console.log("Skipping occlusion test (debug mode)"), S = w;
  else if (r) {
    console.time("testOcclusion (face ID buffer)");
    const P = w.filter((F) => F.isProfile), k = w.filter((F) => !F.isProfile);
    P.forEach((F) => F.visible = !0);
    const C = ue(k, [i], t, l, h, r, !1);
    S = [...P, ...C], console.timeEnd("testOcclusion (face ID buffer)");
  } else
    console.time("testOcclusion (raycaster - slow)"), S = be(w, e, t, c), console.timeEnd("testOcclusion (raycaster - slow)");
  console.log(`Visible edges: ${S.length}`), console.time("optimize");
  const E = St(S);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const v = Pt(E);
  return console.timeEnd("cleanup orphans"), console.log(`Final edges: ${v.length}`), {
    edges: v,
    profiles: v.filter((P) => P.isProfile)
  };
}
function Me(i, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    skipOcclusion: c = !1,
    width: a = 800,
    height: l = 600,
    renderer: h = null,
    internalScale: r = 4,
    // Scale up internally for better precision
    distanceThreshold: f = 0.5
    // Default plane distance threshold
  } = n;
  let u = [];
  for (const $ of i) {
    $.updateMatrixWorld(!0);
    const z = wt($, t.position);
    u.push(...z);
  }
  console.log(`Extracted ${u.length} edges from ${i.length} meshes`);
  const { profiles: d, smoothFiltered: g } = vt(u, t.position, o);
  console.log(`Profiles: ${d.length}, Crease edges: ${g.length}`);
  const m = [...d, ...g];
  console.log(`After smooth filter: ${m.length} edges`);
  let b = at(m, t, a, l, r);
  if (n.hatchEdges && n.hatchEdges.length > 0) {
    console.log(`Processing ${n.hatchEdges.length} hatch edges...`);
    let $ = Mt(n.hatchEdges, t.position);
    if (n.minHatchDotProduct !== void 0) {
      const X = n.minHatchDotProduct;
      $ = $.filter((Y) => {
        const A = new I().addVectors(Y.a, Y.b).multiplyScalar(0.5), q = new I().subVectors(t.position, A).normalize(), N = Y.normal1.dot(q);
        return Math.abs(N) >= X;
      }), console.log(`Density filter: kept ${$.length} hatch edges (threshold ${X})`);
    }
    const z = at($, t, a, l, r);
    z.forEach((X) => X.isHatch = !0), b.push(...z), console.log(`Added ${z.length} visible hatch edges`);
  }
  console.time("splitIntersections");
  const p = Et(b);
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${p.length} edges`), console.time("buildProjectedFaces");
  const x = [], y = t.position, w = a / 2, S = l / 2;
  for (const $ of i) {
    const z = $.geometry, X = z.attributes.position, Y = z.index, A = Y ? Y.count / 3 : X.count / 3;
    for (let q = 0; q < A; q++) {
      let N, T, B;
      Y ? (N = Y.getX(q * 3), T = Y.getX(q * 3 + 1), B = Y.getX(q * 3 + 2)) : (N = q * 3, T = q * 3 + 1, B = q * 3 + 2);
      const R = new I(X.getX(N), X.getY(N), X.getZ(N)).applyMatrix4($.matrixWorld), V = new I(X.getX(T), X.getY(T), X.getZ(T)).applyMatrix4($.matrixWorld), j = new I(X.getX(B), X.getY(B), X.getZ(B)).applyMatrix4($.matrixWorld), J = new I().subVectors(V, R), K = new I().subVectors(j, R), _ = new I().crossVectors(J, K).normalize(), et = new I().addVectors(R, V).add(j).divideScalar(3), nt = new I().subVectors(y, et), ot = -_.dot(R);
      if (_.dot(nt) <= 0) continue;
      const ut = R.clone().project(t), ft = V.clone().project(t), dt = j.clone().project(t), kt = new W(ut.x * w * r, -ut.y * S * r), It = new W(ft.x * w * r, -ft.y * S * r), $t = new W(dt.x * w * r, -dt.y * S * r), st = t.matrixWorldInverse, Ct = -R.clone().applyMatrix4(st).z, Ot = -V.clone().applyMatrix4(st).z, Ft = -j.clone().applyMatrix4(st).z;
      x.push({
        a2d: kt,
        b2d: It,
        c2d: $t,
        depthA: Ct,
        depthB: Ot,
        depthC: Ft,
        mesh: $,
        faceIdx: q,
        normal: _,
        // Store normal for post-split smooth filter
        constant: ot
        // Store plane constant for coplanar detection
      });
    }
  }
  console.timeEnd("buildProjectedFaces"), console.log(`Built ${x.length} projected faces for occlusion`), console.time("classifySilhouettes"), ve(p, x), console.timeEnd("classifySilhouettes"), console.time("filterSmoothSplitEdges");
  const E = ye(p, x, o, f);
  console.timeEnd("filterSmoothSplitEdges");
  let v;
  c ? v = E : (console.time("testOcclusion (math)"), v = pe(E, x, t), console.timeEnd("testOcclusion (math)")), console.log(`Visible edges: ${v.length}`), console.time("optimize");
  const P = St(v);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const k = Pt(P);
  console.timeEnd("cleanup orphans");
  const C = we(k);
  console.log(`Final edges before optimization: ${C.length}`);
  let F = C;
  if (C.length > 0) {
    let $ = 0;
    for (const Y of C) {
      const A = Y.b.x - Y.a.x, q = Y.b.y - Y.a.y;
      $ += Math.sqrt(A * A + q * q);
    }
    const z = $ / C.length, X = z / 10;
    console.log(`Optimization: avgLen=${z.toFixed(2)}, trim limit=${X.toFixed(2)}`), console.time("Optimize.segments"), F = tt.segments(C, !1, !0, X, !1, !1, !1)._segments, console.timeEnd("Optimize.segments"), console.log(`After optimization: ${F.length} edges`);
  }
  for (const $ of F)
    $.a.x /= r, $.a.y /= r, $.b.x /= r, $.b.y /= r;
  const H = F;
  return {
    edges: H,
    profiles: H.filter(($) => $.isProfile),
    allEdges: p,
    // For debug visualization
    projectedFaces: x
    // For face visualization
  };
}
function ve(i, t) {
  for (const o of i) {
    if (o.isHatch) {
      o.isSilhouette = !1;
      continue;
    }
    const s = (o.a.x + o.b.x) / 2, c = (o.a.y + o.b.y) / 2, a = o.b.x - o.a.x, l = o.b.y - o.a.y, h = Math.sqrt(a * a + l * l);
    if (h < 1e-3) {
      o.isSilhouette = !1;
      continue;
    }
    const r = -l / h, f = a / h, u = mt(s, c, r, f, 1e3, t), d = mt(s, c, -r, -f, 1e3, t);
    o.isSilhouette = !u || !d;
  }
  const n = i.filter((o) => o.isSilhouette).length;
  console.log(`Classified ${n} silhouette edges out of ${i.length}`);
}
function mt(i, t, e, n, o, s) {
  for (const c of s)
    if (Ee(i, t, e, n, o, c.a2d, c.b2d, c.c2d))
      return !0;
  return !1;
}
function Ee(i, t, e, n, o, s, c, a) {
  return !!(it(i, t, e, n, o, s.x, s.y, c.x, c.y) || it(i, t, e, n, o, c.x, c.y, a.x, a.y) || it(i, t, e, n, o, a.x, a.y, s.x, s.y));
}
function it(i, t, e, n, o, s, c, a, l) {
  const h = a - s, r = l - c, f = e * r - n * h;
  if (Math.abs(f) < 1e-10) return !1;
  const u = ((s - i) * r - (c - t) * h) / f, d = ((s - i) * n - (c - t) * e) / f;
  return u > 0.1 && u <= o && d >= 0 && d <= 1;
}
var L = (i) => Math.round(i * 100) / 100, lt = function(i) {
  bt.call(this), this.node = i;
};
lt.prototype = Object.create(bt.prototype);
lt.prototype.constructor = lt;
var ke = function() {
  var i = this, t = document.createElementNS("http://www.w3.org/2000/svg", "svg"), e = document.createElementNS("http://www.w3.org/2000/svg", "g"), n = document.createElementNS("http://www.w3.org/2000/svg", "g"), o = document.createElementNS("http://www.w3.org/2000/svg", "g"), s, c, a, l, h = new Lt();
  t.setAttribute("xmlns", "http://www.w3.org/2000/svg"), t.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape"), t.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink"), t.setAttribute("version", "1.1"), e.setAttribute("inkscape:label", "Silhouettes"), e.setAttribute("inkscape:groupmode", "layer"), e.id = "silhouettes_layer", t.appendChild(e), o.setAttribute("inkscape:label", "Shading"), o.setAttribute("inkscape:groupmode", "layer"), o.id = "shading_layer", t.appendChild(o), n.setAttribute("inkscape:label", "Edges"), n.setAttribute("inkscape:groupmode", "layer"), n.id = "edges_layer", t.appendChild(n), this.domElement = t, this.showSilhouettes = !0, this.showEdges = !0, this.showHatches = !0, this.silhouetteOptions = {
    normalBuckets: 12,
    simplifyTolerance: 2,
    minArea: 100
  }, this.hatchOptions = {
    baseSpacing: 8,
    minSpacing: 3,
    maxSpacing: 40,
    depthFactor: 0.5,
    insetPixels: 3,
    stroke: "black",
    strokeWidth: "1px",
    axisSettings: {
      x: { rotation: 0, spacing: 8 },
      y: { rotation: 0, spacing: 8 },
      z: { rotation: 0, spacing: 8 }
    }
  }, this.edgeOptions = {
    stroke: "white",
    strokeWidth: "1px"
  }, this.hiddenLineOptions = {
    smoothThreshold: 0.99
  }, this._glRenderer = null, this.autoClear = !0, this.setClearColor = function(f) {
    h.set(f);
  }, this.setPixelRatio = function() {
  }, this.setSize = function(f, u) {
    s = f, c = u, a = s / 2, l = c / 2, t.setAttribute("viewBox", -a + " " + -l + " " + s + " " + c), t.setAttribute("width", s), t.setAttribute("height", c);
  }, this.getSize = function() {
    return {
      width: s,
      height: c
    };
  }, this.setGLRenderer = function(f) {
    i._glRenderer = f;
  };
  function r() {
    for (; e.childNodes.length > 0; )
      e.removeChild(e.childNodes[0]);
    for (; n.childNodes.length > 0; )
      n.removeChild(n.childNodes[0]);
    for (; o.childNodes.length > 0; )
      o.removeChild(o.childNodes[0]);
  }
  this.clear = function() {
    r(), t.style.backgroundColor = h.getStyle();
  }, this.renderGPULayers = function(f, u) {
    if (!i._glRenderer) {
      console.warn("PlotterRenderer: WebGL renderer not set. Call setGLRenderer() first.");
      return;
    }
    const d = i._glRenderer;
    if (i.showSilhouettes || i.showHatches) {
      const g = Nt(d, f, u, {
        normalBuckets: i.silhouetteOptions.normalBuckets,
        simplifyTolerance: i.silhouetteOptions.simplifyTolerance,
        minArea: i.silhouetteOptions.minArea,
        insetPixels: i.showHatches ? i.hatchOptions.insetPixels : 0
      });
      if (i.showSilhouettes && g.forEach((m) => {
        if (m.boundary.length < 3) return;
        const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let p = "";
        m.boundary.forEach((E, v) => {
          const P = E.x, k = -E.y;
          p += (v === 0 ? "M" : "L") + L(P) + "," + L(k);
        }), p += "Z";
        const x = m.normal, y = Math.floor((x.x * 0.5 + 0.5) * 255), w = Math.floor((x.y * 0.5 + 0.5) * 255), S = Math.floor((x.z * 0.5 + 0.5) * 255);
        b.setAttribute("d", p), b.setAttribute("fill", `rgba(${y},${w},${S},0.3)`), b.setAttribute("stroke", "none"), e.appendChild(b);
      }), i.showHatches) {
        g.sort((b, p) => b.depth - p.depth);
        const m = g.map((b) => b.boundary);
        g.forEach((b, p) => {
          let x = oe(b, u, {
            baseSpacing: i.hatchOptions.baseSpacing,
            minSpacing: i.hatchOptions.minSpacing,
            maxSpacing: i.hatchOptions.maxSpacing,
            depthFactor: i.hatchOptions.depthFactor,
            insetPixels: i.hatchOptions.insetPixels,
            screenWidth: s,
            screenHeight: c,
            axisSettings: i.hatchOptions.axisSettings
          });
          for (let y = 0; y < p; y++)
            x = x.flatMap(
              (w) => se(w, m[y])
            );
          x.forEach((y) => {
            const w = document.createElementNS("http://www.w3.org/2000/svg", "path"), S = `M${L(y.start.x)},${L(-y.start.y)}L${L(y.end.x)},${L(-y.end.y)}`;
            w.setAttribute("d", S), w.setAttribute("fill", "none"), w.setAttribute("stroke", i.hatchOptions.stroke), w.setAttribute("stroke-width", i.hatchOptions.strokeWidth), o.appendChild(w);
          });
        });
      }
      if (i.showEdges) {
        const m = [];
        f.traverse((b) => {
          b.isMesh && b.geometry && m.push(b);
        }), m.length > 0 && (Me(m, u, f, {
          smoothThreshold: i.hiddenLineOptions.smoothThreshold,
          width: s,
          height: c
        }).edges || []).forEach((x) => {
          const y = document.createElementNS("http://www.w3.org/2000/svg", "line");
          y.setAttribute("x1", L(x.a.x)), y.setAttribute("y1", L(x.a.y)), y.setAttribute("x2", L(x.b.x)), y.setAttribute("y2", L(x.b.y)), y.setAttribute("stroke", i.edgeOptions.stroke), y.setAttribute("stroke-width", i.edgeOptions.strokeWidth), n.appendChild(y);
        });
      }
    }
  }, this.render = function(f, u) {
    if (!(u instanceof Vt)) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }
  };
};
export {
  M as GeomUtil,
  tt as Optimize,
  ke as PlotterRenderer,
  O as Point,
  lt as SVGObject,
  D as Segment,
  G as Segments,
  Pt as cleanupOrphanedEdges,
  se as clipLineOutsidePolygon,
  gt as clipLineToPolygon,
  Pe as computeHiddenLines,
  Me as computeHiddenLinesMultiple,
  Nt as extractNormalRegions,
  oe as generatePerspectiveHatches,
  St as optimizeEdges
};
//# sourceMappingURL=three-plotter-renderer.es.js.map

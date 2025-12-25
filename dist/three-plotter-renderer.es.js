import { Vector2 as W, WebGLRenderTarget as lt, NearestFilter as Q, MeshNormalMaterial as Ft, MeshDepthMaterial as Xt, RGBADepthPacking as Tt, Vector3 as $, UnsignedByteType as Yt, RGBAFormat as qt, ShaderMaterial as zt, DoubleSide as At, BufferGeometry as Dt, BufferAttribute as dt, Mesh as Wt, Scene as Bt, Raycaster as Ht, Color as Rt, Camera as Lt, Object3D as mt } from "three";
function Vt(i, t, e, n = {}) {
  const {
    resolution: o = 2,
    // Render at 2x for smooth boundaries
    normalBuckets: s = 12,
    // Quantize normals into N directions
    minArea: c = 100,
    // Minimum region area in pixels (at output scale)
    simplifyTolerance: l = 2,
    insetPixels: a = 0
    // Inset boundaries by this many pixels (GPU erosion)
  } = n, h = i.getSize(new W()), r = Math.floor(h.x * o), u = Math.floor(h.y * o), f = Math.round(a * o), d = Nt(i, t, e, r, u), y = jt(i, t, e, r, u);
  let { regionMap: m, normalLookup: b } = Kt(d, r, u);
  f > 0 && (m = Zt(m, r, u, f));
  const { labels: p, regionCount: x } = Qt(m, r, u), g = [];
  for (let w = 1; w <= x; w++) {
    const S = _t(p, r, u, w);
    if (S.length < 3) continue;
    const v = it(S, l), E = Math.abs(te(v));
    if (E < c) continue;
    const P = Gt(p, m, b, r, u, w), k = Jt(p, y, r, u, w);
    g.push({
      boundary: v.map((O) => new W(
        O.x / o - h.x / 2,
        O.y / o - h.y / 2
        // Y already flipped during readback
      )),
      normal: P,
      depth: k,
      // 0-1 normalized depth
      area: E / (o * o),
      regionId: w
    });
  }
  return g;
}
function Nt(i, t, e, n, o) {
  const s = new lt(n, o, {
    minFilter: Q,
    magFilter: Q
  }), c = new Ft({ flatShading: !0 }), l = /* @__PURE__ */ new Map(), a = [];
  t.traverse((r) => {
    r.isMesh ? (l.set(r, r.material), r.material = c) : (r.isLineSegments || r.isLine || r.isPoints) && r.visible && (a.push(r), r.visible = !1);
  }), i.setRenderTarget(s), i.render(t, e), t.traverse((r) => {
    r.isMesh && l.has(r) && (r.material = l.get(r));
  });
  for (const r of a)
    r.visible = !0;
  i.setRenderTarget(null);
  const h = new Uint8Array(n * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, n, o, h), s.dispose(), c.dispose(), h;
}
function jt(i, t, e, n, o) {
  const s = new lt(n, o, {
    minFilter: Q,
    magFilter: Q
  }), c = new Xt({ depthPacking: Tt }), l = /* @__PURE__ */ new Map(), a = [];
  t.traverse((r) => {
    r.isMesh ? (l.set(r, r.material), r.material = c) : (r.isLineSegments || r.isLine || r.isPoints) && r.visible && (a.push(r), r.visible = !1);
  }), i.setRenderTarget(s), i.render(t, e), t.traverse((r) => {
    r.isMesh && l.has(r) && (r.material = l.get(r));
  });
  for (const r of a)
    r.visible = !0;
  i.setRenderTarget(null);
  const h = new Uint8Array(n * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, n, o, h), s.dispose(), c.dispose(), h;
}
function Jt(i, t, e, n, o) {
  let s = 0, c = 0;
  for (let l = 0; l < n; l++)
    for (let a = 0; a < e; a++)
      if (i[l * e + a] === o) {
        const h = (l * e + a) * 4, r = t[h] / 255, u = t[h + 1] / 255, f = t[h + 2] / 255, d = t[h + 3] / 255, y = r + u / 256 + f / 65536 + d / 16777216;
        s += y, c++;
      }
  return c > 0 ? s / c : 0.5;
}
function Zt(i, t, e, n) {
  let o = i;
  for (let s = 0; s < n; s++) {
    const c = new Uint16Array(o);
    for (let l = 1; l < e - 1; l++)
      for (let a = 1; a < t - 1; a++) {
        const h = l * t + a;
        if (o[h] === 0) continue;
        const u = o[h - 1], f = o[h + 1], d = o[h - t], y = o[h + t];
        (u === 0 || f === 0 || d === 0 || y === 0) && (c[h] = 0);
      }
    o = c;
  }
  return o;
}
function Kt(i, t, e, n) {
  const o = new Uint16Array(t * e), s = {};
  let c = 1;
  const l = {};
  for (let a = 0; a < t * e; a++) {
    const h = a * 4, r = i[h], u = i[h + 1], f = i[h + 2];
    if (r < 5 && u < 5 && f < 5) {
      o[a] = 0;
      continue;
    }
    const d = r / 255 * 2 - 1, y = u / 255 * 2 - 1, m = f / 255 * 2 - 1, b = 4, p = Math.round(r / b) * b, x = Math.round(u / b) * b, g = Math.round(f / b) * b, w = `${p}|${x}|${g}`;
    l[w] || (l[w] = c, s[c] = new $(d, y, m).normalize(), c++), o[a] = l[w];
  }
  return { regionMap: o, normalLookup: s };
}
function Qt(i, t, e) {
  const n = new Uint32Array(t * e), o = [];
  let s = 1;
  function c(r) {
    return o[r] !== r && (o[r] = c(o[r])), o[r];
  }
  function l(r, u) {
    const f = c(r), d = c(u);
    f !== d && (o[d] = f);
  }
  for (let r = 0; r < e; r++)
    for (let u = 0; u < t; u++) {
      const f = r * t + u, d = i[f];
      if (d === 0) continue;
      const y = [];
      if (u > 0 && i[f - 1] === d && n[f - 1] > 0 && y.push(n[f - 1]), r > 0 && i[f - t] === d && n[f - t] > 0 && y.push(n[f - t]), y.length === 0)
        n[f] = s, o[s] = s, s++;
      else {
        const m = Math.min(...y);
        n[f] = m;
        for (const b of y)
          l(m, b);
      }
    }
  const a = {};
  let h = 0;
  for (let r = 0; r < t * e; r++) {
    if (n[r] === 0) continue;
    const u = c(n[r]);
    a[u] === void 0 && (h++, a[u] = h), n[r] = a[u];
  }
  return { labels: n, regionCount: h };
}
function _t(i, t, e, n) {
  const o = [];
  let s = -1, c = -1;
  t: for (let y = 0; y < e; y++)
    for (let m = 0; m < t; m++)
      if (i[y * t + m] === n && (m === 0 || i[y * t + m - 1] !== n || y === 0 || i[(y - 1) * t + m] !== n)) {
        s = m, c = y;
        break t;
      }
  if (s === -1) return o;
  const l = [1, 1, 0, -1, -1, -1, 0, 1], a = [0, 1, 1, 1, 0, -1, -1, -1];
  let h = s, r = c, u = 7;
  const f = t * e * 2;
  let d = 0;
  do {
    o.push({ x: h, y: r });
    let y = !1;
    for (let m = 0; m < 8; m++) {
      const b = (u + 6 + m) % 8, p = h + l[b], x = r + a[b];
      if (p >= 0 && p < t && x >= 0 && x < e && i[x * t + p] === n) {
        h = p, r = x, u = b, y = !0;
        break;
      }
    }
    if (!y) break;
    d++;
  } while ((h !== s || r !== c) && d < f);
  return o;
}
function Gt(i, t, e, n, o, s) {
  let c = 0, l = 0, a = 0;
  for (let d = 0; d < o; d++)
    for (let y = 0; y < n; y++)
      i[d * n + y] === s && (c += y, l += d, a++);
  if (a === 0) return new $(0, 0, 1);
  const h = Math.round(c / a), u = Math.round(l / a) * n + h, f = t[u];
  return e[f] || new $(0, 0, 1);
}
function it(i, t) {
  if (i.length < 3) return i;
  let e = 0, n = 0;
  const o = i[0], s = i[i.length - 1];
  for (let c = 1; c < i.length - 1; c++) {
    const l = Ut(i[c], o, s);
    l > e && (e = l, n = c);
  }
  if (e > t) {
    const c = it(i.slice(0, n + 1), t), l = it(i.slice(n), t);
    return c.slice(0, -1).concat(l);
  } else
    return [o, s];
}
function Ut(i, t, e) {
  const n = e.x - t.x, o = e.y - t.y, s = n * n + o * o;
  if (s < 1e-10)
    return Math.sqrt((i.x - t.x) ** 2 + (i.y - t.y) ** 2);
  const c = ((i.x - t.x) * n + (i.y - t.y) * o) / s, l = t.x + c * n, a = t.y + c * o;
  return Math.sqrt((i.x - l) ** 2 + (i.y - a) ** 2);
}
function te(i) {
  let t = 0;
  for (let e = 0; e < i.length; e++) {
    const n = (e + 1) % i.length;
    t += i[e].x * i[n].y, t -= i[n].x * i[e].y;
  }
  return t / 2;
}
function ee(i, t, e, n) {
  const o = e / 2, s = n / 2, c = new $(0, 1, 0), l = new $(0, 0, 1);
  let a;
  Math.abs(i.y) > 0.9 ? a = l.clone() : (a = new $().crossVectors(c, i).normalize(), a.lengthSq() < 0.01 && (a = l.clone()));
  const h = new $(0, 0, 0), r = a.clone().multiplyScalar(100), u = h.clone().project(t), f = r.clone().project(t), d = new W(
    u.x * o,
    -u.y * s
  ), m = new W(
    f.x * o,
    -f.y * s
  ).clone().sub(d).normalize(), p = a.clone().multiplyScalar(1e5).clone().project(t);
  let x = null;
  return Math.abs(p.x) < 100 && Math.abs(p.y) < 100 && p.z < 1 && (x = new W(
    p.x * o,
    -p.y * s
  )), { direction: m, vanishingPoint: x };
}
function ne(i, t, e = {}) {
  const {
    baseSpacing: n = 8,
    // Base spacing in screen pixels
    minSpacing: o = 3,
    // Minimum spacing
    maxSpacing: s = 20,
    // Maximum spacing
    depthFactor: c = 0.5,
    // How much depth affects density
    screenWidth: l = 1200,
    screenHeight: a = 800,
    axisSettings: h = {}
    // { x: { rotation: 0, spacing: 10 }, y: ... }
  } = e, { boundary: r, normal: u, depth: f = 0.5 } = i;
  if (r.length < 3) return [];
  const d = Math.abs(u.x), y = Math.abs(u.y), m = Math.abs(u.z);
  let b = "y";
  d >= y && d >= m ? b = "x" : m >= y && m >= d && (b = "z");
  const p = h[b] || {}, x = p.rotation || 0, g = p.spacing;
  console.log(`[Hatch] normal=(${u.x.toFixed(2)}, ${u.y.toFixed(2)}, ${u.z.toFixed(2)}) => axis=${b}, rotation=${x}, spacing=${g}`);
  const { direction: w, vanishingPoint: S } = ee(
    u,
    t,
    l,
    a
  );
  let v = w;
  if (x !== 0) {
    const Y = x * (Math.PI / 180), B = Math.cos(Y), R = Math.sin(Y);
    v = new W(
      w.x * B - w.y * R,
      w.x * R + w.y * B
    );
  }
  const E = new W(-v.y, v.x), k = Math.max(o, Math.min(
    s,
    (g !== void 0 ? g : n) + f * c * (s - o)
  ));
  let O = 1 / 0, F = -1 / 0, H = 1 / 0, I = -1 / 0;
  for (const Y of r)
    O = Math.min(O, Y.x), F = Math.max(F, Y.x), H = Math.min(H, Y.y), I = Math.max(I, Y.y);
  const q = (O + F) / 2, X = (H + I) / 2, T = new W(q, X), A = Math.sqrt((F - O) ** 2 + (I - H) ** 2), z = [];
  if (S && Math.abs(x) < 5 && S.distanceTo(T) < A * 5) {
    const Y = S.distanceTo(T), B = Math.ceil(A / k) * 2, V = Math.atan2(A, Y) * 2 / B, j = Math.atan2(
      X - S.y,
      q - S.x
    );
    for (let J = -B; J <= B; J++) {
      const K = j + J * V, _ = new W(Math.cos(K), Math.sin(K)), et = S.clone(), nt = S.clone().add(_.clone().multiplyScalar(Y * 10)), ot = xt({ start: et, end: nt }, r);
      z.push(...ot);
    }
  } else {
    const Y = Math.ceil(A / k) + 2;
    for (let B = -Y; B <= Y; B++) {
      const R = E.clone().multiplyScalar(B * k), V = T.clone().add(R), j = V.clone().add(v.clone().multiplyScalar(-A)), J = V.clone().add(v.clone().multiplyScalar(A)), K = xt({ start: j, end: J }, r);
      z.push(...K);
    }
  }
  return z;
}
function xt(i, t) {
  const e = [], n = t.length;
  for (let s = 0; s < n; s++) {
    const c = t[s], l = t[(s + 1) % n], a = ie(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      c.x,
      c.y,
      l.x,
      l.y
    );
    a && e.push({
      point: new W(a.x, a.y),
      t: a.t
    });
  }
  if (e.length < 2) return [];
  e.sort((s, c) => s.t - c.t);
  const o = [];
  for (let s = 0; s < e.length - 1; s++) {
    const c = (e[s].point.x + e[s + 1].point.x) / 2, l = (e[s].point.y + e[s + 1].point.y) / 2;
    U(c, l, t) && o.push({
      start: e[s].point,
      end: e[s + 1].point
    });
  }
  return o;
}
function oe(i, t) {
  const e = [], n = t.length, o = U(i.start.x, i.start.y, t), s = U(i.end.x, i.end.y, t);
  e.push({ point: i.start.clone(), t: 0, inside: o });
  for (let a = 0; a < n; a++) {
    const h = t[a], r = t[(a + 1) % n], u = se(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      h.x,
      h.y,
      r.x,
      r.y
    );
    u && u.t > 0 && u.t < 1 && e.push({
      point: new W(u.x, u.y),
      t: u.t,
      inside: null
      // will be determined by neighbors
    });
  }
  e.push({ point: i.end.clone(), t: 1, inside: s }), e.sort((a, h) => a.t - h.t);
  const c = [e[0]];
  for (let a = 1; a < e.length; a++)
    e[a].t - c[c.length - 1].t > 1e-4 && c.push(e[a]);
  if (c.length < 2) return [i];
  const l = [];
  for (let a = 0; a < c.length - 1; a++) {
    const h = (c[a].t + c[a + 1].t) / 2, r = i.start.x + h * (i.end.x - i.start.x), u = i.start.y + h * (i.end.y - i.start.y);
    U(r, u, t) || l.push({
      start: c[a].point.clone(),
      end: c[a + 1].point.clone()
    });
  }
  return l;
}
function se(i, t, e, n, o, s, c, l) {
  const a = (i - e) * (s - l) - (t - n) * (o - c);
  if (Math.abs(a) < 1e-10) return null;
  const h = ((i - o) * (s - l) - (t - s) * (o - c)) / a, r = -((i - e) * (t - s) - (t - n) * (i - o)) / a;
  return h >= 0 && h <= 1 && r >= 0 && r <= 1 ? {
    x: i + h * (e - i),
    y: t + h * (n - t),
    t: h
  } : null;
}
function ie(i, t, e, n, o, s, c, l) {
  const a = (i - e) * (s - l) - (t - n) * (o - c);
  if (Math.abs(a) < 1e-10) return null;
  const h = ((i - o) * (s - l) - (t - s) * (o - c)) / a, r = -((i - e) * (t - s) - (t - n) * (i - o)) / a;
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
    const l = e[s].x, a = e[s].y, h = e[c].x, r = e[c].y;
    a > t != r > t && i < (h - l) * (t - a) / (r - a) + l && (n = !n);
  }
  return n;
}
const gt = 1e-3;
class C {
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
    return new C(t.x, t.y);
  }
}
class ct {
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
class ce {
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
    return new D(new C(t.a.x, t.a.y), new C(t.b.x, t.b.y));
  }
}
class re {
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
    const e = new ct(1e6, 1e6, -1e6, -1e6);
    return this.toPoints(t).forEach((o) => {
      e.minX = Math.min(e.minX, o.x), e.minY = Math.min(e.minY, o.y), e.maxX = Math.max(e.maxX, o.x), e.maxY = Math.max(e.maxY, o.y);
    }), e;
  }
  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const t = new ce();
    return this.toPoints(!0).forEach((n) => {
      t.r = Math.max(t.r, Math.sqrt(n.x * n.x + n.y * n.y));
    }), t;
  }
}
class G extends re {
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
    return Math.abs(n - o) < gt;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(t, e) {
    let n = M.angleBetween(t.a, t.b), o = M.angleBetween(e.b, e.a);
    return Math.abs(n - o) < gt;
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
    var s = n.x - t.x, c = n.y - t.y, l = Math.sqrt(s * s + c * c);
    if (l <= Math.abs(o - e)) return [];
    var a = Math.atan2(c, s), h = Math.acos((e - o) / l);
    return [
      new D(
        {
          x: t.x + e * Math.cos(a + h),
          y: t.y + e * Math.sin(a + h)
        },
        {
          x: n.x + o * Math.cos(a + h),
          y: n.y + o * Math.sin(a + h)
        }
      ),
      new D(
        {
          x: t.x + e * Math.cos(a - h),
          y: t.y + e * Math.sin(a - h)
        },
        {
          x: n.x + o * Math.cos(a - h),
          y: n.y + o * Math.sin(a - h)
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
    let o = [{ x: t.x, y: t.y }], s = 1 / n, c = (e.x - t.x) * s, l = (e.y - t.y) * s;
    for (var a = 1; a < n; a++)
      o.push(new C(t.x + c * a, t.y + l * a));
    return o.push({ x: e.x, y: e.y }), o;
  }
  /**
   *
   * @param  {...Point} pts
   */
  static averagePoints(...t) {
    let e = new C(0, 0);
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
    let o = [{ x: t.x, y: t.y }], s = M.distanceBetween(t, e), c = n / s, l = Math.floor(1 / c), a = s % n;
    n += a / l, c = n / s;
    let h = c, r = 1, u = (e.x - t.x) * c, f = (e.y - t.y) * c;
    for (; h < 1; )
      o.push(new C(t.x + u * r, t.y + f * r)), h += c, r++;
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
    const e = new ct(1e6, 1e6, -1e6, -1e6);
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
    const e = new ct(1e6, 1e6, -1e6, -1e6);
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
    const o = t.a.x, s = t.a.y, c = t.b.x, l = t.b.y, a = e.a.x, h = e.a.y, r = e.b.x, u = e.b.y, f = c - o, d = l - s, y = r - a, m = u - h, b = (-d * (o - a) + f * (s - h)) / (-y * d + f * m), p = (y * (s - h) - m * (o - a)) / (-y * d + f * m);
    if (b >= 0 && b <= 1 && p >= 0 && p <= 1) {
      const x = o + p * f, g = s + p * d;
      let w = { x, y: g };
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
    return new C(t.x - e.x, t.y - e.y);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static add(t, e) {
    return new C(t.x + e.x, t.y + e.y);
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
    return C.clone(t);
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
    let s = new C(1e5, 1e5), c = new D(s, t), l = M.segmentSegmentsIntersections(c, e);
    return l.length % 2 != 0 && n && M.pointsEqual(t, l[0]) ? !1 : l.length % 2 != 0;
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
    const c = M.sign(t, e, n), l = M.sign(t, n, o), a = M.sign(t, o, e), h = c < 0 || l < 0 || a < 0, r = c > 0 || l > 0 || a > 0;
    if (!(h && r) && s) {
      let u = { a: e, b: n, tags: null };
      if (M.distancePointSegment(t, u) < 1 || (u.a = n, u.b = o, M.distancePointSegment(t, u) < 1) || (u.a = o, u.b = e, M.distancePointSegment(t, u) < 1)) return !1;
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
    let s = this.pointWithinTriangle(t.a, e, n, o, !1), c = this.pointWithinTriangle(t.b, e, n, o, !1), l = this.pointWithinTriangle(t.a, e, n, o, !0), a = this.pointWithinTriangle(t.b, e, n, o, !0);
    return M.averagePoints(t.a, t.b), l && a || l && c || a && s || s && c;
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
    new C(o.minX - 100, o.minY - 100);
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
    let s = (l) => {
      let a = [l[0]];
      for (let h = 0; h < l.length - 1; h++) {
        let r = new C(0, 0);
        h + 1 < l.length * 0.4 ? (r.x = (l[h].x * 40 + l[h + 1].x * 60) * 0.01, r.y = (l[h].y * 40 + l[h + 1].y * 60) * 0.01) : h + 1 > l.length * 0.6 ? (r.x = (l[h].x * 60 + l[h + 1].x * 40) * 0.01, r.y = (l[h].y * 60 + l[h + 1].y * 40) * 0.01) : (r.x = (l[h].x + l[h + 1].x) * 0.5, r.y = (l[h].y + l[h + 1].y) * 0.5), a.push(r);
      }
      return a.push(l[l.length - 1]), a;
    }, c = [t, e, n];
    for (let l = 0; l < o; l++)
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
    let o = {}, s = [], c = {}, l = (a) => {
      let h = `${Math.round(a.x * 1)}|${Math.round(a.y * 1)}`;
      return c[h] = a, h;
    };
    if (e) {
      let a = t.reduce((u, f) => u.concat(f.a, f.b), []), h = a.length;
      for (; h--; ) {
        let u = a[h], f = h;
        for (; f--; ) {
          let d = a[f];
          if (M.pointsEqual(u, d)) {
            a.splice(h, 1);
            break;
          }
        }
      }
      let r = t.length;
      for (; r--; ) {
        let u = t[r], f = [];
        if (a.forEach((d) => {
          M.distancePointSegment(d, u) < 0.1 && !M.pointsEqual(d, u.a) && !M.pointsEqual(d, u.b) && f.push(d);
        }), f.length) {
          f.sort((m, b) => {
            const p = M.distanceBetweenSquared(m, u.a), x = M.distanceBetweenSquared(b, u.a);
            return p < x ? -1 : p > x ? 1 : 0;
          });
          const d = [];
          let y = u.a;
          for (let m = 0; m < f.length; m++) {
            let b = f[m];
            d.push(new D(y, b)), y = b;
          }
          d.push(new D(y, u.b)), t.splice(r, 1, ...d);
        }
      }
    }
    if (n) {
      let a = t.length;
      for (; a--; ) {
        let h = a, r = !1;
        for (; h--; ) {
          let u = t[a], f = t[h], d = M.segmentSegmentIntersect(u, f, !0);
          d && (r = !0, t.splice(a, 1, new D(C.clone(u.a), C.clone(d)), new D(C.clone(d), C.clone(u.b))), t.splice(h, 1, new D(C.clone(f.a), C.clone(d)), new D(C.clone(d), C.clone(f.b))));
        }
        r && (a = t.length);
      }
    }
    return t.forEach((a) => {
      let h = l(a.a), r = l(a.b);
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
    let o = [], { originalPts: s, pts: c, cxs: l } = Z.getSegsAndConnections(t, e, n), a = (r) => s[r], h = (r, u) => l[r].length > l[u].length ? 1 : l[r].length < l[u].length ? -1 : 0;
    for (c.sort(h); c.length; ) {
      c.sort(h);
      let r = c.shift();
      for (; r; )
        if (l[r].length) {
          l[r].sort(h);
          let u = l[r].shift(), f = l[u].indexOf(r);
          f !== -1 && l[u].splice(f, 1), o.push(new D(a(r), a(u))), l[r].length && c.unshift(r), r = u;
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
    const l = o.filter((h) => s[h].length === 1), a = [];
    return l.forEach((h) => {
      const r = C.clone(c(h));
      if (e === 0) {
        a.push(r);
        return;
      }
      const u = c(s[h]), f = M.angleBetween(u, r), d = new C(0, e);
      M.rotatePoint(d, Math.PI * 0.5 - f), M.addToPoint(r, d), a.push(r);
    }), a;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills(t, e = 5) {
    t = t.concat();
    let { originalPts: n, cxs: o } = Z.getSegsAndConnections(t, !0, !0), s = (x) => {
      let g = `${Math.round(x.x * 1)}|${Math.round(x.y * 1)}`;
      return n[g] = x, g;
    }, c = [], l = [], a = 1e5, h = 1e5, r = -1e5, u = -1e5, f = 1e5, d = 1e5, y = [];
    for (let x in n) {
      let g = n[x];
      y.push(g), a = Math.min(a, g.x), h = Math.min(h, g.y), r = Math.max(r, g.x), u = Math.max(u, g.y);
    }
    y.sort((x, g) => x.x < g.x ? -1 : x.x > g.x ? 1 : 0), y.forEach((x, g) => {
      if (g > 0) {
        let w = y[g - 1], S = Math.round(Math.abs(x.x - w.x));
        S > 1 && (f = Math.min(f, S));
      }
    }), y.sort((x, g) => x.y < g.y ? -1 : x.y > g.y ? 1 : 0), y.forEach((x, g) => {
      if (g > 0) {
        let w = y[g - 1], S = Math.round(Math.abs(x.y - w.y));
        S > 1 && (d = Math.min(d, S));
      }
    });
    let m = f * 0.5, b = d * 0.5, p = [];
    for (let x = h; x < u; x += d)
      for (let g = a; g < r; g += f)
        p.push(new C(g + m, x + b));
    return p.forEach((x) => {
      let g = [];
      if (y.forEach((v) => {
        let E = M.distanceBetween(v, x);
        if (E < Math.max(f, d) * e) {
          let P = M.angleBetween(v, x);
          g.push({
            pt: v,
            dist: E,
            ang: P
          });
        }
      }), g.length < 4)
        return;
      let w = g.length;
      for (; w--; ) {
        let v = g[w].pt, E = new D(x, v);
        M.segmentSegmentsIntersections(E, t, !0).length > 0 && g.splice(w, 1);
      }
      for (g.sort((v, E) => v.ang < E.ang ? -1 : v.ang > E.ang ? 1 : 0), w = g.length; w--; ) {
        let v = g[w].pt, E = s(v), P = g.length, k = !1;
        for (; P--; ) {
          if (w === P)
            continue;
          let O = g[P].pt, F = s(O);
          if (o[E].indexOf(F) === -1) {
            k = !0;
            break;
          }
        }
        k || g.splice(w, 1);
      }
      let S = !0;
      if (g.forEach((v, E) => {
        let P = g[(E + 1) % g.length], k = s(v.pt), O = s(P.pt);
        o[k].indexOf(O) === -1 && (S = !1);
      }), S) {
        let v = g.map((k) => k.pt), E = M.averagePoints(...v), P = s(E);
        c.indexOf(P) === -1 && (c.push(P), l.push(v));
      }
    }), l;
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
  static segmentCollections(t, e = !1, n = !0, o = 1, s = !1, c = !1, l = !1) {
    let a = t.reduce((h, r) => h.concat(r.toSegments()), []);
    return tt.segments(a, e, n, o, s, c, l);
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
  static segments(t, e = !1, n = !0, o = 1, s = !1, c = !1, l = !1) {
    return t = tt._segments(t, e, n, o), s && (t = Z.pathOrder(t, c, l)), new G(t);
  }
  /**
   * JS fallback for segment optimization  
   * @private
   */
  static _segments(t, e, n, o) {
    const s = t;
    for (t = []; s.length; ) {
      let l = s.shift(), a = t.length, h = !1;
      for (; a--; ) {
        const r = t[a];
        if (D.isEqual(l, r)) {
          h = !0;
          break;
        }
      }
      h || t.push(l);
    }
    if (!e)
      for (let l = 0; l < 3; l++) {
        let a = t.length;
        for (; a--; ) {
          let h = t[a], r, u, f, d, y;
          for (let m = a - 1; m >= 0; m--) {
            let b = t[m], p = !1, x = !1;
            if (M.sameAngle(h, b) ? (p = !0, r = C.clone(h.a), u = C.clone(h.b), f = C.clone(b.a), d = C.clone(b.b)) : M.sameAngleRev(h, b) && (p = x = !0, r = C.clone(h.b), u = C.clone(h.a), f = C.clone(b.a), d = C.clone(b.b)), p && (y = M.angleBetween(r, u), M.rotatePoints(y, r, u, f, d), Math.abs(r.y - f.y) < 0.1 && u.x >= f.x - 1e-4 && r.x <= d.x + 1e-4)) {
              r.x < f.x && (x ? b.a = h.b : b.a = h.a), u.x > d.x && (x ? b.b = h.a : b.b = h.b), t.splice(a, 1);
              break;
            }
          }
        }
      }
    let c = t.length;
    for (; c--; ) {
      let l = t[c];
      if (!l) {
        t.splice(c, 1);
        continue;
      }
      if (n && M.distanceBetween(l.a, l.b) < o) {
        t.splice(c, 1);
        continue;
      }
    }
    return console.log(`[JS] Optimize: ${s.length + t.length} -> ${t.length} segments`), t;
  }
}
function bt(i, t) {
  const e = i.geometry, n = e.attributes.position, o = e.index;
  if (!n) return [];
  const s = /* @__PURE__ */ new Map(), c = 1e3, l = (u, f) => {
    const d = Math.round(u.x * c), y = Math.round(u.y * c), m = Math.round(u.z * c), b = Math.round(f.x * c), p = Math.round(f.y * c), x = Math.round(f.z * c), g = `${d},${y},${m}`, w = `${b},${p},${x}`;
    return g < w ? `${g}|${w}` : `${w}|${g}`;
  }, a = (u) => new $(
    n.getX(u),
    n.getY(u),
    n.getZ(u)
  ).applyMatrix4(i.matrixWorld), h = (u, f, d) => {
    const y = new $().subVectors(f, u), m = new $().subVectors(d, u);
    return new $().crossVectors(y, m).normalize();
  }, r = o ? o.count / 3 : n.count / 3;
  for (let u = 0; u < r; u++) {
    let f, d, y;
    o ? (f = o.getX(u * 3), d = o.getX(u * 3 + 1), y = o.getX(u * 3 + 2)) : (f = u * 3, d = u * 3 + 1, y = u * 3 + 2);
    const m = a(f), b = a(d), p = a(y), x = h(m, b, p), g = new $().addVectors(m, b).add(p).divideScalar(3), w = new $().subVectors(t, g);
    if (x.dot(w) <= 0)
      continue;
    const S = [
      [m, b],
      [b, p],
      [p, m]
    ];
    for (const [v, E] of S) {
      const P = l(v, E);
      if (s.has(P)) {
        const k = s.get(P);
        k && !k.normal2 && (k.normal2 = x.clone(), k.faceIdx2 = u);
      } else
        s.set(P, {
          a: v.clone(),
          b: E.clone(),
          normal1: x.clone(),
          faceIdx1: u,
          mesh: i
        });
    }
  }
  return Array.from(s.values());
}
function wt(i, t) {
  return i.filter((e) => {
    const n = new $().addVectors(e.a, e.b).multiplyScalar(0.5), o = new $().subVectors(t, n).normalize(), s = e.normal1.dot(o) > 0;
    if (!e.normal2)
      return !0;
    const c = e.normal2.dot(o) > 0;
    return s || c;
  });
}
function Mt(i, t, e = 0.99) {
  const n = [], o = [];
  for (const s of i) {
    const c = new $().addVectors(s.a, s.b).multiplyScalar(0.5), l = new $().subVectors(t, c).normalize(), a = s.normal1.dot(l) > 0, h = s.normal2 ? s.normal2.dot(l) > 0 : !0;
    if (a !== h || !s.normal2) {
      n.push(s);
      continue;
    }
    s.normal2 && s.normal1.dot(s.normal2) < e && o.push(s);
  }
  return console.log(`classifyEdges: ${n.length} profiles, ${o.length} smooth/crease edges`), { profiles: n, smoothFiltered: o };
}
function rt(i, t, e, n, o = 1) {
  const s = e / 2, c = n / 2, l = (a) => {
    const h = a.clone().project(t);
    return new W(
      h.x * s * o,
      -h.y * c * o
    );
  };
  return i.map((a) => ({
    a: l(a.a),
    b: l(a.b),
    a3d: a.a.clone(),
    b3d: a.b.clone(),
    midpoint3d: new $().addVectors(a.a, a.b).multiplyScalar(0.5),
    isProfile: !1,
    // Will be set by classifyEdges
    visible: !0,
    faceIdx: a.faceIdx1,
    faceIdx2: a.faceIdx2,
    mesh: a.mesh,
    isHatch: a.isHatch,
    normal1: a.normal1,
    // Propagate normals for straggler detection
    normal2: a.normal2
  }));
}
class ae {
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
      const l = c / s, a = t.a.x + l * (t.b.x - t.a.x), h = t.a.y + l * (t.b.y - t.a.y);
      e.add(this.getCellKey(a, h));
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
function le(i, t) {
  const e = i.a.x, n = i.a.y, o = i.b.x, s = i.b.y, c = t.a.x, l = t.a.y, a = t.b.x, h = t.b.y, r = (e - o) * (l - h) - (n - s) * (c - a);
  if (Math.abs(r) < 1e-10) return null;
  const u = ((e - c) * (l - h) - (n - l) * (c - a)) / r, f = -((e - o) * (n - l) - (n - s) * (e - c)) / r, d = 1e-3;
  return u > d && u < 1 - d && f > d && f < 1 - d ? {
    t1: u,
    t2: f,
    point: new W(
      e + u * (o - e),
      n + u * (s - n)
    )
  } : null;
}
function Et(i) {
  var c, l, a, h, r, u;
  const t = /* @__PURE__ */ new Map(), e = 0.01, n = (f, d) => {
    const y = d.b.x - d.a.x, m = d.b.y - d.a.y, b = y * y + m * m;
    if (b < 1e-10) return null;
    const p = ((f.x - d.a.x) * y + (f.y - d.a.y) * m) / b;
    if (p <= e || p >= 1 - e) return null;
    const x = d.a.x + p * y, g = d.a.y + p * m;
    return (f.x - x) * (f.x - x) + (f.y - g) * (f.y - g) < 1 ? p : null;
  }, o = /* @__PURE__ */ new Set();
  for (let f = 0; f < i.length; f++)
    for (let d = f + 1; d < i.length; d++) {
      const y = le(i[f], i[d]);
      if (y)
        t.has(i[f]) || t.set(i[f], []), t.has(i[d]) || t.set(i[d], []), (c = t.get(i[f])) == null || c.push({ t: y.t1, point: y.point }), (l = t.get(i[d])) == null || l.push({ t: y.t2, point: y.point });
      else {
        const m = n(i[f].a, i[d]);
        m !== null && (t.has(i[d]) || t.set(i[d], []), (a = t.get(i[d])) == null || a.push({ t: m, point: i[f].a.clone() }), o.add(i[f]), o.add(i[d]));
        const b = n(i[f].b, i[d]);
        b !== null && (t.has(i[d]) || t.set(i[d], []), (h = t.get(i[d])) == null || h.push({ t: b, point: i[f].b.clone() }), o.add(i[f]), o.add(i[d]));
        const p = n(i[d].a, i[f]);
        p !== null && (t.has(i[f]) || t.set(i[f], []), (r = t.get(i[f])) == null || r.push({ t: p, point: i[d].a.clone() }), o.add(i[f]), o.add(i[d]));
        const x = n(i[d].b, i[f]);
        x !== null && (t.has(i[f]) || t.set(i[f], []), (u = t.get(i[f])) == null || u.push({ t: x, point: i[d].b.clone() }), o.add(i[f]), o.add(i[d]));
      }
    }
  console.log(`T-junction detection: ${o.size} potential straggler edges`);
  const s = [];
  for (const f of i) {
    const d = t.get(f), y = o.has(f);
    if (!d || d.length === 0) {
      f.isTJunctionStraggler = y, s.push(f);
      continue;
    }
    d.sort((p, x) => p.t - x.t);
    let m = f.a, b = f.a3d;
    for (const p of d) {
      const x = new $().lerpVectors(f.a3d, f.b3d, p.t);
      s.push({
        a: m.clone(),
        b: p.point.clone(),
        a3d: b.clone(),
        b3d: x.clone(),
        midpoint3d: new $().addVectors(b, x).multiplyScalar(0.5),
        isProfile: f.isProfile,
        visible: f.visible,
        faceIdx: f.faceIdx,
        mesh: f.mesh,
        isHatch: f.isHatch,
        normal1: f.normal1,
        // Propagate normal for smooth filter
        isTJunctionStraggler: y
      }), p.t, m = p.point, b = x;
    }
    s.push({
      a: m.clone(),
      b: f.b.clone(),
      a3d: b.clone(),
      b3d: f.b3d.clone(),
      midpoint3d: new $().addVectors(b, f.b3d).multiplyScalar(0.5),
      isProfile: f.isProfile,
      visible: f.visible,
      faceIdx: f.faceIdx,
      mesh: f.mesh,
      isHatch: f.isHatch,
      normal1: f.normal1,
      // Propagate normal for smooth filter
      isTJunctionStraggler: y
    });
  }
  return s;
}
function he(i, t, e, n, o, s, c = !1) {
  if (c)
    return i.forEach((y) => y.visible = !0), i;
  const l = [];
  if (!s)
    return console.warn("No renderer provided, skipping occlusion test"), i;
  const a = new lt(n, o, {
    minFilter: Q,
    magFilter: Q,
    format: qt,
    type: Yt
  }), h = new zt({
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
    side: At
  }), r = [];
  let u = 0;
  for (const y of t) {
    const m = y.geometry, b = m.attributes.position, p = m.index, x = p ? p.count / 3 : b.count / 3, g = [], w = [];
    for (let E = 0; E < x; E++) {
      let P, k, O;
      p ? (P = p.getX(E * 3), k = p.getX(E * 3 + 1), O = p.getX(E * 3 + 2)) : (P = E * 3, k = E * 3 + 1, O = E * 3 + 2);
      const F = new $(b.getX(P), b.getY(P), b.getZ(P)), H = new $(b.getX(k), b.getY(k), b.getZ(k)), I = new $(b.getX(O), b.getY(O), b.getZ(O));
      F.applyMatrix4(y.matrixWorld), H.applyMatrix4(y.matrixWorld), I.applyMatrix4(y.matrixWorld), g.push(F.x, F.y, F.z, H.x, H.y, H.z, I.x, I.y, I.z);
      const q = u + E + 1, X = (q & 255) / 255, T = (q >> 8 & 255) / 255, A = (q >> 16 & 255) / 255;
      w.push(X, T, A, X, T, A, X, T, A);
    }
    const S = new Dt();
    S.setAttribute("position", new dt(new Float32Array(g), 3)), S.setAttribute("faceColor", new dt(new Float32Array(w), 3));
    const v = new Wt(S, h);
    r.push(v), u += x;
  }
  const f = new Bt();
  for (const y of r)
    f.add(y);
  s.setRenderTarget(a), s.setClearColor(0, 1), s.clear(), s.render(f, e);
  const d = new Uint8Array(n * o * 4);
  s.readRenderTargetPixels(a, 0, 0, n, o, d), s.setRenderTarget(null);
  for (const y of i) {
    const m = (y.a.x + y.b.x) / 2, b = (y.a.y + y.b.y) / 2, p = Math.round(m + n / 2), x = Math.round(o / 2 + b);
    if (p < 0 || p >= n || x < 0 || x >= o) {
      y.visible = !0, l.push(y);
      continue;
    }
    const g = ((o - 1 - x) * n + p) * 4, w = d[g], S = d[g + 1], v = d[g + 2], E = w + (S << 8) + (v << 16);
    if (E === 0) {
      y.visible = !0, l.push(y);
      continue;
    }
    const P = y.faceIdx + 1;
    E === P ? (y.visible = !0, l.push(y)) : y.visible = !1;
  }
  a.dispose(), h.dispose();
  for (const y of r)
    y.geometry.dispose();
  return l;
}
function ue(i, t, e, n) {
  const o = (r, u, f) => (r.x - f.x) * (u.y - f.y) - (u.x - f.x) * (r.y - f.y), s = o(i, t, e), c = o(i, e, n), l = o(i, n, t), a = s < 0 || c < 0 || l < 0, h = s > 0 || c > 0 || l > 0;
  return !(a && h);
}
function fe(i, t, e, n, o = 2) {
  const s = n.x - e.x, c = n.y - e.y, l = s * s + c * c;
  if (l < 1e-10) return !1;
  const a = (h) => {
    const r = ((h.x - e.x) * s + (h.y - e.y) * c) / l, u = e.x + r * s, f = e.y + r * c;
    return (h.x - u) * (h.x - u) + (h.y - f) * (h.y - f) < o * o && r >= -0.01 && r <= 1.01;
  };
  return a(i) && a(t);
}
function de(i, t) {
  const e = [];
  for (const n of t) {
    const o = [
      { a: n.a2d, b: n.b2d, name: "AB" },
      { a: n.b2d, b: n.c2d, name: "BC" },
      { a: n.c2d, b: n.a2d, name: "CA" }
    ];
    for (const s of o)
      if (fe(i.a, i.b, s.a, s.b)) {
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
function xe(i, t, e, n, o, s, c) {
  const l = { x: n.x - t.x, y: n.y - t.y }, a = { x: e.x - t.x, y: e.y - t.y }, h = { x: i.x - t.x, y: i.y - t.y }, r = l.x * l.x + l.y * l.y, u = l.x * a.x + l.y * a.y, f = l.x * h.x + l.y * h.y, d = a.x * a.x + a.y * a.y, y = a.x * h.x + a.y * h.y, m = r * d - u * u;
  if (Math.abs(m) < 1e-10) return 1 / 0;
  const b = (d * f - u * y) / m, p = (r * y - u * f) / m;
  return (1 - b - p) * o + p * s + b * c;
}
function ge(i, t, e = 0.99, n = 0.5) {
  const o = [];
  let s = 0;
  for (const c of i) {
    const l = de(c, t);
    c.adjacentFaceCount = l.length;
    let a = !1;
    if (l.length === 2) {
      const h = l[0].face, r = l[1].face, u = h.normal, f = r.normal;
      if (u && f) {
        const d = u.dot(f), y = Math.abs(d);
        c.faceSimilarity = y;
        let m;
        d > 0 ? m = Math.abs(h.constant - r.constant) : m = Math.abs(h.constant + r.constant), y >= e && m < n && (a = !0, s++);
      }
    } else if (l.length > 2) {
      const h = l.map((r) => r.face).filter((r) => r.normal);
      if (h.length >= 2) {
        let r = !0, u = 1;
        for (let f = 1; f < h.length; f++) {
          const d = h[0].normal.dot(h[f].normal), y = Math.abs(d);
          let m;
          if (d > 0 ? m = Math.abs(h[0].constant - h[f].constant) : m = Math.abs(h[0].constant + h[f].constant), u = Math.min(u, y), y < e || m >= n) {
            r = !1;
            break;
          }
        }
        c.faceSimilarity = u, r && (a = !0, s++);
      }
    }
    a || o.push(c);
  }
  return console.log(`Geometric straggler filter: removed ${s} coplanar edges`), o;
}
function ye(i, t, e) {
  const n = e.position;
  return pe(i, t, n);
}
function pe(i, t, e) {
  const n = [];
  let o = 0, s = 0;
  for (const c of i) {
    const l = new W(
      (c.a.x + c.b.x) / 2,
      (c.a.y + c.b.y) / 2
    ), a = c.midpoint3d, h = e.distanceTo(a);
    let r = !1;
    for (const u of t) {
      if (u.mesh === c.mesh && (u.faceIdx === c.faceIdx || u.faceIdx === c.faceIdx2) || !ue(l, u.a2d, u.b2d, u.c2d))
        continue;
      if (xe(
        l,
        u.a2d,
        u.b2d,
        u.c2d,
        u.depthA,
        u.depthB,
        u.depthC
      ) < h - 1e-3) {
        r = !0, s++;
        break;
      }
      o++;
    }
    r ? c.visible = !1 : (c.visible = !0, n.push(c));
  }
  return console.log(`[JS] Occlusion debug: ${o} point-in-triangle hits, ${s} occluded`), n;
}
function me(i, t, e, n = 0.05) {
  const o = new Ht(), s = [], c = [];
  t.traverse((l) => {
    l.isMesh && c.push(l);
  });
  for (const l of i) {
    const a = new $().subVectors(l.midpoint3d, e.position), h = a.clone().normalize(), r = a.length(), u = r * n;
    o.set(e.position.clone(), h);
    const f = o.intersectObjects(c, !0);
    if (f.length === 0)
      l.visible = !0, s.push(l);
    else {
      let d = !1;
      for (const y of f)
        if (!(y.distance >= r - u) && !(y.object === l.mesh && y.faceIndex === l.faceIdx)) {
          d = !0;
          break;
        }
      d ? l.visible = !1 : (l.visible = !0, s.push(l));
    }
  }
  return s;
}
function vt(i, t = 0.5) {
  const e = /* @__PURE__ */ new Map(), n = (s) => `${Math.round(s.x / t)},${Math.round(s.y / t)}`, o = (s) => {
    const c = n(s.a), l = n(s.b);
    return c < l ? `${c}-${l}` : `${l}-${c}`;
  };
  for (const s of i) {
    const c = o(s);
    e.has(c) || e.set(c, s);
  }
  return Array.from(e.values());
}
function St(i, t = 1, e = 50) {
  const n = (p) => `${Math.round(p.x / t)},${Math.round(p.y / t)}`, o = /* @__PURE__ */ new Map();
  for (const p of i)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const g = x === "a" ? p.a : p.b, w = n(g);
      o.has(w) || o.set(w, { edges: [], point: { x: g.x, y: g.y } }), o.get(w).edges.push({ edge: p, endpoint: x });
    }
  const s = [];
  for (const [p, x] of o)
    if (x.edges.length === 1) {
      const { edge: g, endpoint: w } = x.edges[0], S = x.point, v = w === "a" ? g.b : g.a, E = S.x - v.x, P = S.y - v.y, k = Math.sqrt(E * E + P * P);
      if (k < 1e-3) continue;
      s.push({
        key: p,
        edge: g,
        endpoint: w,
        point: S,
        otherPoint: v,
        dirX: E / k,
        dirY: P / k,
        len: k
      });
    }
  if (console.log(`Edge cleanup: found ${s.length} orphaned endpoints`), s.length === 0) return i;
  const c = (p, x, g, w) => {
    const S = x.x * w.y - x.y * w.x;
    if (Math.abs(S) < 1e-4) return null;
    const v = g.x - p.x, E = g.y - p.y, P = (v * w.y - E * w.x) / S, k = (v * x.y - E * x.x) / S;
    return { t1: P, t2: k };
  };
  let l = 0;
  const a = /* @__PURE__ */ new Set();
  for (let p = 0; p < s.length; p++) {
    const x = s[p];
    if (a.has(x.key)) continue;
    let g = null, w = null, S = 1 / 0;
    for (let v = 0; v < s.length; v++) {
      if (p === v) continue;
      const E = s[v];
      if (a.has(E.key) || Math.sqrt(
        (E.point.x - x.point.x) ** 2 + (E.point.y - x.point.y) ** 2
      ) > e * 2) continue;
      const k = c(
        { x: x.point.x, y: x.point.y },
        { x: x.dirX, y: x.dirY },
        { x: E.point.x, y: E.point.y },
        { x: E.dirX, y: E.dirY }
      );
      if (!k || k.t1 < -0.1 || k.t2 < -0.1 || k.t1 > e || k.t2 > e) continue;
      const O = x.point.x + k.t1 * x.dirX, F = x.point.y + k.t1 * x.dirY, H = k.t1 + k.t2;
      H < S && (S = H, g = E, w = { x: O, y: F });
    }
    if (g && w) {
      const v = yt(
        x.point,
        w,
        i,
        x.edge,
        g.edge
      ), E = yt(
        g.point,
        w,
        i,
        x.edge,
        g.edge
      );
      if (v || E)
        continue;
      x.endpoint === "a" ? (x.edge.a.x = w.x, x.edge.a.y = w.y) : (x.edge.b.x = w.x, x.edge.b.y = w.y), g.endpoint === "a" ? (g.edge.a.x = w.x, g.edge.a.y = w.y) : (g.edge.b.x = w.x, g.edge.b.y = w.y), a.add(x.key), a.add(g.key), l++;
    }
  }
  console.log(`Edge cleanup: extended ${l} pairs of edges to intersections`);
  let h = 0;
  for (const p of i) {
    const x = p.b.x - p.a.x, g = p.b.y - p.a.y;
    h += Math.sqrt(x * x + g * g);
  }
  const r = h / i.length, u = r / 8;
  console.log(`Edge cleanup: average edge length = ${r.toFixed(2)}, snap threshold = ${u.toFixed(2)}`);
  const f = /* @__PURE__ */ new Map();
  for (const p of i)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const g = x === "a" ? p.a : p.b, w = n(g);
      f.has(w) || f.set(w, { edges: [], point: g }), f.get(w).edges.push({ edge: p, endpoint: x });
    }
  const d = [];
  for (const [p, x] of f)
    x.edges.length === 1 && d.push({ key: p, ...x.edges[0], point: x.point });
  console.log(`Edge cleanup: ${d.length} orphaned endpoints before snap pass`);
  let y = 0;
  const m = /* @__PURE__ */ new Set();
  for (let p = 0; p < d.length; p++) {
    const x = d[p];
    if (m.has(x.key)) continue;
    let g = null, w = 1 / 0;
    for (let S = 0; S < d.length; S++) {
      if (p === S) continue;
      const v = d[S];
      if (m.has(v.key)) continue;
      const E = Math.sqrt(
        (v.point.x - x.point.x) ** 2 + (v.point.y - x.point.y) ** 2
      );
      E < w && (w = E, g = v);
    }
    if (g && w < u) {
      const S = (x.point.x + g.point.x) / 2, v = (x.point.y + g.point.y) / 2;
      x.endpoint === "a" ? (x.edge.a.x = S, x.edge.a.y = v) : (x.edge.b.x = S, x.edge.b.y = v), g.endpoint === "a" ? (g.edge.a.x = S, g.edge.a.y = v) : (g.edge.b.x = S, g.edge.b.y = v), m.add(x.key), m.add(g.key), y++;
    }
  }
  console.log(`Edge cleanup: snapped ${y} pairs of nearby orphans`);
  const b = d.length - y * 2;
  return console.log(`Edge cleanup: ${b} orphaned endpoints remaining`), i;
}
function be(i, t = 1) {
  const e = (c) => `${Math.round(c.x / t)},${Math.round(c.y / t)}`, n = /* @__PURE__ */ new Map();
  for (const c of i) {
    const l = e(c.a), a = e(c.b);
    n.set(l, (n.get(l) || 0) + 1), n.set(a, (n.get(a) || 0) + 1);
  }
  const o = i.filter((c) => {
    const l = e(c.a), a = e(c.b), h = n.get(l) || 0, r = n.get(a) || 0;
    return h >= 2 || r >= 2;
  }), s = i.length - o.length;
  return s > 0 && console.log(`Edge cleanup: removed ${s} isolated edges (orphaned at both ends)`), o;
}
function yt(i, t, e, n, o) {
  for (const c of e) {
    if (c === n || c === o) continue;
    const l = t.x - i.x, a = t.y - i.y, h = c.b.x - c.a.x, r = c.b.y - c.a.y, u = l * r - a * h;
    if (Math.abs(u) < 1e-3) continue;
    const f = c.a.x - i.x, d = c.a.y - i.y, y = (f * r - d * h) / u, m = (f * a - d * l) / u;
    if (y > 1e-3 && y < 1 - 1e-3 && m > 1e-3 && m < 1 - 1e-3)
      return !0;
  }
  return !1;
}
function Se(i, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    occlusionEpsilon: c = 0.01,
    // 1% depth tolerance for depth buffer
    skipOcclusion: l = !1,
    width: a = 800,
    height: h = 600,
    renderer: r = null
  } = n;
  console.time("extractEdges");
  const u = bt(i, t.position);
  console.timeEnd("extractEdges"), console.log(`Extracted ${u.length} edges`), console.time("filterBackfacing");
  const f = wt(u, t.position);
  console.timeEnd("filterBackfacing"), console.log(`After backface filter: ${f.length} edges`), console.time("classifyEdges");
  const { profiles: d, smoothFiltered: y } = Mt(f, t.position, o);
  console.timeEnd("classifyEdges"), console.log(`Profiles: ${d.length}, Smooth edges: ${y.length}`);
  const m = [...d, ...y];
  console.time("projectEdges");
  let b = rt(m, t, a, h);
  console.timeEnd("projectEdges");
  for (let P = 0; P < d.length; P++)
    b[P].isProfile = !0;
  console.time("spatialHash");
  const p = Math.max(a, h) / s, x = new ae(p);
  for (const P of b)
    x.insert(P);
  console.timeEnd("spatialHash"), console.time("splitIntersections");
  const g = /* @__PURE__ */ new Set();
  let w = [];
  for (const P of x.getAllCells()) {
    const k = x.query(P).filter((F) => !g.has(F)), O = Et(k);
    w.push(...O);
    for (const F of k) g.add(F);
  }
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${w.length} edges`);
  let S;
  if (l)
    console.log("Skipping occlusion test (debug mode)"), S = w;
  else if (r) {
    console.time("testOcclusion (face ID buffer)");
    const P = w.filter((F) => F.isProfile), k = w.filter((F) => !F.isProfile);
    P.forEach((F) => F.visible = !0);
    const O = he(k, [i], t, a, h, r, !1);
    S = [...P, ...O], console.timeEnd("testOcclusion (face ID buffer)");
  } else
    console.time("testOcclusion (raycaster - slow)"), S = me(w, e, t, c), console.timeEnd("testOcclusion (raycaster - slow)");
  console.log(`Visible edges: ${S.length}`), console.time("optimize");
  const v = vt(S);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const E = St(v);
  return console.timeEnd("cleanup orphans"), console.log(`Final edges: ${E.length}`), {
    edges: E,
    profiles: E.filter((P) => P.isProfile)
  };
}
function we(i, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    skipOcclusion: c = !1,
    width: l = 800,
    height: a = 600,
    renderer: h = null,
    internalScale: r = 4,
    // Scale up internally for better precision
    distanceThreshold: u = 0.5
    // Default plane distance threshold
  } = n;
  let f = [];
  for (const I of i) {
    I.updateMatrixWorld(!0);
    const q = bt(I, t.position);
    f.push(...q);
  }
  console.log(`Extracted ${f.length} edges from ${i.length} meshes`);
  const { profiles: d, smoothFiltered: y } = Mt(f, t.position, o);
  console.log(`Profiles: ${d.length}, Crease edges: ${y.length}`);
  const m = [...d, ...y];
  console.log(`After smooth filter: ${m.length} edges`);
  let b = rt(m, t, l, a, r);
  if (n.hatchEdges && n.hatchEdges.length > 0) {
    console.log(`Processing ${n.hatchEdges.length} hatch edges...`);
    let I = wt(n.hatchEdges, t.position);
    if (n.minHatchDotProduct !== void 0) {
      const X = n.minHatchDotProduct;
      I = I.filter((T) => {
        const A = new $().addVectors(T.a, T.b).multiplyScalar(0.5), z = new $().subVectors(t.position, A).normalize(), N = T.normal1.dot(z);
        return Math.abs(N) >= X;
      }), console.log(`Density filter: kept ${I.length} hatch edges (threshold ${X})`);
    }
    const q = rt(I, t, l, a, r);
    q.forEach((X) => X.isHatch = !0), b.push(...q), console.log(`Added ${q.length} visible hatch edges`);
  }
  console.time("splitIntersections");
  const p = Et(b);
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${p.length} edges`), console.time("buildProjectedFaces");
  const x = [], g = t.position, w = l / 2, S = a / 2;
  for (const I of i) {
    const q = I.geometry, X = q.attributes.position, T = q.index, A = T ? T.count / 3 : X.count / 3;
    for (let z = 0; z < A; z++) {
      let N, Y, B;
      T ? (N = T.getX(z * 3), Y = T.getX(z * 3 + 1), B = T.getX(z * 3 + 2)) : (N = z * 3, Y = z * 3 + 1, B = z * 3 + 2);
      const R = new $(X.getX(N), X.getY(N), X.getZ(N)).applyMatrix4(I.matrixWorld), V = new $(X.getX(Y), X.getY(Y), X.getZ(Y)).applyMatrix4(I.matrixWorld), j = new $(X.getX(B), X.getY(B), X.getZ(B)).applyMatrix4(I.matrixWorld), J = new $().subVectors(V, R), K = new $().subVectors(j, R), _ = new $().crossVectors(J, K).normalize(), et = new $().addVectors(R, V).add(j).divideScalar(3), nt = new $().subVectors(g, et), ot = -_.dot(R);
      if (_.dot(nt) <= 0) continue;
      const ht = R.clone().project(t), ut = V.clone().project(t), ft = j.clone().project(t), Pt = new W(ht.x * w * r, -ht.y * S * r), kt = new W(ut.x * w * r, -ut.y * S * r), $t = new W(ft.x * w * r, -ft.y * S * r), It = g.distanceTo(R), Ct = g.distanceTo(V), Ot = g.distanceTo(j);
      x.push({
        a2d: Pt,
        b2d: kt,
        c2d: $t,
        depthA: It,
        depthB: Ct,
        depthC: Ot,
        mesh: I,
        faceIdx: z,
        normal: _,
        // Store normal for post-split smooth filter
        constant: ot
        // Store plane constant for coplanar detection
      });
    }
  }
  console.timeEnd("buildProjectedFaces"), console.log(`Built ${x.length} projected faces for occlusion`), console.time("classifySilhouettes"), Me(p, x), console.timeEnd("classifySilhouettes"), console.time("filterSmoothSplitEdges");
  const v = ge(p, x, o, u);
  console.timeEnd("filterSmoothSplitEdges");
  let E;
  c ? E = v : (console.time("testOcclusion (math)"), E = ye(v, x, t), console.timeEnd("testOcclusion (math)")), console.log(`Visible edges: ${E.length}`), console.time("optimize");
  const P = vt(E);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const k = St(P);
  console.timeEnd("cleanup orphans");
  const O = be(k);
  console.log(`Final edges before optimization: ${O.length}`);
  let F = O;
  if (O.length > 0) {
    let I = 0;
    for (const T of O) {
      const A = T.b.x - T.a.x, z = T.b.y - T.a.y;
      I += Math.sqrt(A * A + z * z);
    }
    const q = I / O.length, X = q / 10;
    console.log(`Optimization: avgLen=${q.toFixed(2)}, trim limit=${X.toFixed(2)}`), console.time("Optimize.segments"), F = tt.segments(O, !1, !0, X, !1, !1, !1)._segments, console.timeEnd("Optimize.segments"), console.log(`After optimization: ${F.length} edges`);
  }
  for (const I of F)
    I.a.x /= r, I.a.y /= r, I.b.x /= r, I.b.y /= r;
  const H = F;
  return {
    edges: H,
    profiles: H.filter((I) => I.isProfile),
    allEdges: p,
    // For debug visualization
    projectedFaces: x
    // For face visualization
  };
}
function Me(i, t) {
  for (const o of i) {
    if (o.isHatch) {
      o.isSilhouette = !1;
      continue;
    }
    const s = (o.a.x + o.b.x) / 2, c = (o.a.y + o.b.y) / 2, l = o.b.x - o.a.x, a = o.b.y - o.a.y, h = Math.sqrt(l * l + a * a);
    if (h < 1e-3) {
      o.isSilhouette = !1;
      continue;
    }
    const r = -a / h, u = l / h, f = pt(s, c, r, u, 1e3, t), d = pt(s, c, -r, -u, 1e3, t);
    o.isSilhouette = !f || !d;
  }
  const n = i.filter((o) => o.isSilhouette).length;
  console.log(`Classified ${n} silhouette edges out of ${i.length}`);
}
function pt(i, t, e, n, o, s) {
  for (const c of s)
    if (Ee(i, t, e, n, o, c.a2d, c.b2d, c.c2d))
      return !0;
  return !1;
}
function Ee(i, t, e, n, o, s, c, l) {
  return !!(st(i, t, e, n, o, s.x, s.y, c.x, c.y) || st(i, t, e, n, o, c.x, c.y, l.x, l.y) || st(i, t, e, n, o, l.x, l.y, s.x, s.y));
}
function st(i, t, e, n, o, s, c, l, a) {
  const h = l - s, r = a - c, u = e * r - n * h;
  if (Math.abs(u) < 1e-10) return !1;
  const f = ((s - i) * r - (c - t) * h) / u, d = ((s - i) * n - (c - t) * e) / u;
  return f > 0.1 && f <= o && d >= 0 && d <= 1;
}
var L = (i) => Math.round(i * 100) / 100, at = function(i) {
  mt.call(this), this.node = i;
};
at.prototype = Object.create(mt.prototype);
at.prototype.constructor = at;
var Pe = function() {
  var i = this, t = document.createElementNS("http://www.w3.org/2000/svg", "svg"), e = document.createElementNS("http://www.w3.org/2000/svg", "g"), n = document.createElementNS("http://www.w3.org/2000/svg", "g"), o = document.createElementNS("http://www.w3.org/2000/svg", "g"), s, c, l, a, h = new Rt();
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
  }, this._glRenderer = null, this.autoClear = !0, this.setClearColor = function(u) {
    h.set(u);
  }, this.setPixelRatio = function() {
  }, this.setSize = function(u, f) {
    s = u, c = f, l = s / 2, a = c / 2, t.setAttribute("viewBox", -l + " " + -a + " " + s + " " + c), t.setAttribute("width", s), t.setAttribute("height", c);
  }, this.getSize = function() {
    return {
      width: s,
      height: c
    };
  }, this.setGLRenderer = function(u) {
    i._glRenderer = u;
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
  }, this.renderGPULayers = function(u, f) {
    if (!i._glRenderer) {
      console.warn("PlotterRenderer: WebGL renderer not set. Call setGLRenderer() first.");
      return;
    }
    const d = i._glRenderer;
    if (i.showSilhouettes || i.showHatches) {
      const y = Vt(d, u, f, {
        normalBuckets: i.silhouetteOptions.normalBuckets,
        simplifyTolerance: i.silhouetteOptions.simplifyTolerance,
        minArea: i.silhouetteOptions.minArea,
        insetPixels: i.showHatches ? i.hatchOptions.insetPixels : 0
      });
      if (i.showSilhouettes && y.forEach((m) => {
        if (m.boundary.length < 3) return;
        const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let p = "";
        m.boundary.forEach((v, E) => {
          const P = v.x, k = -v.y;
          p += (E === 0 ? "M" : "L") + L(P) + "," + L(k);
        }), p += "Z";
        const x = m.normal, g = Math.floor((x.x * 0.5 + 0.5) * 255), w = Math.floor((x.y * 0.5 + 0.5) * 255), S = Math.floor((x.z * 0.5 + 0.5) * 255);
        b.setAttribute("d", p), b.setAttribute("fill", `rgba(${g},${w},${S},0.3)`), b.setAttribute("stroke", "none"), e.appendChild(b);
      }), i.showHatches) {
        y.sort((b, p) => b.depth - p.depth);
        const m = y.map((b) => b.boundary);
        y.forEach((b, p) => {
          let x = ne(b, f, {
            baseSpacing: i.hatchOptions.baseSpacing,
            minSpacing: i.hatchOptions.minSpacing,
            maxSpacing: i.hatchOptions.maxSpacing,
            depthFactor: i.hatchOptions.depthFactor,
            insetPixels: i.hatchOptions.insetPixels,
            screenWidth: s,
            screenHeight: c,
            axisSettings: i.hatchOptions.axisSettings
          });
          for (let g = 0; g < p; g++)
            x = x.flatMap(
              (w) => oe(w, m[g])
            );
          x.forEach((g) => {
            const w = document.createElementNS("http://www.w3.org/2000/svg", "path"), S = `M${L(g.start.x)},${L(-g.start.y)}L${L(g.end.x)},${L(-g.end.y)}`;
            w.setAttribute("d", S), w.setAttribute("fill", "none"), w.setAttribute("stroke", i.hatchOptions.stroke), w.setAttribute("stroke-width", i.hatchOptions.strokeWidth), o.appendChild(w);
          });
        });
      }
      if (i.showEdges) {
        const m = [];
        u.traverse((b) => {
          b.isMesh && b.geometry && m.push(b);
        }), m.length > 0 && (we(m, f, u, {
          smoothThreshold: i.hiddenLineOptions.smoothThreshold,
          width: s,
          height: c
        }).edges || []).forEach((x) => {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "line");
          g.setAttribute("x1", L(x.a.x)), g.setAttribute("y1", L(x.a.y)), g.setAttribute("x2", L(x.b.x)), g.setAttribute("y2", L(x.b.y)), g.setAttribute("stroke", i.edgeOptions.stroke), g.setAttribute("stroke-width", i.edgeOptions.strokeWidth), n.appendChild(g);
        });
      }
    }
  }, this.render = function(u, f) {
    if (!(f instanceof Lt)) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }
  };
};
export {
  M as GeomUtil,
  tt as Optimize,
  Pe as PlotterRenderer,
  C as Point,
  at as SVGObject,
  D as Segment,
  G as Segments,
  St as cleanupOrphanedEdges,
  oe as clipLineOutsidePolygon,
  xt as clipLineToPolygon,
  Se as computeHiddenLines,
  we as computeHiddenLinesMultiple,
  Vt as extractNormalRegions,
  ne as generatePerspectiveHatches,
  vt as optimizeEdges
};
//# sourceMappingURL=three-plotter-renderer.es.js.map

import { Vector2 as B, WebGLRenderTarget as ut, NearestFilter as _, MeshNormalMaterial as Xt, MeshDepthMaterial as Yt, RGBADepthPacking as Tt, Vector3 as I, UnsignedByteType as zt, RGBAFormat as qt, ShaderMaterial as Dt, DoubleSide as At, BufferGeometry as Bt, BufferAttribute as gt, Mesh as Wt, Scene as Ht, Raycaster as Rt, Color as Lt, DirectionalLight as Vt, PointLight as Nt, SpotLight as jt, Camera as Jt, Object3D as bt } from "three";
function Zt(i, t, e, n = {}) {
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
  } = n, h = i.getSize(new B()), r = Math.floor(h.x * o), u = Math.floor(h.y * o), f = Math.round(l * o), g = Kt(i, t, e, r, u), x = Qt(i, t, e, r, u), { regionMap: m, normalLookup: b } = Ut(g, r, u), { labels: p, regionCount: d } = te(m, r, u);
  f > 0 && Gt(m, r, u, f);
  const y = [];
  for (let w = 1; w <= d; w++) {
    const S = ee(p, r, u, w);
    if (S.length < 3) continue;
    const v = at(S, a), M = Math.abs(se(v));
    if (M < c) continue;
    const P = ne(p, m, b, r, u, w), k = _t(p, x, r, u, w);
    y.push({
      boundary: v.map((F) => new B(
        F.x / o - h.x / 2,
        F.y / o - h.y / 2
        // Y already flipped during readback
      )),
      normal: P,
      depth: k,
      // 0-1 normalized depth
      area: M / (o * o),
      regionId: w
    });
  }
  return y;
}
function Kt(i, t, e, n, o) {
  const s = new ut(n, o, {
    minFilter: _,
    magFilter: _
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
function Qt(i, t, e, n, o) {
  const s = new ut(n, o, {
    minFilter: _,
    magFilter: _
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
function _t(i, t, e, n, o) {
  let s = 0, c = 0;
  for (let a = 0; a < n; a++)
    for (let l = 0; l < e; l++)
      if (i[a * e + l] === o) {
        const h = (a * e + l) * 4, r = t[h] / 255, u = t[h + 1] / 255, f = t[h + 2] / 255, g = t[h + 3] / 255, x = r + u / 256 + f / 65536 + g / 16777216;
        s += x, c++;
      }
  return c > 0 ? s / c : 0.5;
}
function Gt(i, t, e, n) {
  let o = i;
  for (let s = 0; s < n; s++) {
    const c = new Uint16Array(o);
    for (let a = 1; a < e - 1; a++)
      for (let l = 1; l < t - 1; l++) {
        const h = a * t + l;
        if (o[h] === 0) continue;
        const u = o[h - 1], f = o[h + 1], g = o[h - t], x = o[h + t];
        (u === 0 || f === 0 || g === 0 || x === 0) && (c[h] = 0);
      }
    o = c;
  }
  return o;
}
function Ut(i, t, e, n) {
  const o = new Uint16Array(t * e), s = {};
  let c = 1;
  const a = {};
  for (let l = 0; l < t * e; l++) {
    const h = l * 4, r = i[h], u = i[h + 1], f = i[h + 2];
    if (r < 5 && u < 5 && f < 5) {
      o[l] = 0;
      continue;
    }
    const g = r / 255 * 2 - 1, x = u / 255 * 2 - 1, m = f / 255 * 2 - 1, b = 4, p = Math.round(r / b) * b, d = Math.round(u / b) * b, y = Math.round(f / b) * b, w = `${p}|${d}|${y}`;
    a[w] || (a[w] = c, s[c] = new I(g, x, m).normalize(), c++), o[l] = a[w];
  }
  return { regionMap: o, normalLookup: s };
}
function te(i, t, e) {
  const n = new Uint32Array(t * e), o = [];
  let s = 1;
  function c(r) {
    return o[r] !== r && (o[r] = c(o[r])), o[r];
  }
  function a(r, u) {
    const f = c(r), g = c(u);
    f !== g && (o[g] = f);
  }
  for (let r = 0; r < e; r++)
    for (let u = 0; u < t; u++) {
      const f = r * t + u, g = i[f];
      if (g === 0) continue;
      const x = [];
      if (u > 0 && i[f - 1] === g && n[f - 1] > 0 && x.push(n[f - 1]), r > 0 && i[f - t] === g && n[f - t] > 0 && x.push(n[f - t]), x.length === 0)
        n[f] = s, o[s] = s, s++;
      else {
        const m = Math.min(...x);
        n[f] = m;
        for (const b of x)
          a(m, b);
      }
    }
  const l = {};
  let h = 0;
  for (let r = 0; r < t * e; r++) {
    if (n[r] === 0) continue;
    const u = c(n[r]);
    l[u] === void 0 && (h++, l[u] = h), n[r] = l[u];
  }
  return { labels: n, regionCount: h };
}
function ee(i, t, e, n) {
  const o = [];
  let s = -1, c = -1;
  t: for (let x = 0; x < e; x++)
    for (let m = 0; m < t; m++)
      if (i[x * t + m] === n && (m === 0 || i[x * t + m - 1] !== n || x === 0 || i[(x - 1) * t + m] !== n)) {
        s = m, c = x;
        break t;
      }
  if (s === -1) return o;
  const a = [1, 1, 0, -1, -1, -1, 0, 1], l = [0, 1, 1, 1, 0, -1, -1, -1];
  let h = s, r = c, u = 7;
  const f = t * e * 2;
  let g = 0;
  do {
    o.push({ x: h, y: r });
    let x = !1;
    for (let m = 0; m < 8; m++) {
      const b = (u + 6 + m) % 8, p = h + a[b], d = r + l[b];
      if (p >= 0 && p < t && d >= 0 && d < e && i[d * t + p] === n) {
        h = p, r = d, u = b, x = !0;
        break;
      }
    }
    if (!x) break;
    g++;
  } while ((h !== s || r !== c) && g < f);
  return o;
}
function ne(i, t, e, n, o, s) {
  let c = 0, a = 0, l = 0;
  for (let g = 0; g < o; g++)
    for (let x = 0; x < n; x++)
      i[g * n + x] === s && (c += x, a += g, l++);
  if (l === 0) return new I(0, 0, 1);
  const h = Math.round(c / l), u = Math.round(a / l) * n + h, f = t[u];
  return e[f] || new I(0, 0, 1);
}
function at(i, t) {
  if (i.length < 3) return i;
  let e = 0, n = 0;
  const o = i[0], s = i[i.length - 1];
  for (let c = 1; c < i.length - 1; c++) {
    const a = oe(i[c], o, s);
    a > e && (e = a, n = c);
  }
  if (e > t) {
    const c = at(i.slice(0, n + 1), t), a = at(i.slice(n), t);
    return c.slice(0, -1).concat(a);
  } else
    return [o, s];
}
function oe(i, t, e) {
  const n = e.x - t.x, o = e.y - t.y, s = n * n + o * o;
  if (s < 1e-10)
    return Math.sqrt((i.x - t.x) ** 2 + (i.y - t.y) ** 2);
  let c = ((i.x - t.x) * n + (i.y - t.y) * o) / s;
  c = Math.max(0, Math.min(1, c));
  const a = t.x + c * n, l = t.y + c * o;
  return Math.sqrt((i.x - a) ** 2 + (i.y - l) ** 2);
}
function se(i) {
  let t = 0;
  for (let e = 0; e < i.length; e++) {
    const n = (e + 1) % i.length;
    t += i[e].x * i[n].y, t -= i[n].x * i[e].y;
  }
  return t / 2;
}
function ie(i, t, e, n) {
  const o = e / 2, s = n / 2, c = new I(0, 1, 0), a = new I(0, 0, 1);
  let l;
  Math.abs(i.y) > 0.9 ? l = a.clone() : (l = new I().crossVectors(c, i).normalize(), l.lengthSq() < 0.01 && (l = a.clone()));
  const h = new I(0, 0, 0), r = l.clone().multiplyScalar(100), u = h.clone().project(t), f = r.clone().project(t), g = new B(
    u.x * o,
    -u.y * s
  ), m = new B(
    f.x * o,
    -f.y * s
  ).clone().sub(g).normalize(), p = l.clone().multiplyScalar(1e5).clone().project(t);
  let d = null;
  return Math.abs(p.x) < 100 && Math.abs(p.y) < 100 && p.z < 1 && (d = new B(
    p.x * o,
    -p.y * s
  )), { direction: m, vanishingPoint: d };
}
function ce(i, t, e = {}) {
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
    axisSettings: h = {},
    // { x: { rotation: 0, spacing: 10 }, y: ... }
    brightness: r = null,
    // 0-1 lighting brightness (null = disabled)
    invertBrightness: u = !1
    // True for white-on-black (bright = dense)
  } = e, { boundary: f, normal: g, depth: x = 0.5 } = i;
  if (f.length < 3) return [];
  const m = Math.abs(g.x), b = Math.abs(g.y), p = Math.abs(g.z);
  let d = "y";
  m >= b && m >= p ? d = "x" : p >= b && p >= m && (d = "z");
  const y = h[d] || {}, w = y.rotation || 0, S = y.spacing;
  console.log(`[Hatch] normal=(${g.x.toFixed(2)}, ${g.y.toFixed(2)}, ${g.z.toFixed(2)}) => axis=${d}, rotation=${w}, spacing=${S}`);
  const { direction: v, vanishingPoint: M } = ie(
    g,
    t,
    a,
    l
  );
  let P = v;
  if (w !== 0) {
    const T = w * (Math.PI / 180), D = Math.cos(T), L = Math.sin(T);
    P = new B(
      v.x * D - v.y * L,
      v.x * L + v.y * D
    );
  }
  const k = new B(-P.y, P.x);
  let O = Math.max(o, Math.min(
    s,
    (S !== void 0 ? S : n) + x * c * (s - o)
  ));
  if (r != null) {
    const D = 0.5 + (u ? r : 1 - r) * 1.5;
    O = Math.max(o, Math.min(s, O * D));
  }
  let W = 1 / 0, $ = -1 / 0, z = 1 / 0, X = -1 / 0;
  for (const T of f)
    W = Math.min(W, T.x), $ = Math.max($, T.x), z = Math.min(z, T.y), X = Math.max(X, T.y);
  const Y = (W + $) / 2, R = (z + X) / 2, q = new B(Y, R), H = Math.sqrt(($ - W) ** 2 + (X - z) ** 2), N = [];
  if (M && Math.abs(w) < 5 && M.distanceTo(q) < H * 5) {
    const T = M.distanceTo(q), D = Math.ceil(H / O) * 2, K = Math.atan2(H, T) * 2 / D, G = Math.atan2(
      R - M.y,
      Y - M.x
    );
    for (let j = -D; j <= D; j++) {
      const Q = G + j * K, st = new B(Math.cos(Q), Math.sin(Q)), it = M.clone(), tt = M.clone().add(st.clone().multiplyScalar(T * 10)), et = xt({ start: it, end: tt }, f);
      N.push(...et);
    }
  } else {
    const T = Math.ceil(H / O) + 2;
    for (let D = -T; D <= T; D++) {
      const L = k.clone().multiplyScalar(D * O), K = q.clone().add(L), G = K.clone().add(P.clone().multiplyScalar(-H)), j = K.clone().add(P.clone().multiplyScalar(H)), Q = xt({ start: G, end: j }, f);
      N.push(...Q);
    }
  }
  return N;
}
function xt(i, t) {
  const e = [], n = t.length;
  for (let s = 0; s < n; s++) {
    const c = t[s], a = t[(s + 1) % n], l = le(
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
      point: new B(l.x, l.y),
      t: l.t
    });
  }
  if (e.length < 2) return [];
  e.sort((s, c) => s.t - c.t);
  const o = [];
  for (let s = 0; s < e.length - 1; s++) {
    const c = (e[s].point.x + e[s + 1].point.x) / 2, a = (e[s].point.y + e[s + 1].point.y) / 2;
    nt(c, a, t) && o.push({
      start: e[s].point,
      end: e[s + 1].point
    });
  }
  return o;
}
function re(i, t) {
  const e = [], n = t.length, o = nt(i.start.x, i.start.y, t), s = nt(i.end.x, i.end.y, t);
  e.push({ point: i.start.clone(), t: 0, inside: o });
  for (let l = 0; l < n; l++) {
    const h = t[l], r = t[(l + 1) % n], u = ae(
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
      point: new B(u.x, u.y),
      t: u.t,
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
    const h = (c[l].t + c[l + 1].t) / 2, r = i.start.x + h * (i.end.x - i.start.x), u = i.start.y + h * (i.end.y - i.start.y);
    nt(r, u, t) || a.push({
      start: c[l].point.clone(),
      end: c[l + 1].point.clone()
    });
  }
  return a;
}
function ae(i, t, e, n, o, s, c, a) {
  const l = (i - e) * (s - a) - (t - n) * (o - c);
  if (Math.abs(l) < 1e-10) return null;
  const h = ((i - o) * (s - a) - (t - s) * (o - c)) / l, r = -((i - e) * (t - s) - (t - n) * (i - o)) / l;
  return h >= 0 && h <= 1 && r >= 0 && r <= 1 ? {
    x: i + h * (e - i),
    y: t + h * (n - t),
    t: h
  } : null;
}
function le(i, t, e, n, o, s, c, a) {
  const l = (i - e) * (s - a) - (t - n) * (o - c);
  if (Math.abs(l) < 1e-10) return null;
  const h = ((i - o) * (s - a) - (t - s) * (o - c)) / l, r = -((i - e) * (t - s) - (t - n) * (i - o)) / l;
  return r >= 0 && r <= 1 ? {
    x: i + h * (e - i),
    y: t + h * (n - t),
    t: h
  } : null;
}
function nt(i, t, e) {
  let n = !1;
  const o = e.length;
  for (let s = 0, c = o - 1; s < o; c = s++) {
    const a = e[s].x, l = e[s].y, h = e[c].x, r = e[c].y;
    l > t != r > t && i < (h - a) * (t - l) / (r - l) + a && (n = !n);
  }
  return n;
}
const yt = 1e-3;
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
class lt {
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
class he {
  /**
   *
   * @param {number} r radius
   */
  constructor(t = 0) {
    this.r = t;
  }
}
class A {
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
    return E.pointsEqual(t.a, e.a) && E.pointsEqual(t.b, e.b) || E.pointsEqual(t.b, e.a) && E.pointsEqual(t.a, e.b);
  }
  /**
   * @param {Segment} seg
   */
  static clone(t) {
    return new A(new C(t.a.x, t.a.y), new C(t.b.x, t.b.y));
  }
}
class fe {
  constructor() {
    this.pivot = { x: 0, y: 0 }, this.rotation = 0, this.isOpen = !0, this.isGroup = !1, this.isStrong = !1, this._makeAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n, o) => {
        const s = { x: n.x, y: n.y };
        E.rotatePoint(s, e), s.x += this.pivot.x, s.y += this.pivot.y, t[o] = s;
      });
    }, this._makeSegsAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n) => {
        const o = { x: n.a.x, y: n.a.y }, s = { x: n.b.x, y: n.b.y };
        E.rotatePoint(o, e), E.rotatePoint(s, e), E.addToPoint(o, this.pivot), E.addToPoint(s, this.pivot), n.a = o, n.b = s;
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
    const e = new lt(1e6, 1e6, -1e6, -1e6);
    return this.toPoints(t).forEach((o) => {
      e.minX = Math.min(e.minX, o.x), e.minY = Math.min(e.minY, o.y), e.maxX = Math.max(e.maxX, o.x), e.maxY = Math.max(e.maxY, o.y);
    }), e;
  }
  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const t = new he();
    return this.toPoints(!0).forEach((n) => {
      t.r = Math.max(t.r, Math.sqrt(n.x * n.x + n.y * n.y));
    }), t;
  }
}
class U extends fe {
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
    let e = this._segments.reduce((n, o) => o ? n.concat(A.clone(o)) : n, []);
    return t || this._makeSegsAbsolute(e), e;
  }
  bake() {
  }
  result() {
    return U.clone(this);
  }
  /**
   *
   * @param {Segments} segs
   */
  static clone(t) {
    let e = t._segments, n = [], o = e.length;
    for (; o--; )
      n.unshift(A.clone(e[o]));
    let s = new U(n);
    return s.pivot.x = t.pivot.x, s.pivot.y = t.pivot.y, s.rotation = t.rotation, s;
  }
}
class E {
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
    let n = E.angleBetween(t.a, t.b), o = E.angleBetween(e.a, e.b);
    return Math.abs(n - o) < yt;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(t, e) {
    let n = E.angleBetween(t.a, t.b), o = E.angleBetween(e.b, e.a);
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
      x: E.lerp(t.x, e.x, n),
      y: E.lerp(t.y, e.y, n)
    };
  }
  /**
   *
   * @param {Point} pt the point to rotate in place
   * @param {number} deg angle in degrees
   */
  static rotatePointDeg(t, e) {
    E.rotatePoint(t, e * Math.PI / 180);
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
      E.rotatePoint(n, t);
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
      E.rotatePoint(o, n);
    });
  }
  // Based on http://stackoverflow.com/a/12037737
  static outerTangents(t, e, n, o) {
    var s = n.x - t.x, c = n.y - t.y, a = Math.sqrt(s * s + c * c);
    if (a <= Math.abs(o - e)) return [];
    var l = Math.atan2(c, s), h = Math.acos((e - o) / a);
    return [
      new A(
        {
          x: t.x + e * Math.cos(l + h),
          y: t.y + e * Math.sin(l + h)
        },
        {
          x: n.x + o * Math.cos(l + h),
          y: n.y + o * Math.sin(l + h)
        }
      ),
      new A(
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
      o.push(new C(t.x + c * l, t.y + a * l));
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
    let o = [{ x: t.x, y: t.y }], s = E.distanceBetween(t, e), c = n / s, a = Math.floor(1 / c), l = s % n;
    n += l / a, c = n / s;
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
    return E.pointsEqual(t.b, e.a, n) || E.pointsEqual(t.a, e.b, n);
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
      n > 0 && E.pointsEqual(o, e[n - 1]) && e.splice(n, 1);
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
    const e = new lt(1e6, 1e6, -1e6, -1e6);
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
    const e = new lt(1e6, 1e6, -1e6, -1e6);
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
    }), E.pointsBoundingBox(e);
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
    return E.polygonArea(t) > 0;
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
    const n = E.ccw;
    return n(t.a, e.a, e.b) != n(t.b, e.a, e.b) && n(t.a, t.b, e.a) != n(t.a, t.b, e.b);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {Point}
   */
  static segmentSegmentIntersect(t, e, n = !1) {
    const o = t.a.x, s = t.a.y, c = t.b.x, a = t.b.y, l = e.a.x, h = e.a.y, r = e.b.x, u = e.b.y, f = c - o, g = a - s, x = r - l, m = u - h, b = (-g * (o - l) + f * (s - h)) / (-x * g + f * m), p = (x * (s - h) - m * (o - l)) / (-x * g + f * m);
    if (b >= 0 && b <= 1 && p >= 0 && p <= 1) {
      const d = o + p * f, y = s + p * g;
      let w = { x: d, y };
      return n && (E.pointsEqual(w, e.a) || E.pointsEqual(w, e.b) || E.pointsEqual(w, t.a) || E.pointsEqual(w, t.b)) ? void 0 : w;
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
      let c = E.segmentSegmentIntersect(t, s, n);
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
    var n = E.sub(e.b, e.a), o = E.sub(t, e.a), s = E.dot(o, n);
    if (s < 0)
      t = e.a;
    else {
      var c = E.dot(n, n);
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
    return E.distanceBetween(t, E.closestPtPointSegment(t, e));
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
    const o = E.segmentsBoundingBox(e);
    if (!this.pointWithinBoundingBox(t, o))
      return !1;
    let s = new C(1e5, 1e5), c = new A(s, t), a = E.segmentSegmentsIntersections(c, e);
    return a.length % 2 != 0 && n && E.pointsEqual(t, a[0]) ? !1 : a.length % 2 != 0;
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
    const c = E.sign(t, e, n), a = E.sign(t, n, o), l = E.sign(t, o, e), h = c < 0 || a < 0 || l < 0, r = c > 0 || a > 0 || l > 0;
    if (!(h && r) && s) {
      let u = { a: e, b: n, tags: null };
      if (E.distancePointSegment(t, u) < 1 || (u.a = n, u.b = o, E.distancePointSegment(t, u) < 1) || (u.a = o, u.b = e, E.distancePointSegment(t, u) < 1)) return !1;
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
    return E.averagePoints(t.a, t.b), a && l || a && c || l && s || s && c;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {Segment[]}
   */
  static pointsToClosedPolySegments(...t) {
    let e = [];
    for (let n = 0; n < t.length; n++)
      e.push(new A(t[n], n < t.length - 1 ? t[n + 1] : t[0]));
    return e;
  }
  /**
   *
   * @param {Segment[]} polySegsA
   * @param {Segment[]} polySegsB
   * @returns {boolean}
   */
  static polygonWithinPolygon(t, e) {
    const n = E.segmentsBoundingBox(t), o = E.segmentsBoundingBox(e);
    if (!E.boundingBoxesIntersect(n, o))
      return !1;
    new C(o.minX - 100, o.minY - 100);
    for (let s = 0; s < t.length; s++) {
      let c = t[s];
      if (E.segmentSegmentsIntersections(c, e).length % 2 == 0)
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
        let r = new C(0, 0);
        h + 1 < a.length * 0.4 ? (r.x = (a[h].x * 40 + a[h + 1].x * 60) * 0.01, r.y = (a[h].y * 40 + a[h + 1].y * 60) * 0.01) : h + 1 > a.length * 0.6 ? (r.x = (a[h].x * 60 + a[h + 1].x * 40) * 0.01, r.y = (a[h].y * 60 + a[h + 1].y * 40) * 0.01) : (r.x = (a[h].x + a[h + 1].x) * 0.5, r.y = (a[h].y + a[h + 1].y) * 0.5), l.push(r);
      }
      return l.push(a[a.length - 1]), l;
    }, c = [t, e, n];
    for (let a = 0; a < o; a++)
      c = s(c);
    return c;
  }
}
class J {
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
      let l = t.reduce((u, f) => u.concat(f.a, f.b), []), h = l.length;
      for (; h--; ) {
        let u = l[h], f = h;
        for (; f--; ) {
          let g = l[f];
          if (E.pointsEqual(u, g)) {
            l.splice(h, 1);
            break;
          }
        }
      }
      let r = t.length;
      for (; r--; ) {
        let u = t[r], f = [];
        if (l.forEach((g) => {
          E.distancePointSegment(g, u) < 0.1 && !E.pointsEqual(g, u.a) && !E.pointsEqual(g, u.b) && f.push(g);
        }), f.length) {
          f.sort((m, b) => {
            const p = E.distanceBetweenSquared(m, u.a), d = E.distanceBetweenSquared(b, u.a);
            return p < d ? -1 : p > d ? 1 : 0;
          });
          const g = [];
          let x = u.a;
          for (let m = 0; m < f.length; m++) {
            let b = f[m];
            g.push(new A(x, b)), x = b;
          }
          g.push(new A(x, u.b)), t.splice(r, 1, ...g);
        }
      }
    }
    if (n) {
      let l = t.length;
      for (; l--; ) {
        let h = l, r = !1;
        for (; h--; ) {
          let u = t[l], f = t[h], g = E.segmentSegmentIntersect(u, f, !0);
          g && (r = !0, t.splice(l, 1, new A(C.clone(u.a), C.clone(g)), new A(C.clone(g), C.clone(u.b))), t.splice(h, 1, new A(C.clone(f.a), C.clone(g)), new A(C.clone(g), C.clone(f.b))));
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
    let o = [], { originalPts: s, pts: c, cxs: a } = J.getSegsAndConnections(t, e, n), l = (r) => s[r], h = (r, u) => a[r].length > a[u].length ? 1 : a[r].length < a[u].length ? -1 : 0;
    for (c.sort(h); c.length; ) {
      c.sort(h);
      let r = c.shift();
      for (; r; )
        if (a[r].length) {
          a[r].sort(h);
          let u = a[r].shift(), f = a[u].indexOf(r);
          f !== -1 && a[u].splice(f, 1), o.push(new A(l(r), l(u))), a[r].length && c.unshift(r), r = u;
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
    t = t.concat(), t = J.pathOrder(t, !0, !0);
    let { originalPts: n, pts: o, cxs: s } = J.getSegsAndConnections(t, !0), c = (h) => n[h];
    const a = o.filter((h) => s[h].length === 1), l = [];
    return a.forEach((h) => {
      const r = C.clone(c(h));
      if (e === 0) {
        l.push(r);
        return;
      }
      const u = c(s[h]), f = E.angleBetween(u, r), g = new C(0, e);
      E.rotatePoint(g, Math.PI * 0.5 - f), E.addToPoint(r, g), l.push(r);
    }), l;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills(t, e = 5) {
    t = t.concat();
    let { originalPts: n, cxs: o } = J.getSegsAndConnections(t, !0, !0), s = (d) => {
      let y = `${Math.round(d.x * 1)}|${Math.round(d.y * 1)}`;
      return n[y] = d, y;
    }, c = [], a = [], l = 1e5, h = 1e5, r = -1e5, u = -1e5, f = 1e5, g = 1e5, x = [];
    for (let d in n) {
      let y = n[d];
      x.push(y), l = Math.min(l, y.x), h = Math.min(h, y.y), r = Math.max(r, y.x), u = Math.max(u, y.y);
    }
    x.sort((d, y) => d.x < y.x ? -1 : d.x > y.x ? 1 : 0), x.forEach((d, y) => {
      if (y > 0) {
        let w = x[y - 1], S = Math.round(Math.abs(d.x - w.x));
        S > 1 && (f = Math.min(f, S));
      }
    }), x.sort((d, y) => d.y < y.y ? -1 : d.y > y.y ? 1 : 0), x.forEach((d, y) => {
      if (y > 0) {
        let w = x[y - 1], S = Math.round(Math.abs(d.y - w.y));
        S > 1 && (g = Math.min(g, S));
      }
    });
    let m = f * 0.5, b = g * 0.5, p = [];
    for (let d = h; d < u; d += g)
      for (let y = l; y < r; y += f)
        p.push(new C(y + m, d + b));
    return p.forEach((d) => {
      let y = [];
      if (x.forEach((v) => {
        let M = E.distanceBetween(v, d);
        if (M < Math.max(f, g) * e) {
          let P = E.angleBetween(v, d);
          y.push({
            pt: v,
            dist: M,
            ang: P
          });
        }
      }), y.length < 4)
        return;
      let w = y.length;
      for (; w--; ) {
        let v = y[w].pt, M = new A(d, v);
        E.segmentSegmentsIntersections(M, t, !0).length > 0 && y.splice(w, 1);
      }
      for (y.sort((v, M) => v.ang < M.ang ? -1 : v.ang > M.ang ? 1 : 0), w = y.length; w--; ) {
        let v = y[w].pt, M = s(v), P = y.length, k = !1;
        for (; P--; ) {
          if (w === P)
            continue;
          let F = y[P].pt, O = s(F);
          if (o[M].indexOf(O) === -1) {
            k = !0;
            break;
          }
        }
        k || y.splice(w, 1);
      }
      let S = !0;
      if (y.forEach((v, M) => {
        let P = y[(M + 1) % y.length], k = s(v.pt), F = s(P.pt);
        o[k].indexOf(F) === -1 && (S = !1);
      }), S) {
        let v = y.map((k) => k.pt), M = E.averagePoints(...v), P = s(M);
        c.indexOf(P) === -1 && (c.push(P), a.push(v));
      }
    }), a;
  }
}
class ot {
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
    return ot.segments(l, e, n, o, s, c, a);
  }
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollectionsPathOrder(t, e = !1, n = !1) {
    let o = t.reduce((s, c) => s.concat(c.toSegments()), []);
    return new U(J.pathOrder(o, e, n));
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
    return t = ot._segments(t, e, n, o), s && (t = J.pathOrder(t, c, a)), new U(t);
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
        if (A.isEqual(a, r)) {
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
          let h = t[l], r, u, f, g, x;
          for (let m = l - 1; m >= 0; m--) {
            let b = t[m], p = !1, d = !1;
            if (E.sameAngle(h, b) ? (p = !0, r = C.clone(h.a), u = C.clone(h.b), f = C.clone(b.a), g = C.clone(b.b)) : E.sameAngleRev(h, b) && (p = d = !0, r = C.clone(h.b), u = C.clone(h.a), f = C.clone(b.a), g = C.clone(b.b)), p && (x = E.angleBetween(r, u), E.rotatePoints(x, r, u, f, g), Math.abs(r.y - f.y) < 0.1 && u.x >= f.x - 1e-4 && r.x <= g.x + 1e-4)) {
              r.x < f.x && (d ? b.a = h.b : b.a = h.a), u.x > g.x && (d ? b.b = h.a : b.b = h.b), t.splice(l, 1);
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
      if (n && E.distanceBetween(a.a, a.b) < o) {
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
  const s = /* @__PURE__ */ new Map(), c = 1e3, a = (u, f) => {
    const g = Math.round(u.x * c), x = Math.round(u.y * c), m = Math.round(u.z * c), b = Math.round(f.x * c), p = Math.round(f.y * c), d = Math.round(f.z * c), y = `${g},${x},${m}`, w = `${b},${p},${d}`;
    return y < w ? `${y}|${w}` : `${w}|${y}`;
  }, l = (u) => new I(
    n.getX(u),
    n.getY(u),
    n.getZ(u)
  ).applyMatrix4(i.matrixWorld), h = (u, f, g) => {
    const x = new I().subVectors(f, u), m = new I().subVectors(g, u);
    return new I().crossVectors(x, m).normalize();
  }, r = o ? o.count / 3 : n.count / 3;
  for (let u = 0; u < r; u++) {
    let f, g, x;
    o ? (f = o.getX(u * 3), g = o.getX(u * 3 + 1), x = o.getX(u * 3 + 2)) : (f = u * 3, g = u * 3 + 1, x = u * 3 + 2);
    const m = l(f), b = l(g), p = l(x), d = h(m, b, p), y = new I().addVectors(m, b).add(p).divideScalar(3), w = new I().subVectors(t, y);
    if (d.dot(w) <= 0)
      continue;
    const S = [
      [m, b],
      [b, p],
      [p, m]
    ];
    for (const [v, M] of S) {
      const P = a(v, M);
      if (s.has(P)) {
        const k = s.get(P);
        k && !k.normal2 && (k.normal2 = d.clone(), k.faceIdx2 = u);
      } else
        s.set(P, {
          a: v.clone(),
          b: M.clone(),
          normal1: d.clone(),
          faceIdx1: u,
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
function ht(i, t, e, n, o = 1) {
  const s = e / 2, c = n / 2, a = (l) => {
    const h = l.clone().project(t);
    return new B(
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
class ue {
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
function de(i, t) {
  const e = i.a.x, n = i.a.y, o = i.b.x, s = i.b.y, c = t.a.x, a = t.a.y, l = t.b.x, h = t.b.y, r = (e - o) * (a - h) - (n - s) * (c - l);
  if (Math.abs(r) < 1e-10) return null;
  const u = ((e - c) * (a - h) - (n - a) * (c - l)) / r, f = -((e - o) * (n - a) - (n - s) * (e - c)) / r, g = 1e-3;
  return u > g && u < 1 - g && f > g && f < 1 - g ? {
    t1: u,
    t2: f,
    point: new B(
      e + u * (o - e),
      n + u * (s - n)
    )
  } : null;
}
function Et(i) {
  var c, a, l, h, r, u;
  const t = /* @__PURE__ */ new Map(), e = 0.01, n = (f, g) => {
    const x = g.b.x - g.a.x, m = g.b.y - g.a.y, b = x * x + m * m;
    if (b < 1e-10) return null;
    const p = ((f.x - g.a.x) * x + (f.y - g.a.y) * m) / b;
    if (p <= e || p >= 1 - e) return null;
    const d = g.a.x + p * x, y = g.a.y + p * m;
    return (f.x - d) * (f.x - d) + (f.y - y) * (f.y - y) < 1 ? p : null;
  }, o = /* @__PURE__ */ new Set();
  for (let f = 0; f < i.length; f++)
    for (let g = f + 1; g < i.length; g++) {
      const x = de(i[f], i[g]);
      if (x)
        t.has(i[f]) || t.set(i[f], []), t.has(i[g]) || t.set(i[g], []), (c = t.get(i[f])) == null || c.push({ t: x.t1, point: x.point }), (a = t.get(i[g])) == null || a.push({ t: x.t2, point: x.point });
      else {
        const m = n(i[f].a, i[g]);
        m !== null && (t.has(i[g]) || t.set(i[g], []), (l = t.get(i[g])) == null || l.push({ t: m, point: i[f].a.clone() }), o.add(i[f]), o.add(i[g]));
        const b = n(i[f].b, i[g]);
        b !== null && (t.has(i[g]) || t.set(i[g], []), (h = t.get(i[g])) == null || h.push({ t: b, point: i[f].b.clone() }), o.add(i[f]), o.add(i[g]));
        const p = n(i[g].a, i[f]);
        p !== null && (t.has(i[f]) || t.set(i[f], []), (r = t.get(i[f])) == null || r.push({ t: p, point: i[g].a.clone() }), o.add(i[f]), o.add(i[g]));
        const d = n(i[g].b, i[f]);
        d !== null && (t.has(i[f]) || t.set(i[f], []), (u = t.get(i[f])) == null || u.push({ t: d, point: i[g].b.clone() }), o.add(i[f]), o.add(i[g]));
      }
    }
  console.log(`T-junction detection: ${o.size} potential straggler edges`);
  const s = [];
  for (const f of i) {
    const g = t.get(f), x = o.has(f);
    if (!g || g.length === 0) {
      f.isTJunctionStraggler = x, s.push(f);
      continue;
    }
    g.sort((p, d) => p.t - d.t);
    let m = f.a, b = f.a3d;
    for (const p of g) {
      const d = new I().lerpVectors(f.a3d, f.b3d, p.t);
      s.push({
        a: m.clone(),
        b: p.point.clone(),
        a3d: b.clone(),
        b3d: d.clone(),
        midpoint3d: new I().addVectors(b, d).multiplyScalar(0.5),
        isProfile: f.isProfile,
        visible: f.visible,
        faceIdx: f.faceIdx,
        mesh: f.mesh,
        isHatch: f.isHatch,
        normal1: f.normal1,
        // Propagate normal for smooth filter
        isTJunctionStraggler: x
      }), p.t, m = p.point, b = d;
    }
    s.push({
      a: m.clone(),
      b: f.b.clone(),
      a3d: b.clone(),
      b3d: f.b3d.clone(),
      midpoint3d: new I().addVectors(b, f.b3d).multiplyScalar(0.5),
      isProfile: f.isProfile,
      visible: f.visible,
      faceIdx: f.faceIdx,
      mesh: f.mesh,
      isHatch: f.isHatch,
      normal1: f.normal1,
      // Propagate normal for smooth filter
      isTJunctionStraggler: x
    });
  }
  return s;
}
function ge(i, t, e, n, o, s, c = !1) {
  if (c)
    return i.forEach((x) => x.visible = !0), i;
  const a = [];
  if (!s)
    return console.warn("No renderer provided, skipping occlusion test"), i;
  const l = new ut(n, o, {
    minFilter: _,
    magFilter: _,
    format: qt,
    type: zt
  }), h = new Dt({
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
  for (const x of t) {
    x.__globalFaceOffset = u;
    const m = x.geometry, b = m.attributes.position, p = m.index, d = p ? p.count / 3 : b.count / 3, y = [], w = [];
    for (let M = 0; M < d; M++) {
      let P, k, F;
      p ? (P = p.getX(M * 3), k = p.getX(M * 3 + 1), F = p.getX(M * 3 + 2)) : (P = M * 3, k = M * 3 + 1, F = M * 3 + 2);
      const O = new I(b.getX(P), b.getY(P), b.getZ(P)), W = new I(b.getX(k), b.getY(k), b.getZ(k)), $ = new I(b.getX(F), b.getY(F), b.getZ(F));
      O.applyMatrix4(x.matrixWorld), W.applyMatrix4(x.matrixWorld), $.applyMatrix4(x.matrixWorld), y.push(O.x, O.y, O.z, W.x, W.y, W.z, $.x, $.y, $.z);
      const z = u + M + 1, X = (z & 255) / 255, Y = (z >> 8 & 255) / 255, R = (z >> 16 & 255) / 255;
      w.push(X, Y, R, X, Y, R, X, Y, R);
    }
    const S = new Bt();
    S.setAttribute("position", new gt(new Float32Array(y), 3)), S.setAttribute("faceColor", new gt(new Float32Array(w), 3));
    const v = new Wt(S, h);
    r.push(v), u += d;
  }
  const f = new Ht();
  for (const x of r)
    f.add(x);
  s.setRenderTarget(l), s.setClearColor(0, 1), s.clear(), s.render(f, e);
  const g = new Uint8Array(n * o * 4);
  s.readRenderTargetPixels(l, 0, 0, n, o, g), s.setRenderTarget(null);
  for (const x of i) {
    const m = (x.a.x + x.b.x) / 2, b = (x.a.y + x.b.y) / 2, p = Math.round(m + n / 2), d = Math.round(o / 2 + b);
    if (p < 0 || p >= n || d < 0 || d >= o) {
      x.visible = !0, a.push(x);
      continue;
    }
    const y = ((o - 1 - d) * n + p) * 4, w = g[y], S = g[y + 1], v = g[y + 2], M = w + (S << 8) + (v << 16);
    if (M === 0) {
      x.visible = !0, a.push(x);
      continue;
    }
    const P = x.mesh.__globalFaceOffset || 0, k = P + x.faceIdx + 1;
    if (M === k)
      x.visible = !0, a.push(x);
    else {
      if (x.faceIdx2 !== void 0) {
        const F = P + x.faceIdx2 + 1;
        if (M === F) {
          x.visible = !0, a.push(x);
          continue;
        }
      }
      x.visible = !1;
    }
  }
  l.dispose(), h.dispose();
  for (const x of r)
    x.geometry.dispose();
  return a;
}
function xe(i, t, e, n) {
  const o = (r, u, f) => (r.x - f.x) * (u.y - f.y) - (u.x - f.x) * (r.y - f.y), s = o(i, t, e), c = o(i, e, n), a = o(i, n, t), l = s < 0 || c < 0 || a < 0, h = s > 0 || c > 0 || a > 0;
  return !(l && h);
}
function ye(i, t, e, n, o = 2) {
  const s = n.x - e.x, c = n.y - e.y, a = s * s + c * c;
  if (a < 1e-10) return !1;
  const l = (h) => {
    const r = ((h.x - e.x) * s + (h.y - e.y) * c) / a, u = e.x + r * s, f = e.y + r * c;
    return (h.x - u) * (h.x - u) + (h.y - f) * (h.y - f) < o * o && r >= -0.01 && r <= 1.01;
  };
  return l(i) && l(t);
}
function pe(i, t) {
  const e = [];
  for (const n of t) {
    const o = [
      { a: n.a2d, b: n.b2d, name: "AB" },
      { a: n.b2d, b: n.c2d, name: "BC" },
      { a: n.c2d, b: n.a2d, name: "CA" }
    ];
    for (const s of o)
      if (ye(i.a, i.b, s.a, s.b)) {
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
function me(i, t, e, n, o, s, c) {
  const a = { x: n.x - t.x, y: n.y - t.y }, l = { x: e.x - t.x, y: e.y - t.y }, h = { x: i.x - t.x, y: i.y - t.y }, r = a.x * a.x + a.y * a.y, u = a.x * l.x + a.y * l.y, f = a.x * h.x + a.y * h.y, g = l.x * l.x + l.y * l.y, x = l.x * h.x + l.y * h.y, m = r * g - u * u;
  if (Math.abs(m) < 1e-10) return 1 / 0;
  const b = (g * f - u * x) / m, p = (r * x - u * f) / m;
  return (1 - b - p) * o + p * s + b * c;
}
function be(i, t, e = 0.99, n = 0.5) {
  const o = [];
  let s = 0;
  for (const c of i) {
    const a = pe(c, t);
    c.adjacentFaceCount = a.length;
    let l = !1;
    if (a.length === 2) {
      const h = a[0].face, r = a[1].face, u = h.normal, f = r.normal;
      if (u && f) {
        const g = u.dot(f), x = Math.abs(g);
        c.faceSimilarity = x;
        let m;
        g > 0 ? m = Math.abs(h.constant - r.constant) : m = Math.abs(h.constant + r.constant), x >= e && m < n && (l = !0, s++);
      }
    } else if (a.length > 2) {
      const h = a.map((r) => r.face).filter((r) => r.normal);
      if (h.length >= 2) {
        let r = !0, u = 1;
        for (let f = 1; f < h.length; f++) {
          const g = h[0].normal.dot(h[f].normal), x = Math.abs(g);
          let m;
          if (g > 0 ? m = Math.abs(h[0].constant - h[f].constant) : m = Math.abs(h[0].constant + h[f].constant), u = Math.min(u, x), x < e || m >= n) {
            r = !1;
            break;
          }
        }
        c.faceSimilarity = u, r && (l = !0, s++);
      }
    }
    l || o.push(c);
  }
  return console.log(`Geometric straggler filter: removed ${s} coplanar edges`), o;
}
function we(i, t, e) {
  const n = e.position, o = e.matrixWorldInverse;
  return Me(i, t, n, o);
}
function Me(i, t, e, n) {
  const o = [];
  let s = 0, c = 0;
  for (const a of i) {
    const l = new B(
      (a.a.x + a.b.x) / 2,
      (a.a.y + a.b.y) / 2
    ), h = a.midpoint3d;
    let r;
    n ? r = -h.clone().applyMatrix4(n).z : r = e.distanceTo(h);
    let u = !1;
    for (const f of t) {
      if (f.mesh === a.mesh && (f.faceIdx === a.faceIdx || f.faceIdx === a.faceIdx2) || !xe(l, f.a2d, f.b2d, f.c2d))
        continue;
      if (me(
        l,
        f.a2d,
        f.b2d,
        f.c2d,
        f.depthA,
        f.depthB,
        f.depthC
      ) < r - 1e-3) {
        u = !0, c++;
        break;
      }
      s++;
    }
    u ? a.visible = !1 : (a.visible = !0, o.push(a));
  }
  return console.log(`[JS] Occlusion debug: ${s} point-in-triangle hits, ${c} occluded`), o;
}
function ve(i, t, e, n = 0.05) {
  const o = new Rt(), s = [], c = [];
  t.traverse((a) => {
    a.isMesh && c.push(a);
  });
  for (const a of i) {
    const l = new I().subVectors(a.midpoint3d, e.position), h = l.clone().normalize(), r = l.length(), u = r * n;
    o.set(e.position.clone(), h);
    const f = o.intersectObjects(c, !0);
    if (f.length === 0)
      a.visible = !0, s.push(a);
    else {
      let g = !1;
      for (const x of f)
        if (!(x.distance >= r - u) && !(x.object === a.mesh && x.faceIndex === a.faceIdx)) {
          g = !0;
          break;
        }
      g ? a.visible = !1 : (a.visible = !0, s.push(a));
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
      const d of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = d === "a" ? p.a : p.b, w = n(y);
      o.has(w) || o.set(w, { edges: [], point: { x: y.x, y: y.y } }), o.get(w).edges.push({ edge: p, endpoint: d });
    }
  const s = [];
  for (const [p, d] of o)
    if (d.edges.length === 1) {
      const { edge: y, endpoint: w } = d.edges[0], S = d.point, v = w === "a" ? y.b : y.a, M = S.x - v.x, P = S.y - v.y, k = Math.sqrt(M * M + P * P);
      if (k < 1e-3) continue;
      s.push({
        key: p,
        edge: y,
        endpoint: w,
        point: S,
        otherPoint: v,
        dirX: M / k,
        dirY: P / k,
        len: k
      });
    }
  if (console.log(`Edge cleanup: found ${s.length} orphaned endpoints`), s.length === 0) return i;
  const c = (p, d, y, w) => {
    const S = d.x * w.y - d.y * w.x;
    if (Math.abs(S) < 1e-4) return null;
    const v = y.x - p.x, M = y.y - p.y, P = (v * w.y - M * w.x) / S, k = (v * d.y - M * d.x) / S;
    return { t1: P, t2: k };
  };
  let a = 0;
  const l = /* @__PURE__ */ new Set();
  for (let p = 0; p < s.length; p++) {
    const d = s[p];
    if (l.has(d.key)) continue;
    let y = null, w = null, S = 1 / 0;
    for (let v = 0; v < s.length; v++) {
      if (p === v) continue;
      const M = s[v];
      if (l.has(M.key) || Math.sqrt(
        (M.point.x - d.point.x) ** 2 + (M.point.y - d.point.y) ** 2
      ) > e * 2) continue;
      const k = c(
        { x: d.point.x, y: d.point.y },
        { x: d.dirX, y: d.dirY },
        { x: M.point.x, y: M.point.y },
        { x: M.dirX, y: M.dirY }
      );
      if (!k || k.t1 < -0.1 || k.t2 < -0.1 || k.t1 > e || k.t2 > e) continue;
      const F = d.point.x + k.t1 * d.dirX, O = d.point.y + k.t1 * d.dirY, W = k.t1 + k.t2;
      W < S && (S = W, y = M, w = { x: F, y: O });
    }
    if (y && w) {
      const v = pt(
        d.point,
        w,
        i,
        d.edge,
        y.edge
      ), M = pt(
        y.point,
        w,
        i,
        d.edge,
        y.edge
      );
      if (v || M)
        continue;
      d.endpoint === "a" ? (d.edge.a.x = w.x, d.edge.a.y = w.y) : (d.edge.b.x = w.x, d.edge.b.y = w.y), y.endpoint === "a" ? (y.edge.a.x = w.x, y.edge.a.y = w.y) : (y.edge.b.x = w.x, y.edge.b.y = w.y), l.add(d.key), l.add(y.key), a++;
    }
  }
  console.log(`Edge cleanup: extended ${a} pairs of edges to intersections`);
  let h = 0;
  for (const p of i) {
    const d = p.b.x - p.a.x, y = p.b.y - p.a.y;
    h += Math.sqrt(d * d + y * y);
  }
  const r = h / i.length, u = r / 8;
  console.log(`Edge cleanup: average edge length = ${r.toFixed(2)}, snap threshold = ${u.toFixed(2)}`);
  const f = /* @__PURE__ */ new Map();
  for (const p of i)
    for (
      const d of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = d === "a" ? p.a : p.b, w = n(y);
      f.has(w) || f.set(w, { edges: [], point: y }), f.get(w).edges.push({ edge: p, endpoint: d });
    }
  const g = [];
  for (const [p, d] of f)
    d.edges.length === 1 && g.push({ key: p, ...d.edges[0], point: d.point });
  console.log(`Edge cleanup: ${g.length} orphaned endpoints before snap pass`);
  let x = 0;
  const m = /* @__PURE__ */ new Set();
  for (let p = 0; p < g.length; p++) {
    const d = g[p];
    if (m.has(d.key)) continue;
    let y = null, w = 1 / 0;
    for (let S = 0; S < g.length; S++) {
      if (p === S) continue;
      const v = g[S];
      if (m.has(v.key)) continue;
      const M = Math.sqrt(
        (v.point.x - d.point.x) ** 2 + (v.point.y - d.point.y) ** 2
      );
      M < w && (w = M, y = v);
    }
    if (y && w < u) {
      const S = (d.point.x + y.point.x) / 2, v = (d.point.y + y.point.y) / 2;
      d.endpoint === "a" ? (d.edge.a.x = S, d.edge.a.y = v) : (d.edge.b.x = S, d.edge.b.y = v), y.endpoint === "a" ? (y.edge.a.x = S, y.edge.a.y = v) : (y.edge.b.x = S, y.edge.b.y = v), m.add(d.key), m.add(y.key), x++;
    }
  }
  console.log(`Edge cleanup: snapped ${x} pairs of nearby orphans`);
  const b = g.length - x * 2;
  return console.log(`Edge cleanup: ${b} orphaned endpoints remaining`), i;
}
function Ee(i, t = 1) {
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
    const a = t.x - i.x, l = t.y - i.y, h = c.b.x - c.a.x, r = c.b.y - c.a.y, u = a * r - l * h;
    if (Math.abs(u) < 1e-3) continue;
    const f = c.a.x - i.x, g = c.a.y - i.y, x = (f * r - g * h) / u, m = (f * l - g * a) / u;
    if (x > 1e-3 && x < 1 - 1e-3 && m > 1e-3 && m < 1 - 1e-3)
      return !0;
  }
  return !1;
}
function $e(i, t, e, n = {}) {
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
  const u = wt(i, t.position);
  console.timeEnd("extractEdges"), console.log(`Extracted ${u.length} edges`), console.time("filterBackfacing");
  const f = Mt(u, t.position);
  console.timeEnd("filterBackfacing"), console.log(`After backface filter: ${f.length} edges`), console.time("classifyEdges");
  const { profiles: g, smoothFiltered: x } = vt(f, t.position, o);
  console.timeEnd("classifyEdges"), console.log(`Profiles: ${g.length}, Smooth edges: ${x.length}`);
  const m = [...g, ...x];
  console.time("projectEdges");
  let b = ht(m, t, l, h);
  console.timeEnd("projectEdges");
  for (let P = 0; P < g.length; P++)
    b[P].isProfile = !0;
  console.time("spatialHash");
  const p = Math.max(l, h) / s, d = new ue(p);
  for (const P of b)
    d.insert(P);
  console.timeEnd("spatialHash"), console.time("splitIntersections");
  const y = /* @__PURE__ */ new Set();
  let w = [];
  for (const P of d.getAllCells()) {
    const k = d.query(P).filter((O) => !y.has(O)), F = Et(k);
    w.push(...F);
    for (const O of k) y.add(O);
  }
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${w.length} edges`);
  let S;
  if (a)
    console.log("Skipping occlusion test (debug mode)"), S = w;
  else if (r) {
    console.time("testOcclusion (face ID buffer)");
    const P = w.filter((O) => O.isProfile), k = w.filter((O) => !O.isProfile);
    P.forEach((O) => O.visible = !0);
    const F = ge(k, [i], t, l, h, r, !1);
    S = [...P, ...F], console.timeEnd("testOcclusion (face ID buffer)");
  } else
    console.time("testOcclusion (raycaster - slow)"), S = ve(w, e, t, c), console.timeEnd("testOcclusion (raycaster - slow)");
  console.log(`Visible edges: ${S.length}`), console.time("optimize");
  const v = St(S);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const M = Pt(v);
  return console.timeEnd("cleanup orphans"), console.log(`Final edges: ${M.length}`), {
    edges: M,
    profiles: M.filter((P) => P.isProfile)
  };
}
function Se(i, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    skipOcclusion: c = !1,
    width: a = 800,
    height: l = 600,
    renderer: h = null,
    internalScale: r = 4,
    // Scale up internally for better precision
    distanceThreshold: u = 0.5
    // Default plane distance threshold
  } = n;
  let f = [];
  for (const $ of i) {
    $.updateMatrixWorld(!0);
    const z = wt($, t.position);
    f.push(...z);
  }
  console.log(`Extracted ${f.length} edges from ${i.length} meshes`);
  const { profiles: g, smoothFiltered: x } = vt(f, t.position, o);
  console.log(`Profiles: ${g.length}, Crease edges: ${x.length}`);
  const m = [...g, ...x];
  console.log(`After smooth filter: ${m.length} edges`);
  let b = ht(m, t, a, l, r);
  if (n.hatchEdges && n.hatchEdges.length > 0) {
    console.log(`Processing ${n.hatchEdges.length} hatch edges...`);
    let $ = Mt(n.hatchEdges, t.position);
    if (n.minHatchDotProduct !== void 0) {
      const X = n.minHatchDotProduct;
      $ = $.filter((Y) => {
        const R = new I().addVectors(Y.a, Y.b).multiplyScalar(0.5), q = new I().subVectors(t.position, R).normalize(), H = Y.normal1.dot(q);
        return Math.abs(H) >= X;
      }), console.log(`Density filter: kept ${$.length} hatch edges (threshold ${X})`);
    }
    const z = ht($, t, a, l, r);
    z.forEach((X) => X.isHatch = !0), b.push(...z), console.log(`Added ${z.length} visible hatch edges`);
  }
  console.time("splitIntersections");
  const p = Et(b);
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${p.length} edges`), console.time("buildProjectedFaces");
  const d = [], y = t.position, w = a / 2, S = l / 2;
  for (const $ of i) {
    const z = $.geometry, X = z.attributes.position, Y = z.index, R = Y ? Y.count / 3 : X.count / 3;
    for (let q = 0; q < R; q++) {
      let H, N, Z;
      Y ? (H = Y.getX(q * 3), N = Y.getX(q * 3 + 1), Z = Y.getX(q * 3 + 2)) : (H = q * 3, N = q * 3 + 1, Z = q * 3 + 2);
      const T = new I(X.getX(H), X.getY(H), X.getZ(H)).applyMatrix4($.matrixWorld), D = new I(X.getX(N), X.getY(N), X.getZ(N)).applyMatrix4($.matrixWorld), L = new I(X.getX(Z), X.getY(Z), X.getZ(Z)).applyMatrix4($.matrixWorld), K = new I().subVectors(D, T), G = new I().subVectors(L, T), j = new I().crossVectors(K, G).normalize(), Q = new I().addVectors(T, D).add(L).divideScalar(3), st = new I().subVectors(y, Q), it = -j.dot(T);
      if (j.dot(st) <= 0) continue;
      const tt = T.clone().project(t), et = D.clone().project(t), dt = L.clone().project(t), kt = new B(tt.x * w * r, -tt.y * S * r), It = new B(et.x * w * r, -et.y * S * r), $t = new B(dt.x * w * r, -dt.y * S * r), ct = t.matrixWorldInverse, Ct = -T.clone().applyMatrix4(ct).z, Ot = -D.clone().applyMatrix4(ct).z, Ft = -L.clone().applyMatrix4(ct).z;
      d.push({
        a2d: kt,
        b2d: It,
        c2d: $t,
        depthA: Ct,
        depthB: Ot,
        depthC: Ft,
        mesh: $,
        faceIdx: q,
        normal: j,
        // Store normal for post-split smooth filter
        constant: it
        // Store plane constant for coplanar detection
      });
    }
  }
  console.timeEnd("buildProjectedFaces"), console.log(`Built ${d.length} projected faces for occlusion`), console.time("classifySilhouettes"), Pe(p, d), console.timeEnd("classifySilhouettes"), console.time("filterSmoothSplitEdges");
  const v = be(p, d, o, u);
  console.timeEnd("filterSmoothSplitEdges");
  let M;
  c ? M = v : (console.time("testOcclusion (math)"), M = we(v, d, t), console.timeEnd("testOcclusion (math)")), console.log(`Visible edges: ${M.length}`), console.time("optimize");
  const P = St(M);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const k = Pt(P);
  console.timeEnd("cleanup orphans");
  const F = Ee(k);
  console.log(`Final edges before optimization: ${F.length}`);
  let O = F;
  if (F.length > 0) {
    let $ = 0;
    for (const Y of F) {
      const R = Y.b.x - Y.a.x, q = Y.b.y - Y.a.y;
      $ += Math.sqrt(R * R + q * q);
    }
    const z = $ / F.length, X = z / 10;
    console.log(`Optimization: avgLen=${z.toFixed(2)}, trim limit=${X.toFixed(2)}`), console.time("Optimize.segments"), O = ot.segments(F, !1, !0, X, !1, !1, !1)._segments, console.timeEnd("Optimize.segments"), console.log(`After optimization: ${O.length} edges`);
  }
  for (const $ of O)
    $.a.x /= r, $.a.y /= r, $.b.x /= r, $.b.y /= r;
  const W = O;
  return {
    edges: W,
    profiles: W.filter(($) => $.isProfile),
    allEdges: p,
    // For debug visualization
    projectedFaces: d
    // For face visualization
  };
}
function Pe(i, t) {
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
    const r = -l / h, u = a / h, f = mt(s, c, r, u, 1e3, t), g = mt(s, c, -r, -u, 1e3, t);
    o.isSilhouette = !f || !g;
  }
  const n = i.filter((o) => o.isSilhouette).length;
  console.log(`Classified ${n} silhouette edges out of ${i.length}`);
}
function mt(i, t, e, n, o, s) {
  for (const c of s)
    if (ke(i, t, e, n, o, c.a2d, c.b2d, c.c2d))
      return !0;
  return !1;
}
function ke(i, t, e, n, o, s, c, a) {
  return !!(rt(i, t, e, n, o, s.x, s.y, c.x, c.y) || rt(i, t, e, n, o, c.x, c.y, a.x, a.y) || rt(i, t, e, n, o, a.x, a.y, s.x, s.y));
}
function rt(i, t, e, n, o, s, c, a, l) {
  const h = a - s, r = l - c, u = e * r - n * h;
  if (Math.abs(u) < 1e-10) return !1;
  const f = ((s - i) * r - (c - t) * h) / u, g = ((s - i) * n - (c - t) * e) / u;
  return f > 0.1 && f <= o && g >= 0 && g <= 1;
}
var V = (i) => Math.round(i * 100) / 100, ft = function(i) {
  bt.call(this), this.node = i;
};
ft.prototype = Object.create(bt.prototype);
ft.prototype.constructor = ft;
var Ce = function() {
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
    },
    // Brightness-based shading
    brightnessShading: {
      enabled: !1,
      // Enable lighting-based density
      invert: !1,
      // True for white pen on black paper
      lightDirection: null
      // Override: Vector3 or null (auto from scene)
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
    s = u, c = f, a = s / 2, l = c / 2, t.setAttribute("viewBox", -a + " " + -l + " " + s + " " + c), t.setAttribute("width", s), t.setAttribute("height", c);
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
    const g = i._glRenderer;
    if (i.showSilhouettes || i.showHatches) {
      const x = Zt(g, u, f, {
        normalBuckets: i.silhouetteOptions.normalBuckets,
        simplifyTolerance: i.silhouetteOptions.simplifyTolerance,
        minArea: i.silhouetteOptions.minArea,
        insetPixels: i.showHatches ? i.hatchOptions.insetPixels : 0
      });
      if (i.showSilhouettes && x.forEach((m) => {
        if (m.boundary.length < 3) return;
        const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let p = "";
        m.boundary.forEach((v, M) => {
          const P = v.x, k = -v.y;
          p += (M === 0 ? "M" : "L") + V(P) + "," + V(k);
        }), p += "Z";
        const d = m.normal, y = Math.floor((d.x * 0.5 + 0.5) * 255), w = Math.floor((d.y * 0.5 + 0.5) * 255), S = Math.floor((d.z * 0.5 + 0.5) * 255);
        b.setAttribute("d", p), b.setAttribute("fill", `rgba(${y},${w},${S},0.3)`), b.setAttribute("stroke", "none"), e.appendChild(b);
      }), i.showHatches) {
        x.sort((d, y) => d.depth - y.depth);
        const m = x.map((d) => d.boundary);
        let b = null;
        const p = i.hatchOptions.brightnessShading || {};
        p.enabled && (p.lightDirection ? b = p.lightDirection.clone().normalize() : (u.traverse((d) => {
          b || (d instanceof Vt ? b = new I().subVectors(d.position, d.target.position).normalize() : (d instanceof Nt || d instanceof jt) && (b = d.position.clone().normalize()));
        }), b || (b = new I(1, 1, 1).normalize()))), x.forEach((d, y) => {
          let w = null;
          b && p.enabled && (w = Math.max(0, d.normal.dot(b)));
          let S = ce(d, f, {
            baseSpacing: i.hatchOptions.baseSpacing,
            minSpacing: i.hatchOptions.minSpacing,
            maxSpacing: i.hatchOptions.maxSpacing,
            depthFactor: i.hatchOptions.depthFactor,
            insetPixels: i.hatchOptions.insetPixels,
            screenWidth: s,
            screenHeight: c,
            axisSettings: i.hatchOptions.axisSettings,
            brightness: w,
            invertBrightness: p.invert || !1
          });
          for (let v = 0; v < y; v++)
            S = S.flatMap(
              (M) => re(M, m[v])
            );
          S.forEach((v) => {
            const M = document.createElementNS("http://www.w3.org/2000/svg", "path"), P = `M${V(v.start.x)},${V(-v.start.y)}L${V(v.end.x)},${V(-v.end.y)}`;
            M.setAttribute("d", P), M.setAttribute("fill", "none"), M.setAttribute("stroke", i.hatchOptions.stroke), M.setAttribute("stroke-width", i.hatchOptions.strokeWidth), o.appendChild(M);
          });
        });
      }
      if (i.showEdges) {
        const m = [];
        u.traverse((b) => {
          b.isMesh && b.geometry && m.push(b);
        }), m.length > 0 && (Se(m, f, u, {
          smoothThreshold: i.hiddenLineOptions.smoothThreshold,
          width: s,
          height: c
        }).edges || []).forEach((d) => {
          const y = document.createElementNS("http://www.w3.org/2000/svg", "line");
          y.setAttribute("x1", V(d.a.x)), y.setAttribute("y1", V(d.a.y)), y.setAttribute("x2", V(d.b.x)), y.setAttribute("y2", V(d.b.y)), y.setAttribute("stroke", i.edgeOptions.stroke), y.setAttribute("stroke-width", i.edgeOptions.strokeWidth), n.appendChild(y);
        });
      }
    }
  }, this.render = function(u, f) {
    if (!(f instanceof Jt)) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }
  };
};
export {
  E as GeomUtil,
  ot as Optimize,
  Ce as PlotterRenderer,
  C as Point,
  ft as SVGObject,
  A as Segment,
  U as Segments,
  Pt as cleanupOrphanedEdges,
  re as clipLineOutsidePolygon,
  xt as clipLineToPolygon,
  $e as computeHiddenLines,
  Se as computeHiddenLinesMultiple,
  Zt as extractNormalRegions,
  ce as generatePerspectiveHatches,
  St as optimizeEdges
};
//# sourceMappingURL=three-plotter-renderer.es.js.map

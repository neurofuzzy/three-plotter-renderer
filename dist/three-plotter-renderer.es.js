import { Vector2 as D, WebGLRenderTarget as yt, NearestFilter as U, MeshNormalMaterial as vt, MeshDepthMaterial as Et, RGBADepthPacking as kt, Vector3 as $, Object3D as mt, Color as $t, Camera as It } from "three";
function Xt(i, t, n, e = {}) {
  const {
    resolution: o = 2,
    // Render at 2x for smooth boundaries
    normalBuckets: s = 12,
    // Quantize normals into N directions
    minArea: r = 100,
    // Minimum region area in pixels (at output scale)
    simplifyTolerance: h = 2,
    insetPixels: a = 0
    // Inset boundaries by this many pixels (GPU erosion)
  } = e, l = i.getSize(new D()), c = Math.floor(l.x * o), u = Math.floor(l.y * o), f = Math.round(a * o), d = Ot(i, t, n, c, u), m = Yt(i, t, n, c, u);
  let { regionMap: p, normalLookup: w } = qt(d, c, u);
  f > 0 && (p = Ct(p, c, u, f));
  const { labels: y, regionCount: x } = Ft(p, c, u), g = [];
  for (let b = 1; b <= x; b++) {
    const S = Dt(y, c, u, b);
    if (S.length < 3) continue;
    const P = it(S, h), v = Math.abs(zt(P));
    if (v < r) continue;
    const I = Wt(y, p, w, c, u, b), E = Tt(y, m, c, u, b);
    g.push({
      boundary: P.map((Y) => new D(
        Y.x / o - l.x / 2,
        Y.y / o - l.y / 2
        // Y already flipped during readback
      )),
      normal: I,
      depth: E,
      // 0-1 normalized depth
      area: v / (o * o),
      regionId: b
    });
  }
  return g;
}
function Ot(i, t, n, e, o) {
  const s = new yt(e, o, {
    minFilter: U,
    magFilter: U
  }), r = new vt({ flatShading: !0 }), h = /* @__PURE__ */ new Map(), a = [];
  t.traverse((c) => {
    c.isMesh ? (h.set(c, c.material), c.material = r) : (c.isLineSegments || c.isLine || c.isPoints) && c.visible && (a.push(c), c.visible = !1);
  }), i.setRenderTarget(s), i.render(t, n), t.traverse((c) => {
    c.isMesh && h.has(c) && (c.material = h.get(c));
  });
  for (const c of a)
    c.visible = !0;
  i.setRenderTarget(null);
  const l = new Uint8Array(e * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, e, o, l), s.dispose(), r.dispose(), l;
}
function Yt(i, t, n, e, o) {
  const s = new yt(e, o, {
    minFilter: U,
    magFilter: U
  }), r = new Et({ depthPacking: kt }), h = /* @__PURE__ */ new Map(), a = [];
  t.traverse((c) => {
    c.isMesh ? (h.set(c, c.material), c.material = r) : (c.isLineSegments || c.isLine || c.isPoints) && c.visible && (a.push(c), c.visible = !1);
  }), i.setRenderTarget(s), i.render(t, n), t.traverse((c) => {
    c.isMesh && h.has(c) && (c.material = h.get(c));
  });
  for (const c of a)
    c.visible = !0;
  i.setRenderTarget(null);
  const l = new Uint8Array(e * o * 4);
  return i.readRenderTargetPixels(s, 0, 0, e, o, l), s.dispose(), r.dispose(), l;
}
function Tt(i, t, n, e, o) {
  let s = 0, r = 0;
  for (let h = 0; h < e; h++)
    for (let a = 0; a < n; a++)
      if (i[h * n + a] === o) {
        const l = (h * n + a) * 4, c = t[l] / 255, u = t[l + 1] / 255, f = t[l + 2] / 255, d = t[l + 3] / 255, m = c + u / 256 + f / 65536 + d / 16777216;
        s += m, r++;
      }
  return r > 0 ? s / r : 0.5;
}
function Ct(i, t, n, e) {
  let o = i;
  for (let s = 0; s < e; s++) {
    const r = new Uint16Array(o);
    for (let h = 1; h < n - 1; h++)
      for (let a = 1; a < t - 1; a++) {
        const l = h * t + a;
        if (o[l] === 0) continue;
        const u = o[l - 1], f = o[l + 1], d = o[l - t], m = o[l + t];
        (u === 0 || f === 0 || d === 0 || m === 0) && (r[l] = 0);
      }
    o = r;
  }
  return o;
}
function qt(i, t, n, e) {
  const o = new Uint16Array(t * n), s = {};
  let r = 1;
  const h = {};
  for (let a = 0; a < t * n; a++) {
    const l = a * 4, c = i[l], u = i[l + 1], f = i[l + 2];
    if (c < 5 && u < 5 && f < 5) {
      o[a] = 0;
      continue;
    }
    const d = c / 255 * 2 - 1, m = u / 255 * 2 - 1, p = f / 255 * 2 - 1, w = 4, y = Math.round(c / w) * w, x = Math.round(u / w) * w, g = Math.round(f / w) * w, b = `${y}|${x}|${g}`;
    h[b] || (h[b] = r, s[r] = new $(d, m, p).normalize(), r++), o[a] = h[b];
  }
  return { regionMap: o, normalLookup: s };
}
function Ft(i, t, n) {
  const e = new Uint32Array(t * n), o = [];
  let s = 1;
  function r(c) {
    return o[c] !== c && (o[c] = r(o[c])), o[c];
  }
  function h(c, u) {
    const f = r(c), d = r(u);
    f !== d && (o[d] = f);
  }
  for (let c = 0; c < n; c++)
    for (let u = 0; u < t; u++) {
      const f = c * t + u, d = i[f];
      if (d === 0) continue;
      const m = [];
      if (u > 0 && i[f - 1] === d && e[f - 1] > 0 && m.push(e[f - 1]), c > 0 && i[f - t] === d && e[f - t] > 0 && m.push(e[f - t]), m.length === 0)
        e[f] = s, o[s] = s, s++;
      else {
        const p = Math.min(...m);
        e[f] = p;
        for (const w of m)
          h(p, w);
      }
    }
  const a = {};
  let l = 0;
  for (let c = 0; c < t * n; c++) {
    if (e[c] === 0) continue;
    const u = r(e[c]);
    a[u] === void 0 && (l++, a[u] = l), e[c] = a[u];
  }
  return { labels: e, regionCount: l };
}
function Dt(i, t, n, e) {
  const o = [];
  let s = -1, r = -1;
  t: for (let m = 0; m < n; m++)
    for (let p = 0; p < t; p++)
      if (i[m * t + p] === e && (p === 0 || i[m * t + p - 1] !== e || m === 0 || i[(m - 1) * t + p] !== e)) {
        s = p, r = m;
        break t;
      }
  if (s === -1) return o;
  const h = [1, 1, 0, -1, -1, -1, 0, 1], a = [0, 1, 1, 1, 0, -1, -1, -1];
  let l = s, c = r, u = 7;
  const f = t * n * 2;
  let d = 0;
  do {
    o.push({ x: l, y: c });
    let m = !1;
    for (let p = 0; p < 8; p++) {
      const w = (u + 6 + p) % 8, y = l + h[w], x = c + a[w];
      if (y >= 0 && y < t && x >= 0 && x < n && i[x * t + y] === e) {
        l = y, c = x, u = w, m = !0;
        break;
      }
    }
    if (!m) break;
    d++;
  } while ((l !== s || c !== r) && d < f);
  return o;
}
function Wt(i, t, n, e, o, s) {
  let r = 0, h = 0, a = 0;
  for (let d = 0; d < o; d++)
    for (let m = 0; m < e; m++)
      i[d * e + m] === s && (r += m, h += d, a++);
  if (a === 0) return new $(0, 0, 1);
  const l = Math.round(r / a), u = Math.round(h / a) * e + l, f = t[u];
  return n[f] || new $(0, 0, 1);
}
function it(i, t) {
  if (i.length < 3) return i;
  let n = 0, e = 0;
  const o = i[0], s = i[i.length - 1];
  for (let r = 1; r < i.length - 1; r++) {
    const h = Ht(i[r], o, s);
    h > n && (n = h, e = r);
  }
  if (n > t) {
    const r = it(i.slice(0, e + 1), t), h = it(i.slice(e), t);
    return r.slice(0, -1).concat(h);
  } else
    return [o, s];
}
function Ht(i, t, n) {
  const e = n.x - t.x, o = n.y - t.y, s = e * e + o * o;
  if (s < 1e-10)
    return Math.sqrt((i.x - t.x) ** 2 + (i.y - t.y) ** 2);
  const r = ((i.x - t.x) * e + (i.y - t.y) * o) / s, h = t.x + r * e, a = t.y + r * o;
  return Math.sqrt((i.x - h) ** 2 + (i.y - a) ** 2);
}
function zt(i) {
  let t = 0;
  for (let n = 0; n < i.length; n++) {
    const e = (n + 1) % i.length;
    t += i[n].x * i[e].y, t -= i[e].x * i[n].y;
  }
  return t / 2;
}
function At(i, t, n, e) {
  const o = n / 2, s = e / 2, r = new $(0, 1, 0), h = new $(0, 0, 1);
  let a;
  Math.abs(i.y) > 0.9 ? a = h.clone() : (a = new $().crossVectors(r, i).normalize(), a.lengthSq() < 0.01 && (a = h.clone()));
  const l = new $(0, 0, 0), c = a.clone().multiplyScalar(100), u = l.clone().project(t), f = c.clone().project(t), d = new D(
    u.x * o,
    -u.y * s
  ), p = new D(
    f.x * o,
    -f.y * s
  ).clone().sub(d).normalize(), y = a.clone().multiplyScalar(1e5).clone().project(t);
  let x = null;
  return Math.abs(y.x) < 100 && Math.abs(y.y) < 100 && y.z < 1 && (x = new D(
    y.x * o,
    -y.y * s
  )), { direction: p, vanishingPoint: x };
}
function Bt(i, t, n = {}) {
  const {
    baseSpacing: e = 8,
    // Base spacing in screen pixels
    minSpacing: o = 3,
    // Minimum spacing
    maxSpacing: s = 20,
    // Maximum spacing
    depthFactor: r = 0.5,
    // How much depth affects density
    screenWidth: h = 1200,
    screenHeight: a = 800,
    axisSettings: l = {}
    // { x: { rotation: 0, spacing: 10 }, y: ... }
  } = n, { boundary: c, normal: u, depth: f = 0.5 } = i;
  if (c.length < 3) return [];
  const d = Math.abs(u.x), m = Math.abs(u.y), p = Math.abs(u.z);
  let w = "y";
  d >= m && d >= p ? w = "x" : p >= m && p >= d && (w = "z");
  const y = l[w] || {}, x = y.rotation || 0, g = y.spacing;
  console.log(`[Hatch] normal=(${u.x.toFixed(2)}, ${u.y.toFixed(2)}, ${u.z.toFixed(2)}) => axis=${w}, rotation=${x}, spacing=${g}`);
  const { direction: b, vanishingPoint: S } = At(
    u,
    t,
    h,
    a
  );
  let P = b;
  if (x !== 0) {
    const C = x * (Math.PI / 180), W = Math.cos(C), B = Math.sin(C);
    P = new D(
      b.x * W - b.y * B,
      b.x * B + b.y * W
    );
  }
  const v = new D(-P.y, P.x), E = Math.max(o, Math.min(
    s,
    (g !== void 0 ? g : e) + f * r * (s - o)
  ));
  let Y = 1 / 0, z = -1 / 0, R = 1 / 0, X = -1 / 0;
  for (const C of c)
    Y = Math.min(Y, C.x), z = Math.max(z, C.x), R = Math.min(R, C.y), X = Math.max(X, C.y);
  const H = (Y + z) / 2, O = (R + X) / 2, T = new D(H, O), A = Math.sqrt((z - Y) ** 2 + (X - R) ** 2), q = [];
  if (S && Math.abs(x) < 5 && S.distanceTo(T) < A * 5) {
    const C = S.distanceTo(T), W = Math.ceil(A / E) * 2, N = Math.atan2(A, C) * 2 / W, j = Math.atan2(
      O - S.y,
      H - S.x
    );
    for (let J = -W; J <= W; J++) {
      const K = j + J * N, Q = new D(Math.cos(K), Math.sin(K)), nt = S.clone(), et = S.clone().add(Q.clone().multiplyScalar(C * 10)), ot = ut({ start: nt, end: et }, c);
      q.push(...ot);
    }
  } else {
    const C = Math.ceil(A / E) + 2;
    for (let W = -C; W <= C; W++) {
      const B = v.clone().multiplyScalar(W * E), N = T.clone().add(B), j = N.clone().add(P.clone().multiplyScalar(-A)), J = N.clone().add(P.clone().multiplyScalar(A)), K = ut({ start: j, end: J }, c);
      q.push(...K);
    }
  }
  return q;
}
function ut(i, t) {
  const n = [], e = t.length;
  for (let s = 0; s < e; s++) {
    const r = t[s], h = t[(s + 1) % e], a = Nt(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      r.x,
      r.y,
      h.x,
      h.y
    );
    a && n.push({
      point: new D(a.x, a.y),
      t: a.t
    });
  }
  if (n.length < 2) return [];
  n.sort((s, r) => s.t - r.t);
  const o = [];
  for (let s = 0; s < n.length - 1; s++) {
    const r = (n[s].point.x + n[s + 1].point.x) / 2, h = (n[s].point.y + n[s + 1].point.y) / 2;
    G(r, h, t) && o.push({
      start: n[s].point,
      end: n[s + 1].point
    });
  }
  return o;
}
function Rt(i, t) {
  const n = [], e = t.length, o = G(i.start.x, i.start.y, t), s = G(i.end.x, i.end.y, t);
  n.push({ point: i.start.clone(), t: 0, inside: o });
  for (let a = 0; a < e; a++) {
    const l = t[a], c = t[(a + 1) % e], u = Lt(
      i.start.x,
      i.start.y,
      i.end.x,
      i.end.y,
      l.x,
      l.y,
      c.x,
      c.y
    );
    u && u.t > 0 && u.t < 1 && n.push({
      point: new D(u.x, u.y),
      t: u.t,
      inside: null
      // will be determined by neighbors
    });
  }
  n.push({ point: i.end.clone(), t: 1, inside: s }), n.sort((a, l) => a.t - l.t);
  const r = [n[0]];
  for (let a = 1; a < n.length; a++)
    n[a].t - r[r.length - 1].t > 1e-4 && r.push(n[a]);
  if (r.length < 2) return [i];
  const h = [];
  for (let a = 0; a < r.length - 1; a++) {
    const l = (r[a].t + r[a + 1].t) / 2, c = i.start.x + l * (i.end.x - i.start.x), u = i.start.y + l * (i.end.y - i.start.y);
    G(c, u, t) || h.push({
      start: r[a].point.clone(),
      end: r[a + 1].point.clone()
    });
  }
  return h;
}
function Lt(i, t, n, e, o, s, r, h) {
  const a = (i - n) * (s - h) - (t - e) * (o - r);
  if (Math.abs(a) < 1e-10) return null;
  const l = ((i - o) * (s - h) - (t - s) * (o - r)) / a, c = -((i - n) * (t - s) - (t - e) * (i - o)) / a;
  return l >= 0 && l <= 1 && c >= 0 && c <= 1 ? {
    x: i + l * (n - i),
    y: t + l * (e - t),
    t: l
  } : null;
}
function Nt(i, t, n, e, o, s, r, h) {
  const a = (i - n) * (s - h) - (t - e) * (o - r);
  if (Math.abs(a) < 1e-10) return null;
  const l = ((i - o) * (s - h) - (t - s) * (o - r)) / a, c = -((i - n) * (t - s) - (t - e) * (i - o)) / a;
  return c >= 0 && c <= 1 ? {
    x: i + l * (n - i),
    y: t + l * (e - t),
    t: l
  } : null;
}
function G(i, t, n) {
  let e = !1;
  const o = n.length;
  for (let s = 0, r = o - 1; s < o; r = s++) {
    const h = n[s].x, a = n[s].y, l = n[r].x, c = n[r].y;
    a > t != c > t && i < (l - h) * (t - a) / (c - a) + h && (e = !e);
  }
  return e;
}
const ft = 1e-3;
class k {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(t, n) {
    this.x = t, this.y = n;
  }
  /**
   * @param {Point} pt
   */
  static clone(t) {
    return new k(t.x, t.y);
  }
}
class rt {
  /**
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   */
  constructor(t, n, e, o) {
    this.minX = t, this.minY = n, this.maxX = e, this.maxY = o;
  }
  width() {
    return Math.abs(this.maxX - this.minX);
  }
  height() {
    return Math.abs(this.maxY - this.minY);
  }
}
class Vt {
  /**
   *
   * @param {number} r radius
   */
  constructor(t = 0) {
    this.r = t;
  }
}
class F {
  /**
   *
   * @param {Point} a start point
   * @param {Point} b end point
   */
  constructor(t, n) {
    this.a = t, this.b = n, this.tags = {};
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static isEqual(t, n) {
    return M.pointsEqual(t.a, n.a) && M.pointsEqual(t.b, n.b) || M.pointsEqual(t.b, n.a) && M.pointsEqual(t.a, n.b);
  }
  /**
   * @param {Segment} seg
   */
  static clone(t) {
    return new F(new k(t.a.x, t.a.y), new k(t.b.x, t.b.y));
  }
}
class jt {
  constructor() {
    this.pivot = { x: 0, y: 0 }, this.rotation = 0, this.isOpen = !0, this.isGroup = !1, this.isStrong = !1, this._makeAbsolute = (t) => {
      let n = this.rotation * Math.PI / 180;
      t.forEach((e, o) => {
        const s = { x: e.x, y: e.y };
        M.rotatePoint(s, n), s.x += this.pivot.x, s.y += this.pivot.y, t[o] = s;
      });
    }, this._makeSegsAbsolute = (t) => {
      let n = this.rotation * Math.PI / 180;
      t.forEach((e) => {
        const o = { x: e.a.x, y: e.a.y }, s = { x: e.b.x, y: e.b.y };
        M.rotatePoint(o, n), M.rotatePoint(s, n), M.addToPoint(o, this.pivot), M.addToPoint(s, this.pivot), e.a = o, e.b = s;
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
    const n = new rt(1e6, 1e6, -1e6, -1e6);
    return this.toPoints(t).forEach((o) => {
      n.minX = Math.min(n.minX, o.x), n.minY = Math.min(n.minY, o.y), n.maxX = Math.max(n.maxX, o.x), n.maxY = Math.max(n.maxY, o.y);
    }), n;
  }
  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const t = new Vt();
    return this.toPoints(!0).forEach((e) => {
      t.r = Math.max(t.r, Math.sqrt(e.x * e.x + e.y * e.y));
    }), t;
  }
}
class _ extends jt {
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
    return this.toSegments(t).reduce((n, e) => e ? n.concat([e.a, e.b]) : n, []);
  }
  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(t = !1) {
    let n = this._segments.reduce((e, o) => o ? e.concat(F.clone(o)) : e, []);
    return t || this._makeSegsAbsolute(n), n;
  }
  bake() {
  }
  result() {
    return _.clone(this);
  }
  /**
   *
   * @param {Segments} segs
   */
  static clone(t) {
    let n = t._segments, e = [], o = n.length;
    for (; o--; )
      e.unshift(F.clone(n[o]));
    let s = new _(e);
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
  static lerp(t, n, e) {
    return (1 - e) * t + e * n;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static angleBetween(t, n) {
    return Math.atan2(n.y - t.y, n.x - t.x);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngle(t, n) {
    let e = M.angleBetween(t.a, t.b), o = M.angleBetween(n.a, n.b);
    return Math.abs(e - o) < ft;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(t, n) {
    let e = M.angleBetween(t.a, t.b), o = M.angleBetween(n.b, n.a);
    return Math.abs(e - o) < ft;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} d
   * @returns {Point}
   */
  static lerpPoints(t, n, e) {
    return {
      x: M.lerp(t.x, n.x, e),
      y: M.lerp(t.y, n.y, e)
    };
  }
  /**
   *
   * @param {Point} pt the point to rotate in place
   * @param {number} deg angle in degrees
   */
  static rotatePointDeg(t, n) {
    M.rotatePoint(t, n * Math.PI / 180);
  }
  /**
   *
   * @param {Point} pt
   * @param {*} rad
   */
  static rotatePoint(t, n) {
    const e = Math.cos(n), o = Math.sin(n), s = t.y, r = t.x;
    t.y = e * s - o * r, t.x = o * s + e * r;
  }
  /**
   *
   * @param {number} rad
   * @param  {...Point} points
   */
  static rotatePoints(t, ...n) {
    n.forEach((e) => {
      M.rotatePoint(e, t);
    });
  }
  /**
   *
   * @param {number} deg
   * @param  {...Point} points
   */
  static rotatePointsDeg(t, ...n) {
    let e = t * Math.PI / 180;
    n.forEach((o) => {
      M.rotatePoint(o, e);
    });
  }
  // Based on http://stackoverflow.com/a/12037737
  static outerTangents(t, n, e, o) {
    var s = e.x - t.x, r = e.y - t.y, h = Math.sqrt(s * s + r * r);
    if (h <= Math.abs(o - n)) return [];
    var a = Math.atan2(r, s), l = Math.acos((n - o) / h);
    return [
      new F(
        {
          x: t.x + n * Math.cos(a + l),
          y: t.y + n * Math.sin(a + l)
        },
        {
          x: e.x + o * Math.cos(a + l),
          y: e.y + o * Math.sin(a + l)
        }
      ),
      new F(
        {
          x: t.x + n * Math.cos(a - l),
          y: t.y + n * Math.sin(a - l)
        },
        {
          x: e.x + o * Math.cos(a - l),
          y: e.y + o * Math.sin(a - l)
        }
      )
    ];
  }
  /**
   *
   * @param {Point} pt
   */
  static cartesian2Polar(t) {
    const n = Math.sqrt(t.x * t.x + t.y * t.y), e = Math.atan2(t.y, t.x);
    t.x = n, t.y = e;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} [scale]
   */
  static pointsEqual(t, n, e = 1) {
    return Math.round(t.x * 1e4 / e) == Math.round(n.x * 1e4 / e) && Math.round(t.y * 1e4 / e) == Math.round(n.y * 1e4 / e);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetween(t, n) {
    const e = n.x - t.x, o = n.y - t.y;
    return Math.sqrt(e * e + o * o);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetweenSquared(t, n) {
    const e = n.x - t.x, o = n.y - t.y;
    return e * e + o * o;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} numSegs
   * @returns {Point[]}
   */
  static interpolatePoints(t, n, e) {
    let o = [{ x: t.x, y: t.y }], s = 1 / e, r = (n.x - t.x) * s, h = (n.y - t.y) * s;
    for (var a = 1; a < e; a++)
      o.push(new k(t.x + r * a, t.y + h * a));
    return o.push({ x: n.x, y: n.y }), o;
  }
  /**
   *
   * @param  {...Point} pts
   */
  static averagePoints(...t) {
    let n = new k(0, 0);
    return t.forEach((e) => {
      n.x += e.x, n.y += e.y;
    }), n.x /= t.length, n.y /= t.length, n;
  }
  /**
   *
   * @param {Point} targetPt the point that will be added to
   * @param {Point} sourcePt the point to add to the target
   */
  static addToPoint(t, n) {
    t.x += n.x, t.y += n.y;
  }
  /**
   *
   * @param {Point} targetPt the point that will be subtracted from
   * @param {Point} sourcePt the point tosubtract from the target
   */
  static subFromPoint(t, n) {
    t.x -= n.x, t.y -= n.y;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} delta
   * @returns {Point[]}
   */
  static subdivideByDistance(t, n, e) {
    if (e === 0)
      return [t, n];
    let o = [{ x: t.x, y: t.y }], s = M.distanceBetween(t, n), r = e / s, h = Math.floor(1 / r), a = s % e;
    e += a / h, r = e / s;
    let l = r, c = 1, u = (n.x - t.x) * r, f = (n.y - t.y) * r;
    for (; l < 1; )
      o.push(new k(t.x + u * c, t.y + f * c)), l += r, c++;
    return o.push({ x: n.x, y: n.y }), o;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @param {number} [scale]
   */
  static segmentsConnected(t, n, e = 1) {
    return M.pointsEqual(t.b, n.a, e) || M.pointsEqual(t.a, n.b, e);
  }
  /**
   *
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentsToPoints(t) {
    let n = t.reduce((o, s) => o.concat(s.a, s.b), []), e = n.length;
    for (; e--; ) {
      let o = n[e];
      e > 0 && M.pointsEqual(o, n[e - 1]) && n.splice(e, 1);
    }
    return n;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {number}
   */
  static polygonArea(t) {
    let n = 0, e = t.length - 1;
    for (var o = 0; o < t.length; o++)
      n += t[o].x * t[e].y, n -= t[e].x * t[o].y, e = o;
    return n / 2;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {BoundingBox}
   */
  static pointsBoundingBox(t) {
    const n = new rt(1e6, 1e6, -1e6, -1e6);
    return t.forEach((e) => {
      n.minX = Math.min(n.minX, e.x), n.minY = Math.min(n.minY, e.y), n.maxX = Math.max(n.maxX, e.x), n.maxY = Math.max(n.maxY, e.y);
    }), n;
  }
  /**
   *
   * @param {BoundingBox[]} bbs
   * @returns {BoundingBox}
   */
  static boundingBoxesBoundingBox(t) {
    const n = new rt(1e6, 1e6, -1e6, -1e6);
    return t.forEach((e) => {
      n.minX = Math.min(n.minX, e.minX), n.minY = Math.min(n.minY, e.minY), n.maxX = Math.max(n.maxX, e.maxX), n.maxY = Math.max(n.maxY, e.maxY);
    }), n;
  }
  /**
   *
   * @param {Segment[]} segs
   * @returns {BoundingBox}
   */
  static segmentsBoundingBox(t) {
    const n = [];
    return t.forEach((e) => {
      n.push(e.a), n.push(e.b);
    }), M.pointsBoundingBox(n);
  }
  /**
   *
   * @param {BoundingBox} ab
   * @param {BoundingBox} bb
   */
  static boundingBoxesIntersect(t, n) {
    return t.maxX >= n.minX && t.maxY >= n.minY && t.minX <= n.maxX && t.minY <= n.maxY;
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
  static ccw(t, n, e) {
    return (e.y - t.y) * (n.x - t.x) > (n.y - t.y) * (e.x - t.x);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {boolean}
   */
  static segmentsIntersect(t, n) {
    const e = M.ccw;
    return e(t.a, n.a, n.b) != e(t.b, n.a, n.b) && e(t.a, t.b, n.a) != e(t.a, t.b, n.b);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {Point}
   */
  static segmentSegmentIntersect(t, n, e = !1) {
    const o = t.a.x, s = t.a.y, r = t.b.x, h = t.b.y, a = n.a.x, l = n.a.y, c = n.b.x, u = n.b.y, f = r - o, d = h - s, m = c - a, p = u - l, w = (-d * (o - a) + f * (s - l)) / (-m * d + f * p), y = (m * (s - l) - p * (o - a)) / (-m * d + f * p);
    if (w >= 0 && w <= 1 && y >= 0 && y <= 1) {
      const x = o + y * f, g = s + y * d;
      let b = { x, y: g };
      return e && (M.pointsEqual(b, n.a) || M.pointsEqual(b, n.b) || M.pointsEqual(b, t.a) || M.pointsEqual(b, t.b)) ? void 0 : b;
    }
    return null;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentSegmentsIntersections(t, n, e = !1) {
    let o = [];
    return n.forEach((s) => {
      if (s == t)
        return;
      let r = M.segmentSegmentIntersect(t, s, e);
      r && o.push(r);
    }), o;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static dot(t, n) {
    return t.x * n.x + t.y * n.y;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static cross(t, n) {
    return t.x * n.y - t.y * n.x;
  }
  /**
   * 
   * @param {Point} pt 
   * @param {Point} ptA 
   * @param {Point} ptB 
   */
  static lineSide(t, n, e) {
    return Math.round(((e.x - n.x) * (t.y - n.y) - (e.y - n.y) * (t.x - n.x)) * 100) / 100;
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static sub(t, n) {
    return new k(t.x - n.x, t.y - n.y);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static add(t, n) {
    return new k(t.x + n.x, t.y + n.y);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   * @returns {Point}
   */
  static closestPtPointSegment(t, n) {
    var e = M.sub(n.b, n.a), o = M.sub(t, n.a), s = M.dot(o, e);
    if (s < 0)
      t = n.a;
    else {
      var r = M.dot(e, e);
      s >= r ? t = n.b : (s /= r, o.x = n.a.x + s * e.x, o.y = n.a.y + s * e.y, t = o);
    }
    return k.clone(t);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   */
  static distancePointSegment(t, n) {
    return M.distanceBetween(t, M.closestPtPointSegment(t, n));
  }
  /**
   *
   * @param {*} pt
   * @param {*} boundingBox
   * @returns {boolean}
   */
  static pointWithinBoundingBox(t, n) {
    return t.x >= n.minX && t.y >= n.minY && t.x <= n.maxX && t.y <= n.maxY;
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static pointWithinPolygon(t, n, e) {
    const o = M.segmentsBoundingBox(n);
    if (!this.pointWithinBoundingBox(t, o))
      return !1;
    let s = new k(1e5, 1e5), r = new F(s, t), h = M.segmentSegmentsIntersections(r, n);
    return h.length % 2 != 0 && e && M.pointsEqual(t, h[0]) ? !1 : h.length % 2 != 0;
  }
  /**
   *
   * @param {Segment} seg
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static segmentWithinPolygon(t, n) {
    let e = this.pointWithinPolygon(t.a, n, !1), o = this.pointWithinPolygon(t.b, n, !1), s = this.pointWithinPolygon(t.a, n, !0), r = this.pointWithinPolygon(t.b, n, !0);
    return s && r || s && o || r && e;
  }
  static sign(t, n, e) {
    return (t.x - e.x) * (n.y - e.y) - (n.x - e.x) * (t.y - e.y);
  }
  /**
   *
   * @param {Point} pt
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static pointWithinTriangle(t, n, e, o, s) {
    const r = M.sign(t, n, e), h = M.sign(t, e, o), a = M.sign(t, o, n), l = r < 0 || h < 0 || a < 0, c = r > 0 || h > 0 || a > 0;
    if (!(l && c) && s) {
      let u = { a: n, b: e, tags: null };
      if (M.distancePointSegment(t, u) < 1 || (u.a = e, u.b = o, M.distancePointSegment(t, u) < 1) || (u.a = o, u.b = n, M.distancePointSegment(t, u) < 1)) return !1;
    }
    return !(l && c);
  }
  /**
   *
   * @param {Segment} seg
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static segmentWithinTriangle(t, n, e, o) {
    let s = this.pointWithinTriangle(t.a, n, e, o, !1), r = this.pointWithinTriangle(t.b, n, e, o, !1), h = this.pointWithinTriangle(t.a, n, e, o, !0), a = this.pointWithinTriangle(t.b, n, e, o, !0);
    return M.averagePoints(t.a, t.b), h && a || h && r || a && s || s && r;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {Segment[]}
   */
  static pointsToClosedPolySegments(...t) {
    let n = [];
    for (let e = 0; e < t.length; e++)
      n.push(new F(t[e], e < t.length - 1 ? t[e + 1] : t[0]));
    return n;
  }
  /**
   *
   * @param {Segment[]} polySegsA
   * @param {Segment[]} polySegsB
   * @returns {boolean}
   */
  static polygonWithinPolygon(t, n) {
    const e = M.segmentsBoundingBox(t), o = M.segmentsBoundingBox(n);
    if (!M.boundingBoxesIntersect(e, o))
      return !1;
    new k(o.minX - 100, o.minY - 100);
    for (let s = 0; s < t.length; s++) {
      let r = t[s];
      if (M.segmentSegmentsIntersections(r, n).length % 2 == 0)
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
  static splinePoints(t, n, e, o = 0) {
    let s = (h) => {
      let a = [h[0]];
      for (let l = 0; l < h.length - 1; l++) {
        let c = new k(0, 0);
        l + 1 < h.length * 0.4 ? (c.x = (h[l].x * 40 + h[l + 1].x * 60) * 0.01, c.y = (h[l].y * 40 + h[l + 1].y * 60) * 0.01) : l + 1 > h.length * 0.6 ? (c.x = (h[l].x * 60 + h[l + 1].x * 40) * 0.01, c.y = (h[l].y * 60 + h[l + 1].y * 40) * 0.01) : (c.x = (h[l].x + h[l + 1].x) * 0.5, c.y = (h[l].y + h[l + 1].y) * 0.5), a.push(c);
      }
      return a.push(h[h.length - 1]), a;
    }, r = [t, n, e];
    for (let h = 0; h < o; h++)
      r = s(r);
    return r;
  }
}
class Z {
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {{ originalPts: Object.<string, Point>, pts: string[], cxs: Object.<string,string[]> }}
   */
  static getSegsAndConnections(t, n = !1, e = !1) {
    let o = {}, s = [], r = {}, h = (a) => {
      let l = `${Math.round(a.x * 1)}|${Math.round(a.y * 1)}`;
      return r[l] = a, l;
    };
    if (n) {
      let a = t.reduce((u, f) => u.concat(f.a, f.b), []), l = a.length;
      for (; l--; ) {
        let u = a[l], f = l;
        for (; f--; ) {
          let d = a[f];
          if (M.pointsEqual(u, d)) {
            a.splice(l, 1);
            break;
          }
        }
      }
      let c = t.length;
      for (; c--; ) {
        let u = t[c], f = [];
        if (a.forEach((d) => {
          M.distancePointSegment(d, u) < 0.1 && !M.pointsEqual(d, u.a) && !M.pointsEqual(d, u.b) && f.push(d);
        }), f.length) {
          f.sort((p, w) => {
            const y = M.distanceBetweenSquared(p, u.a), x = M.distanceBetweenSquared(w, u.a);
            return y < x ? -1 : y > x ? 1 : 0;
          });
          const d = [];
          let m = u.a;
          for (let p = 0; p < f.length; p++) {
            let w = f[p];
            d.push(new F(m, w)), m = w;
          }
          d.push(new F(m, u.b)), t.splice(c, 1, ...d);
        }
      }
    }
    if (e) {
      let a = t.length;
      for (; a--; ) {
        let l = a, c = !1;
        for (; l--; ) {
          let u = t[a], f = t[l], d = M.segmentSegmentIntersect(u, f, !0);
          d && (c = !0, t.splice(a, 1, new F(k.clone(u.a), k.clone(d)), new F(k.clone(d), k.clone(u.b))), t.splice(l, 1, new F(k.clone(f.a), k.clone(d)), new F(k.clone(d), k.clone(f.b))));
        }
        c && (a = t.length);
      }
    }
    return t.forEach((a) => {
      let l = h(a.a), c = h(a.b);
      o[l] || (o[l] = []), o[c] || (o[c] = []), o[l].indexOf(c) === -1 && o[l].push(c), o[c].indexOf(l) === -1 && o[c].push(l), s.indexOf(l) === -1 && s.push(l), s.indexOf(c) === -1 && s.push(c);
    }), {
      originalPts: r,
      pts: s,
      cxs: o
    };
  }
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {Segment[]}
   */
  static pathOrder(t, n = !1, e = !1) {
    let o = [], { originalPts: s, pts: r, cxs: h } = Z.getSegsAndConnections(t, n, e), a = (c) => s[c], l = (c, u) => h[c].length > h[u].length ? 1 : h[c].length < h[u].length ? -1 : 0;
    for (r.sort(l); r.length; ) {
      r.sort(l);
      let c = r.shift();
      for (; c; )
        if (h[c].length) {
          h[c].sort(l);
          let u = h[c].shift(), f = h[u].indexOf(c);
          f !== -1 && h[u].splice(f, 1), o.push(new F(a(c), a(u))), h[c].length && r.unshift(c), c = u;
        } else
          c = null;
    }
    return o;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} offset
   * @returns {Point[]}
   */
  static getEndingSegmentPoints(t, n = 0) {
    t = t.concat(), t = Z.pathOrder(t, !0, !0);
    let { originalPts: e, pts: o, cxs: s } = Z.getSegsAndConnections(t, !0), r = (l) => e[l];
    const h = o.filter((l) => s[l].length === 1), a = [];
    return h.forEach((l) => {
      const c = k.clone(r(l));
      if (n === 0) {
        a.push(c);
        return;
      }
      const u = r(s[l]), f = M.angleBetween(u, c), d = new k(0, n);
      M.rotatePoint(d, Math.PI * 0.5 - f), M.addToPoint(c, d), a.push(c);
    }), a;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills(t, n = 5) {
    t = t.concat();
    let { originalPts: e, cxs: o } = Z.getSegsAndConnections(t, !0, !0), s = (x) => {
      let g = `${Math.round(x.x * 1)}|${Math.round(x.y * 1)}`;
      return e[g] = x, g;
    }, r = [], h = [], a = 1e5, l = 1e5, c = -1e5, u = -1e5, f = 1e5, d = 1e5, m = [];
    for (let x in e) {
      let g = e[x];
      m.push(g), a = Math.min(a, g.x), l = Math.min(l, g.y), c = Math.max(c, g.x), u = Math.max(u, g.y);
    }
    m.sort((x, g) => x.x < g.x ? -1 : x.x > g.x ? 1 : 0), m.forEach((x, g) => {
      if (g > 0) {
        let b = m[g - 1], S = Math.round(Math.abs(x.x - b.x));
        S > 1 && (f = Math.min(f, S));
      }
    }), m.sort((x, g) => x.y < g.y ? -1 : x.y > g.y ? 1 : 0), m.forEach((x, g) => {
      if (g > 0) {
        let b = m[g - 1], S = Math.round(Math.abs(x.y - b.y));
        S > 1 && (d = Math.min(d, S));
      }
    });
    let p = f * 0.5, w = d * 0.5, y = [];
    for (let x = l; x < u; x += d)
      for (let g = a; g < c; g += f)
        y.push(new k(g + p, x + w));
    return y.forEach((x) => {
      let g = [];
      if (m.forEach((P) => {
        let v = M.distanceBetween(P, x);
        if (v < Math.max(f, d) * n) {
          let I = M.angleBetween(P, x);
          g.push({
            pt: P,
            dist: v,
            ang: I
          });
        }
      }), g.length < 4)
        return;
      let b = g.length;
      for (; b--; ) {
        let P = g[b].pt, v = new F(x, P);
        M.segmentSegmentsIntersections(v, t, !0).length > 0 && g.splice(b, 1);
      }
      for (g.sort((P, v) => P.ang < v.ang ? -1 : P.ang > v.ang ? 1 : 0), b = g.length; b--; ) {
        let P = g[b].pt, v = s(P), I = g.length, E = !1;
        for (; I--; ) {
          if (b === I)
            continue;
          let Y = g[I].pt, z = s(Y);
          if (o[v].indexOf(z) === -1) {
            E = !0;
            break;
          }
        }
        E || g.splice(b, 1);
      }
      let S = !0;
      if (g.forEach((P, v) => {
        let I = g[(v + 1) % g.length], E = s(P.pt), Y = s(I.pt);
        o[E].indexOf(Y) === -1 && (S = !1);
      }), S) {
        let P = g.map((E) => E.pt), v = M.averagePoints(...P), I = s(v);
        r.indexOf(I) === -1 && (r.push(I), h.push(P));
      }
    }), h;
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
  static segmentCollections(t, n = !1, e = !0, o = 1, s = !1, r = !1, h = !1) {
    let a = t.reduce((l, c) => l.concat(c.toSegments()), []);
    return tt.segments(a, n, e, o, s, r, h);
  }
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollectionsPathOrder(t, n = !1, e = !1) {
    let o = t.reduce((s, r) => s.concat(r.toSegments()), []);
    return new _(Z.pathOrder(o, n, e));
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
  static segments(t, n = !1, e = !0, o = 1, s = !1, r = !1, h = !1) {
    return t = tt._segments(t, n, e, o), s && (t = Z.pathOrder(t, r, h)), new _(t);
  }
  /**
   * JS fallback for segment optimization  
   * @private
   */
  static _segments(t, n, e, o) {
    const s = t;
    for (t = []; s.length; ) {
      let h = s.shift(), a = t.length, l = !1;
      for (; a--; ) {
        const c = t[a];
        if (F.isEqual(h, c)) {
          l = !0;
          break;
        }
      }
      l || t.push(h);
    }
    if (!n)
      for (let h = 0; h < 3; h++) {
        let a = t.length;
        for (; a--; ) {
          let l = t[a], c, u, f, d, m;
          for (let p = a - 1; p >= 0; p--) {
            let w = t[p], y = !1, x = !1;
            if (M.sameAngle(l, w) ? (y = !0, c = k.clone(l.a), u = k.clone(l.b), f = k.clone(w.a), d = k.clone(w.b)) : M.sameAngleRev(l, w) && (y = x = !0, c = k.clone(l.b), u = k.clone(l.a), f = k.clone(w.a), d = k.clone(w.b)), y && (m = M.angleBetween(c, u), M.rotatePoints(m, c, u, f, d), Math.abs(c.y - f.y) < 0.1 && u.x >= f.x - 1e-4 && c.x <= d.x + 1e-4)) {
              c.x < f.x && (x ? w.a = l.b : w.a = l.a), u.x > d.x && (x ? w.b = l.a : w.b = l.b), t.splice(a, 1);
              break;
            }
          }
        }
      }
    let r = t.length;
    for (; r--; ) {
      let h = t[r];
      if (!h) {
        t.splice(r, 1);
        continue;
      }
      if (e && M.distanceBetween(h.a, h.b) < o) {
        t.splice(r, 1);
        continue;
      }
    }
    return console.log(`[JS] Optimize: ${s.length + t.length} -> ${t.length} segments`), t;
  }
}
function Jt(i, t) {
  const n = i.geometry, e = n.attributes.position, o = n.index;
  if (!e) return [];
  const s = /* @__PURE__ */ new Map(), r = 1e3, h = (u, f) => {
    const d = Math.round(u.x * r), m = Math.round(u.y * r), p = Math.round(u.z * r), w = Math.round(f.x * r), y = Math.round(f.y * r), x = Math.round(f.z * r), g = `${d},${m},${p}`, b = `${w},${y},${x}`;
    return g < b ? `${g}|${b}` : `${b}|${g}`;
  }, a = (u) => new $(
    e.getX(u),
    e.getY(u),
    e.getZ(u)
  ).applyMatrix4(i.matrixWorld), l = (u, f, d) => {
    const m = new $().subVectors(f, u), p = new $().subVectors(d, u);
    return new $().crossVectors(m, p).normalize();
  }, c = o ? o.count / 3 : e.count / 3;
  for (let u = 0; u < c; u++) {
    let f, d, m;
    o ? (f = o.getX(u * 3), d = o.getX(u * 3 + 1), m = o.getX(u * 3 + 2)) : (f = u * 3, d = u * 3 + 1, m = u * 3 + 2);
    const p = a(f), w = a(d), y = a(m), x = l(p, w, y), g = new $().addVectors(p, w).add(y).divideScalar(3), b = new $().subVectors(t, g);
    if (x.dot(b) <= 0)
      continue;
    const S = [
      [p, w],
      [w, y],
      [y, p]
    ];
    for (const [P, v] of S) {
      const I = h(P, v);
      if (s.has(I)) {
        const E = s.get(I);
        E && !E.normal2 && (E.normal2 = x.clone(), E.faceIdx2 = u);
      } else
        s.set(I, {
          a: P.clone(),
          b: v.clone(),
          normal1: x.clone(),
          faceIdx1: u,
          mesh: i
        });
    }
  }
  return Array.from(s.values());
}
function Zt(i, t) {
  return i.filter((n) => {
    const e = new $().addVectors(n.a, n.b).multiplyScalar(0.5), o = new $().subVectors(t, e).normalize(), s = n.normal1.dot(o) > 0;
    if (!n.normal2)
      return !0;
    const r = n.normal2.dot(o) > 0;
    return s || r;
  });
}
function Kt(i, t, n = 0.99) {
  const e = [], o = [];
  for (const s of i) {
    const r = new $().addVectors(s.a, s.b).multiplyScalar(0.5), h = new $().subVectors(t, r).normalize(), a = s.normal1.dot(h) > 0, l = s.normal2 ? s.normal2.dot(h) > 0 : !0;
    if (a !== l || !s.normal2) {
      e.push(s);
      continue;
    }
    s.normal2 && s.normal1.dot(s.normal2) < n && o.push(s);
  }
  return console.log(`classifyEdges: ${e.length} profiles, ${o.length} smooth/crease edges`), { profiles: e, smoothFiltered: o };
}
function dt(i, t, n, e, o = 1) {
  const s = n / 2, r = e / 2, h = (a) => {
    const l = a.clone().project(t);
    return new D(
      l.x * s * o,
      -l.y * r * o
    );
  };
  return i.map((a) => ({
    a: h(a.a),
    b: h(a.b),
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
function Qt(i, t) {
  const n = i.a.x, e = i.a.y, o = i.b.x, s = i.b.y, r = t.a.x, h = t.a.y, a = t.b.x, l = t.b.y, c = (n - o) * (h - l) - (e - s) * (r - a);
  if (Math.abs(c) < 1e-10) return null;
  const u = ((n - r) * (h - l) - (e - h) * (r - a)) / c, f = -((n - o) * (e - h) - (e - s) * (n - r)) / c, d = 1e-3;
  return u > d && u < 1 - d && f > d && f < 1 - d ? {
    t1: u,
    t2: f,
    point: new D(
      n + u * (o - n),
      e + u * (s - e)
    )
  } : null;
}
function _t(i) {
  var r, h, a, l, c, u;
  const t = /* @__PURE__ */ new Map(), n = 0.01, e = (f, d) => {
    const m = d.b.x - d.a.x, p = d.b.y - d.a.y, w = m * m + p * p;
    if (w < 1e-10) return null;
    const y = ((f.x - d.a.x) * m + (f.y - d.a.y) * p) / w;
    if (y <= n || y >= 1 - n) return null;
    const x = d.a.x + y * m, g = d.a.y + y * p;
    return (f.x - x) * (f.x - x) + (f.y - g) * (f.y - g) < 1 ? y : null;
  }, o = /* @__PURE__ */ new Set();
  for (let f = 0; f < i.length; f++)
    for (let d = f + 1; d < i.length; d++) {
      const m = Qt(i[f], i[d]);
      if (m)
        t.has(i[f]) || t.set(i[f], []), t.has(i[d]) || t.set(i[d], []), (r = t.get(i[f])) == null || r.push({ t: m.t1, point: m.point }), (h = t.get(i[d])) == null || h.push({ t: m.t2, point: m.point });
      else {
        const p = e(i[f].a, i[d]);
        p !== null && (t.has(i[d]) || t.set(i[d], []), (a = t.get(i[d])) == null || a.push({ t: p, point: i[f].a.clone() }), o.add(i[f]), o.add(i[d]));
        const w = e(i[f].b, i[d]);
        w !== null && (t.has(i[d]) || t.set(i[d], []), (l = t.get(i[d])) == null || l.push({ t: w, point: i[f].b.clone() }), o.add(i[f]), o.add(i[d]));
        const y = e(i[d].a, i[f]);
        y !== null && (t.has(i[f]) || t.set(i[f], []), (c = t.get(i[f])) == null || c.push({ t: y, point: i[d].a.clone() }), o.add(i[f]), o.add(i[d]));
        const x = e(i[d].b, i[f]);
        x !== null && (t.has(i[f]) || t.set(i[f], []), (u = t.get(i[f])) == null || u.push({ t: x, point: i[d].b.clone() }), o.add(i[f]), o.add(i[d]));
      }
    }
  console.log(`T-junction detection: ${o.size} potential straggler edges`);
  const s = [];
  for (const f of i) {
    const d = t.get(f), m = o.has(f);
    if (!d || d.length === 0) {
      f.isTJunctionStraggler = m, s.push(f);
      continue;
    }
    d.sort((y, x) => y.t - x.t);
    let p = f.a, w = f.a3d;
    for (const y of d) {
      const x = new $().lerpVectors(f.a3d, f.b3d, y.t);
      s.push({
        a: p.clone(),
        b: y.point.clone(),
        a3d: w.clone(),
        b3d: x.clone(),
        midpoint3d: new $().addVectors(w, x).multiplyScalar(0.5),
        isProfile: f.isProfile,
        visible: f.visible,
        faceIdx: f.faceIdx,
        mesh: f.mesh,
        isHatch: f.isHatch,
        normal1: f.normal1,
        // Propagate normal for smooth filter
        isTJunctionStraggler: m
      }), y.t, p = y.point, w = x;
    }
    s.push({
      a: p.clone(),
      b: f.b.clone(),
      a3d: w.clone(),
      b3d: f.b3d.clone(),
      midpoint3d: new $().addVectors(w, f.b3d).multiplyScalar(0.5),
      isProfile: f.isProfile,
      visible: f.visible,
      faceIdx: f.faceIdx,
      mesh: f.mesh,
      isHatch: f.isHatch,
      normal1: f.normal1,
      // Propagate normal for smooth filter
      isTJunctionStraggler: m
    });
  }
  return s;
}
function Gt(i, t, n, e) {
  const o = (c, u, f) => (c.x - f.x) * (u.y - f.y) - (u.x - f.x) * (c.y - f.y), s = o(i, t, n), r = o(i, n, e), h = o(i, e, t), a = s < 0 || r < 0 || h < 0, l = s > 0 || r > 0 || h > 0;
  return !(a && l);
}
function Ut(i, t, n, e, o = 2) {
  const s = e.x - n.x, r = e.y - n.y, h = s * s + r * r;
  if (h < 1e-10) return !1;
  const a = (l) => {
    const c = ((l.x - n.x) * s + (l.y - n.y) * r) / h, u = n.x + c * s, f = n.y + c * r;
    return (l.x - u) * (l.x - u) + (l.y - f) * (l.y - f) < o * o && c >= -0.01 && c <= 1.01;
  };
  return a(i) && a(t);
}
function tn(i, t) {
  const n = [];
  for (const e of t) {
    const o = [
      { a: e.a2d, b: e.b2d, name: "AB" },
      { a: e.b2d, b: e.c2d, name: "BC" },
      { a: e.c2d, b: e.a2d, name: "CA" }
    ];
    for (const s of o)
      if (Ut(i.a, i.b, s.a, s.b)) {
        n.push({
          face: e,
          matchedEdge: s.name,
          matchType: "collinear"
        });
        break;
      }
  }
  return n;
}
function nn(i, t, n, e, o, s, r) {
  const h = { x: e.x - t.x, y: e.y - t.y }, a = { x: n.x - t.x, y: n.y - t.y }, l = { x: i.x - t.x, y: i.y - t.y }, c = h.x * h.x + h.y * h.y, u = h.x * a.x + h.y * a.y, f = h.x * l.x + h.y * l.y, d = a.x * a.x + a.y * a.y, m = a.x * l.x + a.y * l.y, p = c * d - u * u;
  if (Math.abs(p) < 1e-10) return 1 / 0;
  const w = (d * f - u * m) / p, y = (c * m - u * f) / p;
  return (1 - w - y) * o + y * s + w * r;
}
function en(i, t, n = 0.99, e = 0.5) {
  const o = [];
  let s = 0;
  for (const r of i) {
    const h = tn(r, t);
    r.adjacentFaceCount = h.length;
    let a = !1;
    if (h.length === 2) {
      const l = h[0].face, c = h[1].face, u = l.normal, f = c.normal;
      if (u && f) {
        const d = u.dot(f), m = Math.abs(d);
        r.faceSimilarity = m;
        let p;
        d > 0 ? p = Math.abs(l.constant - c.constant) : p = Math.abs(l.constant + c.constant), m >= n && p < e && (a = !0, s++);
      }
    } else if (h.length > 2) {
      const l = h.map((c) => c.face).filter((c) => c.normal);
      if (l.length >= 2) {
        let c = !0, u = 1;
        for (let f = 1; f < l.length; f++) {
          const d = l[0].normal.dot(l[f].normal), m = Math.abs(d);
          let p;
          if (d > 0 ? p = Math.abs(l[0].constant - l[f].constant) : p = Math.abs(l[0].constant + l[f].constant), u = Math.min(u, m), m < n || p >= e) {
            c = !1;
            break;
          }
        }
        r.faceSimilarity = u, c && (a = !0, s++);
      }
    }
    a || o.push(r);
  }
  return console.log(`Geometric straggler filter: removed ${s} coplanar edges`), o;
}
function on(i, t, n) {
  const e = n.position;
  return sn(i, t, e);
}
function sn(i, t, n) {
  const e = [];
  let o = 0, s = 0;
  for (const r of i) {
    const h = new D(
      (r.a.x + r.b.x) / 2,
      (r.a.y + r.b.y) / 2
    ), a = r.midpoint3d, l = n.distanceTo(a);
    let c = !1;
    for (const u of t) {
      if (u.mesh === r.mesh && (u.faceIdx === r.faceIdx || u.faceIdx === r.faceIdx2) || !Gt(h, u.a2d, u.b2d, u.c2d))
        continue;
      if (nn(
        h,
        u.a2d,
        u.b2d,
        u.c2d,
        u.depthA,
        u.depthB,
        u.depthC
      ) < l - 1e-3) {
        c = !0, s++;
        break;
      }
      o++;
    }
    c ? r.visible = !1 : (r.visible = !0, e.push(r));
  }
  return console.log(`[JS] Occlusion debug: ${o} point-in-triangle hits, ${s} occluded`), e;
}
function rn(i, t = 0.5) {
  const n = /* @__PURE__ */ new Map(), e = (s) => `${Math.round(s.x / t)},${Math.round(s.y / t)}`, o = (s) => {
    const r = e(s.a), h = e(s.b);
    return r < h ? `${r}-${h}` : `${h}-${r}`;
  };
  for (const s of i) {
    const r = o(s);
    n.has(r) || n.set(r, s);
  }
  return Array.from(n.values());
}
function cn(i, t = 1, n = 50) {
  const e = (y) => `${Math.round(y.x / t)},${Math.round(y.y / t)}`, o = /* @__PURE__ */ new Map();
  for (const y of i)
    for (const x of ["a", "b"]) {
      const g = y[x], b = e(g);
      o.has(b) || o.set(b, { edges: [], point: { x: g.x, y: g.y } }), o.get(b).edges.push({ edge: y, endpoint: x });
    }
  const s = [];
  for (const [y, x] of o)
    if (x.edges.length === 1) {
      const { edge: g, endpoint: b } = x.edges[0], S = x.point, P = b === "a" ? g.b : g.a, v = S.x - P.x, I = S.y - P.y, E = Math.sqrt(v * v + I * I);
      if (E < 1e-3) continue;
      s.push({
        key: y,
        edge: g,
        endpoint: b,
        point: S,
        otherPoint: P,
        dirX: v / E,
        dirY: I / E,
        len: E
      });
    }
  if (console.log(`Edge cleanup: found ${s.length} orphaned endpoints`), s.length === 0) return i;
  const r = (y, x, g, b) => {
    const S = x.x * b.y - x.y * b.x;
    if (Math.abs(S) < 1e-4) return null;
    const P = g.x - y.x, v = g.y - y.y, I = (P * b.y - v * b.x) / S, E = (P * x.y - v * x.x) / S;
    return { t1: I, t2: E };
  };
  let h = 0;
  const a = /* @__PURE__ */ new Set();
  for (let y = 0; y < s.length; y++) {
    const x = s[y];
    if (a.has(x.key)) continue;
    let g = null, b = null, S = 1 / 0;
    for (let P = 0; P < s.length; P++) {
      if (y === P) continue;
      const v = s[P];
      if (a.has(v.key) || Math.sqrt(
        (v.point.x - x.point.x) ** 2 + (v.point.y - x.point.y) ** 2
      ) > n * 2) continue;
      const E = r(
        { x: x.point.x, y: x.point.y },
        { x: x.dirX, y: x.dirY },
        { x: v.point.x, y: v.point.y },
        { x: v.dirX, y: v.dirY }
      );
      if (!E || E.t1 < -0.1 || E.t2 < -0.1 || E.t1 > n || E.t2 > n) continue;
      const Y = x.point.x + E.t1 * x.dirX, z = x.point.y + E.t1 * x.dirY, R = E.t1 + E.t2;
      R < S && (S = R, g = v, b = { x: Y, y: z });
    }
    if (g && b) {
      const P = xt(
        x.point,
        b,
        i,
        x.edge,
        g.edge
      ), v = xt(
        g.point,
        b,
        i,
        x.edge,
        g.edge
      );
      if (P || v)
        continue;
      x.endpoint === "a" ? (x.edge.a.x = b.x, x.edge.a.y = b.y) : (x.edge.b.x = b.x, x.edge.b.y = b.y), g.endpoint === "a" ? (g.edge.a.x = b.x, g.edge.a.y = b.y) : (g.edge.b.x = b.x, g.edge.b.y = b.y), a.add(x.key), a.add(g.key), h++;
    }
  }
  console.log(`Edge cleanup: extended ${h} pairs of edges to intersections`);
  let l = 0;
  for (const y of i) {
    const x = y.b.x - y.a.x, g = y.b.y - y.a.y;
    l += Math.sqrt(x * x + g * g);
  }
  const c = l / i.length, u = c / 8;
  console.log(`Edge cleanup: average edge length = ${c.toFixed(2)}, snap threshold = ${u.toFixed(2)}`);
  const f = /* @__PURE__ */ new Map();
  for (const y of i)
    for (const x of ["a", "b"]) {
      const g = y[x], b = e(g);
      f.has(b) || f.set(b, { edges: [], point: g }), f.get(b).edges.push({ edge: y, endpoint: x });
    }
  const d = [];
  for (const [y, x] of f)
    x.edges.length === 1 && d.push({ key: y, ...x.edges[0], point: x.point });
  console.log(`Edge cleanup: ${d.length} orphaned endpoints before snap pass`);
  let m = 0;
  const p = /* @__PURE__ */ new Set();
  for (let y = 0; y < d.length; y++) {
    const x = d[y];
    if (p.has(x.key)) continue;
    let g = null, b = 1 / 0;
    for (let S = 0; S < d.length; S++) {
      if (y === S) continue;
      const P = d[S];
      if (p.has(P.key)) continue;
      const v = Math.sqrt(
        (P.point.x - x.point.x) ** 2 + (P.point.y - x.point.y) ** 2
      );
      v < b && (b = v, g = P);
    }
    if (g && b < u) {
      const S = (x.point.x + g.point.x) / 2, P = (x.point.y + g.point.y) / 2;
      x.endpoint === "a" ? (x.edge.a.x = S, x.edge.a.y = P) : (x.edge.b.x = S, x.edge.b.y = P), g.endpoint === "a" ? (g.edge.a.x = S, g.edge.a.y = P) : (g.edge.b.x = S, g.edge.b.y = P), p.add(x.key), p.add(g.key), m++;
    }
  }
  console.log(`Edge cleanup: snapped ${m} pairs of nearby orphans`);
  const w = d.length - m * 2;
  return console.log(`Edge cleanup: ${w} orphaned endpoints remaining`), i;
}
function an(i, t = 1) {
  const n = (r) => `${Math.round(r.x / t)},${Math.round(r.y / t)}`, e = /* @__PURE__ */ new Map();
  for (const r of i) {
    const h = n(r.a), a = n(r.b);
    e.set(h, (e.get(h) || 0) + 1), e.set(a, (e.get(a) || 0) + 1);
  }
  const o = i.filter((r) => {
    const h = n(r.a), a = n(r.b), l = e.get(h) || 0, c = e.get(a) || 0;
    return l >= 2 || c >= 2;
  }), s = i.length - o.length;
  return s > 0 && console.log(`Edge cleanup: removed ${s} isolated edges (orphaned at both ends)`), o;
}
function xt(i, t, n, e, o) {
  for (const r of n) {
    if (r === e || r === o) continue;
    const h = t.x - i.x, a = t.y - i.y, l = r.b.x - r.a.x, c = r.b.y - r.a.y, u = h * c - a * l;
    if (Math.abs(u) < 1e-3) continue;
    const f = r.a.x - i.x, d = r.a.y - i.y, m = (f * c - d * l) / u, p = (f * a - d * h) / u;
    if (m > 1e-3 && m < 1 - 1e-3 && p > 1e-3 && p < 1 - 1e-3)
      return !0;
  }
  return !1;
}
function ln(i, t, n, e = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: s = 32,
    skipOcclusion: r = !1,
    width: h = 800,
    height: a = 600,
    renderer: l = null,
    internalScale: c = 4,
    // Scale up internally for better precision
    distanceThreshold: u = 0.5
    // Default plane distance threshold
  } = e;
  let f = [];
  for (const X of i) {
    X.updateMatrixWorld(!0);
    const H = Jt(X, t.position);
    f.push(...H);
  }
  console.log(`Extracted ${f.length} edges from ${i.length} meshes`);
  const { profiles: d, smoothFiltered: m } = Kt(f, t.position, o);
  console.log(`Profiles: ${d.length}, Crease edges: ${m.length}`);
  const p = [...d, ...m];
  console.log(`After smooth filter: ${p.length} edges`);
  let w = dt(p, t, h, a, c);
  if (e.hatchEdges && e.hatchEdges.length > 0) {
    console.log(`Processing ${e.hatchEdges.length} hatch edges...`);
    let X = Zt(e.hatchEdges, t.position);
    if (e.minHatchDotProduct !== void 0) {
      const O = e.minHatchDotProduct;
      X = X.filter((T) => {
        const A = new $().addVectors(T.a, T.b).multiplyScalar(0.5), q = new $().subVectors(t.position, A).normalize(), V = T.normal1.dot(q);
        return Math.abs(V) >= O;
      }), console.log(`Density filter: kept ${X.length} hatch edges (threshold ${O})`);
    }
    const H = dt(X, t, h, a, c);
    H.forEach((O) => O.isHatch = !0), w.push(...H), console.log(`Added ${H.length} visible hatch edges`);
  }
  console.time("splitIntersections");
  const y = _t(w);
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${y.length} edges`), console.time("buildProjectedFaces");
  const x = [], g = t.position, b = h / 2, S = a / 2;
  for (const X of i) {
    const H = X.geometry, O = H.attributes.position, T = H.index, A = T ? T.count / 3 : O.count / 3;
    for (let q = 0; q < A; q++) {
      let V, C, W;
      T ? (V = T.getX(q * 3), C = T.getX(q * 3 + 1), W = T.getX(q * 3 + 2)) : (V = q * 3, C = q * 3 + 1, W = q * 3 + 2);
      const B = new $(O.getX(V), O.getY(V), O.getZ(V)).applyMatrix4(X.matrixWorld), N = new $(O.getX(C), O.getY(C), O.getZ(C)).applyMatrix4(X.matrixWorld), j = new $(O.getX(W), O.getY(W), O.getZ(W)).applyMatrix4(X.matrixWorld), J = new $().subVectors(N, B), K = new $().subVectors(j, B), Q = new $().crossVectors(J, K).normalize(), nt = new $().addVectors(B, N).add(j).divideScalar(3), et = new $().subVectors(g, nt), ot = -Q.dot(B);
      if (Q.dot(et) <= 0) continue;
      const at = B.clone().project(t), lt = N.clone().project(t), ht = j.clone().project(t), pt = new D(at.x * b * c, -at.y * S * c), bt = new D(lt.x * b * c, -lt.y * S * c), wt = new D(ht.x * b * c, -ht.y * S * c), Mt = g.distanceTo(B), Pt = g.distanceTo(N), St = g.distanceTo(j);
      x.push({
        a2d: pt,
        b2d: bt,
        c2d: wt,
        depthA: Mt,
        depthB: Pt,
        depthC: St,
        mesh: X,
        faceIdx: q,
        normal: Q,
        // Store normal for post-split smooth filter
        constant: ot
        // Store plane constant for coplanar detection
      });
    }
  }
  console.timeEnd("buildProjectedFaces"), console.log(`Built ${x.length} projected faces for occlusion`), console.time("classifySilhouettes"), hn(y, x), console.timeEnd("classifySilhouettes"), console.time("filterSmoothSplitEdges");
  const P = en(y, x, o, u);
  console.timeEnd("filterSmoothSplitEdges");
  let v;
  r ? v = P : (console.time("testOcclusion (math)"), v = on(P, x, t), console.timeEnd("testOcclusion (math)")), console.log(`Visible edges: ${v.length}`), console.time("optimize");
  const I = rn(v);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const E = cn(I);
  console.timeEnd("cleanup orphans");
  const Y = an(E);
  console.log(`Final edges before optimization: ${Y.length}`);
  let z = Y;
  if (Y.length > 0) {
    let X = 0;
    for (const T of Y) {
      const A = T.b.x - T.a.x, q = T.b.y - T.a.y;
      X += Math.sqrt(A * A + q * q);
    }
    const H = X / Y.length, O = H / 10;
    console.log(`Optimization: avgLen=${H.toFixed(2)}, trim limit=${O.toFixed(2)}`), console.time("Optimize.segments"), z = tt.segments(Y, !1, !0, O, !1, !1, !1)._segments, console.timeEnd("Optimize.segments"), console.log(`After optimization: ${z.length} edges`);
  }
  for (const X of z)
    X.a.x /= c, X.a.y /= c, X.b.x /= c, X.b.y /= c;
  const R = z;
  return {
    edges: R,
    profiles: R.filter((X) => X.isProfile),
    allEdges: y,
    // For debug visualization
    projectedFaces: x
    // For face visualization
  };
}
function hn(i, t) {
  for (const o of i) {
    if (o.isHatch) {
      o.isSilhouette = !1;
      continue;
    }
    const s = (o.a.x + o.b.x) / 2, r = (o.a.y + o.b.y) / 2, h = o.b.x - o.a.x, a = o.b.y - o.a.y, l = Math.sqrt(h * h + a * a);
    if (l < 1e-3) {
      o.isSilhouette = !1;
      continue;
    }
    const c = -a / l, u = h / l, f = gt(s, r, c, u, 1e3, t), d = gt(s, r, -c, -u, 1e3, t);
    o.isSilhouette = !f || !d;
  }
  const e = i.filter((o) => o.isSilhouette).length;
  console.log(`Classified ${e} silhouette edges out of ${i.length}`);
}
function gt(i, t, n, e, o, s) {
  for (const r of s)
    if (un(i, t, n, e, o, r.a2d, r.b2d, r.c2d))
      return !0;
  return !1;
}
function un(i, t, n, e, o, s, r, h) {
  return !!(st(i, t, n, e, o, s.x, s.y, r.x, r.y) || st(i, t, n, e, o, r.x, r.y, h.x, h.y) || st(i, t, n, e, o, h.x, h.y, s.x, s.y));
}
function st(i, t, n, e, o, s, r, h, a) {
  const l = h - s, c = a - r, u = n * c - e * l;
  if (Math.abs(u) < 1e-10) return !1;
  const f = ((s - i) * c - (r - t) * l) / u, d = ((s - i) * e - (r - t) * n) / u;
  return f > 0.1 && f <= o && d >= 0 && d <= 1;
}
var L = (i) => Math.round(i * 100) / 100, ct = function(i) {
  mt.call(this), this.node = i;
};
ct.prototype = Object.create(mt.prototype);
ct.prototype.constructor = ct;
var dn = function() {
  var i = this, t = document.createElementNS("http://www.w3.org/2000/svg", "svg"), n = document.createElementNS("http://www.w3.org/2000/svg", "g"), e = document.createElementNS("http://www.w3.org/2000/svg", "g"), o = document.createElementNS("http://www.w3.org/2000/svg", "g"), s, r, h, a, l = new $t();
  t.setAttribute("xmlns", "http://www.w3.org/2000/svg"), t.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape"), t.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink"), t.setAttribute("version", "1.1"), n.setAttribute("inkscape:label", "Silhouettes"), n.setAttribute("inkscape:groupmode", "layer"), n.id = "silhouettes_layer", t.appendChild(n), o.setAttribute("inkscape:label", "Shading"), o.setAttribute("inkscape:groupmode", "layer"), o.id = "shading_layer", t.appendChild(o), e.setAttribute("inkscape:label", "Edges"), e.setAttribute("inkscape:groupmode", "layer"), e.id = "edges_layer", t.appendChild(e), this.domElement = t, this.showSilhouettes = !0, this.showEdges = !0, this.showHatches = !0, this.silhouetteOptions = {
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
    l.set(u);
  }, this.setPixelRatio = function() {
  }, this.setSize = function(u, f) {
    s = u, r = f, h = s / 2, a = r / 2, t.setAttribute("viewBox", -h + " " + -a + " " + s + " " + r), t.setAttribute("width", s), t.setAttribute("height", r);
  }, this.getSize = function() {
    return {
      width: s,
      height: r
    };
  }, this.setGLRenderer = function(u) {
    i._glRenderer = u;
  };
  function c() {
    for (; n.childNodes.length > 0; )
      n.removeChild(n.childNodes[0]);
    for (; e.childNodes.length > 0; )
      e.removeChild(e.childNodes[0]);
    for (; o.childNodes.length > 0; )
      o.removeChild(o.childNodes[0]);
  }
  this.clear = function() {
    c(), t.style.backgroundColor = l.getStyle();
  }, this.renderGPULayers = function(u, f) {
    if (!i._glRenderer) {
      console.warn("PlotterRenderer: WebGL renderer not set. Call setGLRenderer() first.");
      return;
    }
    const d = i._glRenderer;
    if (i.showSilhouettes || i.showHatches) {
      const m = Xt(d, u, f, {
        normalBuckets: i.silhouetteOptions.normalBuckets,
        simplifyTolerance: i.silhouetteOptions.simplifyTolerance,
        minArea: i.silhouetteOptions.minArea,
        insetPixels: i.showHatches ? i.hatchOptions.insetPixels : 0
      });
      if (i.showSilhouettes && m.forEach((p) => {
        if (p.boundary.length < 3) return;
        const w = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let y = "";
        p.boundary.forEach((P, v) => {
          const I = P.x, E = -P.y;
          y += (v === 0 ? "M" : "L") + L(I) + "," + L(E);
        }), y += "Z";
        const x = p.normal, g = Math.floor((x.x * 0.5 + 0.5) * 255), b = Math.floor((x.y * 0.5 + 0.5) * 255), S = Math.floor((x.z * 0.5 + 0.5) * 255);
        w.setAttribute("d", y), w.setAttribute("fill", `rgba(${g},${b},${S},0.3)`), w.setAttribute("stroke", "none"), n.appendChild(w);
      }), i.showHatches) {
        m.sort((w, y) => w.depth - y.depth);
        const p = m.map((w) => w.boundary);
        m.forEach((w, y) => {
          let x = Bt(w, f, {
            baseSpacing: i.hatchOptions.baseSpacing,
            minSpacing: i.hatchOptions.minSpacing,
            maxSpacing: i.hatchOptions.maxSpacing,
            depthFactor: i.hatchOptions.depthFactor,
            insetPixels: i.hatchOptions.insetPixels,
            screenWidth: s,
            screenHeight: r,
            axisSettings: i.hatchOptions.axisSettings
          });
          for (let g = 0; g < y; g++)
            x = x.flatMap(
              (b) => Rt(b, p[g])
            );
          x.forEach((g) => {
            const b = document.createElementNS("http://www.w3.org/2000/svg", "path"), S = `M${L(g.start.x)},${L(-g.start.y)}L${L(g.end.x)},${L(-g.end.y)}`;
            b.setAttribute("d", S), b.setAttribute("fill", "none"), b.setAttribute("stroke", i.hatchOptions.stroke), b.setAttribute("stroke-width", i.hatchOptions.strokeWidth), o.appendChild(b);
          });
        });
      }
      if (i.showEdges) {
        const p = [];
        u.traverse((w) => {
          w.isMesh && w.geometry && p.push(w);
        }), p.length > 0 && (ln(p, f, u, {
          smoothThreshold: i.hiddenLineOptions.smoothThreshold,
          width: s,
          height: r
        }).edges || []).forEach((x) => {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "line");
          g.setAttribute("x1", L(x.a.x)), g.setAttribute("y1", L(x.a.y)), g.setAttribute("x2", L(x.b.x)), g.setAttribute("y2", L(x.b.y)), g.setAttribute("stroke", i.edgeOptions.stroke), g.setAttribute("stroke-width", i.edgeOptions.strokeWidth), e.appendChild(g);
        });
      }
    }
  }, this.render = function(u, f) {
    if (!(f instanceof It)) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }
  };
};
export {
  dn as PlotterRenderer,
  ct as SVGObject
};

import { Vector2 as R, Vector3 as $, WebGLRenderTarget as bt, NearestFilter as rt, MeshNormalMaterial as qt, MeshDepthMaterial as Dt, RGBADepthPacking as At, UnsignedByteType as Ht, RGBAFormat as Wt, ShaderMaterial as Rt, DoubleSide as Lt, BufferGeometry as Nt, BufferAttribute as wt, Mesh as Vt, Scene as jt, Raycaster as Zt, Color as Jt, Camera as Kt, Object3D as Pt } from "three";
function Qt(s, t, e, n = {}) {
  const {
    resolution: o = 2,
    // Render at 2x for smooth boundaries
    normalBuckets: i = 12,
    // Quantize normals into N directions
    minArea: r = 100,
    // Minimum region area in pixels (at output scale)
    simplifyTolerance: l = 2,
    insetPixels: c = 0
    // Inset boundaries by this many pixels (GPU erosion)
  } = n, h = s.getSize(new R()), u = Math.floor(h.x * o), a = Math.floor(h.y * o), f = Math.round(c * o), d = _t(s, t, e, u, a), g = Gt(s, t, e, u, a), { regionMap: p, normalLookup: b } = te(d, u, a), { labels: m, regionCount: x, labelToNormalId: y } = ee(p, u, a), M = [];
  for (let E = 1; E <= x; E++) {
    const k = ne(m, u, a, E);
    if (k.length < 3) continue;
    const w = gt(k, l), S = Math.abs(It(w));
    if (S < r) continue;
    const P = y[E], O = b[P] || new $(0, 0, 1), X = Ut(m, g, u, a, E), q = f / o, C = w.map((z) => ({
      x: z.x / o - h.x / 2,
      y: z.y / o - h.y / 2
    })), I = se(C, q);
    M.push({
      boundary: C.map((z) => new R(z.x, z.y)),
      hatchBoundary: I.map((z) => new R(z.x, z.y)),
      normal: O,
      depth: X,
      // 0-1 normalized depth
      area: S / (o * o),
      regionId: E
    });
  }
  return ce(M), M;
}
function _t(s, t, e, n, o) {
  const i = new bt(n, o, {
    minFilter: rt,
    magFilter: rt
  }), r = new qt({ flatShading: !0 }), l = /* @__PURE__ */ new Map(), c = [];
  t.traverse((a) => {
    let f = !1, d = a;
    for (; d; ) {
      if (d.userData && d.userData.excludeFromSVG) {
        f = !0;
        break;
      }
      d = d.parent;
    }
    if (f) {
      a.visible && (c.push(a), a.visible = !1);
      return;
    }
    a.isMesh ? (l.set(a, a.material), a.material = r) : (a.isLineSegments || a.isLine || a.isPoints) && a.visible && (c.push(a), a.visible = !1);
  });
  const h = t.background;
  t.background = null, s.setRenderTarget(i), s.render(t, e), t.background = h, t.traverse((a) => {
    a.isMesh && l.has(a) && (a.material = l.get(a));
  });
  for (const a of c)
    a.visible = !0;
  s.setRenderTarget(null);
  const u = new Uint8Array(n * o * 4);
  return s.readRenderTargetPixels(i, 0, 0, n, o, u), i.dispose(), r.dispose(), u;
}
function Gt(s, t, e, n, o) {
  const i = new bt(n, o, {
    minFilter: rt,
    magFilter: rt
  }), r = new Dt({ depthPacking: At }), l = /* @__PURE__ */ new Map(), c = [];
  t.traverse((a) => {
    let f = !1, d = a;
    for (; d; ) {
      if (d.userData && d.userData.excludeFromSVG) {
        f = !0;
        break;
      }
      d = d.parent;
    }
    if (f) {
      a.visible && (c.push(a), a.visible = !1);
      return;
    }
    a.isMesh ? (l.set(a, a.material), a.material = r) : (a.isLineSegments || a.isLine || a.isPoints) && a.visible && (c.push(a), a.visible = !1);
  });
  const h = t.background;
  t.background = null, s.setRenderTarget(i), s.render(t, e), t.background = h, t.traverse((a) => {
    a.isMesh && l.has(a) && (a.material = l.get(a));
  });
  for (const a of c)
    a.visible = !0;
  s.setRenderTarget(null);
  const u = new Uint8Array(n * o * 4);
  return s.readRenderTargetPixels(i, 0, 0, n, o, u), i.dispose(), r.dispose(), u;
}
function Ut(s, t, e, n, o) {
  let i = 0, r = 0;
  for (let l = 0; l < n; l++)
    for (let c = 0; c < e; c++)
      if (s[l * e + c] === o) {
        const h = (l * e + c) * 4, u = t[h] / 255, a = t[h + 1] / 255, f = t[h + 2] / 255, d = t[h + 3] / 255, g = u + a / 256 + f / 65536 + d / 16777216;
        i += g, r++;
      }
  return r > 0 ? i / r : 0.5;
}
function te(s, t, e, n) {
  const o = new Uint16Array(t * e), i = {};
  let r = 1;
  const l = {};
  for (let c = 0; c < t * e; c++) {
    const h = c * 4, u = s[h], a = s[h + 1], f = s[h + 2];
    if (u < 5 && a < 5 && f < 5) {
      o[c] = 0;
      continue;
    }
    const d = u / 255 * 2 - 1, g = a / 255 * 2 - 1, p = f / 255 * 2 - 1, b = 4, m = Math.round(u / b) * b, x = Math.round(a / b) * b, y = Math.round(f / b) * b, M = `${m}|${x}|${y}`;
    l[M] || (l[M] = r, i[r] = new $(d, g, p).normalize(), r++), o[c] = l[M];
  }
  return { regionMap: o, normalLookup: i };
}
function ee(s, t, e) {
  const n = new Uint32Array(t * e), o = [];
  let i = 1;
  function r(a) {
    return o[a] !== a && (o[a] = r(o[a])), o[a];
  }
  function l(a, f) {
    const d = r(a), g = r(f);
    d !== g && (o[g] = d);
  }
  for (let a = 0; a < e; a++)
    for (let f = 0; f < t; f++) {
      const d = a * t + f, g = s[d];
      if (g === 0) continue;
      const p = [];
      if (f > 0 && s[d - 1] === g && n[d - 1] > 0 && p.push(n[d - 1]), a > 0 && s[d - t] === g && n[d - t] > 0 && p.push(n[d - t]), p.length === 0)
        n[d] = i, o[i] = i, i++;
      else {
        const b = Math.min(...p);
        n[d] = b;
        for (const m of p)
          l(b, m);
      }
    }
  const c = {}, h = {};
  let u = 0;
  for (let a = 0; a < t * e; a++) {
    if (n[a] === 0) continue;
    const f = r(n[a]);
    c[f] === void 0 && (u++, c[f] = u, h[u] = s[a]), n[a] = c[f];
  }
  return { labels: n, regionCount: u, labelToNormalId: h };
}
function ne(s, t, e, n) {
  const o = [];
  let i = -1, r = -1;
  t: for (let g = 0; g < e; g++)
    for (let p = 0; p < t; p++)
      if (s[g * t + p] === n && (p === 0 || s[g * t + p - 1] !== n || g === 0 || s[(g - 1) * t + p] !== n)) {
        i = p, r = g;
        break t;
      }
  if (i === -1) return o;
  const l = [1, 1, 0, -1, -1, -1, 0, 1], c = [0, 1, 1, 1, 0, -1, -1, -1];
  let h = i, u = r, a = 7;
  const f = t * e * 2;
  let d = 0;
  do {
    o.push({ x: h, y: u });
    let g = !1;
    for (let p = 0; p < 8; p++) {
      const b = (a + 6 + p) % 8, m = h + l[b], x = u + c[b];
      if (m >= 0 && m < t && x >= 0 && x < e && s[x * t + m] === n) {
        h = m, u = x, a = b, g = !0;
        break;
      }
    }
    if (!g) break;
    d++;
  } while ((h !== i || u !== r) && d < f);
  return o;
}
function gt(s, t) {
  if (s.length < 3) return s;
  let e = 0, n = 0;
  const o = s[0], i = s[s.length - 1];
  for (let r = 1; r < s.length - 1; r++) {
    const l = oe(s[r], o, i);
    l > e && (e = l, n = r);
  }
  if (e > t) {
    const r = gt(s.slice(0, n + 1), t), l = gt(s.slice(n), t);
    return r.slice(0, -1).concat(l);
  } else
    return [o, i];
}
function oe(s, t, e) {
  const n = e.x - t.x, o = e.y - t.y, i = n * n + o * o;
  if (i < 1e-10)
    return Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2);
  let r = ((s.x - t.x) * n + (s.y - t.y) * o) / i;
  r = Math.max(0, Math.min(1, r));
  const l = t.x + r * n, c = t.y + r * o;
  return Math.sqrt((s.x - l) ** 2 + (s.y - c) ** 2);
}
function It(s) {
  let t = 0;
  for (let e = 0; e < s.length; e++) {
    const n = (e + 1) % s.length;
    t += s[e].x * s[n].y, t -= s[n].x * s[e].y;
  }
  return t / 2;
}
function se(s, t) {
  if (s.length < 3 || t <= 0) return s;
  const e = s.length, n = [], i = It(s) > 0 ? 1 : -1;
  for (let r = 0; r < e; r++) {
    const l = s[(r - 1 + e) % e], c = s[r], h = s[(r + 1) % e], u = c.x - l.x, a = c.y - l.y, f = h.x - c.x, d = h.y - c.y, g = Math.sqrt(u * u + a * a) || 1, p = Math.sqrt(f * f + d * d) || 1, b = u / g, m = a / g, x = f / p, y = d / p, M = -m * i, E = b * i, k = -y * i, w = x * i;
    let S = M + k, P = E + w;
    const O = Math.sqrt(S * S + P * P) || 1;
    S /= O, P /= O;
    const X = M * k + E * w, q = t / Math.sqrt((1 + X) / 2 + 1e-3);
    n.push({
      x: c.x + S * Math.min(q, t * 3),
      // Cap miter
      y: c.y + P * Math.min(q, t * 3)
    });
  }
  return n;
}
function ie(s) {
  let t = 1 / 0, e = -1 / 0, n = 1 / 0, o = -1 / 0;
  for (const i of s)
    t = Math.min(t, i.x), e = Math.max(e, i.x), n = Math.min(n, i.y), o = Math.max(o, i.y);
  return { minX: t, maxX: e, minY: n, maxY: o };
}
function re(s, t) {
  return t.minX >= s.minX && t.maxX <= s.maxX && t.minY >= s.minY && t.maxY <= s.maxY;
}
function ae(s, t, e) {
  let n = !1;
  const o = e.length;
  for (let i = 0, r = o - 1; i < o; r = i++) {
    const l = e[i].x, c = e[i].y, h = e[r].x, u = e[r].y;
    c > t != u > t && s < (h - l) * (t - c) / (u - c) + l && (n = !n);
  }
  return n;
}
function ce(s) {
  const t = s.map((e) => ie(e.boundary));
  for (let e = 0; e < s.length; e++) {
    const n = s[e];
    n.isHole = !1, n.parentRegionId = null;
    const o = t[e];
    for (let i = 0; i < s.length; i++) {
      if (e === i) continue;
      const r = s[i], l = t[i];
      if (!re(l, o)) continue;
      if (n.boundary.every(
        (h) => ae(h.x, h.y, r.boundary)
      )) {
        n.isHole = !0, n.parentRegionId = r.regionId;
        break;
      }
    }
  }
}
function le(s, t, e, n) {
  const o = e / 2, i = n / 2, r = new $(0, 1, 0), l = new $(0, 0, 1);
  let c;
  Math.abs(s.y) > 0.9 ? c = l.clone() : (c = new $().crossVectors(r, s).normalize(), c.lengthSq() < 0.01 && (c = l.clone()));
  const h = new $(0, 0, 0), u = c.clone().multiplyScalar(100), a = h.clone().project(t), f = u.clone().project(t), d = new R(
    a.x * o,
    -a.y * i
  ), p = new R(
    f.x * o,
    -f.y * i
  ).clone().sub(d).normalize(), m = c.clone().multiplyScalar(1e5).clone().project(t);
  let x = null;
  return Math.abs(m.x) < 100 && Math.abs(m.y) < 100 && m.z < 1 && (x = new R(
    m.x * o,
    -m.y * i
  )), { direction: p, vanishingPoint: x };
}
function he(s, t, e = {}) {
  const {
    baseSpacing: n = 8,
    // Base spacing in screen pixels
    minSpacing: o = 3,
    // Minimum spacing
    maxSpacing: i = 20,
    // Maximum spacing
    depthFactor: r = 0.5,
    // How much depth affects density
    screenWidth: l = 1200,
    screenHeight: c = 800,
    axisSettings: h = {},
    // { x: { rotation: 0, spacing: 10 }, y: ... }
    brightness: u = null,
    // 0-1 lighting brightness (null = disabled)
    invertBrightness: a = !1
    // True for white-on-black (bright = dense)
  } = e, { boundary: f, hatchBoundary: d, normal: g, depth: p = 0.5 } = s, b = d || f;
  if (b.length < 3) return [];
  const m = g.clone().applyQuaternion(t.quaternion), x = Math.round(m.x * 10) / 10, y = Math.round(m.y * 10) / 10, M = Math.round(m.z * 10) / 10, E = Math.abs(x), k = Math.abs(y), w = Math.abs(M), S = E + k + w || 1, P = E / S, O = k / S, X = w / S;
  s.regionId <= 5 && console.log(`[Hatch] Region ${s.regionId}: viewNormal=(${g.x.toFixed(2)}, ${g.y.toFixed(2)}, ${g.z.toFixed(2)}) -> worldNormal=(${x}, ${y}, ${M}) -> weights=(wx:${P.toFixed(2)}, wy:${O.toFixed(2)}, wz:${X.toFixed(2)})`);
  const q = h.x || { rotation: 0, spacing: n }, C = h.y || { rotation: 0, spacing: n }, I = h.z || { rotation: 0, spacing: n }, z = P * (q.spacing || n) + O * (C.spacing || n) + X * (I.spacing || n), Y = P * (q.rotation || 0) + O * (C.rotation || 0) + X * (I.rotation || 0), { direction: H, vanishingPoint: F } = le(
    g,
    t,
    l,
    c
  );
  let B = H;
  if (Y !== 0) {
    const W = Y * (Math.PI / 180), J = Math.cos(W), _ = Math.sin(W);
    B = new R(
      H.x * J - H.y * _,
      H.x * _ + H.y * J
    );
  }
  const A = new R(-B.y, B.x);
  let D = Math.max(o, Math.min(
    i,
    (z !== void 0 ? z : n) + p * r * (i - o)
  ));
  if (u != null) {
    const W = 0.5 + u * 1.5;
    if (D = D * W, D > i)
      return [];
    D = Math.max(o, D);
  }
  let L = 1 / 0, Z = -1 / 0, K = 1 / 0, et = -1 / 0;
  for (const W of b)
    L = Math.min(L, W.x), Z = Math.max(Z, W.x), K = Math.min(K, W.y), et = Math.max(et, W.y);
  const nt = (L + Z) / 2, lt = (K + et) / 2, at = new R(nt, lt), Q = Math.sqrt((Z - L) ** 2 + (et - K) ** 2), ot = [];
  if (F && Math.abs(Y) < 5 && F.distanceTo(at) < Q * 5) {
    const W = F.distanceTo(at), J = Math.ceil(Q / D) * 2, st = Math.atan2(Q, W) * 2 / J, G = Math.atan2(
      lt - F.y,
      nt - F.x
    );
    for (let U = -J; U <= J; U++) {
      const it = G + U * st, dt = new R(Math.cos(it), Math.sin(it)), Yt = F.clone(), Tt = F.clone().add(dt.clone().multiplyScalar(W * 10)), Bt = Mt({ start: Yt, end: Tt }, b);
      ot.push(...Bt);
    }
  } else {
    const W = Math.ceil(Q / D) + 2;
    for (let J = -W; J <= W; J++) {
      const _ = A.clone().multiplyScalar(J * D), st = at.clone().add(_), G = st.clone().add(B.clone().multiplyScalar(-Q)), U = st.clone().add(B.clone().multiplyScalar(Q)), it = Mt({ start: G, end: U }, b);
      ot.push(...it);
    }
  }
  return ot;
}
function Mt(s, t) {
  const e = [], n = t.length;
  for (let i = 0; i < n; i++) {
    const r = t[i], l = t[(i + 1) % n], c = ue(
      s.start.x,
      s.start.y,
      s.end.x,
      s.end.y,
      r.x,
      r.y,
      l.x,
      l.y
    );
    c && e.push({
      point: new R(c.x, c.y),
      t: c.t
    });
  }
  if (e.length < 2) return [];
  e.sort((i, r) => i.t - r.t);
  const o = [];
  for (let i = 0; i < e.length - 1; i++) {
    const r = (e[i].point.x + e[i + 1].point.x) / 2, l = (e[i].point.y + e[i + 1].point.y) / 2;
    ht(r, l, t) && o.push({
      start: e[i].point,
      end: e[i + 1].point
    });
  }
  return o;
}
function St(s, t) {
  const e = [], n = t.length, o = ht(s.start.x, s.start.y, t), i = ht(s.end.x, s.end.y, t);
  e.push({ point: s.start.clone(), t: 0, inside: o });
  for (let c = 0; c < n; c++) {
    const h = t[c], u = t[(c + 1) % n], a = fe(
      s.start.x,
      s.start.y,
      s.end.x,
      s.end.y,
      h.x,
      h.y,
      u.x,
      u.y
    );
    a && a.t > 0 && a.t < 1 && e.push({
      point: new R(a.x, a.y),
      t: a.t,
      inside: null
      // will be determined by neighbors
    });
  }
  e.push({ point: s.end.clone(), t: 1, inside: i }), e.sort((c, h) => c.t - h.t);
  const r = [e[0]];
  for (let c = 1; c < e.length; c++)
    e[c].t - r[r.length - 1].t > 1e-4 && r.push(e[c]);
  if (r.length < 2) return [s];
  const l = [];
  for (let c = 0; c < r.length - 1; c++) {
    const h = (r[c].t + r[c + 1].t) / 2, u = s.start.x + h * (s.end.x - s.start.x), a = s.start.y + h * (s.end.y - s.start.y);
    ht(u, a, t) || l.push({
      start: r[c].point.clone(),
      end: r[c + 1].point.clone()
    });
  }
  return l;
}
function fe(s, t, e, n, o, i, r, l) {
  const c = (s - e) * (i - l) - (t - n) * (o - r);
  if (Math.abs(c) < 1e-10) return null;
  const h = ((s - o) * (i - l) - (t - i) * (o - r)) / c, u = -((s - e) * (t - i) - (t - n) * (s - o)) / c;
  return h >= 0 && h <= 1 && u >= 0 && u <= 1 ? {
    x: s + h * (e - s),
    y: t + h * (n - t),
    t: h
  } : null;
}
function ue(s, t, e, n, o, i, r, l) {
  const c = (s - e) * (i - l) - (t - n) * (o - r);
  if (Math.abs(c) < 1e-10) return null;
  const h = ((s - o) * (i - l) - (t - i) * (o - r)) / c, u = -((s - e) * (t - i) - (t - n) * (s - o)) / c;
  return u >= 0 && u <= 1 ? {
    x: s + h * (e - s),
    y: t + h * (n - t),
    t: h
  } : null;
}
function ht(s, t, e) {
  let n = !1;
  const o = e.length;
  for (let i = 0, r = o - 1; i < o; r = i++) {
    const l = e[i].x, c = e[i].y, h = e[r].x, u = e[r].y;
    c > t != u > t && s < (h - l) * (t - c) / (u - c) + l && (n = !n);
  }
  return n;
}
const vt = 1e-3;
class T {
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
    return new T(t.x, t.y);
  }
}
class mt {
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
class de {
  /**
   *
   * @param {number} r radius
   */
  constructor(t = 0) {
    this.r = t;
  }
}
class N {
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
    return v.pointsEqual(t.a, e.a) && v.pointsEqual(t.b, e.b) || v.pointsEqual(t.b, e.a) && v.pointsEqual(t.a, e.b);
  }
  /**
   * @param {Segment} seg
   */
  static clone(t) {
    return new N(new T(t.a.x, t.a.y), new T(t.b.x, t.b.y));
  }
}
class xe {
  constructor() {
    this.pivot = { x: 0, y: 0 }, this.rotation = 0, this.isOpen = !0, this.isGroup = !1, this.isStrong = !1, this._makeAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n, o) => {
        const i = { x: n.x, y: n.y };
        v.rotatePoint(i, e), i.x += this.pivot.x, i.y += this.pivot.y, t[o] = i;
      });
    }, this._makeSegsAbsolute = (t) => {
      let e = this.rotation * Math.PI / 180;
      t.forEach((n) => {
        const o = { x: n.a.x, y: n.a.y }, i = { x: n.b.x, y: n.b.y };
        v.rotatePoint(o, e), v.rotatePoint(i, e), v.addToPoint(o, this.pivot), v.addToPoint(i, this.pivot), n.a = o, n.b = i;
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
    const e = new mt(1e6, 1e6, -1e6, -1e6);
    return this.toPoints(t).forEach((o) => {
      e.minX = Math.min(e.minX, o.x), e.minY = Math.min(e.minY, o.y), e.maxX = Math.max(e.maxX, o.x), e.maxY = Math.max(e.maxY, o.y);
    }), e;
  }
  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const t = new de();
    return this.toPoints(!0).forEach((n) => {
      t.r = Math.max(t.r, Math.sqrt(n.x * n.x + n.y * n.y));
    }), t;
  }
}
class ct extends xe {
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
    let e = this._segments.reduce((n, o) => o ? n.concat(N.clone(o)) : n, []);
    return t || this._makeSegsAbsolute(e), e;
  }
  bake() {
  }
  result() {
    return ct.clone(this);
  }
  /**
   *
   * @param {Segments} segs
   */
  static clone(t) {
    let e = t._segments, n = [], o = e.length;
    for (; o--; )
      n.unshift(N.clone(e[o]));
    let i = new ct(n);
    return i.pivot.x = t.pivot.x, i.pivot.y = t.pivot.y, i.rotation = t.rotation, i;
  }
}
class v {
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
    let n = v.angleBetween(t.a, t.b), o = v.angleBetween(e.a, e.b);
    return Math.abs(n - o) < vt;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(t, e) {
    let n = v.angleBetween(t.a, t.b), o = v.angleBetween(e.b, e.a);
    return Math.abs(n - o) < vt;
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
      x: v.lerp(t.x, e.x, n),
      y: v.lerp(t.y, e.y, n)
    };
  }
  /**
   *
   * @param {Point} pt the point to rotate in place
   * @param {number} deg angle in degrees
   */
  static rotatePointDeg(t, e) {
    v.rotatePoint(t, e * Math.PI / 180);
  }
  /**
   *
   * @param {Point} pt
   * @param {*} rad
   */
  static rotatePoint(t, e) {
    const n = Math.cos(e), o = Math.sin(e), i = t.y, r = t.x;
    t.y = n * i - o * r, t.x = o * i + n * r;
  }
  /**
   *
   * @param {number} rad
   * @param  {...Point} points
   */
  static rotatePoints(t, ...e) {
    e.forEach((n) => {
      v.rotatePoint(n, t);
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
      v.rotatePoint(o, n);
    });
  }
  // Based on http://stackoverflow.com/a/12037737
  static outerTangents(t, e, n, o) {
    var i = n.x - t.x, r = n.y - t.y, l = Math.sqrt(i * i + r * r);
    if (l <= Math.abs(o - e)) return [];
    var c = Math.atan2(r, i), h = Math.acos((e - o) / l);
    return [
      new N(
        {
          x: t.x + e * Math.cos(c + h),
          y: t.y + e * Math.sin(c + h)
        },
        {
          x: n.x + o * Math.cos(c + h),
          y: n.y + o * Math.sin(c + h)
        }
      ),
      new N(
        {
          x: t.x + e * Math.cos(c - h),
          y: t.y + e * Math.sin(c - h)
        },
        {
          x: n.x + o * Math.cos(c - h),
          y: n.y + o * Math.sin(c - h)
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
    let o = [{ x: t.x, y: t.y }], i = 1 / n, r = (e.x - t.x) * i, l = (e.y - t.y) * i;
    for (var c = 1; c < n; c++)
      o.push(new T(t.x + r * c, t.y + l * c));
    return o.push({ x: e.x, y: e.y }), o;
  }
  /**
   *
   * @param  {...Point} pts
   */
  static averagePoints(...t) {
    let e = new T(0, 0);
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
    let o = [{ x: t.x, y: t.y }], i = v.distanceBetween(t, e), r = n / i, l = Math.floor(1 / r), c = i % n;
    n += c / l, r = n / i;
    let h = r, u = 1, a = (e.x - t.x) * r, f = (e.y - t.y) * r;
    for (; h < 1; )
      o.push(new T(t.x + a * u, t.y + f * u)), h += r, u++;
    return o.push({ x: e.x, y: e.y }), o;
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @param {number} [scale]
   */
  static segmentsConnected(t, e, n = 1) {
    return v.pointsEqual(t.b, e.a, n) || v.pointsEqual(t.a, e.b, n);
  }
  /**
   *
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentsToPoints(t) {
    let e = t.reduce((o, i) => o.concat(i.a, i.b), []), n = e.length;
    for (; n--; ) {
      let o = e[n];
      n > 0 && v.pointsEqual(o, e[n - 1]) && e.splice(n, 1);
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
    const e = new mt(1e6, 1e6, -1e6, -1e6);
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
    const e = new mt(1e6, 1e6, -1e6, -1e6);
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
    }), v.pointsBoundingBox(e);
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
    return v.polygonArea(t) > 0;
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
    const n = v.ccw;
    return n(t.a, e.a, e.b) != n(t.b, e.a, e.b) && n(t.a, t.b, e.a) != n(t.a, t.b, e.b);
  }
  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {Point}
   */
  static segmentSegmentIntersect(t, e, n = !1) {
    const o = t.a.x, i = t.a.y, r = t.b.x, l = t.b.y, c = e.a.x, h = e.a.y, u = e.b.x, a = e.b.y, f = r - o, d = l - i, g = u - c, p = a - h, b = (-d * (o - c) + f * (i - h)) / (-g * d + f * p), m = (g * (i - h) - p * (o - c)) / (-g * d + f * p);
    if (b >= 0 && b <= 1 && m >= 0 && m <= 1) {
      const x = o + m * f, y = i + m * d;
      let M = { x, y };
      return n && (v.pointsEqual(M, e.a) || v.pointsEqual(M, e.b) || v.pointsEqual(M, t.a) || v.pointsEqual(M, t.b)) ? void 0 : M;
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
    return e.forEach((i) => {
      if (i == t)
        return;
      let r = v.segmentSegmentIntersect(t, i, n);
      r && o.push(r);
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
    return new T(t.x - e.x, t.y - e.y);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static add(t, e) {
    return new T(t.x + e.x, t.y + e.y);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   * @returns {Point}
   */
  static closestPtPointSegment(t, e) {
    var n = v.sub(e.b, e.a), o = v.sub(t, e.a), i = v.dot(o, n);
    if (i < 0)
      t = e.a;
    else {
      var r = v.dot(n, n);
      i >= r ? t = e.b : (i /= r, o.x = e.a.x + i * n.x, o.y = e.a.y + i * n.y, t = o);
    }
    return T.clone(t);
  }
  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   */
  static distancePointSegment(t, e) {
    return v.distanceBetween(t, v.closestPtPointSegment(t, e));
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
    const o = v.segmentsBoundingBox(e);
    if (!this.pointWithinBoundingBox(t, o))
      return !1;
    let i = new T(1e5, 1e5), r = new N(i, t), l = v.segmentSegmentsIntersections(r, e);
    return l.length % 2 != 0 && n && v.pointsEqual(t, l[0]) ? !1 : l.length % 2 != 0;
  }
  /**
   *
   * @param {Segment} seg
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static segmentWithinPolygon(t, e) {
    let n = this.pointWithinPolygon(t.a, e, !1), o = this.pointWithinPolygon(t.b, e, !1), i = this.pointWithinPolygon(t.a, e, !0), r = this.pointWithinPolygon(t.b, e, !0);
    return i && r || i && o || r && n;
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
  static pointWithinTriangle(t, e, n, o, i) {
    const r = v.sign(t, e, n), l = v.sign(t, n, o), c = v.sign(t, o, e), h = r < 0 || l < 0 || c < 0, u = r > 0 || l > 0 || c > 0;
    if (!(h && u) && i) {
      let a = { a: e, b: n, tags: null };
      if (v.distancePointSegment(t, a) < 1 || (a.a = n, a.b = o, v.distancePointSegment(t, a) < 1) || (a.a = o, a.b = e, v.distancePointSegment(t, a) < 1)) return !1;
    }
    return !(h && u);
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
    let i = this.pointWithinTriangle(t.a, e, n, o, !1), r = this.pointWithinTriangle(t.b, e, n, o, !1), l = this.pointWithinTriangle(t.a, e, n, o, !0), c = this.pointWithinTriangle(t.b, e, n, o, !0);
    return v.averagePoints(t.a, t.b), l && c || l && r || c && i || i && r;
  }
  /**
   *
   * @param {Point[]} pts
   * @returns {Segment[]}
   */
  static pointsToClosedPolySegments(...t) {
    let e = [];
    for (let n = 0; n < t.length; n++)
      e.push(new N(t[n], n < t.length - 1 ? t[n + 1] : t[0]));
    return e;
  }
  /**
   *
   * @param {Segment[]} polySegsA
   * @param {Segment[]} polySegsB
   * @returns {boolean}
   */
  static polygonWithinPolygon(t, e) {
    const n = v.segmentsBoundingBox(t), o = v.segmentsBoundingBox(e);
    if (!v.boundingBoxesIntersect(n, o))
      return !1;
    new T(o.minX - 100, o.minY - 100);
    for (let i = 0; i < t.length; i++) {
      let r = t[i];
      if (v.segmentSegmentsIntersections(r, e).length % 2 == 0)
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
    let i = (l) => {
      let c = [l[0]];
      for (let h = 0; h < l.length - 1; h++) {
        let u = new T(0, 0);
        h + 1 < l.length * 0.4 ? (u.x = (l[h].x * 40 + l[h + 1].x * 60) * 0.01, u.y = (l[h].y * 40 + l[h + 1].y * 60) * 0.01) : h + 1 > l.length * 0.6 ? (u.x = (l[h].x * 60 + l[h + 1].x * 40) * 0.01, u.y = (l[h].y * 60 + l[h + 1].y * 40) * 0.01) : (u.x = (l[h].x + l[h + 1].x) * 0.5, u.y = (l[h].y + l[h + 1].y) * 0.5), c.push(u);
      }
      return c.push(l[l.length - 1]), c;
    }, r = [t, e, n];
    for (let l = 0; l < o; l++)
      r = i(r);
    return r;
  }
}
class tt {
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {{ originalPts: Object.<string, Point>, pts: string[], cxs: Object.<string,string[]> }}
   */
  static getSegsAndConnections(t, e = !1, n = !1) {
    let o = {}, i = [], r = {}, l = (c) => {
      let h = `${Math.round(c.x * 1)}|${Math.round(c.y * 1)}`;
      return r[h] = c, h;
    };
    if (e) {
      let c = t.reduce((a, f) => a.concat(f.a, f.b), []), h = c.length;
      for (; h--; ) {
        let a = c[h], f = h;
        for (; f--; ) {
          let d = c[f];
          if (v.pointsEqual(a, d)) {
            c.splice(h, 1);
            break;
          }
        }
      }
      let u = t.length;
      for (; u--; ) {
        let a = t[u], f = [];
        if (c.forEach((d) => {
          v.distancePointSegment(d, a) < 0.1 && !v.pointsEqual(d, a.a) && !v.pointsEqual(d, a.b) && f.push(d);
        }), f.length) {
          f.sort((p, b) => {
            const m = v.distanceBetweenSquared(p, a.a), x = v.distanceBetweenSquared(b, a.a);
            return m < x ? -1 : m > x ? 1 : 0;
          });
          const d = [];
          let g = a.a;
          for (let p = 0; p < f.length; p++) {
            let b = f[p];
            d.push(new N(g, b)), g = b;
          }
          d.push(new N(g, a.b)), t.splice(u, 1, ...d);
        }
      }
    }
    if (n) {
      let c = t.length;
      for (; c--; ) {
        let h = c, u = !1;
        for (; h--; ) {
          let a = t[c], f = t[h], d = v.segmentSegmentIntersect(a, f, !0);
          d && (u = !0, t.splice(c, 1, new N(T.clone(a.a), T.clone(d)), new N(T.clone(d), T.clone(a.b))), t.splice(h, 1, new N(T.clone(f.a), T.clone(d)), new N(T.clone(d), T.clone(f.b))));
        }
        u && (c = t.length);
      }
    }
    return t.forEach((c) => {
      let h = l(c.a), u = l(c.b);
      o[h] || (o[h] = []), o[u] || (o[u] = []), o[h].indexOf(u) === -1 && o[h].push(u), o[u].indexOf(h) === -1 && o[u].push(h), i.indexOf(h) === -1 && i.push(h), i.indexOf(u) === -1 && i.push(u);
    }), {
      originalPts: r,
      pts: i,
      cxs: o
    };
  }
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {Segment[]}
   */
  static pathOrder(t, e = !1, n = !1) {
    let o = [], { originalPts: i, pts: r, cxs: l } = tt.getSegsAndConnections(t, e, n), c = (u) => i[u], h = (u, a) => l[u].length > l[a].length ? 1 : l[u].length < l[a].length ? -1 : 0;
    for (r.sort(h); r.length; ) {
      r.sort(h);
      let u = r.shift();
      for (; u; )
        if (l[u].length) {
          l[u].sort(h);
          let a = l[u].shift(), f = l[a].indexOf(u);
          f !== -1 && l[a].splice(f, 1), o.push(new N(c(u), c(a))), l[u].length && r.unshift(u), u = a;
        } else
          u = null;
    }
    return o;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} offset
   * @returns {Point[]}
   */
  static getEndingSegmentPoints(t, e = 0) {
    t = t.concat(), t = tt.pathOrder(t, !0, !0);
    let { originalPts: n, pts: o, cxs: i } = tt.getSegsAndConnections(t, !0), r = (h) => n[h];
    const l = o.filter((h) => i[h].length === 1), c = [];
    return l.forEach((h) => {
      const u = T.clone(r(h));
      if (e === 0) {
        c.push(u);
        return;
      }
      const a = r(i[h]), f = v.angleBetween(a, u), d = new T(0, e);
      v.rotatePoint(d, Math.PI * 0.5 - f), v.addToPoint(u, d), c.push(u);
    }), c;
  }
  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills(t, e = 5) {
    t = t.concat();
    let { originalPts: n, cxs: o } = tt.getSegsAndConnections(t, !0, !0), i = (x) => {
      let y = `${Math.round(x.x * 1)}|${Math.round(x.y * 1)}`;
      return n[y] = x, y;
    }, r = [], l = [], c = 1e5, h = 1e5, u = -1e5, a = -1e5, f = 1e5, d = 1e5, g = [];
    for (let x in n) {
      let y = n[x];
      g.push(y), c = Math.min(c, y.x), h = Math.min(h, y.y), u = Math.max(u, y.x), a = Math.max(a, y.y);
    }
    g.sort((x, y) => x.x < y.x ? -1 : x.x > y.x ? 1 : 0), g.forEach((x, y) => {
      if (y > 0) {
        let M = g[y - 1], E = Math.round(Math.abs(x.x - M.x));
        E > 1 && (f = Math.min(f, E));
      }
    }), g.sort((x, y) => x.y < y.y ? -1 : x.y > y.y ? 1 : 0), g.forEach((x, y) => {
      if (y > 0) {
        let M = g[y - 1], E = Math.round(Math.abs(x.y - M.y));
        E > 1 && (d = Math.min(d, E));
      }
    });
    let p = f * 0.5, b = d * 0.5, m = [];
    for (let x = h; x < a; x += d)
      for (let y = c; y < u; y += f)
        m.push(new T(y + p, x + b));
    return m.forEach((x) => {
      let y = [];
      if (g.forEach((k) => {
        let w = v.distanceBetween(k, x);
        if (w < Math.max(f, d) * e) {
          let S = v.angleBetween(k, x);
          y.push({
            pt: k,
            dist: w,
            ang: S
          });
        }
      }), y.length < 4)
        return;
      let M = y.length;
      for (; M--; ) {
        let k = y[M].pt, w = new N(x, k);
        v.segmentSegmentsIntersections(w, t, !0).length > 0 && y.splice(M, 1);
      }
      for (y.sort((k, w) => k.ang < w.ang ? -1 : k.ang > w.ang ? 1 : 0), M = y.length; M--; ) {
        let k = y[M].pt, w = i(k), S = y.length, P = !1;
        for (; S--; ) {
          if (M === S)
            continue;
          let O = y[S].pt, X = i(O);
          if (o[w].indexOf(X) === -1) {
            P = !0;
            break;
          }
        }
        P || y.splice(M, 1);
      }
      let E = !0;
      if (y.forEach((k, w) => {
        let S = y[(w + 1) % y.length], P = i(k.pt), O = i(S.pt);
        o[P].indexOf(O) === -1 && (E = !1);
      }), E) {
        let k = y.map((P) => P.pt), w = v.averagePoints(...k), S = i(w);
        r.indexOf(S) === -1 && (r.push(S), l.push(k));
      }
    }), l;
  }
}
class ft {
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
  static segmentCollections(t, e = !1, n = !0, o = 1, i = !1, r = !1, l = !1) {
    let c = t.reduce((h, u) => h.concat(u.toSegments()), []);
    return ft.segments(c, e, n, o, i, r, l);
  }
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollectionsPathOrder(t, e = !1, n = !1) {
    let o = t.reduce((i, r) => i.concat(r.toSegments()), []);
    return new ct(tt.pathOrder(o, e, n));
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
  static segments(t, e = !1, n = !0, o = 1, i = !1, r = !1, l = !1) {
    return t = ft._segments(t, e, n, o), i && (t = tt.pathOrder(t, r, l)), new ct(t);
  }
  /**
   * JS fallback for segment optimization  
   * @private
   */
  static _segments(t, e, n, o) {
    const i = t;
    for (t = []; i.length; ) {
      let l = i.shift(), c = t.length, h = !1;
      for (; c--; ) {
        const u = t[c];
        if (N.isEqual(l, u)) {
          h = !0;
          break;
        }
      }
      h || t.push(l);
    }
    if (!e)
      for (let l = 0; l < 3; l++) {
        let c = t.length;
        for (; c--; ) {
          let h = t[c], u, a, f, d, g;
          for (let p = c - 1; p >= 0; p--) {
            let b = t[p], m = !1, x = !1;
            if (v.sameAngle(h, b) ? (m = !0, u = T.clone(h.a), a = T.clone(h.b), f = T.clone(b.a), d = T.clone(b.b)) : v.sameAngleRev(h, b) && (m = x = !0, u = T.clone(h.b), a = T.clone(h.a), f = T.clone(b.a), d = T.clone(b.b)), m && (g = v.angleBetween(u, a), v.rotatePoints(g, u, a, f, d), Math.abs(u.y - f.y) < 0.1 && a.x >= f.x - 1e-4 && u.x <= d.x + 1e-4)) {
              u.x < f.x && (x ? b.a = h.b : b.a = h.a), a.x > d.x && (x ? b.b = h.a : b.b = h.b), t.splice(c, 1);
              break;
            }
          }
        }
      }
    let r = t.length;
    for (; r--; ) {
      let l = t[r];
      if (!l) {
        t.splice(r, 1);
        continue;
      }
      if (n && v.distanceBetween(l.a, l.b) < o) {
        t.splice(r, 1);
        continue;
      }
    }
    return console.log(`[JS] Optimize: ${i.length + t.length} -> ${t.length} segments`), t;
  }
}
function $t(s, t) {
  const e = s.geometry, n = e.attributes.position, o = e.index;
  if (!n) return [];
  const i = /* @__PURE__ */ new Map(), r = 1e3, l = (a, f) => {
    const d = Math.round(a.x * r), g = Math.round(a.y * r), p = Math.round(a.z * r), b = Math.round(f.x * r), m = Math.round(f.y * r), x = Math.round(f.z * r), y = `${d},${g},${p}`, M = `${b},${m},${x}`;
    return y < M ? `${y}|${M}` : `${M}|${y}`;
  }, c = (a) => new $(
    n.getX(a),
    n.getY(a),
    n.getZ(a)
  ).applyMatrix4(s.matrixWorld), h = (a, f, d) => {
    const g = new $().subVectors(f, a), p = new $().subVectors(d, a);
    return new $().crossVectors(g, p).normalize();
  }, u = o ? o.count / 3 : n.count / 3;
  for (let a = 0; a < u; a++) {
    let f, d, g;
    o ? (f = o.getX(a * 3), d = o.getX(a * 3 + 1), g = o.getX(a * 3 + 2)) : (f = a * 3, d = a * 3 + 1, g = a * 3 + 2);
    const p = c(f), b = c(d), m = c(g), x = h(p, b, m), y = new $().addVectors(p, b).add(m).divideScalar(3), M = new $().subVectors(t, y);
    if (x.dot(M) <= 0)
      continue;
    const E = [
      [p, b],
      [b, m],
      [m, p]
    ];
    for (const [k, w] of E) {
      const S = l(k, w);
      if (i.has(S)) {
        const P = i.get(S);
        P && !P.normal2 && (P.normal2 = x.clone(), P.faceIdx2 = a);
      } else
        i.set(S, {
          a: k.clone(),
          b: w.clone(),
          normal1: x.clone(),
          faceIdx1: a,
          mesh: s
        });
    }
  }
  return Array.from(i.values());
}
function Ft(s, t) {
  return s.filter((e) => {
    const n = new $().addVectors(e.a, e.b).multiplyScalar(0.5), o = new $().subVectors(t, n).normalize(), i = e.normal1.dot(o) > 0;
    if (!e.normal2)
      return !0;
    const r = e.normal2.dot(o) > 0;
    return i || r;
  });
}
function Ct(s, t, e = 0.99) {
  const n = [], o = [];
  for (const i of s) {
    const r = new $().addVectors(i.a, i.b).multiplyScalar(0.5), l = new $().subVectors(t, r).normalize(), c = i.normal1.dot(l) > 0, h = i.normal2 ? i.normal2.dot(l) > 0 : !0;
    if (c !== h || !i.normal2) {
      n.push(i);
      continue;
    }
    i.normal2 && i.normal1.dot(i.normal2) < e && o.push(i);
  }
  return console.log(`classifyEdges: ${n.length} profiles, ${o.length} smooth/crease edges`), { profiles: n, smoothFiltered: o };
}
function yt(s, t, e, n, o = 1) {
  const i = e / 2, r = n / 2, l = (c) => {
    const h = c.clone().project(t);
    return new R(
      h.x * i * o,
      -h.y * r * o
    );
  };
  return s.map((c) => ({
    a: l(c.a),
    b: l(c.b),
    a3d: c.a.clone(),
    b3d: c.b.clone(),
    midpoint3d: new $().addVectors(c.a, c.b).multiplyScalar(0.5),
    isProfile: !1,
    // Will be set by classifyEdges
    visible: !0,
    faceIdx: c.faceIdx1,
    faceIdx2: c.faceIdx2,
    mesh: c.mesh,
    isHatch: c.isHatch,
    normal1: c.normal1,
    // Propagate normals for straggler detection
    normal2: c.normal2
  }));
}
class ge {
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
    const e = /* @__PURE__ */ new Set(), n = Math.abs(t.b.x - t.a.x), o = Math.abs(t.b.y - t.a.y), i = Math.max(n, o) / this.cellSize + 1;
    for (let r = 0; r <= i; r++) {
      const l = r / i, c = t.a.x + l * (t.b.x - t.a.x), h = t.a.y + l * (t.b.y - t.a.y);
      e.add(this.getCellKey(c, h));
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
function me(s, t) {
  const e = s.a.x, n = s.a.y, o = s.b.x, i = s.b.y, r = t.a.x, l = t.a.y, c = t.b.x, h = t.b.y, u = (e - o) * (l - h) - (n - i) * (r - c);
  if (Math.abs(u) < 1e-10) return null;
  const a = ((e - r) * (l - h) - (n - l) * (r - c)) / u, f = -((e - o) * (n - l) - (n - i) * (e - r)) / u, d = 1e-3;
  return a > d && a < 1 - d && f > d && f < 1 - d ? {
    t1: a,
    t2: f,
    point: new R(
      e + a * (o - e),
      n + a * (i - n)
    )
  } : null;
}
function Ot(s) {
  var r, l, c, h, u, a;
  const t = /* @__PURE__ */ new Map(), e = 0.01, n = (f, d) => {
    const g = d.b.x - d.a.x, p = d.b.y - d.a.y, b = g * g + p * p;
    if (b < 1e-10) return null;
    const m = ((f.x - d.a.x) * g + (f.y - d.a.y) * p) / b;
    if (m <= e || m >= 1 - e) return null;
    const x = d.a.x + m * g, y = d.a.y + m * p;
    return (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y) < 1 ? m : null;
  }, o = /* @__PURE__ */ new Set();
  for (let f = 0; f < s.length; f++)
    for (let d = f + 1; d < s.length; d++) {
      const g = me(s[f], s[d]);
      if (g)
        t.has(s[f]) || t.set(s[f], []), t.has(s[d]) || t.set(s[d], []), (r = t.get(s[f])) == null || r.push({ t: g.t1, point: g.point }), (l = t.get(s[d])) == null || l.push({ t: g.t2, point: g.point });
      else {
        const p = n(s[f].a, s[d]);
        p !== null && (t.has(s[d]) || t.set(s[d], []), (c = t.get(s[d])) == null || c.push({ t: p, point: s[f].a.clone() }), o.add(s[f]), o.add(s[d]));
        const b = n(s[f].b, s[d]);
        b !== null && (t.has(s[d]) || t.set(s[d], []), (h = t.get(s[d])) == null || h.push({ t: b, point: s[f].b.clone() }), o.add(s[f]), o.add(s[d]));
        const m = n(s[d].a, s[f]);
        m !== null && (t.has(s[f]) || t.set(s[f], []), (u = t.get(s[f])) == null || u.push({ t: m, point: s[d].a.clone() }), o.add(s[f]), o.add(s[d]));
        const x = n(s[d].b, s[f]);
        x !== null && (t.has(s[f]) || t.set(s[f], []), (a = t.get(s[f])) == null || a.push({ t: x, point: s[d].b.clone() }), o.add(s[f]), o.add(s[d]));
      }
    }
  console.log(`T-junction detection: ${o.size} potential straggler edges`);
  const i = [];
  for (const f of s) {
    const d = t.get(f), g = o.has(f);
    if (!d || d.length === 0) {
      f.isTJunctionStraggler = g, i.push(f);
      continue;
    }
    d.sort((m, x) => m.t - x.t);
    let p = f.a, b = f.a3d;
    for (const m of d) {
      const x = new $().lerpVectors(f.a3d, f.b3d, m.t);
      i.push({
        a: p.clone(),
        b: m.point.clone(),
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
        isTJunctionStraggler: g
      }), m.t, p = m.point, b = x;
    }
    i.push({
      a: p.clone(),
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
      isTJunctionStraggler: g
    });
  }
  return i;
}
function ye(s, t, e, n, o, i, r = !1) {
  if (r)
    return s.forEach((g) => g.visible = !0), s;
  const l = [];
  if (!i)
    return console.warn("No renderer provided, skipping occlusion test"), s;
  const c = new bt(n, o, {
    minFilter: rt,
    magFilter: rt,
    format: Wt,
    type: Ht
  }), h = new Rt({
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
    side: Lt
  }), u = [];
  let a = 0;
  for (const g of t) {
    g.__globalFaceOffset = a;
    const p = g.geometry, b = p.attributes.position, m = p.index, x = m ? m.count / 3 : b.count / 3, y = [], M = [];
    for (let w = 0; w < x; w++) {
      let S, P, O;
      m ? (S = m.getX(w * 3), P = m.getX(w * 3 + 1), O = m.getX(w * 3 + 2)) : (S = w * 3, P = w * 3 + 1, O = w * 3 + 2);
      const X = new $(b.getX(S), b.getY(S), b.getZ(S)), q = new $(b.getX(P), b.getY(P), b.getZ(P)), C = new $(b.getX(O), b.getY(O), b.getZ(O));
      X.applyMatrix4(g.matrixWorld), q.applyMatrix4(g.matrixWorld), C.applyMatrix4(g.matrixWorld), y.push(X.x, X.y, X.z, q.x, q.y, q.z, C.x, C.y, C.z);
      const I = a + w + 1, z = (I & 255) / 255, Y = (I >> 8 & 255) / 255, H = (I >> 16 & 255) / 255;
      M.push(z, Y, H, z, Y, H, z, Y, H);
    }
    const E = new Nt();
    E.setAttribute("position", new wt(new Float32Array(y), 3)), E.setAttribute("faceColor", new wt(new Float32Array(M), 3));
    const k = new Vt(E, h);
    u.push(k), a += x;
  }
  const f = new jt();
  for (const g of u)
    f.add(g);
  i.setRenderTarget(c), i.setClearColor(0, 1), i.clear(), i.render(f, e);
  const d = new Uint8Array(n * o * 4);
  i.readRenderTargetPixels(c, 0, 0, n, o, d), i.setRenderTarget(null);
  for (const g of s) {
    const p = (g.a.x + g.b.x) / 2, b = (g.a.y + g.b.y) / 2, m = Math.round(p + n / 2), x = Math.round(o / 2 + b);
    if (m < 0 || m >= n || x < 0 || x >= o) {
      g.visible = !0, l.push(g);
      continue;
    }
    const y = ((o - 1 - x) * n + m) * 4, M = d[y], E = d[y + 1], k = d[y + 2], w = M + (E << 8) + (k << 16);
    if (w === 0) {
      g.visible = !0, l.push(g);
      continue;
    }
    const S = g.mesh.__globalFaceOffset || 0, P = S + g.faceIdx + 1;
    if (w === P)
      g.visible = !0, l.push(g);
    else {
      if (g.faceIdx2 !== void 0) {
        const O = S + g.faceIdx2 + 1;
        if (w === O) {
          g.visible = !0, l.push(g);
          continue;
        }
      }
      g.visible = !1;
    }
  }
  c.dispose(), h.dispose();
  for (const g of u)
    g.geometry.dispose();
  return l;
}
function pe(s, t, e, n) {
  const o = (u, a, f) => (u.x - f.x) * (a.y - f.y) - (a.x - f.x) * (u.y - f.y), i = o(s, t, e), r = o(s, e, n), l = o(s, n, t), c = i < 0 || r < 0 || l < 0, h = i > 0 || r > 0 || l > 0;
  return !(c && h);
}
function be(s, t, e, n, o = 2) {
  const i = n.x - e.x, r = n.y - e.y, l = i * i + r * r;
  if (l < 1e-10) return !1;
  const c = (h) => {
    const u = ((h.x - e.x) * i + (h.y - e.y) * r) / l, a = e.x + u * i, f = e.y + u * r;
    return (h.x - a) * (h.x - a) + (h.y - f) * (h.y - f) < o * o && u >= -0.01 && u <= 1.01;
  };
  return c(s) && c(t);
}
function we(s, t) {
  const e = [];
  for (const n of t) {
    const o = [
      { a: n.a2d, b: n.b2d, name: "AB" },
      { a: n.b2d, b: n.c2d, name: "BC" },
      { a: n.c2d, b: n.a2d, name: "CA" }
    ];
    for (const i of o)
      if (be(s.a, s.b, i.a, i.b)) {
        e.push({
          face: n,
          matchedEdge: i.name,
          matchType: "collinear"
        });
        break;
      }
  }
  return e;
}
function Me(s, t, e, n, o, i, r) {
  const l = { x: n.x - t.x, y: n.y - t.y }, c = { x: e.x - t.x, y: e.y - t.y }, h = { x: s.x - t.x, y: s.y - t.y }, u = l.x * l.x + l.y * l.y, a = l.x * c.x + l.y * c.y, f = l.x * h.x + l.y * h.y, d = c.x * c.x + c.y * c.y, g = c.x * h.x + c.y * h.y, p = u * d - a * a;
  if (Math.abs(p) < 1e-10) return 1 / 0;
  const b = (d * f - a * g) / p, m = (u * g - a * f) / p;
  return (1 - b - m) * o + m * i + b * r;
}
function Se(s, t, e = 0.99, n = 0.5) {
  const o = [];
  let i = 0;
  for (const r of s) {
    const l = we(r, t);
    r.adjacentFaceCount = l.length;
    let c = !1;
    if (l.length === 2) {
      const h = l[0].face, u = l[1].face, a = h.normal, f = u.normal;
      if (a && f) {
        const d = a.dot(f), g = Math.abs(d);
        r.faceSimilarity = g;
        let p;
        d > 0 ? p = Math.abs(h.constant - u.constant) : p = Math.abs(h.constant + u.constant), g >= e && p < n && (c = !0, i++);
      }
    } else if (l.length > 2) {
      const h = l.map((u) => u.face).filter((u) => u.normal);
      if (h.length >= 2) {
        let u = !0, a = 1;
        for (let f = 1; f < h.length; f++) {
          const d = h[0].normal.dot(h[f].normal), g = Math.abs(d);
          let p;
          if (d > 0 ? p = Math.abs(h[0].constant - h[f].constant) : p = Math.abs(h[0].constant + h[f].constant), a = Math.min(a, g), g < e || p >= n) {
            u = !1;
            break;
          }
        }
        r.faceSimilarity = a, u && (c = !0, i++);
      }
    }
    c || o.push(r);
  }
  return console.log(`Geometric straggler filter: removed ${i} coplanar edges`), o;
}
function ve(s, t, e) {
  const n = e.position, o = e.matrixWorldInverse;
  return Ee(s, t, n, o);
}
function Ee(s, t, e, n) {
  const o = [];
  let i = 0, r = 0;
  for (const l of s) {
    const c = new R(
      (l.a.x + l.b.x) / 2,
      (l.a.y + l.b.y) / 2
    ), h = l.midpoint3d;
    let u;
    n ? u = -h.clone().applyMatrix4(n).z : u = e.distanceTo(h);
    let a = !1;
    for (const f of t) {
      if (f.mesh === l.mesh && (f.faceIdx === l.faceIdx || f.faceIdx === l.faceIdx2) || !pe(c, f.a2d, f.b2d, f.c2d))
        continue;
      if (Me(
        c,
        f.a2d,
        f.b2d,
        f.c2d,
        f.depthA,
        f.depthB,
        f.depthC
      ) < u - 1e-3) {
        a = !0, r++;
        break;
      }
      i++;
    }
    a ? l.visible = !1 : (l.visible = !0, o.push(l));
  }
  return console.log(`[JS] Occlusion debug: ${i} point-in-triangle hits, ${r} occluded`), o;
}
function ke(s, t, e, n = 0.05) {
  const o = new Zt(), i = [], r = [];
  t.traverse((l) => {
    l.isMesh && r.push(l);
  });
  for (const l of s) {
    const c = new $().subVectors(l.midpoint3d, e.position), h = c.clone().normalize(), u = c.length(), a = u * n;
    o.set(e.position.clone(), h);
    const f = o.intersectObjects(r, !0);
    if (f.length === 0)
      l.visible = !0, i.push(l);
    else {
      let d = !1;
      for (const g of f)
        if (!(g.distance >= u - a) && !(g.object === l.mesh && g.faceIndex === l.faceIdx)) {
          d = !0;
          break;
        }
      d ? l.visible = !1 : (l.visible = !0, i.push(l));
    }
  }
  return i;
}
function zt(s, t = 0.5) {
  const e = /* @__PURE__ */ new Map(), n = (i) => `${Math.round(i.x / t)},${Math.round(i.y / t)}`, o = (i) => {
    const r = n(i.a), l = n(i.b);
    return r < l ? `${r}-${l}` : `${l}-${r}`;
  };
  for (const i of s) {
    const r = o(i);
    e.has(r) || e.set(r, i);
  }
  return Array.from(e.values());
}
function Xt(s, t = 1, e = 50) {
  const n = (m) => `${Math.round(m.x / t)},${Math.round(m.y / t)}`, o = /* @__PURE__ */ new Map();
  for (const m of s)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = x === "a" ? m.a : m.b, M = n(y);
      o.has(M) || o.set(M, { edges: [], point: { x: y.x, y: y.y } }), o.get(M).edges.push({ edge: m, endpoint: x });
    }
  const i = [];
  for (const [m, x] of o)
    if (x.edges.length === 1) {
      const { edge: y, endpoint: M } = x.edges[0], E = x.point, k = M === "a" ? y.b : y.a, w = E.x - k.x, S = E.y - k.y, P = Math.sqrt(w * w + S * S);
      if (P < 1e-3) continue;
      i.push({
        key: m,
        edge: y,
        endpoint: M,
        point: E,
        otherPoint: k,
        dirX: w / P,
        dirY: S / P,
        len: P
      });
    }
  if (console.log(`Edge cleanup: found ${i.length} orphaned endpoints`), i.length === 0) return s;
  const r = (m, x, y, M) => {
    const E = x.x * M.y - x.y * M.x;
    if (Math.abs(E) < 1e-4) return null;
    const k = y.x - m.x, w = y.y - m.y, S = (k * M.y - w * M.x) / E, P = (k * x.y - w * x.x) / E;
    return { t1: S, t2: P };
  };
  let l = 0;
  const c = /* @__PURE__ */ new Set();
  for (let m = 0; m < i.length; m++) {
    const x = i[m];
    if (c.has(x.key)) continue;
    let y = null, M = null, E = 1 / 0;
    for (let k = 0; k < i.length; k++) {
      if (m === k) continue;
      const w = i[k];
      if (c.has(w.key) || Math.sqrt(
        (w.point.x - x.point.x) ** 2 + (w.point.y - x.point.y) ** 2
      ) > e * 2) continue;
      const P = r(
        { x: x.point.x, y: x.point.y },
        { x: x.dirX, y: x.dirY },
        { x: w.point.x, y: w.point.y },
        { x: w.dirX, y: w.dirY }
      );
      if (!P || P.t1 < -0.1 || P.t2 < -0.1 || P.t1 > e || P.t2 > e) continue;
      const O = x.point.x + P.t1 * x.dirX, X = x.point.y + P.t1 * x.dirY, q = P.t1 + P.t2;
      q < E && (E = q, y = w, M = { x: O, y: X });
    }
    if (y && M) {
      const k = Et(
        x.point,
        M,
        s,
        x.edge,
        y.edge
      ), w = Et(
        y.point,
        M,
        s,
        x.edge,
        y.edge
      );
      if (k || w)
        continue;
      x.endpoint === "a" ? (x.edge.a.x = M.x, x.edge.a.y = M.y) : (x.edge.b.x = M.x, x.edge.b.y = M.y), y.endpoint === "a" ? (y.edge.a.x = M.x, y.edge.a.y = M.y) : (y.edge.b.x = M.x, y.edge.b.y = M.y), c.add(x.key), c.add(y.key), l++;
    }
  }
  console.log(`Edge cleanup: extended ${l} pairs of edges to intersections`);
  let h = 0;
  for (const m of s) {
    const x = m.b.x - m.a.x, y = m.b.y - m.a.y;
    h += Math.sqrt(x * x + y * y);
  }
  const u = h / s.length, a = u / 8;
  console.log(`Edge cleanup: average edge length = ${u.toFixed(2)}, snap threshold = ${a.toFixed(2)}`);
  const f = /* @__PURE__ */ new Map();
  for (const m of s)
    for (
      const x of
      /** @type {const} */
      ["a", "b"]
    ) {
      const y = x === "a" ? m.a : m.b, M = n(y);
      f.has(M) || f.set(M, { edges: [], point: y }), f.get(M).edges.push({ edge: m, endpoint: x });
    }
  const d = [];
  for (const [m, x] of f)
    x.edges.length === 1 && d.push({ key: m, ...x.edges[0], point: x.point });
  console.log(`Edge cleanup: ${d.length} orphaned endpoints before snap pass`);
  let g = 0;
  const p = /* @__PURE__ */ new Set();
  for (let m = 0; m < d.length; m++) {
    const x = d[m];
    if (p.has(x.key)) continue;
    let y = null, M = 1 / 0;
    for (let E = 0; E < d.length; E++) {
      if (m === E) continue;
      const k = d[E];
      if (p.has(k.key)) continue;
      const w = Math.sqrt(
        (k.point.x - x.point.x) ** 2 + (k.point.y - x.point.y) ** 2
      );
      w < M && (M = w, y = k);
    }
    if (y && M < a) {
      const E = (x.point.x + y.point.x) / 2, k = (x.point.y + y.point.y) / 2;
      x.endpoint === "a" ? (x.edge.a.x = E, x.edge.a.y = k) : (x.edge.b.x = E, x.edge.b.y = k), y.endpoint === "a" ? (y.edge.a.x = E, y.edge.a.y = k) : (y.edge.b.x = E, y.edge.b.y = k), p.add(x.key), p.add(y.key), g++;
    }
  }
  console.log(`Edge cleanup: snapped ${g} pairs of nearby orphans`);
  const b = d.length - g * 2;
  return console.log(`Edge cleanup: ${b} orphaned endpoints remaining`), s;
}
function Pe(s, t = 1) {
  const e = (r) => `${Math.round(r.x / t)},${Math.round(r.y / t)}`, n = /* @__PURE__ */ new Map();
  for (const r of s) {
    const l = e(r.a), c = e(r.b);
    n.set(l, (n.get(l) || 0) + 1), n.set(c, (n.get(c) || 0) + 1);
  }
  const o = s.filter((r) => {
    const l = e(r.a), c = e(r.b), h = n.get(l) || 0, u = n.get(c) || 0;
    return h >= 2 || u >= 2;
  }), i = s.length - o.length;
  return i > 0 && console.log(`Edge cleanup: removed ${i} isolated edges (orphaned at both ends)`), o;
}
function Et(s, t, e, n, o) {
  for (const r of e) {
    if (r === n || r === o) continue;
    const l = t.x - s.x, c = t.y - s.y, h = r.b.x - r.a.x, u = r.b.y - r.a.y, a = l * u - c * h;
    if (Math.abs(a) < 1e-3) continue;
    const f = r.a.x - s.x, d = r.a.y - s.y, g = (f * u - d * h) / a, p = (f * c - d * l) / a;
    if (g > 1e-3 && g < 1 - 1e-3 && p > 1e-3 && p < 1 - 1e-3)
      return !0;
  }
  return !1;
}
function Oe(s, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: i = 32,
    occlusionEpsilon: r = 0.01,
    // 1% depth tolerance for depth buffer
    skipOcclusion: l = !1,
    width: c = 800,
    height: h = 600,
    renderer: u = null
  } = n;
  console.time("extractEdges");
  const a = $t(s, t.position);
  console.timeEnd("extractEdges"), console.log(`Extracted ${a.length} edges`), console.time("filterBackfacing");
  const f = Ft(a, t.position);
  console.timeEnd("filterBackfacing"), console.log(`After backface filter: ${f.length} edges`), console.time("classifyEdges");
  const { profiles: d, smoothFiltered: g } = Ct(f, t.position, o);
  console.timeEnd("classifyEdges"), console.log(`Profiles: ${d.length}, Smooth edges: ${g.length}`);
  const p = [...d, ...g];
  console.time("projectEdges");
  let b = yt(p, t, c, h);
  console.timeEnd("projectEdges");
  for (let S = 0; S < d.length; S++)
    b[S].isProfile = !0;
  console.time("spatialHash");
  const m = Math.max(c, h) / i, x = new ge(m);
  for (const S of b)
    x.insert(S);
  console.timeEnd("spatialHash"), console.time("splitIntersections");
  const y = /* @__PURE__ */ new Set();
  let M = [];
  for (const S of x.getAllCells()) {
    const P = x.query(S).filter((X) => !y.has(X)), O = Ot(P);
    M.push(...O);
    for (const X of P) y.add(X);
  }
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${M.length} edges`);
  let E;
  if (l)
    console.log("Skipping occlusion test (debug mode)"), E = M;
  else if (u) {
    console.time("testOcclusion (face ID buffer)");
    const S = M.filter((X) => X.isProfile), P = M.filter((X) => !X.isProfile);
    S.forEach((X) => X.visible = !0);
    const O = ye(P, [s], t, c, h, u, !1);
    E = [...S, ...O], console.timeEnd("testOcclusion (face ID buffer)");
  } else
    console.time("testOcclusion (raycaster - slow)"), E = ke(M, e, t, r), console.timeEnd("testOcclusion (raycaster - slow)");
  console.log(`Visible edges: ${E.length}`), console.time("optimize");
  const k = zt(E);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const w = Xt(k);
  return console.timeEnd("cleanup orphans"), console.log(`Final edges: ${w.length}`), {
    edges: w,
    profiles: w.filter((S) => S.isProfile)
  };
}
function Ie(s, t, e, n = {}) {
  const {
    smoothThreshold: o = 0.99,
    gridSize: i = 32,
    skipOcclusion: r = !1,
    width: l = 800,
    height: c = 600,
    renderer: h = null,
    internalScale: u = 4,
    // Scale up internally for better precision
    distanceThreshold: a = 0.5
    // Default plane distance threshold
  } = n;
  let f = [];
  for (const C of s) {
    C.updateMatrixWorld(!0);
    const I = $t(C, t.position);
    f.push(...I);
  }
  console.log(`Extracted ${f.length} edges from ${s.length} meshes`);
  const { profiles: d, smoothFiltered: g } = Ct(f, t.position, o);
  console.log(`Profiles: ${d.length}, Crease edges: ${g.length}`);
  const p = [...d, ...g];
  console.log(`After smooth filter: ${p.length} edges`);
  let b = yt(p, t, l, c, u);
  if (n.hatchEdges && n.hatchEdges.length > 0) {
    console.log(`Processing ${n.hatchEdges.length} hatch edges...`);
    let C = Ft(n.hatchEdges, t.position);
    if (n.minHatchDotProduct !== void 0) {
      const z = n.minHatchDotProduct;
      C = C.filter((Y) => {
        const H = new $().addVectors(Y.a, Y.b).multiplyScalar(0.5), F = new $().subVectors(t.position, H).normalize(), B = Y.normal1.dot(F);
        return Math.abs(B) >= z;
      }), console.log(`Density filter: kept ${C.length} hatch edges (threshold ${z})`);
    }
    const I = yt(C, t, l, c, u);
    I.forEach((z) => z.isHatch = !0), b.push(...I), console.log(`Added ${I.length} visible hatch edges`);
  }
  console.time("splitIntersections");
  const m = Ot(b);
  console.timeEnd("splitIntersections"), console.log(`After splitting: ${m.length} edges`), console.time("buildProjectedFaces");
  const x = [], y = t.position, M = l / 2, E = c / 2;
  for (const C of s) {
    const I = C.geometry, z = I.attributes.position, Y = I.index, H = Y ? Y.count / 3 : z.count / 3;
    for (let F = 0; F < H; F++) {
      let B, A, V;
      Y ? (B = Y.getX(F * 3), A = Y.getX(F * 3 + 1), V = Y.getX(F * 3 + 2)) : (B = F * 3, A = F * 3 + 1, V = F * 3 + 2);
      const D = new $(z.getX(B), z.getY(B), z.getZ(B)).applyMatrix4(C.matrixWorld), L = new $(z.getX(A), z.getY(A), z.getZ(A)).applyMatrix4(C.matrixWorld), Z = new $(z.getX(V), z.getY(V), z.getZ(V)).applyMatrix4(C.matrixWorld), K = new $().subVectors(L, D), et = new $().subVectors(Z, D), nt = new $().crossVectors(K, et).normalize(), lt = new $().addVectors(D, L).add(Z).divideScalar(3), at = new $().subVectors(y, lt), Q = -nt.dot(D);
      if (nt.dot(at) <= 0) continue;
      const ot = D.clone().project(t), ut = L.clone().project(t), W = Z.clone().project(t), J = new R(ot.x * M * u, -ot.y * E * u), _ = new R(ut.x * M * u, -ut.y * E * u), st = new R(W.x * M * u, -W.y * E * u), G = t.matrixWorldInverse, U = -D.clone().applyMatrix4(G).z, it = -L.clone().applyMatrix4(G).z, dt = -Z.clone().applyMatrix4(G).z;
      x.push({
        a2d: J,
        b2d: _,
        c2d: st,
        depthA: U,
        depthB: it,
        depthC: dt,
        mesh: C,
        faceIdx: F,
        normal: nt,
        // Store normal for post-split smooth filter
        constant: Q
        // Store plane constant for coplanar detection
      });
    }
  }
  console.timeEnd("buildProjectedFaces"), console.log(`Built ${x.length} projected faces for occlusion`), console.time("classifySilhouettes"), $e(m, x), console.timeEnd("classifySilhouettes"), console.time("filterSmoothSplitEdges");
  const k = Se(m, x, o, a);
  console.timeEnd("filterSmoothSplitEdges");
  let w;
  r ? w = k : (console.time("testOcclusion (math)"), w = ve(k, x, t), console.timeEnd("testOcclusion (math)")), console.log(`Visible edges: ${w.length}`), console.time("optimize");
  const S = zt(w);
  console.timeEnd("optimize"), console.time("cleanup orphans");
  const P = Xt(S);
  console.timeEnd("cleanup orphans");
  const O = Pe(P);
  console.log(`Final edges before optimization: ${O.length}`);
  let X = O;
  if (O.length > 0) {
    let C = 0;
    for (const Y of O) {
      const H = Y.b.x - Y.a.x, F = Y.b.y - Y.a.y;
      C += Math.sqrt(H * H + F * F);
    }
    const I = C / O.length, z = I / 10;
    console.log(`Optimization: avgLen=${I.toFixed(2)}, trim limit=${z.toFixed(2)}`), console.time("Optimize.segments"), X = ft.segments(O, !1, !0, z, !1, !1, !1)._segments, console.timeEnd("Optimize.segments"), console.log(`After optimization: ${X.length} edges`);
  }
  for (const C of X)
    C.a.x /= u, C.a.y /= u, C.b.x /= u, C.b.y /= u;
  const q = X;
  return {
    edges: q,
    profiles: q.filter((C) => C.isProfile),
    allEdges: m,
    // For debug visualization
    projectedFaces: x
    // For face visualization
  };
}
function $e(s, t) {
  for (const o of s) {
    if (o.isHatch) {
      o.isSilhouette = !1;
      continue;
    }
    const i = (o.a.x + o.b.x) / 2, r = (o.a.y + o.b.y) / 2, l = o.b.x - o.a.x, c = o.b.y - o.a.y, h = Math.sqrt(l * l + c * c);
    if (h < 1e-3) {
      o.isSilhouette = !1;
      continue;
    }
    const u = -c / h, a = l / h, f = kt(i, r, u, a, 1e3, t), d = kt(i, r, -u, -a, 1e3, t);
    o.isSilhouette = !f || !d;
  }
  const n = s.filter((o) => o.isSilhouette).length;
  console.log(`Classified ${n} silhouette edges out of ${s.length}`);
}
function kt(s, t, e, n, o, i) {
  for (const r of i)
    if (Fe(s, t, e, n, o, r.a2d, r.b2d, r.c2d))
      return !0;
  return !1;
}
function Fe(s, t, e, n, o, i, r, l) {
  return !!(xt(s, t, e, n, o, i.x, i.y, r.x, r.y) || xt(s, t, e, n, o, r.x, r.y, l.x, l.y) || xt(s, t, e, n, o, l.x, l.y, i.x, i.y));
}
function xt(s, t, e, n, o, i, r, l, c) {
  const h = l - i, u = c - r, a = e * u - n * h;
  if (Math.abs(a) < 1e-10) return !1;
  const f = ((i - s) * u - (r - t) * h) / a, d = ((i - s) * n - (r - t) * e) / a;
  return f > 0.1 && f <= o && d >= 0 && d <= 1;
}
var j = (s) => Math.round(s * 100) / 100, pt = function(s) {
  Pt.call(this), this.node = s;
};
pt.prototype = Object.create(Pt.prototype);
pt.prototype.constructor = pt;
var ze = function() {
  var s = this, t = document.createElementNS("http://www.w3.org/2000/svg", "svg"), e = document.createElementNS("http://www.w3.org/2000/svg", "g"), n = document.createElementNS("http://www.w3.org/2000/svg", "g"), o = document.createElementNS("http://www.w3.org/2000/svg", "g"), i, r, l, c, h = new Jt();
  t.setAttribute("xmlns", "http://www.w3.org/2000/svg"), t.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape"), t.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink"), t.setAttribute("version", "1.1"), e.setAttribute("inkscape:label", "Silhouettes"), e.setAttribute("inkscape:groupmode", "layer"), e.id = "silhouettes_layer", t.appendChild(e), o.setAttribute("inkscape:label", "Shading"), o.setAttribute("inkscape:groupmode", "layer"), o.id = "shading_layer", t.appendChild(o), n.setAttribute("inkscape:label", "Edges"), n.setAttribute("inkscape:groupmode", "layer"), n.id = "edges_layer", t.appendChild(n), this.domElement = t, this.showSilhouettes = !0, this.showEdges = !0, this.showHatches = !0, this.themes = {
    light: {
      background: "#ffffff",
      edgeStroke: "#000000",
      hatchStroke: "#444444",
      silhouetteFill: (a) => `rgba(${Math.floor((a.x * 0.5 + 0.5) * 40 + 200)},${Math.floor((a.y * 0.5 + 0.5) * 40 + 200)},${Math.floor((a.z * 0.5 + 0.5) * 40 + 200)},0.3)`
    },
    dark: {
      background: "#222222",
      edgeStroke: "#ffffff",
      hatchStroke: "#aaaaaa",
      silhouetteFill: (a) => `rgba(${Math.floor((a.x * 0.5 + 0.5) * 255)},${Math.floor((a.y * 0.5 + 0.5) * 255)},${Math.floor((a.z * 0.5 + 0.5) * 255)},0.3)`
    }
  }, this.theme = "dark", this.silhouetteOptions = {
    normalBuckets: 12,
    simplifyTolerance: 2,
    minArea: 100
  }, this.hatchOptions = {
    baseSpacing: 8,
    minSpacing: 3,
    maxSpacing: 40,
    depthFactor: 0.5,
    insetPixels: 2,
    stroke: null,
    // null = use theme
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
    },
    // Async rendering options
    frameBudgetMs: 16,
    // Max ms per frame (16ms = ~60fps)
    progressCallback: null
    // Optional: (progress: 0-1) => void
  }, this.edgeOptions = {
    stroke: null,
    // null = use theme
    strokeWidth: "1px"
  }, this.hiddenLineOptions = {
    smoothThreshold: 0.99
  }, this._glRenderer = null, this.autoClear = !0, this.setClearColor = function(a) {
    h.set(a);
  }, this.setPixelRatio = function() {
  }, this.setSize = function(a, f) {
    i = a, r = f, l = i / 2, c = r / 2, t.setAttribute("viewBox", -l + " " + -c + " " + i + " " + r), t.setAttribute("width", i), t.setAttribute("height", r);
  }, this.getSize = function() {
    return {
      width: i,
      height: r
    };
  }, this.setGLRenderer = function(a) {
    s._glRenderer = a;
  };
  function u() {
    for (; e.childNodes.length > 0; )
      e.removeChild(e.childNodes[0]);
    for (; n.childNodes.length > 0; )
      n.removeChild(n.childNodes[0]);
    for (; o.childNodes.length > 0; )
      o.removeChild(o.childNodes[0]);
  }
  this.clear = function() {
    u(), t.style.backgroundColor = h.getStyle();
  }, this.renderGPULayers = async function(a, f) {
    if (!s._glRenderer) {
      console.warn("PlotterRenderer: WebGL renderer not set. Call setGLRenderer() first.");
      return;
    }
    const d = s._glRenderer;
    if (s.showSilhouettes || s.showHatches) {
      const g = Qt(d, a, f, {
        normalBuckets: s.silhouetteOptions.normalBuckets,
        simplifyTolerance: s.silhouetteOptions.simplifyTolerance,
        minArea: s.silhouetteOptions.minArea,
        insetPixels: s.showHatches ? s.hatchOptions.insetPixels : 0
      });
      if (s.showSilhouettes && g.forEach((p) => {
        if (p.boundary.length < 3) return;
        const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let m = "";
        p.boundary.forEach((E, k) => {
          const w = E.x, S = -E.y;
          m += (k === 0 ? "M" : "L") + j(w) + "," + j(S);
        }), m += "Z";
        const x = p.normal, y = s.themes[s.theme] || s.themes.dark, M = y.silhouetteFill ? y.silhouetteFill(x) : `rgba(${Math.floor((x.x * 0.5 + 0.5) * 255)},${Math.floor((x.y * 0.5 + 0.5) * 255)},${Math.floor((x.z * 0.5 + 0.5) * 255)},0.3)`;
        b.setAttribute("d", m), b.setAttribute("fill", M), b.setAttribute("stroke", "none"), e.appendChild(b);
      }), s.showHatches) {
        g.sort((w, S) => w.depth - S.depth);
        const p = g.map((w) => w.hatchBoundary || w.boundary);
        let b = 1;
        {
          let w = 1 / 0, S = -1 / 0, P = 1 / 0, O = -1 / 0, X = 1 / 0, q = -1 / 0;
          if (a.traverse((C) => {
            if (!C.isMesh || !C.geometry) return;
            C.geometry.computeBoundingBox();
            const I = C.geometry.boundingBox;
            if (!I) return;
            const z = [
              new $(I.min.x, I.min.y, I.min.z),
              new $(I.max.x, I.max.y, I.max.z),
              new $(I.min.x, I.min.y, I.max.z),
              new $(I.min.x, I.max.y, I.min.z),
              new $(I.max.x, I.min.y, I.min.z),
              new $(I.min.x, I.max.y, I.max.z),
              new $(I.max.x, I.min.y, I.max.z),
              new $(I.max.x, I.max.y, I.min.z)
            ];
            for (const Y of z)
              Y.applyMatrix4(C.matrixWorld), w = Math.min(w, Y.x), S = Math.max(S, Y.x), P = Math.min(P, Y.y), O = Math.max(O, Y.y), X = Math.min(X, Y.z), q = Math.max(q, Y.z);
          }), isFinite(w)) {
            const C = [
              new $(w, P, X),
              new $(S, O, q),
              new $(w, P, q),
              new $(w, O, X),
              new $(S, P, X),
              new $(w, O, q),
              new $(S, P, q),
              new $(S, O, X)
            ];
            let I = 1 / 0, z = -1 / 0, Y = 1 / 0, H = -1 / 0;
            for (const D of C) {
              const L = D.clone().project(f), Z = (L.x + 1) * i / 2, K = (1 - L.y) * r / 2;
              I = Math.min(I, Z), z = Math.max(z, Z), Y = Math.min(Y, K), H = Math.max(H, K);
            }
            const F = z - I, B = H - Y, A = Math.max(F, B), V = Math.max(i, r);
            A > 0 && V > 0 && (b = A / V);
          }
        }
        const m = g.filter((w) => w.isHole);
        let x = null;
        const y = s.hatchOptions.brightnessShading || {};
        y.enabled && (y.lightDirection ? x = y.lightDirection.clone().normalize() : (a.traverse((w) => {
          x || (w.isDirectionalLight ? x = new $().subVectors(w.position, w.target.position).normalize() : (w.isPointLight || w.isSpotLight) && (x = w.position.clone().normalize()));
        }), x || (x = new $(1, 1, 1).normalize())), x = x.clone().transformDirection(f.matrixWorldInverse));
        const M = s.hatchOptions.frameBudgetMs || 16, E = s.hatchOptions.progressCallback;
        let k = performance.now();
        for (let w = 0; w < g.length; w++) {
          const S = g[w];
          let P = null;
          x && y.enabled && (P = Math.max(0, S.normal.dot(x)));
          const O = performance.now(), X = s.hatchOptions.regionTimeBudget || 100, q = {}, C = s.hatchOptions.axisSettings || {};
          for (const F of ["x", "y", "z"]) {
            const B = C[F] || {};
            q[F] = {
              rotation: B.rotation || 0,
              spacing: (B.spacing || s.hatchOptions.baseSpacing) * b
            };
          }
          let I = he(S, f, {
            baseSpacing: s.hatchOptions.baseSpacing * b,
            minSpacing: s.hatchOptions.minSpacing * b,
            maxSpacing: s.hatchOptions.maxSpacing * b,
            depthFactor: s.hatchOptions.depthFactor,
            insetPixels: s.hatchOptions.insetPixels,
            screenWidth: i,
            screenHeight: r,
            axisSettings: q,
            brightness: P,
            invertBrightness: y.invert || !1
          });
          if (performance.now() - O > X) {
            console.warn(`Region ${w} hatch generation exceeded time budget, skipping`);
            continue;
          }
          for (let F = 0; F < w; F++) {
            const B = g[F];
            if (!(S.isHole && S.parentRegionId === B.regionId) && (I = I.flatMap(
              (A) => St(A, p[F])
            ), performance.now() - O > X)) {
              console.warn(`Region ${w} clipping exceeded time budget, aborting`), I = [];
              break;
            }
          }
          for (const F of m)
            if (F.parentRegionId === S.regionId) {
              if (I.length === 0) break;
              I = I.flatMap(
                (B) => St(B, F.boundary)
              );
            }
          const z = s.themes[s.theme] || s.themes.dark, Y = s.hatchOptions.stroke || z.hatchStroke;
          if (s.hatchOptions.connectHatches && I.length > 0) {
            const F = document.createElementNS("http://www.w3.org/2000/svg", "path");
            let B = "";
            I.forEach((A, V) => {
              const D = V % 2 === 0 ? A.start : A.end, L = V % 2 === 0 ? A.end : A.start;
              V === 0 ? B += `M${j(D.x)},${j(-D.y)}` : B += `L${j(D.x)},${j(-D.y)}`, B += `L${j(L.x)},${j(-L.y)}`;
            }), F.setAttribute("d", B), F.setAttribute("fill", "none"), F.setAttribute("stroke", Y), F.setAttribute("stroke-width", s.hatchOptions.strokeWidth), o.appendChild(F);
          } else
            I.forEach((F, B) => {
              const A = document.createElementNS("http://www.w3.org/2000/svg", "path"), V = B % 2 === 0 ? F.start : F.end, D = B % 2 === 0 ? F.end : F.start, L = `M${j(V.x)},${j(-V.y)}L${j(D.x)},${j(-D.y)}`;
              A.setAttribute("d", L), A.setAttribute("fill", "none"), A.setAttribute("stroke", Y), A.setAttribute("stroke-width", s.hatchOptions.strokeWidth), o.appendChild(A);
            });
          performance.now() - k > M && w < g.length - 1 && (E && E((w + 1) / g.length), await new Promise((F) => requestAnimationFrame(F)), k = performance.now());
        }
        E && E(1);
      }
    }
    if (s.showEdges) {
      const g = [];
      if (a.traverse((p) => {
        if (!p.isMesh || !p.geometry) return;
        let b = !1, m = p;
        for (; m; ) {
          if (m.userData && m.userData.excludeFromSVG) {
            b = !0;
            break;
          }
          m = m.parent;
        }
        b || g.push(p);
      }), g.length > 0) {
        const b = Ie(g, f, a, {
          smoothThreshold: s.hiddenLineOptions.smoothThreshold,
          width: i,
          height: r
        }).edges || [], m = s.themes[s.theme] || s.themes.dark, x = s.edgeOptions.stroke || m.edgeStroke;
        b.forEach((y) => {
          const M = document.createElementNS("http://www.w3.org/2000/svg", "line");
          M.setAttribute("x1", j(y.a.x)), M.setAttribute("y1", j(y.a.y)), M.setAttribute("x2", j(y.b.x)), M.setAttribute("y2", j(y.b.y)), M.setAttribute("stroke", x), M.setAttribute("stroke-width", s.edgeOptions.strokeWidth), n.appendChild(M);
        });
      }
    }
  }, this.render = function(a, f) {
    if (!(f instanceof Kt)) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }
  };
};
export {
  v as GeomUtil,
  ft as Optimize,
  ze as PlotterRenderer,
  T as Point,
  pt as SVGObject,
  N as Segment,
  ct as Segments,
  Xt as cleanupOrphanedEdges,
  St as clipLineOutsidePolygon,
  Mt as clipLineToPolygon,
  Oe as computeHiddenLines,
  Ie as computeHiddenLinesMultiple,
  Qt as extractNormalRegions,
  he as generatePerspectiveHatches,
  zt as optimizeEdges
};
//# sourceMappingURL=three-plotter-renderer.es.js.map

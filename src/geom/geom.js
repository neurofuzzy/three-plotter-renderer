const EPSILON = 0.001;

export class Point {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  /**
   * @param {Point} pt
   */
  static clone(pt) {
    return new Point(pt.x, pt.y);
  }
}

export class BoundingBox {
  /**
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   */
  constructor(minX, minY, maxX, maxY) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }
  width() {
    return Math.abs(this.maxX - this.minX);
  }
  height() {
    return Math.abs(this.maxY - this.minY);
  }
}

export class BoundingCircle {
  /**
   *
   * @param {number} r radius
   */
  constructor(r = 0) {
    this.r = r;
  }
}

export class Segment {
  /**
   *
   * @param {Point} a start point
   * @param {Point} b end point
   */
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.tags = {};
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static isEqual(segA, segB) {
    return (
      (GeomUtil.pointsEqual(segA.a, segB.a) && GeomUtil.pointsEqual(segA.b, segB.b)) ||
      (GeomUtil.pointsEqual(segA.b, segB.a) && GeomUtil.pointsEqual(segA.a, segB.b))
    );
  }

  /**
   * @param {Segment} seg
   */
  static clone(seg) {
    return new Segment(new Point(seg.a.x, seg.a.y), new Point(seg.b.x, seg.b.y));
  }
}

export class SegmentCollection {
  constructor() {
    this.pivot = { x: 0, y: 0 };
    this.rotation = 0;
    this.isOpen = true;
    this.isGroup = false;
    this.isStrong = false;
    /**
     *
     * @param {Point[]} pts
     */
    this._makeAbsolute = (pts) => {
      let rot = (this.rotation * Math.PI) / 180;
      pts.forEach((pt, idx) => {
        const ptA = { x: pt.x, y: pt.y };
        GeomUtil.rotatePoint(ptA, rot);
        ptA.x += this.pivot.x;
        ptA.y += this.pivot.y;
        pts[idx] = ptA;
      });
    };
    /**
     *
     * @param {Segment[]} segs
     */
    this._makeSegsAbsolute = (segs) => {
      let rot = (this.rotation * Math.PI) / 180;
      segs.forEach((seg) => {
        const ptA = { x: seg.a.x, y: seg.a.y };
        const ptB = { x: seg.b.x, y: seg.b.y };
        GeomUtil.rotatePoint(ptA, rot);
        GeomUtil.rotatePoint(ptB, rot);
        GeomUtil.addToPoint(ptA, this.pivot);
        GeomUtil.addToPoint(ptB, this.pivot);
        seg.a = ptA;
        seg.b = ptB;
      });
    };
  }

  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(local = false) {
    throw "not implemented";
  }

  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(local = false) {
    throw "not implemented";
  }

  /**
   *
   * @param {boolean} local
   * @returns {BoundingBox}
   */
  getBoundingBox(local = false) {
    const bb = new BoundingBox(1000000, 1000000, -1000000, -1000000);
    const pts = this.toPoints(local);
    pts.forEach((pt) => {
      bb.minX = Math.min(bb.minX, pt.x);
      bb.minY = Math.min(bb.minY, pt.y);
      bb.maxX = Math.max(bb.maxX, pt.x);
      bb.maxY = Math.max(bb.maxY, pt.y);
    });

    return bb;
  }

  /**
   * @returns {BoundingCircle}
   */
  getBoundingCircle() {
    const bc = new BoundingCircle();
    const pts = this.toPoints(true);
    pts.forEach((pt) => {
      bc.r = Math.max(bc.r, Math.sqrt(pt.x * pt.x + pt.y * pt.y));
    });
    return bc;
  }
}

export class Segments extends SegmentCollection {
  /**
   *
   * @param {Segment[]} segments
   */
  constructor(segments) {
    super();
    /** @type {Segment[]} */
    this._segments = segments;
  }

  /**
   * @param {Segment[]} segs
   */
  add(...segs) {
    this._segments = this._segments.concat(segs);
  }

  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(local = false) {
    return this.toSegments(local).reduce((arr, seg) => (seg ? arr.concat([seg.a, seg.b]) : arr), []);
  }
  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(local = false) {
    let segs = this._segments.reduce((arr, seg) => (seg ? arr.concat(Segment.clone(seg)) : arr), []);
    if (!local) {
      this._makeSegsAbsolute(segs);
    }
    return segs;
  }

  bake() {
    // noOp
  }

  result() {
    return Segments.clone(this);
  }

  /**
   *
   * @param {Segments} segs
   */
  static clone(segs) {
    let sA = segs._segments;
    let sB = [];
    let i = sA.length;
    while (i--) {
      sB.unshift(Segment.clone(sA[i]));
    }
    let s = new Segments(sB);
    s.pivot.x = segs.pivot.x;
    s.pivot.y = segs.pivot.y;
    s.rotation = segs.rotation;
    return s;
  }
}

export class GeomUtil {
  /**
   *
   * @param {number} a
   * @param {number} b
   * @param {number} d
   * @returns {number}
   */
  static lerp(a, b, d) {
    return (1 - d) * a + d * b;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static angleBetween(ptA, ptB) {
    return Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x);
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngle(segA, segB) {
    let aA = GeomUtil.angleBetween(segA.a, segA.b);
    let aB = GeomUtil.angleBetween(segB.a, segB.b);

    return Math.abs(aA - aB) < EPSILON;
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   */
  static sameAngleRev(segA, segB) {
    let aA = GeomUtil.angleBetween(segA.a, segA.b);
    let aB = GeomUtil.angleBetween(segB.b, segB.a);

    return Math.abs(aA - aB) < EPSILON;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} d
   * @returns {Point}
   */
  static lerpPoints(ptA, ptB, d) {
    return {
      x: GeomUtil.lerp(ptA.x, ptB.x, d),
      y: GeomUtil.lerp(ptA.y, ptB.y, d),
    };
  }

  /**
   *
   * @param {Point} pt the point to rotate in place
   * @param {number} deg angle in degrees
   */
  static rotatePointDeg(pt, deg) {
    GeomUtil.rotatePoint(pt, (deg * Math.PI) / 180);
  }

  /**
   *
   * @param {Point} pt
   * @param {*} rad
   */
  static rotatePoint(pt, rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const oldY = pt.y;
    const oldX = pt.x;

    pt.y = cos * oldY - sin * oldX;
    pt.x = sin * oldY + cos * oldX;
  }

  /**
   *
   * @param {number} rad
   * @param  {...Point} points
   */
  static rotatePoints(rad, ...points) {
    points.forEach((pt) => {
      GeomUtil.rotatePoint(pt, rad);
    });
  }

  /**
   *
   * @param {number} deg
   * @param  {...Point} points
   */
  static rotatePointsDeg(deg, ...points) {
    let rad = (deg * Math.PI) / 180;
    points.forEach((pt) => {
      GeomUtil.rotatePoint(pt, rad);
    });
  }

  // Based on http://stackoverflow.com/a/12037737

  static outerTangents(ptA, rA, ptB, rB) {
    var dx = ptB.x - ptA.x;
    var dy = ptB.y - ptA.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= Math.abs(rB - rA)) return []; // no valid tangents

    // Rotation from x-axis
    var angle1 = Math.atan2(dy, dx);
    var angle2 = Math.acos((rA - rB) / dist);

    return [
      new Segment(
        {
          x: ptA.x + rA * Math.cos(angle1 + angle2),
          y: ptA.y + rA * Math.sin(angle1 + angle2),
        },
        {
          x: ptB.x + rB * Math.cos(angle1 + angle2),
          y: ptB.y + rB * Math.sin(angle1 + angle2),
        }
      ),
      new Segment(
        {
          x: ptA.x + rA * Math.cos(angle1 - angle2),
          y: ptA.y + rA * Math.sin(angle1 - angle2),
        },
        {
          x: ptB.x + rB * Math.cos(angle1 - angle2),
          y: ptB.y + rB * Math.sin(angle1 - angle2),
        }
      ),
    ];
  }

  /**
   *
   * @param {Point} pt
   */
  static cartesian2Polar(pt) {
    const d = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    const r = Math.atan2(pt.y, pt.x);
    pt.x = d;
    pt.y = r;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} [scale]
   */
  static pointsEqual(ptA, ptB, scale = 1) {
    return (
      Math.round(ptA.x * 10000 / scale) == Math.round(ptB.x * 10000 / scale) && Math.round(ptA.y * 10000 / scale) == Math.round(ptB.y * 10000 / scale)
    );
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetween(ptA, ptB) {
    const dx = ptB.x - ptA.x;
    const dy = ptB.y - ptA.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @returns {number}
   */
  static distanceBetweenSquared(ptA, ptB) {
    const dx = ptB.x - ptA.x;
    const dy = ptB.y - ptA.y;
    return dx * dx + dy * dy;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} numSegs
   * @returns {Point[]}
   */
  static interpolatePoints(ptA, ptB, numSegs) {
    let pts = [{ x: ptA.x, y: ptA.y }];
    let perc = 1 / numSegs;
    let deltaX = (ptB.x - ptA.x) * perc;
    let deltaY = (ptB.y - ptA.y) * perc;
    for (var i = 1; i < numSegs; i++) {
      pts.push(new Point(ptA.x + deltaX * i, ptA.y + deltaY * i));
    }
    pts.push({ x: ptB.x, y: ptB.y });
    return pts;
  }

  /**
   *
   * @param  {...Point} pts
   */
  static averagePoints(...pts) {
    let a = new Point(0, 0);
    pts.forEach((pt) => {
      a.x += pt.x;
      a.y += pt.y;
    });
    a.x /= pts.length;
    a.y /= pts.length;
    return a;
  }

  /**
   *
   * @param {Point} targetPt the point that will be added to
   * @param {Point} sourcePt the point to add to the target
   */
  static addToPoint(targetPt, sourcePt) {
    targetPt.x += sourcePt.x;
    targetPt.y += sourcePt.y;
  }

  /**
   *
   * @param {Point} targetPt the point that will be subtracted from
   * @param {Point} sourcePt the point tosubtract from the target
   */
  static subFromPoint(targetPt, sourcePt) {
    targetPt.x -= sourcePt.x;
    targetPt.y -= sourcePt.y;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {number} delta
   * @returns {Point[]}
   */
  static subdivideByDistance(ptA, ptB, delta) {
    if (delta === 0) {
      return [ptA, ptB];
    }
    let pts = [{ x: ptA.x, y: ptA.y }];
    let dist = GeomUtil.distanceBetween(ptA, ptB);
    let perc = delta / dist;
    let numFit = Math.floor(1 / perc);
    let remain = dist % delta;
    delta += remain / numFit;
    perc = delta / dist;
    let travel = perc;
    let i = 1;
    let deltaX = (ptB.x - ptA.x) * perc;
    let deltaY = (ptB.y - ptA.y) * perc;
    while (travel < 1) {
      pts.push(new Point(ptA.x + deltaX * i, ptA.y + deltaY * i));
      travel += perc;
      i++;
    }
    pts.push({ x: ptB.x, y: ptB.y });
    return pts;
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @param {number} [scale]
   */
  static segmentsConnected(segA, segB, scale = 1) {
    return GeomUtil.pointsEqual(segA.b, segB.a, scale) || GeomUtil.pointsEqual(segA.a, segB.b, scale);
  }

  /**
   *
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentsToPoints(segs) {
    let pts = segs.reduce((arr, seg) => {
      return arr.concat(seg.a, seg.b);
    }, []);
    let i = pts.length;
    while (i--) {
      let pt = pts[i];
      if (i > 0 && GeomUtil.pointsEqual(pt, pts[i - 1])) {
        pts.splice(i, 1);
      }
    }
    return pts;
  }

  /**
   *
   * @param {Point[]} pts
   * @returns {number}
   */
  static polygonArea(pts) {
    let area = 0;
    let j = pts.length - 1;
    for (var i = 0; i < pts.length; i++) {
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
      j = i;
    }
    return area / 2;
  }

  /**
   *
   * @param {Point[]} pts
   * @returns {BoundingBox}
   */
  static pointsBoundingBox(pts) {
    const b = new BoundingBox(1000000, 1000000, -1000000, -1000000);

    pts.forEach((pt) => {
      b.minX = Math.min(b.minX, pt.x);
      b.minY = Math.min(b.minY, pt.y);
      b.maxX = Math.max(b.maxX, pt.x);
      b.maxY = Math.max(b.maxY, pt.y);
    });

    return b;
  }

  /**
   *
   * @param {BoundingBox[]} bbs
   * @returns {BoundingBox}
   */
  static boundingBoxesBoundingBox(bbs) {
    const b = new BoundingBox(1000000, 1000000, -1000000, -1000000);

    bbs.forEach((bb) => {
      b.minX = Math.min(b.minX, bb.minX);
      b.minY = Math.min(b.minY, bb.minY);
      b.maxX = Math.max(b.maxX, bb.maxX);
      b.maxY = Math.max(b.maxY, bb.maxY);
    });

    return b;
  }

  /**
   *
   * @param {Segment[]} segs
   * @returns {BoundingBox}
   */
  static segmentsBoundingBox(segs) {
    const pts = [];
    segs.forEach((seg) => {
      pts.push(seg.a);
      pts.push(seg.b);
    });
    return GeomUtil.pointsBoundingBox(pts);
  }

  /**
   *
   * @param {BoundingBox} ab
   * @param {BoundingBox} bb
   */
  static boundingBoxesIntersect(ab, bb) {
    return ab.maxX >= bb.minX && ab.maxY >= bb.minY && ab.minX <= bb.maxX && ab.minY <= bb.maxY;
  }

  /**
   *
   * @param {Point[]} pts
   * @returns {boolean}
   */
  static polygonIsClockwise(pts) {
    return GeomUtil.polygonArea(pts) > 0;
  }

  /**
   *
   * @param {Point} p1
   * @param {Point} p2
   * @param {Point} p3
   */
  static ccw(p1, p2, p3) {
    return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {boolean}
   */
  static segmentsIntersect(segA, segB) {
    const fn = GeomUtil.ccw;
    return (
      fn(segA.a, segB.a, segB.b) != fn(segA.b, segB.a, segB.b) &&
      fn(segA.a, segA.b, segB.a) != fn(segA.a, segA.b, segB.b)
    );
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment} segB
   * @returns {Point}
   */
  static segmentSegmentIntersect(segA, segB, ignoreTouching = false) {
    const x1 = segA.a.x;
    const y1 = segA.a.y;
    const x2 = segA.b.x;
    const y2 = segA.b.y;
    const x3 = segB.a.x;
    const y3 = segB.a.y;
    const x4 = segB.b.x;
    const y4 = segB.b.y;

    const s1_x = x2 - x1;
    const s1_y = y2 - y1;
    const s2_x = x4 - x3;
    const s2_y = y4 - y3;

    const s = (-s1_y * (x1 - x3) + s1_x * (y1 - y3)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = (s2_x * (y1 - y3) - s2_y * (x1 - x3)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      const atX = x1 + t * s1_x;
      const atY = y1 + t * s1_y;
      let intPt = { x: atX, y: atY };
      if (ignoreTouching) {
        if (GeomUtil.pointsEqual(intPt, segB.a) || GeomUtil.pointsEqual(intPt, segB.b)) {
          return;
        }
        if (GeomUtil.pointsEqual(intPt, segA.a) || GeomUtil.pointsEqual(intPt, segA.b)) {
          return;
        }
      }
      return intPt;
    }

    return null;
  }

  /**
   *
   * @param {Segment} segA
   * @param {Segment[]} segs
   * @returns {Point[]}
   */
  static segmentSegmentsIntersections(segA, segs, ignoreTouching = false) {
    let pts = [];
    segs.forEach((seg) => {
      if (seg == segA) {
        return;
      }
      let intPt = GeomUtil.segmentSegmentIntersect(segA, seg, ignoreTouching);
      if (intPt) {
        pts.push(intPt);
      }
    });
    return pts;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static dot(ptA, ptB) {
    return ptA.x * ptB.x + ptA.y * ptB.y;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static cross(ptA, ptB) {
    return ptA.x * ptB.y - ptA.y * ptB.x;
  }

  /**
   * 
   * @param {Point} pt 
   * @param {Point} ptA 
   * @param {Point} ptB 
   */
  static lineSide (pt, ptA, ptB) {
    return Math.round(((ptB.x - ptA.x) * (pt.y - ptA.y) - (ptB.y - ptA.y) * (pt.x - ptA.x)) * 100) / 100;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static sub(ptA, ptB) {
    return new Point(ptA.x - ptB.x, ptA.y - ptB.y);
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   */
  static add(ptA, ptB) {
    return new Point(ptA.x + ptB.x, ptA.y + ptB.y);
  }

  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   * @returns {Point}
   */
  static closestPtPointSegment(pt, seg) {
    var ab = GeomUtil.sub(seg.b, seg.a);
    var ca = GeomUtil.sub(pt, seg.a);
    var t = GeomUtil.dot(ca, ab);

    if (t < 0) {
      pt = seg.a;
    } else {
      var denom = GeomUtil.dot(ab, ab);
      if (t >= denom) {
        pt = seg.b;
      } else {
        t /= denom;
        // reuse ca
        ca.x = seg.a.x + t * ab.x;
        ca.y = seg.a.y + t * ab.y;
        pt = ca;
      }
    }

    return Point.clone(pt);
  }

  /**
   *
   * @param {Point} pt
   * @param {Segment} seg
   */
  static distancePointSegment(pt, seg) {
    return GeomUtil.distanceBetween(pt, GeomUtil.closestPtPointSegment(pt, seg));
  }

  /**
   *
   * @param {*} pt
   * @param {*} boundingBox
   * @returns {boolean}
   */
  static pointWithinBoundingBox(pt, boundingBox) {
    return pt.x >= boundingBox.minX && pt.y >= boundingBox.minY && pt.x <= boundingBox.maxX && pt.y <= boundingBox.maxY;
  }

  /**
   *
   * @param {Point} pt
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static pointWithinPolygon(pt, polySegs, ignoreTouching) {
    const b = GeomUtil.segmentsBoundingBox(polySegs);
    // early out
    if (!this.pointWithinBoundingBox(pt, b)) {
      return false;
    }

    let startPt = new Point(100000, 100000);
    let seg = new Segment(startPt, pt);

    let pts = GeomUtil.segmentSegmentsIntersections(seg, polySegs);

    if (!(pts.length % 2 == 0)) {
      if (ignoreTouching && GeomUtil.pointsEqual(pt, pts[0])) {
        return false;
      }
    }
    return !(pts.length % 2 == 0);
  }

  /**
   *
   * @param {Segment} seg
   * @param {Segment[]} polySegs
   * @returns {boolean}
   */
  static segmentWithinPolygon(seg, polySegs) {
    let aTouching = this.pointWithinPolygon(seg.a, polySegs, false);
    let bTouching = this.pointWithinPolygon(seg.b, polySegs, false);
    let aWithin = this.pointWithinPolygon(seg.a, polySegs, true);
    let bWithin = this.pointWithinPolygon(seg.b, polySegs, true);
    return (aWithin && bWithin) || (aWithin && bTouching) || (bWithin && aTouching);
  }

  static sign(p1, p2, p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  }

  /**
   *
   * @param {Point} pt
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static pointWithinTriangle(pt, v1, v2, v3, ignoreTouching) {
    const d1 = GeomUtil.sign(pt, v1, v2);
    const d2 = GeomUtil.sign(pt, v2, v3);
    const d3 = GeomUtil.sign(pt, v3, v1);

    const has_neg = d1 < 0 || d2 < 0 || d3 < 0;
    const has_pos = d1 > 0 || d2 > 0 || d3 > 0;

    if (!(has_neg && has_pos) && ignoreTouching) {
      let seg = { a: v1, b: v2, tags: null };
      if (GeomUtil.distancePointSegment(pt, seg) < 1) return false;
      seg.a = v2;
      seg.b = v3;
      if (GeomUtil.distancePointSegment(pt, seg) < 1) return false;
      seg.a = v3;
      seg.b = v1;
      if (GeomUtil.distancePointSegment(pt, seg) < 1) return false;
    }

    return !(has_neg && has_pos);
  }

  /**
   *
   * @param {Segment} seg
   * @param {Point} v1
   * @param {Point} v2
   * @param {Point} v3
   * @returns {boolean}
   */
  static segmentWithinTriangle(seg, v1, v2, v3) {
    let aTouching = this.pointWithinTriangle(seg.a, v1, v2, v3, false);
    let bTouching = this.pointWithinTriangle(seg.b, v1, v2, v3, false);
    let aWithin = this.pointWithinTriangle(seg.a, v1, v2, v3, true);
    let bWithin = this.pointWithinTriangle(seg.b, v1, v2, v3, true);
    let pt = GeomUtil.averagePoints(seg.a, seg.b);
    return (aWithin && bWithin) || (aWithin && bTouching) || (bWithin && aTouching) || (aTouching && bTouching);
  }

  /**
   *
   * @param {Point[]} pts
   * @returns {Segment[]}
   */
  static pointsToClosedPolySegments(...pts) {
    let out = [];
    for (let i = 0; i < pts.length; i++) {
      out.push(new Segment(pts[i], i < pts.length - 1 ? pts[i + 1] : pts[0]));
    }
    return out;
  }

  /**
   *
   * @param {Segment[]} polySegsA
   * @param {Segment[]} polySegsB
   * @returns {boolean}
   */
  static polygonWithinPolygon(polySegsA, polySegsB) {
    const ab = GeomUtil.segmentsBoundingBox(polySegsA);
    const bb = GeomUtil.segmentsBoundingBox(polySegsB);

    // early out
    if (!GeomUtil.boundingBoxesIntersect(ab, bb)) {
      return false;
    }

    const startPt = new Point(bb.minX - 100, bb.minY - 100);

    for (let i = 0; i < polySegsA.length; i++) {
      let seg = polySegsA[i];
      let pts = GeomUtil.segmentSegmentsIntersections(seg, polySegsB);

      if (pts.length % 2 == 0) {
        return false;
      }
    }

    return true;
  }

  /**
   *
   * @param {Point} ptA
   * @param {Point} ptB
   * @param {Point} ptC
   * @param {number} iterations
   */
  static splinePoints(ptA, ptB, ptC, iterations = 0) {
    let divide = (pts) => {
      let out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        let pt = new Point(0, 0);
        if (i + 1 < pts.length * 0.4) {
          pt.x = (pts[i].x * 40 + pts[i + 1].x * 60) * 0.01;
          pt.y = (pts[i].y * 40 + pts[i + 1].y * 60) * 0.01;
        } else if (i + 1 > pts.length * 0.6) {
          pt.x = (pts[i].x * 60 + pts[i + 1].x * 40) * 0.01;
          pt.y = (pts[i].y * 60 + pts[i + 1].y * 40) * 0.01;
        } else {
          pt.x = (pts[i].x + pts[i + 1].x) * 0.5;
          pt.y = (pts[i].y + pts[i + 1].y) * 0.5;
        }
        out.push(pt);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };

    let spts = [ptA, ptB, ptC];

    for (let i = 0; i < iterations; i++) {
      spts = divide(spts);
    }

    return spts;
  }
}
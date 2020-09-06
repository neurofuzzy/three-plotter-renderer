// @ts-check

import { Point, BoundingBox, Segment, SegmentCollection, GeomUtil } from "./geom";

export class Shape extends SegmentCollection {
  constructor() {
    super();
    this.isOpen = false;
    this.isInverted = false;
  }
  open() {
    this.isOpen = true;
    return this;
  }
  invert() {
    this.isInverted = !this.isInverted;
    return this;
  }
  /**
   *
   * @param {boolean} local
   * @returns {Point[]};
   */
  toPoints(local = false) {
    throw "not implemented";
  }

  toGeomPoints() {
    return [this.toPoints(false).map((pt) => [pt.x, pt.y])];
  }
  /**
   *
   * @param {boolean} local
   * @returns {Segment[]};
   */
  toSegments(local = false) {
    let pts = this.toPoints(local);
    const segs = [];
    let start = 0;
    let len = pts.length;
    let isClockwise = GeomUtil.polygonIsClockwise(pts);
    let doReverse = isClockwise == !this.isInverted;
    if (doReverse) {
      pts = pts.reverse();
    }
    if (this.isOpen) {
      if (doReverse) {
        start++;
      } else {
        len--;
      }
    }
    for (let i = start; i < len; i++) {
      let a = pts[i];
      let b = pts[i < pts.length - 1 ? i + 1 : 0];
      segs.push(new Segment(a, b));
    }
    return segs;
  }
}

export class PolygonShape extends Shape {
  /**
   *
   * @param {Point[]} points
   * @param {number} [divisionDistance] distance between subdivisions, 0 for no subdivisions
   */
  constructor(points, divisionDistance = 0) {
    super();
    this.points = points;
    this.divisionDistance = divisionDistance;
  }
  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(local = false) {
    let pts = this.points ? this.points.concat() : [];
    if (!local) {
      this._makeAbsolute(pts);
    }
    if (this.divisionDistance == 0) {
      return pts;
    } else {
      let dpts = [];
      this.points.forEach((ptA, idx) => {
        let ptB = this.points[(idx + 1) % pts.length];
        dpts = dpts.concat(GeomUtil.subdivideByDistance(ptA, ptB, this.divisionDistance));
      });
      return dpts;
    }
  }
  /**
   * @param {boolean} local
   * @returns {Segment[]}
   */
  toSegments(local = false) {
    let pts = this.toPoints(local);
    let segs = [];
    for (let i = 0; i < pts.length; i++) {
      let a = pts[i];
      let b = pts[i < pts.length - 1 ? i + 1 : 0];
      segs.push(new Segment(a, b));
    }
    return segs;
  }
  /**
   *
   * @param {number[][]} geomPts
   */
  static fromGeomPoints(geomPts) {
    const pts = geomPts.map((gpt) => {
      return { x: gpt[0], y: gpt[1] };
    });
    return new PolygonShape(pts);
  }
  /**
   *
   * @param {{x:number, y:number}[]} pts
   */
  static fromPoints(pts) {
    return new PolygonShape(pts);
  }
}

export class CompoundShape extends Shape {
  /**
   * 
   * @param {Shape[]} [shapes]
   */
  constructor(shapes = []) {
    super();
    this.shapes = shapes;
  }
  open() {
    return this;
  }
  invert() {
    return this;
  }
  /**
   * @param {boolean} local
   * @returns {Point[]}
   */
  toPoints(local = false) {
    const pts = this.shapes.map(
        shape => shape.toPoints()
      ).reduce(
        (acc, pts) => acc.concat(pts), 
        [],
      );
    if (!local) {
      this._makeAbsolute(pts);
    }
    return pts;
  }
  /**
   * @param {boolean} local
   * @returns {Segment[]}
   */
  toSegments(local = false) {
    const segs = this.shapes.map(
        shape => shape.toSegments()
      ).reduce(
        (acc, segs) => acc.concat(segs),
        [],
      );
    if (!local) {
      this._makeSegsAbsolute(segs);
    }
    return segs;
  }
  /**
   * @returns {BoundingBox}
   */
  getBoundingBox() {
    const bb = new BoundingBox(1000000, 1000000, -1000000, -1000000);
    const pts = this.toPoints();
    pts.forEach(pt => {
      bb.minX = Math.min(bb.minX, pt.x);
      bb.minY = Math.min(bb.minY, pt.y);
      bb.maxX = Math.max(bb.maxX, pt.x);
      bb.maxY = Math.max(bb.maxY, pt.y);
    });
    return bb;
  }
}
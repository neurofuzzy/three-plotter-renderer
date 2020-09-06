import { Segment, Segments, SegmentCollection, Point, GeomUtil } from "./geom/geom";
import { Analyzer } from "./analyzer";

export class Optimize {
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
  static segmentCollections(segCols, noSplit = false, trimSmall = true, smallDist = 1, optimizePathOrder = false, splitTeeIntersections = false, splitCrossIntersections = false) {
    let allsegs = segCols.reduce((arr, sc) => arr.concat(sc.toSegments()), []);
    return Optimize.segments(allsegs, noSplit, trimSmall, smallDist, optimizePathOrder, splitTeeIntersections, splitCrossIntersections);
  }
  /**
   *
   * @param {SegmentCollection[]} segCols
   * @param {boolean} [splitTeeIntersections]
   * @returns {Segments}
   */
  static segmentCollectionsPathOrder(segCols, splitTeeIntersections = false, splitCrossIntersections = false) {
    let allsegs = segCols.reduce((arr, sc) => arr.concat(sc.toSegments()), []);
    return new Segments(Analyzer.pathOrder(allsegs, splitTeeIntersections, splitCrossIntersections));
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
  static segments(segs, noSplitColinear = false, trimSmall = true, smallDist= 1, optimizePathOrder = false, splitTeeIntersections = false, splitCrossIntersections = false) {

    const sb = segs;
    segs = [];

    while (sb.length) {
      let s = sb.shift();
      let n = segs.length
      let found = false;
      while (n--) {
        const sn = segs[n];
        if (Segment.isEqual(s, sn)) {
          found = true;
          break;
        }
      }
      if (!found) {
        segs.push(s);
      }
    }

    if (!noSplitColinear) {
      
      for (let n = 0; n < 3; n++) {
        let i = segs.length;
        let overlaps = 0;

        while (i--) {
          let segA = segs[i];
          let aa, ab, ba, bb, heading;
          for (let j = i - 1; j >= 0; j--) {
            let segB = segs[j];
            let same = false;
            let isRev = false;
            if (GeomUtil.sameAngle(segA, segB)) {
              same = true;
              aa = Point.clone(segA.a);
              ab = Point.clone(segA.b);
              ba = Point.clone(segB.a);
              bb = Point.clone(segB.b);
            } else if (GeomUtil.sameAngleRev(segA, segB)) {
              same = isRev = true;
              aa = Point.clone(segA.b);
              ab = Point.clone(segA.a);
              ba = Point.clone(segB.a);
              bb = Point.clone(segB.b);
            }
            if (same) {
              heading = GeomUtil.angleBetween(aa, ab);
              GeomUtil.rotatePoints(heading, aa, ab, ba, bb);
              if (Math.abs(aa.y - ba.y) < 0.1 && ab.x >= ba.x - 0.0001 && aa.x <= bb.x + 0.0001) {
                overlaps++;
                if (aa.x < ba.x) {
                  if (!isRev) {
                    segB.a = segA.a;
                  } else {
                    segB.a = segA.b;
                  }
                }
                if (ab.x > bb.x) {
                  if (!isRev) {
                    segB.b = segA.b;
                  } else {
                    segB.b = segA.a;
                  }
                }
                segs.splice(i, 1);
                break;
              }
            }
          }
        }
      }

    }
    
    let i = segs.length;
    while (i--) {
      let seg = segs[i];
      if (!seg) {
        segs.splice(i, 1);
        continue;
      }
      if (trimSmall && GeomUtil.distanceBetween(seg.a, seg.b) < smallDist) {
        segs.splice(i, 1);
        continue;
      }
    }

    if (optimizePathOrder) {
      segs = Analyzer.pathOrder(segs, splitTeeIntersections, splitCrossIntersections);
    }
    
    return new Segments(segs);
  }

}

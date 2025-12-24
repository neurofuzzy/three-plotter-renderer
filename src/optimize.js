import { Segment, Segments, SegmentCollection, Point, GeomUtil } from "./geom/geom.js";
import { Analyzer } from "./analyzer.js";

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
  static segments(segs, noSplitColinear = false, trimSmall = true, smallDist = 1, optimizePathOrder = false, splitTeeIntersections = false, splitCrossIntersections = false) {

    // Check if segments have edge metadata (isHatch, mesh, etc.) that would be lost in WASM
    // If so, skip WASM to preserve the metadata
    const hasEdgeMetadata = segs.length > 0 && (segs[0].isHatch !== undefined || segs[0].mesh !== undefined || segs[0].isSilhouette !== undefined);

    // Try WASM-accelerated path (only for plain Segment objects without metadata)

    if (hasEdgeMetadata) {
      console.log('[optimize] Skipping WASM to preserve edge metadata');
    }
    segs = Optimize._segmentsJS(segs, noSplitColinear, trimSmall, smallDist);

    if (optimizePathOrder) {
      segs = Analyzer.pathOrder(segs, splitTeeIntersections, splitCrossIntersections);
    }

    return new Segments(segs);
  }

  /**
   * WASM-accelerated segment optimization
   * @private
   */
  static _segmentsWASM(segs, noSplitColinear, trimSmall, smallDist) {
    // Convert Segment objects to flat array [ax, ay, bx, by, ...]
    const flatSegs = new Array(segs.length * 4);
    for (let i = 0; i < segs.length; i++) {
      flatSegs[i * 4] = segs[i].a.x;
      flatSegs[i * 4 + 1] = segs[i].a.y;
      flatSegs[i * 4 + 2] = segs[i].b.x;
      flatSegs[i * 4 + 3] = segs[i].b.y;
    }

    // Step 1: Dedupe
    let result = wasmDedupe(flatSegs);

    // Step 2: Merge colinear (if enabled)
    if (!noSplitColinear) {
      result = wasmMergeColinear(result);
    }

    // Step 3: Trim small (if enabled)
    if (trimSmall) {
      result = wasmTrimSmall(result, smallDist);
    }

    // Convert back to Segment objects
    const outputSegs = [];
    for (let i = 0; i < result.length; i += 4) {
      outputSegs.push(new Segment(
        new Point(result[i], result[i + 1]),
        new Point(result[i + 2], result[i + 3])
      ));
    }

    console.log(`[WASM] Optimize: ${segs.length} -> ${outputSegs.length} segments`);
    return outputSegs;
  }

  /**
   * JS fallback for segment optimization  
   * @private
   */
  static _segmentsJS(segs, noSplitColinear, trimSmall, smallDist) {
    const sb = segs;
    segs = [];

    // Dedupe
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

    // Merge colinear
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

    // Trim small
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

    console.log(`[JS] Optimize: ${sb.length + segs.length} -> ${segs.length} segments`);
    return segs;
  }

}

import { Segment, Point, GeomUtil } from "./geom/geom";
import { PolygonShape } from "./geom/shapes";
import { BooleanShape } from "./geom/booleanshape";

export class Analyzer {
  
  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {{ originalPts: Object.<string, Point>, pts: string[], cxs: Object.<string,string[]> }}
   */
  static getSegsAndConnections (segs, splitTeeIntersections = false, splitCrossIntersections = false) {
    
    /** @type {Object.<string,string[]>} */
    let cxs = {};
    /** @type {string[]} */
    let pts = [];
    /** @type {Object.<string, Point>} */
    let originalPts = {};

    let token = pt => {
      let t = `${Math.round(pt.x * 1)}|${Math.round(pt.y * 1)}`;
      originalPts[t] = pt;
      return t;
    }

    if (splitTeeIntersections) {

      // step 0, split segments that cross a point (T intersections);

      let allPts = segs.reduce((arr, seg) => arr.concat(seg.a, seg.b), []);
      let j = allPts.length; 

      while(j--) {
        let ptA = allPts[j];
        let i = j;
        while (i--) {
          let ptB = allPts[i];
          if (GeomUtil.pointsEqual(ptA, ptB)) {
            allPts.splice(j, 1);
            break;
          }
        }
      }

      let i = segs.length;

      while (i--) {

        let seg = segs[i];

        let crossPts = [];

        allPts.forEach(pt => {
          if (GeomUtil.distancePointSegment(pt, seg) < 0.1) {
            if (!GeomUtil.pointsEqual(pt, seg.a) && !GeomUtil.pointsEqual(pt, seg.b)) {
              crossPts.push(pt);
            }
          }
        });

        if (crossPts.length) {

          crossPts.sort((ptA, ptB) => {
            const da = GeomUtil.distanceBetweenSquared(ptA, seg.a);
            const db = GeomUtil.distanceBetweenSquared(ptB, seg.a);
            if (da < db) {
              return -1; 
            } else if (da > db) {
              return 1;
            }
            return 0;
          });

          const newSegs = [];

          let ptA = seg.a;
          for (let k = 0; k < crossPts.length; k++) {
            let ptB = crossPts[k];
            newSegs.push(new Segment(ptA, ptB));
            ptA = ptB;
          }
          newSegs.push(new Segment(ptA, seg.b));

          segs.splice(i, 1, ...newSegs);

        }

      }

    }

    if (splitCrossIntersections) {

      let j = segs.length;
      while (j--) {
        let i = j;
        let found = false
        while (i--) {
          let segA = segs[j];
          let segB = segs[i];
          let intPt = GeomUtil.segmentSegmentIntersect(segA, segB, true);
          if (intPt) {
            found = true;
            segs.splice(j, 1, new Segment(Point.clone(segA.a), Point.clone(intPt)), new Segment(Point.clone(intPt), Point.clone(segA.b)));
            segs.splice(i, 1, new Segment(Point.clone(segB.a), Point.clone(intPt)), new Segment(Point.clone(intPt), Point.clone(segB.b)));
          }
        }
        if (found) {
          j = segs.length;
        }
      }

    }

    // step 1, collect endpoints
    // step 2, filter out dupes
    // step 3, collect connected endpoints for each endpoint

    segs.forEach(seg => {
      let ta = token(seg.a);
      let tb = token(seg.b);
      if (!cxs[ta]) cxs[ta] = [];
      if (!cxs[tb]) cxs[tb] = [];
      if (cxs[ta].indexOf(tb) === -1) {
        cxs[ta].push(tb);
      }
      if (cxs[tb].indexOf(ta) === -1) {
        cxs[tb].push(ta);
      }
      if (pts.indexOf(ta) === -1) {
        pts.push(ta);
      }
      if (pts.indexOf(tb) === -1) {
        pts.push(tb);
      }
    });

    return { 
      originalPts,
      pts,
      cxs
    };

  }

  /**
   * @property {Segment[]} segs
   * @property {boolean} splitTeeIntersections
   * @returns {Segment[]}
   */
  static pathOrder (segs, splitTeeIntersections = false, splitCrossIntersections = false) {

    let res = [];
    let { originalPts, pts, cxs } = Analyzer.getSegsAndConnections(segs, splitTeeIntersections, splitCrossIntersections);

    let nekot = str => {
      return originalPts[str];
    };

    let byNumConnections = (ta, tb) => {
      if (cxs[ta].length > cxs[tb].length) {
        return 1;
      } else if (cxs[ta].length < cxs[tb].length) {
        return -1;
      }
      return 0;
    }

    // step 1, sort by number of connections, desc
    // step 2, choose first endpoint
    // step 3, pick the connected one with the lowest index that isn't in the stack, remove from connections list, push onto stack
    // step 4, resort by number of connections, desc
    // step 5, repeat step 6 until no more connections

    pts.sort(byNumConnections);

    while (pts.length) {

      pts.sort(byNumConnections);
      let ptA = pts.shift();

      while (ptA) {

        if (cxs[ptA].length) {
          
          cxs[ptA].sort(byNumConnections);
          let ptB = cxs[ptA].shift();

          let oppIdx = cxs[ptB].indexOf(ptA);
          if (oppIdx !== -1) cxs[ptB].splice(oppIdx, 1);

          res.push(new Segment(nekot(ptA), nekot(ptB)));

          if (cxs[ptA].length) {
            pts.unshift(ptA);
          }

          ptA = ptB;

        } else {

          ptA = null;

        }

      }

    }

    return res;

  }

  /**
   * @property {Segment[]} segs
   * @property {number} offset
   * @returns {Point[]}
   */
  static getEndingSegmentPoints (segs, offset = 0) {

    segs = segs.concat();
    segs = Analyzer.pathOrder(segs, true, true);

    let { originalPts, pts, cxs } = Analyzer.getSegsAndConnections(segs, true);

    let nekot = str => {
      return originalPts[str];
    };

    // return all points with one connection
    
    const endTokens = pts.filter(ta => cxs[ta].length === 1);

    const out = [];
    endTokens.forEach(tb => {
      const ptB = Point.clone(nekot(tb) );
      if (offset === 0) {
        out.push(ptB);
        return;
      }
      const ptA = nekot(cxs[tb]);
      const ang = GeomUtil.angleBetween(ptA, ptB);
      const pt = new Point(0, offset);
      GeomUtil.rotatePoint(pt, Math.PI * 0.5 - ang);
      GeomUtil.addToPoint(ptB, pt);
      out.push(ptB);
    });

    return out;

  }

  /**
   * @property {Segment[]} segs
   * @property {number} searchMultiplier multiple of typical segmentation distance to search for flood-fill points
   * @returns {Point[][]}
   */
  static getFills (segs, searchMultiplier = 5) {

    segs = segs.concat();

    let { originalPts, pts, cxs } = Analyzer.getSegsAndConnections(segs, true, true);

    let token = pt => {
      let t = `${Math.round(pt.x * 1)}|${Math.round(pt.y * 1)}`;
      originalPts[t] = pt;
      return t;
    }

    let cenTokens = [];
    let pointGroups = [];

    // 1. iterate through all points
    // 2. for each point pick a each connection
    // 3. for each pair, proceed to find a winding polygon
    
    let minX = 100000;
    let minY = 100000;
    let maxX = -100000;
    let maxY = -100000;
    let minDx = 100000;
    let minDy = 100000;

    let ptArray = [];

    // get extents

    for (let token in originalPts) {
      let pt = originalPts[token];
      ptArray.push(pt);
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }

    // get minimum spacing

    ptArray.sort((a, b) => {
      if (a.x < b.x) {
        return -1;
      } else if (a.x > b.x) {
        return 1;
      }
      return 0;
    });

    ptArray.forEach((ptA, idx) => {
      if (idx > 0) {
        let ptB = ptArray[idx - 1];
        let dx = Math.round(Math.abs(ptA.x - ptB.x));
        if (dx > 1) {
          minDx = Math.min(minDx, dx);
        }
      }
    });

    ptArray.sort((a, b) => {
      if (a.y < b.y) {
        return -1;
      } else if (a.y > b.y) {
        return 1;
      }
      return 0;
    });

    ptArray.forEach((ptA, idx) => {
      if (idx > 0) {
        let ptB = ptArray[idx - 1];
        let dy = Math.round(Math.abs(ptA.y - ptB.y));
        if (dy > 1) {
          minDy = Math.min(minDy, dy);
        }
      }
    });

    let hDx = minDx * 0.5;
    let hDy = minDy * 0.5;

    let rayPts = [];

    for (let j = minY; j < maxY; j += minDy) {
      for (let i = minX; i < maxX; i += minDx) {
        rayPts.push(new Point(i + hDx, j + hDy));
      }
    }

    rayPts.forEach(rayPt => {
      let nearPts = [];
      ptArray.forEach(pt => {
        let dist = GeomUtil.distanceBetween(pt, rayPt);
        if (dist < Math.max(minDx, minDy) * searchMultiplier) {
          let ang = GeomUtil.angleBetween(pt, rayPt);
          nearPts.push({
            pt,
            dist,
            ang
          });
        }
      });
      if (nearPts.length < 4) {
        return;
      }
      let i = nearPts.length;
      while (i--) {
        let nPt = nearPts[i].pt;
        let seg = new Segment(rayPt, nPt);
        let hits = GeomUtil.segmentSegmentsIntersections(seg, segs, true);
        if (hits.length > 0) {
          nearPts.splice(i, 1);
        }
      }
      nearPts.sort((a, b) => {
        if (a.ang < b.ang) {
          return -1;
        } else if (a.ang > b.ang) {
          return 1;
        }
        return 0;
      });
      i = nearPts.length;
      while (i--) {
        let nPtA = nearPts[i].pt;
        let tokenA = token(nPtA);
        let j = nearPts.length;
        let ok = false;
        while (j--) {
          if (i === j) {
            continue;
          }
          let nPtB = nearPts[j].pt;
          let tokenB = token(nPtB);
          if (cxs[tokenA].indexOf(tokenB) === -1) {
            ok = true;
            break;
          }
        }
        if (!ok) {
          nearPts.splice(i, 1);
        }
      }
      let ok = true;
      nearPts.forEach((npA, idx) => {
        let npB = nearPts[(idx + 1) % nearPts.length];
        let tokenA = token(npA.pt);
        let tokenB = token(npB.pt);
        if (cxs[tokenA].indexOf(tokenB) === -1) {
          ok = false;
        }
      });
      if (ok) {
        let polyPts = nearPts.map(nPt => nPt.pt);
        let cen = GeomUtil.averagePoints(...polyPts);
        let cenToken = token(cen);
        if (cenTokens.indexOf(cenToken) === -1) {
          cenTokens.push(cenToken);
          pointGroups.push(polyPts);
        }
      }
    });

    return pointGroups;

  }

  /**
   * @param {Point[][]} fills
   * @returns {Segment[]}
   */
  static getFillsOutline (fills) {
    
    let outlineShape = new BooleanShape();

    fills.forEach(fillPts => {
      let fill = new PolygonShape(fillPts);
      outlineShape.add(fill);
    });

    return outlineShape.toSegments();

  }

}


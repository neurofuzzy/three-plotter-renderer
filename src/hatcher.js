
import { GeomUtil, Point, Segment } from "./geom/geom.js";
import { Expander } from "./expander.js";

export class Hatcher {

  /**
   * 
   * @param {Segment[]} borderSegments 
   * @param {number} spacing 
   * @param {number} rotation 
   * @param {number} padding 
   * @param {number} scale 
   */
  static flatHatchSegments(borderSegments, spacing, rotation = 0, padding = 2, scale = 1) {

    console.log("adding hatching", spacing, rotation)

    let segs = [];

    borderSegments.forEach(seg => {
      seg = Segment.clone(seg);
      seg.a.x *= 100000;
      seg.a.y *= 100000;
      seg.b.x *= 100000;
      seg.b.y *= 100000;
      segs.push(seg);
    })

    // create hatch rect

    let bb = GeomUtil.segmentsBoundingBox(segs);

    let hatchSegs = [];

    let bbCen = new Point(bb.minX + (bb.maxX - bb.minX) * 0.5, bb.minY + (bb.maxY - bb.minY) * 0.5);

    let hr = Math.max(Math.abs(bb.maxX - bb.minX), Math.abs(bb.maxY - bb.minY));
    let hreo = hr;
    for (let hx = bbCen.x - hr; hx < bbCen.x + hr; hx += (spacing * scale)) {
      hatchSegs.push(new Segment({ x: hx, y: bbCen.y - hreo }, { x: hx, y: bbCen.y + hreo }));
      hreo = 0 - hreo; // alternate hatch direction for less pen travel
    }

    // rotate hatching around centroid of polygon to hatch
    hatchSegs.forEach((seg) => {
      GeomUtil.subFromPoint(seg.a, bbCen);
      GeomUtil.subFromPoint(seg.b, bbCen);
      GeomUtil.rotatePointDeg(seg.a, rotation);
      GeomUtil.rotatePointDeg(seg.b, rotation);
      GeomUtil.addToPoint(seg.a, bbCen);
      GeomUtil.addToPoint(seg.b, bbCen);
    });

    // create a contracted (offset) polygon to hatch if padding is added
    if (padding) {
      segs = Expander.expandSegs(0 - padding, segs, 100000);
    }

    let d = "";

    let out = [];

    // raycast each hatch line through the polygon
    hatchSegs.forEach((seg) => {

      const hitPts = GeomUtil.segmentSegmentsIntersections(seg, segs);

      hitPts.sort((a, b) => {
        const distA = GeomUtil.distanceBetweenSquared(seg.a, a);
        const distB = GeomUtil.distanceBetweenSquared(seg.a, b);
        if (distA > distB) {
          return 1;
        } else if (distA < distB) {
          return -1;
        }
        return 0;
      });

      // draw the hatching

      let penDown = true;

      for (let h = 1; h < hitPts.length; h++) {
        if (penDown) {
          let a = hitPts[h - 1];
          let b = hitPts[h]; 
          out.push(new Segment(
            new Point(a.x / 100000, a.y / 100000),
            new Point(b.x / 100000, b.y / 100000),
          ));  
        }
        penDown = !penDown;
      }

    });

    return out;

  }

  /**
   * 
   * @param {Segment[]} borderSegments 
   * @param {number} spacing 
   * @param {number} rotation 
   * @param {number} padding 
   * @param {number} scale 
   */
  static addFlatHatching(borderSegments, spacing, rotation = 0, padding = 2, scale = 1) {

    console.log("adding hatching", spacing, rotation, scale)

    // create hatch rect

    let bb = GeomUtil.segmentsBoundingBox(borderSegments);

    let hatchSegs = [];

    let bbCen = new Point(bb.minX + (bb.maxX - bb.minX) * 0.5, bb.minY + (bb.maxY - bb.minY) * 0.5);

    let hr = Math.max(Math.abs(bb.maxX - bb.minX), Math.abs(bb.maxY - bb.minY));
    let hreo = hr;
    for (let hx = bbCen.x - hr; hx < bbCen.x + hr; hx += (spacing * scale)) {
      hatchSegs.push(new Segment({ x: hx, y: bbCen.y - hreo }, { x: hx, y: bbCen.y + hreo }));
      hreo = 0 - hreo; // alternate hatch direction for less pen travel
    }

    // rotate hatching around centroid of polygon to hatch
    hatchSegs.forEach((seg) => {
      GeomUtil.subFromPoint(seg.a, bbCen);
      GeomUtil.subFromPoint(seg.b, bbCen);
      GeomUtil.rotatePointDeg(seg.a, rotation);
      GeomUtil.rotatePointDeg(seg.b, rotation);
      GeomUtil.addToPoint(seg.a, bbCen);
      GeomUtil.addToPoint(seg.b, bbCen);
    });

    // create a contracted (offset) polygon to hatch if padding is added
    if (padding) {
      borderSegments = Expander.expandSegs(0 - padding, borderSegments, scale);
    }

    let d = "";

    // raycast each hatch line through the polygon
    hatchSegs.forEach((seg) => {

      const hitPts = GeomUtil.segmentSegmentsIntersections(seg, borderSegments);

      hitPts.sort((a, b) => {
        const distA = GeomUtil.distanceBetweenSquared(seg.a, a);
        const distB = GeomUtil.distanceBetweenSquared(seg.a, b);
        if (distA > distB) {
          return 1;
        } else if (distA < distB) {
          return -1;
        }
        return 0;
      });

      // draw the hatching

      let penDown = true;

      for (let h = 1; h < hitPts.length; h++) {
        if (penDown) {
          let a = hitPts[h - 1];
          let b = hitPts[h];
          d += ` M${Math.round(a.x / 1000) / 100},${Math.round(a.y / 1000) / 100}L${Math.round(b.x / 1000) / 100},${
            Math.round(b.y / 1000) / 100
          }`;    
        }
        penDown = !penDown;
      }
      
    });

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", "black");
    path.setAttribute("stroke-width", "0.5");
    return path;

  }

}


import { GeomUtil, Point, Segment } from "./geom/geom.js";
import { PolygonShape, CompoundShape } from "./geom/shapes.js";
import * as clipperLib from "js-angusj-clipper";

/** @type {clipperLib.ClipperLibWrapper} */
let clipper = null;

clipperLib
  .loadNativeClipperLibInstanceAsync(
    // let it autodetect which one to use, but also available WasmOnly and AsmJsOnly
    clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback
  )
  .then((res) => {
    clipper = res;
  });

export class Expander {

  /**
   * 
   * @param {Point} a 
   * @param {Point} b 
   * @param {Point} c 
   * @param {number} amount 
   */
  static expandFace(a, b, c, amount) {
    const polyResult = clipper.offsetToPaths({ 
      offsetInputs: [{
        joinType: clipperLib.JoinType.Square,
        endType: clipperLib.EndType.ClosedPolygon,
        // @ts-ignore
        data: [a, b, c],
      }],
      delta: amount
    });
    return polyResult;
  }

  /**
   * 
   * @param {number} amount 
   * @param {Segment[]} segs 
   * @param {number} scale 
   */
  static expandSegs(amount, segs, scale = 1) {
      
    let ppts = [];
    let pts = [];
    
    segs.forEach((seg, idx) => {
      if (idx > 0) {
        let pseg = segs[idx - 1];
        if (!GeomUtil.pointsEqual(pseg.b, seg.a, scale)) {
          ppts.push(pts);
          pts = [];
        }
      }
      pts.push(Point.clone(seg.a));
      pts.push(Point.clone(seg.b));
    });
  
    ppts.push(pts);
  
    const polyResult = clipper.offsetToPaths({ 
      offsetInputs: [{
        joinType: clipperLib.JoinType.Square,
        endType: clipperLib.EndType.ClosedPolygon,
        data: ppts,
      }],
      delta: amount * scale
    });
  
    if (!polyResult) {
      console.log("no offset result from expand segs")
      return [];
    }
  
    let cs = new CompoundShape();
  
    for (let i = 0; i < polyResult.length; i++) {
      cs.shapes.push(new PolygonShape(polyResult[i]));
    }
  
    return cs.toSegments();
  
  }

}
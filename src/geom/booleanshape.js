// @ts-check

import { Segment } from "./geom.js";
import { Shape, PolygonShape, CompoundShape } from "./shapes.js";
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

export class BooleanShape extends CompoundShape {

  /**
   * 
   * @param {Shape[]} [shapes]
   */
  constructor(shapes = [], cleanDistance = 0.1) {
    super(shapes);
    this.additiveShapes = 0;
    this.subtractiveShapes = 0;
    this.cleanDistance = cleanDistance;
  }
  /**
   *
   * @param {Shape} shape
   * @returns {BooleanShape}
   */
  add(shape) {
    if (shape.isInverted) {
      shape.invert();
    }
    this.shapes.push(shape);
    this.additiveShapes++;
    return this;
  }

  /**
   *
   * @param {Shape} shape
   * @returns {BooleanShape}
   */
  sub(shape) {
    if (!shape.isInverted) {
      shape.invert();
    }
    this.shapes.push(shape);
    this.subtractiveShapes++;
    return this;
  }

  /**
   * @returns {Segment[]};
   */
  toSegments() {
    let computedShapes = [];

    for (let i = 0; i < this.shapes.length; i++) {
      computedShapes = BooleanShape.combine(this.shapes[i], computedShapes, this.cleanDistance);
    }

    if (!computedShapes) {
      return [];
    }

    return computedShapes.map((shape) => shape.toSegments()).reduce((acc, segs, _, []) => acc.concat(segs), []);
  }

  /**
   *
   * @param {Shape} shape
   * @param {Shape[]} shapes
   * @returns {Shape[]}
   */
  static combine(shape, shapes, cleanDistance = 0.01) {
    if (!shapes) {
      return [];
    }

    let geoms = shapes.map((shape) => shape.toPoints());
    let gshape = shape.toPoints();

    let res;
    try {
      if (!shape.isInverted) {
        res = clipper.clipToPaths({
          clipType: clipperLib.ClipType.Union,
          subjectInputs: [{ data: gshape, closed: true }],
          clipInputs: geoms.map((geom) => {
            return { data: geom, closed: true };
          }),
          subjectFillType: clipperLib.PolyFillType.EvenOdd,
          cleanDistance: cleanDistance,
        });
      } else {
        res = clipper.clipToPaths({
          clipType: clipperLib.ClipType.Difference,
          clipInputs: [{ data: gshape }],
          subjectInputs: geoms.map((geom) => {
            return { data: geom, closed: true };
          }),
          subjectFillType: clipperLib.PolyFillType.EvenOdd,
          cleanDistance: cleanDistance,
        });
      }
    } catch (err) {
      console.log(err.toString());
      console.log(err);
      return;
    }

    let computedShapes = [];

    res.forEach((mpoly) => {
      //console.log(mpoly.length)
      computedShapes.push(PolygonShape.fromPoints(mpoly));
    });

    //console.log("computed shapes: " + computedShapes.length + " " + geoms.length + " " + gshape.length);

    return computedShapes;
  }
}

BooleanShape.UNION = "union";
BooleanShape.SUBTRACT = "subtract";

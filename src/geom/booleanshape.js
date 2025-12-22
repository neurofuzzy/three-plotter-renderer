// @ts-check

import { Segment, Point } from "./geom.js";
import { Shape, PolygonShape, CompoundShape } from "./shapes.js";
import * as clipperLib from "js-angusj-clipper";
import { isWasmReady, createBooleanProcessor } from "../wasm-geometry.js";

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
   * @param {Shape[]} [shapes]
   * @param {number} [cleanDistance]
   */
  constructor(shapes = [], cleanDistance = 0.1) {
    super(shapes);
    this.additiveShapes = 0;
    this.subtractiveShapes = 0;
    this.cleanDistance = cleanDistance;
    /** @type {import('../wasm-geometry.js').BooleanProcessor | null} */
    this._wasmProcessor = null;
  }

  /**
   * Initialize WASM processor if available
   * @private
   */
  _initWasmProcessor() {
    if (!this._wasmProcessor && isWasmReady()) {
      this._wasmProcessor = createBooleanProcessor();
    }
  }

  /**
   * @param {Shape} shape
   * @returns {BooleanShape}
   */
  add(shape) {
    if (shape.isInverted) {
      shape.invert();
    }
    this.shapes.push(shape);
    this.additiveShapes++;

    // Also add to WASM processor if available
    this._initWasmProcessor();
    if (this._wasmProcessor) {
      const points = shape.toPoints();
      const flat = pointsToFlat(points);
      this._wasmProcessor.add_subject(new Float64Array(flat));
    }

    return this;
  }

  /**
   * @param {Shape} shape
   * @returns {BooleanShape}
   */
  sub(shape) {
    if (!shape.isInverted) {
      shape.invert();
    }
    this.shapes.push(shape);
    this.subtractiveShapes++;

    // Also add to WASM processor if available
    this._initWasmProcessor();
    if (this._wasmProcessor) {
      const points = shape.toPoints();
      const flat = pointsToFlat(points);
      this._wasmProcessor.add_clip(new Float64Array(flat));
    }

    return this;
  }

  /**
   * @returns {Segment[]};
   */
  toSegments() {
    // Try WASM path first (faster)
    this._initWasmProcessor();
    if (this._wasmProcessor && this._wasmProcessor.subject_count() > 0) {
      try {
        const segmentsFlat = this.subtractiveShapes > 0
          ? this._wasmProcessor.compute_difference()
          : this._wasmProcessor.compute_union();

        if (segmentsFlat.length > 0) {
          return flatToSegments(Array.from(segmentsFlat));
        }
      } catch (err) {
        console.warn('[BooleanShape] WASM computation failed, falling back to JS:', err);
      }
    }

    // Fallback to JS clipper
    return this._toSegmentsJS();
  }

  /**
   * Original JS implementation using clipper
   * @private
   * @returns {Segment[]}
   */
  _toSegmentsJS() {
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
      computedShapes.push(PolygonShape.fromPoints(mpoly));
    });

    return computedShapes;
  }
}

BooleanShape.UNION = "union";
BooleanShape.SUBTRACT = "subtract";

// ============ Helpers ============

/**
 * Convert array of {x, y} points to flat array [x1, y1, x2, y2, ...]
 * @param {Array<{x: number, y: number}>} points
 * @returns {number[]}
 */
function pointsToFlat(points) {
  const flat = [];
  for (const pt of points) {
    flat.push(pt.x, pt.y);
  }
  return flat;
}

/**
 * Convert flat segment array [x1, y1, x2, y2, ...] to Segment[]
 * Each segment is 4 values: startX, startY, endX, endY
 * @param {number[]} flat
 * @returns {Segment[]}
 */
function flatToSegments(flat) {
  const segments = [];
  for (let i = 0; i < flat.length; i += 4) {
    segments.push(new Segment(
      new Point(flat[i], flat[i + 1]),
      new Point(flat[i + 2], flat[i + 3])
    ));
  }
  return segments;
}

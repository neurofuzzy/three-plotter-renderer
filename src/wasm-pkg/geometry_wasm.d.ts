/* tslint:disable */
/* eslint-disable */

export class BooleanProcessor {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get count of clip shapes
   */
  clip_count(): number;
  /**
   * Add a polygon as subject (for union base).
   * Points should be a flat array: [x1, y1, x2, y2, ...]
   */
  add_subject(points: Float64Array): void;
  /**
   * Compute union of all shapes and return as segments.
   * Returns a flat array: [x1, y1, x2, y2, ...] per segment (4 values each)
   */
  compute_union(): Float64Array;
  /**
   * Get count of subject shapes
   */
  subject_count(): number;
  /**
   * Compute difference (subjects - clips) and return as segments.
   */
  compute_difference(): Float64Array;
  /**
   * Create a new BooleanProcessor
   */
  constructor();
  /**
   * Clear all shapes
   */
  clear(): void;
  /**
   * Add a polygon as clip (to union with or subtract from subject).
   * Points should be a flat array: [x1, y1, x2, y2, ...]
   */
  add_clip(points: Float64Array): void;
}

export class HiddenLineProcessor {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Set camera view-projection matrix, position, and viewport
   */
  set_camera(view_proj: Float32Array, camera_pos: Float32Array, width: number, height: number): void;
  /**
   * Set geometry from flat arrays
   * vertices: [x,y,z, x,y,z, ...] in world space
   * indices: [i0,i1,i2, ...] triangle indices
   * mesh_ranges: [start0, count0, start1, count1, ...] per-mesh index ranges
   */
  set_geometry(vertices: Float32Array, indices: Uint32Array, mesh_ranges: Uint32Array): void;
  /**
   * Set crease angle threshold (as cosine, 0.0 = 90°, 1.0 = 0°)
   */
  set_crease_threshold(threshold: number): void;
  /**
   * Create a new HiddenLineProcessor
   */
  constructor();
  /**
   * Compute visible edges
   * Returns flat array: [x1, y1, x2, y2, type, x1, y1, x2, y2, type, ...]
   * where type is 0=silhouette, 1=crease, 2=hatch
   */
  compute(): Float32Array;
}

/**
 * Batch segment-segment intersection for array of segments
 * Input: segments as flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
 * Returns: intersection points [x, y, seg_idx_a, seg_idx_b, ...]
 */
export function batch_segment_intersections(segments: Float64Array): Float64Array;

/**
 * Closest point on segment to a given point
 * Returns [x, y] of closest point
 */
export function closest_point_on_segment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Float64Array;

/**
 * Deduplicate segments - removes exact duplicates (including reversed)
 * Input: flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
 * Returns: deduplicated segments in same format
 */
export function dedupe_segments(segments: Float64Array): Float64Array;

/**
 * Quick difference of two polygons (a - b).
 */
export function difference_polygons(poly_a: Float64Array, poly_b: Float64Array): Float64Array;

/**
 * Distance between two points
 */
export function distance_between(x1: number, y1: number, x2: number, y2: number): number;

/**
 * Distance from point to segment
 */
export function distance_point_segment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number;

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init(): void;

/**
 * Merge colinear overlapping segments
 * Input: flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: merged segments
 */
export function merge_colinear_segments(segments: Float64Array): Float64Array;

/**
 * Combined optimization: dedupe, merge colinear, trim small
 */
export function optimize_segments(segments: Float64Array, trim_small: boolean, small_dist: number, merge_colinear: boolean): Float64Array;

/**
 * Point in triangle test using barycentric coordinates
 * Returns true if point (px, py) is inside triangle (ax,ay)-(bx,by)-(cx,cy)
 */
export function point_in_triangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean;

/**
 * Compute polygon area (signed - positive = clockwise)
 * Points as flat array: [x1, y1, x2, y2, ...]
 */
export function polygon_area(points: Float64Array): number;

/**
 * Check if polygon is clockwise (area > 0)
 */
export function polygon_is_clockwise(points: Float64Array): boolean;

/**
 * Segment-segment intersection test
 * Returns intersection point [x, y, t1, t2] or empty if no intersection
 * t1 and t2 are parametric positions on each segment (0-1)
 */
export function segment_intersect(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number): Float64Array;

/**
 * Slice a batch of triangles with a plane normal
 * Input triangles: [v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, ...] (9 floats per triangle)
 * Normal: [nx, ny, nz]
 * Returns: intersection segments [ax, ay, az, bx, by, bz, face_idx, ...] (7 floats per segment)
 */
export function slice_triangles(triangles: Float64Array, normal: Float64Array, spacing: number, offset: number): Float64Array;

/**
 * Split edges at all intersection points
 * Input: segments as flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: split segments in same format, plus T-junction flags
 */
export function split_edges_at_intersections(segments: Float64Array): Float64Array;

/**
 * Test edge visibility using point-in-triangle + depth comparison
 * Edges: [ax, ay, ax3d_depth, bx, by, bx3d_depth, ...] (6 floats per edge)
 * Faces: [ax, ay, a_depth, bx, by, b_depth, cx, cy, c_depth, mesh_id, face_id, ...] (11 floats per face)
 * Returns: indices of visible edges
 */
export function test_occlusion_math(edges: Float64Array, faces: Float64Array, edge_mesh_face: Float64Array): Float64Array;

/**
 * Trim small segments - removes segments shorter than threshold
 * Input: flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: filtered segments
 */
export function trim_small_segments(segments: Float64Array, min_length: number): Float64Array;

/**
 * Quick union of two polygons.
 * Both inputs are flat arrays: [x1, y1, x2, y2, ...]
 * Returns segments as flat array
 */
export function union_polygons(poly_a: Float64Array, poly_b: Float64Array): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_booleanprocessor_free: (a: number, b: number) => void;
  readonly __wbg_hiddenlineprocessor_free: (a: number, b: number) => void;
  readonly batch_segment_intersections: (a: number, b: number) => [number, number];
  readonly booleanprocessor_add_clip: (a: number, b: number, c: number) => void;
  readonly booleanprocessor_add_subject: (a: number, b: number, c: number) => void;
  readonly booleanprocessor_clear: (a: number) => void;
  readonly booleanprocessor_clip_count: (a: number) => number;
  readonly booleanprocessor_compute_difference: (a: number) => [number, number];
  readonly booleanprocessor_compute_union: (a: number) => [number, number];
  readonly booleanprocessor_new: () => number;
  readonly booleanprocessor_subject_count: (a: number) => number;
  readonly closest_point_on_segment: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly dedupe_segments: (a: number, b: number) => [number, number];
  readonly difference_polygons: (a: number, b: number, c: number, d: number) => [number, number];
  readonly distance_between: (a: number, b: number, c: number, d: number) => number;
  readonly distance_point_segment: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly hiddenlineprocessor_compute: (a: number) => [number, number];
  readonly hiddenlineprocessor_new: () => number;
  readonly hiddenlineprocessor_set_camera: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly hiddenlineprocessor_set_crease_threshold: (a: number, b: number) => void;
  readonly hiddenlineprocessor_set_geometry: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly merge_colinear_segments: (a: number, b: number) => [number, number];
  readonly optimize_segments: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly point_in_triangle: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly polygon_area: (a: number, b: number) => number;
  readonly polygon_is_clockwise: (a: number, b: number) => number;
  readonly segment_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
  readonly slice_triangles: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly split_edges_at_intersections: (a: number, b: number) => [number, number];
  readonly test_occlusion_math: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly trim_small_segments: (a: number, b: number, c: number) => [number, number];
  readonly union_polygons: (a: number, b: number, c: number, d: number) => [number, number];
  readonly init: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

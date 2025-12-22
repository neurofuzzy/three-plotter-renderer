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

/**
 * Quick difference of two polygons (a - b).
 */
export function difference_polygons(poly_a: Float64Array, poly_b: Float64Array): Float64Array;

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init(): void;

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
  readonly booleanprocessor_add_clip: (a: number, b: number, c: number) => void;
  readonly booleanprocessor_add_subject: (a: number, b: number, c: number) => void;
  readonly booleanprocessor_clear: (a: number) => void;
  readonly booleanprocessor_clip_count: (a: number) => number;
  readonly booleanprocessor_compute_difference: (a: number) => [number, number];
  readonly booleanprocessor_compute_union: (a: number) => [number, number];
  readonly booleanprocessor_new: () => number;
  readonly booleanprocessor_subject_count: (a: number) => number;
  readonly difference_polygons: (a: number, b: number, c: number, d: number) => [number, number];
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

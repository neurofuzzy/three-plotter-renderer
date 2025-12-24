let wasm;

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const BooleanProcessorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_booleanprocessor_free(ptr >>> 0, 1));

const HiddenLineProcessorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_hiddenlineprocessor_free(ptr >>> 0, 1));

/**
 * A processor for boolean operations on polygons.
 * Accumulates shapes and computes boolean results.
 */
export class BooleanProcessor {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BooleanProcessorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_booleanprocessor_free(ptr, 0);
    }
    /**
     * Get count of clip shapes
     * @returns {number}
     */
    clip_count() {
        const ret = wasm.booleanprocessor_clip_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Add a polygon as subject (for union base).
     * Points should be a flat array: [x1, y1, x2, y2, ...]
     * @param {Float64Array} points
     */
    add_subject(points) {
        const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.booleanprocessor_add_subject(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Compute union of all shapes and return as segments.
     * Returns a flat array: [x1, y1, x2, y2, ...] per segment (4 values each)
     * @returns {Float64Array}
     */
    compute_union() {
        const ret = wasm.booleanprocessor_compute_union(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Get count of subject shapes
     * @returns {number}
     */
    subject_count() {
        const ret = wasm.booleanprocessor_subject_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Compute difference (subjects - clips) and return as segments.
     * @returns {Float64Array}
     */
    compute_difference() {
        const ret = wasm.booleanprocessor_compute_difference(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Create a new BooleanProcessor
     */
    constructor() {
        const ret = wasm.booleanprocessor_new();
        this.__wbg_ptr = ret >>> 0;
        BooleanProcessorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Clear all shapes
     */
    clear() {
        wasm.booleanprocessor_clear(this.__wbg_ptr);
    }
    /**
     * Add a polygon as clip (to union with or subtract from subject).
     * Points should be a flat array: [x1, y1, x2, y2, ...]
     * @param {Float64Array} points
     */
    add_clip(points) {
        const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.booleanprocessor_add_clip(this.__wbg_ptr, ptr0, len0);
    }
}
if (Symbol.dispose) BooleanProcessor.prototype[Symbol.dispose] = BooleanProcessor.prototype.free;

/**
 * A processor for hidden line removal.
 * Receives mesh geometry and camera, computes visible edges entirely in WASM.
 */
export class HiddenLineProcessor {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HiddenLineProcessorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_hiddenlineprocessor_free(ptr, 0);
    }
    /**
     * Set camera view-projection matrix, position, and viewport
     * @param {Float32Array} view_proj
     * @param {Float32Array} camera_pos
     * @param {number} width
     * @param {number} height
     */
    set_camera(view_proj, camera_pos, width, height) {
        const ptr0 = passArrayF32ToWasm0(view_proj, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(camera_pos, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.hiddenlineprocessor_set_camera(this.__wbg_ptr, ptr0, len0, ptr1, len1, width, height);
    }
    /**
     * Set geometry from flat arrays
     * vertices: [x,y,z, x,y,z, ...] in world space
     * indices: [i0,i1,i2, ...] triangle indices
     * mesh_ranges: [start0, count0, start1, count1, ...] per-mesh index ranges
     * @param {Float32Array} vertices
     * @param {Uint32Array} indices
     * @param {Uint32Array} mesh_ranges
     */
    set_geometry(vertices, indices, mesh_ranges) {
        const ptr0 = passArrayF32ToWasm0(vertices, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(indices, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray32ToWasm0(mesh_ranges, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        wasm.hiddenlineprocessor_set_geometry(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    }
    /**
     * Configure hatch generation
     * normal: [nx, ny, nz] - direction of slicing planes
     * spacing: distance between hatch lines (world units)
     * @param {Float32Array} normal
     * @param {number} spacing
     */
    set_hatch_config(normal, spacing) {
        const ptr0 = passArrayF32ToWasm0(normal, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.hiddenlineprocessor_set_hatch_config(this.__wbg_ptr, ptr0, len0, spacing);
    }
    /**
     * Set crease angle threshold (as cosine, 0.0 = 90°, 1.0 = 0°)
     * @param {number} threshold
     */
    set_crease_threshold(threshold) {
        wasm.hiddenlineprocessor_set_crease_threshold(this.__wbg_ptr, threshold);
    }
    /**
     * Create a new HiddenLineProcessor
     */
    constructor() {
        const ret = wasm.hiddenlineprocessor_new();
        this.__wbg_ptr = ret >>> 0;
        HiddenLineProcessorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Compute visible edges
     * Returns flat array: [x1, y1, x2, y2, type, x1, y1, x2, y2, type, ...]
     * where type is 0=silhouette, 1=crease, 2=hatch
     * @returns {Float32Array}
     */
    compute() {
        const ret = wasm.hiddenlineprocessor_compute(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) HiddenLineProcessor.prototype[Symbol.dispose] = HiddenLineProcessor.prototype.free;

/**
 * Batch segment-segment intersection for array of segments
 * Input: segments as flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
 * Returns: intersection points [x, y, seg_idx_a, seg_idx_b, ...]
 * @param {Float64Array} segments
 * @returns {Float64Array}
 */
export function batch_segment_intersections(segments) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.batch_segment_intersections(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Closest point on segment to a given point
 * Returns [x, y] of closest point
 * @param {number} px
 * @param {number} py
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {Float64Array}
 */
export function closest_point_on_segment(px, py, ax, ay, bx, by) {
    const ret = wasm.closest_point_on_segment(px, py, ax, ay, bx, by);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Deduplicate segments - removes exact duplicates (including reversed)
 * Input: flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
 * Returns: deduplicated segments in same format
 * @param {Float64Array} segments
 * @returns {Float64Array}
 */
export function dedupe_segments(segments) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.dedupe_segments(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Quick difference of two polygons (a - b).
 * @param {Float64Array} poly_a
 * @param {Float64Array} poly_b
 * @returns {Float64Array}
 */
export function difference_polygons(poly_a, poly_b) {
    const ptr0 = passArrayF64ToWasm0(poly_a, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(poly_b, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.difference_polygons(ptr0, len0, ptr1, len1);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

/**
 * Distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function distance_between(x1, y1, x2, y2) {
    const ret = wasm.distance_between(x1, y1, x2, y2);
    return ret;
}

/**
 * Distance from point to segment
 * @param {number} px
 * @param {number} py
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
export function distance_point_segment(px, py, ax, ay, bx, by) {
    const ret = wasm.distance_point_segment(px, py, ax, ay, bx, by);
    return ret;
}

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init() {
    wasm.init();
}

/**
 * Merge colinear overlapping segments
 * Input: flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: merged segments
 * @param {Float64Array} segments
 * @returns {Float64Array}
 */
export function merge_colinear_segments(segments) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.merge_colinear_segments(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Combined optimization: dedupe, merge colinear, trim small
 * @param {Float64Array} segments
 * @param {boolean} trim_small
 * @param {number} small_dist
 * @param {boolean} merge_colinear
 * @returns {Float64Array}
 */
export function optimize_segments(segments, trim_small, small_dist, merge_colinear) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.optimize_segments(ptr0, len0, trim_small, small_dist, merge_colinear);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Point in triangle test using barycentric coordinates
 * Returns true if point (px, py) is inside triangle (ax,ay)-(bx,by)-(cx,cy)
 * @param {number} px
 * @param {number} py
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 * @returns {boolean}
 */
export function point_in_triangle(px, py, ax, ay, bx, by, cx, cy) {
    const ret = wasm.point_in_triangle(px, py, ax, ay, bx, by, cx, cy);
    return ret !== 0;
}

/**
 * Compute polygon area (signed - positive = clockwise)
 * Points as flat array: [x1, y1, x2, y2, ...]
 * @param {Float64Array} points
 * @returns {number}
 */
export function polygon_area(points) {
    const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.polygon_area(ptr0, len0);
    return ret;
}

/**
 * Check if polygon is clockwise (area > 0)
 * @param {Float64Array} points
 * @returns {boolean}
 */
export function polygon_is_clockwise(points) {
    const ptr0 = passArrayF64ToWasm0(points, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.polygon_is_clockwise(ptr0, len0);
    return ret !== 0;
}

/**
 * Segment-segment intersection test
 * Returns intersection point [x, y, t1, t2] or empty if no intersection
 * t1 and t2 are parametric positions on each segment (0-1)
 * @param {number} ax1
 * @param {number} ay1
 * @param {number} ax2
 * @param {number} ay2
 * @param {number} bx1
 * @param {number} by1
 * @param {number} bx2
 * @param {number} by2
 * @returns {Float64Array}
 */
export function segment_intersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const ret = wasm.segment_intersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Slice a batch of triangles with a plane normal
 * Input triangles: [v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, ...] (9 floats per triangle)
 * Normal: [nx, ny, nz]
 * Returns: intersection segments [ax, ay, az, bx, by, bz, face_idx, ...] (7 floats per segment)
 * @param {Float64Array} triangles
 * @param {Float64Array} normal
 * @param {number} spacing
 * @param {number} offset
 * @returns {Float64Array}
 */
export function slice_triangles(triangles, normal, spacing, offset) {
    const ptr0 = passArrayF64ToWasm0(triangles, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(normal, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.slice_triangles(ptr0, len0, ptr1, len1, spacing, offset);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

/**
 * Split edges at all intersection points
 * Input: segments as flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: split segments in same format, plus T-junction flags
 * @param {Float64Array} segments
 * @returns {Float64Array}
 */
export function split_edges_at_intersections(segments) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.split_edges_at_intersections(ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Test edge visibility using point-in-triangle + depth comparison
 * Edges: [ax, ay, ax3d_depth, bx, by, bx3d_depth, ...] (6 floats per edge)
 * Faces: [ax, ay, a_depth, bx, by, b_depth, cx, cy, c_depth, mesh_id, face_id, ...] (11 floats per face)
 * Returns: indices of visible edges
 * @param {Float64Array} edges
 * @param {Float64Array} faces
 * @param {Float64Array} edge_mesh_face
 * @returns {Float64Array}
 */
export function test_occlusion_math(edges, faces, edge_mesh_face) {
    const ptr0 = passArrayF64ToWasm0(edges, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(faces, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(edge_mesh_face, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.test_occlusion_math(ptr0, len0, ptr1, len1, ptr2, len2);
    var v4 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v4;
}

/**
 * Trim small segments - removes segments shorter than threshold
 * Input: flat array [ax1, ay1, ax2, ay2, ...]
 * Returns: filtered segments
 * @param {Float64Array} segments
 * @param {number} min_length
 * @returns {Float64Array}
 */
export function trim_small_segments(segments, min_length) {
    const ptr0 = passArrayF64ToWasm0(segments, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.trim_small_segments(ptr0, len0, min_length);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Quick union of two polygons.
 * Both inputs are flat arrays: [x1, y1, x2, y2, ...]
 * Returns segments as flat array
 * @param {Float64Array} poly_a
 * @param {Float64Array} poly_b
 * @returns {Float64Array}
 */
export function union_polygons(poly_a, poly_b) {
    const ptr0 = passArrayF64ToWasm0(poly_a, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(poly_b, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.union_polygons(ptr0, len0, ptr1, len1);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_log_1d990106d99dacb7 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('geometry_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;

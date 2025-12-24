// @ts-check
/**
 * WASM geometry module wrapper
 * Provides boolean operations using the geometry-wasm Rust module
 */

// Track WASM initialization state
let wasmModule = null;
let wasmReady = false;
let wasmError = null;

/**
 * Initialize the WASM module
 * @returns {Promise<boolean>} True if WASM loaded successfully
 */
export async function initWasm() {
    if (wasmReady) return true;
    if (wasmError) return false;

    try {
        // Dynamic import for the WASM package
        const wasm = await import('./wasm-pkg/geometry_wasm.js');
        await wasm.default();
        wasmModule = wasm;
        wasmReady = true;
        console.log('[geometry-wasm] WASM module loaded successfully');
        return true;
    } catch (err) {
        wasmError = err;
        console.warn('[geometry-wasm] Failed to load WASM, falling back to JS:', err);
        return false;
    }
}

/**
 * Check if WASM is ready
 * @returns {boolean}
 */
export function isWasmReady() {
    return wasmReady;
}

/**
 * Create a new BooleanProcessor
 * @returns {import('./wasm-pkg/geometry_wasm').BooleanProcessor | null}
 */
export function createBooleanProcessor() {
    if (!wasmReady || !wasmModule) return null;
    return new wasmModule.BooleanProcessor();
}

/**
 * Quick union of two polygons
 * @param {number[]} polyA - Flat array [x1, y1, x2, y2, ...]
 * @param {number[]} polyB - Flat array [x1, y1, x2, y2, ...]
 * @returns {number[]} Segments [x1, y1, x2, y2, ...] per segment
 */
export function unionPolygons(polyA, polyB) {
    if (!wasmReady || !wasmModule) return [];
    return Array.from(wasmModule.union_polygons(new Float64Array(polyA), new Float64Array(polyB)));
}

/**
 * Quick difference of two polygons (a - b)
 * @param {number[]} polyA - Flat array [x1, y1, x2, y2, ...]
 * @param {number[]} polyB - Flat array [x1, y1, x2, y2, ...]
 * @returns {number[]} Segments [x1, y1, x2, y2, ...] per segment
 */
export function differencePolygons(polyA, polyB) {
    if (!wasmReady || !wasmModule) return [];
    return Array.from(wasmModule.difference_polygons(new Float64Array(polyA), new Float64Array(polyB)));
}

// ============ Geometry Functions ============

/**
 * Segment-segment intersection
 * @param {number} ax1 - Segment A start X
 * @param {number} ay1 - Segment A start Y
 * @param {number} ax2 - Segment A end X
 * @param {number} ay2 - Segment A end Y
 * @param {number} bx1 - Segment B start X
 * @param {number} by1 - Segment B start Y
 * @param {number} bx2 - Segment B end X
 * @param {number} by2 - Segment B end Y
 * @returns {number[]|null} [x, y, t1, t2] or null if no intersection
 */
export function segmentIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    if (!wasmReady || !wasmModule) return null;
    const result = wasmModule.segment_intersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
    return result.length === 4 ? Array.from(result) : null;
}

/**
 * Point-in-triangle test
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} ax - Triangle vertex A X
 * @param {number} ay - Triangle vertex A Y
 * @param {number} bx - Triangle vertex B X
 * @param {number} by - Triangle vertex B Y
 * @param {number} cx - Triangle vertex C X
 * @param {number} cy - Triangle vertex C Y
 * @returns {boolean}
 */
export function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    if (!wasmReady || !wasmModule) return false;
    return wasmModule.point_in_triangle(px, py, ax, ay, bx, by, cx, cy);
}

/**
 * Distance between two points
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function distanceBetween(x1, y1, x2, y2) {
    if (!wasmReady || !wasmModule) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    return wasmModule.distance_between(x1, y1, x2, y2);
}

/**
 * Closest point on segment to a point
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} ax - Segment start X
 * @param {number} ay - Segment start Y
 * @param {number} bx - Segment end X
 * @param {number} by - Segment end Y
 * @returns {number[]} [x, y] of closest point
 */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
    if (!wasmReady || !wasmModule) return [ax, ay]; // fallback
    return Array.from(wasmModule.closest_point_on_segment(px, py, ax, ay, bx, by));
}

/**
 * Distance from point to segment
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} ax - Segment start X
 * @param {number} ay - Segment start Y
 * @param {number} bx - Segment end X
 * @param {number} by - Segment end Y
 * @returns {number}
 */
export function distancePointSegment(px, py, ax, ay, bx, by) {
    if (!wasmReady || !wasmModule) return Infinity;
    return wasmModule.distance_point_segment(px, py, ax, ay, bx, by);
}

/**
 * Compute polygon area (signed)
 * @param {number[]} points - Flat array [x1, y1, x2, y2, ...]
 * @returns {number} Signed area (positive = clockwise)
 */
export function polygonArea(points) {
    if (!wasmReady || !wasmModule) return 0;
    return wasmModule.polygon_area(new Float64Array(points));
}

/**
 * Check if polygon is clockwise
 * @param {number[]} points - Flat array [x1, y1, x2, y2, ...]
 * @returns {boolean}
 */
export function polygonIsClockwise(points) {
    if (!wasmReady || !wasmModule) return false;
    return wasmModule.polygon_is_clockwise(new Float64Array(points));
}

/**
 * Batch segment-segment intersection test
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...] (4 floats per segment)
 * @returns {number[]} Intersections [x, y, segIdxA, segIdxB, ...]
 */
export function batchSegmentIntersections(segments) {
    if (!wasmReady || !wasmModule) return [];
    return Array.from(wasmModule.batch_segment_intersections(new Float64Array(segments)));
}

// ============ Segment Optimization ============

/**
 * Deduplicate segments - removes exact duplicates (including reversed)
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...]
 * @returns {number[]} Deduplicated segments
 */
export function dedupeSegments(segments) {
    if (!wasmReady || !wasmModule) return segments;
    return Array.from(wasmModule.dedupe_segments(new Float64Array(segments)));
}

/**
 * Trim small segments - removes segments shorter than threshold
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...]
 * @param {number} minLength - Minimum segment length
 * @returns {number[]} Filtered segments
 */
export function trimSmallSegments(segments, minLength) {
    if (!wasmReady || !wasmModule) return segments;
    return Array.from(wasmModule.trim_small_segments(new Float64Array(segments), minLength));
}

/**
 * Merge colinear overlapping segments
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...]
 * @returns {number[]} Merged segments
 */
export function mergeColinearSegments(segments) {
    if (!wasmReady || !wasmModule) return segments;
    return Array.from(wasmModule.merge_colinear_segments(new Float64Array(segments)));
}

/**
 * Combined segment optimization: dedupe, merge colinear, trim small
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...]
 * @param {boolean} trimSmall - Whether to remove small segments
 * @param {number} smallDist - Minimum segment length
 * @param {boolean} mergeColinear - Whether to merge colinear segments
 * @returns {number[]} Optimized segments
 */
export function optimizeSegments(segments, trimSmall = true, smallDist = 1, mergeColinear = true) {
    if (!wasmReady || !wasmModule) return segments;
    return Array.from(wasmModule.optimize_segments(new Float64Array(segments), trimSmall, smallDist, mergeColinear));
}

// ============ Hidden Line Processing ============

/**
 * Split edges at all intersection points (including T-junctions)
 * @param {number[]} segments - Flat array [ax1, ay1, ax2, ay2, ...]
 * @returns {number[]} Split segments in same format
 */
export function splitEdgesAtIntersections(segments) {
    if (!wasmReady || !wasmModule) return segments;
    return Array.from(wasmModule.split_edges_at_intersections(new Float64Array(segments)));
}

/**
 * Test edge visibility using math-based occlusion (no GPU)
 * @param {number[]} edges - [ax, ay, a_depth, bx, by, b_depth, ...] (6 floats per edge)
 * @param {number[]} faces - [ax, ay, a_depth, bx, by, b_depth, cx, cy, c_depth, mesh_id, face_id, ...] (11 floats per face)
 * @param {number[]} edgeMeshFace - [mesh_id, face_id, ...] per edge (2 floats per edge)
 * @returns {number[]} Indices of visible edges
 */
export function testOcclusionMath(edges, faces, edgeMeshFace) {
    if (!wasmReady || !wasmModule) return [];
    return Array.from(wasmModule.test_occlusion_math(
        new Float64Array(edges),
        new Float64Array(faces),
        new Float64Array(edgeMeshFace)
    ));
}

// ============ Slicer ============

/**
 * Slice triangles with parallel planes to generate hatch lines
 * @param {number[]} triangles - [v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, ...] (9 floats per triangle)
 * @param {number[]} normal - [nx, ny, nz] plane normal
 * @param {number} spacing - Distance between planes
 * @param {number} offset - Offset for plane positions
 * @returns {number[]} Intersection segments [ax, ay, az, bx, by, bz, faceIdx, ...] (7 floats per segment)
 */
export function sliceTriangles(triangles, normal, spacing, offset) {
    if (!wasmReady || !wasmModule) return [];
    return Array.from(wasmModule.slice_triangles(
        new Float64Array(triangles),
        new Float64Array(normal),
        spacing,
        offset
    ));
}

// Auto-initialize WASM on module load
initWasm().catch(() => {
    // Silently fail, fallback to JS implementation
});


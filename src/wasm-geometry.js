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
    return wasmReady && wasmEnabled;
}

// Allow runtime enable/disable of WASM (for debugging/comparison)
let wasmEnabled = true;

/**
 * Enable or disable WASM acceleration
 * @param {boolean} enabled
 */
export function setWasmEnabled(enabled) {
    wasmEnabled = enabled;
    console.log(`[geometry-wasm] WASM ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get current WASM enabled state
 * @returns {boolean}
 */
export function getWasmEnabled() {
    return wasmEnabled;
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

// =============================================================================
// HIDDEN LINE PROCESSOR - Full pipeline in WASM
// =============================================================================

/** @type {any} */
let hiddenLineProcessor = null;

/**
 * Create or get the HiddenLineProcessor singleton
 * @returns {HiddenLineProcessorWrapper | null}
 */
export function createHiddenLineProcessor() {
    if (!wasmReady || !wasmModule) {
        console.warn('[geometry-wasm] WASM not ready for HiddenLineProcessor');
        return null;
    }
    if (!hiddenLineProcessor) {
        hiddenLineProcessor = new wasmModule.HiddenLineProcessor();
    }
    return new HiddenLineProcessorWrapper(hiddenLineProcessor);
}

/**
 * JS wrapper for the WASM HiddenLineProcessor
 */
class HiddenLineProcessorWrapper {
    /** @param {any} wasmProcessor */
    constructor(wasmProcessor) {
        this._processor = wasmProcessor;
    }

    /**
     * Set geometry from Three.js meshes
     * @param {import('three').Mesh[]} meshes
     */
    setMeshes(meshes) {
        const vertices = [];
        const indices = [];
        const meshRanges = [];

        // Map from position key to merged vertex index
        /** @type {Map<string, number>} */
        const positionToIndex = new Map();
        const PRECISION = 1000; // 3 decimal places

        for (const mesh of meshes) {
            mesh.updateMatrixWorld(true);
            const geometry = mesh.geometry;
            const posAttr = geometry.attributes.position;
            const indexAttr = geometry.index;
            if (!posAttr) continue;

            const startIndex = indices.length;
            const matrix = mesh.matrixWorld;

            // Map from original vertex index to merged index
            /** @type {number[]} */
            const localToMerged = [];

            // Extract vertices in world space, merging duplicates
            for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);
                const wx = matrix.elements[0] * x + matrix.elements[4] * y + matrix.elements[8] * z + matrix.elements[12];
                const wy = matrix.elements[1] * x + matrix.elements[5] * y + matrix.elements[9] * z + matrix.elements[13];
                const wz = matrix.elements[2] * x + matrix.elements[6] * y + matrix.elements[10] * z + matrix.elements[14];

                // Create position key for merging
                const key = `${Math.round(wx * PRECISION)},${Math.round(wy * PRECISION)},${Math.round(wz * PRECISION)}`;

                let mergedIndex = positionToIndex.get(key);
                if (mergedIndex === undefined) {
                    mergedIndex = vertices.length / 3;
                    positionToIndex.set(key, mergedIndex);
                    vertices.push(wx, wy, wz);
                }
                localToMerged.push(mergedIndex);
            }

            // Extract indices, remapping to merged vertices
            if (indexAttr) {
                for (let i = 0; i < indexAttr.count; i++) {
                    const originalIdx = indexAttr.getX(i);
                    indices.push(localToMerged[originalIdx]);
                }
            } else {
                for (let i = 0; i < posAttr.count; i++) {
                    indices.push(localToMerged[i]);
                }
            }

            meshRanges.push(startIndex, indices.length - startIndex);
        }

        this._processor.set_geometry(
            new Float32Array(vertices),
            new Uint32Array(indices),
            new Uint32Array(meshRanges)
        );
    }

    /**
     * Set camera for projection
     * @param {import('three').Camera} camera
     * @param {number} width
     * @param {number} height
     */
    setCamera(camera, width, height) {
        camera.updateMatrixWorld(true);
        // @ts-ignore - PerspectiveCamera has updateProjectionMatrix
        if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();

        const v = camera.matrixWorldInverse.elements;
        const p = camera.projectionMatrix.elements;
        const vp = new Float32Array(16);

        // proj * view (column-major)
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                vp[i * 4 + j] = p[j] * v[i * 4] + p[j + 4] * v[i * 4 + 1] + p[j + 8] * v[i * 4 + 2] + p[j + 12] * v[i * 4 + 3];
            }
        }

        // Extract camera world position
        const camPos = new Float32Array([
            camera.matrixWorld.elements[12],
            camera.matrixWorld.elements[13],
            camera.matrixWorld.elements[14]
        ]);

        this._processor.set_camera(vp, camPos, width, height);
    }

    /** @param {number} threshold Cosine of angle (0.7 = ~45°) */
    setCreaseThreshold(threshold) {
        this._processor.set_crease_threshold(threshold);
    }

    /**
     * Configure hatch generation
     * @param {number[]} normal - [nx, ny, nz] slice plane normal
     * @param {number} spacing - Distance between hatch lines (world units)
     */
    setHatchConfig(normal, spacing) {
        this._processor.set_hatch_config(new Float32Array(normal), spacing);
    }

    /**
     * Compute visible edges
     * @returns {{x1: number, y1: number, x2: number, y2: number, type: 'silhouette' | 'crease' | 'hatch'}[]}\n     */
    compute() {
        const result = this._processor.compute();
        const edges = [];
        let silCount = 0, creaseCount = 0, hatchCount = 0;
        for (let i = 0; i < result.length; i += 5) {
            const typeCode = result[i + 4];
            if (typeCode === 0) silCount++;
            else if (typeCode === 2) hatchCount++;
            else creaseCount++;
            edges.push({
                x1: result[i],
                y1: result[i + 1],
                x2: result[i + 2],
                y2: result[i + 3],
                type: typeCode === 0 ? 'silhouette' : (typeCode === 2 ? 'hatch' : 'crease')
            });
        }
        console.log(`[WASM] Edges: ${edges.length} (${silCount} silhouette, ${creaseCount} crease, ${hatchCount} hatch)`);
        return edges;
    }
}

// Auto-initialize WASM on module load
initWasm().catch(() => {
    // Silently fail, fallback to JS implementation
});

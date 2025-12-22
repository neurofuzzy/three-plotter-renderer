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

// Auto-initialize WASM on module load
initWasm().catch(() => {
    // Silently fail, fallback to JS implementation
});

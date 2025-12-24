// @ts-check
/**
 * Edge-Based Hidden Line Renderer
 * 
 * A faster alternative to clipper-based boolean operations.
 * Uses spatial hashing and per-edge occlusion testing.
 * WASM-accelerated when available.
 */

import { Optimize } from './optimize.js';
import {
    isWasmReady,
    splitEdgesAtIntersections as wasmSplitEdges,
    testOcclusionMath as wasmTestOcclusion
} from './wasm-geometry.js';

import {
    Vector3,
    Vector2,
    Raycaster,
    Camera,
    Scene,
    Mesh,
    WebGLRenderTarget,
    NearestFilter,
    RGBAFormat,
    UnsignedByteType,
    MeshDepthMaterial,
    RGBADepthPacking,
    ShaderMaterial,
    BufferAttribute,
    BufferGeometry,
    DoubleSide
} from "three";

/**
 * @typedef {Object} Edge3D
 * @property {Vector3} a - Start point (world space)
 * @property {Vector3} b - End point (world space)
 * @property {Vector3} normal1 - First face normal
 * @property {Vector3} [normal2] - Second face normal (if shared edge)
 * @property {number} faceIdx1 - First face index
 * @property {number} [faceIdx2] - Second face index
 * @property {Mesh} mesh - Parent mesh
 * @property {boolean} [isHatch] - Is this a hatch line?
 */

/**
 * @typedef {Object} Edge2D
 * @property {Vector2} a - Start point (screen space)
 * @property {Vector2} b - End point (screen space)
 * @property {Vector3} a3d - Start point (world space)
 * @property {Vector3} b3d - End point (world space)
 * @property {Vector3} midpoint3d - Midpoint in world space
 * @property {boolean} isProfile - Is this a silhouette edge?
 * @property {boolean} visible - Is this edge visible?
 * @property {number} faceIdx - Parent face index
 * @property {Mesh} mesh - Parent mesh
 * @property {boolean} [isHatch] - Is this a hatch line?
 * @property {boolean} [isSilhouette] - Is this a silhouette edge (borders void)?
 */

/**
 * Extract edges from a mesh with face normal information
 * Only extracts edges from front-facing faces (skips back-facing)
 * @param {Mesh} mesh 
 * @param {Vector3} cameraPosition - Camera position for face culling
 * @returns {Edge3D[]}
 */
export function extractEdges(mesh, cameraPosition) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;

    if (!position) return [];

    /** @type {Map<string, Edge3D>} */
    const edgeMap = new Map();

    // Snap tolerance for position-based edge matching
    const SNAP = 1000; // Precision: 3 decimal places

    // Position-based edge key (not index-based, handles duplicate vertices)
    const getEdgeKey = (va, vb) => {
        const ax = Math.round(va.x * SNAP);
        const ay = Math.round(va.y * SNAP);
        const az = Math.round(va.z * SNAP);
        const bx = Math.round(vb.x * SNAP);
        const by = Math.round(vb.y * SNAP);
        const bz = Math.round(vb.z * SNAP);

        const keyA = `${ax},${ay},${az}`;
        const keyB = `${bx},${by},${bz}`;

        // Consistent ordering for undirected edges
        return keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
    };

    const getVertex = (idx) => {
        const v = new Vector3(
            position.getX(idx),
            position.getY(idx),
            position.getZ(idx)
        );
        return v.applyMatrix4(mesh.matrixWorld);
    };

    const getFaceNormal = (v0, v1, v2) => {
        const edge1 = new Vector3().subVectors(v1, v0);
        const edge2 = new Vector3().subVectors(v2, v0);
        return new Vector3().crossVectors(edge1, edge2).normalize();
    };

    const numFaces = index ? index.count / 3 : position.count / 3;

    for (let f = 0; f < numFaces; f++) {
        let i0, i1, i2;

        if (index) {
            i0 = index.getX(f * 3);
            i1 = index.getX(f * 3 + 1);
            i2 = index.getX(f * 3 + 2);
        } else {
            i0 = f * 3;
            i1 = f * 3 + 1;
            i2 = f * 3 + 2;
        }

        const v0 = getVertex(i0);
        const v1 = getVertex(i1);
        const v2 = getVertex(i2);
        const normal = getFaceNormal(v0, v1, v2);

        // Skip back-facing faces - only extract edges from front-facing faces
        const faceMid = new Vector3().addVectors(v0, v1).add(v2).divideScalar(3);
        const viewDir = new Vector3().subVectors(cameraPosition, faceMid);
        if (normal.dot(viewDir) <= 0) {
            continue; // Skip back-facing face
        }

        // Process three edges of the triangle
        const edges = [
            [v0, v1],
            [v1, v2],
            [v2, v0]
        ];

        for (const [va, vb] of edges) {
            const key = getEdgeKey(va, vb);

            if (edgeMap.has(key)) {
                // Edge already exists - add second face normal
                const existing = edgeMap.get(key);
                if (existing && !existing.normal2) {
                    existing.normal2 = normal.clone();
                    existing.faceIdx2 = f;
                }
            } else {
                edgeMap.set(key, {
                    a: va.clone(),
                    b: vb.clone(),
                    normal1: normal.clone(),
                    faceIdx1: f,
                    mesh
                });
            }
        }
    }

    return Array.from(edgeMap.values());
}

/**
 * Filter edges: remove those where both faces are back-facing
 * @param {Edge3D[]} edges 
 * @param {Vector3} cameraPosition 
 * @returns {Edge3D[]}
 */
export function filterBackfacing(edges, cameraPosition) {
    return edges.filter(edge => {
        const edgeMidpoint = new Vector3().addVectors(edge.a, edge.b).multiplyScalar(0.5);
        const viewDir = new Vector3().subVectors(cameraPosition, edgeMidpoint).normalize();

        const facing1 = edge.normal1.dot(viewDir) > 0;

        // Boundary edges (only one face) are always kept - they're silhouettes
        if (!edge.normal2) {
            return true;
        }

        const facing2 = edge.normal2.dot(viewDir) > 0;

        // Keep edge if at least one face is front-facing
        return facing1 || facing2;
    });
}

/**
 * Detect profile (silhouette) edges and mark smooth edges for removal
 * @param {Edge3D[]} edges 
 * @param {Vector3} cameraPosition 
 * @param {number} smoothThreshold - Dot product threshold for similar normals (default 0.99)
 * @returns {{profiles: Edge3D[], smoothFiltered: Edge3D[]}}
 */
export function classifyEdges(edges, cameraPosition, smoothThreshold = 0.99) {
    const profiles = [];
    const smoothFiltered = [];

    // Debug counters
    let boundaryCount = 0;
    let profileCount = 0;
    let smoothCount = 0;
    let discardedCount = 0;

    for (const edge of edges) {
        const edgeMidpoint = new Vector3().addVectors(edge.a, edge.b).multiplyScalar(0.5);
        const viewDir = new Vector3().subVectors(cameraPosition, edgeMidpoint).normalize();

        const facing1 = edge.normal1.dot(viewDir) > 0;
        const facing2 = edge.normal2 ? edge.normal2.dot(viewDir) > 0 : true; // Boundary edges count as profile

        // Profile edge: one face front, one face back (or boundary)
        if (facing1 !== facing2 || !edge.normal2) {
            profiles.push(edge);
            continue;
        }

        // Check if normals are similar (smooth shading edge)
        if (edge.normal2) {
            const similarity = edge.normal1.dot(edge.normal2);
            // Keep edge only if normals are different enough (crease/hard edge)
            // Filter out smooth edges where normals are nearly parallel
            if (similarity < smoothThreshold) {
                smoothFiltered.push(edge);
            }
            // Edges with similar normals (similarity >= threshold) are discarded as smooth surface edges
        }
    }

    console.log(`classifyEdges: ${profiles.length} profiles, ${smoothFiltered.length} smooth/crease edges`);

    return { profiles, smoothFiltered };
}

/**
 * Project 3D edges to screen space
 * @param {Edge3D[]} edges 
 * @param {Camera} camera 
 * @param {number} width 
 * @param {number} height 
 * @param {number} scale - Internal scale factor for precision (default 1)
 * @returns {Edge2D[]}
 */
export function projectEdges(edges, camera, width, height, scale = 1) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const projectPoint = (p3d) => {
        const projected = p3d.clone().project(camera);
        return new Vector2(
            projected.x * halfWidth * scale,
            -projected.y * halfHeight * scale
        );
    };

    return edges.map(edge => ({
        a: projectPoint(edge.a),
        b: projectPoint(edge.b),
        a3d: edge.a.clone(),
        b3d: edge.b.clone(),
        midpoint3d: new Vector3().addVectors(edge.a, edge.b).multiplyScalar(0.5),
        isProfile: false, // Will be set by classifyEdges
        visible: true,
        faceIdx: edge.faceIdx1,
        faceIdx2: edge.faceIdx2,
        mesh: edge.mesh,
        isHatch: edge.isHatch,
        normal1: edge.normal1,  // Propagate normals for straggler detection
        normal2: edge.normal2
    }));
}

/**
 * Spatial hash for efficient edge queries
 */
export class SpatialHash {
    /**
     * @param {number} cellSize 
     */
    constructor(cellSize) {
        this.cellSize = cellSize;
        /** @type {Map<string, Edge2D[]>} */
        this.cells = new Map();
    }

    /**
     * Get cell key for a point
     * @param {number} x 
     * @param {number} y 
     * @returns {string}
     */
    getCellKey(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    /**
     * Get all cells an edge crosses
     * @param {Edge2D} edge 
     * @returns {string[]}
     */
    getCellsCrossed(edge) {
        const cells = new Set();

        // Use line rasterization to find all cells
        const dx = Math.abs(edge.b.x - edge.a.x);
        const dy = Math.abs(edge.b.y - edge.a.y);
        const steps = Math.max(dx, dy) / this.cellSize + 1;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = edge.a.x + t * (edge.b.x - edge.a.x);
            const y = edge.a.y + t * (edge.b.y - edge.a.y);
            cells.add(this.getCellKey(x, y));
        }

        return Array.from(cells);
    }

    /**
     * Insert an edge into the spatial hash
     * @param {Edge2D} edge 
     */
    insert(edge) {
        const cells = this.getCellsCrossed(edge);
        for (const key of cells) {
            if (!this.cells.has(key)) {
                this.cells.set(key, []);
            }
            this.cells.get(key).push(edge);
        }
    }

    /**
     * Get all edges in a cell
     * @param {string} key 
     * @returns {Edge2D[]}
     */
    query(key) {
        return this.cells.get(key) || [];
    }

    /**
     * Get all cell keys
     * @returns {string[]}
     */
    getAllCells() {
        return Array.from(this.cells.keys());
    }

    clear() {
        this.cells.clear();
    }
}

/**
 * Find intersection point of two 2D line segments
 * @param {Edge2D} e1 
 * @param {Edge2D} e2 
 * @returns {{t1: number, t2: number, point: Vector2} | null}
 */
export function findIntersection(e1, e2) {
    const x1 = e1.a.x, y1 = e1.a.y;
    const x2 = e1.b.x, y2 = e1.b.y;
    const x3 = e2.a.x, y3 = e2.a.y;
    const x4 = e2.b.x, y4 = e2.b.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Parallel

    const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    const eps = 0.001;
    // Check if intersection is within both segments (excluding endpoints)
    if (t1 > eps && t1 < 1 - eps && t2 > eps && t2 < 1 - eps) {
        return {
            t1,
            t2,
            point: new Vector2(
                x1 + t1 * (x2 - x1),
                y1 + t1 * (y2 - y1)
            )
        };
    }

    return null;
}

/**
 * Split edges at intersection points within a cell
 * @param {Edge2D[]} edges 
 * @returns {Edge2D[]}
 */
export function splitAtIntersections(edges) {
    /** @type {Map<Edge2D, {t: number, point: Vector2}[]>} */
    const splits = new Map();

    const eps = 0.01;

    // Helper: check if point p lies on edge interior (not endpoints)
    // Returns t parameter (0,1) if on edge, null otherwise
    const pointOnEdgeInterior = (p, edge) => {
        const dx = edge.b.x - edge.a.x;
        const dy = edge.b.y - edge.a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-10) return null; // Degenerate edge

        // Project p onto edge line
        const t = ((p.x - edge.a.x) * dx + (p.y - edge.a.y) * dy) / lenSq;

        // Check if t is in interior (not at endpoints)
        if (t <= eps || t >= 1 - eps) return null;

        // Check distance from point to projected point on line
        const projX = edge.a.x + t * dx;
        const projY = edge.a.y + t * dy;
        const distSq = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);

        // Tolerance for "on the edge"
        if (distSq < 1.0) { // 1 pixel tolerance
            return t;
        }
        return null;
    };

    // Track edges that might be stragglers (their endpoint caused a T-junction)
    const potentialStragglers = new Set();

    // Find all intersections (crossing + T-junctions)
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            // Check for crossing intersection
            const intersection = findIntersection(edges[i], edges[j]);
            if (intersection) {
                // Record split points for both edges
                if (!splits.has(edges[i])) splits.set(edges[i], []);
                if (!splits.has(edges[j])) splits.set(edges[j], []);

                splits.get(edges[i]).push({ t: intersection.t1, point: intersection.point });
                splits.get(edges[j]).push({ t: intersection.t2, point: intersection.point });
            } else {
                // Check for T-junctions: endpoint of one edge on interior of other
                // Mark BOTH edges as potential stragglers

                // Edge i's endpoints on edge j
                const tAonJ = pointOnEdgeInterior(edges[i].a, edges[j]);
                if (tAonJ !== null) {
                    if (!splits.has(edges[j])) splits.set(edges[j], []);
                    splits.get(edges[j]).push({ t: tAonJ, point: edges[i].a.clone() });
                    potentialStragglers.add(edges[i]);
                    potentialStragglers.add(edges[j]);  // Mark BOTH
                }

                const tBonJ = pointOnEdgeInterior(edges[i].b, edges[j]);
                if (tBonJ !== null) {
                    if (!splits.has(edges[j])) splits.set(edges[j], []);
                    splits.get(edges[j]).push({ t: tBonJ, point: edges[i].b.clone() });
                    potentialStragglers.add(edges[i]);
                    potentialStragglers.add(edges[j]);  // Mark BOTH
                }

                // Edge j's endpoints on edge i
                const tAonI = pointOnEdgeInterior(edges[j].a, edges[i]);
                if (tAonI !== null) {
                    if (!splits.has(edges[i])) splits.set(edges[i], []);
                    splits.get(edges[i]).push({ t: tAonI, point: edges[j].a.clone() });
                    potentialStragglers.add(edges[i]);  // Mark BOTH
                    potentialStragglers.add(edges[j]);
                }

                const tBonI = pointOnEdgeInterior(edges[j].b, edges[i]);
                if (tBonI !== null) {
                    if (!splits.has(edges[i])) splits.set(edges[i], []);
                    splits.get(edges[i]).push({ t: tBonI, point: edges[j].b.clone() });
                    potentialStragglers.add(edges[i]);  // Mark BOTH
                    potentialStragglers.add(edges[j]);
                }
            }
        }
    }

    console.log(`T-junction detection: ${potentialStragglers.size} potential straggler edges`);

    // Split edges at recorded points
    const result = [];

    for (const edge of edges) {
        const edgeSplits = splits.get(edge);
        const isStraggler = potentialStragglers.has(edge);

        if (!edgeSplits || edgeSplits.length === 0) {
            // Mark the edge as potential straggler if it was identified
            edge.isTJunctionStraggler = isStraggler;
            result.push(edge);
            continue;
        }

        // Sort splits by t value
        edgeSplits.sort((a, b) => a.t - b.t);

        // Create sub-edges
        let prevT = 0;
        let prevPoint = edge.a;
        let prevPoint3d = edge.a3d;

        for (const split of edgeSplits) {
            const point3d = new Vector3().lerpVectors(edge.a3d, edge.b3d, split.t);

            result.push({
                a: prevPoint.clone(),
                b: split.point.clone(),
                a3d: prevPoint3d.clone(),
                b3d: point3d.clone(),
                midpoint3d: new Vector3().addVectors(prevPoint3d, point3d).multiplyScalar(0.5),
                isProfile: edge.isProfile,
                visible: edge.visible,
                faceIdx: edge.faceIdx,
                mesh: edge.mesh,
                isHatch: edge.isHatch,
                normal1: edge.normal1,  // Propagate normal for smooth filter
                isTJunctionStraggler: isStraggler
            });

            prevT = split.t;
            prevPoint = split.point;
            prevPoint3d = point3d;
        }

        // Final segment
        result.push({
            a: prevPoint.clone(),
            b: edge.b.clone(),
            a3d: prevPoint3d.clone(),
            b3d: edge.b3d.clone(),
            midpoint3d: new Vector3().addVectors(prevPoint3d, edge.b3d).multiplyScalar(0.5),
            isProfile: edge.isProfile,
            visible: edge.visible,
            faceIdx: edge.faceIdx,
            mesh: edge.mesh,
            isHatch: edge.isHatch,
            normal1: edge.normal1,  // Propagate normal for smooth filter
            isTJunctionStraggler: isStraggler
        });
    }

    return result;
}

/**
 * Test edge visibility using GPU depth buffer (fast O(1) per edge)
 * Uses a render target with depth material to read depth as RGBA
 * @param {Edge2D[]} edges 
 * @param {Scene} scene 
 * @param {Camera} camera 
 * @param {number} epsilon - Depth tolerance (normalized 0-1)
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @param {any} renderer - THREE.WebGLRenderer instance
 * @returns {Edge2D[]}
 */
export function testOcclusionDepthBuffer(edges, scene, camera, epsilon, width, height, renderer) {
    const visibleEdges = [];

    if (!renderer) {
        console.warn('No renderer provided, skipping occlusion test');
        return edges;
    }

    // Create render target for depth
    const renderTarget = new WebGLRenderTarget(width, height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        format: RGBAFormat,
        type: UnsignedByteType
    });

    // Create depth material that encodes depth as color
    const depthMaterial = new MeshDepthMaterial({
        depthPacking: RGBADepthPacking
    });

    // Store original material overrides
    const originalOverrideMaterial = scene.overrideMaterial;

    // Render scene with depth material
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);

    // Read the render target as RGBA
    const depthData = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, depthData);

    // Restore scene
    scene.overrideMaterial = originalOverrideMaterial;
    renderer.setRenderTarget(null);

    // Check if we got valid data
    let hasData = false;
    for (let i = 0; i < Math.min(4000, depthData.length); i += 4) {
        if (depthData[i] !== 0 || depthData[i + 1] !== 0 || depthData[i + 2] !== 0) {
            hasData = true;
            break;
        }
    }

    // Debug: sample center of depth buffer
    const centerIdx = Math.floor(height / 2) * width * 4 + Math.floor(width / 2) * 4;
    console.log(`Depth buffer center pixel (RGBA): ${depthData[centerIdx]}, ${depthData[centerIdx + 1]}, ${depthData[centerIdx + 2]}, ${depthData[centerIdx + 3]}`);

    if (!hasData) {
        console.warn('Could not read depth buffer, falling back to all-visible');
        renderTarget.dispose();
        depthMaterial.dispose();
        return edges;
    }

    // Decode depth from RGBA using three.js formula
    // See: https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderChunk/packing.glsl.js
    // UnpackDownscale = 255/256
    // UnpackFactors4 = (UnpackDownscale/1, UnpackDownscale/256, UnpackDownscale/65536, 1/16777216)
    const UnpackDownscale = 255.0 / 256.0;
    const PackFactors = [1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0];
    const UnpackFactors4 = [
        UnpackDownscale / PackFactors[0],  // 0.99609375
        UnpackDownscale / PackFactors[1],  // 0.00389099...
        UnpackDownscale / PackFactors[2],  // 0.0000152...
        1.0 / PackFactors[3]               // 0.0000000059...
    ];

    const unpackDepth = (r, g, b, a) => {
        // Normalize from 0-255 to 0-1
        const rn = r / 255.0;
        const gn = g / 255.0;
        const bn = b / 255.0;
        const an = a / 255.0;
        // dot product with UnpackFactors4
        return rn * UnpackFactors4[0] + gn * UnpackFactors4[1] + bn * UnpackFactors4[2] + an * UnpackFactors4[3];
    };

    // @ts-ignore
    const near = camera.near;
    // @ts-ignore  
    const far = camera.far;

    // Debug: log first few depth comparisons
    let debugCount = 0;

    for (const edge of edges) {
        // Get screen-space coordinates of edge midpoint
        const midX = (edge.a.x + edge.b.x) / 2;
        const midY = (edge.a.y + edge.b.y) / 2;

        const sx = Math.round(midX + width / 2);
        const sy = Math.round(height / 2 + midY); // projectEdges already negates Y

        // Check bounds
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
            edge.visible = true;
            visibleEdges.push(edge);
            continue;
        }

        // Sample depth buffer (note: readRenderTargetPixels returns bottom-up)
        const depthIdx = ((height - 1 - sy) * width + sx) * 4;
        const sampledDepth = unpackDepth(
            depthData[depthIdx],
            depthData[depthIdx + 1],
            depthData[depthIdx + 2],
            depthData[depthIdx + 3]
        );

        // Compute expected depth using view-space Z (linear depth)
        // MeshDepthMaterial stores: (viewZ - near) / (far - near) where viewZ is distance along camera's look direction
        // For perspective cameras, we need to transform the midpoint to view space
        const midpoint3d = edge.midpoint3d;

        // Transform to view space (camera-relative coordinates)
        const viewMatrix = camera.matrixWorldInverse;
        const viewPos = midpoint3d.clone().applyMatrix4(viewMatrix);

        // viewPos.z is negative in front of camera, so we negate it
        const viewZ = -viewPos.z;

        // Convert to 0-1 range matching MeshDepthMaterial
        const expectedDepth = (viewZ - near) / (far - near);

        // Debug logging
        if (debugCount < 10) {
            console.log(`Edge ${debugCount}: sample=${sampledDepth.toFixed(4)}, expected=${expectedDepth.toFixed(4)}, diff=${(sampledDepth - expectedDepth).toFixed(6)}`);
            debugCount++;
        }

        // Compare: edge is visible if sampled depth >= expected depth (within tolerance)
        // sampledDepth is depth of closest surface at this pixel
        // expectedDepth is depth of the edge
        // Edge is visible if it's at or in front of (closer than) the sampled surface
        const isVisible = Math.abs(sampledDepth - expectedDepth) < epsilon || sampledDepth >= expectedDepth - epsilon;

        if (isVisible) {
            edge.visible = true;
            visibleEdges.push(edge);
        }
    }

    // Cleanup
    renderTarget.dispose();
    depthMaterial.dispose();

    return visibleEdges;
}

/**
 * Test edge visibility using face ID buffer (correct occlusion)
 * Renders each face with a unique color = face index
 * Samples at edge midpoint to check if parent face is visible
 * @param {Edge2D[]} edges 
 * @param {Mesh[]} meshes - All meshes in scene
 * @param {Camera} camera 
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @param {any} renderer - THREE.WebGLRenderer instance
 * @param {boolean} isProfile - If true, these are profile edges (always visible)
 * @returns {Edge2D[]}
 */
export function testOcclusionFaceID(edges, meshes, camera, width, height, renderer, isProfile = false) {
    // Profile edges are ALWAYS visible (silhouette edges)
    if (isProfile) {
        edges.forEach(e => e.visible = true);
        return edges;
    }

    const visibleEdges = [];

    if (!renderer) {
        console.warn('No renderer provided, skipping occlusion test');
        return edges;
    }

    // Create render target for face IDs
    const renderTarget = new WebGLRenderTarget(width, height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        format: RGBAFormat,
        type: UnsignedByteType
    });

    // Create face ID shader material
    const faceIdMaterial = new ShaderMaterial({
        vertexShader: `
            attribute vec3 faceColor;
            varying vec3 vFaceColor;
            void main() {
                vFaceColor = faceColor;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vFaceColor;
            void main() {
                gl_FragColor = vec4(vFaceColor, 1.0);
            }
        `,
        side: DoubleSide
    });

    // Build meshes with face ID colors
    const faceIdMeshes = [];
    let globalFaceOffset = 0;

    for (const mesh of meshes) {
        const geom = mesh.geometry;
        const position = geom.attributes.position;
        const index = geom.index;

        const numFaces = index ? index.count / 3 : position.count / 3;

        // Create new geometry with face colors - APPLY WORLD TRANSFORM
        const newPositions = [];
        const faceColors = [];

        for (let f = 0; f < numFaces; f++) {
            let i0, i1, i2;
            if (index) {
                i0 = index.getX(f * 3);
                i1 = index.getX(f * 3 + 1);
                i2 = index.getX(f * 3 + 2);
            } else {
                i0 = f * 3;
                i1 = f * 3 + 1;
                i2 = f * 3 + 2;
            }

            // Get vertices and APPLY WORLD TRANSFORM
            const v0 = new Vector3(position.getX(i0), position.getY(i0), position.getZ(i0));
            const v1 = new Vector3(position.getX(i1), position.getY(i1), position.getZ(i1));
            const v2 = new Vector3(position.getX(i2), position.getY(i2), position.getZ(i2));

            v0.applyMatrix4(mesh.matrixWorld);
            v1.applyMatrix4(mesh.matrixWorld);
            v2.applyMatrix4(mesh.matrixWorld);

            // Add world-space positions
            newPositions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);

            // Encode face ID as RGB (globalFaceOffset + f + 1, reserve 0 for background)
            const globalFaceId = globalFaceOffset + f + 1;
            const r = (globalFaceId & 0xFF) / 255;
            const g = ((globalFaceId >> 8) & 0xFF) / 255;
            const b = ((globalFaceId >> 16) & 0xFF) / 255;

            // Same color for all 3 vertices of this face
            faceColors.push(r, g, b, r, g, b, r, g, b);
        }

        // Create geometry with world-space positions
        const newGeom = new BufferGeometry();
        newGeom.setAttribute('position', new BufferAttribute(new Float32Array(newPositions), 3));
        newGeom.setAttribute('faceColor', new BufferAttribute(new Float32Array(faceColors), 3));

        // Create mesh - no need for matrix since positions are already in world space
        const faceIdMesh = new Mesh(newGeom, faceIdMaterial);
        faceIdMeshes.push(faceIdMesh);

        globalFaceOffset += numFaces;
    }

    // Create temporary scene with ALL face ID meshes
    const tempScene = new Scene();
    for (const faceIdMesh of faceIdMeshes) {
        tempScene.add(faceIdMesh);
    }

    // Render ALL meshes TOGETHER in one pass
    renderer.setRenderTarget(renderTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(tempScene, camera);

    // Read the render target
    const faceIdData = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, faceIdData);

    // Restore renderer
    renderer.setRenderTarget(null);

    // Process edges
    for (const edge of edges) {
        const midX = (edge.a.x + edge.b.x) / 2;
        const midY = (edge.a.y + edge.b.y) / 2;

        const sx = Math.round(midX + width / 2);
        const sy = Math.round(height / 2 + midY);

        if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
            edge.visible = true;
            visibleEdges.push(edge);
            continue;
        }

        const idx = ((height - 1 - sy) * width + sx) * 4;
        const r = faceIdData[idx];
        const g = faceIdData[idx + 1];
        const b = faceIdData[idx + 2];

        const sampledFaceId = r + (g << 8) + (b << 16);

        // If 0 (background), edge is visible
        if (sampledFaceId === 0) {
            edge.visible = true;
            visibleEdges.push(edge);
            continue;
        }

        // Edge parent face ID is faceIdx + 1 (we offset by 1 to reserve 0 for background)
        const parentFaceId = edge.faceIdx + 1;

        // Edge is visible if sampled face matches parent face
        if (sampledFaceId === parentFaceId) {
            edge.visible = true;
            visibleEdges.push(edge);
        } else {
            edge.visible = false;
        }
    }

    // Cleanup
    renderTarget.dispose();
    faceIdMaterial.dispose();
    for (const m of faceIdMeshes) {
        m.geometry.dispose();
    }

    return visibleEdges;
}

/**
 * Pure mathematical point-in-triangle test (2D)
 * @param {Vector2} p - Point to test
 * @param {Vector2} a - Triangle vertex A
 * @param {Vector2} b - Triangle vertex B
 * @param {Vector2} c - Triangle vertex C
 * @returns {boolean}
 */
function pointInTriangle2D(p, a, b, c) {
    const sign = (p1, p2, p3) =>
        (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

    const d1 = sign(p, a, b);
    const d2 = sign(p, b, c);
    const d3 = sign(p, c, a);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

    return !(hasNeg && hasPos);
}

/**
 * Check if edge lies along a face edge (collinear and within)
 * @param {Vector2} edgeA - Edge start point
 * @param {Vector2} edgeB - Edge end point
 * @param {Vector2} faceEdgeA - Face edge start point
 * @param {Vector2} faceEdgeB - Face edge end point
 * @param {number} tolerance - Distance tolerance in pixels
 * @returns {boolean}
 */
function edgeLiesAlongFaceEdge(edgeA, edgeB, faceEdgeA, faceEdgeB, tolerance = 2.0) {
    // Get face edge direction and length
    const dx = faceEdgeB.x - faceEdgeA.x;
    const dy = faceEdgeB.y - faceEdgeA.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) return false;  // Degenerate face edge

    // Project edge endpoints onto face edge line
    const projectAndCheck = (p) => {
        // Project p onto line defined by faceEdgeA->faceEdgeB
        const t = ((p.x - faceEdgeA.x) * dx + (p.y - faceEdgeA.y) * dy) / lenSq;

        // Projected point
        const projX = faceEdgeA.x + t * dx;
        const projY = faceEdgeA.y + t * dy;

        // Distance from p to projected point
        const distSq = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);

        // Check if close to line and within segment (with small margin)
        return distSq < tolerance * tolerance && t >= -0.01 && t <= 1.01;
    };

    // Both edge endpoints must lie along the face edge
    return projectAndCheck(edgeA) && projectAndCheck(edgeB);
}

/**
 * Find all faces adjacent to an edge geometrically
 * @param {Object} edge - Edge with a, b (2D points)
 * @param {Object[]} projectedFaces - Array of projected faces
 * @returns {Object[]} - Array of matching faces with match type
 */
export function findAdjacentFaces(edge, projectedFaces) {
    const results = [];

    for (const face of projectedFaces) {
        // Get the three edges of the face
        const faceEdges = [
            { a: face.a2d, b: face.b2d, name: 'AB' },
            { a: face.b2d, b: face.c2d, name: 'BC' },
            { a: face.c2d, b: face.a2d, name: 'CA' }
        ];

        for (const fe of faceEdges) {
            if (edgeLiesAlongFaceEdge(edge.a, edge.b, fe.a, fe.b)) {
                results.push({
                    face,
                    matchedEdge: fe.name,
                    matchType: 'collinear'
                });
                break;  // Found a match for this face, move to next
            }
        }
    }

    return results;
}

/**
 * Compute depth at point inside triangle using barycentric interpolation
 * @param {Vector2} p - Point to compute depth at
 * @param {Vector2} a - Triangle vertex A (2D)
 * @param {Vector2} b - Triangle vertex B (2D)
 * @param {Vector2} c - Triangle vertex C (2D)
 * @param {number} depthA - Depth at vertex A
 * @param {number} depthB - Depth at vertex B
 * @param {number} depthC - Depth at vertex C
 * @returns {number} - Interpolated depth at p
 */
function barycentricDepth(p, a, b, c, depthA, depthB, depthC) {
    // Compute barycentric coordinates
    const v0 = { x: c.x - a.x, y: c.y - a.y };
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: p.x - a.x, y: p.y - a.y };

    const dot00 = v0.x * v0.x + v0.y * v0.y;
    const dot01 = v0.x * v1.x + v0.y * v1.y;
    const dot02 = v0.x * v2.x + v0.y * v2.y;
    const dot11 = v1.x * v1.x + v1.y * v1.y;
    const dot12 = v1.x * v2.x + v1.y * v2.y;

    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-10) return Infinity;

    const u = (dot11 * dot02 - dot01 * dot12) / denom;
    const v = (dot00 * dot12 - dot01 * dot02) / denom;
    const w = 1 - u - v;

    return w * depthA + v * depthB + u * depthC;
}

/**
 * Post-split smooth filter: removes T-junction straggler edges that lie on a coplanar face
 * This catches "straggler" edges from T-junctions that extend into smooth surfaces
 * @param {Edge2D[]} edges - Split edges to filter
 * @param {Object[]} projectedFaces - Projected faces with normals
 * @param {number} coplanarThreshold - Normal dot product threshold (default 0.99)
 * @param {number} distanceThreshold - Plane distance threshold (default 0.5)
 * @returns {Edge2D[]}
 */
export function filterSmoothSplitEdges(edges, projectedFaces, coplanarThreshold = 0.99, distanceThreshold = 0.5) {
    const filteredEdges = [];
    let removedCount = 0;

    for (const edge of edges) {
        // Find all adjacent faces geometrically
        const adjacentFaces = findAdjacentFaces(edge, projectedFaces);

        // Store adjacent face count for debugging
        edge.adjacentFaceCount = adjacentFaces.length;

        let shouldRemove = false;

        // Only remove if we have exactly 2 faces with matching normals AND matching plane constants
        if (adjacentFaces.length === 2) {
            const f1 = adjacentFaces[0].face;
            const f2 = adjacentFaces[1].face;
            const fn1 = f1.normal;
            const fn2 = f2.normal;

            if (fn1 && fn2) {
                const dot = fn1.dot(fn2);
                const similarity = Math.abs(dot);
                edge.faceSimilarity = similarity;

                // Check distance between planes (must be very close to be truly coplanar)
                // If normals are parallel (dot > 0), d1 ~ d2 => diff ~ 0
                // If normals are anti-parallel (dot < 0), d1 ~ -d2 => sum ~ 0
                let distDiff;
                if (dot > 0) {
                    distDiff = Math.abs(f1.constant - f2.constant);
                } else {
                    distDiff = Math.abs(f1.constant + f2.constant);
                }

                if (similarity >= coplanarThreshold && distDiff < distanceThreshold) {
                    // Edge lies between exactly 2 coplanar faces - remove it
                    shouldRemove = true;
                    removedCount++;
                }
            }
        } else if (adjacentFaces.length > 2) {
            // 3+ faces: check if ALL normals match AND ALL planes match
            const faces = adjacentFaces.map(af => af.face).filter(f => f.normal);
            if (faces.length >= 2) {
                let allCoplanar = true;
                let minSimilarity = 1;

                for (let i = 1; i < faces.length; i++) {
                    const dot = faces[0].normal.dot(faces[i].normal);
                    const sim = Math.abs(dot);

                    let distDiff;
                    if (dot > 0) {
                        distDiff = Math.abs(faces[0].constant - faces[i].constant);
                    } else {
                        distDiff = Math.abs(faces[0].constant + faces[i].constant);
                    }

                    minSimilarity = Math.min(minSimilarity, sim);

                    if (sim < coplanarThreshold || distDiff >= distanceThreshold) {
                        allCoplanar = false;
                        break;
                    }
                }
                edge.faceSimilarity = minSimilarity;

                if (allCoplanar) {
                    shouldRemove = true;
                    removedCount++;
                }
            }
        }

        if (!shouldRemove) {
            filteredEdges.push(edge);
        }
    }

    console.log(`Geometric straggler filter: removed ${removedCount} coplanar edges`);
    return filteredEdges;
}
/**
 * Test edge visibility using pure math (point-in-triangle + depth)
 * No GPU, no raycasting - fully mathematical
 * WASM-accelerated when available
 * @param {Edge2D[]} edges 
 * @param {Object[]} projectedFaces - Array of {a2d, b2d, c2d, depthA, depthB, depthC, mesh, faceIdx}
 * @param {Camera} camera
 * @returns {Edge2D[]}
 */
export function testOcclusionMath(edges, projectedFaces, camera) {
    const cameraPos = camera.position;

    // Try WASM-accelerated path
    if (isWasmReady() && edges.length > 0 && projectedFaces.length > 0) {
        try {
            return testOcclusionMathWASM(edges, projectedFaces, cameraPos);
        } catch (e) {
            console.warn('[hidden-line] WASM occlusion failed, falling back to JS:', e);
        }
    }

    // JS fallback
    return testOcclusionMathJS(edges, projectedFaces, cameraPos);
}

/**
 * WASM-accelerated occlusion test
 * Converts Edge2D/Face arrays to flat Float64Arrays for WASM processing
 */
function testOcclusionMathWASM(edges, projectedFaces, cameraPos) {
    // Build mesh ID map for parent-face exclusion
    const meshIdMap = new Map();
    let meshCounter = 0;

    // Convert edges to flat array: [ax, ay, a_depth, bx, by, b_depth, ...]
    const edgeData = new Array(edges.length * 6);
    // Edge-to-face mapping: [mesh_id, face_id, face_id2, ...] (3 values per edge)
    const edgeMeshFaceData = new Array(edges.length * 3);

    for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const aDepth = cameraPos.distanceTo(edge.a3d);
        const bDepth = cameraPos.distanceTo(edge.b3d);

        edgeData[i * 6] = edge.a.x;
        edgeData[i * 6 + 1] = edge.a.y;
        edgeData[i * 6 + 2] = aDepth;
        edgeData[i * 6 + 3] = edge.b.x;
        edgeData[i * 6 + 4] = edge.b.y;
        edgeData[i * 6 + 5] = bDepth;

        // Get mesh ID
        if (!meshIdMap.has(edge.mesh)) {
            meshIdMap.set(edge.mesh, meshCounter++);
        }
        edgeMeshFaceData[i * 3] = meshIdMap.get(edge.mesh);
        edgeMeshFaceData[i * 3 + 1] = edge.faceIdx ?? -1;
        edgeMeshFaceData[i * 3 + 2] = edge.faceIdx2 ?? -1;  // Include second face!
    }

    // Convert faces to flat array: [ax, ay, a_depth, bx, by, b_depth, cx, cy, c_depth, mesh_id, face_id, ...]
    const faceData = new Array(projectedFaces.length * 11);

    for (let i = 0; i < projectedFaces.length; i++) {
        const face = projectedFaces[i];

        if (!meshIdMap.has(face.mesh)) {
            meshIdMap.set(face.mesh, meshCounter++);
        }

        faceData[i * 11] = face.a2d.x;
        faceData[i * 11 + 1] = face.a2d.y;
        faceData[i * 11 + 2] = face.depthA;
        faceData[i * 11 + 3] = face.b2d.x;
        faceData[i * 11 + 4] = face.b2d.y;
        faceData[i * 11 + 5] = face.depthB;
        faceData[i * 11 + 6] = face.c2d.x;
        faceData[i * 11 + 7] = face.c2d.y;
        faceData[i * 11 + 8] = face.depthC;
        faceData[i * 11 + 9] = meshIdMap.get(face.mesh);
        faceData[i * 11 + 10] = face.faceIdx;
    }

    // Call WASM
    const visibleIndices = wasmTestOcclusion(edgeData, faceData, edgeMeshFaceData);

    // Map results back to Edge2D objects
    const visibleEdges = [];
    for (const idx of visibleIndices) {
        const edge = edges[idx];
        edge.visible = true;
        visibleEdges.push(edge);
    }

    // Mark non-visible edges
    const visibleSet = new Set(visibleIndices);
    for (let i = 0; i < edges.length; i++) {
        if (!visibleSet.has(i)) {
            edges[i].visible = false;
        }
    }

    console.log(`[WASM] Occlusion: ${visibleEdges.length}/${edges.length} visible`);
    return visibleEdges;
}

/**
 * JS fallback for occlusion testing
 */
function testOcclusionMathJS(edges, projectedFaces, cameraPos) {
    const visibleEdges = [];
    let debugHitCount = 0;
    let debugOccludedCount = 0;

    for (const edge of edges) {
        // Get midpoint in 2D and 3D
        const mid2d = new Vector2(
            (edge.a.x + edge.b.x) / 2,
            (edge.a.y + edge.b.y) / 2
        );

        // Compute edge midpoint depth (distance from camera)
        const mid3d = edge.midpoint3d;
        const edgeDepth = cameraPos.distanceTo(mid3d);

        let occluded = false;

        // Check against ALL faces
        for (const face of projectedFaces) {
            // Skip if this is the edge's parent face
            if (face.mesh === edge.mesh &&
                (face.faceIdx === edge.faceIdx || face.faceIdx === edge.faceIdx2)) {
                continue;
            }

            // Point-in-triangle test in 2D
            if (!pointInTriangle2D(mid2d, face.a2d, face.b2d, face.c2d)) {
                continue;
            }

            // Compute depth of the face at this 2D point
            const faceDepthAtPoint = barycentricDepth(
                mid2d, face.a2d, face.b2d, face.c2d,
                face.depthA, face.depthB, face.depthC
            );

            // If face is closer → edge is occluded
            if (faceDepthAtPoint < edgeDepth - 0.001) {
                occluded = true;
                debugOccludedCount++;
                break;
            }
            debugHitCount++;
        }

        if (!occluded) {
            edge.visible = true;
            visibleEdges.push(edge);
        } else {
            edge.visible = false;
        }
    }

    console.log(`[JS] Occlusion debug: ${debugHitCount} point-in-triangle hits, ${debugOccludedCount} occluded`);
    return visibleEdges;
}

/**
 * Test edge visibility using raycasting (slow fallback)
 * @param {Edge2D[]} edges 
 * @param {Scene} scene 
 * @param {Camera} camera 
 * @param {number} epsilon - Distance tolerance (as fraction of distance)
 * @returns {Edge2D[]}
 */
export function testOcclusion(edges, scene, camera, epsilon = 0.05) {
    const raycaster = new Raycaster();
    const visibleEdges = [];

    // Collect all meshes in the scene for intersection testing
    /** @type {any[]} */
    const meshes = [];
    scene.traverse((obj) => {
        // @ts-ignore - isMesh exists on Mesh objects
        if (obj.isMesh) {
            meshes.push(obj);
        }
    });

    for (const edge of edges) {
        // Get direction from camera to midpoint
        const toMidpoint = new Vector3().subVectors(edge.midpoint3d, camera.position);
        const direction = toMidpoint.clone().normalize();
        const expectedDist = toMidpoint.length();

        // Use relative epsilon based on distance
        const relEps = expectedDist * epsilon;

        // Raycast from camera towards the edge midpoint
        raycaster.set(camera.position.clone(), direction);

        const intersects = raycaster.intersectObjects(meshes, true);

        if (intersects.length === 0) {
            // No hit - edge is visible
            edge.visible = true;
            visibleEdges.push(edge);
        } else {
            // Check if any hit is significantly in front of the edge
            let occluded = false;

            for (const hit of intersects) {
                // Skip hits at or beyond the edge's depth
                if (hit.distance >= expectedDist - relEps) {
                    continue;
                }

                // For same-mesh hits, check if it's the edge's own face
                if (hit.object === edge.mesh) {
                    // Skip if this is the same face the edge belongs to
                    if (hit.faceIndex === edge.faceIdx) {
                        continue;
                    }
                }

                // Something is in front of the edge - it's occluded
                occluded = true;
                break;
            }

            if (!occluded) {
                edge.visible = true;
                visibleEdges.push(edge);
            } else {
                edge.visible = false;
            }
        }
    }

    return visibleEdges;
}

/**
 * Remove duplicate segments and merge colinear ones
 * @param {Edge2D[]} edges 
 * @param {number} tolerance 
 * @returns {Edge2D[]}
 */
export function optimizeEdges(edges, tolerance = 0.5) {
    // Deduplicate using hash
    /** @type {Map<string, Edge2D>} */
    const unique = new Map();

    const hashPoint = (p) => `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)}`;
    const hashEdge = (e) => {
        const h1 = hashPoint(e.a);
        const h2 = hashPoint(e.b);
        return h1 < h2 ? `${h1}-${h2}` : `${h2}-${h1}`;
    };

    for (const edge of edges) {
        const key = hashEdge(edge);
        if (!unique.has(key)) {
            unique.set(key, edge);
        }
    }

    // TODO: Merge colinear segments

    return Array.from(unique.values());
}

/**
 * Cleanup orphaned edges by extending to find intersections
 * An orphaned endpoint is a vertex with only 1 connected edge
 * Strategy: extend orphan edges and find line-line intersections
 * @param {Edge2D[]} edges - Edges to clean up
 * @param {number} tolerance - Distance tolerance for vertex matching
 * @param {number} maxExtension - Maximum distance to extend an edge
 * @returns {Edge2D[]}
 */
export function cleanupOrphanedEdges(edges, tolerance = 1.0, maxExtension = 50) {
    // Build vertex -> edge connectivity map
    const vertexKey = (p) => `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)}`;

    // Map of vertex hash -> { edges: [{edge, endpoint: 'a'|'b'}], point: Vector2 }
    const vertices = new Map();

    for (const edge of edges) {
        for (const endpoint of ['a', 'b']) {
            const p = edge[endpoint];
            const key = vertexKey(p);
            if (!vertices.has(key)) {
                vertices.set(key, { edges: [], point: p.clone() });
            }
            vertices.get(key).edges.push({ edge, endpoint });
        }
    }

    // Find orphaned endpoints (vertices with only 1 edge)
    const orphans = [];
    for (const [key, vertex] of vertices) {
        if (vertex.edges.length === 1) {
            const { edge, endpoint } = vertex.edges[0];
            const orphanPoint = vertex.point;
            const otherPoint = endpoint === 'a' ? edge.b : edge.a;

            // Compute direction (from fixed end toward orphan end)
            const dx = orphanPoint.x - otherPoint.x;
            const dy = orphanPoint.y - otherPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.001) continue;

            orphans.push({
                key,
                edge,
                endpoint,
                point: orphanPoint,
                otherPoint,
                dirX: dx / len,
                dirY: dy / len,
                len
            });
        }
    }

    console.log(`Edge cleanup: found ${orphans.length} orphaned endpoints`);
    if (orphans.length === 0) return edges;

    // Line-line intersection helper
    // Returns t values for intersection point on both lines, or null if parallel
    const lineIntersection = (p1, d1, p2, d2) => {
        const cross = d1.x * d2.y - d1.y * d2.x;
        if (Math.abs(cross) < 0.0001) return null; // Parallel

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const t1 = (dx * d2.y - dy * d2.x) / cross;
        const t2 = (dx * d1.y - dy * d1.x) / cross;

        return { t1, t2 };
    };

    let extensionsCount = 0;
    const processed = new Set();

    for (let i = 0; i < orphans.length; i++) {
        const orphan = orphans[i];
        if (processed.has(orphan.key)) continue;

        let bestMatch = null;
        let bestIntersection = null;
        let bestDist = Infinity;

        for (let j = 0; j < orphans.length; j++) {
            if (i === j) continue;
            const candidate = orphans[j];
            if (processed.has(candidate.key)) continue;

            // Check if candidate's orphan point is reasonably close
            const dist = Math.sqrt(
                (candidate.point.x - orphan.point.x) ** 2 +
                (candidate.point.y - orphan.point.y) ** 2
            );
            if (dist > maxExtension * 2) continue;

            // Extend both lines and find intersection
            // orphan: starts at orphan.point, direction orphan.dirX/dirY
            // candidate: starts at candidate.point, direction candidate.dirX/dirY
            const result = lineIntersection(
                { x: orphan.point.x, y: orphan.point.y },
                { x: orphan.dirX, y: orphan.dirY },
                { x: candidate.point.x, y: candidate.point.y },
                { x: candidate.dirX, y: candidate.dirY }
            );

            if (!result) continue; // Parallel lines

            // t1 > 0 means intersection is in forward direction from orphan
            // t2 > 0 means intersection is in forward direction from candidate
            // Both must be positive (extending, not backtracking)
            if (result.t1 < -0.1 || result.t2 < -0.1) continue;
            if (result.t1 > maxExtension || result.t2 > maxExtension) continue;

            // Compute intersection point
            const ix = orphan.point.x + result.t1 * orphan.dirX;
            const iy = orphan.point.y + result.t1 * orphan.dirY;

            // Prefer closer intersections
            const intersectDist = result.t1 + result.t2;
            if (intersectDist < bestDist) {
                bestDist = intersectDist;
                bestMatch = candidate;
                bestIntersection = { x: ix, y: iy };
            }
        }

        if (bestMatch && bestIntersection) {
            // Check if extension would cross any other edges
            // Check segment from orphan.point to intersection
            const crosses1 = segmentCrossesEdges(
                orphan.point,
                bestIntersection,
                edges,
                orphan.edge,
                bestMatch.edge
            );
            // Check segment from bestMatch.point to intersection
            const crosses2 = segmentCrossesEdges(
                bestMatch.point,
                bestIntersection,
                edges,
                orphan.edge,
                bestMatch.edge
            );

            if (crosses1 || crosses2) {
                // Skip this extension - it would cross existing edges
                continue;
            }

            // Extend both edges to meet at intersection point
            if (orphan.endpoint === 'a') {
                orphan.edge.a.x = bestIntersection.x;
                orphan.edge.a.y = bestIntersection.y;
            } else {
                orphan.edge.b.x = bestIntersection.x;
                orphan.edge.b.y = bestIntersection.y;
            }

            if (bestMatch.endpoint === 'a') {
                bestMatch.edge.a.x = bestIntersection.x;
                bestMatch.edge.a.y = bestIntersection.y;
            } else {
                bestMatch.edge.b.x = bestIntersection.x;
                bestMatch.edge.b.y = bestIntersection.y;
            }

            processed.add(orphan.key);
            processed.add(bestMatch.key);
            extensionsCount++;
        }
    }

    console.log(`Edge cleanup: extended ${extensionsCount} pairs of edges to intersections`);

    // Calculate average edge length for threshold
    let totalLength = 0;
    for (const edge of edges) {
        const dx = edge.b.x - edge.a.x;
        const dy = edge.b.y - edge.a.y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    const avgEdgeLength = totalLength / edges.length;
    const snapThreshold = avgEdgeLength / 8;

    console.log(`Edge cleanup: average edge length = ${avgEdgeLength.toFixed(2)}, snap threshold = ${snapThreshold.toFixed(2)}`);

    // Rebuild orphan list after extensions
    const finalVertices = new Map();
    for (const edge of edges) {
        for (const endpoint of ['a', 'b']) {
            const p = edge[endpoint];
            const key = vertexKey(p);
            if (!finalVertices.has(key)) {
                finalVertices.set(key, { edges: [], point: p });
            }
            finalVertices.get(key).edges.push({ edge, endpoint });
        }
    }

    // Find remaining orphans
    const finalOrphans = [];
    for (const [key, vertex] of finalVertices) {
        if (vertex.edges.length === 1) {
            finalOrphans.push({ key, ...vertex.edges[0], point: vertex.point });
        }
    }

    console.log(`Edge cleanup: ${finalOrphans.length} orphaned endpoints before snap pass`);

    // Snap nearby orphans together
    let snapCount = 0;
    const snapped = new Set();

    for (let i = 0; i < finalOrphans.length; i++) {
        const orphan = finalOrphans[i];
        if (snapped.has(orphan.key)) continue;

        let nearestOrphan = null;
        let nearestDist = Infinity;

        for (let j = 0; j < finalOrphans.length; j++) {
            if (i === j) continue;
            const candidate = finalOrphans[j];
            if (snapped.has(candidate.key)) continue;

            const dist = Math.sqrt(
                (candidate.point.x - orphan.point.x) ** 2 +
                (candidate.point.y - orphan.point.y) ** 2
            );

            if (dist < nearestDist) {
                nearestDist = dist;
                nearestOrphan = candidate;
            }
        }

        if (nearestOrphan && nearestDist < snapThreshold) {
            // Snap both to the midpoint
            const midX = (orphan.point.x + nearestOrphan.point.x) / 2;
            const midY = (orphan.point.y + nearestOrphan.point.y) / 2;

            if (orphan.endpoint === 'a') {
                orphan.edge.a.x = midX;
                orphan.edge.a.y = midY;
            } else {
                orphan.edge.b.x = midX;
                orphan.edge.b.y = midY;
            }

            if (nearestOrphan.endpoint === 'a') {
                nearestOrphan.edge.a.x = midX;
                nearestOrphan.edge.a.y = midY;
            } else {
                nearestOrphan.edge.b.x = midX;
                nearestOrphan.edge.b.y = midY;
            }

            snapped.add(orphan.key);
            snapped.add(nearestOrphan.key);
            snapCount++;
        }
    }

    console.log(`Edge cleanup: snapped ${snapCount} pairs of nearby orphans`);

    // Final count
    const remainingOrphans = finalOrphans.length - (snapCount * 2);
    console.log(`Edge cleanup: ${remainingOrphans} orphaned endpoints remaining`);

    return edges;
}

/**
 * Remove isolated edges where BOTH endpoints are orphaned (no connections to other edges)
 * These are floating edge fragments that don't connect to anything
 * @param {Edge2D[]} edges - Edges to filter
 * @param {number} tolerance - Distance tolerance for vertex matching
 * @returns {Edge2D[]} Filtered edges
 */
export function removeIsolatedEdges(edges, tolerance = 1.0) {
    const vertexKey = (p) => `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)}`;

    // Count connections per vertex
    const vertexConnections = new Map();

    for (const edge of edges) {
        const keyA = vertexKey(edge.a);
        const keyB = vertexKey(edge.b);

        vertexConnections.set(keyA, (vertexConnections.get(keyA) || 0) + 1);
        vertexConnections.set(keyB, (vertexConnections.get(keyB) || 0) + 1);
    }

    // Filter out edges where both endpoints have only 1 connection (orphaned at both ends)
    const filtered = edges.filter(edge => {
        const keyA = vertexKey(edge.a);
        const keyB = vertexKey(edge.b);
        const connectionsA = vertexConnections.get(keyA) || 0;
        const connectionsB = vertexConnections.get(keyB) || 0;

        // Keep edge if at least one endpoint has 2+ connections
        return connectionsA >= 2 || connectionsB >= 2;
    });

    const removed = edges.length - filtered.length;
    if (removed > 0) {
        console.log(`Edge cleanup: removed ${removed} isolated edges (orphaned at both ends)`);
    }

    return filtered;
}

/**
 * Check if a segment from p1 to p2 crosses any existing edge
 * @param {Vector2} p1 - Start point
 * @param {Vector2} p2 - End point
 * @param {Edge2D[]} edges - Existing edges to check against
 * @param {Edge2D} excludeEdge1 - Edge to exclude from check
 * @param {Edge2D} excludeEdge2 - Edge to exclude from check
 * @returns {boolean} True if segment crosses an edge
 */
function segmentCrossesEdges(p1, p2, edges, excludeEdge1, excludeEdge2) {
    const eps = 0.001;

    for (const edge of edges) {
        if (edge === excludeEdge1 || edge === excludeEdge2) continue;

        // Check if segment p1->p2 intersects edge.a->edge.b
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = edge.b.x - edge.a.x;
        const d2y = edge.b.y - edge.a.y;

        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < eps) continue; // Parallel

        const dx = edge.a.x - p1.x;
        const dy = edge.a.y - p1.y;

        const t1 = (dx * d2y - dy * d2x) / cross;
        const t2 = (dx * d1y - dy * d1x) / cross;

        // Check if intersection is within both segments (with small margin)
        if (t1 > eps && t1 < 1 - eps && t2 > eps && t2 < 1 - eps) {
            return true; // Crosses an edge
        }
    }

    return false;
}

/**
 * Main hidden line removal function
 * @param {Mesh} mesh 
 * @param {Camera} camera 
 * @param {Scene} scene 
 * @param {Object} options
 * @param {number} [options.smoothThreshold] - Threshold for smooth edge removal (default 0.99)
 * @param {number} [options.gridSize] - Spatial hash grid size (default 32)
 * @param {number} [options.occlusionEpsilon] - Occlusion test tolerance (relative to camera distance)
 * @param {boolean} [options.skipOcclusion] - Skip occlusion testing (debug mode)
 * @param {number} [options.width] - Viewport width
 * @param {number} [options.height] - Viewport height
 * @param {any} [options.renderer] - THREE.WebGLRenderer for depth buffer occlusion (fast)
 * @returns {{edges: Edge2D[], profiles: Edge2D[]}}
 */
export function computeHiddenLines(mesh, camera, scene, options = {}) {
    const {
        smoothThreshold = 0.99,
        gridSize = 32,
        occlusionEpsilon = 0.01, // 1% depth tolerance for depth buffer
        skipOcclusion = false,
        width = 800,
        height = 600,
        renderer = null
    } = options;

    console.time('extractEdges');
    const edges3d = extractEdges(mesh, camera.position);
    console.timeEnd('extractEdges');
    console.log(`Extracted ${edges3d.length} edges`);

    console.time('filterBackfacing');
    const frontEdges = filterBackfacing(edges3d, camera.position);
    console.timeEnd('filterBackfacing');
    console.log(`After backface filter: ${frontEdges.length} edges`);

    console.time('classifyEdges');
    const { profiles, smoothFiltered } = classifyEdges(frontEdges, camera.position, smoothThreshold);
    console.timeEnd('classifyEdges');
    console.log(`Profiles: ${profiles.length}, Smooth edges: ${smoothFiltered.length}`);

    // Combine profile and smooth edges for processing
    const allEdges = [...profiles, ...smoothFiltered];

    console.time('projectEdges');
    let edges2d = projectEdges(allEdges, camera, width, height);
    console.timeEnd('projectEdges');

    // Mark profile edges
    for (let i = 0; i < profiles.length; i++) {
        edges2d[i].isProfile = true;
    }

    console.time('spatialHash');
    const cellSize = Math.max(width, height) / gridSize;
    const hash = new SpatialHash(cellSize);
    for (const edge of edges2d) {
        hash.insert(edge);
    }
    console.timeEnd('spatialHash');

    console.time('splitIntersections');
    // Process each cell
    const processedEdges = new Set();
    let splitEdges = [];

    for (const cellKey of hash.getAllCells()) {
        const cellEdges = hash.query(cellKey).filter(e => !processedEdges.has(e));
        const split = splitAtIntersections(cellEdges);
        splitEdges.push(...split);
        for (const e of cellEdges) processedEdges.add(e);
    }
    console.timeEnd('splitIntersections');
    console.log(`After splitting: ${splitEdges.length} edges`);

    let visibleEdges;
    if (skipOcclusion) {
        console.log('Skipping occlusion test (debug mode)');
        visibleEdges = splitEdges;
    } else if (renderer) {
        console.time('testOcclusion (face ID buffer)');
        // Separate profile and non-profile edges
        const profileEdges = splitEdges.filter(e => e.isProfile);
        const otherEdges = splitEdges.filter(e => !e.isProfile);

        // Profile edges are ALWAYS visible (silhouette edges)
        profileEdges.forEach(e => e.visible = true);

        // Test occlusion only for non-profile edges using face ID buffer
        const visibleOtherEdges = testOcclusionFaceID(otherEdges, [mesh], camera, width, height, renderer, false);

        visibleEdges = [...profileEdges, ...visibleOtherEdges];
        console.timeEnd('testOcclusion (face ID buffer)');
    } else {
        console.time('testOcclusion (raycaster - slow)');
        visibleEdges = testOcclusion(splitEdges, scene, camera, occlusionEpsilon);
        console.timeEnd('testOcclusion (raycaster - slow)');
    }
    console.log(`Visible edges: ${visibleEdges.length}`);

    console.time('optimize');
    const optimizedEdges = optimizeEdges(visibleEdges);
    console.timeEnd('optimize');

    console.time('cleanup orphans');
    const finalEdges = cleanupOrphanedEdges(optimizedEdges);
    console.timeEnd('cleanup orphans');
    console.log(`Final edges: ${finalEdges.length}`);

    return {
        edges: finalEdges,
        profiles: finalEdges.filter(e => e.isProfile)
    };
}

/**
 * Hidden line removal for multiple meshes with cross-object occlusion
 * All meshes are rendered to a single face ID buffer for correct occlusion
 * @param {Mesh[]} meshes 
 * @param {Camera} camera 
 * @param {Scene} scene 
 * @param {Object} options
 * @param {number} [options.smoothThreshold]
 * @param {number} [options.gridSize]
 * @param {boolean} [options.skipOcclusion]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {any} [options.renderer]
 * @param {Edge3D[]} [options.hatchEdges] - Optional array of Edge3D objects for hatching
 * @param {number} [options.minHatchDotProduct] - Minimum dot product with view vector to keep hatch edges (0-1)
 * @param {number} [options.internalScale] - Internal scale factor (default: 4)
 * @param {number} [options.distanceThreshold] - Distance threshold for coplanar detection (default: 0.5)
 * @returns {{edges: Edge2D[], profiles: Edge2D[]}}
 */
export function computeHiddenLinesMultiple(meshes, camera, scene, options = {}) {
    const {
        smoothThreshold = 0.99,
        gridSize = 32,
        skipOcclusion = false,
        width = 800,
        height = 600,
        renderer = null,
        internalScale = 4,  // Scale up internally for better precision
        distanceThreshold = 0.5 // Default plane distance threshold
    } = options;

    // Process each mesh to extract edges (keep local face indices with mesh reference)
    let allEdges3d = [];

    for (const mesh of meshes) {
        mesh.updateMatrixWorld(true);
        const edges3d = extractEdges(mesh, camera.position);
        // Edges already have mesh reference and local faceIdx1/faceIdx2 from extractEdges
        allEdges3d.push(...edges3d);
    }

    console.log(`Extracted ${allEdges3d.length} edges from ${meshes.length} meshes`);

    // Classify edges: identify profiles and filter smooth edges
    const { profiles, smoothFiltered } = classifyEdges(allEdges3d, camera.position, smoothThreshold);
    console.log(`Profiles: ${profiles.length}, Crease edges: ${smoothFiltered.length}`);

    const allEdges = [...profiles, ...smoothFiltered];
    console.log(`After smooth filter: ${allEdges.length} edges`);

    // Project to 2D (with internal scale for precision)
    let edges2d = projectEdges(allEdges, camera, width, height, internalScale);

    // Process additional hatch edges if provided
    if (options.hatchEdges && options.hatchEdges.length > 0) {
        console.log(`Processing ${options.hatchEdges.length} hatch edges...`);
        // Filter backfacing hatch edges
        let visibleHatch = filterBackfacing(options.hatchEdges, camera.position);

        // Filter over-dense hatching based on view angle
        if (options.minHatchDotProduct !== undefined) {
            const threshold = options.minHatchDotProduct;
            visibleHatch = visibleHatch.filter(edge => {
                const edgeMidpoint = new Vector3().addVectors(edge.a, edge.b).multiplyScalar(0.5);
                const viewDir = new Vector3().subVectors(camera.position, edgeMidpoint).normalize();
                const dot = edge.normal1.dot(viewDir);
                return Math.abs(dot) >= threshold;
            });
            console.log(`Density filter: kept ${visibleHatch.length} hatch edges (threshold ${threshold})`);
        }

        // Project
        const hatch2d = projectEdges(visibleHatch, camera, width, height, internalScale);

        // Mark explicitly (in case projectEdges didn't catch it from source)
        hatch2d.forEach(e => e.isHatch = true);

        // Add to main list
        edges2d.push(...hatch2d);
        console.log(`Added ${hatch2d.length} visible hatch edges`);
    }

    // Mark profile edges
    // Split all edges at intersections (direct O(n²) comparison - no spatial hash)
    console.time('splitIntersections');
    const splitEdges = splitAtIntersections(edges2d);
    console.timeEnd('splitIntersections');
    console.log(`After splitting: ${splitEdges.length} edges`);

    // Build projected faces array for math occlusion
    console.time('buildProjectedFaces');
    const projectedFaces = [];
    const cameraPos = camera.position;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    for (const mesh of meshes) {
        const geom = mesh.geometry;
        const position = geom.attributes.position;
        const index = geom.index;
        const numFaces = index ? index.count / 3 : position.count / 3;

        for (let f = 0; f < numFaces; f++) {
            let i0, i1, i2;
            if (index) {
                i0 = index.getX(f * 3);
                i1 = index.getX(f * 3 + 1);
                i2 = index.getX(f * 3 + 2);
            } else {
                i0 = f * 3;
                i1 = f * 3 + 1;
                i2 = f * 3 + 2;
            }

            // Get world-space vertices
            const v0 = new Vector3(position.getX(i0), position.getY(i0), position.getZ(i0)).applyMatrix4(mesh.matrixWorld);
            const v1 = new Vector3(position.getX(i1), position.getY(i1), position.getZ(i1)).applyMatrix4(mesh.matrixWorld);
            const v2 = new Vector3(position.getX(i2), position.getY(i2), position.getZ(i2)).applyMatrix4(mesh.matrixWorld);

            // Compute face normal and check if front-facing
            const edge1 = new Vector3().subVectors(v1, v0);
            const edge2 = new Vector3().subVectors(v2, v0);
            const normal = new Vector3().crossVectors(edge1, edge2).normalize();
            const faceMid = new Vector3().addVectors(v0, v1).add(v2).divideScalar(3);
            const viewDir = new Vector3().subVectors(cameraPos, faceMid);

            // Plane constant d for the plane equation ax + by + cz + d = 0
            // d = -(n . p)
            const constant = -normal.dot(v0);

            // Only include front-facing faces (back-facing can't occlude)
            if (normal.dot(viewDir) <= 0) continue;

            // Project to 2D
            const p0 = v0.clone().project(camera);
            const p1 = v1.clone().project(camera);
            const p2 = v2.clone().project(camera);

            // Convert to screen coordinates (with same scale as edges)
            const a2d = new Vector2(p0.x * halfWidth * internalScale, -p0.y * halfHeight * internalScale);
            const b2d = new Vector2(p1.x * halfWidth * internalScale, -p1.y * halfHeight * internalScale);
            const c2d = new Vector2(p2.x * halfWidth * internalScale, -p2.y * halfHeight * internalScale);

            // Compute depths (distance from camera)
            const depthA = cameraPos.distanceTo(v0);
            const depthB = cameraPos.distanceTo(v1);
            const depthC = cameraPos.distanceTo(v2);

            projectedFaces.push({
                a2d, b2d, c2d,
                depthA, depthB, depthC,
                mesh, faceIdx: f,
                normal,  // Store normal for post-split smooth filter
                constant // Store plane constant for coplanar detection
            });
        }
    }
    console.timeEnd('buildProjectedFaces');
    console.log(`Built ${projectedFaces.length} projected faces for occlusion`);

    // Classify silhouette edges (edges that border the void) - BEFORE cleanup/optimization
    console.time('classifySilhouettes');
    classifySilhouettes(splitEdges, projectedFaces);
    console.timeEnd('classifySilhouettes');

    // Geometric straggler filter: remove edges lying between coplanar faces
    console.time('filterSmoothSplitEdges');
    const smoothFilteredEdges = filterSmoothSplitEdges(splitEdges, projectedFaces, smoothThreshold, distanceThreshold);
    console.timeEnd('filterSmoothSplitEdges');

    // Occlusion using pure math
    let visibleEdges;
    if (skipOcclusion) {
        visibleEdges = smoothFilteredEdges;
    } else {
        console.time('testOcclusion (math)');
        // Test ALL edges through occlusion (no special treatment for profiles)
        visibleEdges = testOcclusionMath(smoothFilteredEdges, projectedFaces, camera);
        console.timeEnd('testOcclusion (math)');
    }
    console.log(`Visible edges: ${visibleEdges.length}`);

    console.time('optimize');
    const optimizedEdges = optimizeEdges(visibleEdges);
    console.timeEnd('optimize');

    console.time('cleanup orphans');
    const cleanedEdges = cleanupOrphanedEdges(optimizedEdges);
    console.timeEnd('cleanup orphans');

    // Remove completely isolated edges (orphaned at both ends)
    const filteredEdges = removeIsolatedEdges(cleanedEdges);
    console.log(`Final edges before optimization: ${filteredEdges.length}`);

    // Run through Optimize.js
    let optimizedFinal = filteredEdges;
    if (filteredEdges.length > 0) {
        let totalLen = 0;
        for (const e of filteredEdges) {
            const dx = e.b.x - e.a.x;
            const dy = e.b.y - e.a.y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
        }
        const avgLen = totalLen / filteredEdges.length;
        const smallDist = avgLen / 10;
        console.log(`Optimization: avgLen=${avgLen.toFixed(2)}, trim limit=${smallDist.toFixed(2)}`);

        console.time('Optimize.segments');
        // @ts-ignore - _segments is private but we need the raw objects to preserve metadata
        optimizedFinal = Optimize.segments(filteredEdges, false, true, smallDist, false, false, false)._segments;
        console.timeEnd('Optimize.segments');
        console.log(`After optimization: ${optimizedFinal.length} edges`);
    }



    // Scale edges back down to original coordinate space
    for (const edge of optimizedFinal) {
        edge.a.x /= internalScale;
        edge.a.y /= internalScale;
        edge.b.x /= internalScale;
        edge.b.y /= internalScale;
    }
    const finalEdges = optimizedFinal;

    return {
        edges: finalEdges,
        profiles: finalEdges.filter(e => e.isProfile),
        allEdges: splitEdges, // For debug visualization
        projectedFaces: projectedFaces  // For face visualization
    };
}

/**
 * Classify edges as silhouettes if they border the void (one side has no mesh)
 * Uses 2D ray casting from edge midpoint perpendicular to the edge
 * @param {Edge2D[]} edges - Edges to classify
 * @param {Object[]} projectedFaces - Projected triangles for hit testing
 */
function classifySilhouettes(edges, projectedFaces) {
    const RAY_LENGTH = 1000; // Long ray to ensure we hit any face on that side

    for (const edge of edges) {
        // Hatches are never silhouettes
        if (edge.isHatch) {
            edge.isSilhouette = false;
            continue;
        }

        // Calculate midpoint
        const midX = (edge.a.x + edge.b.x) / 2;
        const midY = (edge.a.y + edge.b.y) / 2;

        // Calculate edge direction and perpendicular
        const dx = edge.b.x - edge.a.x;
        const dy = edge.b.y - edge.a.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 0.001) {
            edge.isSilhouette = false;
            continue;
        }

        // Perpendicular direction (normalized)
        const perpX = -dy / len;
        const perpY = dx / len;

        // Raycast on each side - check if ray intersects any face edge
        const leftHit = rayHitsAnyFace(midX, midY, perpX, perpY, RAY_LENGTH, projectedFaces);
        const rightHit = rayHitsAnyFace(midX, midY, -perpX, -perpY, RAY_LENGTH, projectedFaces);

        // Silhouette if one side has no intersection
        edge.isSilhouette = !leftHit || !rightHit;
    }

    const silCount = edges.filter(e => e.isSilhouette).length;
    console.log(`Classified ${silCount} silhouette edges out of ${edges.length}`);
}

/**
 * Check if a 2D ray from origin in direction (dx, dy) intersects any projected triangle
 */
function rayHitsAnyFace(ox, oy, dx, dy, maxDist, faces) {
    for (const face of faces) {
        if (rayIntersectsTriangle(ox, oy, dx, dy, maxDist, face.a2d, face.b2d, face.c2d)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if 2D ray intersects a triangle (any of its 3 edges)
 */
function rayIntersectsTriangle(ox, oy, rdx, rdy, maxDist, a, b, c) {
    if (raySegmentIntersect(ox, oy, rdx, rdy, maxDist, a.x, a.y, b.x, b.y)) return true;
    if (raySegmentIntersect(ox, oy, rdx, rdy, maxDist, b.x, b.y, c.x, c.y)) return true;
    if (raySegmentIntersect(ox, oy, rdx, rdy, maxDist, c.x, c.y, a.x, a.y)) return true;
    return false;
}

/**
 * Check if 2D ray (origin ox,oy, direction rdx,rdy) intersects line segment (x1,y1)-(x2,y2)
 */
function raySegmentIntersect(ox, oy, rdx, rdy, maxDist, x1, y1, x2, y2) {
    const sdx = x2 - x1;
    const sdy = y2 - y1;

    const denom = rdx * sdy - rdy * sdx;
    if (Math.abs(denom) < 1e-10) return false; // Parallel

    const t = ((x1 - ox) * sdy - (y1 - oy) * sdx) / denom;
    const u = ((x1 - ox) * rdy - (y1 - oy) * rdx) / denom;

    // t > 0.1 (past origin, small epsilon), t <= maxDist, u in [0,1] (on segment)
    return t > 0.1 && t <= maxDist && u >= 0 && u <= 1;
}

/**
 * Check if a 2D point is inside any projected triangle
 * @param {number} px 
 * @param {number} py 
 * @param {Object[]} faces 
 * @returns {boolean}
 */
function pointInAnyFace(px, py, faces) {
    for (const face of faces) {
        if (pointInTriangle(px, py, face.a2d, face.b2d, face.c2d)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if point (px, py) is inside triangle (a, b, c) using barycentric coordinates
 * @param {number} px 
 * @param {number} py 
 * @param {Vector2} a 
 * @param {Vector2} b 
 * @param {Vector2} c 
 * @returns {boolean}
 */
function pointInTriangle(px, py, a, b, c) {
    const v0x = c.x - a.x;
    const v0y = c.y - a.y;
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = px - a.x;
    const v2y = py - a.y;

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v <= 1);
}

// @ts-check
/**
 * Edge-Based Hidden Line Renderer
 * 
 * A faster alternative to clipper-based boolean operations.
 * Uses spatial hashing and per-edge occlusion testing.
 */

import { Vector3, Vector2, Raycaster, Camera, Scene, Mesh } from "three";

/**
 * @typedef {Object} Edge3D
 * @property {Vector3} a - Start point (world space)
 * @property {Vector3} b - End point (world space)
 * @property {Vector3} normal1 - First face normal
 * @property {Vector3} [normal2] - Second face normal (if shared edge)
 * @property {number} faceIdx1 - First face index
 * @property {number} [faceIdx2] - Second face index
 * @property {Mesh} mesh - Parent mesh
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
 */

/**
 * Extract edges from a mesh with face normal information
 * @param {Mesh} mesh 
 * @returns {Edge3D[]}
 */
export function extractEdges(mesh) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;

    if (!position) return [];

    /** @type {Map<string, Edge3D>} */
    const edgeMap = new Map();

    const getEdgeKey = (ia, ib) => {
        const min = Math.min(ia, ib);
        const max = Math.max(ia, ib);
        return `${min}-${max}`;
    };

    const getVertex = (idx) => {
        return new Vector3(
            position.getX(idx),
            position.getY(idx),
            position.getZ(idx)
        ).applyMatrix4(mesh.matrixWorld);
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

        // Process three edges of the triangle
        const edges = [
            [i0, i1, v0, v1],
            [i1, i2, v1, v2],
            [i2, i0, v2, v0]
        ];

        for (const [ia, ib, va, vb] of edges) {
            const key = getEdgeKey(ia, ib);

            if (edgeMap.has(key)) {
                // Edge already exists - add second face normal
                const existing = edgeMap.get(key);
                existing.normal2 = normal.clone();
                existing.faceIdx2 = f;
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
        const facing2 = edge.normal2 ? edge.normal2.dot(viewDir) > 0 : false;

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
            if (similarity < smoothThreshold) {
                smoothFiltered.push(edge);
            }
            // Edges with similar normals are discarded (smooth surface)
        }
    }

    return { profiles, smoothFiltered };
}

/**
 * Project 3D edges to screen space
 * @param {Edge3D[]} edges 
 * @param {Camera} camera 
 * @param {number} width 
 * @param {number} height 
 * @returns {Edge2D[]}
 */
export function projectEdges(edges, camera, width, height) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const projectPoint = (p3d) => {
        const projected = p3d.clone().project(camera);
        return new Vector2(
            projected.x * halfWidth,
            -projected.y * halfHeight
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
        mesh: edge.mesh
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

    // Find all intersections
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const intersection = findIntersection(edges[i], edges[j]);
            if (intersection) {
                // Record split points for both edges
                if (!splits.has(edges[i])) splits.set(edges[i], []);
                if (!splits.has(edges[j])) splits.set(edges[j], []);

                splits.get(edges[i]).push({ t: intersection.t1, point: intersection.point });
                splits.get(edges[j]).push({ t: intersection.t2, point: intersection.point });
            }
        }
    }

    // Split edges at recorded points
    const result = [];

    for (const edge of edges) {
        const edgeSplits = splits.get(edge);

        if (!edgeSplits || edgeSplits.length === 0) {
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
                mesh: edge.mesh
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
            mesh: edge.mesh
        });
    }

    return result;
}

/**
 * Test edge visibility using raycasting
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
                // Skip hits on the same mesh as the edge (self-intersection)
                if (hit.object === edge.mesh) {
                    continue;
                }

                // Skip hits at or beyond the edge's depth (parent face)
                if (hit.distance >= expectedDist - relEps) {
                    continue;
                }

                // Something from another mesh is in front of the edge
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
 * @returns {{edges: Edge2D[], profiles: Edge2D[]}}
 */
export function computeHiddenLines(mesh, camera, scene, options = {}) {
    const {
        smoothThreshold = 0.99,
        gridSize = 32,
        occlusionEpsilon = 0.05, // 5% of distance tolerance
        skipOcclusion = false,
        width = 800,
        height = 600
    } = options;

    console.time('extractEdges');
    const edges3d = extractEdges(mesh);
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
    } else {
        console.time('testOcclusion');
        visibleEdges = testOcclusion(splitEdges, scene, camera, occlusionEpsilon);
        console.timeEnd('testOcclusion');
    }
    console.log(`Visible edges: ${visibleEdges.length}`);

    console.time('optimize');
    const finalEdges = optimizeEdges(visibleEdges);
    console.timeEnd('optimize');
    console.log(`Final edges: ${finalEdges.length}`);

    return {
        edges: finalEdges,
        profiles: finalEdges.filter(e => e.isProfile)
    };
}

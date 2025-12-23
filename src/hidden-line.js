// @ts-check
/**
 * Edge-Based Hidden Line Renderer
 * 
 * A faster alternative to clipper-based boolean operations.
 * Uses spatial hashing and per-edge occlusion testing.
 */

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
        faceIdx2: edge.faceIdx2,
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
 * Test edge visibility using pure math (point-in-triangle + depth)
 * No GPU, no raycasting - fully mathematical
 * @param {Edge2D[]} edges 
 * @param {Object[]} projectedFaces - Array of {a2d, b2d, c2d, depthA, depthB, depthC, mesh, faceIdx}
 * @param {Camera} camera
 * @returns {Edge2D[]}
 */
export function testOcclusionMath(edges, projectedFaces, camera) {
    const visibleEdges = [];
    const cameraPos = camera.position;

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

    console.log(`Occlusion debug: ${debugHitCount} point-in-triangle hits, ${debugOccludedCount} occluded`);
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
    const finalEdges = optimizeEdges(visibleEdges);
    console.timeEnd('optimize');
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
 * @returns {{edges: Edge2D[], profiles: Edge2D[]}}
 */
export function computeHiddenLinesMultiple(meshes, camera, scene, options = {}) {
    const {
        smoothThreshold = 0.99,
        gridSize = 32,
        skipOcclusion = false,
        width = 800,
        height = 600,
        renderer = null
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

    // Project to 2D
    let edges2d = projectEdges(allEdges, camera, width, height);

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

            // Only include front-facing faces (back-facing can't occlude)
            if (normal.dot(viewDir) <= 0) continue;

            // Project to 2D
            const p0 = v0.clone().project(camera);
            const p1 = v1.clone().project(camera);
            const p2 = v2.clone().project(camera);

            // Convert to screen coordinates
            const a2d = new Vector2(p0.x * halfWidth, -p0.y * halfHeight);
            const b2d = new Vector2(p1.x * halfWidth, -p1.y * halfHeight);
            const c2d = new Vector2(p2.x * halfWidth, -p2.y * halfHeight);

            // Compute depths (distance from camera)
            const depthA = cameraPos.distanceTo(v0);
            const depthB = cameraPos.distanceTo(v1);
            const depthC = cameraPos.distanceTo(v2);

            projectedFaces.push({
                a2d, b2d, c2d,
                depthA, depthB, depthC,
                mesh, faceIdx: f
            });
        }
    }
    console.timeEnd('buildProjectedFaces');
    console.log(`Built ${projectedFaces.length} projected faces for occlusion`);

    // Occlusion using pure math
    let visibleEdges;
    if (skipOcclusion) {
        visibleEdges = splitEdges;
    } else {
        console.time('testOcclusion (math)');
        // Test ALL edges through occlusion (no special treatment for profiles)
        visibleEdges = testOcclusionMath(splitEdges, projectedFaces, camera);
        console.timeEnd('testOcclusion (math)');
    }
    console.log(`Visible edges: ${visibleEdges.length}`);

    const finalEdges = optimizeEdges(visibleEdges);
    console.log(`Final edges: ${finalEdges.length}`);

    return {
        edges: finalEdges,
        profiles: finalEdges.filter(e => e.isProfile),
        allEdges: splitEdges // For debug visualization
    };
}

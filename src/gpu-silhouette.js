/**
 * GPU Normal-Region Polygon Extraction
 * 
 * Renders quantized normals to texture, uses connected component labeling
 * to find contiguous regions with same normal, then traces boundaries.
 * 
 * This approach is:
 * - Fast (GPU parallel rendering)
 * - 3D-aware (normals from actual geometry)
 * - Produces clean polygons grouped by normal direction
 */

import {
    WebGLRenderTarget,
    MeshNormalMaterial,
    MeshDepthMaterial,
    ShaderMaterial,
    RGBADepthPacking,
    NearestFilter,
    FrontSide,
    Vector2,
    Vector3
} from 'three';

/**
 * @typedef {Object} NormalRegion
 * @property {Vector2[]} boundary - Closed boundary polygon points
 * @property {Vector3} normal - The normal direction for this region
 * @property {number} area - Region area in pixels
 * @property {number} regionId - Unique ID for this region
 */

/**
 * Extract polygons grouped by normal direction
 * @param {WebGLRenderer} renderer
 * @param {Scene} scene
 * @param {Camera} camera
 * @param {Object} options
 * @returns {NormalRegion[]}
 */
export function extractNormalRegions(renderer, scene, camera, options = {}) {
    const {
        resolution = 2.0,        // Render at 2x for smooth boundaries
        normalBuckets = 12,      // Quantize normals into N directions
        minArea = 100,           // Minimum region area in pixels (at output scale)
        simplifyTolerance = 2.0,
        insetPixels = 0          // Inset boundaries by this many pixels (GPU erosion)
    } = options;

    const size = renderer.getSize(new Vector2());
    const width = Math.floor(size.x * resolution);
    const height = Math.floor(size.y * resolution);

    // Scale inset by resolution
    const insetAmount = Math.round(insetPixels * resolution);



    // Step 1: Render normals and depth to textures
    const normalPixels = renderNormals(renderer, scene, camera, width, height);
    const depthPixels = renderDepth(renderer, scene, camera, width, height);

    // Step 2: Quantize normals to region IDs
    const { regionMap, normalLookup } = quantizeNormals(normalPixels, width, height, normalBuckets);

    // Step 3: Connected component labeling
    const { labels, regionCount, labelToNormalId } = connectedComponents(regionMap, width, height);

    // Step 4: Trace boundaries for each region
    const regions = [];
    for (let regionId = 1; regionId <= regionCount; regionId++) {

        const boundary = traceBoundary(labels, width, height, regionId);
        if (boundary.length < 3) continue;

        // Simplify boundary
        const simplified = rdpSimplify(boundary, simplifyTolerance);
        const area = Math.abs(polygonArea(simplified));

        if (area < minArea) continue;

        // Get normal directly from the mapping (no sampling needed!)
        const normalId = labelToNormalId[regionId];
        const normal = normalLookup[normalId] || new Vector3(0, 0, 1);

        // Sample depth at region center
        const depth = sampleRegionDepth(labels, depthPixels, width, height, regionId);

        // Create inset boundary for hatch clipping (mathematical inset, not pixel erosion)
        const scaledInset = insetAmount / resolution;  // Convert back to screen coords

        // First convert to screen coords for inset calculation
        const screenBoundary = simplified.map(p => ({
            x: (p.x / resolution) - size.x / 2,
            y: (p.y / resolution) - size.y / 2
        }));

        // Apply mathematical inset
        const insetBoundaryScreen = insetPolygon(screenBoundary, scaledInset);

        regions.push({
            boundary: screenBoundary.map(p => new Vector2(p.x, p.y)),
            hatchBoundary: insetBoundaryScreen.map(p => new Vector2(p.x, p.y)),
            normal,
            depth,  // 0-1 normalized depth
            area: area / (resolution * resolution),
            regionId
        });
    }


    // Step 5: Detect holes (regions entirely inside another region)
    detectHoles(regions);

    return regions;
}


/**
 * Render normals to pixel buffer (exported for debugging)
 */
export function renderNormals(renderer, scene, camera, width, height) {
    const target = new WebGLRenderTarget(width, height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter
    });

    // Use MeshNormalMaterial for normal extraction
    // This outputs VIEW SPACE normals - we'll transform to world space later
    const normalMaterial = new MeshNormalMaterial({ flatShading: true });

    const originalMaterials = new Map();
    const hiddenObjects = [];

    scene.traverse(obj => {
        // Skip objects marked for SVG exclusion (including checking parent hierarchy)
        let shouldExclude = false;
        let parent = obj;
        while (parent) {
            if (parent.userData && parent.userData.excludeFromSVG) {
                shouldExclude = true;
                break;
            }
            parent = parent.parent;
        }

        if (shouldExclude) {
            if (obj.visible) {
                hiddenObjects.push(obj);
                obj.visible = false;
            }
            return;
        }

        // Only render Mesh objects, hide helpers/lines
        if (obj.isMesh) {
            originalMaterials.set(obj, obj.material);
            obj.material = normalMaterial;
        } else if (obj.isLineSegments || obj.isLine || obj.isPoints) {
            // Hide grid helpers, line helpers, etc.
            if (obj.visible) {
                hiddenObjects.push(obj);
                obj.visible = false;
            }
        }
    });

    // Save and clear scene background to avoid it being rendered to the target
    const originalBackground = scene.background;
    scene.background = null;

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);

    // Restore scene background
    scene.background = originalBackground;

    scene.traverse(obj => {
        if (obj.isMesh && originalMaterials.has(obj)) {
            obj.material = originalMaterials.get(obj);
        }
    });

    // Restore hidden objects (grid helpers, lines, etc.)
    for (const obj of hiddenObjects) {
        obj.visible = true;
    }

    renderer.setRenderTarget(null);

    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);

    target.dispose();
    normalMaterial.dispose();

    return pixels;
}

/**
 * Render depth to pixel buffer
 */
function renderDepth(renderer, scene, camera, width, height) {
    const target = new WebGLRenderTarget(width, height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter
    });

    const depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });

    const originalMaterials = new Map();
    const hiddenObjects = [];

    scene.traverse(obj => {
        // Skip objects marked for SVG exclusion (including checking parent hierarchy)
        let shouldExclude = false;
        let parent = obj;
        while (parent) {
            if (parent.userData && parent.userData.excludeFromSVG) {
                shouldExclude = true;
                break;
            }
            parent = parent.parent;
        }

        if (shouldExclude) {
            if (obj.visible) {
                hiddenObjects.push(obj);
                obj.visible = false;
            }
            return;
        }

        if (obj.isMesh) {
            originalMaterials.set(obj, obj.material);
            obj.material = depthMaterial;
        } else if (obj.isLineSegments || obj.isLine || obj.isPoints) {
            if (obj.visible) {
                hiddenObjects.push(obj);
                obj.visible = false;
            }
        }
    });

    // Save and clear scene background to avoid it being rendered to the target
    const originalBackground = scene.background;
    scene.background = null;

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);

    // Restore scene background
    scene.background = originalBackground;

    scene.traverse(obj => {
        if (obj.isMesh && originalMaterials.has(obj)) {
            obj.material = originalMaterials.get(obj);
        }
    });

    for (const obj of hiddenObjects) {
        obj.visible = true;
    }

    renderer.setRenderTarget(null);

    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);

    target.dispose();
    depthMaterial.dispose();

    return pixels;
}

/**
 * Sample average depth for a region
 */
function sampleRegionDepth(labels, depthPixels, width, height, targetLabel) {
    let sum = 0, count = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (labels[y * width + x] === targetLabel) {
                const idx = (y * width + x) * 4;
                // Unpack RGBA depth
                const r = depthPixels[idx] / 255;
                const g = depthPixels[idx + 1] / 255;
                const b = depthPixels[idx + 2] / 255;
                const a = depthPixels[idx + 3] / 255;
                const depth = r + g / 256 + b / 65536 + a / 16777216;
                sum += depth;
                count++;
            }
        }
    }

    return count > 0 ? sum / count : 0.5;
}

/**
 * Morphological erosion on region map
 * Only erodes pixels at the OUTER boundary (next to background 0)
 * Does NOT erode at boundaries between different regions (holes)
 */
function erodeRegionMap(regionMap, width, height, iterations) {
    let current = regionMap;

    for (let iter = 0; iter < iterations; iter++) {
        const next = new Uint16Array(current);  // Start with copy

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = y * width + x;
                const region = current[i];

                if (region === 0) continue;

                // Check 4-connected neighbors
                // Only erode if ANY neighbor is background (0)
                // Don't erode if neighbors are just different regions
                const left = current[i - 1];
                const right = current[i + 1];
                const up = current[i - width];
                const down = current[i + width];

                if (left === 0 || right === 0 || up === 0 || down === 0) {
                    next[i] = 0;  // Erode this pixel (it touches background)
                }
                // else: keep the pixel even if it touches other regions
            }
        }

        current = next;
    }

    return current;
}

/**

 * Quantize normals into buckets and create region map
 * Returns regionMap (pixel -> regionId) and normalLookup (regionId -> Vector3)
 */
function quantizeNormals(pixels, width, height, buckets) {
    const regionMap = new Uint16Array(width * height);
    const normalLookup = {}; // regionId -> Vector3 normal
    let nextId = 1;
    const normalToId = {}; // quantized normal string -> regionId

    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        // Background check (black = no geometry)
        if (r < 5 && g < 5 && b < 5) {
            regionMap[i] = 0; // Background
            continue;
        }

        // Decode normal from RGB (MeshNormalMaterial encodes: (n+1)/2 * 255)
        const nx = (r / 255) * 2 - 1;
        const ny = (g / 255) * 2 - 1;
        const nz = (b / 255) * 2 - 1;

        // Round RGB to nearest 4 for tolerance at grazing angles
        // This groups very similar normals together to avoid sub-pixel noise
        const tolerance = 4;
        const qr = Math.round(r / tolerance) * tolerance;
        const qg = Math.round(g / tolerance) * tolerance;
        const qb = Math.round(b / tolerance) * tolerance;
        const key = `${qr}|${qg}|${qb}`;

        if (!normalToId[key]) {
            normalToId[key] = nextId;
            normalLookup[nextId] = new Vector3(nx, ny, nz).normalize();
            nextId++;
        }

        regionMap[i] = normalToId[key];
    }

    return { regionMap, normalLookup };
}

/**
 * Connected component labeling using union-find
 */
function connectedComponents(regionMap, width, height) {
    const labels = new Uint32Array(width * height);
    const parent = [];
    let nextLabel = 1;

    function find(x) {
        if (parent[x] !== x) {
            parent[x] = find(parent[x]);
        }
        return parent[x];
    }

    function union(x, y) {
        const px = find(x);
        const py = find(y);
        if (px !== py) {
            parent[py] = px;
        }
    }

    // First pass: assign labels
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const region = regionMap[i];

            if (region === 0) continue; // Background

            const neighbors = [];

            // Check left neighbor
            if (x > 0 && regionMap[i - 1] === region && labels[i - 1] > 0) {
                neighbors.push(labels[i - 1]);
            }
            // Check top neighbor
            if (y > 0 && regionMap[i - width] === region && labels[i - width] > 0) {
                neighbors.push(labels[i - width]);
            }

            if (neighbors.length === 0) {
                // New label
                labels[i] = nextLabel;
                parent[nextLabel] = nextLabel;
                nextLabel++;
            } else {
                // Use minimum neighbor label
                const minLabel = Math.min(...neighbors);
                labels[i] = minLabel;
                // Union all neighbors
                for (const n of neighbors) {
                    union(minLabel, n);
                }
            }
        }
    }

    // Second pass: flatten labels and track which normalId each label maps to
    const labelRemap = {};
    const labelToNormalId = {}; // Maps final label -> regionMap value (normalId)
    let finalLabel = 0;

    for (let i = 0; i < width * height; i++) {
        if (labels[i] === 0) continue;
        const root = find(labels[i]);
        if (labelRemap[root] === undefined) {
            finalLabel++;
            labelRemap[root] = finalLabel;
            // Capture the normalId for this label (from regionMap)
            labelToNormalId[finalLabel] = regionMap[i];
        }
        labels[i] = labelRemap[root];
    }

    return { labels, regionCount: finalLabel, labelToNormalId };
}

/**
 * Trace boundary of a labeled region using Moore neighborhood
 */
function traceBoundary(labels, width, height, targetLabel) {
    const boundary = [];

    // Find starting point (leftmost pixel on top row of region)
    let startX = -1, startY = -1;
    outer: for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (labels[y * width + x] === targetLabel) {
                // Check if it's on boundary (has non-region neighbor)
                const hasEdge =
                    x === 0 || labels[y * width + x - 1] !== targetLabel ||
                    y === 0 || labels[(y - 1) * width + x] !== targetLabel;
                if (hasEdge) {
                    startX = x;
                    startY = y;
                    break outer;
                }
            }
        }
    }

    if (startX === -1) return boundary;

    // Moore neighborhood: 8 directions clockwise from right
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];

    let x = startX, y = startY;
    let dir = 7; // Start looking up-right
    const maxIter = width * height * 2;
    let iter = 0;

    do {
        boundary.push({ x, y });

        // Find next boundary pixel
        let found = false;
        for (let i = 0; i < 8; i++) {
            const checkDir = (dir + 6 + i) % 8; // Start from dir-2 (backtrack)
            const nx = x + dx[checkDir];
            const ny = y + dy[checkDir];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (labels[ny * width + nx] === targetLabel) {
                    x = nx;
                    y = ny;
                    dir = checkDir;
                    found = true;
                    break;
                }
            }
        }

        if (!found) break;
        iter++;
    } while ((x !== startX || y !== startY) && iter < maxIter);

    return boundary;
}

/**
 * Find representative normal for a region
 */
function findRegionNormal(labels, regionMap, normalLookup, width, height, targetLabel) {
    // Find center of region and sample normal
    let sumX = 0, sumY = 0, count = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (labels[y * width + x] === targetLabel) {
                sumX += x;
                sumY += y;
                count++;
            }
        }
    }

    if (count === 0) return new Vector3(0, 0, 1);

    const cx = Math.round(sumX / count);
    const cy = Math.round(sumY / count);
    const i = cy * width + cx;
    const normalId = regionMap[i];

    return normalLookup[normalId] || new Vector3(0, 0, 1);
}

/**
 * Ramer-Douglas-Peucker simplification
 */
function rdpSimplify(points, epsilon) {
    if (points.length < 3) return points;

    let maxDist = 0, maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], first, last);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }

    if (maxDist > epsilon) {
        const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
        const right = rdpSimplify(points.slice(maxIdx), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [first, last];
    }
}

function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) {
        return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }
    // Clamp t to [0,1] to get distance to segment, not infinite line
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

/**
 * Inset a polygon by a fixed distance (shrink inward)
 * Uses simple vertex offset along bisector of adjacent edges
 * @param {Array<{x: number, y: number}>} polygon
 * @param {number} amount - Inset amount in same units as polygon
 * @returns {Array<{x: number, y: number}>}
 */
function insetPolygon(polygon, amount) {
    if (polygon.length < 3 || amount <= 0) return polygon;

    const n = polygon.length;
    const result = [];

    // Determine winding direction (positive area = CCW)
    const area = polygonArea(polygon);
    const sign = area > 0 ? 1 : -1;

    for (let i = 0; i < n; i++) {
        const prev = polygon[(i - 1 + n) % n];
        const curr = polygon[i];
        const next = polygon[(i + 1) % n];

        // Compute edge vectors
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;

        // Normalize
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
        const nx1 = dx1 / len1, ny1 = dy1 / len1;
        const nx2 = dx2 / len2, ny2 = dy2 / len2;

        // Inward normals (perpendicular, pointing inward based on winding)
        const inx1 = -ny1 * sign, iny1 = nx1 * sign;
        const inx2 = -ny2 * sign, iny2 = nx2 * sign;

        // Average the two inward normals (bisector direction)
        let bx = inx1 + inx2;
        let by = iny1 + iny2;
        const blen = Math.sqrt(bx * bx + by * by) || 1;
        bx /= blen;
        by /= blen;

        // Scale by amount (adjust for angle at corner)
        const dot = inx1 * inx2 + iny1 * iny2;
        const scale = amount / Math.sqrt((1 + dot) / 2 + 0.001); // Miter factor

        result.push({
            x: curr.x + bx * Math.min(scale, amount * 3), // Cap miter
            y: curr.y + by * Math.min(scale, amount * 3)
        });
    }

    return result;
}


/**
 * Get axis-aligned bounding box for a polygon
 * @param {Array<{x: number, y: number}>} boundary
 * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
 */
function getBoundingBox(boundary) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pt of boundary) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
    }
    return { minX, maxX, minY, maxY };
}

/**
 * Check if inner bbox is fully contained within outer bbox
 */
function bboxContains(outer, inner) {
    return inner.minX >= outer.minX && inner.maxX <= outer.maxX &&
        inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}

/**
 * Point-in-polygon test using ray casting (even-odd rule)
 */
function pointInPolygon(x, y, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Detect which regions are holes (entirely inside another region)
 * Uses bounding box as early-out, then full point-in-polygon check
 */
function detectHoles(regions) {
    // Precompute bounding boxes
    const bboxes = regions.map(r => getBoundingBox(r.boundary));

    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        region.isHole = false;
        region.parentRegionId = null;

        const bbox = bboxes[i];

        for (let j = 0; j < regions.length; j++) {
            if (i === j) continue;

            const other = regions[j];
            const otherBbox = bboxes[j];

            // Early-out: bounding box check
            if (!bboxContains(otherBbox, bbox)) continue;

            // Full check: all boundary points must be inside other polygon
            const allInside = region.boundary.every(pt =>
                pointInPolygon(pt.x, pt.y, other.boundary)
            );

            if (allInside) {
                region.isHole = true;
                region.parentRegionId = other.regionId;
                break;
            }
        }
    }
}




/**
 * Debug visualization: show normal regions colored by their normal direction
 */
export function debugNormalRegions(renderer, scene, camera) {
    const size = renderer.getSize(new Vector2());
    const width = Math.floor(size.x);
    const height = Math.floor(size.y);

    const normalPixels = renderNormals(renderer, scene, camera, width, height);
    const { regionMap, normalLookup } = quantizeNormals(normalPixels, width, height, 12);
    const { labels, regionCount } = connectedComponents(regionMap, width, height);



    // Create visualization
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    // Generate colors for each region
    const regionColors = {};
    for (let i = 1; i <= regionCount; i++) {
        const hue = (i * 137.508) % 360; // Golden angle for good distribution
        regionColors[i] = hslToRgb(hue / 360, 0.7, 0.5);
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = (height - 1 - y) * width + x;
            const dstIdx = (y * width + x) * 4;
            const label = labels[srcIdx];

            if (label === 0) {
                imageData.data[dstIdx] = 30;
                imageData.data[dstIdx + 1] = 30;
                imageData.data[dstIdx + 2] = 30;
            } else {
                const [r, g, b] = regionColors[label] || [128, 128, 128];
                imageData.data[dstIdx] = r;
                imageData.data[dstIdx + 1] = g;
                imageData.data[dstIdx + 2] = b;
            }
            imageData.data[dstIdx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    // Show modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;cursor:pointer;';
    modal.onclick = () => modal.remove();
    canvas.style.cssText = 'max-width:90vw;max-height:90vh;border:2px solid lime;';
    const info = document.createElement('div');
    info.style.cssText = 'position:absolute;top:20px;left:20px;color:lime;font-family:monospace;';
    info.textContent = `${regionCount} regions, ${Object.keys(normalLookup).length} normal buckets (click to close)`;
    modal.appendChild(canvas);
    modal.appendChild(info);
    document.body.appendChild(modal);
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

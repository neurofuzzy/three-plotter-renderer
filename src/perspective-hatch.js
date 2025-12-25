/**
 * Perspective Hatching
 * 
 * Generates architect-style perspective hatches that converge toward
 * vanishing points based on face orientation.
 */

import { Vector2, Vector3 } from 'three';

/**
 * @typedef {Object} HatchLine
 * @property {Vector2} start
 * @property {Vector2} end
 */

/**
 * Compute the 2D hatch direction for a face based on its normal
 * Projects the face's primary axis to screen space
 * @param {Vector3} normal - Face normal in world space
 * @param {Camera} camera - Three.js camera
 * @param {number} screenWidth
 * @param {number} screenHeight
 * @returns {{direction: Vector2, vanishingPoint: Vector2|null}}
 */
export function computeHatchDirection(normal, camera, screenWidth, screenHeight) {
    const halfW = screenWidth / 2;
    const halfH = screenHeight / 2;

    // Find a primary axis direction in the face plane
    // For most faces, use the horizontal (XZ) direction projected onto the face
    const worldUp = new Vector3(0, 1, 0);
    const worldForward = new Vector3(0, 0, 1);

    // Get a vector in the face plane
    let faceAxis;

    // For horizontal faces (floor/ceiling), use world Z direction
    if (Math.abs(normal.y) > 0.9) {
        faceAxis = worldForward.clone();
    } else {
        // For vertical/angled faces, use horizontal direction in face plane
        // This is the cross product of normal with world up, gives horizontal direction in face
        faceAxis = new Vector3().crossVectors(worldUp, normal).normalize();

        // If face is vertical and facing up/down, cross product might be zero
        if (faceAxis.lengthSq() < 0.01) {
            faceAxis = worldForward.clone();
        }
    }

    // Project two points along this axis to screen to get 2D direction
    const origin = new Vector3(0, 0, 0);
    const farPoint = faceAxis.clone().multiplyScalar(100);

    const originScreen = origin.clone().project(camera);
    const farScreen = farPoint.clone().project(camera);

    // Convert to screen pixels
    const screenOrigin = new Vector2(
        originScreen.x * halfW,
        -originScreen.y * halfH
    );
    const screenFar = new Vector2(
        farScreen.x * halfW,
        -farScreen.y * halfH
    );

    // 2D direction on screen
    const direction = screenFar.clone().sub(screenOrigin).normalize();

    // Compute vanishing point by projecting point at infinity along this direction
    // VP is where parallel 3D lines converge in 2D
    const veryFarPoint = faceAxis.clone().multiplyScalar(100000);
    const vpProjected = veryFarPoint.clone().project(camera);

    // Check if VP is visible/finite
    let vanishingPoint = null;
    if (Math.abs(vpProjected.x) < 100 && Math.abs(vpProjected.y) < 100 && vpProjected.z < 1) {
        vanishingPoint = new Vector2(
            vpProjected.x * halfW,
            -vpProjected.y * halfH
        );
    }

    return { direction, vanishingPoint };
}

/**
 * Generate perspective hatch lines for a region
 * @param {Object} region - Region from extractNormalRegions
 * @param {Camera} camera
 * @param {Object} options
 * @returns {HatchLine[]}
 */
export function generatePerspectiveHatches(region, camera, options = {}) {
    const {
        baseSpacing = 8,      // Base spacing in screen pixels
        minSpacing = 3,       // Minimum spacing
        maxSpacing = 20,      // Maximum spacing
        depthFactor = 0.5,    // How much depth affects density
        screenWidth = 1200,
        screenHeight = 800,
        axisSettings = {}     // { x: { rotation: 0, spacing: 10 }, y: ... }
    } = options;

    const { boundary, normal, depth = 0.5 } = region;
    if (boundary.length < 3) return [];

    // Determine dominant axis
    const ax = Math.abs(normal.x);
    const ay = Math.abs(normal.y);
    const az = Math.abs(normal.z);

    let axis = 'y'; // default up
    if (ax >= ay && ax >= az) axis = 'x';
    else if (az >= ay && az >= ax) axis = 'z';

    // Get settings for this axis
    const settings = axisSettings[axis] || {};
    const rotationDeg = settings.rotation || 0;
    const spacingOverride = settings.spacing;

    console.log(`[Hatch] normal=(${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}) => axis=${axis}, rotation=${rotationDeg}, spacing=${spacingOverride}`);

    // Get hatch direction from normal
    const { direction, vanishingPoint } = computeHatchDirection(
        normal, camera, screenWidth, screenHeight
    );

    // Apply rotation if needed
    let finalDirection = direction;
    if (rotationDeg !== 0) {
        const rad = rotationDeg * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        finalDirection = new Vector2(
            direction.x * cos - direction.y * sin,
            direction.x * sin + direction.y * cos
        );
    }

    // Perpendicular direction for spacing
    const perpDir = new Vector2(-finalDirection.y, finalDirection.x);

    // Calculate spacing based on depth (closer = denser)
    // Use override if available, otherwise baseSpacing
    const effectiveBase = spacingOverride !== undefined ? spacingOverride : baseSpacing;
    const spacing = Math.max(minSpacing, Math.min(maxSpacing,
        effectiveBase + (depth * depthFactor * (maxSpacing - minSpacing))
    ));

    // Get bounding box of region
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const pt of boundary) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const center = new Vector2(centerX, centerY);

    // Size of region along perpendicular direction
    const diag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);

    const hatches = [];

    // If rotated, we can't easily use the VP logic unless we rotate the VP too, 
    // but typically architectural hatching with rotation implies a pattern override, 
    // so we'll often fall back to parallel for rotated patterns unless it's 0/90.
    // For now, if rotation is significant, force parallel to avoid weird VP artifacts.
    // OR: Rotate the vector from VP to center? 
    // Let's stick to parallel for significantly rotated hatches to keep it clean for now,
    // as "perspective rotated hatching" is geometrically ambiguous.
    const usePerspective = vanishingPoint && Math.abs(rotationDeg) < 5 && vanishingPoint.distanceTo(center) < diag * 5;

    if (usePerspective) {
        // Perspective lines converging to visible VP
        const vpDist = vanishingPoint.distanceTo(center);

        // Generate lines radiating from VP
        const numLines = Math.ceil(diag / spacing) * 2;
        const angularSpan = Math.atan2(diag, vpDist);
        const angleStep = angularSpan * 2 / numLines;

        // Angle from VP to center
        const centerAngle = Math.atan2(
            centerY - vanishingPoint.y,
            centerX - vanishingPoint.x
        );

        for (let i = -numLines; i <= numLines; i++) {
            const angle = centerAngle + i * angleStep;
            const dir = new Vector2(Math.cos(angle), Math.sin(angle));

            // Line from VP extending far past region
            const lineStart = vanishingPoint.clone();
            const lineEnd = vanishingPoint.clone().add(dir.clone().multiplyScalar(vpDist * 10));

            const clipped = clipLineToPolygon({ start: lineStart, end: lineEnd }, boundary);
            hatches.push(...clipped);
        }
    } else {
        // Parallel lines (VP at infinity or very far)
        const numLines = Math.ceil(diag / spacing) + 2;

        for (let i = -numLines; i <= numLines; i++) {
            // Offset along perpendicular direction
            const offset = perpDir.clone().multiplyScalar(i * spacing);
            const lineCenter = center.clone().add(offset);

            // Line extending in hatch direction
            const lineStart = lineCenter.clone().add(finalDirection.clone().multiplyScalar(-diag));
            const lineEnd = lineCenter.clone().add(finalDirection.clone().multiplyScalar(diag));

            const clipped = clipLineToPolygon({ start: lineStart, end: lineEnd }, boundary);
            hatches.push(...clipped);
        }
    }

    return hatches;
}

/**
 * Clip a line to a polygon
 */
export function clipLineToPolygon(line, polygon) {
    const intersections = [];
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % n];

        const intersection = lineIntersection(
            line.start.x, line.start.y, line.end.x, line.end.y,
            p1.x, p1.y, p2.x, p2.y
        );

        if (intersection) {
            intersections.push({
                point: new Vector2(intersection.x, intersection.y),
                t: intersection.t
            });
        }
    }

    if (intersections.length < 2) return [];

    // Sort by parameter along line
    intersections.sort((a, b) => a.t - b.t);

    // Create segments between consecutive pairs, checking midpoint is inside
    const result = [];
    for (let i = 0; i < intersections.length - 1; i++) {
        const midX = (intersections[i].point.x + intersections[i + 1].point.x) / 2;
        const midY = (intersections[i].point.y + intersections[i + 1].point.y) / 2;

        if (pointInPolygon(midX, midY, polygon)) {
            result.push({
                start: intersections[i].point,
                end: intersections[i + 1].point
            });
        }
    }

    return result;
}

/**
 * Clip a line to OUTSIDE a polygon (inverse of clipLineToPolygon)
 * Returns segments that are OUTSIDE the polygon
 */
export function clipLineOutsidePolygon(line, polygon) {
    const intersections = [];
    const n = polygon.length;

    // Add start and end points
    const startInside = pointInPolygon(line.start.x, line.start.y, polygon);
    const endInside = pointInPolygon(line.end.x, line.end.y, polygon);

    intersections.push({ point: line.start.clone(), t: 0, inside: startInside });

    // Find all intersections with polygon edges
    for (let i = 0; i < n; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % n];

        const intersection = lineIntersectionFull(
            line.start.x, line.start.y, line.end.x, line.end.y,
            p1.x, p1.y, p2.x, p2.y
        );

        if (intersection && intersection.t > 0 && intersection.t < 1) {
            intersections.push({
                point: new Vector2(intersection.x, intersection.y),
                t: intersection.t,
                inside: null // will be determined by neighbors
            });
        }
    }

    intersections.push({ point: line.end.clone(), t: 1, inside: endInside });

    // Sort by parameter
    intersections.sort((a, b) => a.t - b.t);

    // Remove duplicates (points too close together)
    const filtered = [intersections[0]];
    for (let i = 1; i < intersections.length; i++) {
        if (intersections[i].t - filtered[filtered.length - 1].t > 0.0001) {
            filtered.push(intersections[i]);
        }
    }

    if (filtered.length < 2) return [line]; // No intersections, check if line is outside

    // Build segments that are OUTSIDE
    const result = [];
    for (let i = 0; i < filtered.length - 1; i++) {
        const midT = (filtered[i].t + filtered[i + 1].t) / 2;
        const midX = line.start.x + midT * (line.end.x - line.start.x);
        const midY = line.start.y + midT * (line.end.y - line.start.y);

        // If midpoint is OUTSIDE polygon, include this segment
        if (!pointInPolygon(midX, midY, polygon)) {
            result.push({
                start: filtered[i].point.clone(),
                end: filtered[i + 1].point.clone()
            });
        }
    }

    return result;
}

// Full line intersection (both segments)
function lineIntersectionFull(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1),
            t
        };
    }
    return null;
}

function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1),
            t
        };
    }
    return null;
}

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

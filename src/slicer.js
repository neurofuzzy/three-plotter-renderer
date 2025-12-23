import { Vector3, Plane, Triangle } from 'three';

/**
 * World-Aligned Slicer
 * Generates hatch lines by slicing meshes with parallel planes.
 */
export class Slicer {

    /**
     * Compute hatch lines for a mesh
     * @param {import("three").Mesh} mesh 
     * @param {Object} options
     * @param {number} [options.spacing] - Spacing between hatch lines (default: 0.5)
     * @param {number} [options.offset] - Offset for plane spacing (default: 0)
     * @param {Vector3} [options.normal] - Normal of the slicing planes (default: Y axis [0,1,0])
     * @param {Vector3} [options.spacings] - Absolute spacing per axis (X,Y,Z). If provided, overrides 'spacing'.
     * @param {number} [options.rotation] - Rotation around Y axis in degrees (alternative to normal)
     * @returns {Array} List of edge objects {a: Vector3, b: Vector3, ...}
     */
    static computeSlices(mesh, options = {}) {
        const spacing = options.spacing || 0.5;
        const offset = options.offset || 0;
        let normal = options.normal ? options.normal.clone().normalize() : new Vector3(0, 1, 0);

        if (options.rotation !== undefined && !options.normal) {
            // Default cutting normal: (1, 0, 0) -> vertical slices along X axis
            normal = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), (options.rotation * Math.PI) / 180);
        }

        const edges = [];

        // Ensure world matrix is up to date
        mesh.updateMatrixWorld(true);

        const geometry = mesh.geometry;
        const index = geometry.index;
        const position = geometry.attributes.position;
        const numFaces = index ? index.count / 3 : position.count / 3;

        // Prepare face vertices (allocated once)
        const v0 = new Vector3();
        const v1 = new Vector3();
        const v2 = new Vector3();

        // Loop through all faces
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

            // Get world vertices for face
            v0.set(position.getX(i0), position.getY(i0), position.getZ(i0)).applyMatrix4(mesh.matrixWorld);
            v1.set(position.getX(i1), position.getY(i1), position.getZ(i1)).applyMatrix4(mesh.matrixWorld);
            v2.set(position.getX(i2), position.getY(i2), position.getZ(i2)).applyMatrix4(mesh.matrixWorld);

            // Compute face normal (for lighting/orientation if needed later)
            const edge1 = new Vector3().subVectors(v1, v0);
            const edge2 = new Vector3().subVectors(v2, v0);
            const faceNormal = new Vector3().crossVectors(edge1, edge2).normalize();

            // Calculate per-face spacing
            // If specific per-axis spacings are provided, blend them based on face orientation.
            let faceSpacing = spacing;
            if (options.spacings) {
                // Blend spacings based on face normal components (absolute)
                faceSpacing =
                    Math.abs(faceNormal.x) * options.spacings.x +
                    Math.abs(faceNormal.y) * options.spacings.y +
                    Math.abs(faceNormal.z) * options.spacings.z;
            }

            // Project vertices onto plane normal
            const d0 = v0.dot(normal);
            const d1 = v1.dot(normal);
            const d2 = v2.dot(normal);

            const minFaceD = Math.min(d0, Math.min(d1, d2));
            const maxFaceD = Math.max(d0, Math.max(d1, d2));

            // Determine which planes intersect this face using current faceSpacing
            // Plane equation: d = k * faceSpacing + offset
            const startPlaneIdx = Math.ceil((minFaceD - offset) / faceSpacing);
            const endPlaneIdx = Math.floor((maxFaceD - offset) / faceSpacing);

            for (let i = startPlaneIdx; i <= endPlaneIdx; i++) {
                const planeD = i * faceSpacing + offset;

                // Find intersection segment
                const intersections = [];

                // Check edge v0-v1
                checkEdgeIntersection(v0, v1, d0, d1, planeD, intersections);
                // Check edge v1-v2
                checkEdgeIntersection(v1, v2, d1, d2, planeD, intersections);
                // Check edge v2-v0
                checkEdgeIntersection(v2, v0, d2, d0, planeD, intersections);

                if (intersections.length === 2) {
                    const ha = intersections[0];
                    const hb = intersections[1];

                    // Add edge
                    edges.push({
                        a: ha,
                        b: hb,
                        normal1: faceNormal.clone(),
                        faceIdx1: f,
                        mesh: mesh,
                        isHatch: true // TAG THIS EDGE AS HATCH
                    });
                }
            }
        }

        return edges;
    }
}

/**
 * Helper to find intersection of edge and plane (d = constant)
 * @param {Vector3} p1 
 * @param {Vector3} p2 
 * @param {number} d1 - Dot product of p1 and plane normal
 * @param {number} d2 - Dot product of p2 and plane normal
 * @param {number} planeD - Plane constant
 * @param {Vector3[]} outPoints - Array to push intersection point to
 */
function checkEdgeIntersection(p1, p2, d1, d2, planeD, outPoints) {
    // Check if points are on opposite sides of plane
    if ((d1 < planeD && d2 > planeD) || (d1 > planeD && d2 < planeD)) {
        const t = (planeD - d1) / (d2 - d1);
        const p = new Vector3().lerpVectors(p1, p2, t);
        outPoints.push(p);
    }
    // Handle case where point lies exactly on plane?
    // Usually ignored for slicing to avoid duplicate/degenerate segments, or handled robustly.
    // Basic inequality check above avoids 0-length segments if vertices are on plane.
}

/**
 * three-plotter-renderer
 * 
 * An SVG renderer for Three.js with hidden line removal - designed for pen plotters and laser cutters
 */

// Main renderer
export { PlotterRenderer, SVGObject } from './plotter-renderer.js';

// Hidden line computation
export {
    computeHiddenLines,
    computeHiddenLinesMultiple,
    optimizeEdges,
    cleanupOrphanedEdges
} from './hidden-line.js';

// GPU silhouette extraction
export { extractNormalRegions } from './gpu-silhouette.js';

// Perspective hatching
export {
    generatePerspectiveHatches,
    clipLineToPolygon,
    clipLineOutsidePolygon
} from './perspective-hatch.js';

// Line optimization
export { Optimize } from './optimize.js';

// Geometry utilities
export { GeomUtil, Point, Segment, Segments } from './geom/geom.js';

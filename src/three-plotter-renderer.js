// Main library entry point - ES module exports
export { PlotterRenderer } from './plotter-renderer.js';
export { Projector, RenderableFace, RenderableVertex, RenderableSprite, RenderableLine } from './projector.js';
export { GeomUtil, Point, Segment } from './geom/geom.js';
export { BooleanShape } from './geom/booleanshape.js';
export { PolygonShape } from './geom/shapes.js';
export { Optimize } from './optimize.js';
export { Hatcher } from './hatcher.js';
export { Expander } from './expander.js';
export { extractSilhouettePolygons, extractNormalRegions } from './gpu-silhouette.js';
export { generatePerspectiveHatches, clipLineOutsidePolygon } from './perspective-hatch.js';
export { computeHiddenLines, computeHiddenLinesMultiple } from './hidden-line.js';

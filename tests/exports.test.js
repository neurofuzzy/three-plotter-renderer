import { describe, it, expect } from 'vitest';

describe('three-plotter-renderer', () => {
    it('exports all modules without errors', async () => {
        const exports = await import('../src/index.js');

        // Core renderer
        expect(exports.PlotterRenderer).toBeDefined();
        expect(exports.SVGObject).toBeDefined();

        // Hidden line
        expect(exports.computeHiddenLinesMultiple).toBeDefined();
        expect(exports.optimizeEdges).toBeDefined();

        // GPU silhouette
        expect(exports.extractNormalRegions).toBeDefined();

        // Perspective hatch
        expect(exports.generatePerspectiveHatches).toBeDefined();

        // Optimization
        expect(exports.Optimize).toBeDefined();

        // Geometry
        expect(exports.GeomUtil).toBeDefined();
    });

    it('PlotterRenderer can be instantiated', async () => {
        const { PlotterRenderer } = await import('../src/index.js');
        const renderer = new PlotterRenderer();

        expect(renderer).toBeDefined();
        expect(renderer.domElement).toBeDefined();
        expect(renderer.domElement.tagName.toLowerCase()).toBe('svg');
    });
});

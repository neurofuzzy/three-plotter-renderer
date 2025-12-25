# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-24

### Added
- **GPU-based rendering pipeline** - Uses WebGL for silhouette extraction and depth-aware hatching
- **PlotterRenderer API** - Clean, configurable API with layer toggles and styling options
- **Perspective hatching** - Depth-aware hatches that converge toward vanishing points
- **GPU silhouette extraction** - `extractNormalRegions()` for normal-based region detection
- **Hidden line rendering** - `computeHiddenLinesMultiple()` with silhouette edge detection
- **Hatch erosion** - `insetPixels` option to erode hatch boundaries from edges
- **Configurable styling** - Per-layer stroke colors and widths
- **TypeScript support** - Full type definitions in `src/index.d.ts`
- **Source maps** - Debug-friendly development builds
- **Barrel exports** - All public APIs exported from main entry point

### Changed
- Entry point changed from `plotter-renderer.js` to `index.js` (barrel export)
- Render order: silhouettes → hatches → edges (edges on top)
- SVG namespace attributes added for macOS/native rendering compatibility

### Removed
- Removed legacy projector-based shading code
- Removed `js-angusj-clipper` dependency (no longer used)
- Removed `BooleanShape`, `PolygonShape`, `Expander`, `Hatcher` imports

## [0.0.2] - 2024-12-22

### Changed
- Migrated from Parcel to Vite for development and builds
- Updated Three.js from v0.120.1 to v0.160.0
- Converted to ES modules

### Fixed
- Camera matrix updates now work correctly with OrbitControls
- Removed deprecated `THREE.Geometry` API usage
- Fixed resize handler using stale dimensions

### Removed
- Removed legacy `Geometry` class support (use `BufferGeometry`)
- Removed global `window.THREE` attachment pattern

## [0.0.1] - Initial Release

### Added
- PlotterRenderer with hidden line removal
- SVG output with layers (edges, outline, shading)
- Hatching with adjustable spacing and rotation
- Path optimization for plotters

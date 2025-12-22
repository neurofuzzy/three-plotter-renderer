# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

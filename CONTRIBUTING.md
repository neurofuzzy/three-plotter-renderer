# Contributing to three-plotter-renderer

Thank you for your interest in contributing! This project welcomes contributions of all kinds.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/three-plotter-renderer.git`
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`

## Development Workflow

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # Build production bundles (ES + UMD + sourcemaps)
npm run test     # Run tests with Vitest
```

## Project Structure

```
├── src/
│   ├── index.js              # Barrel export (main entry point)
│   ├── index.d.ts            # TypeScript declarations
│   ├── plotter-renderer.js   # Main PlotterRenderer class
│   ├── hidden-line.js        # Edge-based hidden line removal
│   ├── gpu-silhouette.js     # GPU normal-based region extraction
│   ├── perspective-hatch.js  # Depth-aware perspective hatching
│   ├── projector.js          # Three.js scene projection
│   ├── optimize.js           # Path optimization for plotters
│   └── geom/                  # Geometry utilities
├── examples/
│   ├── stl-viewer.html       # STL file viewer demo
│   └── output/               # Example SVG outputs
├── public/                   # Static assets
├── dist/                     # Built bundles
└── index.html                # Main primitives demo
```

## Key Components

| Module | Purpose |
|--------|---------|
| `PlotterRenderer` | Main renderer class, manages SVG layers and rendering pipeline |
| `computeHiddenLinesMultiple` | CPU-based hidden line computation with edge classification |
| `extractNormalRegions` | GPU-based region extraction using normal buffer |
| `generatePerspectiveHatches` | Creates perspective-aware hatch lines |
| `Optimize` | Path optimization to minimize pen travel |

## Making Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test with `npm run dev` and verify in browser
4. Run tests: `npm run test`
5. Build: `npm run build`
6. Commit with a clear message: `git commit -m "Add feature X"`
7. Push and open a Pull Request

## Code Style

- Use ES modules with explicit imports/exports
- Add JSDoc comments with types for public APIs
- Maintain TypeScript compatibility (update `index.d.ts` for API changes)
- Keep functions focused and well-documented

## Reporting Issues

When reporting bugs, please include:
- Browser and version
- Three.js version
- Steps to reproduce
- Expected vs actual behavior
- Console errors if any

## Questions?

Open an issue or reach out to [@neurofuzzy](https://github.com/neurofuzzy).

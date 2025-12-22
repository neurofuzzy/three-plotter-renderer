# three-plotter-renderer

[![npm version](https://img.shields.io/npm/v/three-plotter-renderer.svg)](https://www.npmjs.com/package/three-plotter-renderer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An SVG renderer for Three.js with hidden line removal - designed for pen plotters and laser cutters.

<img src="./examples/output/example02.png" width="60%" alt="Example render showing a 3D model converted to plottable SVG">

## Features

- 🎨 **Hidden line removal** - Occlusion-aware rendering produces clean, plottable output
- 📐 **Multi-layer SVG output** - Separate layers for edges, outlines, and hatching
- 🖊️ **Plotter-optimized** - Path optimization for efficient pen/laser movement
- 🔧 **Adjustable hatching** - Real-time control over shading patterns
- 📦 **Inkscape compatible** - Exports with proper layer structure

## Quick Start

```bash
npm install three-plotter-renderer three
```

```javascript
import * as THREE from 'three';
import { PlotterRenderer } from 'three-plotter-renderer';

const renderer = new PlotterRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// After setting up your scene and camera:
renderer.render(scene, camera);
```

## Development

```bash
git clone https://github.com/neurofuzzy/three-plotter-renderer.git
cd three-plotter-renderer
npm install
npm run dev     # Start dev server with hot reload
npm run build   # Build for production
npm run test    # Run tests
```

Open http://localhost:5173/examples/example02.html to see the demo.

## Usage

### Basic Setup

The renderer works like Three.js's built-in renderers:

```javascript
import * as THREE from 'three';
import { PlotterRenderer } from 'three-plotter-renderer';

const renderer = new PlotterRenderer();
renderer.setSize(800, 600);
document.getElementById('container').appendChild(renderer.domElement);

// Create scene, camera, and mesh as usual
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 800/600, 1, 1000);
camera.position.set(100, 100, 100);

const geometry = new THREE.BoxGeometry(50, 50, 50);
const material = new THREE.MeshPhongMaterial();
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Render
renderer.render(scene, camera);
```

### Triggering Optimized Render

The renderer has two modes:
1. **Wireframe mode** - Fast preview while interacting
2. **Optimized mode** - Full occlusion and hatching (set `renderer.doOptimize = true`)

```javascript
// After camera stops moving, trigger optimized render:
renderer.doOptimize = true;
renderer.render(scene, camera);
```

### Keyboard Controls (in examples)

| Key | Action |
|-----|--------|
| `,` / `.` | Switch hatch groups |
| `[` / `]` | Adjust rotation |
| `-` / `=` | Adjust spacing |

### Exporting SVG

```javascript
const svgContent = document.getElementById('container').innerHTML;
// Save svgContent to file
```

## Model Guidelines

For best results:

- ✅ Use CSG (Constructive Solid Geometry) models
- ✅ Keep faces as square as possible (use multiple segments)
- ❌ Avoid intersecting faces (touching is fine)
- ❌ Avoid extremely stretched faces

## SVG Layers

The exported SVG contains these layers (Inkscape-compatible):

| Layer | Description |
|-------|-------------|
| `outline_layer` | Silhouette outline |
| `edges_layer` | Visible edges |
| `shading_layer` | Hatching patterns |
| `polygons_layer` | Face polygons (hidden) |

## How It Works

1. Project scene faces using Three.js Projector
2. Group faces by normal direction and depth
3. For each face (back to front):
   - Union to its normal group
   - Subtract from all other groups
   - Union to outline group
4. Apply hatching based on lighting
5. Optimize path order for plotting

## API

### PlotterRenderer

```typescript
class PlotterRenderer {
  domElement: SVGElement;
  doOptimize: boolean;
  
  setSize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setClearColor(color: THREE.Color): void;
}
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT © [Geoff Gaudreault](https://github.com/neurofuzzy)

/**
 * PlotterRenderer - GPU-based SVG renderer for Three.js
 * Based on SVGRenderer by @mrdoob / http://mrdoob.com/
 */

import { Camera, Color, Object3D, Vector3, DirectionalLight, PointLight, SpotLight } from "three";
import { extractNormalRegions, renderNormals as debugRenderNormals } from "./gpu-silhouette.js";
export { debugRenderNormals };
import { generatePerspectiveHatches, clipLineOutsidePolygon } from "./perspective-hatch.js";
import { computeHiddenLinesMultiple } from "./hidden-line.js";

var lop = (n) => {
  return Math.round(n * 100) / 100;
};

var SVGObject = function (node) {
  Object3D.call(this);
  this.node = node;
};

SVGObject.prototype = Object.create(Object3D.prototype);
SVGObject.prototype.constructor = SVGObject;

var PlotterRenderer = function () {
  var _this = this,
    _svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    _silhouettes = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _edges = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _shading = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _svgWidth,
    _svgHeight,
    _svgWidthHalf,
    _svgHeightHalf,
    _clearColor = new Color();

  // Add proper SVG namespace attributes for macOS and native rendering
  _svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  _svg.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
  _svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  _svg.setAttribute("version", "1.1");

  // Setup SVG layers (order determines z-index: later = on top)
  _silhouettes.setAttribute("inkscape:label", "Silhouettes");
  _silhouettes.setAttribute("inkscape:groupmode", "layer");
  _silhouettes.id = "silhouettes_layer";
  _svg.appendChild(_silhouettes);

  _shading.setAttribute("inkscape:label", "Shading");
  _shading.setAttribute("inkscape:groupmode", "layer");
  _shading.id = "shading_layer";
  _svg.appendChild(_shading);

  _edges.setAttribute("inkscape:label", "Edges");
  _edges.setAttribute("inkscape:groupmode", "layer");
  _edges.id = "edges_layer";
  _svg.appendChild(_edges);

  this.domElement = _svg;

  // Layer toggles
  this.showSilhouettes = true;
  this.showEdges = true;
  this.showHatches = true;

  // Theme definitions
  this.themes = {
    light: {
      background: '#ffffff',
      edgeStroke: '#000000',
      hatchStroke: '#444444',
      silhouetteFill: (n) => `rgba(${Math.floor((n.x * 0.5 + 0.5) * 40 + 200)},${Math.floor((n.y * 0.5 + 0.5) * 40 + 200)},${Math.floor((n.z * 0.5 + 0.5) * 40 + 200)},0.3)`
    },
    dark: {
      background: '#222222',
      edgeStroke: '#ffffff',
      hatchStroke: '#aaaaaa',
      silhouetteFill: (n) => `rgba(${Math.floor((n.x * 0.5 + 0.5) * 255)},${Math.floor((n.y * 0.5 + 0.5) * 255)},${Math.floor((n.z * 0.5 + 0.5) * 255)},0.3)`
    }
  };

  // Current theme
  this.theme = 'dark';

  // Silhouette options (GPU normal regions)
  this.silhouetteOptions = {
    normalBuckets: 12,
    simplifyTolerance: 2.0,
    minArea: 100
  };

  // Hatch options (perspective hatching)
  this.hatchOptions = {
    baseSpacing: 8,
    minSpacing: 3,
    maxSpacing: 40,
    depthFactor: 0.5,
    insetPixels: 3,
    stroke: null,  // null = use theme
    strokeWidth: '1px',
    axisSettings: {
      x: { rotation: 0, spacing: 8 },
      y: { rotation: 0, spacing: 8 },
      z: { rotation: 0, spacing: 8 }
    },
    // Brightness-based shading
    brightnessShading: {
      enabled: false,           // Enable lighting-based density
      invert: false,            // True for white pen on black paper
      lightDirection: null      // Override: Vector3 or null (auto from scene)
    }
  };

  // Edge options (hidden line edges)
  this.edgeOptions = {
    stroke: null,  // null = use theme
    strokeWidth: '1px'
  };

  // Hidden-line options
  this.hiddenLineOptions = {
    smoothThreshold: 0.99
  };

  // WebGL renderer reference (needed for GPU operations)
  this._glRenderer = null;

  this.autoClear = true;

  this.setClearColor = function (color) {
    _clearColor.set(color);
  };

  this.setPixelRatio = function () { };

  this.setSize = function (width, height) {
    _svgWidth = width;
    _svgHeight = height;
    _svgWidthHalf = _svgWidth / 2;
    _svgHeightHalf = _svgHeight / 2;

    _svg.setAttribute("viewBox", -_svgWidthHalf + " " + -_svgHeightHalf + " " + _svgWidth + " " + _svgHeight);
    _svg.setAttribute("width", _svgWidth);
    _svg.setAttribute("height", _svgHeight);
  };

  this.getSize = function () {
    return {
      width: _svgWidth,
      height: _svgHeight,
    };
  };

  this.setGLRenderer = function (glRenderer) {
    _this._glRenderer = glRenderer;
  };

  function removeChildNodes() {
    while (_silhouettes.childNodes.length > 0) {
      _silhouettes.removeChild(_silhouettes.childNodes[0]);
    }
    while (_edges.childNodes.length > 0) {
      _edges.removeChild(_edges.childNodes[0]);
    }
    while (_shading.childNodes.length > 0) {
      _shading.removeChild(_shading.childNodes[0]);
    }
  }

  this.clear = function () {
    removeChildNodes();
    _svg.style.backgroundColor = _clearColor.getStyle();
  };

  /**
   * Render GPU-based layers (silhouettes and hatches)
   * @param {Object} scene - Three.js scene
   * @param {Object} camera - Three.js camera
   */
  this.renderGPULayers = function (scene, camera) {
    if (!_this._glRenderer) {
      console.warn("PlotterRenderer: WebGL renderer not set. Call setGLRenderer() first.");
      return;
    }

    const glRenderer = _this._glRenderer;

    // GPU Silhouettes (region fills based on normal direction)
    if (_this.showSilhouettes || _this.showHatches) {
      const regions = extractNormalRegions(glRenderer, scene, camera, {
        normalBuckets: _this.silhouetteOptions.normalBuckets,
        simplifyTolerance: _this.silhouetteOptions.simplifyTolerance,
        minArea: _this.silhouetteOptions.minArea,
        insetPixels: _this.showHatches ? _this.hatchOptions.insetPixels : 0
      });

      // Draw silhouette fills
      if (_this.showSilhouettes) {
        regions.forEach(region => {
          if (region.boundary.length < 3) return;

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          let d = "";
          region.boundary.forEach((pt, i) => {
            const x = pt.x;
            const y = -pt.y; // GPU regions use different Y convention
            d += (i === 0 ? "M" : "L") + lop(x) + "," + lop(y);
          });
          d += "Z";

          // Color based on normal direction (use theme if available)
          const n = region.normal;
          const currentTheme = _this.themes[_this.theme] || _this.themes.dark;
          const fillColor = currentTheme.silhouetteFill ? currentTheme.silhouetteFill(n) : `rgba(${Math.floor((n.x * 0.5 + 0.5) * 255)},${Math.floor((n.y * 0.5 + 0.5) * 255)},${Math.floor((n.z * 0.5 + 0.5) * 255)},0.3)`;

          path.setAttribute("d", d);
          path.setAttribute("fill", fillColor);
          path.setAttribute("stroke", "none");
          _silhouettes.appendChild(path);
        });
      }

      // GPU Perspective Hatches (render before edges so edges appear on top)
      if (_this.showHatches) {
        // Sort by depth (front first) for occlusion
        regions.sort((a, b) => a.depth - b.depth);
        const allRegionBounds = regions.map(r => r.boundary);

        // Compute light direction for brightness shading
        let lightDir = null;
        const shadingOpts = _this.hatchOptions.brightnessShading || {};
        if (shadingOpts.enabled) {
          if (shadingOpts.lightDirection) {
            lightDir = shadingOpts.lightDirection.clone().normalize();
          } else {
            // Auto-detect from scene: find first directional/point/spot light
            scene.traverse((obj) => {
              if (lightDir) return;
              if (obj.isDirectionalLight) {
                // Direction = from target toward light position
                lightDir = new Vector3().subVectors(obj.position, obj.target.position).normalize();
              } else if (obj.isPointLight) {
                lightDir = obj.position.clone().normalize();
              } else if (obj.isSpotLight) {
                lightDir = obj.position.clone().normalize();
              }
            });
            if (!lightDir) {
              lightDir = new Vector3(1, 1, 1).normalize();
            }
          }

          // Transform to view space (MeshNormalMaterial gives view-space normals)
          lightDir = lightDir.clone().transformDirection(camera.matrixWorldInverse);
        }

        regions.forEach((region, idx) => {
          // Compute brightness: N·L (Lambertian)
          let brightness = null;
          if (lightDir && shadingOpts.enabled) {
            brightness = Math.max(0, region.normal.dot(lightDir));
          }

          // Time budget for this region (abort if taking too long)
          const regionStartTime = performance.now();
          const regionTimeBudget = _this.hatchOptions.regionTimeBudget || 100; // ms per region

          let hatches = generatePerspectiveHatches(region, camera, {
            baseSpacing: _this.hatchOptions.baseSpacing,
            minSpacing: _this.hatchOptions.minSpacing,
            maxSpacing: _this.hatchOptions.maxSpacing,
            depthFactor: _this.hatchOptions.depthFactor,
            insetPixels: _this.hatchOptions.insetPixels,
            screenWidth: _svgWidth,
            screenHeight: _svgHeight,
            axisSettings: _this.hatchOptions.axisSettings,
            brightness: brightness,
            invertBrightness: shadingOpts.invert || false
          });

          // Check time budget after hatch generation
          if (performance.now() - regionStartTime > regionTimeBudget) {
            console.warn(`Region ${idx} hatch generation exceeded time budget, skipping`);
            return; // Skip this region entirely
          }

          // Clip against front regions (with time budget check)
          for (let frontIdx = 0; frontIdx < idx; frontIdx++) {
            hatches = hatches.flatMap(hatch =>
              clipLineOutsidePolygon(hatch, allRegionBounds[frontIdx])
            );

            // Check time budget during clipping
            if (performance.now() - regionStartTime > regionTimeBudget) {
              console.warn(`Region ${idx} clipping exceeded time budget, aborting`);
              hatches = []; // Clear hatches and bail
              break;
            }
          }

          // Draw hatches (boustrophedon: flip alternating lines to minimize pen travel)
          const hatchTheme = _this.themes[_this.theme] || _this.themes.dark;
          const hatchStroke = _this.hatchOptions.stroke || hatchTheme.hatchStroke;

          if (_this.hatchOptions.connectHatches && hatches.length > 0) {
            // Connect all hatches into one continuous polyline
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            let d = "";
            hatches.forEach((hatch, hatchIdx) => {
              const start = hatchIdx % 2 === 0 ? hatch.start : hatch.end;
              const end = hatchIdx % 2 === 0 ? hatch.end : hatch.start;
              if (hatchIdx === 0) {
                d += `M${lop(start.x)},${lop(-start.y)}`;
              } else {
                d += `L${lop(start.x)},${lop(-start.y)}`;  // Connect to next hatch start
              }
              d += `L${lop(end.x)},${lop(-end.y)}`;
            });
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", hatchStroke);
            path.setAttribute("stroke-width", _this.hatchOptions.strokeWidth);
            _shading.appendChild(path);
          } else {
            // Individual hatch lines
            hatches.forEach((hatch, hatchIdx) => {
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              // Flip start/end on odd indices for zigzag pen path
              const start = hatchIdx % 2 === 0 ? hatch.start : hatch.end;
              const end = hatchIdx % 2 === 0 ? hatch.end : hatch.start;
              const d = `M${lop(start.x)},${lop(-start.y)}L${lop(end.x)},${lop(-end.y)}`;
              path.setAttribute("d", d);
              path.setAttribute("fill", "none");
              path.setAttribute("stroke", hatchStroke);
              path.setAttribute("stroke-width", _this.hatchOptions.strokeWidth);
              _shading.appendChild(path);
            });
          }
        });
      }
    }

    // Hidden Line Edges (render last so they appear on top)
    // This is OUTSIDE the silhouettes/hatches block so edges can render independently
    if (_this.showEdges) {
      // Collect all meshes from scene (excluding those marked for SVG exclusion)
      const meshes = [];
      scene.traverse((obj) => {
        if (!obj.isMesh || !obj.geometry) return;

        // Check parent hierarchy for exclusion flag
        let excluded = false;
        let parent = obj;
        while (parent) {
          if (parent.userData && parent.userData.excludeFromSVG) {
            excluded = true;
            break;
          }
          parent = parent.parent;
        }

        if (!excluded) {
          meshes.push(obj);
        }
      });

      if (meshes.length > 0) {
        const result = computeHiddenLinesMultiple(meshes, camera, scene, {
          smoothThreshold: _this.hiddenLineOptions.smoothThreshold,
          width: _svgWidth,
          height: _svgHeight
        });
        const edges = result.edges || [];

        const edgeTheme = _this.themes[_this.theme] || _this.themes.dark;
        const edgeStroke = _this.edgeOptions.stroke || edgeTheme.edgeStroke;

        edges.forEach(edge => {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", lop(edge.a.x));
          line.setAttribute("y1", lop(edge.a.y));
          line.setAttribute("x2", lop(edge.b.x));
          line.setAttribute("y2", lop(edge.b.y));
          line.setAttribute("stroke", edgeStroke);
          line.setAttribute("stroke-width", _this.edgeOptions.strokeWidth);
          _edges.appendChild(line);
        });
      }
    }
  };

  /**
   * Legacy render method - renders wireframe preview during camera movement
   * For final output, use clear() + renderGPULayers()
   * @param {Object} scene - Three.js scene
   * @param {Object} camera - Three.js camera
   */
  this.render = function (scene, camera) {
    if (camera instanceof Camera === false) {
      console.error("PlotterRenderer.render: camera is not an instance of Camera.");
      return;
    }

    // For now, render is a no-op. Use renderGPULayers() for output.
    // This maintains API compatibility with Three.js SVGRenderer
  };

};

export { SVGObject, PlotterRenderer };

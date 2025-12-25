/**
 * PlotterRenderer - GPU-based SVG renderer for Three.js
 * Based on SVGRenderer by @mrdoob / http://mrdoob.com/
 */

import { Box2, Camera, Color, Matrix3, Matrix4, Object3D, Vector3 } from "three";
import { extractNormalRegions } from "./gpu-silhouette.js";
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
    stroke: 'black',
    strokeWidth: '1px',
    axisSettings: {
      x: { rotation: 0, spacing: 8 },
      y: { rotation: 0, spacing: 8 },
      z: { rotation: 0, spacing: 8 }
    }
  };

  // Edge options (hidden line edges)
  this.edgeOptions = {
    stroke: 'white',
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

          // Color based on normal direction
          const n = region.normal;
          const r = Math.floor((n.x * 0.5 + 0.5) * 255);
          const g = Math.floor((n.y * 0.5 + 0.5) * 255);
          const b = Math.floor((n.z * 0.5 + 0.5) * 255);

          path.setAttribute("d", d);
          path.setAttribute("fill", `rgba(${r},${g},${b},0.3)`);
          path.setAttribute("stroke", "none");
          _silhouettes.appendChild(path);
        });
      }

      // GPU Perspective Hatches (render before edges so edges appear on top)
      if (_this.showHatches) {
        // Sort by depth (front first) for occlusion
        regions.sort((a, b) => a.depth - b.depth);
        const allRegionBounds = regions.map(r => r.boundary);

        regions.forEach((region, idx) => {
          let hatches = generatePerspectiveHatches(region, camera, {
            baseSpacing: _this.hatchOptions.baseSpacing,
            minSpacing: _this.hatchOptions.minSpacing,
            maxSpacing: _this.hatchOptions.maxSpacing,
            depthFactor: _this.hatchOptions.depthFactor,
            insetPixels: _this.hatchOptions.insetPixels,
            screenWidth: _svgWidth,
            screenHeight: _svgHeight,
            axisSettings: _this.hatchOptions.axisSettings
          });

          // Clip against front regions
          for (let frontIdx = 0; frontIdx < idx; frontIdx++) {
            hatches = hatches.flatMap(hatch =>
              clipLineOutsidePolygon(hatch, allRegionBounds[frontIdx])
            );
          }

          // Draw hatches
          hatches.forEach(hatch => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = `M${lop(hatch.start.x)},${lop(-hatch.start.y)}L${lop(hatch.end.x)},${lop(-hatch.end.y)}`;
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", _this.hatchOptions.stroke);
            path.setAttribute("stroke-width", _this.hatchOptions.strokeWidth);
            _shading.appendChild(path);
          });
        });
      }

      // Hidden Line Edges (render last so they appear on top)
      if (_this.showEdges) {
        // Collect all meshes from scene
        const meshes = [];
        scene.traverse((obj) => {
          if (obj.isMesh && obj.geometry) {
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

          edges.forEach(edge => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", lop(edge.a.x));
            line.setAttribute("y1", lop(edge.a.y));
            line.setAttribute("x2", lop(edge.b.x));
            line.setAttribute("y2", lop(edge.b.y));
            line.setAttribute("stroke", _this.edgeOptions.stroke);
            line.setAttribute("stroke-width", _this.edgeOptions.strokeWidth);
            _edges.appendChild(line);
          });
        }
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

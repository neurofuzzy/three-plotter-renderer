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
    insetPixels: 2,
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
    },
    // Async rendering options
    frameBudgetMs: 16,          // Max ms per frame (16ms = ~60fps)
    progressCallback: null      // Optional: (progress: 0-1) => void
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
   * Returns a Promise that resolves when rendering is complete.
   * Uses frame budgeting to avoid blocking the browser on complex models.
   * @param {Object} scene - Three.js scene
   * @param {Object} camera - Three.js camera
   * @returns {Promise<void>}
   */
  this.renderGPULayers = async function (scene, camera) {
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
        // Use hatchBoundary for clipping (inset boundary, falls back to regular boundary)
        const allRegionBounds = regions.map(r => r.hatchBoundary || r.boundary);

        // Compute zoom-invariant spacing scale factor
        // Project scene bounding box to screen space, use that size relative to canvas
        let spacingScale = 1.0;
        {
          // Compute world-space bounding box of all meshes in scene
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;

          scene.traverse((obj) => {
            if (!obj.isMesh || !obj.geometry) return;
            obj.geometry.computeBoundingBox();
            const bbox = obj.geometry.boundingBox;
            if (!bbox) return;

            // Transform bbox corners to world space
            const corners = [
              new Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
              new Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
              new Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
              new Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
              new Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
              new Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
              new Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
              new Vector3(bbox.max.x, bbox.max.y, bbox.min.z)
            ];
            for (const corner of corners) {
              corner.applyMatrix4(obj.matrixWorld);
              minX = Math.min(minX, corner.x);
              maxX = Math.max(maxX, corner.x);
              minY = Math.min(minY, corner.y);
              maxY = Math.max(maxY, corner.y);
              minZ = Math.min(minZ, corner.z);
              maxZ = Math.max(maxZ, corner.z);
            }
          });

          // Project bbox corners to screen space and compute screen-space bbox
          if (isFinite(minX)) {
            const worldCorners = [
              new Vector3(minX, minY, minZ),
              new Vector3(maxX, maxY, maxZ),
              new Vector3(minX, minY, maxZ),
              new Vector3(minX, maxY, minZ),
              new Vector3(maxX, minY, minZ),
              new Vector3(minX, maxY, maxZ),
              new Vector3(maxX, minY, maxZ),
              new Vector3(maxX, maxY, minZ)
            ];

            let screenMinX = Infinity, screenMaxX = -Infinity;
            let screenMinY = Infinity, screenMaxY = -Infinity;

            for (const corner of worldCorners) {
              const projected = corner.clone().project(camera);
              const screenX = (projected.x + 1) * _svgWidth / 2;
              const screenY = (1 - projected.y) * _svgHeight / 2;
              screenMinX = Math.min(screenMinX, screenX);
              screenMaxX = Math.max(screenMaxX, screenX);
              screenMinY = Math.min(screenMinY, screenY);
              screenMaxY = Math.max(screenMaxY, screenY);
            }

            const screenWidth = screenMaxX - screenMinX;
            const screenHeight = screenMaxY - screenMinY;
            const screenSize = Math.max(screenWidth, screenHeight);
            const canvasSize = Math.max(_svgWidth, _svgHeight);

            // Scale factor: model screen size / canvas size
            // When model fills canvas, spacingScale = 1
            // When model is smaller, spacingScale < 1 (denser relative spacing)
            if (screenSize > 0 && canvasSize > 0) {
              spacingScale = screenSize / canvasSize;
            }

          }
        }






        // Collect hole regions for clipping (regardless of depth order)
        const holeRegions = regions.filter(r => r.isHole);


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

        // Frame budget settings
        const frameBudgetMs = _this.hatchOptions.frameBudgetMs || 16;
        const progressCallback = _this.hatchOptions.progressCallback;
        let frameStartTime = performance.now();

        // Process regions with frame budgeting (yields control to browser)
        for (let idx = 0; idx < regions.length; idx++) {
          const region = regions[idx];

          // Compute brightness: N·L (Lambertian)
          let brightness = null;
          if (lightDir && shadingOpts.enabled) {
            brightness = Math.max(0, region.normal.dot(lightDir));
          }

          // Time budget for this region (abort if taking too long)
          const regionStartTime = performance.now();
          const regionTimeBudget = _this.hatchOptions.regionTimeBudget || 100; // ms per region

          // Scale axisSettings spacing values too
          const scaledAxisSettings = {};
          const rawAxisSettings = _this.hatchOptions.axisSettings || {};
          for (const axis of ['x', 'y', 'z']) {
            const settings = rawAxisSettings[axis] || {};
            scaledAxisSettings[axis] = {
              rotation: settings.rotation || 0,
              spacing: (settings.spacing || _this.hatchOptions.baseSpacing) * spacingScale
            };
          }

          let hatches = generatePerspectiveHatches(region, camera, {
            baseSpacing: _this.hatchOptions.baseSpacing * spacingScale,
            minSpacing: _this.hatchOptions.minSpacing * spacingScale,
            maxSpacing: _this.hatchOptions.maxSpacing * spacingScale,
            depthFactor: _this.hatchOptions.depthFactor,
            insetPixels: _this.hatchOptions.insetPixels,
            screenWidth: _svgWidth,
            screenHeight: _svgHeight,
            axisSettings: scaledAxisSettings,
            brightness: brightness,
            invertBrightness: shadingOpts.invert || false
          });



          // Check time budget after hatch generation
          if (performance.now() - regionStartTime > regionTimeBudget) {
            console.warn(`Region ${idx} hatch generation exceeded time budget, skipping`);
            continue; // Skip this region entirely
          }

          // Clip against front regions (with time budget check)
          // Skip clipping holes against their parent region (otherwise hole hatches get removed)
          for (let frontIdx = 0; frontIdx < idx; frontIdx++) {
            const frontRegion = regions[frontIdx];

            // Don't clip a hole against its parent - the hole IS inside the parent
            if (region.isHole && region.parentRegionId === frontRegion.regionId) {
              continue;
            }

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


          // Clip against holes that are children of this region
          // (holes whose parentRegionId matches this region's regionId)
          for (const holeRegion of holeRegions) {
            if (holeRegion.parentRegionId !== region.regionId) continue;
            if (hatches.length === 0) break;
            hatches = hatches.flatMap(hatch =>
              clipLineOutsidePolygon(hatch, holeRegion.boundary)
            );
          }



          // Draw hatches (boustrophedon: flip alternating lines to minimize pen travel)
          const hatchTheme = _this.themes[_this.theme] || _this.themes.dark;
          const hatchStroke = _this.hatchOptions.stroke || hatchTheme.hatchStroke;

          if (_this.hatchOptions.connectHatches && hatches.length > 0) {
            // Connect hatches into continuous polylines, but break at large gaps
            // Max connection distance: use spacing as threshold (gaps larger than this start new path)
            const maxConnectDist = (_this.hatchOptions.baseSpacing || 8) * spacingScale * 2;

            const paths = [];
            let currentPath = "";
            let prevEnd = null;

            hatches.forEach((hatch, hatchIdx) => {
              const start = hatchIdx % 2 === 0 ? hatch.start : hatch.end;
              const end = hatchIdx % 2 === 0 ? hatch.end : hatch.start;

              // Check distance from previous end to current start
              let shouldBreak = false;
              if (prevEnd) {
                const dist = Math.sqrt(
                  (start.x - prevEnd.x) ** 2 + (start.y - prevEnd.y) ** 2
                );
                shouldBreak = dist > maxConnectDist;
              }

              if (hatchIdx === 0 || shouldBreak) {
                // Start new path
                if (currentPath) {
                  paths.push(currentPath);
                }
                currentPath = `M${lop(start.x)},${lop(-start.y)}`;
              } else {
                // Connect to previous
                currentPath += `L${lop(start.x)},${lop(-start.y)}`;
              }
              currentPath += `L${lop(end.x)},${lop(-end.y)}`;
              prevEnd = end;
            });

            if (currentPath) {
              paths.push(currentPath);
            }

            // Create path elements
            paths.forEach(d => {
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", d);
              path.setAttribute("fill", "none");
              path.setAttribute("stroke", hatchStroke);
              path.setAttribute("stroke-width", _this.hatchOptions.strokeWidth);
              _shading.appendChild(path);
            });
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

          // Check if we should yield to the browser
          const elapsed = performance.now() - frameStartTime;
          if (elapsed > frameBudgetMs && idx < regions.length - 1) {
            // Report progress
            if (progressCallback) {
              progressCallback((idx + 1) / regions.length);
            }
            // Yield to browser via requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));
            frameStartTime = performance.now();
          }
        }

        // Final progress callback
        if (progressCallback) {
          progressCallback(1);
        }

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

/**
 * based on SVGRenderer @author mrdoob / http://mrdoob.com/
 */

import { Box2, Camera, Color, Matrix3, Matrix4, Object3D, Vector3 } from "three";
import { Projector, RenderableFace } from "./projector.js";
import { GeomUtil, Point, Segment } from "./geom/geom.js";
import { Optimize } from "./optimize.js";
import { BooleanShape } from "./geom/booleanshape.js";
import { PolygonShape } from "./geom/shapes.js";
import { Expander } from "./expander.js";
import { Hatcher } from "./hatcher.js";

var lop = (n) => {
  return Math.round(n * 100) / 100;
};

var defaultSpacings = [
  4, 6, 8, 10, 12, 14,
  16, 18, 20, 22, 24, 26,
  28, 30, 32, 34, 36, 40,
];
var defaultRotations = [
  45, 135, 0, 30, 60, 120,
  45, 135, 0, 30, 60, 120,
  45, 135, 0, 30, 60, 120
];

var SVGObject = function (node) {
  Object3D.call(this);

  this.node = node;
};

SVGObject.prototype = Object.create(Object3D.prototype);
SVGObject.prototype.constructor = SVGObject;

var PlotterRenderer = function () {
  var _this = this,
    _renderData,
    _elements,
    _lights,
    _projector = new Projector(),
    _svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    _defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"),
    _outline = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _edges = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _polygons = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _shading = document.createElementNS("http://www.w3.org/2000/svg", "g"),
    _svgWidth,
    _svgHeight,
    _svgWidthHalf,
    _svgHeightHalf,
    _v1,
    _v2,
    _v3,
    _clipBox = new Box2(),
    _elemBox = new Box2(),
    _color = new Color(),
    _ambientLight = new Color(),
    _directionalLights = new Color(),
    _pointLights = new Color(),
    _clearColor = new Color(),
    _vector3 = new Vector3(), // Needed for PointLight
    _centroid = new Vector3(),
    _normalViewMatrix = new Matrix3(),
    _viewMatrix = new Matrix4(),
    _viewProjectionMatrix = new Matrix4(),
    _svgPathPool = [],
    _svgNode,
    _pathCount = 0,
    _currentPath,
    _currentStyle,
    _quality = 1,
    _precision = null;

  _defs.innerHTML = ``;
  _svg.appendChild(_defs);

  _outline.setAttribute("inkscape:label", "Outline");
  _outline.setAttribute("inkscape:groupmode", "layer");
  _outline.id = "outline_layer";
  _svg.appendChild(_outline);

  _edges.setAttribute("inkscape:label", "Edges");
  _edges.setAttribute("inkscape:groupmode", "layer");
  _edges.id = "edges_layer";
  _svg.appendChild(_edges);

  _polygons.setAttribute("inkscape:label", "Polygons");
  _polygons.setAttribute("inkscape:groupmode", "layer");
  //_polygons.setAttribute("style", "display:none");
  _polygons.id = "polygons_layer";
  _svg.appendChild(_polygons);

  _shading.setAttribute("inkscape:label", "Shading");
  _shading.setAttribute("inkscape:groupmode", "layer");
  _shading.id = "shading_layer";
  _svg.appendChild(_shading);

  this.domElement = _svg;
  this.doOptimize = false;
  this._cachekey = "";
  var _cache = (this._cache = {
    segs: [],
    faces: [],
    optimized: false,
    shaded: false,
    shadeGrouped: false,
    shadeCombined: false,
    normGroups: {},
    normGroupSegs: {},
    outlineGroup: null,
    combinedShadeGroups: [],
    rotations: defaultRotations.concat(),
    spacings: defaultSpacings.concat(),
    hatchGroups: {},
    hatchGroupLums: {},
    hatchGroupFaceTotals: {},
    currentHatchGroup: 0,
  });

  this.autoClear = true;
  this.sortObjects = true;
  this.sortElements = true;

  this.info = {
    render: {
      vertices: 0,
      faces: 0,
    },
  };

  this.setQuality = function (quality) {
    switch (quality) {
      case "high":
        _quality = 1;
        break;
      case "low":
        _quality = 0;
        break;
    }
  };

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

    _clipBox.min.set(-_svgWidthHalf, -_svgHeightHalf);
    _clipBox.max.set(_svgWidthHalf, _svgHeightHalf);
  };

  this.getSize = function () {
    return {
      width: _svgWidth,
      height: _svgHeight,
    };
  };

  this.setPrecision = function (precision) {
    _precision = precision;
  };

  function removeChildNodes() {
    _pathCount = 0;

    while (_outline.childNodes.length > 0) {
      _outline.removeChild(_outline.childNodes[0]);
    }
    while (_edges.childNodes.length > 0) {
      _edges.removeChild(_edges.childNodes[0]);
    }
    while (_polygons.childNodes.length > 0) {
      _polygons.removeChild(_polygons.childNodes[0]);
    }
    _polygons.setAttribute("style", "display:block");
    while (_shading.childNodes.length > 0) {
      _shading.removeChild(_shading.childNodes[0]);
    }
  }

  function convert(c) {
    return _precision !== null ? c.toFixed(_precision) : c;
  }

  this.clear = function () {
    removeChildNodes();
    _svg.style.backgroundColor = _clearColor.getStyle();
  };

  this.render = function (scene, camera) {

    if (camera instanceof Camera === false) {
      console.error("THREE.SVGRenderer.render: camera is not an instance of Camera.");
      return;
    }

    //console.log("PROJECTION:", camera instanceof OrthographicCamera ? "ortho": "persp");

    let segs = [];
    let faces = [];
    let useCache = false;

    const cp = camera.position;

    // cache based on camera position;
    const cacheKey = `${Math.round(cp.x)}|${Math.round(cp.y)}|${Math.round(cp.z)}`;

    // use cache if camera not moved
    if (this._cachekey == cacheKey && this.doOptimize) {

      segs = this._cache.segs;
      faces = this._cache.faces;
      useCache = true;

      // start caching 
    } else if (this.doOptimize) {

      this._cachekey = cacheKey;
      this._cache.segs = segs;
      this._cache.faces = faces;
      this._cache.optimized = false;
      this._cache.shaded = false;
      this._cache.shadeGrouped = false;
      this._cache.shadeCombined = false;
      this._cache.normGroups = {};
      this._cache.normGroupSegs = {};
      this._cache.outlineGroup = null;
      this._cache.combinedShadeGroups = [];
      this._cache.hatchGroups = {};
      this._cache.hatchGroupLums = {};
      this._cache.hatchGroupFaceTotals = {};
      this._cache.currentHatchGroup = 0;

      // not in optimize mode (user is moving camera)
    } else {
      this._cachekey = "";
    }

    var background = scene.background;

    if (!useCache) {
      if (background && background.isColor) {
        removeChildNodes();
        _svg.style.backgroundColor = background.getStyle();
      } else if (this.autoClear === true) {
        this.clear();
      }
    }

    // render in wireframe mode
    if (!useCache) {
      _this.info.render.vertices = 0;
      _this.info.render.faces = 0;

      _viewMatrix.copy(camera.matrixWorldInverse);
      _viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, _viewMatrix);

      let r = _projector.projectScene(scene, camera, false, false);
      _renderData = _projector.projectScene(scene, camera, this.sortObjects, this.sortElements);

      _elements = _renderData.elements;
      _lights = _renderData.lights;


      _normalViewMatrix.getNormalMatrix(camera.matrixWorldInverse);

      // reset accumulated path

      _currentPath = "";
      _currentStyle = "";

      for (var e = 0, el = _elements.length; e < el; e++) {
        var element = _elements[e];
        var material = element.material;

        if (material === undefined || material.opacity === 0) continue;

        _elemBox.makeEmpty();

        if (element instanceof RenderableFace) {
          _v1 = element.v1;
          _v2 = element.v2;
          _v3 = element.v3;

          if (_v1.positionScreen.z < -1 || _v1.positionScreen.z > 1) continue;
          if (_v2.positionScreen.z < -1 || _v2.positionScreen.z > 1) continue;
          if (_v3.positionScreen.z < -1 || _v3.positionScreen.z > 1) continue;

          _v1.positionScreen.x *= _svgWidthHalf;
          _v1.positionScreen.y *= -_svgHeightHalf;
          _v2.positionScreen.x *= _svgWidthHalf;
          _v2.positionScreen.y *= -_svgHeightHalf;
          _v3.positionScreen.x *= _svgWidthHalf;
          _v3.positionScreen.y *= -_svgHeightHalf;

          // @ts-ignore
          _elemBox.setFromPoints([_v1.positionScreen, _v2.positionScreen, _v3.positionScreen]);

          if (_clipBox.intersectsBox(_elemBox) === true) {
            renderFace3(
              _v1,
              _v2,
              _v3,
              element,
              material,
              segs,
              faces,
            );
          }
        }
      }
    }

    // start shading
    if (useCache && !this._cache.shaded) {

      console.log("shading..");

      let outlineGroup = this._cache.outlineGroup || new BooleanShape([], 500);
      let normGroups = this._cache.normGroups || {};
      let normGroupSegs = this._cache.normGroupSegs || {};
      let hatchGroups = this._cache.hatchGroups || {};
      let hatchGroupLums = this._cache.hatchGroupLums || {};
      let hatchGroupFaceTotals = this._cache.hatchGroupFaceTotals || {};
      this._cache.outlineGroup = outlineGroup;
      this._cache.normGroups = normGroups;
      this._cache.normGroups = normGroups;
      this._cache.normGroupSegs = normGroupSegs;
      this._cache.hatchGroups = hatchGroups;
      this._cache.hatchGroupLums = hatchGroupLums;
      this._cache.hatchGroupFaceTotals = hatchGroupFaceTotals;

      // first prepare face groups for edge rendering
      if (!this._cache.shadeGrouped) {

        calculateLights(_lights);

        // group faces by normal
        // create a booleanshape for each normal group
        faces.forEach((f) => {
          let n2 = f.v1.positionWorld.clone().add(f.v2.positionWorld).add(f.v3.positionWorld).divideScalar(3).multiply(f.n);
          let nPlaneDepth = Math.round((n2.x + n2.y + n2.z) / 10);
          let hatchGroupName = `${Math.round(f.n.x * 10)}|${Math.round(f.n.y * 10)}|${Math.round(f.n.z * 10)}`;
          let normGroupName = hatchGroupName + `||${nPlaneDepth}`;
          if (!normGroups[normGroupName]) {
            normGroups[normGroupName] = new BooleanShape([], 5);
          }
          if (!hatchGroups[hatchGroupName]) {
            hatchGroups[hatchGroupName] = true;
            hatchGroupLums[hatchGroupName] = 0;
            hatchGroupFaceTotals[hatchGroupName] = 0;
          }
          f.normGroup = normGroupName;
          f.hatchGroup = hatchGroupName;
        });

        // 1. take each face in order from back to front
        // 2. ADD to own normal group
        // 3. SUBTRACT from other normal groups
        faces.forEach((f, idx) => {
          for (let normGroup in normGroups) {
            let pts = [Point.clone(f.p1), Point.clone(f.p2), Point.clone(f.p3)];

            let area = Math.abs(GeomUtil.polygonArea(pts));
            if (area === 0) {
              return;
            }

            pts[0].x = Math.round(pts[0].x * 10000000) / 100;
            pts[0].y = Math.round(pts[0].y * 10000000) / 100;
            pts[1].x = Math.round(pts[1].x * 10000000) / 100;
            pts[1].y = Math.round(pts[1].y * 10000000) / 100;
            pts[2].x = Math.round(pts[2].x * 10000000) / 100;
            pts[2].y = Math.round(pts[2].y * 10000000) / 100;

            const offsetPtSets = Expander.expandFace(pts[0], pts[1], pts[2], 20);
            const shape = new PolygonShape(offsetPtSets[0]);

            let boolGroup = normGroups[normGroup];

            if (normGroup !== f.normGroup) {
              if (idx > 0) {
                if (boolGroup.shapes.length) {
                  boolGroup.sub(shape);
                }
              }
            } else {
              boolGroup.add(shape);
              hatchGroupFaceTotals[f.hatchGroup]++;
            }
          }

          _color.copy(_ambientLight);
          _centroid.copy(f.v1.positionWorld).add(f.v2.positionWorld).add(f.v3.positionWorld).divideScalar(3);
          calculateLight(_lights, _centroid, f.n, _color);
          hatchGroupLums[f.hatchGroup] += _color.g;

          const pts = [Point.clone(f.p1), Point.clone(f.p2), Point.clone(f.p3)];

          pts[0].x = Math.round(pts[0].x * 100000);
          pts[0].y = Math.round(pts[0].y * 100000);
          pts[1].x = Math.round(pts[1].x * 100000);
          pts[1].y = Math.round(pts[1].y * 100000);
          pts[2].x = Math.round(pts[2].x * 100000);
          pts[2].y = Math.round(pts[2].y * 100000);

          const offsetPtSets = Expander.expandFace(pts[0], pts[1], pts[2], 200);
          const shape = new PolygonShape(offsetPtSets[0]);
          outlineGroup.add(shape); // outline group is ALWAYS additive as we are merging all the faces together like a silhouette
        });

        normGroups["outline"] = outlineGroup;

        for (let hatchGroup in hatchGroupLums) {
          hatchGroupLums[hatchGroup] /= hatchGroupFaceTotals[hatchGroup];
        }

        this._cache.shadeGrouped = true;
      }

      // after normal grouping...
      // booleanshape->combine 1 normal group at a time

      let combinedShadeGroups = this._cache.combinedShadeGroups;
      let normGroup = "";

      let j = 0;

      // find a group that hasn't been combined yet
      for (let g in normGroups) {
        if (combinedShadeGroups.indexOf(g) === -1) {
          normGroup = g;
          combinedShadeGroups.push(g);
          break;
        }
        j++;
      }

      // if a group hasn't been combined, then combined it
      if (normGroup) {

        // no need to combine if it's only subtractive
        if (normGroups[normGroup].additiveShapes > 1) {

          console.log("combining normGroup", normGroup, " ,shapes", normGroups[normGroup].additiveShapes, normGroups[normGroup].subtractiveShapes);

          let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          let segs = normGroupSegs[normGroup];
          if (!segs) {
            segs = normGroups[normGroup].toSegments(); // the boolean combine happens when we ask for the segments
            segs = Optimize.segments(segs)._segments;
            normGroupSegs[normGroup] = segs;
          }

          if (normGroup !== "outline") {
            addHatching(segs, normGroup, camera);
          }

          // draw the polygons (hidden) and the outline 

          let pointsStr = "";

          if (segs && segs.length) {
            for (let i = 0; i < segs.length; i++) {
              let command = "M";
              if (i > 0 && GeomUtil.segmentsConnected(segs[i - 1], segs[i], 100000)) {
                command = "L";
              }
              if (i > 0 && command == "M") {
                pointsStr += "z";
              }
              pointsStr += `${command} ${lop(segs[i].b.x / 100000)} ${lop(segs[i].b.y / 100000)} `;
            }
            pointsStr += "z";
          }

          path.setAttribute("d", pointsStr);

          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "black");
          path.setAttribute("id", normGroup);

          if (normGroup === "outline") {
            path.setAttribute("stroke-width", "0.65mm");
            _outline.appendChild(path);
          } else {
            path.setAttribute("stroke-width", "0.35mm");
            _polygons.appendChild(path);
          }

        }

      } else {

        // shade grouping complete

        this._cache.shaded = true;
        let totalGroups = 0;

        for (let g in this._cache.hatchGroupLums) {
          totalGroups++;
        }

        if (totalGroups < this._cache.rotations.length) {
          this._cache.rotations = this._cache.rotations.slice(0, totalGroups);
          this._cache.spacings = this._cache.spacings.slice(0, totalGroups);
        }

        // add optimized edges

        console.log("optimizing edges to draw...");

        let segs = [];

        // put all the edges from all groups together into one array
        for (let n in normGroupSegs) {
          let set = normGroupSegs[n];
          if (Array.isArray(set) && set.length > 1) {
            set.forEach(seg => {
              segs.push(Segment.clone(seg));
            });
          }
        }

        // scale back down from clipping
        segs.forEach(seg => {
          seg.a = Point.clone(seg.a);
          seg.b = Point.clone(seg.b);
          seg.a.x /= 100000;
          seg.a.y /= 100000;
          seg.b.x /= 100000;
          seg.b.y /= 100000;
        })

        // optimize! 
        // this removes all overlapping edges and optimizes drawing order
        console.log("segments before optimization:", segs.length);
        segs = Optimize.segments(segs, false, true, 1, true)._segments;
        console.log("segments after optimization:", segs.length);

        // draw the optimized edges to the edges layer

        let pointsStr = "";

        if (segs && segs.length) {
          for (let i = 0; i < segs.length; i++) {
            if (i === 0 || !GeomUtil.segmentsConnected(segs[i - 1], segs[i], 1)) {
              pointsStr += `M ${lop(segs[i].a.x)} ${lop(segs[i].a.y)} `;
            }
            pointsStr += `L ${lop(segs[i].b.x)} ${lop(segs[i].b.y)} `;
          }
        }

        let path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        path.setAttribute("d", pointsStr);

        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "black");

        path.setAttribute("stroke-width", "0.35mm");
        _edges.appendChild(path);
        _polygons.setAttribute("style", "display:none");

        // DONE!
        console.log("DONE");
      }
    }

    // if not drawing final render, render wireframe
    if (!this.doOptimize) {
      segs.forEach(seg => renderSegment(seg));
      flushPath(); // just to flush last svg:path
    }

  };

  function addHatching(segs, normGroup, camera, padding = 2) {

    const hatchGroup = normGroup.split("||")[0];
    const hatchGroupLums = _cache.hatchGroupLums;
    const hatchGroupKey = hatchGroupLums[hatchGroup] + "-" + hatchGroup

    // order luminosity groups by luminosity
    let lums = [];
    for (let k in hatchGroupLums) {
      lums.push(hatchGroupLums[k] + "-" + k);
    }
    lums.sort();

    // find the luminosity index of this group
    let hatchIndex = lums.indexOf(hatchGroupKey);

    if (hatchIndex == -1) {
      return;
    }

    hatchIndex %= _cache.spacings.length;

    // get the spacing that matches the luminosity (needs work)
    let spacing = _cache.spacings[hatchIndex];
    let rotation = _cache.rotations[hatchIndex];

    //let path = Hatcher.addFlatHatching(segs, spacing, rotation, padding, 100000);

    let normalParts = normGroup.split("||")[0].split("|");
    let normal = new Vector3(
      parseFloat(normalParts[0]) / 10,
      parseFloat(normalParts[1]) / 10,
      parseFloat(normalParts[2]) / 10
    );

    let path = Hatcher.addFlatHatching(segs, spacing, rotation, padding, 100000);
    _shading.appendChild(path);

  }

  function calculateLights(lights) {
    _ambientLight.setRGB(0, 0, 0);
    _directionalLights.setRGB(0, 0, 0);
    _pointLights.setRGB(0, 0, 0);

    for (var l = 0, ll = lights.length; l < ll; l++) {
      var light = lights[l];
      var lightColor = light.color;

      if (light.isAmbientLight) {
        _ambientLight.r += lightColor.r;
        _ambientLight.g += lightColor.g;
        _ambientLight.b += lightColor.b;
      } else if (light.isDirectionalLight) {
        _directionalLights.r += lightColor.r;
        _directionalLights.g += lightColor.g;
        _directionalLights.b += lightColor.b;
      } else if (light.isPointLight) {
        _pointLights.r += lightColor.r;
        _pointLights.g += lightColor.g;
        _pointLights.b += lightColor.b;
      }
    }
  }

  function calculateLight(lights, position, normal, color) {
    for (var l = 0, ll = lights.length; l < ll; l++) {
      var light = lights[l];
      var lightColor = light.color;

      if (light.isDirectionalLight) {
        var lightPosition = _vector3.setFromMatrixPosition(light.matrixWorld).normalize();

        var amount = normal.dot(lightPosition);

        if (amount <= 0) continue;

        amount *= light.intensity;

        color.r += lightColor.r * amount;
        color.g += lightColor.g * amount;
        color.b += lightColor.b * amount;
      } else if (light.isPointLight) {
        var lightPosition = _vector3.setFromMatrixPosition(light.matrixWorld);

        var amount = normal.dot(_vector3.subVectors(lightPosition, position).normalize());

        if (amount <= 0) continue;

        amount *= light.distance == 0 ? 1 : 1 - Math.min(position.distanceTo(lightPosition) / light.distance, 1);

        if (amount == 0) continue;

        amount *= light.intensity;

        color.r += lightColor.r * amount;
        color.g += lightColor.g * amount;
        color.b += lightColor.b * amount;
      }
    }
  }

  function renderFace3(
    v1,
    v2,
    v3,
    element,
    material,
    segs,
    faces
  ) {
    _this.info.render.vertices += 3;
    _this.info.render.faces++;

    let f1 = {
      x: v1.positionScreen.x,
      y: v1.positionScreen.y,
    };
    let f2 = {
      x: v2.positionScreen.x,
      y: v2.positionScreen.y,
    };
    let f3 = {
      x: v3.positionScreen.x,
      y: v3.positionScreen.y,
    };

    let p1 = {
      x: v1.positionScreen.x,
      y: v1.positionScreen.y,
    };
    let p2 = {
      x: v2.positionScreen.x,
      y: v2.positionScreen.y,
    };
    let p3 = {
      x: v3.positionScreen.x,
      y: v3.positionScreen.y,
    };

    faces.push({
      face: GeomUtil.pointsToClosedPolySegments(f1, f2, f3),
      element,
      n: element.normalModel.clone(),
      v1,
      v2,
      v3,
      p1,
      p2,
      p3,
    });

    segs.push({
      a: {
        x: convert(v1.positionScreen.x),
        y: convert(v1.positionScreen.y),
        v: v1,
      },
      b: {
        x: convert(v2.positionScreen.x),
        y: convert(v2.positionScreen.y),
        v: v2,
      },
      element,
      material,
    });

    segs.push({
      a: {
        x: convert(v2.positionScreen.x),
        y: convert(v2.positionScreen.y),
        v: v2,
      },
      b: {
        x: convert(v3.positionScreen.x),
        y: convert(v3.positionScreen.y),
        v: v3,
      },
      element,
      material,
    });

    segs.push({
      a: {
        x: convert(v3.positionScreen.x),
        y: convert(v3.positionScreen.y),
        v: v3,
      },
      b: {
        x: convert(v1.positionScreen.x),
        y: convert(v1.positionScreen.y),
        v: v1,
      },
      element,
      material,
    });

  }

  // wireframe path rendering

  function renderSegment(seg) {
    const path = "M" + seg.a.x + "," + seg.a.y + "L" + seg.b.x + "," + seg.b.y;
    const style = "fill:none; stroke:#06c; opacity: 0.5; stroke-width:1.5;";
    addPath(style, path);
  }

  function addPath(style, path) {
    if (_currentStyle === style) {
      _currentPath += path;
    } else {
      flushPath();
      _currentStyle = style;
      _currentPath = path;
    }
  }

  function flushPath() {
    if (_currentPath) {
      _svgNode = getPathNode(_pathCount++);
      _svgNode.setAttribute("d", _currentPath);
      _svgNode.setAttribute("style", _currentStyle);
      _polygons.appendChild(_svgNode);
    }

    _currentPath = "";
    _currentStyle = "";
  }

  function getPathNode(id) {
    if (_svgPathPool[id] == null) {
      _svgPathPool[id] = document.createElementNS("http://www.w3.org/2000/svg", "path");

      if (_quality == 0) {
        _svgPathPool[id].setAttribute("shape-rendering", "crispEdges"); //optimizeSpeed
      }

      return _svgPathPool[id];
    }

    return _svgPathPool[id];
  }

  // interactive hatch editing

  this.nextHatchGroup = function () {
    _cache.currentHatchGroup++;
    _cache.currentHatchGroup %= _cache.rotations.length;
    console.log("editing hatch group", _cache.currentHatchGroup, "...");
  };

  this.previousHatchGroup = function () {
    _cache.currentHatchGroup++;
    _cache.currentHatchGroup %= _cache.rotations.length;
    console.log("editing hatch group", _cache.currentHatchGroup, "...");
  };

  this.increaseSpacing = function () {
    _cache.spacings[_cache.currentHatchGroup] += 2;
    console.log("hatch group", _cache.currentHatchGroup, "spacing is now", _cache.spacings[_cache.currentHatchGroup]);
    this.redrawHatching();
  };

  this.decreaseSpacing = function () {
    _cache.spacings[_cache.currentHatchGroup] -= 2;
    _cache.spacings[_cache.currentHatchGroup] = Math.max(2, _cache.spacings[_cache.currentHatchGroup]);
    console.log("hatch group", _cache.currentHatchGroup, "spacing is now", _cache.spacings[_cache.currentHatchGroup]);
    this.redrawHatching();
  };

  this.increaseRotation = function () {
    _cache.rotations[_cache.currentHatchGroup] += 5;
    console.log("hatch group", _cache.currentHatchGroup, "rotation is now", _cache.rotations[_cache.currentHatchGroup]);
    this.redrawHatching();
  };

  this.decreaseRotation = function () {
    _cache.rotations[_cache.currentHatchGroup] -= 5;
    console.log("hatch group", _cache.currentHatchGroup, "rotation is now", _cache.rotations[_cache.currentHatchGroup]);
    this.redrawHatching();
  };

  this.redrawHatching = function () {
    while (_shading.childNodes.length > 0) {
      _shading.removeChild(_shading.childNodes[0]);
    }
    for (let normGroup in _cache.normGroupSegs) {
      addHatching(_cache.normGroupSegs[normGroup], normGroup);
    }
  };

};

export { PlotterRenderer };

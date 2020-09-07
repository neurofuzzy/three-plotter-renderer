# three-plotter-renderer
An SVG renderer with occlusion for plotters and SVG editors

**This package is a WIP: Try loading examples with a live development server.**

<img src="./examples/output/example02.png" width="50%">

## Usage

This _should_ be as simple as including `../dist/three-plotter-renderer.js` as a script in the head of your HTML document _after_ your *three.js* script include.

NOTE: This is a WIP and this will eventually be packaged for easy install in your projects.

## Examples

The examples demonstrate usage of the packaged renderer in the `./dist` directory. Please note it must be added _after_ including `three.min.js`
Please check the `./examples` folder and make sure they work for you.

Examples use an OrbitController and start unoccluded. More complex models take time and you may see a blank screen for a few seconds.

## Usage as module

The `./tests` directory demonstrates usage as a module. Importing `./src/three-plotter-renderer.js` should work as long as you've also installed and imported `three` and `js-angusjs-clipper` as modules.

## Model types

The renderer works best with CSG models. It _does not_ support intersecting faces (touching is fine). Also, avoid stretched faces, and use multiple height/width/depth segments to get your faces as square as possible to prevent depth-fighting.

## Adjusting hatching

If you follow the examples you can adjust hatching after rendering by using the <,> keys to switch groups, the \[,\] keys to adjust rotation, and the -,= keys to adjust spacing

## Layers

The renderer will export an _edges_, _outline_, and _shading_ layer, as well as a hidden _polygons_ layer for use in Inkscape. These layers are only Inkscape-compatible and will come in as groups in other programs.

---

## How it works

This renderer leverages the _projector.js_ module from _SVGRenderer_ to get a projected scene as an array of faces sorted by depth. The renderer then takes the faces and does the following:

1. Put each face in a group of faces with the same normal and depth (distance from 0,0,0 world position)
2. For each face, in order of depth, from back to front, union the projected polygon to the accumulated faces in that normal group.
3. For that face, _subtract_ the projected polygon from all other normal groups.
4. Finally, _union_ that face to the _outline group.
5. Proceed to the next-closest face and repeat from step 2.

You will end up with a set of polygons, each matching a planar section of your model. They will all fit together exactly, since they all were assembled from the same set of faces, just with different logic.

---

## Contributions welcome!

There are a lot of developers out there who are smarter than me. I hope you can help me make this faster and more versatile!

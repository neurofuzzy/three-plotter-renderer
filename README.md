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

The renderer works best with CSG models. It _does not_ support intersecting triangles. Also, avoid stretched-depth triangles, and use multiple height/width/depth segments to get your triangles as square as possible to preent depth-fighting.

## Adjusting hatching

If you follow the examples you can adjust hatching after rendering by using the <,> keys to switch groups, the \[,\] keys to adjust rotation, and the -,= keys to adjust spacing

## Layers

The renderer will export an _edges_, _outline_, and _shading_ layer, as well as a hidden _polygons_ layer for use in Inkscape. These layers are only Inkscape-compatible and will come in as groups in other programs.
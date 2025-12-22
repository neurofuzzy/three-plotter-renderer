import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PlotterRenderer } from '../src/plotter-renderer.js';

let camera, scene, renderer;
let cameraControls;
let focused = true; // Start focused for initial render

// ES modules are deferred, run immediately
init();
render();

window.onblur = () => {
  focused = false;
};

window.onfocus = window.onclick = () => {
  focused = true;
};

window.onkeypress = (e) => {
  console.log(e.keyCode);
  switch (e.keyCode) {
    case 61:
      renderer.increaseSpacing();
      break;
    case 45:
      renderer.decreaseSpacing();
      break;
    case 93:
      renderer.increaseRotation();
      break;
    case 91:
      renderer.decreaseRotation();
      break;
    case 46:
      renderer.nextHatchGroup();
      break;
    case 44:
      renderer.previousHatchGroup();
      break;
  }
};

function init() {
  const view = document.getElementById("view");
  const container = document.getElementById("plot");

  // CAMERA
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 8000);
  camera.position.set(900, 900, 900);

  // RENDERER
  renderer = new PlotterRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // EVENTS
  window.addEventListener("resize", onWindowResize, false);

  // CONTROLS
  cameraControls = new OrbitControls(camera, view);
  cameraControls.zoomSpeed = 2;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
  dirLight.position.set(300, 300, 300);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x333333, 0.75);
  dirLight2.position.set(-100, 300, -500);
  scene.add(dirLight2);

  const light = new THREE.PointLight(0xffffff, 1.0, 5000);
  light.position.x = 300;
  light.position.z = 600;
  light.position.y = 1000;
  camera.add(light);
  scene.add(camera);

  // GUI
  setupGui();

  // Load model
  const loader = new STLLoader();
  loader.load("./models/example01.stl", function (geometry) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial());
    scene.add(mesh);
    renderer.render(scene, camera);
  });

  const tick = function () {
    if (focused) {
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };

  let optimizeTimeout = null;

  const setOptimize = function () {
    clearTimeout(optimizeTimeout);
    optimizeTimeout = setTimeout(() => {
      renderer.doOptimize = true;
    }, 500);
  };

  cameraControls.addEventListener("start", function () {
    renderer.doOptimize = false;
    clearTimeout(optimizeTimeout);
  });

  cameraControls.addEventListener("end", function () {
    setOptimize();
  });

  cameraControls.addEventListener("change", function () {
    renderer.doOptimize = false;
    clearTimeout(optimizeTimeout);
    setOptimize();
  });

  tick();
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  render();
}

function setupGui() {
  const exportButton = document.getElementById("exportsvg");
  exportButton.addEventListener("click", exportSVG);
}

function render() {
  renderer.render(scene, camera);
}

function exportSVG() {
  saveString(document.getElementById("plot").innerHTML, "plot.svg");
}

function save(blob, filename) {
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function saveString(text, filename) {
  save(new Blob([text], { type: "text/plain" }), filename);
}

const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);

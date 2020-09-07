import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";

/** @typedef {import('../node_modules/three/build/three.module.js')} THREE */

var camera, scene, renderer;
var cameraControls;
var canvasWidth = window.innerWidth;
var canvasHeight = window.innerHeight;
var focused = false;

window.onload = () => {
  init();
  render();
};

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

  var view = document.getElementById("view");
  var container = document.getElementById("plot");
  var overla= document.getElementById("plot");

  // CAMERA
  camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 8000);
  camera.position.set(300, 300, 300);

  // RENDERER
  renderer = new THREE.PlotterRenderer();

  renderer.setSize(canvasWidth, canvasHeight);
  container.appendChild(renderer.domElement);

  // EVENTS
  window.addEventListener("resize", onWindowResize, false);

  // CONTROLS
  // @ts-ignore
  cameraControls = new OrbitControls(camera, view);
  cameraControls.zoomSpeed = 2;

  // scene itself
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
  
  var geom = new THREE.BoxGeometry(100, 100, 100, 3, 3, 3);
  var mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial({ opacity: 1, color: 0xffffff }));
  scene.add(mesh);

  var tick = function () {
    if (focused) {
      renderer.render(scene, camera, 0.2, 0.3);
    }
    requestAnimationFrame(tick);
  };

  var optimizeTimeout = null;

  var setOptimize = function () {
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
  //setOptimize();
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();

  render();
}

function setupGui() {
  var exportButton = document.getElementById("exportsvg");
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

var link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);

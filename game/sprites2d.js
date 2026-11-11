// Army Rush City in 2D: the soldiers, tanks and bosses are the same 3D models as in the 3D view
// (units3d.js), photographed once from the front and above, then drawn as pictures. A few
// pictures per unit make it march; a white one flashes when it is hit; a dark one is knocked out.
//
// ArmySprites() returns null when the device can't draw 3D (view2d.js then draws simple shapes),
// else { enemy(type, T, wave, frame), friend(tier, hero, frame) }: each gives
// { img, w, h, x, y } where (x, y) is the spot under the unit's feet, in field units.
// One set of pictures is shared by the battle and the city map, so it is made only once.
window.ArmySprites = function () {
  if (!("shared" in window.ArmySprites)) window.ArmySprites.shared = makeSprites();
  return window.ArmySprites.shared;
};
function makeSprites() {
  if (!window.THREE || !window.ArmyUnits3D) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch (err) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const units = ArmyUnits3D();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8eef4, 0x4a4436, 1.8));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(-250, 400, 250);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  // Seen from the front and a little above, like the 2D field standing up on the screen.
  const TILT = 0.55;
  const DIR = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));
  const PX = 2; // pixels per field unit
  const FRAMES = 4;

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  const ground = new THREE.Vector3();

  // One picture of a unit as it is now.
  function shoot(v) {
    v.root.updateMatrixWorld(true);
    box.setFromObject(v.root);
    camera.position.copy(DIR).multiplyScalar(500);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x);
      y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
    }
    x0 -= 2; x1 += 2; y0 -= 2; y1 += 2;
    camera.left = x0; camera.right = x1; camera.top = y1; camera.bottom = y0;
    camera.updateProjectionMatrix();
    const w = Math.ceil((x1 - x0) * PX), h = Math.ceil((y1 - y0) * PX);
    renderer.setSize(w, h, false);
    scene.add(v.root);
    renderer.render(scene, camera);
    scene.remove(v.root);
    const img = document.createElement("canvas");
    img.width = w; img.height = h;
    img.getContext("2d").drawImage(renderer.domElement, 0, 0);
    ground.set(0, 0, 0).applyMatrix4(inv);
    return { img, w: w / PX, h: h / PX, x: ground.x - x0, y: y1 - ground.y };
  }

  // Marching frames, a flash and a knocked-out picture, made the first time they are needed.
  function series(v, march) {
    const out = { walk: [] };
    for (let f = 0; f < (march ? FRAMES : 1); f++) {
      units.animate(v, { time: (f / FRAMES) * (2 * Math.PI / 9), seed: 0, march, flash: 0, recoil: 0 });
      out.walk.push(shoot(v));
    }
    units.animate(v, { time: 0, seed: 0, march: false, flash: 1, recoil: 0 });
    out.flash = shoot(v);
    units.animate(v, { time: 0, seed: 0, march: false, flash: 0, recoil: 0 });
    units.fall(v, 0.4);
    out.down = shoot(v);
    return out;
  }

  const cache = {};
  function enemy(type, T, wave) {
    const key = type + ":" + units.eraOf(wave || 0);
    if (!cache[key]) cache[key] = series(units.enemy(type, T, wave), !T.tank);
    return cache[key];
  }
  function friend(tier, hero) {
    const key = "f" + tier + (hero ? "h" : "");
    if (!cache[key]) cache[key] = series(units.friend(tier, hero), true);
    return cache[key];
  }

  return { enemy, friend, FRAMES };
}

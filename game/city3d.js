// Army Rush City's city, in 3D: in the 3D and FPS views the city map is drawn with Three.js, in the
// same cartoon style as the battle. Everything the city does stays in city.js; this file only
// draws it. ArmyCity.create({ map3d: ArmyCity3D }) calls ArmyCity3D(canvas, world, words)
// the first time the city opens in 3D: canvas is the map, world says what is in the city (see
// `world` in city.js), and words is a see-through 2D layer with the texts to show on top.
// It returns null when the device can't show 3D, and city.js draws the 2D map instead.
//
// Map x -> world X (centred), map y -> world Z (the road at the bottom is nearest to you),
// height -> world Y. One map unit is one world unit.
window.ArmyCity3D = function (canvas, world, words) {
  const { MW, MH, GATE, ROAD, WGATE, EGATE, FIELDS, MINE, KILN, PASTURE, HALL, PATH_LINES, TOWERS, ERAS, LAST } = world;
  const X = (x) => x - MW / 2;
  const Z = (y) => y - MH / 2;
  const FONT_EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (err) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const DAY = new THREE.Color("#bde0fe"), NIGHT = new THREE.Color("#1b1f4a");
  scene.background = DAY.clone();
  scene.fog = new THREE.Fog(DAY.clone(), 700, 1300);
  const camera = new THREE.PerspectiveCamera(32, MW / MH, 5, 3000);
  const WHITE = new THREE.Color("#ffffff"), MOONLIGHT = new THREE.Color("#7f8fe8");
  const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa77, 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-200, 400, 300);
  scene.add(sun);

  // ---------- The cartoon look, as in the battle ----------

  const gradient = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const toonCache = {};
  const mat = (color) => toonCache[color] || (toonCache[color] = new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  const basicCache = {};
  const basic = (color) => basicCache[color] || (basicCache[color] = new THREE.MeshBasicMaterial({ color }));

  // Most shapes stand on the ground: their base is at y = 0.
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0),
    cone: new THREE.ConeGeometry(1, 1, 14).translate(0, 0.5, 0),
    pyramid: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
    sphere: new THREE.SphereGeometry(1, 14, 10),
    dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    disc: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    plane: new THREE.PlaneGeometry(1, 1),
    barPlane: new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0),
    gable: gableGeometry(),
  };
  // A roof with two slopes: a triangle seen from the front, base 1 wide, 1 high and 1 deep.
  function gableGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  }

  // A mesh with a size and a place, added to its parent.
  function part(parent, geo, material, size, pos) {
    const m = new THREE.Mesh(GEO[geo], typeof material === "string" ? mat(material) : material);
    if (typeof size === "number") m.scale.setScalar(size); else m.scale.set(size[0], size[1], size[2]);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    parent.add(m);
    return m;
  }
  const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });
  function blob(parent, rx, rz, x, z) {
    const m = part(parent, "disc", SHADOW, [rx, 1, rz || rx], [x || 0, 0.4, z || 0]);
    m.renderOrder = 1;
    return m;
  }

  // ---------- Pictures and words that always face you ----------

  const spriteCache = {};
  function pictureMat(text, isWord, color) {
    const key = (isWord ? "w" : "e") + text + (color || "");
    if (spriteCache[key]) return spriteCache[key];
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    let aspect = 1;
    if (isWord) {
      x.font = "bold 56px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      const w = Math.ceil(x.measureText(text).width) + 24;
      c.width = w; c.height = 80; aspect = w / 80;
      x.font = "bold 56px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
      x.lineWidth = 10; x.strokeStyle = "#2b2d42"; x.strokeText(text, w / 2, 42);
      x.fillStyle = color || "#fff"; x.fillText(text, w / 2, 42);
    } else {
      c.width = c.height = 128;
      x.font = "100px " + FONT_EMOJI;
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(text, 64, 72);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true });
    m.userData.aspect = aspect;
    spriteCache[key] = m;
    return m;
  }
  // An emoji standing on the ground (its bottom at y), size high.
  function picture(parent, text, size, pos) {
    const sp = new THREE.Sprite(pictureMat(text));
    sp.center.set(0.5, 0.06);
    sp.scale.set(size, size, 1);
    if (pos) sp.position.set(pos[0], pos[1], pos[2]);
    parent.add(sp);
    return sp;
  }
  function word(parent, text, h, color, pos) {
    const m = pictureMat(text, true, color);
    const sp = new THREE.Sprite(m);
    sp.scale.set(h * m.userData.aspect, h, 1);
    if (pos) sp.position.set(pos[0], pos[1], pos[2]);
    parent.add(sp);
    return sp;
  }

  // Life bars face you and draw on top.
  const barMat = (color) => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const BAR = { bg: barMat("#2b2d42"), green: barMat("#6bcb77"), yellow: barMat("#ffd93d"), red: barMat("#ff6b6b") };
  function makeBar(parent, w, y) {
    const group = new THREE.Group();
    group.position.y = y;
    const bg = part(group, "plane", BAR.bg, [w + 3, 6, 1]);
    const fg = part(group, "barPlane", BAR.green, [w, 3.5, 1], [-w / 2, 0, 0.1]);
    bg.renderOrder = 30; fg.renderOrder = 31;
    parent.add(group);
    faceMe.push(group);
    return (ratio) => {
      ratio = Math.max(0, Math.min(1, ratio));
      fg.visible = ratio > 0;
      fg.scale.x = Math.max(0.001, w * ratio);
      fg.material = ratio > 0.5 ? BAR.green : ratio > 0.25 ? BAR.yellow : BAR.red;
    };
  }

  // ---------- The ground, which stays ----------

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: ERAS[0].ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);
  // The AI Empire: glowing lines on the ground.
  const grid = new THREE.GridHelper(1440, 60, 0x00dcff, 0x00dcff);
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  grid.position.y = 0.1;
  scene.add(grid);

  // Stars and the moon, for the night.
  const sky = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, fog: false });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 1.4 - Math.PI * 0.7 + Math.sin(i * 7) * 0.05;
    part(sky, "sphere", starMat, 3, [Math.sin(a) * 900, 200 + ((i * 97) % 300), -Math.cos(a) * 900]);
  }
  const moon = picture(sky, "🌙", 90, [380, 330, -760]);
  moon.material = moon.material.clone();
  moon.material.fog = false;
  scene.add(sky);

  // ---------- The city: rebuilt when something changes ----------

  let town = new THREE.Group();
  scene.add(town);
  let anims = [];   // little things that move: (clock) => {}
  let glows = [];   // windows that light up at night
  let faceMe = [];  // life bars
  let towerBars = [];
  let lastKey = "";

  const GLOW = new THREE.SpriteMaterial({ color: "#ffd93d", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  function glow(parent, x, y, z, size) {
    const sp = new THREE.Sprite(GLOW);
    sp.scale.set(size, size, 1);
    sp.position.set(x, y, z);
    parent.add(sp);
  }

  function smoke(parent, x, y, z, n, size) {
    const puffs = [];
    const m = new THREE.MeshToonMaterial({ color: "#dee2e6", gradientMap: gradient, transparent: true, opacity: 0.8 });
    for (let i = 0; i < n; i++) puffs.push(part(parent, "sphere", m, size, [x, y, z]));
    anims.push((t) => puffs.forEach((p, i) => {
      const k = (t * 0.5 + i / n) % 1;
      p.position.set(x + Math.sin(k * 6 + x) * 3, y + k * 30, z);
      p.scale.setScalar(size * (0.6 + k));
      m.opacity = 0.8;
    }));
  }

  // A house in the style of the age.
  function house(parent, x, z, style) {
    const h = new THREE.Group();
    h.position.set(x, 0, z);
    parent.add(h);
    blob(h, 17, 13);
    const door = (color, y) => part(h, "box", color, [5, 9, 1], [0, y || 0, 9.2]);
    const windows = (color, rows, cols, w, gapX, y0, gapY, zf) => {
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        part(h, "box", color, [w, w * 0.8, 1], [(k - (cols - 1) / 2) * gapX, y0 + r * gapY, zf]);
      }
    };
    switch (style) {
      case 0: // straw hut
        part(h, "cyl", "#8b5a2b", [10, 8, 10]);
        part(h, "cone", "#e9c46a", [14, 16, 14], [0, 7, 0]);
        part(h, "box", "#3d2b1f", [5, 7, 1], [0, 0, 9.6]);
        glow(h, 0, 4, 11, 12);
        break;
      case 1: // mud house with a flat roof
        part(h, "box", "#ddb892", [22, 16, 18]);
        part(h, "box", "#b08968", [25, 3, 21], [0, 16, 0]);
        door("#7f5539");
        glow(h, 0, 5, 11, 14);
        break;
      case 2: // white walls, red tiles
        part(h, "box", "#f8f9fa", [22, 14, 18]);
        part(h, "pyramid", "#e76f51", [17, 11, 14], [0, 14, 0]);
        door("#9c6644");
        glow(h, 0, 5, 11, 14);
        break;
      case 3: // red walls and a curved roof
        part(h, "box", "#c1121f", [20, 12, 16]);
        part(h, "pyramid", "#2d6a4f", [19, 5, 16], [0, 12, 0]);
        part(h, "pyramid", "#2d6a4f", [11, 7, 9], [0, 15, 0]);
        part(h, "box", "#ffd93d", [3, 3, 3], [0, 21.5, 0]);
        door("#6a040f");
        glow(h, 0, 5, 10, 14);
        break;
      case 4: // long wooden house with grass on the roof
        part(h, "box", "#8b5a2b", [28, 10, 16]);
        part(h, "gable", "#588157", [32, 13, 19], [0, 10, 0]);
        door("#3d2b1f");
        glow(h, 0, 4, 10, 14);
        break;
      case 5: // timber house
        part(h, "box", "#f1e3c8", [20, 16, 16]);
        part(h, "box", "#6f4518", [20.6, 1.5, 16.6], [0, 8, 0]);
        part(h, "box", "#6f4518", [1.5, 16, 16.6], [-9.6, 0, 0]);
        part(h, "box", "#6f4518", [1.5, 16, 16.6], [9.6, 0, 0]);
        part(h, "gable", "#7f4f24", [24, 12, 19], [0, 16, 0]);
        door("#6f4518");
        glow(h, 0, 6, 10, 14);
        break;
      case 6: // stone house with a blue roof
        part(h, "box", "#e9ecef", [22, 16, 18]);
        part(h, "pyramid", "#457b9d", [17, 11, 14], [0, 16, 0]);
        windows("#a8dadc", 1, 2, 4.5, 13, 9, 0, 9.2);
        door("#1d3557");
        glow(h, 0, 8, 11, 16);
        break;
      case 7: // brick house with a smoking chimney
        part(h, "box", "#bc4749", [22, 16, 18]);
        part(h, "gable", "#495057", [25, 10, 20], [0, 16, 0]);
        part(h, "box", "#495057", [4, 10, 4], [6, 18, -3]);
        windows("#ffe8a3", 1, 2, 4, 13, 9, 0, 9.2);
        door("#3d2b1f");
        smoke(h, 6, 30, -3, 3, 2.5);
        glow(h, 0, 8, 11, 16);
        break;
      case 8: // tall town house
        part(h, "box", "#f4d58d", [18, 30, 16]);
        part(h, "box", "#6d597a", [21, 3, 19], [0, 30, 0]);
        windows("#8ecae6", 2, 2, 4.5, 8, 13, 8, 8.2);
        door("#6d597a");
        glow(h, 0, 16, 10, 22);
        break;
      case 9: // block of flats
        part(h, "box", "#adb5bd", [20, 38, 18]);
        windows("#e3f2fd", 4, 3, 3.5, 6, 11, 7, 9.2);
        part(h, "box", "#6c757d", [21, 2, 19], [0, 38, 0]);
        glow(h, 0, 20, 11, 26);
        break;
      case 10: // dome
        part(h, "dome", "#f8f9fa", [15, 19, 15]);
        part(h, "sphere", "#4d96ff", [6, 4.5, 2], [0, 11, 13.6]);
        glow(h, 0, 9, 14, 18);
        break;
      case 11: // glass tower
        part(h, "box", "#90e0ef", [18, 42, 16]);
        part(h, "box", "#ffffff", [3, 36, 1], [-5, 3, 8.2]);
        part(h, "box", "#0077b6", [20, 3, 18], [0, 42, 0]);
        glow(h, 0, 22, 10, 26);
        break;
      default: { // dark tower with glowing lines
        part(h, "box", "#1b263b", [18, 46, 16]);
        const lines = [];
        const m = new THREE.MeshBasicMaterial({ color: "#00dcff", transparent: true });
        for (let r = 0; r < 5; r++) lines.push(part(h, "box", m, [14, 1.5, 1], [0, 8 + r * 8, 8.2]));
        anims.push((t) => { m.opacity = 0.6 + 0.4 * Math.sin(t * 3 + x); });
        glow(h, 0, 24, 10, 26);
      }
    }
    return h;
  }

  // A lab or a barracks, with a star badge for every upgrade.
  function special(parent, kind, x, z, level, era) {
    const s = new THREE.Group();
    s.position.set(x, 0, z);
    parent.add(s);
    blob(s, 18, 13);
    if (kind === "lab") {
      part(s, "box", era >= 13 ? "#e3f2fd" : "#f1faee", [26, 16, 18]);
      part(s, "box", "#9b5de5", [28, 4, 20], [0, 16, 0]);
      part(s, "dome", "#9b5de5", 6, [6, 20, -2]);
      picture(s, "🔬", 14, [-4, 20, 2]);
      part(s, "box", "#cdb4db", [5, 9, 1], [0, 0, 9.2]);
      glow(s, 0, 8, 11, 18);
    } else {
      part(s, "pyramid", "#606c38", [16, 22, 13]);
      part(s, "pyramid", "#283618", [4, 11, 1], [0, 0, 9.2]);
      part(s, "cyl", "#3d2b1f", [0.8, 14, 0.8], [0, 20, 0]);
      const flag = part(s, "box", "#ff6b6b", [9, 6, 0.6], [4.5, 29, 0]);
      anims.push((t) => { flag.scale.x = 9 + Math.sin(t * 6) * 1.5; flag.position.x = flag.scale.x / 2; });
      glow(s, 0, 6, 10, 14);
    }
    if (level > 0) word(s, "★" + level, 8, "#ffd93d", [12, 22, 6]);
  }

  // A landmark: the pyramid is built, every other one is a big picture.
  function landmark(parent, e, x, z, size) {
    if (e.mark === "pyramid") {
      part(parent, "pyramid", "#e9c46a", [size * 0.75, size * 0.8, size * 0.75], [x, 0, z]);
      return null;
    }
    return picture(parent, e.mark, size, [x, 0, z]);
  }

  function tree(parent, x, z, kind, s) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    parent.add(g);
    if (!kind || kind === "🌲") blob(g, 9, 7);
    if (!kind) {
      part(g, "cyl", "#8b5a2b", [2.5, 12, 2.5]);
      part(g, "sphere", "#52b788", 10, [0, 18, 0]);
      part(g, "sphere", "#40916c", 7, [4, 24, 2]);
    } else if (kind === "🌲") {
      part(g, "cyl", "#6f4518", [2, 6, 2]);
      part(g, "cone", "#2d6a4f", [9, 14, 9], [0, 5, 0]);
      part(g, "cone", "#40916c", [7, 12, 7], [0, 13, 0]);
    } else {
      picture(g, kind, 24, [0, 0, 0]);
    }
    return g;
  }

  // A line of something along the map: a path, a wall...
  function strip(parent, a, b, width, height, color, y) {
    const dx = X(b.x) - X(a.x), dz = Z(b.y) - Z(a.y);
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return null;
    const m = part(parent, "box", color, [width, height, len + (y === undefined ? width : 0)], [(X(a.x) + X(b.x)) / 2, y || 0, (Z(a.y) + Z(b.y)) / 2]);
    m.rotation.y = Math.atan2(dx, dz);
    return m;
  }

  function cow(parent, x, z, i) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    blob(g, 9, 5);
    [[-5, -2.5], [5, -2.5], [-5, 2.5], [5, 2.5]].forEach(([lx, lz]) => part(g, "cyl", "#ffffff", [1.2, 5, 1.2], [lx, 0, lz]));
    part(g, "sphere", "#ffffff", [8, 4.5, 4.5], [0, 8, 0]);
    part(g, "sphere", "#2b2d42", [2.5, 2.2, 2], [-2, 10, 3]);
    part(g, "sphere", "#2b2d42", [2, 2, 2], [3, 9, -3]);
    part(g, "sphere", "#ffafcc", [3, 2.8, 2.6], [9, 9, 0]);
    part(g, "sphere", "#2b2d42", 0.7, [10, 10.5, 1.8]);
    part(g, "sphere", "#2b2d42", 0.7, [10, 10.5, -1.8]);
    anims.push((t) => { g.position.x = x + Math.sin(t * 0.5 + i) * 5; g.rotation.y = Math.cos(t * 0.5 + i) > 0 ? 0 : Math.PI; });
  }

  // Everything that only changes when the city changes. key says when to build it again.
  function cityKey() {
    const c = world.c, b = world.battle();
    const health = b.wall <= 0 ? -1 : Math.round((10 * b.wall) / b.wallMax);
    return [c.era, c.order.join(","), c.lv.house, c.lv.lab, c.lv.barracks, c.wallLevel, health,
      Math.min(FIELDS.length, c.jobs.farmer), c.jobs.herder, c.jobs.miner > 0, c.jobs.builder > 0,
      Math.min(6, Math.ceil(c.bricks / 10)), c.towers.map((tw) => (tw ? 1 : tw === null ? 0 : "")).join(""),
      world.towerTier()].join("|");
  }

  function buildTown() {
    scene.remove(town);
    town = new THREE.Group();
    scene.add(town);
    anims = []; faceMe = []; towerBars = [];
    const c = world.c, b = world.battle(), era = c.era, E = ERAS[era];

    ground.material.color.set(E.ground);
    grid.visible = era === LAST;

    // The road of history along the bottom, and the paths from the gates.
    const paved = era >= 13;
    const roadColor = paved ? "#495057" : "#d4a373", pathColor = paved ? "#6c757d" : "#ddb892";
    part(town, "box", roadColor, [1600, 0.6, 18], [0, 0, Z(ROAD)]);
    PATH_LINES.forEach((line) => {
      for (let i = 1; i < line.length; i++) strip(town, line[i - 1], line[i], 10, 0.5, pathColor);
    });
    for (let i = 0; i < FIELDS.length; i += 2) {
      const y = FIELDS[i + 1].y + 16;
      strip(town, { x: 98, y }, { x: FIELDS[i + 1].x + 30, y }, 6, 0.5, pathColor);
    }
    if (paved) {
      const dashes = [];
      for (let i = 0; i < 40; i++) dashes.push(part(town, "box", "#f8f9fa", [12, 0.8, 2], [0, 0, Z(ROAD)]));
      anims.push((t) => dashes.forEach((d, i) => { d.position.x = X(((i * 24 - t * 10) % 960 + 960) % 960 - 240); }));
    } else if (era >= 11) {
      for (let x = -240; x < MW + 240; x += 10) part(town, "box", "#6f4518", [4, 0.8, 14], [X(x), 0, Z(ROAD)]);
      [-4, 4].forEach((d) => part(town, "box", "#adb5bd", [1600, 1.4, 1], [0, 0.6, Z(ROAD) + d]));
    }
    // A landmark from every age you went through, in a line beside the road.
    for (let i = 0; i <= era; i++) {
      const x = i < 10 ? 14 + i * 21 : 272 + (i - 10) * 21;
      landmark(town, ERAS[i], X(x), Z(ROAD - 18), 18);
    }
    // What drives along the road in this age.
    if (E.ride) {
      const rides = [0, 1].map(() => picture(town, E.ride, E.ride.length > 3 ? 18 : 22, [0, 0, Z(ROAD) + 2]));
      if (E.ride.length > 3) rides.forEach((r) => { r.scale.x = 54; r.material = pictureWide(E.ride); });
      anims.push((t) => rides.forEach((r, k) => { r.position.x = X(MW + 40 - ((t * 34 + k * 260) % (MW + 120))); }));
    }
    // Something flies over the city now and then.
    if (E.sky) {
      const flyer = picture(town, E.sky, 26, [0, 110, Z(40)]);
      anims.push((t) => {
        const fly = (t * 45) % (MW * 2.5);
        flyer.visible = fly < MW + 60;
        flyer.position.x = X(MW + 30 - fly);
        flyer.position.y = 110 + Math.sin(t * 2) * 6;
      });
    }

    // Trees around the city, and a few more out in the country.
    [[160, 300], [322, 300], [10, 96], [470, 292], [130, 296], [366, 296]].forEach(([x, y], i) => tree(town, X(x), Z(y), E.tree, 0.8 + (i % 3) * 0.1));
    [[-40, 150], [-60, 260], [-30, 330], [520, 40], [540, 160], [510, 330], [120, -50], [300, -60], [420, -40], [-20, -30], [200, -90]]
      .forEach(([x, y], i) => tree(town, X(x), Z(y), E.tree, 1 + (i % 3) * 0.15));

    // The mine in the mountain.
    part(town, "cone", "#8d99ae", [44, 78, 40], [X(30), 0, Z(42)]);
    part(town, "cone", "#edf2f4", [13, 22, 12], [X(30), 57, Z(42)]);
    part(town, "cone", "#99a3b5", [30, 50, 28], [X(78), 0, Z(40)]);
    part(town, "sphere", "#2b2d42", [10, 10, 3], [X(MINE.x), 0, Z(MINE.y + 14)]);
    if (c.jobs.miner) {
      const spark = picture(town, "✨", 12, [X(MINE.x + 16), 14, Z(MINE.y + 14)]);
      anims.push((t) => { spark.position.y = 14 + Math.sin(t * 5) * 3; });
    }

    // Fields: one for each farmer (an empty patch when nobody farms).
    const fields = Math.max(1, Math.min(FIELDS.length, c.jobs.farmer));
    for (let i = 0; i < fields; i++) {
      const f = FIELDS[i];
      part(town, "box", c.jobs.farmer ? "#bc6c25" : "#a98467", [34, 1.5, 28], [X(f.x + 18), 0, Z(f.y + 15)]);
      if (!c.jobs.farmer) continue;
      const rows = [0, 1, 2, 3].map((r) => part(town, "box", "#70e000", [28, 4, 3], [X(f.x + 18), 1.5, Z(f.y + 5 + r * 7)]));
      // Green, then ripe and yellow, then green again.
      anims.push((t) => {
        const m = mat((Math.floor(t / 4) + i) % 3 === 0 ? "#ffd93d" : "#70e000");
        rows.forEach((r) => { r.material = m; });
      });
    }

    // Brick yard and its oven.
    for (let i = 0; i < Math.min(6, Math.ceil(c.bricks / 10)); i++) {
      part(town, "box", "#c1121f", [10, 4, 5], [X(404 + (i % 3) * 11), Math.floor(i / 3) * 4, Z(84)]);
    }
    part(town, "dome", "#9c6644", [18, 22, 16], [X(KILN.x + 16), 0, Z(KILN.y)]);
    part(town, "sphere", c.jobs.builder ? "#ff9f1c" : "#3d2b1f", [7, 8, 2], [X(KILN.x + 16), 0, Z(KILN.y) + 15]);
    if (c.jobs.builder) smoke(town, X(KILN.x + 16), 22, Z(KILN.y), 3, 4);

    // Pasture: fence and cows.
    const px0 = PASTURE.x - 36, py0 = PASTURE.y - 76, pw = 72, ph = 152;
    const corners = [{ x: px0, y: py0 }, { x: px0 + pw, y: py0 }, { x: px0 + pw, y: py0 + ph }, { x: px0, y: py0 + ph }];
    corners.forEach((a, i) => {
      const b2 = corners[(i + 1) % 4];
      strip(town, a, b2, 1.2, 1.2, "#7f5539", 5);
      strip(town, a, b2, 1.2, 1.2, "#7f5539", 9);
      const n = Math.round(Math.hypot(b2.x - a.x, b2.y - a.y) / 19);
      for (let k = 0; k < n; k++) {
        part(town, "box", "#7f5539", [2, 11, 2], [X(a.x + ((b2.x - a.x) * k) / n), 0, Z(a.y + ((b2.y - a.y) * k) / n)]);
      }
    });
    if (era >= 1) {
      const cows = Math.min(8, c.jobs.herder * 2);
      for (let i = 0; i < cows; i++) cow(town, X(PASTURE.x - 18 + (i % 2) * 34), Z(PASTURE.y - 52 + Math.floor(i / 2) * 36), i);
    } else {
      picture(town, "🔒", 20, [X(PASTURE.x), 2, Z(PASTURE.y)]);
    }

    // The town wall is the battle wall: higher and thicker for every stronger wall, redder
    // when it is hurt, and only rubble once it is broken.
    const health = Math.max(0, b.wall / b.wallMax);
    const lines = [
      [{ x: GATE.x - 14, y: GATE.y }, { x: 112, y: GATE.y }, { x: 112, y: WGATE.y + 9 }],
      [{ x: 112, y: WGATE.y - 9 }, { x: 112, y: 12 }, { x: 388, y: 12 }, { x: 388, y: EGATE.y - 9 }],
      [{ x: 388, y: EGATE.y + 9 }, { x: 388, y: GATE.y }, { x: GATE.x + 14, y: GATE.y }],
    ];
    if (b.wall <= 0) {
      lines.forEach((line) => {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], z = line[i], n = Math.ceil(Math.hypot(z.x - a.x, z.y - a.y) / 12);
          for (let k = 0; k < n; k++) {
            const f = (k + 0.5) / n;
            const r = part(town, "box", "#a47148", [6, 3 + (k % 3), 6], [X(a.x + (z.x - a.x) * f), 0, Z(a.y + (z.y - a.y) * f)]);
            r.rotation.y = k;
          }
        }
      });
    } else {
      const thick = 5 + Math.min(8, c.wallLevel * 2), high = 12 + Math.min(12, c.wallLevel * 3);
      const color = era === LAST ? basic("#00dcff")
        : mat("#" + new THREE.Color(E.wall).lerp(new THREE.Color("#e63946"), health < 0.7 ? (0.7 - health) * 0.8 : 0).getHexString());
      lines.forEach((line) => {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], z = line[i];
          strip(town, a, z, thick, high, color);
          const n = Math.floor(Math.hypot(z.x - a.x, z.y - a.y) / 12);
          for (let k = 1; k < n; k++) {
            const f = k / n;
            part(town, "box", color, [thick + 1, 4, 5], [X(a.x + (z.x - a.x) * f), high, Z(a.y + (z.y - a.y) * f)]);
          }
        }
        // A post at each end, beside the gates.
        [line[0], line[line.length - 1]].forEach((p) => part(town, "box", color, [thick + 4, high + 6, thick + 4], [X(p.x), 0, Z(p.y)]));
      });
    }

    // Towers, each with its own life bar; a fallen one is a heap of stones until you build it again.
    const w = world.weapons[world.towerTier()];
    TOWERS.forEach(([x, y], i) => {
      const tw = c.towers[i];
      if (tw === null) {
        part(town, "sphere", "#8d99ae", [6, 4, 5], [X(x) - 4, 1, Z(y)]);
        part(town, "sphere", "#adb5bd", [5, 3.5, 4], [X(x) + 4, 1, Z(y) + 2]);
        return;
      }
      if (!tw) return;
      const g = new THREE.Group();
      g.position.set(X(x), 0, Z(y));
      town.add(g);
      part(g, "cyl", "#adb5bd", [10, 38, 10]);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        part(g, "box", "#adb5bd", [4, 5, 4], [Math.cos(a) * 9, 38, Math.sin(a) * 9]);
      }
      part(g, "box", "#2b2d42", [4, 8, 1], [0, 20, 10]);
      part(g, "cyl", "#6c757d", [0.7, 14, 0.7], [0, 38, 0]);
      part(g, "box", "#ff6b6b", [8, 5, 0.6], [4, 47, 0]);
      picture(g, w.emoji, 13, [0, 38, 4]);
      towerBars[i] = makeBar(g, 26, 60);
    });

    // Buildings and the town hall.
    c.order.forEach((kind, i) => {
      const s = world.cellSpot(i);
      if (kind === "house") house(town, X(s.x), Z(s.y), ERAS[c.lv.house].house);
      else special(town, kind, X(s.x), Z(s.y), c.lv[kind], era);
    });
    part(town, "cyl", "#e9ecef", [26, 3, 22], [X(HALL.x), 0, Z(HALL.y)]);
    blob(town, 30, 24, X(HALL.x), Z(HALL.y));
    const mark = landmark(town, E, X(HALL.x), Z(HALL.y), 46);
    if (mark) {
      mark.position.y = 3;
      anims.push(() => { const pop = c.newAge > 0 ? 1 + Math.sin(c.newAge * 12) * 0.15 * c.newAge : 1; mark.scale.set(46 * pop, 46 * pop, 1); });
    }
    if (era === 0) {
      const fire = picture(town, "🔥", 14, [X(HALL.x + 30), 0, Z(HALL.y + 14)]);
      anims.push((t) => { fire.scale.y = 14 + Math.sin(t * 10) * 1.5; });
    }
  }

  // A long picture (a train) on a wider canvas.
  const wideCache = {};
  function pictureWide(text) {
    if (wideCache[text]) return wideCache[text];
    const c = document.createElement("canvas");
    c.width = 384; c.height = 128;
    const x = c.getContext("2d");
    x.font = "100px " + FONT_EMOJI;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 192, 72);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return (wideCache[text] = new THREE.SpriteMaterial({ map: tex, transparent: true }));
  }

  // ---------- The shield over the town ----------

  const shield = new THREE.Group();
  const shieldMat = new THREE.MeshBasicMaterial({ color: "#90e0ef", transparent: true, opacity: 0.2, depthWrite: false });
  part(shield, "dome", shieldMat, [158, 60, 140]);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#4d96ff" }));
  rim.scale.set(158, 158, 140);
  rim.position.y = 1;
  shield.add(rim);
  shield.position.set(X(250), 0, Z(GATE.y / 2 + 4));
  scene.add(shield);

  // ---------- People ----------

  const SKIN_DARK = "#2b2d42";
  const people = new Map(); // n -> the person's group
  function person(n) {
    if (people.has(n)) return people.get(n);
    const L = world.lookOf(n);
    const p = new THREE.Group();
    const body = new THREE.Group();
    p.add(body);
    blob(p, 4, 3);
    p.legs = [-1, 1].map((side) => {
      const leg = new THREE.Group();
      leg.position.set(side * 1.4, 6, 0);
      part(leg, "box", L.dress ? L.skin : L.legs, [1.8, -6, 1.8]);
      body.add(leg);
      return leg;
    });
    if (L.dress) part(body, "cone", L.shirt, [4.6, 8, 4.6], [0, 4.5, 0]);
    else part(body, "box", L.shirt, [6.4, 7, 4], [0, 5.5, 0]);
    p.arms = [-1, 1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 3.6, 12, 0);
      part(arm, "box", L.shirt, [1.6, -6, 1.6]);
      body.add(arm);
      return arm;
    });
    const hy = 16;
    part(body, "sphere", L.skin, 3.4, [0, hy, 0]);
    part(body, "sphere", SKIN_DARK, 0.5, [-1.2, hy + 0.3, 3.1]);
    part(body, "sphere", SKIN_DARK, 0.5, [1.2, hy + 0.3, 3.1]);
    if (L.hat) {
      part(body, "cyl", L.hat, [5, 0.6, 5], [0, hy + 2, 0]);
      part(body, "dome", L.hat, 3.2, [0, hy + 2.2, 0]);
    } else {
      part(body, "dome", L.hair, [3.6, 3.4, 3.6], [0, hy + 0.2, -0.3]);
      if (L.woman && L.hairStyle !== 2) part(body, "box", L.hair, [6.6, L.hairStyle ? 5 : 7, 2], [0, hy - (L.hairStyle ? 4 : 6), -2.2]);
      if (L.woman && L.hairStyle === 2) part(body, "sphere", L.hair, 1.9, [0, hy + 3.6, -1]);
    }
    p.tool = new THREE.Group();
    p.tool.position.y = -6;
    p.arms[1].add(p.tool);
    p.job = null;
    scene.add(p);
    people.set(n, p);
    return p;
  }
  // What each worker carries.
  const TOOLS = { builder: "🔨", miner: "⛏️", trader: "💰", scientist: "🧪" };
  function giveTool(p, job) {
    p.job = job;
    p.tool.clear();
    if (p.ask) { p.remove(p.ask); p.ask = null; }
    if (job === "farmer" || job === "herder") {
      const stick = part(p.tool, "cyl", "#8d5a2b", [0.5, 14, 0.5], [0, -4, 1]);
      stick.rotation.x = Math.PI / 2 - 0.4;
      if (job === "farmer") part(p.tool, "box", "#9aa0a6", [3.4, 0.8, 0.8], [0, 0.8, 13]);
      else part(p.tool, "dome", "#8d5a2b", [2, 2, 0.5], [0, 2, 12.5]);
    } else if (TOOLS[job]) {
      picture(p.tool, TOOLS[job], 8, [0, -3, 2]);
    } else if (job === "idle") {
      p.ask = word(p, "?", 7, "#ffffff", [0, 27, 0]);
    }
  }

  function updatePeople(clock) {
    const seen = new Set();
    world.people().forEach((q) => {
      const p = person(q.n);
      seen.add(q.n);
      if (p.job !== q.job) giveTool(p, q.job);
      p.visible = true;
      const x = X(q.x), z = Z(q.y);
      const dx = x - p.position.x, dz = z - p.position.z;
      if (dx * dx + dz * dz > 0.01 && dx * dx + dz * dz < 400) p.rotation.y = Math.atan2(dx, dz);
      else if (q.working || q.job === "idle") p.rotation.y = 0;
      p.position.set(x, 0, z);
      p.children[0].position.y = q.bounce * 1.5;
      const step = Math.sin(q.walk) * 0.6;
      p.legs[0].rotation.x = step; p.legs[1].rotation.x = -step;
      p.arms[0].rotation.x = -step * 0.7;
      p.arms[1].rotation.x = q.working ? -1.2 + Math.sin(clock * 7 + q.x) * 0.7 : step * 0.7;
      if (p.ask) p.ask.position.y = 27 + Math.abs(Math.sin(clock * 4 + q.x)) * 3;
    });
    people.forEach((p, n) => { if (!seen.has(n)) p.visible = false; });
  }

  // ---------- Enemies ----------

  // The same army as in the battle (units3d.js): squads of soldiers dressed for their age,
  // tanks and giants, only smaller. Without the battle's list of enemies, plain shapes.
  const units = window.ArmyUnits3D ? ArmyUnits3D() : null;
  const enemies = new Map(); // the battle's enemy -> its mesh
  function foe(type, wave, r) {
    const T = world.enemyTypes && world.enemyTypes[type];
    const g = new THREE.Group();
    if (units && T) {
      const v = units.enemy(type, T, wave || 0);
      v.root.scale.setScalar((r / T.r) * 1.6);
      g.add(v.root);
      g.v = v;
      g.top = v.top * (r / T.r) * 1.6;
      return g;
    }
    const s = r * 1.15;
    blob(g, s * 1.1, s * 0.6);
    part(g, "box", "#4e534f", [s * 2.2, s * 0.9, s * 1.5], [0, 0.45 * s, 0]);
    g.top = s;
    return g;
  }
  function enemyMesh(e, r) {
    if (enemies.has(e)) return enemies.get(e);
    const g = foe(e.type, e.wave, r);
    g.bang = picture(g, "💥", 12, [0, g.top + 8, 0]);
    scene.add(g);
    enemies.set(e, g);
    return g;
  }

  const BEAM = new THREE.MeshBasicMaterial({ color: "#ffd93d" });
  const beams = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1).translate(0, 0, 0.5), BEAM);
    scene.add(m);
    return m;
  });

  function updateEnemies(clock) {
    const list = world.enemies();
    const seen = new Set();
    list.forEach(({ e, p, r }) => {
      const g = enemyMesh(e, r);
      seen.add(e);
      const x = X(p.x), z = Z(p.y);
      const dx = x - g.position.x, dz = z - g.position.z;
      if (dx * dx + dz * dz > 0.01) g.rotation.y = Math.atan2(dx, dz);
      g.position.set(x, 0, z);
      if (g.v) units.animate(g.v, { time: clock, seed: e.seed, march: true, flash: 0, recoil: 0 });
      g.bang.visible = !!e.atWall && Math.floor(clock * 6 + e.seed) % 3 === 0;
    });
    enemies.forEach((g, e) => { if (!seen.has(e)) { scene.remove(g); enemies.delete(e); } });
    // Tower shots at the nearest enemy.
    beams.forEach((m) => { m.visible = false; });
    world.towerShots(list).forEach(({ slot, x, y, to }, k) => {
      const m = beams[k];
      const from = new THREE.Vector3(X(x), 42, Z(y));
      const aim = new THREE.Vector3(X(to.p.x), to.r, Z(to.p.y));
      m.visible = true;
      m.position.copy(from);
      m.scale.z = from.distanceTo(aim);
      m.lookAt(aim);
    });
  }

  // ---------- The enemy's war banner, when the battle is lost ----------

  const flag = new THREE.Group();
  flag.position.set(X(HALL.x + 34), 0, Z(HALL.y + 30));
  part(flag, "cyl", "#3b2f2a", [1.6, 90, 1.6]);
  part(flag, "cone", "#8a6a35", [2.6, 7, 2.6], [0, 93, 0]);
  const clothGeo = new THREE.PlaneGeometry(64, 44, 12, 4).translate(32, 0, 0);
  const clothBase = clothGeo.attributes.position.array.slice();
  const clothTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 176;
    const x = c.getContext("2d");
    x.fillStyle = "#1a1414"; x.fillRect(0, 0, 256, 176);
    x.fillStyle = "#7a1414"; x.fillRect(12, 12, 232, 152);
    x.lineCap = "round";
    [-1, 1].forEach((k) => {
      x.strokeStyle = "#d9d4c7"; x.lineWidth = 12;
      x.beginPath(); x.moveTo(128 - 46 * k, 136); x.lineTo(128 + 40 * k, 40); x.stroke();
      x.strokeStyle = "#c9a227"; x.lineWidth = 10;
      x.beginPath(); x.moveTo(128 - 60 * k, 118); x.lineTo(128 - 26 * k, 152); x.stroke();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshBasicMaterial({ map: clothTex, side: THREE.DoubleSide }));
  cloth.position.set(1, 66, 0);
  flag.add(cloth);
  // Its soldiers stand guard around it, dressed for the age of the last wave.
  let guards = null, guardsWave = -1;
  function placeGuards(wave) {
    if (guards) guards.forEach((d) => flag.remove(d));
    guards = [0, 1, 2, 3, 4].map((k) => {
      const d = foe(k === 2 ? "boss" : "soldier", wave, k === 2 ? 11 : 7);
      const a = Math.PI * (0.15 + k * 0.175);
      d.position.set(-Math.cos(a) * 40, 0, Math.sin(a) * 26);
      flag.add(d);
      return d;
    });
    guardsWave = wave;
  }
  flag.visible = false;
  scene.add(flag);
  function updateFlag(clock) {
    flag.visible = world.state() === "over";
    if (!flag.visible) return;
    const pos = clothGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = clothBase[i * 3] / 64;
      pos.setZ(i, Math.sin(clock * 5 - u * 5) * 6 * u);
    }
    pos.needsUpdate = true;
    const wave = (world.battle() && world.battle().wave) || 0;
    if (wave !== guardsWave) placeGuards(wave);
  }

  // ---------- The words over the map ----------

  const hudScene = new THREE.Scene();
  const hudCam = new THREE.OrthographicCamera(0, MW, 0, -MH, -1, 1);
  const hudTex = new THREE.CanvasTexture(words);
  hudTex.colorSpace = THREE.SRGBColorSpace;
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false }));
  hud.position.set(MW / 2, -MH / 2, 0);
  hudScene.add(hud);

  // ---------- The camera: slide sideways on the map to turn around the town ----------

  const target = new THREE.Vector3(0, 0, 14);
  let yaw = 0, yawGoal = 0, drag = null;
  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, yaw: yawGoal, id: e.pointerId };
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    yawGoal = Math.max(-0.9, Math.min(0.9, drag.yaw - ((e.clientX - drag.x) / canvas.clientWidth) * 2));
  });
  const stop = () => { drag = null; canvas.style.cursor = "grab"; };
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => canvas.addEventListener(ev, stop));

  function placeCamera() {
    yaw += (yawGoal - yaw) * 0.15;
    const dist = 610, pitch = 0.98;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(target);
  }

  let w0 = 0, h0 = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === w0 && h === h0)) return;
    w0 = w; h0 = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const v = new THREE.Vector3();
  const map = {
    // Set by a game that moves the camera itself (you walk and fly in the city in 3D and FPS,
    // see explore.js): called before each picture instead of the slide-to-turn camera.
    moveCamera: null,
    words: true, // false hides the words layer (it only fits the map's own shape)
    camera,
    // Where a spot of the map, h above the ground, is on the words layer.
    toScreen(x, y, h) {
      v.set(X(x), h || 0, Z(y)).project(camera);
      return { x: ((v.x + 1) / 2) * MW, y: ((1 - v.y) / 2) * MH };
    },
    draw() {
      const clock = world.clock, c = world.c, b = world.battle();
      resize();
      if (map.moveCamera) map.moveCamera(camera);
      else placeCamera();
      const key = cityKey();
      if (key !== lastKey) { lastKey = key; buildTown(); }
      anims.forEach((f) => f(clock));
      faceMe.forEach((m) => m.quaternion.copy(camera.quaternion));
      c.towers.forEach((tw, i) => { if (tw && towerBars[i]) towerBars[i](tw.hp / tw.max); });
      shield.visible = b.shield > 0 && !(b.shield < 2 && Math.floor(clock * 8) % 2);
      updatePeople(clock);
      updateEnemies(clock);
      updateFlag(clock);

      // Day and night: the sky goes dark, stars come out and windows light up.
      const night = world.night();
      scene.background.copy(DAY).lerp(NIGHT, night);
      scene.fog.color.copy(scene.background);
      hemi.intensity = 2 * (1 - night * 0.45);
      hemi.color.copy(WHITE).lerp(MOONLIGHT, night);
      sun.intensity = 1.8 * (1 - night * 0.75);
      starMat.opacity = night;
      moon.material.opacity = night;
      moon.visible = night > 0;
      GLOW.opacity = night * 0.9;

      hudTex.needsUpdate = true;
      renderer.clear();
      renderer.render(scene, camera);
      if (map.words) renderer.render(hudScene, hudCam);
    },
  };
  return map;
};

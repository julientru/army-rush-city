// Army Rush in 3D: the battle seen from behind your army, drawn with Three.js.
// The battle itself is in army.js; this only draws it. ArmyViews["3d"](core) is called the first
// time the 3D view is picked (see `core` in army.js), and returns null when the device can't show 3D.
window.ArmyViews = window.ArmyViews || {};
window.ArmyViews["3d"] = function (core) {
  const { W, H, WALL_Y, SQUAD_Y, WEAPONS, ENEMIES, PARTY, FONT, stage, city, squadSpots, shotHeight, fmt, t } = core;
  let g = core.g, time = core.time, state = core.state; // the battle, read again each time it draws

  // How it feels, not how it plays: the ground rushes by at SCROLL units a second and
  // everyone runs TEMPO times faster on the spot. Enemy and shot speeds stay the same.
  const SCROLL = 150;
  const TEMPO = 1.6;

  const canvas = document.createElement("canvas");
  canvas.className = "view view-3d";
  canvas.hidden = true;
  stage.prepend(canvas);

  // ======================================================================
  // 3D drawing. Field x -> world X (centred), field y -> world Z (you are at +Z),
  // height -> world Y. One field unit is one world unit.
  // ======================================================================

  const wx = (x) => x - W / 2;
  const wz = (y) => y - H;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    canvas.remove();
    return null;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const SKY = 0x9aa5ad;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 750, 1500);
  const camera = new THREE.PerspectiveCamera(50, 0.75, 5, 3000);

  scene.add(new THREE.HemisphereLight(0xe8eef4, 0x4a4436, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-200, 400, 300);
  scene.add(sun);

  // Three tones of light: the flat cartoon look.
  const gradient = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;

  const toonCache = {};
  function mat(color) {
    return toonCache[color] || (toonCache[color] = new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  }
  const basicCache = {};
  function basic(color) {
    return basicCache[color] || (basicCache[color] = new THREE.MeshBasicMaterial({ color }));
  }
  const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function starShape() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rad = i % 2 ? 0.45 : 1;
      if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    return new THREE.ShapeGeometry(s);
  }

  const GEO = {
    sphere: new THREE.SphereGeometry(1, 16, 12),
    ball: new THREE.SphereGeometry(1, 10, 8),
    dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    tube: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true),
    cone: new THREE.ConeGeometry(1, 1, 14),
    plane: new THREE.PlaneGeometry(1, 1),
    barPlane: new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0),
    disc: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
    arc: new THREE.TorusGeometry(1, 0.2, 6, 14, Math.PI),
    star: starShape(),
    shield: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
  };

  // A mesh with a size and a place, added to its parent.
  function part(parent, geo, material, size, pos) {
    const m = new THREE.Mesh(GEO[geo], typeof material === "string" ? mat(material) : material);
    if (typeof size === "number") m.scale.setScalar(size); else m.scale.set(size[0], size[1], size[2]);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    parent.add(m);
    return m;
  }

  const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });
  function blob(parent, r) {
    const m = part(parent, "disc", SHADOW, [r, 1, r * 0.8], [0, 0.6, 0]);
    m.renderOrder = 1;
    return m;
  }

  function lighten(hex, k) {
    return "#" + new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHexString();
  }
  function darken(hex, k) {
    return "#" + new THREE.Color(hex).multiplyScalar(k).getHexString();
  }

  // ---------- Text sprites (words that pop up, boss names) ----------

  const textCache = new Map();
  function textTexture(text, color) {
    const key = text + "|" + color;
    if (textCache.has(key)) return textCache.get(key);
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const font = "bold 64px " + FONT;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    c.width = w;
    c.height = 92;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#2b2d42";
    ctx.strokeText(text, w / 2, 48);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const out = { tex, aspect: w / 92 };
    textCache.set(key, out);
    return out;
  }

  function textSprite(text, color, height) {
    const t = textTexture(text, color);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, depthTest: false, transparent: true }));
    sp.scale.set(height * t.aspect, height, 1);
    sp.renderOrder = 40;
    return sp;
  }

  // ---------- Life bars: always face you and draw on top ----------

  const barMat = (color) => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const BAR = { bg: barMat("#2b2d42"), shown: barMat("#fff3b0"), green: barMat("#6bcb77"), yellow: barMat("#ffd93d"), red: barMat("#ff6b6b") };

  function makeBar(w, thick) {
    const t = thick || 7;
    const group = new THREE.Group();
    const bg = part(group, "plane", BAR.bg, [w + 5, t + 5, 1], [0, 0, 0]);
    const shown = part(group, "barPlane", BAR.shown, [w, t, 1], [-w / 2, 0, 0]);
    const fg = part(group, "barPlane", BAR.green, [w, t, 1], [-w / 2, 0, 0]);
    bg.renderOrder = 30; shown.renderOrder = 31; fg.renderOrder = 32;
    return {
      group,
      set(ratio, shownRatio) {
        ratio = Math.max(0, Math.min(1, ratio));
        shownRatio = Math.max(0, Math.min(1, shownRatio));
        fg.visible = ratio > 0;
        if (ratio > 0) fg.scale.x = w * ratio;
        fg.material = ratio > 0.5 ? BAR.green : ratio > 0.25 ? BAR.yellow : BAR.red;
        shown.visible = shownRatio > 0;
        if (shownRatio > 0) shown.scale.x = w * shownRatio;
      },
    };
  }

  // Glue together parts that never move on their own (fence posts, trees, the wall): one mesh
  // with painted corners instead of twenty, so phones have far less to draw.
  const mergedGeo = {};
  const MERGED = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
  // One geometry from many meshes (placed by their matrixWorld), each keeping its colour.
  function glueGeometry(parts) {
    const pos = [], nor = [], col = [];
    parts.forEach((m) => {
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      const p = geo.attributes.position, n = geo.attributes.normal, c = m.material.color;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        col.push(c.r, c.g, c.b);
      }
      geo.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }

  // A whole group (built at the origin) as a single mesh.
  function glue(group) {
    group.updateMatrixWorld(true);
    const parts = [];
    group.traverse((m) => { if (m.isMesh) parts.push(m); });
    return new THREE.Mesh(glueGeometry(parts), MERGED);
  }

  // ---------- The enemy: squads, tanks and bosses (see units3d.js) ----------

  const units = ArmyUnits3D();
  const nameMats = {};
  function makeEnemy(o) {
    const T = ENEMIES[o.type];
    const v = units.enemy(o.type, T, o.wave || 0);
    v.bar = makeBar(Math.max(36, T.r * 1.8));
    v.bar.group.position.y = v.top + 14;
    v.root.add(v.bar.group);
    if (T.r >= 40) {
      if (!nameMats[o.type]) nameMats[o.type] = textSprite(T.name, "#ffffff", 16).material;
      const tx = textTexture(T.name, "#ffffff");
      v.label = new THREE.Sprite(nameMats[o.type]);
      v.label.scale.set(18 * tx.aspect, 18, 1);
      v.label.renderOrder = 40;
      v.label.position.y = v.top + 30;
      v.root.add(v.label);
    }
    return v;
  }

  function updateEnemy(e, v) {
    const T = ENEMIES[e.type], r = T.r;
    v.root.position.set(wx(e.x), 0, wz(e.y));
    v.body.position.z = -(e.flash / 0.15) * r * 0.15; // knocked back a little by each hit
    v.body.position.y = e.atWall ? Math.abs(Math.sin(e.bash * 6)) * r * 0.05 : 0;
    units.animate(v, { time, seed: e.seed, march: true, flash: e.flash, recoil: e.throwT > 0 ? e.throwT / 0.3 : 0, speed: TEMPO });
    v.bar.set(e.hp / e.maxHp, e.shownHp / e.maxHp);
    v.bar.group.quaternion.copy(camera.quaternion);
  }

  // Knocked out: they fall, go dark and sink into the ground (see army.js for how long).
  function updateTumbler(t, v) {
    if (!v.down) {
      v.down = true;
      v.bar.group.visible = false;
      if (v.label) v.label.visible = false;
    }
    v.root.position.set(wx(t.x), 0, wz(t.y));
    units.fall(v, t.t / t.life);
  }

  // ---------- Your army ----------

  // The machines: cannon, tank, plane, satellite and mega bomb.
  function makeVehicle(tier) {
    const u = new THREE.Group();
    const body = new THREE.Group();
    u.add(body);
    u.userData.body = body;
    if (tier === 5) {
      blob(u, 20);
      [-1, 1].forEach((side) => {
        const w = part(body, "cyl", "#6c584c", [8, 3.5, 8], [side * 11, 8, 3]);
        w.rotation.z = Math.PI / 2;
        part(body, "cyl", "#2b2d42", [2.5, 3.8, 2.5], [side * 11, 8, 3]).rotation.z = Math.PI / 2;
      });
      part(body, "box", "#7f5539", [16, 6, 18], [0, 8, 4]);
      const barrel = part(body, "cyl", "#343a40", [6.5, 30, 6.5], [0, 15, -6]);
      barrel.rotation.x = Math.PI / 2 - 0.3;
      part(body, "sphere", "#343a40", 7.5, [0, 11, 8]);
    } else if (tier === 7) {
      blob(u, 22);
      [-1, 1].forEach((side) => part(body, "box", "#3d405b", [7, 9, 30], [side * 13, 4.5, 0]));
      part(body, "box", "#5a6b3a", [20, 10, 24], [0, 10, 0]);
      part(body, "sphere", "#4b5a2c", 9, [0, 17, 2]);
      const gun = part(body, "cyl", "#2a2c2e", [2.4, 22, 2.4], [0, 17, -12]);
      gun.rotation.x = Math.PI / 2;
      part(body, "box", "#3b2f22", [6, 1, 6], [0, 26, 2]);
    } else if (tier === 9) {
      blob(u, 18);
      body.position.y = 46;
      const f = part(body, "cyl", "#7d8580", [4.5, 34, 4.5], [0, 0, 0]);
      f.rotation.x = Math.PI / 2;
      const nose = part(body, "cone", "#4b5a2c", [4.5, 8, 4.5], [0, 0, -21]);
      nose.rotation.x = -Math.PI / 2;
      part(body, "box", "#6b7560", [42, 1.8, 9], [0, 0, -3]);
      part(body, "box", "#6b7560", [16, 1.5, 5], [0, 0, 14]);
      part(body, "box", "#6b7560", [1.5, 9, 6], [0, 5, 14]);
      part(body, "sphere", "#90e0ef", [3, 2.6, 5], [0, 3.5, -8]);
      const prop = part(body, "box", "#2b2d42", [14, 1.5, 0.8], [0, 0, -25.5]);
      u.userData.prop = prop;
    } else if (tier === 10) {
      blob(u, 16);
      body.position.y = 74;
      part(body, "box", "#adb5bd", [14, 14, 14], [0, 0, 0]);
      [-1, 1].forEach((side) => {
        part(body, "box", "#1f3550", [17, 1.2, 11], [side * 17, 0, 0]);
        part(body, "cyl", "#6c757d", [0.8, 4, 0.8], [side * 8, 0, 0]).rotation.z = Math.PI / 2;
      });
      part(body, "sphere", "#ff6b6b", 2.5, [0, 8, 0]);
      const dish = part(body, "cone", "#e9ecef", [6, 5, 6], [0, -9, -2]);
      dish.rotation.x = Math.PI;
    } else {
      blob(u, 20);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
        part(body, "cyl", "#2b2d42", [4, 3, 4], [sx * 12, 4, sz * 9]).rotation.z = Math.PI / 2;
      }));
      part(body, "box", "#4b5a2c", [24, 5, 26], [0, 7, 0]);
      part(body, "sphere", "#2b2d42", 14, [0, 22, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const blade = part(body, "box", "#ffd93d", [5, 6, 1], [Math.sin(a) * 6, 22 + Math.cos(a) * 6, 13.6]);
        blade.rotation.z = -a;
      }
      part(body, "sphere", "#ffd93d", [2, 2, 1], [0, 22, 14]);
      part(body, "cyl", "#e09f00", [1, 7, 1], [2, 38, 0]).rotation.z = -0.3;
      u.userData.spark = part(body, "sphere", basic("#ff9f1c"), 3, [3.5, 42, 0]);
    }
    return u;
  }

  function makeUnit(tier, hero) {
    if (WEAPONS[tier].vehicle) return makeVehicle(tier);
    const v = units.friend(tier, hero);
    v.root.userData.body = v.body;
    v.root.userData.v = v;
    return v.root;
  }

  const squad = { group: new THREE.Group(), key: "", units: [] };
  scene.add(squad.group);

  function updateSquad() {
    const key = g.tier + ":" + g.count;
    if (squad.key !== key) {
      squad.key = key;
      squad.group.clear();
      squad.units = [];
      for (let i = 0; i < g.count; i++) {
        const u = makeUnit(g.tier, i === 0);
        squad.units.push(u);
        squad.group.add(u);
      }
    }
    const vehicle = WEAPONS[g.tier].vehicle;
    squadSpots().forEach((s) => {
      const u = squad.units[s.i];
      u.position.set(wx(s.x), 0, wz(s.y) + (g.kick > 0 ? 3 : 0));
      const body = u.userData.body;
      if (!vehicle) units.animate(u.userData.v, { time, seed: s.i, march: true, flash: 0, recoil: g.kick > 0 ? 1 : 0, speed: TEMPO });
      else if (g.tier === 9 || g.tier === 10) {
        body.position.y = (g.tier === 9 ? 46 : 74) + Math.sin(time * 3 + s.i) * 4;
        body.rotation.z = Math.sin(time * 2 + s.i) * 0.12;
      } else body.position.y = Math.abs(Math.sin(time * 6 + s.x * 0.1)) * 1.5;
      if (u.userData.cape) u.userData.cape.rotation.x = 0.25 + Math.sin(time * 10) * 0.15;
      if (u.userData.prop) u.userData.prop.rotation.z = time * 40;
      if (u.userData.spark) u.userData.spark.scale.setScalar(2 + Math.random() * 2);
    });
  }


  // ---------- Your shots ----------

  const LASER_GLOW = new THREE.MeshBasicMaterial({ color: 0x00dcff, transparent: true, opacity: 0.5, depthWrite: false });

  function makeBullet(b) {
    const root = new THREE.Group();
    const m = new THREE.Group();
    root.add(m);
    const along = (geo, color, rad, len, z) => {
      const p = part(m, geo, color, [rad, len, rad], [0, 0, z || 0]);
      p.rotation.x = -Math.PI / 2;
      return p;
    };
    switch (b.kind) {
      case "stone": part(m, "ball", "#8d99ae", 5.5); break;
      case "axe":
        part(m, "cyl", "#8b5a2b", [1.3, 18, 1.3]);
        part(m, "box", "#adb5bd", [1.6, 8, 9], [0, 6, -4]);
        break;
      case "arrow":
        along("cyl", "#8b5a2b", 1, 22, 4);
        along("cone", "#adb5bd", 2.6, 6, -9);
        part(m, "box", "#d8d2c4", [6, 4, 4], [0, 0, 14]);
        break;
      case "dart":
        along("cyl", basic("#ffd27a"), 1.4, 12, 0);
        break;
      case "pellet": along("cyl", basic("#ffd93d"), 2, 14, 0); break;
      case "ball": part(m, "ball", "#2b2d42", 9); part(m, "ball", "#6c757d", 3, [-3, 3, 6]); break;
      case "shell": along("cyl", "#b08d3c", 5, 18, 0); along("cone", "#6e7275", 5, 6, -12); break;
      case "missile":
        along("cyl", "#5a6b3a", 4, 18, 0);
        along("cone", "#3c3f39", 4, 7, -12.5);
        part(m, "box", "#3c3f39", [13, 1.2, 4], [0, 0, 7]);
        root.userData.flame = part(m, "ball", basic("#ff9f1c"), 4, [0, 0, 12]);
        break;
      case "plane": {
        const p = makeVehicle(9).userData.body;
        p.position.set(0, 0, 0);
        p.scale.setScalar(0.7);
        m.add(p);
        break;
      }
      case "laser": {
        const glow = part(m, "box", LASER_GLOW, [12, 12, 70], [0, 0, 35]);
        glow.renderOrder = 5;
        part(m, "box", basic("#ffffff"), [4, 4, 70], [0, 0, 35]);
        break;
      }
      case "bomb":
        part(m, "sphere", "#2b2d42", 16);
        part(m, "box", "#ffd93d", [9, 9, 1], [0, 0, 16]);
        part(m, "cyl", "#e09f00", [1, 7, 1], [0, 18, 0]);
        root.userData.flame = part(m, "ball", basic("#ff9f1c"), 3, [0, 22, 0]);
        break;
    }
    root.userData.spin = m;
    // A streak behind every small shot, longer for faster ones.
    const trail = TRAILS[b.kind];
    if (trail) part(root, "box", trail[0], [trail[1], trail[1], -b.vy * 0.07], [0, 0, -b.vy * 0.035 + 4]).renderOrder = 4;
    return { root };
  }

  const TRAIL_WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  const TRAIL_SMOKE = new THREE.MeshBasicMaterial({ color: 0xdee2e6, transparent: true, opacity: 0.6, depthWrite: false });
  const TRAILS = { stone: [TRAIL_WHITE, 4], axe: [TRAIL_WHITE, 4], arrow: [TRAIL_WHITE, 2], dart: [TRAIL_WHITE, 3],
    pellet: [TRAIL_WHITE, 2.5], ball: [TRAIL_SMOKE, 8], shell: [TRAIL_SMOKE, 6], missile: [TRAIL_SMOKE, 6] };

  function updateBullet(b, v) {
    v.root.position.set(wx(b.x), shotHeight(b.kind), wz(b.y));
    if (b.vx) v.root.rotation.y = Math.atan2(-b.vx, -b.vy); // tower shots fly at an angle
    const m = v.root.userData.spin;
    if (b.kind === "axe") m.rotation.x = -b.age * 18;
    else if (b.kind === "stone") m.rotation.x = -b.age * 10;
    else if (b.kind === "bomb") m.rotation.z = Math.sin(b.age * 10) * 0.3;
    if (v.root.userData.flame) v.root.userData.flame.scale.setScalar(3 + Math.random() * 2.5);
  }

  // ---------- Things the enemy throws ----------

  function makeShot(s) {
    const root = new THREE.Group();
    const m = new THREE.Group();
    root.add(m);
    if (s.kind === "stone" || s.kind === "rock") {
      const r = s.kind === "rock" ? 10 : 5;
      part(m, "ball", "#77736b", r);
      part(m, "ball", "#5f5b54", r * 0.5, [-r * 0.35, r * 0.4, r * 0.4]);
    } else if (s.kind === "cork") {
      // A spear, a bolt or a bullet: a dark dart with a pale tip.
      part(m, "cyl", "#3a2a1e", [1.2, 16, 1.2]).rotation.x = Math.PI / 2;
      part(m, "cone", "#9ea3a8", [2, 4, 2], [0, 0, 9]).rotation.x = Math.PI / 2;
    } else if (s.kind === "ball") {
      part(m, "ball", "#2b2d42", 8);
    } else {
      const big = s.kind === "bigshell";
      const r = big ? 7 : 5;
      part(m, "cyl", big ? "#5e1212" : "#4a4d50", [r, r * 3, r]).rotation.x = Math.PI / 2;
      part(m, "cone", big ? "#5e1212" : "#4a4d50", [r, r * 1.3, r], [0, 0, r * 2]).rotation.x = Math.PI / 2;
      root.userData.flame = part(m, "ball", basic("#ff9f1c"), r * 0.8, [0, 0, -r * 1.8]);
    }
    root.userData.spin = m;
    return { root };
  }

  function updateShot(s, v) {
    // Thrown in a nice arc from the enemy's hand to the wall (or to you).
    const lineY = g.wall > 0 ? WALL_Y - 6 : SQUAD_Y - 12;
    const k = Math.max(0, Math.min(1, (s.y - s.y0) / Math.max(1, lineY - s.y0)));
    const tank = s.kind === "shell" || s.kind === "bigshell";
    const h = s.h0 * (1 - k) + 10 * k + Math.sin(k * Math.PI) * (tank ? 18 : 55);
    v.root.position.set(wx(s.x), h, wz(s.y));
    if (!tank && s.kind !== "cork") v.root.userData.spin.rotation.x = s.age * 8;
    if (v.root.userData.flame) v.root.userData.flame.scale.setScalar(3 + Math.random() * 3);
  }

  // ---------- Boxes and tough walls ----------

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function circ(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  // Flat pictures of each weapon for the box fronts (same drawings as Army Rush).
  function weaponIcon(c, tier, x, y, s) {
    c.save();
    c.translate(x, y);
    switch (tier) {
      case 0: circ(c, 0, 0, s * 0.55, "#77736b"); circ(c, -s * 0.15, -s * 0.15, s * 0.18, "#5f5b54"); break;
      case 1:
        c.fillStyle = "#8b5a2b"; c.fillRect(-s * 0.1, -s * 0.9, s * 0.2, s * 1.8);
        c.fillStyle = "#77736b";
        c.beginPath(); c.moveTo(0, -s * 0.9); c.quadraticCurveTo(s * 0.9, -s * 0.8, s * 0.7, -s * 0.1); c.lineTo(0, -s * 0.3); c.fill();
        break;
      case 2:
        c.strokeStyle = "#8b5a2b"; c.lineWidth = s * 0.18;
        c.beginPath(); c.arc(-s * 0.3, 0, s * 0.9, -1.2, 1.2); c.stroke();
        c.strokeStyle = "#fff"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-s * 0.3 + Math.cos(-1.2) * s * 0.9, Math.sin(-1.2) * s * 0.9);
        c.lineTo(-s * 0.3 + Math.cos(1.2) * s * 0.9, Math.sin(1.2) * s * 0.9); c.stroke();
        break;
      case 3: case 4: {
        const one = (ox) => {
          c.fillStyle = "#2a2c2e"; rrect(c, ox - s * 0.25, -s * 0.9, s * 0.5, s * 1.3, s * 0.15); c.fill();
          c.fillStyle = "#45484b"; c.fillRect(ox - s * 0.25, -s * 1.05, s * 0.5, s * 0.25);
          c.fillStyle = "#3b2f22"; c.fillRect(ox - s * 0.2, s * 0.2, s * 0.4, s * 0.6);
        };
        if (tier === 3) one(0); else { one(-s * 0.35); one(s * 0.35); }
        break;
      }
      case 5:
        circ(c, -s * 0.5, s * 0.5, s * 0.35, "#6c584c"); circ(c, s * 0.5, s * 0.5, s * 0.35, "#6c584c");
        c.fillStyle = "#343a40"; rrect(c, -s * 0.35, -s, s * 0.7, s * 1.5, s * 0.3); c.fill();
        break;
      case 6:
        c.fillStyle = "#2a2c2e";
        for (let i = -1; i <= 1; i++) c.fillRect(i * s * 0.3 - s * 0.1, -s, s * 0.2, s * 1.4);
        c.fillStyle = "#3c3f39"; rrect(c, -s * 0.55, s * 0.1, s * 1.1, s * 0.6, s * 0.2); c.fill();
        break;
      case 7:
        c.fillStyle = "#3d405b"; c.fillRect(-s * 0.8, -s * 0.6, s * 0.3, s * 1.3); c.fillRect(s * 0.5, -s * 0.6, s * 0.3, s * 1.3);
        c.fillStyle = "#5a6b3a"; rrect(c, -s * 0.55, -s * 0.5, s * 1.1, s * 1.1, s * 0.2); c.fill();
        c.fillStyle = "#4b5a2c"; c.fillRect(-s * 0.1, -s * 1.1, s * 0.2, s * 0.8);
        circ(c, 0, 0, s * 0.35, "#4b5a2c");
        break;
      case 8:
        c.fillStyle = "#5a6b3a"; rrect(c, -s * 0.25, -s * 0.7, s * 0.5, s * 1.3, s * 0.25); c.fill();
        c.fillStyle = "#3c3f39"; c.beginPath(); c.moveTo(-s * 0.25, -s * 0.55); c.lineTo(0, -s * 1.1); c.lineTo(s * 0.25, -s * 0.55); c.fill();
        c.fillStyle = "#3c3f39"; c.beginPath(); c.moveTo(-s * 0.25, s * 0.3); c.lineTo(-s * 0.55, s * 0.7); c.lineTo(-s * 0.25, s * 0.6); c.fill();
        c.beginPath(); c.moveTo(s * 0.25, s * 0.3); c.lineTo(s * 0.55, s * 0.7); c.lineTo(s * 0.25, s * 0.6); c.fill();
        break;
      case 9:
        c.fillStyle = "#7d8580"; rrect(c, -s * 0.18, -s, s * 0.36, s * 1.9, s * 0.18); c.fill();
        c.fillStyle = "#6b7560";
        c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(-s, s * 0.1); c.lineTo(-s, s * 0.3); c.lineTo(s, s * 0.3); c.lineTo(s, s * 0.1); c.fill();
        c.fillRect(-s * 0.4, s * 0.7, s * 0.8, s * 0.18);
        circ(c, 0, -s * 0.65, s * 0.12, "#90e0ef");
        break;
      case 10:
        c.fillStyle = "#1f3550"; c.fillRect(-s * 1.1, -s * 0.3, s * 0.7, s * 0.6); c.fillRect(s * 0.4, -s * 0.3, s * 0.7, s * 0.6);
        c.fillStyle = "#6e7275"; rrect(c, -s * 0.4, -s * 0.45, s * 0.8, s * 0.9, s * 0.2); c.fill();
        circ(c, 0, -s * 0.6, s * 0.2, "#ff6b6b");
        break;
      case 11:
        circ(c, 0, 0, s * 0.8, "#2b2d42");
        c.fillStyle = "#ffd93d";
        for (let i = 0; i < 3; i++) {
          const a = i * (Math.PI * 2 / 3);
          c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.6, a, a + 0.8); c.fill();
        }
        circ(c, 0, 0, s * 0.15, "#ffd93d");
        c.strokeStyle = "#e09f00"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, -s * 0.8); c.quadraticCurveTo(s * 0.3, -s * 1.2, s * 0.1, -s * 1.4); c.stroke();
        circ(c, s * 0.1, -s * 1.4, 3, "#ff9f1c");
        break;
    }
    c.restore();
  }

  // A soldier from behind holding the weapon, or the machine, for the "+ army" box.
  function unitIcon(c, tier, x, y) {
    if (WEAPONS[tier].vehicle) return weaponIcon(c, tier, x, y - 2, 20);
    c.save();
    c.translate(x, y);
    c.scale(1.3, 1.3);
    circ(c, 0, 0, 9, "#4d96ff");
    c.fillStyle = "#7b5e3b"; rrect(c, -5, -2, 10, 9, 3); c.fill();
    circ(c, 0, -8, 7, "#2a9d8f");
    c.fillStyle = "#21867a"; c.fillRect(-8, -9, 16, 3);
    weaponIcon(c, tier, 10, -6, 9);
    c.restore();
  }

  // Breaks between words, or between any two characters for Chinese (no spaces).
  function wrapText(c, text, x, y, maxW) {
    const sep = text.includes(" ") ? " " : "";
    let line = "";
    (sep ? text.split(" ") : Array.from(text)).forEach((word) => {
      const test = line ? line + sep + word : word;
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y);
        line = word;
        y += 19;
      } else {
        line = test;
      }
    });
    c.fillText(line, x, y);
  }

  function lifeBar2d(c, x, y, w, ratio) {
    c.fillStyle = "#2b2d42";
    rrect(c, x - w / 2 - 2, y - 2, w + 4, 10, 5); c.fill();
    c.fillStyle = ratio > 0.5 ? "#6bcb77" : ratio > 0.25 ? "#ffd93d" : "#ff6b6b";
    if (ratio > 0) { rrect(c, x - w / 2, y, w * ratio, 6, 3); c.fill(); }
  }

  const DOOR_COLORS = { weapon: "#c9a84a", army: "#8fa7ad", wall: "#b59d7a", shield: "#97a6bd" };
  const DOOR_H = 96, DOOR_DEPTH = 18, TEX = 2;

  // The picture on the front of a box: drawn on a canvas like in Army Rush, then used as a texture.
  function drawDoorFace(v, d) {
    const left = Math.max(0, d.hp);
    const key = (d.broken ? "open" : "") + fmt(left);
    if (key === v.drawn) return;
    if (v.drawn && !d.broken && time - v.drawAt < 0.08) return;
    v.drawn = key;
    v.drawAt = time;
    const c = v.ctx, fw = v.fw, w = fw - 12, h = DOOR_H - 12, x = 6, y = 6;
    c.setTransform(TEX, 0, 0, TEX, 0, 0);
    c.clearRect(0, 0, fw, DOOR_H);
    const ratio = left / d.maxHp;
    if (d.kind === "barrier") {
      c.fillStyle = "#8d99ae"; c.fillRect(0, 0, fw, DOOR_H);
      c.strokeStyle = "#5c677d"; c.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const by = row * (DOOR_H / 4);
        c.beginPath(); c.moveTo(0, by); c.lineTo(fw, by); c.stroke();
        for (let bx = row % 2 ? 20 : 0; bx < fw; bx += 40) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + DOOR_H / 4); c.stroke(); }
      }
      lifeBar2d(c, fw / 2 - 18, DOOR_H - 18, fw - 60, ratio);
      c.font = "bold 16px sans-serif"; c.textAlign = "right"; c.fillStyle = "#fff";
      c.fillText(fmt(left), fw - 6, DOOR_H - 8);
      v.tex.needsUpdate = true;
      return;
    }
    c.fillStyle = "#3a3d40"; c.fillRect(0, 0, fw, DOOR_H);
    c.fillStyle = DOOR_COLORS[d.kind];
    rrect(c, x, y, w, h, 8); c.fill();
    circ(c, x + w - 12, y + h / 2 - 6, 4, "#3a3d40");
    c.fillStyle = "#2b2d42";
    if (d.broken) {
      c.font = "bold 26px " + FONT; c.textAlign = "center";
      c.fillText(t("OPEN!"), fw / 2, DOOR_H / 2 + 9);
      v.tex.needsUpdate = true;
      return;
    }
    c.font = "bold 20px " + FONT; c.textAlign = "left";
    if (d.kind === "weapon") {
      weaponIcon(c, d.tier, x + 34, y + 34, 20);
      wrapText(c, WEAPONS[d.tier].name, x + 64, y + 30, w - 84);
    } else if (d.kind === "army") {
      unitIcon(c, g.tier, x + 32, y + 38);
      c.font = "bold 34px " + FONT;
      c.fillText("+" + d.amount, x + 62, y + 48);
    } else if (d.kind === "wall") {
      c.fillStyle = "#c1440e";
      for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) rrect(c, x + 14 + i * 18 + (r % 2) * 9 - 4, y + 18 + r * 11, 16, 9, 2), c.fill();
      c.fillStyle = "#2b2d42";
      wrapText(c, t("Bigger wall"), x + 64, y + 30, w - 84);
    } else {
      c.fillStyle = "#4d96ff";
      c.beginPath(); c.moveTo(x + 32, y + 12); c.lineTo(x + 50, y + 20); c.quadraticCurveTo(x + 50, y + 48, x + 32, y + 58);
      c.quadraticCurveTo(x + 14, y + 48, x + 14, y + 20); c.closePath(); c.fill();
      c.fillStyle = "#90e0ef"; c.beginPath(); c.arc(x + 32, y + 34, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2b2d42";
      wrapText(c, t("Shield"), x + 64, y + 30, w - 84);
    }
    lifeBar2d(c, x + w / 2 - 18, y + h - 15, w - 56, ratio);
    c.font = "bold 15px sans-serif"; c.textAlign = "right"; c.fillStyle = "#2b2d42";
    c.fillText(fmt(left), x + w - 6, y + h - 6);
    v.tex.needsUpdate = true;
  }

  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  function makeDoor(d) {
    const fw = d.x1 - d.x0 + 12;
    const cv = document.createElement("canvas");
    cv.width = Math.round(fw * TEX);
    cv.height = DOOR_H * TEX;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    const front = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const side = mat(d.kind === "barrier" ? "#5c677d" : "#3a3d40").clone();
    side.transparent = true;
    const root = new THREE.Group();
    blob(root, fw * 0.55);
    const box = new THREE.Mesh(GEO.box, [side, side, side, side, front, side]);
    box.scale.set(fw, DOOR_H, DOOR_DEPTH);
    box.position.y = DOOR_H / 2;
    root.add(box);
    const v = { root, box, fw, ctx: cv.getContext("2d"), tex, mats: [front, side], drawn: "", drawAt: -1,
      dispose() { tex.dispose(); front.dispose(); side.dispose(); } };
    drawDoorFace(v, d);
    return v;
  }

  function updateDoor(d, v) {
    const p = d.pair;
    const shake = d.flash ? (Math.random() - 0.5) * 5 : 0;
    v.root.position.set(wx((d.x0 + d.x1) / 2) + shake, 0, wz(p.y + p.h) - DOOR_DEPTH / 2);
    const pop = d.flash ? 1.04 : 1;
    v.box.scale.set(v.fw * pop, DOOR_H * pop, DOOR_DEPTH);
    const a = d.fade ? Math.max(0, 1 - d.fade * 2) : 1;
    v.mats.forEach((m) => { m.opacity = a; });
    v.root.children[0].visible = a > 0.5;
    drawDoorFace(v, d);
  }

  // ---------- Effects ----------

  function makeFx(f) {
    const root = new THREE.Group();
    const v = { root, mats: [] };
    const own = (m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; v.mats.push(c); return c; };
    if (f.type === "puff") {
      v.mesh = part(root, "ball", own(mat(f.color || "#77736b")), 1);
    } else if (f.type === "flash") {
      v.mesh = part(root, "star", own(basic("#ffd93d")), 1);
      v.mesh.material.side = THREE.DoubleSide;
      v.face = true;
    } else if (f.type === "star" || f.type === "pow") {
      // Sparks and hits: small hot glows.
      v.mesh = part(root, "ball", own(basic(f.type === "pow" ? "#ffb347" : f.color)), 1);
    } else if (f.type === "boom") {
      v.parts = ["#ff9f1c", "#ffd93d", "#ffffff"].map((c) => part(root, "ball", own(basic(c)), 1));
    } else if (f.type === "confetti") {
      v.mesh = part(root, "plane", own(basic(f.color)), [10, 6, 1]);
      v.mesh.material.side = THREE.DoubleSide;
    } else if (f.type === "text") {
      v.mesh = textSprite(f.text, f.color, f.size * 1.3);
      v.mats.push(v.mesh.material);
      root.add(v.mesh);
    }
    v.dispose = () => v.mats.forEach((m) => m.dispose());
    return v;
  }

  function updateFxView(f, v) {
    const k = f.t / f.life;
    v.root.position.set(wx(f.x), f.h, wz(f.y));
    const fade = Math.max(0, 1 - k);
    v.mats.forEach((m) => { m.opacity = fade; });
    if (f.type === "puff") v.mesh.scale.setScalar(f.r * (1 + k));
    else if (f.type === "star") v.mesh.scale.setScalar(2.5);
    else if (f.type === "pow") v.mesh.scale.setScalar(3 + k * 5);
    else if (f.type === "flash") v.mesh.scale.setScalar(7 + k * 6);
    else if (f.type === "boom") {
      v.parts[0].scale.setScalar(f.r * (0.4 + k * 0.8));
      v.parts[1].scale.setScalar(f.r * (0.25 + k * 0.6));
      v.parts[2].scale.setScalar(Math.max(0.01, f.r * k * 0.4));
    } else if (f.type === "confetti") {
      v.mesh.rotation.set(f.rot + f.t * 8, f.rot + f.t * 5, 0);
      if (state === "won") v.mats[0].opacity = 1;
    }
    if (v.face) {
      v.mesh.quaternion.copy(camera.quaternion);
      v.mesh.rotateZ(f.t * 6);
    }
  }

  // ---------- The field ----------

  function stripeTexture() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 2;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#6f7a52"; ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = "#77825a"; ctx.fillRect(0, 1, 4, 1);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const FIELD_LEN = 1600;
  const stripes = stripeTexture();
  stripes.repeat.set(1, FIELD_LEN / 80);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, FIELD_LEN), new THREE.MeshLambertMaterial({ map: stripes }));
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0, 300 - FIELD_LEN / 2);
  scene.add(field);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: "#5b6146" }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.set(0, -0.5, -800);
  scene.add(meadow);

  // Stones, fence posts and pine trees all roll toward you, like the army is running up.
  const scenery = [];
  for (let i = 0; i < 10; i++) {
    const f = part(scene, "ball", i % 2 ? "#6b675e" : "#4d4a3a", [6, 3, 5], [0, 1, 0]);
    scenery.push({ mesh: f, x: wx((i * 97) % W + 10), base: i * 173, span: H + 40, off: -20 });
  }
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      part(g, "box", "#4a3f30", [5, 22, 5], [0, 11, 0]);
      part(g, "box", "#5c5f60", [1.2, 1.2, 60], [0, 16, 0]);
      part(g, "box", "#5c5f60", [1.2, 1.2, 60], [0, 8, 0]);
      const post = glue(g);
      scene.add(post);
      scenery.push({ mesh: post, x: side * (W / 2 + 18), base: i * 60, span: 720, off: -620 });
    }
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const s = 0.8 + ((i * 37) % 10) / 20;
      part(g, "cyl", "#3d3226", [5 * s, 50 * s, 5 * s], [0, 25 * s, 0]);
      part(g, "cone", i % 3 ? "#3f4d33" : "#36442c", [26 * s, 70 * s, 26 * s], [0, 75 * s, 0]);
      part(g, "cone", "#46553a", [20 * s, 50 * s, 20 * s], [0, 105 * s, 0]);
      const tree = glue(g);
      scene.add(tree);
      scenery.push({ mesh: tree, x: side * (W / 2 + 70 + ((i * 53) % 60)), base: i * 140 + (side > 0 ? 70 : 0), span: 980, off: -900 });
    }
  });

  // Speed lines: streaks of wind rushing past along both sides of the field.
  const SPEED_LINE = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false });
  const speedLines = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const mesh = part(scene, "box", SPEED_LINE, [2, 2, 60 + (i % 3) * 30], [side * (W / 2 + 6 + ((i * 29) % 50)), 6 + ((i * 17) % 40), 0]);
    mesh.renderOrder = 3;
    speedLines.push({ mesh, base: (i * 157) % 1100 });
  }

  // The sandbag wall: it gets cracks as it gets hurt, and only rubble is left once it breaks.
  // Each look of the wall is built once and glued into one mesh.
  const wall = { group: new THREE.Group(), looks: {}, look: "" };
  wall.group.position.z = wz(WALL_Y);
  scene.add(wall.group);
  ["ok", "hurt", "bad"].forEach((look) => {
    const g = new THREE.Group();
    for (let x = 0, i = 0; x < W + 10; x += 34, i++) {
      part(g, "sphere", "#8c7b5a", [19, 8, 11], [wx(x + 4), 8, 0]);
      const high = part(g, "sphere", "#9a8865", [19, 8, 11], [wx(x + 21), 21, 0]);
      if (look !== "ok" && i % 3 === 0) { high.material = mat("#6f6249"); high.rotation.z = 0.3; }
      if (look === "bad" && i % 2) { high.position.y = 6; high.position.z = -10; high.rotation.z = -0.4; }
    }
    wall.looks[look] = glue(g);
  });
  const rubble = new THREE.Group();
  for (let x = 0; x < W + 10; x += 34) {
    part(rubble, "ball", "#8c7b5a", 7, [wx(x + 6), 3, 4]);
    part(rubble, "ball", "#6f6249", 5, [wx(x + 20), 2, -3]);
  }
  wall.looks.gone = glue(rubble);
  Object.values(wall.looks).forEach((m) => wall.group.add(m));
  wall.bar = makeBar(W - 160, 8);
  wall.bar.group.position.set(0, 44, 0);
  wall.group.add(wall.bar.group);

  function updateWall() {
    const health = g.wall / g.wallMax;
    const look = g.wall <= 0 ? "gone" : health < 0.35 ? "bad" : health < 0.7 ? "hurt" : "ok";
    if (look !== wall.look) {
      wall.look = look;
      Object.keys(wall.looks).forEach((k) => { wall.looks[k].visible = k === look; });
    }
    wall.bar.group.visible = g.wall > 0;
    wall.bar.set(health, health);
    wall.bar.group.quaternion.copy(camera.quaternion);
  }

  // Towers from your city (see ../army/city.js), standing on the wall with a flag on top.
  const towers = [0, 1, 2, 3].map(() => {
    const t = new THREE.Group();
    part(t, "cyl", "#adb5bd", [14, 56, 14], [0, 28, 0]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      part(t, "box", "#adb5bd", [6, 8, 6], [Math.cos(a) * 12, 59, Math.sin(a) * 12]);
    }
    part(t, "box", "#2b2d42", [6, 12, 2], [0, 36, 14]);
    part(t, "cyl", "#6c757d", [1, 18, 1], [0, 66, 0]);
    part(t, "box", "#3f5a2c", [11, 7, 1], [6, 71, 0]);
    t.bar = makeBar(34, 6);
    t.bar.group.position.set(0, 92, 0);
    t.add(t.bar.group);
    t.visible = false;
    scene.add(t);
    return t;
  });

  // Each tower has its own life bar: the enemy goes for the towers first.
  function updateTowers() {
    towers.forEach((m) => { m.visible = false; });
    city.towerSpots().forEach((s) => {
      const m = towers[s.slot];
      m.visible = true;
      m.position.set(wx(s.x), 0, wz(s.y) - 8);
      m.bar.set(s.hp / s.max, s.hp / s.max);
      m.bar.group.quaternion.copy(camera.quaternion);
    });
  }

  const shieldMat = new THREE.MeshBasicMaterial({ color: "#90e0ef", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const shieldMesh = new THREE.Mesh(GEO.shield, shieldMat);
  shieldMesh.scale.set(W + 40, 70, 34);
  shieldMesh.renderOrder = 6;
  scene.add(shieldMesh);
  const shieldRim = new THREE.Mesh(GEO.shield, new THREE.MeshBasicMaterial({ color: "#4d96ff", wireframe: true, transparent: true, opacity: 0.5 }));
  shieldMesh.add(shieldRim);

  function updateShield() {
    shieldMesh.visible = g.shield > 0 && !(g.shield < 2 && Math.floor(time * 8) % 2);
    shieldMesh.position.z = wz((g.wall > 0 ? WALL_Y : SQUAD_Y) - 4);
  }

  // ---------- Keeping the 3D world in step with the battle ----------

  const live = {};
  function syncList(key, list, make, update) {
    const seen = new Set();
    list.forEach((o) => {
      if (!o.view) o.view = make(o);
      if (!o.view.root.parent) scene.add(o.view.root);
      seen.add(o.view);
      update(o, o.view);
    });
    (live[key] || []).forEach((v) => {
      if (seen.has(v)) return;
      scene.remove(v.root);
      if (v.dispose) v.dispose();
    });
    live[key] = Array.from(seen);
  }

  function allDoors() {
    const out = [];
    g.doors.forEach((p) => p.list.forEach((d) => { d.pair = p; out.push(d); }));
    return out;
  }

  // ---------- Camera: behind your army, looking down the field ----------

  // The camera sits behind your army and tilts down the field. It is placed as low as it can be
  // while your whole army line fits across the screen and the far end of the field reaches the top.
  const CAM = { y: 245, z: 175, pitch: 0.5 };
  const tmp = new THREE.Vector3();

  function project(x, h, y) {
    return tmp.set(wx(x), h, wz(y)).project(camera);
  }

  function aim(lean) {
    camera.position.set(lean, CAM.y, CAM.z);
    camera.rotation.set(-CAM.pitch, 0, 0);
    camera.updateMatrixWorld();
  }

  // Smallest zoom that still shows the whole width of the field where your army stands.
  function fitWidth() {
    let lo = 15, hi = 120;
    for (let i = 0; i < 16; i++) {
      camera.fov = (lo + hi) / 2;
      camera.updateProjectionMatrix();
      if (project(-26, 0, SQUAD_Y + 14).x > -1 && project(W + 26, 0, SQUAD_Y + 14).x < 1) hi = camera.fov; else lo = camera.fov;
    }
    camera.fov = hi;
    camera.updateProjectionMatrix();
  }

  function fitCamera() {
    // On a wide screen the camera is placed as for a square view, and the extra width just shows
    // more of the country beside the field. On a tall screen your army stands higher, above the
    // ⬅️ ➡️ buttons, which also moves the far end of the field up.
    const aspect = camera.aspect;
    const tall = aspect < 1;
    const farTop = tall ? 0.3 : 0.44;
    const armyBottom = tall ? Math.max(-0.8, -1 + 280 / stage.clientHeight) : -0.8;
    camera.aspect = Math.min(aspect, 1);
    let best = null;
    for (let y = 300; y <= 900 && !best; y += 10) {
      CAM.y = y;
      CAM.z = 60 + y * 0.3;
      // Tilt until your army sits just above the bottom edge.
      let lo = -0.3, hi = 1.5;
      for (let i = 0; i < 16; i++) {
        CAM.pitch = (lo + hi) / 2;
        aim(0);
        fitWidth();
        if (project(W / 2, 0, SQUAD_Y + 30).y < armyBottom) lo = CAM.pitch; else hi = CAM.pitch;
      }
      CAM.pitch = hi;
      aim(0);
      fitWidth();
      if (project(W / 2, 40, -40).y > farTop) best = y;
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // A little haze only beyond the far end of the field.
    const far = camera.position.distanceTo(tmp.set(0, 0, wz(-60)));
    scene.fog.near = far;
    scene.fog.far = far * 2.2;
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fitCamera();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(() => { if (!canvas.hidden) resize(); }).observe(stage);
  else window.addEventListener("resize", () => { if (!canvas.hidden) resize(); });


  function render() {
    const lean = (g.squadX - W / 2) * 0.06;
    const sh = g.shake > 0 ? g.shake * 14 : 0;
    aim(lean + (Math.random() - 0.5) * sh + Math.sin(time * 7) * 1.5);
    // Running bounce, and a tiny kick back every time your army fires.
    camera.position.y += (Math.random() - 0.5) * sh + Math.abs(Math.sin(time * 7)) * 2.5;
    camera.position.z += g.kick > 0 ? 2 : 0;

    stripes.offset.y = (time * SCROLL) / 80;
    scenery.forEach((s) => {
      const y = ((s.base + time * SCROLL) % s.span) + s.off;
      s.mesh.position.set(s.x, s.mesh.position.y, wz(y));
    });
    speedLines.forEach((l) => {
      const y = ((l.base + time * SCROLL * 2.6) % 1100) - 420;
      l.mesh.position.z = wz(y);
    });

    updateWall();
    updateTowers();
    updateShield();
    updateSquad();
    syncList("doors", allDoors(), makeDoor, updateDoor);
    syncList("enemies", g.enemies, makeEnemy, updateEnemy);
    syncList("tumblers", g.tumblers, makeEnemy, updateTumbler);
    syncList("bullets", g.bullets, makeBullet, updateBullet);
    syncList("shots", g.shots, makeShot, updateShot);
    syncList("fx", g.fx, makeFx, updateFxView);
    renderer.render(scene, camera);
  }


  // If the phone struggles, draw fewer pixels.
  let slow = 0;
  function watchSpeed(ms) {
    if (pixelRatio <= 1) return;
    slow = ms > 26 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 90) {
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
    }
  }

  // Leaving this view: everything it made for the battle goes, and comes back made again next time.
  function forget() {
    Object.keys(live).forEach((key) => {
      live[key].forEach((v) => {
        scene.remove(v.root);
        if (v.dispose) v.dispose();
      });
      live[key] = [];
    });
    [g.enemies, g.tumblers, g.bullets, g.shots, g.fx].forEach((list) => list.forEach((o) => { delete o.view; }));
    g.doors.forEach((p) => p.list.forEach((d) => { delete d.view; }));
  }

  return {
    show() { canvas.hidden = false; resize(); },
    hide() {
      canvas.hidden = true;
      g = core.g;
      forget();
    },
    render(dt, ms) {
      g = core.g;
      time = core.time;
      state = core.state;
      watchSpeed(ms);
      render();
    },
    // Where your finger is, on the line where your army stands.
    fieldX(e) {
      const rect = stage.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const a = project(0, 0, SQUAD_Y).x;
      const b = project(W, 0, SQUAD_Y).x;
      return ((sx - a) / (b - a)) * W;
    },
    debug: { project, renderer, scene, CAM, camera, fitCamera, get pixelRatio() { return pixelRatio; } },
  };
};

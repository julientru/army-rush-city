// Army Rush FPS: the battle seen through your own eyes from behind the wall, drawn with Three.js.
// You stand in the middle of your army and it shoots wherever your cross-hair points. Turn left
// and right to see the rest of your army beside you. The battle itself is in army.js; this only
// draws it. ArmyViews.fps(core) is called the first time the FPS view is picked (see `core` in
// army.js), and returns null when the device can't show 3D.
window.ArmyViews = window.ArmyViews || {};
window.ArmyViews.fps = function (core) {
  const { W, H, WALL_Y, SQUAD_Y, WEAPONS, ENEMIES, PARTY, FONT, stage, el, input, city, squadSpots, shotHeight, fmt, t } = core;
  let g = core.g, time = core.time, state = core.state; // the battle, read again each time it draws

  const canvas = document.createElement("canvas");
  canvas.className = "view view-fps";
  canvas.hidden = true;
  stage.prepend(canvas);


  // ======================================================================
  // 3D drawing. Field x -> world X (centred), field y -> world Z (you are at +Z),
  // height -> world Y. One field unit is one world unit, except behind the wall,
  // which is squeezed so your army stands right behind the sandbags.
  // ======================================================================

  const BACK = 0.4;
  const SPREAD = 2.2; // your soldiers stand further apart in the picture, so they don't block your view
  const sx = (x) => W / 2 + (x - W / 2) * SPREAD;
  const wx = (x) => x - W / 2;
  const wz = (y) => (y <= WALL_Y ? y : WALL_Y + (y - WALL_Y) * BACK) - H;
  const fieldY = (z) => z + H;

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
  const camera = new THREE.PerspectiveCamera(85, 0.75, 1, 3000);
  scene.add(camera); // so your weapon, which hangs on the camera, is drawn

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
    v.root.position.set(wx(e.x), 0, wz(e.y) - e.flash * 20); // knocked back a little by each hit
    v.body.position.y = e.atWall ? Math.abs(Math.sin(e.bash * 6)) * r * 0.05 : 0;
    units.animate(v, { time, seed: e.seed, march: true, flash: e.flash, recoil: e.throwT > 0 ? e.throwT / 0.3 : 0 });
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

  // What a soldier holds. Each faces away from you (toward -Z).
  function makeHeld(tier) {
    const h = new THREE.Group();
    const pistol = (x) => {
      part(h, "box", "#2a2c2e", [4.5, 5, 12], [x, 0, -3]);
      part(h, "box", "#3a3c3e", [4.6, 5.1, 3], [x, 0, -10]);
      part(h, "box", "#3b2f22", [3.5, 7, 3.5], [x, -4, 1]);
    };
    switch (tier) {
      case 0: part(h, "ball", "#77736b", 5, [0, 0, 0]); break;
      case 1:
        part(h, "cyl", "#8b5a2b", [1.2, 20, 1.2], [0, 4, 0]);
        part(h, "box", "#77736b", [9, 8, 1.6], [4.5, 11, 0]);
        break;
      case 2: {
        const bow = new THREE.Group();
        const arc = part(bow, "arc", "#8b5a2b", 10, [0, 0, 0]);
        arc.rotation.set(0, Math.PI / 2, -Math.PI / 2);
        part(bow, "cyl", "#d8d2c4", [0.4, 20, 0.4], [0, 0, 0]);
        h.add(bow);
        h.position.y += 3;
        break;
      }
      case 3: pistol(0); break;
      case 4: pistol(-3.5); pistol(3.5); break;
      case 6:
        for (let i = 0; i < 3; i++) {
          const t = part(h, "cyl", "#2a2c2e", [1.4, 18, 1.4], [Math.cos(i * 2.1) * 2.6, Math.sin(i * 2.1) * 2.6, -8]);
          t.rotation.x = Math.PI / 2;
        }
        part(h, "box", "#3c3f39", [12, 8, 9], [0, -1, 3]);
        break;
      case 8: {
        h.position.set(-2, 14, 0);
        const tube = part(h, "cyl", "#5a6b3a", [3.6, 18, 3.6], [0, 0, -2]);
        tube.rotation.x = Math.PI / 2;
        const nose = part(h, "cone", "#3c3f39", [3.6, 6, 3.6], [0, 0, -14]);
        nose.rotation.x = -Math.PI / 2;
        part(h, "box", "#3c3f39", [11, 1.2, 4], [0, 0, 6]);
        break;
      }
    }
    return h;
  }

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
      // You are the camera, so unit 0 is only your weapon in your hands.
      for (let i = 0; i < g.count; i++) {
        const u = i === 0 ? new THREE.Group() : makeUnit(g.tier, false);
        squad.units.push(u);
        squad.group.add(u);
      }
      setViewModel(g.tier);
    }
    const vehicle = WEAPONS[g.tier].vehicle;
    squadSpots().forEach((s) => {
      if (s.i === 0) return;
      const u = squad.units[s.i];
      u.position.set(wx(sx(s.x)), DECK.h, Math.max(wz(s.y), DECK.front + 10) + (g.kick > 0 ? 2 : 0));
      // Turned toward the cross-hair, like you.
      u.rotation.y = Math.atan2(-(g.target.x - s.x), -(g.target.y - s.y)) * 0.8;
      const body = u.userData.body;
      if (!vehicle) units.animate(u.userData.v, { time, seed: s.i, march: true, flash: 0, recoil: g.kick > 0 ? 1 : 0 });
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
    if (TRAILS[b.kind]) {
      const trail = root.userData.trail = part(root, "box", TRAIL_MAT[TRAILS[b.kind]], [b.kind === "pellet" ? 2.2 : 3, b.kind === "pellet" ? 2.2 : 3, 46], [0, 0, 30]);
      trail.renderOrder = 4;
    }
    root.userData.spin = m;
    root.rotation.y = Math.atan2(-b.vx, -b.vy);
    // Shots start at the gun and fly up or down to the height under your cross-hair.
    b.h0 = b.you ? CAM.h - 10 : DECK.h + 20;
    b.h1 = Math.max(shotHeight(b.kind) * 0.5, g.targetH);
    b.reach = Math.max(60, Math.hypot(g.target.x - b.x, g.target.y - b.y));
    b.x0 = b.x; b.y0 = b.y;
    return { root };
  }
  const TRAILS = { stone: "white", axe: "white", arrow: "white", dart: "gold", pellet: "gold", ball: "smoke", shell: "smoke", missile: "smoke", bomb: "smoke" };
  const TRAIL_MAT = {
    white: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false }),
    gold: new THREE.MeshBasicMaterial({ color: "#ffd93d", transparent: true, opacity: 0.7, depthWrite: false }),
    smoke: new THREE.MeshBasicMaterial({ color: "#dee2e6", transparent: true, opacity: 0.55, depthWrite: false }),
  };

  function updateBullet(b, v) {
    const k = Math.min(1, Math.hypot(b.x - b.x0, b.y - b.y0) / b.reach);
    // Starts from the soldier who fired it, and meets the others at the cross-hair.
    v.root.position.set(wx(b.x) + (sx(b.x0) - b.x0) * (1 - k), b.h0 + (b.h1 - b.h0) * k, wz(b.y));
    // No trail right in front of your eyes.
    // Your own shots show up once they are out of your hands; the muzzle flash covers the start.
    v.root.visible = !b.you || b.age > 0.05;
    if (v.root.userData.trail) v.root.userData.trail.visible = b.age > (b.you ? 0.16 : 0.05);
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
    const end = g.wall > 0 ? 10 : CAM.h - 6;
    const h = s.h0 * (1 - k) + end * k + Math.sin(k * Math.PI) * (tank ? 18 : 55);
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

  // Close to the wall, boxes sink half into the ground so they don't hide the enemies behind them.
  function doorSink(p) {
    return Math.max(0, Math.min(1, (p.y + p.h - (WALL_Y - 140)) / 110)) * DOOR_H * 0.5;
  }

  function updateDoor(d, v) {
    const p = d.pair;
    const shake = d.flash ? (Math.random() - 0.5) * 5 : 0;
    v.root.position.set(wx((d.x0 + d.x1) / 2) + shake, -doorSink(p), wz(p.y + p.h) - DOOR_DEPTH / 2);
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

  // Grey clouds far away, so a tall view has something in the sky.
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const s = 1 + (i % 3) * 0.4;
    [[0, 0, 40], [38, -6, 30], [-36, -8, 28], [14, 18, 26]].forEach(([x, y, r]) => part(cloud, "sphere", basic("#b9bfc4"), [r * s, r * s * 0.7, r * s * 0.6], [x * s, y * s, 0]));
    const a = -1.5 + (i / 8) * 3 + Math.sin(i * 7) * 0.12;
    cloud.position.set(Math.sin(a) * 1300, 260 + ((i * 53) % 5) * 70, -Math.cos(a) * 1300 - 200);
    cloud.lookAt(0, cloud.position.y, 0);
    scene.add(cloud);
  }

  // Stones, fence posts with wire and pine trees, spread along the field.
  const scenery = [];
  for (let i = 0; i < 10; i++) {
    const f = part(scene, "ball", i % 2 ? "#6b675e" : "#4d4a3a", [6, 3, 5], [0, 1, 0]);
    scenery.push({ mesh: f, x: wx((i * 97) % W + 10), base: i * 173, span: H + 40, off: -20 });
  }
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 12; i++) {
      const post = new THREE.Group();
      part(post, "box", "#4a3f30", [5, 22, 5], [0, 11, 0]);
      part(post, "box", "#5c5f60", [1.2, 1.2, 60], [0, 16, 0]);
      part(post, "box", "#5c5f60", [1.2, 1.2, 60], [0, 8, 0]);
      scene.add(post);
      scenery.push({ mesh: post, x: side * (W / 2 + 18), base: i * 60, span: 720, off: -620 });
    }
    for (let i = 0; i < 7; i++) {
      const tree = new THREE.Group();
      const s = 0.8 + ((i * 37) % 10) / 20;
      part(tree, "cyl", "#3d3226", [5 * s, 50 * s, 5 * s], [0, 25 * s, 0]);
      part(tree, "cone", i % 3 ? "#3f4d33" : "#36442c", [26 * s, 70 * s, 26 * s], [0, 75 * s, 0]);
      part(tree, "cone", "#46553a", [20 * s, 50 * s, 20 * s], [0, 105 * s, 0]);
      scene.add(tree);
      scenery.push({ mesh: tree, x: side * (W / 2 + 70 + ((i * 53) % 60)), base: i * 140 + (side > 0 ? 70 : 0), span: 980, off: -900 });
    }
  });

  scenery.forEach((s) => {
    s.mesh.position.set(s.x, s.mesh.position.y, wz((s.base % s.span) + s.off));
  });

  // The sandbag wall: it gets cracks as it gets hurt, and only rubble is left once it breaks.
  const wall = { group: new THREE.Group(), bags: [], rubble: new THREE.Group(), look: "" };
  wall.group.position.z = wz(WALL_Y);
  scene.add(wall.group);
  for (let x = 0, i = 0; x < W + 10; x += 34, i++) {
    const low = part(wall.group, "sphere", "#8c7b5a", [19, 8, 11], [wx(x + 4), 8, 0]);
    const high = part(wall.group, "sphere", "#8c7b5a", [19, 8, 11], [wx(x + 21), 21, 0]);
    wall.bags.push(low, high);
    high.userData.i = i;
    high.userData.base = high.position.clone();
  }
  for (let x = 0; x < W + 10; x += 34) {
    part(wall.rubble, "ball", "#8c7b5a", 7, [wx(x + 6), 3, 4]);
    part(wall.rubble, "ball", "#6f6249", 5, [wx(x + 20), 2, -3]);
  }
  wall.group.add(wall.rubble);
  wall.bar = makeBar(W - 160, 8);
  wall.bar.group.position.set(0, 44, 0);
  wall.group.add(wall.bar.group);

  function updateWall() {
    const health = g.wall / g.wallMax;
    const look = g.wall <= 0 ? "gone" : health < 0.35 ? "bad" : health < 0.7 ? "hurt" : "ok";
    if (look !== wall.look) {
      wall.look = look;
      wall.bags.forEach((b) => { b.visible = look !== "gone"; b.material = mat("#8c7b5a"); b.rotation.z = 0; });
      wall.rubble.visible = look === "gone";
      wall.bags.forEach((b) => {
        const i = b.userData.i;
        if (i === undefined) return;
        b.position.copy(b.userData.base);
        if ((look === "hurt" || look === "bad") && i % 3 === 0) { b.material = mat("#6f6249"); b.rotation.z = 0.3; }
        if (look === "bad" && i % 2) { b.position.y = 6; b.position.z = -10; b.rotation.z = -0.4; }
      });
    }
    wall.bar.group.visible = false;
    el.wallFill.style.width = Math.max(0, health * 100) + "%";
    el.wallGauge.classList.toggle("gone", g.wall <= 0);
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
    t.scale.setScalar(0.7); // smaller, so they do not hide the field
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
  shieldMesh.scale.set(W + 60, 150, 26);
  shieldMesh.renderOrder = 6;
  scene.add(shieldMesh);
  const shieldRim = new THREE.Mesh(GEO.shield, new THREE.MeshBasicMaterial({ color: "#4d96ff", wireframe: true, transparent: true, opacity: 0.5 }));
  shieldMesh.add(shieldRim);

  function updateShield() {
    shieldMesh.visible = g.shield > 0 && !(g.shield < 2 && Math.floor(time * 8) % 2);
    shieldMesh.position.z = wz(WALL_Y - 30);
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

  // ---------- Your lookout: a wooden deck behind the wall ----------

  // When the camera has to sit higher than a soldier's eyes to keep the wall at the bottom of the
  // view, your army stands on a deck so the soldiers next to you are at your height.
  const EYE = 44;
  const DECK = { h: 0, front: 0, group: new THREE.Group() };
  scene.add(DECK.group);
  function buildDeck() {
    DECK.group.clear();
    if (DECK.h < 2) return;
    const z0 = DECK.front, z1 = CAM.z + 40, len = z1 - z0, mid = (z0 + z1) / 2;
    part(DECK.group, "box", "#7f5539", [W + 300, DECK.h, len], [0, DECK.h / 2, mid]);
    part(DECK.group, "box", "#c8a27a", [W + 300, 2, len], [0, DECK.h + 1, mid]);
    for (let x = -W / 2 - 150; x < W / 2 + 150; x += 26) part(DECK.group, "box", "#a47148", [2, 2.4, len], [x, DECK.h + 1, mid]);
  }

  // ---------- Your own weapon, in your hands at the bottom of the view ----------

  const view = { yaw: 0, group: new THREE.Group(), gun: new THREE.Group(), tanH: 1, tanV: 1, depth: 30, base: new THREE.Vector3() };
  camera.add(view.group);
  view.group.add(view.gun);
  const MUZZLE = new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const MUZZLE_CORE = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });

  function setViewModel(tier) {
    view.gun.clear();
    view.tier = tier;
    placeViewModel();
    const w = WEAPONS[tier];
    let muzzle = [0, 1, -16];
    if (!w.vehicle) {
      // Your arm in its sleeve (bare in the Stone Age), holding the same weapon as your army.
      const sleeve = tier <= 1 ? "#c08a62" : tier === 2 ? "#3f5a2c" : "#5a6b3a";
      const arm = part(view.gun, "cyl", sleeve, [3.6, 22, 3.6], [3, -6, 10]);
      arm.rotation.x = Math.PI / 2 - 0.35;
      part(view.gun, "sphere", tier <= 2 ? "#c08a62" : "#3b2f22", 3.8, [0.5, -1.5, -0.5]);
      const held = makeHeld(tier);
      held.position.set(0, tier === 1 ? -6 : 0, 0);
      view.gun.add(held);
      muzzle = { 0: [0, 0, -5], 1: [5, 7, -3], 2: [0, 0, -6], 6: [0, 0, -19], 8: [0, 0, -18] }[tier] || [0, 1, -13];
    } else if (tier === 5 || tier === 7) {
      // Sitting behind the cannon or in the tank turret.
      const tank = tier === 7;
      const barrel = part(view.gun, "cyl", tank ? "#2a2c2e" : "#343a40", tank ? [3, 34, 3] : [5.5, 26, 5.5], [0, 0, -12]);
      barrel.rotation.x = Math.PI / 2;
      part(view.gun, "cyl", tank ? "#3c3f39" : "#495057", [tank ? 3.8 : 6.6, 3, tank ? 3.8 : 6.6], [0, 0, -26]).rotation.x = Math.PI / 2;
      part(view.gun, "sphere", tank ? "#5a6b3a" : "#7f5539", tank ? 10 : 8, [0, -6, 6]);
      muzzle = [0, 0, -29];
    } else if (tier === 9) {
      // A plane on your hand, ready to throw.
      const plane = makeVehicle(9).userData.body;
      plane.position.set(0, 0, -4);
      plane.scale.setScalar(0.42);
      view.gun.add(plane);
      part(view.gun, "sphere", "#3b2f22", 4, [0, -3.5, 0]);
      muzzle = [0, 0, -14];
    } else {
      // A remote control: a laser button, or the big mega bomb plunger.
      part(view.gun, "box", tier === 10 ? "#6e7275" : "#4b5a2c", [11, 5, 14], [0, -2, 0]);
      part(view.gun, "sphere", "#ff6b6b", 2.6, [0, 1, -2]);
      if (tier === 10) {
        part(view.gun, "cyl", "#6c757d", [0.6, 12, 0.6], [4, 5, 4]);
        part(view.gun, "sphere", "#00dcff", 1.4, [4, 11, 4]);
      } else {
        part(view.gun, "cyl", "#2b2d42", [1, 8, 1], [0, 3, 3]);
        part(view.gun, "box", "#2b2d42", [9, 1.6, 1.6], [0, 7, 3]);
      }
      part(view.gun, "sphere", "#3b2f22", [7, 4, 7], [0, -5, 2]);
      muzzle = [0, 3, -6];
    }
    const flash = new THREE.Group();
    flash.position.set(muzzle[0], muzzle[1], muzzle[2]);
    part(flash, "star", MUZZLE, 6);
    part(flash, "star", MUZZLE_CORE, 3, [0, 0, 0.2]);
    flash.children.forEach((m) => { m.renderOrder = 50; });
    flash.visible = false;
    view.gun.add(flash);
    view.flash = flash;
    view.gun.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
  }

  // Places your weapon low on the right, the same size on any screen.
  function placeViewModel() {
    const d = view.depth;
    // Cannons and tank guns sit in the middle, everything else is in your right hand.
    const middle = view.tier === 5 || view.tier === 7;
    view.base.set((middle ? 0 : 0.38) * view.tanH * d, (middle ? -0.75 : -0.62) * view.tanV * d, -d);
    view.gun.scale.setScalar(0.75 * Math.min(view.tanH, view.tanV));
  }

  const aimPoint = new THREE.Vector3();
  function updateViewModel() {
    const k = g.kick > 0 ? g.kick / 0.09 : 0;
    view.gun.position.copy(view.base);
    view.gun.position.z += k * 4;
    view.gun.position.y += Math.sin(time * 3) * 0.3;
    // Point it at the cross-hair.
    aimPoint.set(input.aim.x * view.tanH * 300, input.aim.y * view.tanV * 300, -300).sub(view.base);
    view.gun.rotation.set(Math.atan2(aimPoint.y, Math.hypot(aimPoint.x, aimPoint.z)) + k * 0.25, Math.atan2(-aimPoint.x, -aimPoint.z), 0, "YXZ");
    view.flash.visible = g.flash > 0 && state === "playing";
    if (view.flash.visible) {
      view.flash.rotation.z = Math.random() * 6;
      view.flash.scale.setScalar(0.8 + Math.random() * 0.7);
    }
  }

  // ---------- Camera: your eyes, just behind the wall ----------

  // The view is 85° wide when the phone is upright and 135° wide when it is on its side (the
  // height follows from the screen's shape). The camera tilts so the top of your wall sits at the
  // bottom of the view, and goes up just high enough to see down to the far end of the field.
  const CAM = { h: EYE, z: wz(WALL_Y) + 22, pitch: 0, wide: 85, wall: -0.78, far: 0.15 };
  const WALL_TOP = 29, MAX_YAW = 1.3;
  const tmp = new THREE.Vector3();

  function project(x, h, y) {
    return tmp.set(wx(x), h, wz(y)).project(camera);
  }

  function aimCamera(yaw) {
    camera.position.set(0, CAM.h, CAM.z);
    camera.rotation.set(CAM.pitch, yaw, 0, "YXZ");
    camera.updateMatrixWorld();
  }

  // 0 for a phone held upright, 1 for a phone on its side.
  function landscape(aspect) {
    return Math.max(0, Math.min(1, (aspect - 0.8) / (1.5 - 0.8)));
  }

  function tiltToWall() {
    let lo = -1.3, hi = 1.0;
    for (let i = 0; i < 18; i++) {
      CAM.pitch = (lo + hi) / 2;
      aimCamera(0);
      if (project(W / 2, WALL_TOP, WALL_Y).y > CAM.wall) lo = CAM.pitch; else hi = CAM.pitch;
    }
    CAM.pitch = hi;
    aimCamera(0);
  }

  function fitCamera() {
    // Upright, the view is tall, so the wall takes a bit more of the bottom.
    const k = landscape(camera.aspect);
    CAM.wide = 85 + (135 - 85) * k;
    CAM.wall = -0.64 - 0.14 * k;
    CAM.far = 0.1 + 0.05 * k;
    view.tanH = Math.tan((CAM.wide / 2) * Math.PI / 180);
    view.tanV = view.tanH / camera.aspect;
    camera.fov = (2 * Math.atan(view.tanV) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    let best = EYE, bestFar = -9;
    for (let h = EYE; h <= 220; h += 4) {
      CAM.h = h;
      tiltToWall();
      const far = project(W / 2, 0, -40).y;
      if (far > bestFar) { bestFar = far; best = h; }
      if (far >= CAM.far) break;
    }
    CAM.h = best;
    tiltToWall();
    // The deck starts just behind the line from your eyes to the top of the wall.
    const deck = Math.max(0, Math.round(CAM.h - EYE));
    const front = Math.max(wz(WALL_Y) + 12, CAM.z - ((CAM.z - wz(WALL_Y)) * (CAM.h - deck)) / (CAM.h - WALL_TOP) + 4);
    if (deck !== DECK.h || front !== DECK.front) { DECK.h = deck; DECK.front = front; buildDeck(); }
    placeViewModel();
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

  // ---------- What is under the cross-hair ----------

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ball = new THREE.Sphere();
  const crate = new THREE.Box3();
  const hitP = new THREE.Vector3();

  // The spot on the field your army shoots at, its height, and whether it is an enemy or a box.
  function pickTarget() {
    ndc.set(input.aim.x, input.aim.y);
    ray.setFromCamera(ndc, camera);
    const r = ray.ray;
    let best = Infinity, out = null;
    const closer = (o) => {
      const d = hitP.distanceTo(r.origin);
      if (d < best) { best = d; out = o; }
    };
    g.enemies.forEach((e) => {
      const T = ENEMIES[e.type];
      ball.center.set(wx(e.x), T.tank ? T.r * 0.6 : T.r * 1.2, wz(e.y));
      ball.radius = T.r * 1.25;
      if (r.intersectSphere(ball, hitP)) closer({ x: e.x, y: e.y, h: ball.center.y, on: true });
    });
    g.doors.forEach((p) => p.list.forEach((d) => {
      if (d.gone || d.broken) return;
      const zf = wz(p.y + p.h);
      crate.min.set(wx(d.x0), 0, zf - DOOR_DEPTH);
      crate.max.set(wx(d.x1), DOOR_H - doorSink(p), zf);
      if (r.intersectBox(crate, hitP)) closer({ x: hitP.x + W / 2, y: p.y + p.h - 4, h: hitP.y, on: true });
    }));
    if (out) return out;
    // The grass under the cross-hair, or far down the field when you aim at the sky or the wall.
    const dx = r.direction.x, dz = r.direction.z, flat = Math.hypot(dx, dz) || 1;
    if (r.direction.y < -0.01) {
      const k = -r.origin.y / r.direction.y;
      const y = fieldY(r.origin.z + dz * k);
      if (y < WALL_Y - 40 && y > -100) return { x: r.origin.x + dx * k + W / 2, y, h: 8, on: false };
    }
    const len = dz < -0.05 * flat ? Math.min(900, (SQUAD_Y + 100) / (-dz / flat)) : 400;
    return { x: W / 2 + (dx / flat) * len, y: SQUAD_Y + (dz / flat) * len, h: 20, on: false };
  }


  function render(dt) {
    turnView(dt);
    // While waiting for you to start, the view slowly looks around at your army and the field.
    if (state !== "playing") view.yaw += (Math.sin(time * 0.35) * MAX_YAW * 0.55 - view.yaw) * Math.min(1, dt * 2);
    const sh = g.shake > 0 ? g.shake : 0;
    aimCamera(view.yaw);
    if (sh) {
      camera.rotation.x += (Math.random() - 0.5) * sh * 0.06;
      camera.rotation.y += (Math.random() - 0.5) * sh * 0.06;
      camera.position.y += (Math.random() - 0.5) * sh * 10;
    }
    camera.rotation.x += (g.kick || 0) * 0.05; // a small kick up with every shot
    camera.updateMatrixWorld();

    if (state === "playing") {
      const tg = pickTarget();
      g.target.x = tg.x;
      g.target.y = tg.y;
      g.targetH = tg.h;
      el.cross.classList.toggle("on", tg.on);
    }
    el.cross.hidden = state !== "playing";
    el.cross.classList.toggle("hit", g.hitMark > 0);
    el.cross.style.left = ((input.aim.x + 1) / 2) * 100 + "%";
    el.cross.style.top = ((1 - input.aim.y) / 2) * 100 + "%";

    updateWall();
    updateTowers();
    updateShield();
    updateSquad();
    updateViewModel();
    syncList("doors", allDoors(), makeDoor, updateDoor);
    syncList("enemies", g.enemies, makeEnemy, updateEnemy);
    syncList("tumblers", g.tumblers, makeEnemy, updateTumbler);
    syncList("bullets", g.bullets, makeBullet, updateBullet);
    syncList("shots", g.shots, makeShot, updateShot);
    syncList("fx", g.fx, makeFx, updateFxView);
    renderer.render(scene, camera);
  }

  // Turn with the buttons or keys, or by holding your finger at a side of the view.
  const EDGE = 0.82;
  function turnView(dt) {
    let turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (input.held && Math.abs(input.aim.x) > EDGE) turn += Math.sign(input.aim.x) * (Math.abs(input.aim.x) - EDGE) / (1 - EDGE);
    if (input.up || input.down) input.aim.y = Math.max(-0.9, Math.min(0.9, input.aim.y + ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * 1.2 * dt));
    view.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, view.yaw - turn * 2.4 * dt));
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

  // The cross-hair starts on the middle of the field, looking straight ahead.
  function centreAim() {
    view.yaw = 0;
    aimCamera(0);
    const p = project(W / 2, 30, 200);
    input.aim.x = 0;
    input.aim.y = Math.max(-0.6, Math.min(0.6, p.y));
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
      el.cross.hidden = true;
      g = core.g;
      forget();
    },
    render(dt, ms) {
      g = core.g;
      time = core.time;
      state = core.state;
      watchSpeed(ms);
      render(dt);
    },
    centreAim,
    // The cross-hair goes where your finger (or the mouse) is.
    aimAt(e) {
      const rect = stage.getBoundingClientRect();
      input.aim.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -0.99, 0.99);
      input.aim.y = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2, -0.95, 0.95);
    },
    debug: { project, renderer, scene, view, DECK, pickTarget, CAM, camera, fitCamera, get pixelRatio() { return pixelRatio; } },
  };
};

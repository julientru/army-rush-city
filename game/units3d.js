// Army Rush City in 3D: how the soldiers, tanks and bosses look. Both the 3D view and the FPS view
// build their units here, so the two always match. Everything faces +Z (toward you); one unit is
// one field unit, and r is the enemy's size from army.js (its hit circle).
//
// ArmyUnits3D() returns { enemy(type, T, wave), friend(tier, hero), animate(v, s), fall(v, k) }.
// A built unit is v = { root, body, top, paint, glow, legs, guns, flags }: root sits on the ground,
// body moves (bob, recoil), paint are the meshes that flash white when hit, glow the red lights.
window.ArmyUnits3D = function () {
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.ConeGeometry(1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    dome: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    wedge: (function () {
      // A box whose top slopes down toward +Z: the front armour of a tank.
      const g = new THREE.BoxGeometry(1, 1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setY(i, -0.2);
      g.computeVertexNormals();
      return g;
    })(),
    disc: new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
  };

  const mats = {};
  function mat(color, metal) {
    const key = color + (metal ? "m" : "");
    if (!mats[key]) {
      mats[key] = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.6 : 0.9, metalness: metal ? 0.2 : 0.05, flatShading: true });
    }
    return mats[key];
  }
  const GLOW = {};
  function glow(color) {
    return GLOW[color] || (GLOW[color] = new THREE.MeshBasicMaterial({ color }));
  }
  const SHADOW = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const CHAR = new THREE.MeshStandardMaterial({ color: "#1b1b1b", roughness: 1, flatShading: true });

  // A mesh with a size and a place. material: a colour, [colour, "metal"], or a material.
  function part(parent, geo, material, size, pos, rot) {
    let m3 = material;
    if (typeof material === "string") m3 = mat(material);
    else if (Array.isArray(material)) m3 = mat(material[0], true);
    const m = new THREE.Mesh(GEO[geo], m3);
    if (typeof size === "number") m.scale.setScalar(size); else m.scale.set(size[0], size[1], size[2]);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    parent.add(m);
    return m;
  }
  function shadow(parent, rx, rz) {
    const m = part(parent, "disc", SHADOW, [rx, 1, rz || rx], [0, 0.5, 0]);
    m.renderOrder = 1;
    return m;
  }

  // ---------- Colours and outfits ----------

  // The enemy's look follows the age of the wave: tribe, ancient army, medieval army, modern army.
  // They always wear dark colours with red marks; your army wears green and brown.
  const GUN = ["#2a2c2e", "metal"];
  const RED = "#ff2a14";
  const WOOD = "#5b4430", BRONZE = ["#8a6a35", "metal"], IRON = ["#6e7275", "metal"], STONE = "#77736b";
  const LOOKS = {
    // Enemy
    tribe: { cloth: "#4a3b2e", vest: "#5e4c3b", leg: "#8b5e3c", boot: "#3a2a1e", skin: "#8b5e3c", head: "hair", hair: "#1c1612", paint: "#a3191b", mark: "#a3191b" },
    ancient: { cloth: "#5a1d17", vest: BRONZE, leg: "#8b5e3c", boot: "#3a2a1e", skin: "#9a6b4a", head: "crest", helmet: BRONZE, crest: "#1b1b1b", mark: "#a3191b", shield: BRONZE },
    medieval: { cloth: "#6b6f72", vest: "#2a2426", leg: "#55595c", boot: "#1d1e1f", skin: "#9a7a62", head: "kettle", helmet: IRON, mark: "#a3191b" },
    modern: { cloth: "#5d6159", vest: "#3c3f39", leg: "#5d6159", boot: "#1d1e1f", skin: "#232425", head: "helmet", helmet: "#44473f", lens: "#0b0b0b", mark: "#a3191b", pack: true },
    // Your army
    fTribe: { cloth: "#6b5a3e", vest: "#8a7350", leg: "#c08a62", boot: "#5a4330", skin: "#c08a62", head: "hair", hair: "#5a3a22", mark: "#e9c46a" },
    fArcher: { cloth: "#3f5a2c", vest: "#6b5236", leg: "#4a3b2e", boot: "#3a2a1e", skin: "#c99a72", head: "hood", hood: "#3a5a28", mark: "#e9c46a" },
    fModern: { cloth: "#5a6b3a", vest: "#7a6a48", leg: "#5a6b3a", boot: "#3b2f22", skin: "#c99a72", head: "helmet", helmet: "#4b5a2c", lens: "#2b2b2b", mark: "#e9c46a", pack: true },
  };

  // ---------- One soldier (about 1.9 * s tall) ----------

  // L: a look from LOOKS. held: what is in the hands (rifle, grenade, sling, spear, crossbow,
  // stone, axe, bow, none).
  function soldier(parent, s, L, held, v, x, z) {
    const u = new THREE.Group();
    u.position.set(x || 0, 0, z || 0);
    parent.add(u);
    shadow(u, s * 0.55);
    const legs = [];
    [-1, 1].forEach((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * s * 0.17, s * 0.85, 0);
      u.add(hip);
      part(hip, "box", L.leg, [s * 0.22, s * 0.62, s * 0.24], [0, -s * 0.33, 0]);
      part(hip, "box", L.boot, [s * 0.26, s * 0.2, s * 0.36], [0, -s * 0.72, s * 0.05]);
      hip.userData.side = side;
      legs.push(hip);
    });
    const top = new THREE.Group();
    top.position.y = s * 0.85;
    u.add(top);
    const paint = [];
    paint.push(part(top, "box", L.cloth, [s * 0.52, s * 0.62, s * 0.3], [0, s * 0.32, 0]));
    paint.push(part(top, "box", L.vest, [s * 0.56, s * 0.4, s * 0.36], [0, s * 0.38, 0]));
    if (L.head === "hair" || L.head === "hood") {
      // Fur or leather: a ragged hem below the belt.
      for (let i = 0; i < 4; i++) part(top, "box", L.cloth, [s * 0.14, s * 0.18, s * 0.32], [-s * 0.2 + i * s * 0.135, -s * 0.02 - (i % 2) * s * 0.05, 0]);
    } else {
      part(top, "box", "#2a2420", [s * 0.54, s * 0.06, s * 0.33], [0, s * 0.14, 0]); // belt
    }
    if (L.pack) part(top, "box", L.vest, [s * 0.42, s * 0.4, s * 0.18], [0, s * 0.4, -s * 0.25]);
    // Head.
    part(top, "box", L.skin, [s * 0.3, s * 0.3, s * 0.3], [0, s * 0.8, 0]);
    if (L.lens) part(top, "box", L.lens, [s * 0.32, s * 0.08, s * 0.06], [0, s * 0.84, s * 0.15]);
    if (L.paint) part(top, "box", L.paint, [s * 0.31, s * 0.05, s * 0.02], [0, s * 0.84, s * 0.155]);
    if (L.head === "helmet") {
      paint.push(part(top, "dome", L.helmet, [s * 0.25, s * 0.22, s * 0.27], [0, s * 0.9, 0]));
      part(top, "cyl", L.helmet, [s * 0.27, s * 0.03, s * 0.29], [0, s * 0.9, 0]);
    } else if (L.head === "hair") {
      part(top, "box", L.hair, [s * 0.34, s * 0.14, s * 0.34], [0, s * 0.98, -s * 0.01]);
      part(top, "box", L.hair, [s * 0.34, s * 0.34, s * 0.1], [0, s * 0.82, -s * 0.16]);
    } else if (L.head === "crest") {
      paint.push(part(top, "box", L.helmet, [s * 0.34, s * 0.3, s * 0.34], [0, s * 0.88, 0]));
      part(top, "box", "#111", [s * 0.06, s * 0.16, s * 0.02], [-s * 0.07, s * 0.82, s * 0.17]); // eye slits
      part(top, "box", "#111", [s * 0.06, s * 0.16, s * 0.02], [s * 0.07, s * 0.82, s * 0.17]);
      part(top, "box", L.crest, [s * 0.06, s * 0.18, s * 0.46], [0, s * 1.1, -s * 0.04]);
    } else if (L.head === "kettle") {
      paint.push(part(top, "dome", L.helmet, [s * 0.22, s * 0.2, s * 0.22], [0, s * 0.92, 0]));
      part(top, "cyl", L.helmet, [s * 0.34, s * 0.03, s * 0.34], [0, s * 0.92, 0]);
      part(top, "box", "#55595c", [s * 0.32, s * 0.14, s * 0.32], [0, s * 0.68, 0]); // mail collar
    } else if (L.head === "hood") {
      part(top, "box", L.hood, [s * 0.36, s * 0.3, s * 0.34], [0, s * 0.88, -s * 0.03]);
      part(top, "cone", L.hood, [s * 0.18, s * 0.2, s * 0.18], [0, s * 0.85, -s * 0.22], [-1.8, 0, 0]);
    }
    // Arms reach forward to hold what they carry.
    const arms = new THREE.Group();
    arms.position.set(0, s * 0.55, s * 0.05);
    top.add(arms);
    const bare = L.head === "hair";
    [-1, 1].forEach((side) => {
      part(arms, "box", bare ? L.skin : L.cloth, [s * 0.14, s * 0.14, s * 0.42], [side * s * 0.27, -s * 0.05, s * 0.16], [0.35, -side * 0.3, 0]);
      if (side > 0) part(arms, "box", L.mark, [s * 0.15, s * 0.07, s * 0.15], [side * s * 0.29, 0, 0.02 * s]);
    });
    hold(arms, s, held, L);
    v.legs.push(...legs);
    v.men.push(u);
    v.paint.push(...paint);
    v.tops.push(top);
    v.arms.push(arms);
    return u;
  }

  function hold(arms, s, held, L) {
    if (held === "rifle") {
      part(arms, "box", GUN, [s * 0.07, s * 0.1, s * 0.8], [s * 0.05, -s * 0.07, s * 0.35]);
      part(arms, "box", "#3b2f22", [s * 0.08, s * 0.14, s * 0.22], [s * 0.05, -s * 0.12, s * 0.02]);
      part(arms, "box", GUN, [s * 0.06, s * 0.16, s * 0.07], [s * 0.05, -s * 0.18, s * 0.32]);
    } else if (held === "grenade") {
      part(arms, "box", GUN, [s * 0.07, s * 0.1, s * 0.6], [s * 0.05, -s * 0.07, s * 0.3]);
      part(arms, "box", "#3f4a2c", [s * 0.12, s * 0.14, s * 0.12], [-s * 0.3, s * 0.05, s * 0.32]);
    } else if (held === "sling") {
      // A sling swung over the head, a stone in its pouch.
      const sl = part(arms, "box", "#3a2a1e", [s * 0.03, s * 0.7, s * 0.03], [s * 0.3, s * 0.4, s * 0.15], [0.4, 0, 0.3]);
      part(arms, "sphere", STONE, s * 0.09, [s * 0.42, s * 0.72, s * 0.3]);
      part(arms, "box", "#4a3b2e", [s * 0.18, s * 0.08, s * 0.3], [-s * 0.32, -s * 0.12, s * 0.05]); // pouch of stones
      return sl;
    } else if (held === "spear") {
      part(arms, "cyl", WOOD, [s * 0.025, s * 1.7, s * 0.025], [s * 0.3, s * 0.35, s * 0.25], [0.25, 0, 0]);
      part(arms, "cone", IRON, [s * 0.05, s * 0.18, s * 0.05], [s * 0.3, s * 1.2, s * 0.47], [0.25, 0, 0]);
      if (L.shield) {
        part(arms, "cyl", L.shield, [s * 0.32, s * 0.05, s * 0.32], [-s * 0.3, -s * 0.05, s * 0.32], [Math.PI / 2, 0, 0]);
        part(arms, "cyl", "#a3191b", [s * 0.1, s * 0.06, s * 0.1], [-s * 0.3, -s * 0.05, s * 0.34], [Math.PI / 2, 0, 0]);
      }
    } else if (held === "crossbow") {
      part(arms, "box", WOOD, [s * 0.07, s * 0.08, s * 0.6], [s * 0.05, -s * 0.05, s * 0.32]);
      part(arms, "box", IRON, [s * 0.6, s * 0.04, s * 0.05], [s * 0.05, -s * 0.03, s * 0.58]);
    } else if (held === "stone") {
      part(arms, "sphere", STONE, s * 0.13, [s * 0.32, s * 0.12, s * 0.38]);
    } else if (held === "axe") {
      part(arms, "cyl", WOOD, [s * 0.03, s * 0.8, s * 0.03], [s * 0.3, s * 0.15, s * 0.32], [0.3, 0, 0]);
      part(arms, "box", STONE, [s * 0.22, s * 0.18, s * 0.05], [s * 0.38, s * 0.5, s * 0.43], [0.3, 0, 0]);
    } else if (held === "bow") {
      for (let i = -2; i <= 2; i++) part(arms, "box", WOOD, [s * 0.04, s * 0.22, s * 0.04], [s * 0.05, i * s * 0.2, s * 0.5 - Math.abs(i) * s * 0.06], [-i * 0.25, 0, 0]);
      part(arms, "box", "#ddd", [s * 0.01, s * 0.8, s * 0.01], [s * 0.05, 0, s * 0.36]);
      part(arms, "box", "#6b5236", [s * 0.14, s * 0.35, s * 0.14], [-s * 0.1, s * 0.4, -s * 0.3], [0.3, 0, 0]); // quiver
    }
  }

  // ---------- Tanks (length L) ----------

  function tank(parent, L, o, v, x, z) {
    const t = new THREE.Group();
    t.position.set(x || 0, 0, z || 0);
    parent.add(t);
    const w = L * 0.62;
    shadow(t, w * 0.75, L * 0.6);
    const hullC = [o.hull, "metal"], darkC = [o.dark, "metal"];
    // Tracks with road wheels.
    [-1, 1].forEach((side) => {
      part(t, "box", "#1c1d1e", [w * 0.24, L * 0.16, L * 1.0], [side * w * 0.4, L * 0.09, 0]);
      for (let i = 0; i < 5; i++) {
        part(t, "cyl", "#2c2e30", [L * 0.065, w * 0.25, L * 0.065], [side * w * 0.4, L * 0.075, -L * 0.38 + i * L * 0.19], [0, 0, Math.PI / 2]);
      }
      v.paint.push(part(t, "box", darkC, [w * 0.27, L * 0.06, L * 1.02], [side * w * 0.41, L * 0.19, 0]));
      if (o.spikes) {
        for (let i = 0; i < 4; i++) part(t, "cone", "#8a8d90", [L * 0.03, L * 0.09, L * 0.03], [side * w * 0.56, L * 0.13, -L * 0.36 + i * L * 0.24], [0, 0, -side * Math.PI / 2]);
      }
    });
    // Hull: a box with a sloped front.
    v.paint.push(part(t, "box", hullC, [w * 0.58, L * 0.13, L * 0.7], [0, L * 0.22, -L * 0.1]));
    v.paint.push(part(t, "wedge", hullC, [w * 0.58, L * 0.13, L * 0.3], [0, L * 0.22, L * 0.38]));
    part(t, "box", o.dark, [w * 0.3, L * 0.05, L * 0.12], [0, L * 0.3, -L * 0.38]); // engine deck
    if (o.mark) part(t, "box", glow(o.mark), [w * 0.6, L * 0.02, L * 0.04], [0, L * 0.25, -L * 0.12]);
    if (o.eyes) {
      [-1, 1].forEach((side) => v.glow.push(part(t, "box", glow(RED), [w * 0.1, L * 0.025, L * 0.02], [side * w * 0.16, L * 0.22, L * 0.53], [0.6, 0, side * 0.25])));
    }
    if (o.jaw) {
      for (let i = 0; i < 6; i++) part(t, "cone", "#a7a9ab", [L * 0.025, L * 0.1, L * 0.025], [-w * 0.25 + i * w * 0.1, L * 0.14, L * 0.55], [Math.PI / 2, 0, 0]);
    }
    // Turret (it turns), with one or two barrels.
    const turret = new THREE.Group();
    turret.position.set(0, L * 0.29, -L * 0.04);
    t.add(turret);
    v.paint.push(part(turret, "cyl6", hullC, [w * 0.3, L * 0.12, L * 0.28], [0, L * 0.06, 0], [0, Math.PI / 6, 0]));
    part(turret, "cyl", o.dark, [w * 0.07, L * 0.04, w * 0.07], [w * 0.1, L * 0.14, -L * 0.06]);
    part(turret, "cyl", "#111", [L * 0.004, L * 0.3, L * 0.004], [-w * 0.18, L * 0.27, -L * 0.15]); // antenna
    const gun = new THREE.Group();
    gun.position.set(0, L * 0.06, L * 0.18);
    turret.add(gun);
    const barrels = o.twin ? [-1, 1] : [0];
    barrels.forEach((b) => {
      part(gun, "cyl", GUN, [L * 0.028 * (o.fat || 1), L * 0.62, L * 0.028 * (o.fat || 1)], [b * w * 0.09, 0, L * 0.3], [Math.PI / 2, 0, 0]);
      part(gun, "cyl", GUN, [L * 0.045 * (o.fat || 1), L * 0.07, L * 0.045 * (o.fat || 1)], [b * w * 0.09, 0, L * 0.6], [Math.PI / 2, 0, 0]);
    });
    if (o.eyes) v.glow.push(part(turret, "box", glow(RED), [w * 0.22, L * 0.018, L * 0.02], [0, L * 0.1, L * 0.14]));
    v.turrets.push(turret);
    v.guns.push(gun);
    return t;
  }

  // ---------- Field gun (pulled by its crew): a bronze cannon on wood, or a steel gun ----------

  function fieldGun(parent, s, v, z, old) {
    const gun = new THREE.Group();
    gun.position.z = z;
    parent.add(gun);
    shadow(gun, s * 0.7);
    const frame = old ? WOOD : "#3c3f39";
    [-1, 1].forEach((side) => {
      part(gun, "cyl", old ? WOOD : "#2c2e30", [s * 0.32, s * 0.08, s * 0.32], [side * s * 0.45, s * 0.32, 0], [0, 0, Math.PI / 2]);
      part(gun, "box", frame, [s * 0.06, s * 0.08, s * 0.9], [side * s * 0.2, s * 0.2, -s * 0.5], [0.15, side * 0.25, 0]);
    });
    if (!old) v.paint.push(part(gun, "box", ["#44473f", "metal"], [s * 0.85, s * 0.55, s * 0.06], [0, s * 0.62, s * 0.08]));
    else v.paint.push(part(gun, "box", WOOD, [s * 0.5, s * 0.16, s * 0.7], [0, s * 0.38, -s * 0.05]));
    const barrel = new THREE.Group();
    barrel.position.set(0, s * 0.5, 0);
    gun.add(barrel);
    if (old) {
      part(barrel, "cyl", BRONZE, [s * 0.15, s * 0.95, s * 0.15], [0, 0, s * 0.35], [Math.PI / 2 - 0.12, 0, 0]);
      part(barrel, "cyl", BRONZE, [s * 0.19, s * 0.1, s * 0.19], [0, s * 0.05, s * 0.8], [Math.PI / 2 - 0.12, 0, 0]);
      part(barrel, "sphere", BRONZE, s * 0.17, [0, -s * 0.06, -s * 0.12]);
    } else {
      part(barrel, "cyl", GUN, [s * 0.09, s * 1.1, s * 0.09], [0, 0, s * 0.5], [Math.PI / 2 - 0.15, 0, 0]);
    }
    v.guns.push(barrel);
  }

  // ---------- Bosses: huge scary giants, dressed for their age ----------

  const GIANTS = {
    // Stone Age: a giant brute in furs, a bone mask with burning eyes, a huge stone club.
    brute: { armor: "#4a3b2e", skin: "#5b4636", trim: "#2a1f17", cloth: "#3a2d22", head: "mask", right: "club", left: "fist", fur: true },
    // Ancient: a bronze giant with a closed crested helmet, a double axe and a shield.
    bronze: { armor: ["#7a5c2e", "metal"], skin: "#6b4a33", trim: "#5a1d17", cloth: "#3a1512", head: "crest", right: "bigaxe", left: "shield" },
    // Middle Ages: a black knight with a horned great helm and a huge sword.
    knight: { armor: ["#26282b", "metal"], skin: "#1b1c1e", trim: "#5e1212", cloth: "#1b1c1e", head: "greathelm", right: "sword", left: "fist", cape: true, horns: true, spikes: 3 },
    // Modern: armoured giants with rotary guns.
    mech: { armor: ["#3a3d41", "metal"], skin: "#232427", trim: "#6e1a14", cloth: "#232427", head: "visor", right: "gatling", left: "fist", spikes: 2 },
    mech2: { armor: ["#26282b", "metal"], skin: "#1b1c1e", trim: "#5e1212", cloth: "#1b1c1e", head: "visor", right: "gatling", left: "gatling", cape: true, horns: true, core: true, pods: true, spikes: 3 },
  };

  function giant(parent, s, v, style) {
    const C = GIANTS[style];
    const g = new THREE.Group();
    parent.add(g);
    shadow(g, s * 0.8);
    [-1, 1].forEach((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * s * 0.25, s * 0.95, 0);
      g.add(hip);
      part(hip, "box", C.fur ? C.skin : C.cloth, [s * 0.3, s * 0.6, s * 0.32], [0, -s * 0.3, 0]);
      v.paint.push(part(hip, "box", C.armor, [s * 0.36, s * 0.34, s * 0.38], [0, -s * 0.12, s * 0.02]));
      v.paint.push(part(hip, "box", C.fur ? C.trim : C.armor, [s * 0.38, s * 0.3, s * 0.5], [0, -s * 0.8, s * 0.06]));
      part(hip, "box", C.trim, [s * 0.32, s * 0.06, s * 0.2], [0, -s * 0.48, s * 0.12]);
      hip.userData.side = side;
      v.legs.push(hip);
    });
    const top = new THREE.Group();
    top.position.y = s * 0.95;
    g.add(top);
    v.tops.push(top);
    // Chest and belly: armour, or a bare chest with a fur.
    v.paint.push(part(top, "box", C.fur ? C.skin : C.armor, [s * 0.85, s * 0.6, s * 0.55], [0, s * 0.55, 0]));
    v.paint.push(part(top, "box", C.armor, [s * 0.62, s * 0.3, s * 0.45], [0, s * 0.12, 0]));
    part(top, "box", C.trim, [s * 0.66, s * 0.06, s * 0.47], [0, s * 0.27, 0]);
    if (C.fur) {
      part(top, "box", C.armor, [s * 0.9, s * 0.2, s * 0.6], [0, s * 0.82, 0], [0, 0, 0.12]);
      for (let i = 0; i < 4; i++) part(top, "cone", "#d8d2c4", [s * 0.03, s * 0.12, s * 0.03], [-s * 0.18 + i * s * 0.12, s * 0.66, s * 0.29], [Math.PI, 0, 0]); // tooth necklace
    }
    if (C.core) v.glow.push(part(top, "cyl6", glow(RED), [s * 0.12, s * 0.06, s * 0.12], [0, s * 0.6, s * 0.28], [Math.PI / 2, 0, 0]));
    // Shoulders.
    [-1, 1].forEach((side) => {
      v.paint.push(part(top, "dome", C.fur ? C.armor : C.armor, [s * 0.3, s * 0.24, s * 0.32], [side * s * 0.52, s * 0.82, 0]));
      for (let i = 0; i < (C.spikes || 0); i++) {
        part(top, "cone", "#8f9295", [s * 0.05, s * 0.22, s * 0.05], [side * (s * 0.48 + i * s * 0.09), s * 1.02, -s * 0.05 + i * s * 0.06], [0, 0, -side * 0.35]);
      }
    });
    // Head.
    const head = new THREE.Group();
    head.position.set(0, s * 0.95, s * 0.02);
    top.add(head);
    const eye = (w, h, x, y) => v.glow.push(part(head, "box", glow(RED), [w, h, s * 0.02], [x, y, s * 0.18]));
    if (C.head === "mask") {
      part(head, "box", "#1c1612", [s * 0.4, s * 0.4, s * 0.36], [0, s * 0.14, -s * 0.04]); // wild hair
      v.paint.push(part(head, "box", "#cfc6b0", [s * 0.32, s * 0.36, s * 0.06], [0, s * 0.12, s * 0.15]));
      eye(s * 0.07, s * 0.05, -s * 0.08, s * 0.18);
      eye(s * 0.07, s * 0.05, s * 0.08, s * 0.18);
      for (let i = 0; i < 4; i++) part(head, "cone", "#e8e0cc", [s * 0.02, s * 0.07, s * 0.02], [-s * 0.08 + i * s * 0.053, s * 0.0, s * 0.19], [Math.PI, 0, 0]);
      [-1, 1].forEach((side) => part(head, "cone", "#e8e0cc", [s * 0.05, s * 0.32, s * 0.05], [side * s * 0.2, s * 0.38, 0], [0.2, 0, -side * 0.6]));
    } else {
      v.paint.push(part(head, "box", C.armor, [s * 0.34, s * 0.36, s * 0.36], [0, s * 0.12, 0]));
      if (C.head === "crest") {
        part(head, "box", "#5a1d17", [s * 0.07, s * 0.12, s * 0.5], [0, s * 0.35, -s * 0.03]);
        eye(s * 0.07, s * 0.04, -s * 0.07, s * 0.17);
        eye(s * 0.07, s * 0.04, s * 0.07, s * 0.17);
      } else if (C.head === "greathelm") {
        part(head, "box", C.armor, [s * 0.36, s * 0.08, s * 0.38], [0, s * 0.31, 0]);
        eye(s * 0.26, s * 0.035, 0, s * 0.17);
        for (let i = 0; i < 3; i++) part(head, "box", "#111", [s * 0.02, s * 0.03, s * 0.02], [-s * 0.06 + i * s * 0.06, s * 0.05, s * 0.18]);
      } else {
        part(head, "box", C.armor, [s * 0.36, s * 0.08, s * 0.38], [0, s * 0.31, 0]);
        eye(s * 0.26, s * 0.045, 0, s * 0.16);
        eye(s * 0.04, s * 0.12, 0, s * 0.09);
      }
      if (C.horns) [-1, 1].forEach((side) => part(head, "cone", "#d8d2c4", [s * 0.06, s * 0.36, s * 0.06], [side * s * 0.22, s * 0.38, 0], [0, 0, -side * 0.7]));
    }
    // Arms and what they hold.
    const arms = new THREE.Group();
    arms.position.set(0, s * 0.62, 0);
    top.add(arms);
    v.arms.push(arms);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * s * 0.6, 0, 0);
      arms.add(arm);
      part(arm, "box", C.fur ? C.skin : C.cloth, [s * 0.22, s * 0.5, s * 0.22], [0, -s * 0.15, 0]);
      v.paint.push(part(arm, "box", C.fur ? C.skin : C.armor, [s * 0.28, s * 0.32, s * 0.3], [0, -s * 0.32, s * 0.12]));
      const what = side > 0 ? C.right : C.left;
      const hand = new THREE.Group();
      hand.position.set(0, -s * 0.45, s * 0.3);
      arm.add(hand);
      if (what === "gatling") {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          part(hand, "cyl", GUN, [s * 0.04, s * 0.7, s * 0.04], [Math.cos(a) * s * 0.07, Math.sin(a) * s * 0.07, s * 0.3], [Math.PI / 2, 0, 0]);
        }
        part(hand, "cyl", GUN, [s * 0.13, s * 0.3, s * 0.13], [0, 0, 0], [Math.PI / 2, 0, 0]);
        v.guns.push(hand);
      } else if (what === "club") {
        part(hand, "cyl", WOOD, [s * 0.06, s * 0.9, s * 0.06], [0, s * 0.35, s * 0.1], [0.3, 0, 0]);
        part(hand, "box", STONE, [s * 0.32, s * 0.3, s * 0.3], [0, s * 0.82, s * 0.25], [0.3, 0.4, 0.2]);
        v.guns.push(hand);
      } else if (what === "bigaxe") {
        part(hand, "cyl", WOOD, [s * 0.05, s * 1.3, s * 0.05], [0, s * 0.45, s * 0.1], [0.25, 0, 0]);
        [-1, 1].forEach((k) => part(hand, "box", BRONZE, [s * 0.3, s * 0.34, s * 0.04], [k * s * 0.17, s * 0.95, s * 0.25], [0.25, 0, k * 0.2]));
        v.guns.push(hand);
      } else if (what === "sword") {
        part(hand, "box", ["#9ea3a8", "metal"], [s * 0.12, s * 1.4, s * 0.03], [0, s * 0.85, s * 0.15], [0.2, 0, 0]);
        part(hand, "box", "#2a2426", [s * 0.4, s * 0.06, s * 0.08], [0, s * 0.12, 0]);
        v.guns.push(hand);
      } else if (what === "shield") {
        v.paint.push(part(hand, "cyl", C.armor, [s * 0.42, s * 0.06, s * 0.42], [0, s * 0.1, s * 0.08], [Math.PI / 2, 0, 0]));
        part(hand, "cyl", C.trim, [s * 0.16, s * 0.07, s * 0.16], [0, s * 0.1, s * 0.1], [Math.PI / 2, 0, 0]);
      } else {
        v.paint.push(part(hand, "box", C.fur ? C.skin : C.armor, [s * 0.3, s * 0.26, s * 0.3], [0, 0, -s * 0.05]));
        if (!C.fur) for (let i = 0; i < 3; i++) part(hand, "cone", "#8f9295", [s * 0.035, s * 0.12, s * 0.035], [-s * 0.08 + i * s * 0.08, 0, s * 0.12], [Math.PI / 2, 0, 0]);
      }
    });
    if (C.cape) v.flags.push(part(top, "box", "#2a0d0d", [s * 0.8, s * 1.2, s * 0.03], [0, s * 0.2, -s * 0.32], [-0.12, 0, 0]));
    if (C.pods) {
      [-1, 1].forEach((side) => {
        part(top, "box", C.armor, [s * 0.22, s * 0.3, s * 0.22], [side * s * 0.25, s * 1.0, -s * 0.28]);
        for (let i = 0; i < 2; i++) v.glow.push(part(top, "cyl", glow("#ff6a00"), [s * 0.03, s * 0.02, s * 0.03], [side * s * 0.25 + (i - 0.5) * s * 0.1, s * 1.16, -s * 0.28]));
      });
    }
    return s * 2.25;
  }

  // ---------- Building an enemy ----------

  function fresh() {
    return { root: new THREE.Group(), body: new THREE.Group(), paint: [], glow: [], legs: [], tops: [], arms: [], guns: [], turrets: [], flags: [], men: [], top: 0 };
  }

  // Which age the enemy comes from, from the wave number (0 = first wave).
  function eraOf(wave) {
    return wave < 2 ? "tribe" : wave < 4 ? "ancient" : wave < 6 ? "medieval" : "modern";
  }

  // T is the enemy's entry in ENEMIES (army.js), type its key, wave the wave it comes in.
  function enemy(type, T, wave) {
    const v = fresh();
    v.root.add(v.body);
    const r = T.r, b = v.body, era = eraOf(wave || 0), L = LOOKS[era];
    // What a foot soldier carries in each age.
    const arm = { tribe: "spear", ancient: "spear", medieval: "crossbow", modern: "rifle" }[era];
    if (type === "thrower") {
      const s = r * 1.05;
      const held = era === "modern" ? "grenade" : "sling";
      [[-0.6, -0.15], [0.6, -0.1], [0, 0.45]].forEach(([x, z]) => soldier(b, s, L, held, v, x * r, z * r));
      v.top = s * 1.95;
    } else if (type === "soldier") {
      const s = r * 1.0;
      [[-0.7, 0], [0.7, 0.05], [-0.25, -0.65], [0.3, 0.6]].forEach(([x, z]) => soldier(b, s, L, arm, v, x * r, z * r));
      v.top = s * 1.95;
    } else if (type === "cannon") {
      fieldGun(b, r * 1.0, v, r * 0.45, era !== "modern");
      [[-0.7, -0.6], [0.7, -0.55]].forEach(([x, z]) => soldier(b, r * 0.95, L, "none", v, x * r, z * r));
      v.top = r * 1.6;
    } else if (type === "tank") {
      tank(b, r * 1.25, { hull: "#596055", dark: "#3d423a" }, v, -r * 0.55, 0.1 * r);
      tank(b, r * 1.25, { hull: "#596055", dark: "#3d423a" }, v, r * 0.55, -0.15 * r);
      v.top = r * 0.75;
    } else if (type === "bigtank") {
      tank(b, r * 2.0, { hull: "#4e534f", dark: "#323633", mark: "#8e1a16", fat: 1.25 }, v);
      v.top = r * 1.0;
    } else if (type === "tankboss") {
      tank(b, r * 2.1, { hull: "#2c2f31", dark: "#1a1c1d", mark: "#a3191b", twin: true, fat: 1.4, spikes: true, eyes: true, jaw: true }, v);
      v.top = r * 1.1;
    } else if (type === "king") {
      tank(b, r * 2.2, { hull: "#1f2022", dark: "#121314", mark: "#b0140f", twin: true, fat: 1.7, spikes: true, eyes: true, jaw: true }, v);
      // Two smaller turrets on the sides of the hull.
      [-1, 1].forEach((side) => {
        const tt = new THREE.Group();
        tt.position.set(side * r * 0.55, r * 0.62, r * 0.3);
        b.add(tt);
        v.paint.push(part(tt, "cyl6", ["#1f2022", "metal"], [r * 0.16, r * 0.12, r * 0.16]));
        part(tt, "cyl", GUN, [r * 0.035, r * 0.5, r * 0.035], [0, 0, r * 0.25], [Math.PI / 2, 0, 0]);
        v.glow.push(part(tt, "box", glow(RED), [r * 0.16, r * 0.02, r * 0.02], [0, r * 0.05, r * 0.15]));
        v.turrets.push(tt);
      });
      // A war banner at the back.
      part(b, "cyl", "#111", [r * 0.015, r * 1.4, r * 0.015], [-r * 0.4, r * 1.2, -r * 0.9]);
      v.flags.push(part(b, "box", "#5e0b0b", [r * 0.5, r * 0.32, r * 0.01], [-r * 0.15, r * 1.72, -r * 0.9]));
      v.top = r * 1.95;
    } else if (type === "boss") {
      v.top = giant(b, r * 1.15, v, { tribe: "brute", ancient: "bronze", medieval: "knight", modern: "mech" }[era]);
    } else if (type === "bigboss") {
      v.top = giant(b, r * 1.15, v, era === "modern" ? "mech2" : "knight");
    }
    compact(v, type + ":" + era);
    return v;
  }

  // ---------- Your army ----------

  // tier: your weapon (army.js WEAPONS). Stones and axes: a tribe; bows: archers; then soldiers.
  function friend(tier, hero) {
    const v = fresh();
    v.root.add(v.body);
    const L = tier <= 1 ? LOOKS.fTribe : tier === 2 ? LOOKS.fArcher : LOOKS.fModern;
    const held = ["stone", "axe", "bow"][tier] || "rifle";
    soldier(v.body, hero ? 24 : 21, L, held, v, 0, 0);
    // Your army faces away from you, up the field.
    v.body.rotation.y = Math.PI;
    if (hero) {
      // The leader: a tall feather in the Stone Age, a radio antenna later.
      if (tier <= 2) part(v.tops[0], "box", "#e9c46a", [1.2, 10, 3], [0, 26, -3], [-0.3, 0, 0]);
      else {
        part(v.tops[0], "cyl", "#111", [0.4, 26, 0.4], [-6, 30, -7]);
        part(v.tops[0], "box", "#e9c46a", [3, 3, 1], [0, 22, 7]);
      }
    }
    v.top = 48;
    compact(v, "friend:" + tier + (hero ? "h" : ""));
    return v;
  }

  // ---------- Fewer meshes ----------

  // Glue the plain parts of each moving piece (a leg, a body, a turret...) into one mesh with
  // painted corners: a squad is then about twenty meshes instead of a hundred, so phones keep up.
  // The glued shapes are kept per kind of unit (key), so the next one is made at once.
  const MERGED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.12, flatShading: true });
  const glued = {};
  function glueParts(parts, group) {
    const pos = [], col = [];
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const m4 = new THREE.Matrix4();
    parts.forEach((m) => {
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
      const p = geo.attributes.position, c = m.material.color;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        col.push(c.r, c.g, c.b);
      }
      geo.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  function compact(v, key) {
    v.root.updateMatrixWorld(true);
    const list = glued[key] || (glued[key] = []);
    const plain = (m) => m.isMesh && m.material.isMeshStandardMaterial && m.material !== MERGED;
    let n = 0;
    const groups = [];
    v.body.traverse((o) => { if (!o.isMesh) groups.push(o); });
    const merged = [];
    groups.forEach((grp) => {
      const parts = grp.children.filter(plain);
      if (parts.length < 2) return;
      if (!list[n]) list[n] = glueParts(parts, grp);
      parts.forEach((m) => grp.remove(m));
      const mesh = new THREE.Mesh(list[n++], MERGED);
      grp.add(mesh);
      merged.push(mesh);
    });
    v.paint = merged.concat(v.paint.filter((m) => m.parent));
    v.paint.forEach((m) => { m.userData.mat = m.material; });
  }

  // ---------- Moving ----------

  // s = { time, seed, march (0 or 1), flash, recoil (0..1), speed }
  function animate(v, s) {
    if (v.fallen) return;
    const t = s.time * (s.speed || 1);
    v.legs.forEach((leg, i) => {
      leg.rotation.x = s.march ? Math.sin(t * 9 + s.seed + i * 1.3 + (leg.userData.side > 0 ? Math.PI : 0)) * 0.55 : 0;
    });
    v.tops.forEach((top, i) => {
      top.position.y += 0; // the hip height stays; a small sway instead
      top.rotation.z = s.march ? Math.sin(t * 4.5 + s.seed + i) * 0.04 : 0;
    });
    v.arms.forEach((a) => { a.rotation.x = -(s.recoil || 0) * 0.35; });
    v.guns.forEach((gun) => { gun.position.z += 0; });
    v.turrets.forEach((tt, i) => { tt.rotation.y = Math.sin(t * 0.6 + s.seed + i) * 0.25; });
    v.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 5 + i) * 0.15; });
    const pulse = 0.75 + Math.sin(t * 6 + s.seed) * 0.25;
    v.glow.forEach((m) => { m.material.color.setRGB(pulse, pulse * 0.15, pulse * 0.05); });
    const on = s.flash > 0;
    if (v.flashOn !== on) {
      v.flashOn = on;
      v.paint.forEach((m) => { m.material = on ? FLASH : m.userData.mat; });
    }
  }

  // Knocked out: k goes from 0 to 1. Soldiers fall back, everything goes dark and sinks away.
  function fall(v, k) {
    if (!v.fallen) {
      v.fallen = true;
      v.body.traverse((m) => { if (m.isMesh && m.material !== SHADOW) m.material = CHAR; });
    }
    v.men.forEach((u, i) => { u.rotation.x = -Math.min(1, k * 3) * 1.45; u.rotation.y = (i % 2 ? 0.4 : -0.3); });
    v.body.position.y = -Math.max(0, k - 0.5) * 40;
  }

  return { enemy, friend, animate, fall, eraOf, GEO, mat, part };
};

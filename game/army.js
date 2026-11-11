// Army Rush City: an enemy army marches down at you. Your army shoots by itself; you aim.
// Shoot boxes to get a new weapon, more of your weapon, or a stronger defence.
// A new weapon swaps your whole army for one of it, and a weapon you miss never comes back.
// The enemy breaks your wall first, then hits your life. The enemy comes as squads of soldiers,
// tanks and huge bosses, dressed for the age of each wave (see units3d.js). Knocked-out ones
// fall over, go dark and sink away in a puff of smoke: nothing gory.
//
// One battle, three ways to see it: the 2D / 3D / FPS buttons switch the whole picture at any
// time, and the battle and the city go on as they are. The rules all run here, on a flat
// 480 x 640 field (x across, y down the field toward you, h = height above the grass for the
// things that fly). Each view only draws it and turns taps into aiming: view2d.js draws it from
// above, view3d.js in 3D from behind your army, viewfps.js through your own eyes.
(function () {
  const t = I18n.t;
  const W = 480;
  const H = 640;
  const WALL_Y = H - 108;  // sandbag wall: enemies stop and bash it until it breaks
  const SQUAD_Y = H - 72;  // your army
  const STEP = 1 / 60;
  const ZOOM = 1.6;        // in FPS, shots fly this much faster, so aiming feels snappy

  // One unit of each weapon: dps = dmg * rate * (multi || 1). max = how many you can have,
  // add = how many an army box gives. Each new weapon starts as one unit.
  const WEAPONS = [
    { name: t("Stones"), emoji: "🪨", dmg: 1, rate: 2, speed: 420, kind: "stone", max: 6, add: 2 },
    { name: t("Axes"), emoji: "🪓", dmg: 3, rate: 2, speed: 430, kind: "axe", max: 6, add: 2 },
    { name: t("Bows"), emoji: "🏹", dmg: 6, rate: 2.5, speed: 620, kind: "arrow", max: 5, add: 1 },
    { name: t("Pistol"), emoji: "🔫", dmg: 14, rate: 3, speed: 650, kind: "dart", max: 5, add: 1 },
    { name: t("Two pistols"), emoji: "🔫🔫", dmg: 18, rate: 3, multi: 2, speed: 650, kind: "dart", max: 4, add: 1 },
    { name: t("Cannon"), emoji: "💣", dmg: 250, rate: 1.2, speed: 420, splash: 45, kind: "ball", max: 4, add: 1, vehicle: true },
    { name: t("Gatling"), emoji: "💥", dmg: 80, rate: 10, speed: 760, kind: "pellet", max: 3, add: 1 },
    { name: t("Tank"), emoji: "🛡️", dmg: 1400, rate: 1.5, speed: 520, splash: 55, kind: "shell", max: 3, add: 1, vehicle: true },
    { name: t("Missiles"), emoji: "🚀", dmg: 1900, rate: 1.5, multi: 2, speed: 480, splash: 60, kind: "missile", max: 3, add: 1 },
    { name: t("Planes"), emoji: "✈️", dmg: 7500, rate: 2, speed: 380, splash: 60, kind: "plane", max: 3, add: 1, vehicle: true },
    { name: t("Satellite laser"), emoji: "🛰️", dmg: 10000, rate: 4, speed: 1100, pierce: 3, kind: "laser", max: 2, add: 1, vehicle: true },
    { name: t("Mega bomb"), emoji: "☢️", dmg: 110000, rate: 1, speed: 360, splash: 130, kind: "bomb", max: 1, add: 0, vehicle: true },
  ];

  // hp is a multiple of the wave's toughness. hit = life lost when it reaches your army,
  // bash = wall damage per second while it stands at the wall, shot = what it throws at you.
  const ENEMIES = {
    thrower: { name: t("Stone thrower"), r: 20, speed: 40, hp: 1, hit: 5, bash: 3, color: "#f4a261", hat: "bandana", prop: "stone", mouth: "tongue",
      shot: { kind: "stone", every: 3.4, dmg: 1 } },
    boss: { name: t("Big Boss"), r: 40, speed: 22, hp: 7, hit: 15, bash: 8, color: "#e76f51", hat: "crown", prop: "club", mouth: "teeth",
      shot: { kind: "rock", every: 3, dmg: 3 } },
    soldier: { name: t("Soldier"), r: 21, speed: 46, hp: 1.2, hit: 6, bash: 4, color: "#c9a0dc", hat: "helmet", prop: "stick", mouth: "smile",
      shot: { kind: "cork", every: 2.8, dmg: 1 } },
    cannon: { name: t("Cannon crew"), r: 24, speed: 34, hp: 2, hit: 8, bash: 5, color: "#ffb4a2", hat: "helmet", prop: "cannon", mouth: "o",
      shot: { kind: "ball", every: 3.2, dmg: 2 } },
    bigboss: { name: t("Big Big Boss"), r: 55, speed: 17, hp: 14, hit: 20, bash: 12, color: "#ef476f", hat: "crown", prop: "club", mouth: "teeth", mustache: true,
      shot: { kind: "rock", every: 2.4, dmg: 4 } },
    tank: { name: t("Tank"), r: 32, speed: 30, hp: 3, hit: 10, bash: 8, color: "#90a955", tank: true,
      shot: { kind: "shell", every: 3.2, dmg: 3 } },
    bigtank: { name: t("Big tank"), r: 45, speed: 23, hp: 6, hit: 15, bash: 12, color: "#bc6c25", tank: true,
      shot: { kind: "shell", every: 2.6, dmg: 4 } },
    tankboss: { name: t("Tank Boss"), r: 62, speed: 15, hp: 20, hit: 30, bash: 20, color: "#6d597a", tank: true, crown: true,
      shot: { kind: "bigshell", every: 2, dmg: 6 } },
    king: { name: t("KING TANK"), r: 82, speed: 10, hp: 55, hit: 100, bash: 40, color: "#f4c430", tank: true, crown: true, mustache: true,
      shot: { kind: "bigshell", every: 1.4, dmg: 8 } },
  };

  const WAVES = [
    { name: t("Stone throwers!"), groups: [["thrower", 8]], gap: 2 },
    { name: t("Here comes Big Boss!"), groups: [["thrower", 8], ["boss", 1]], gap: 1.8 },
    { name: t("Soldiers!"), groups: [["soldier", 12]], gap: 1.5 },
    { name: t("Two Big Bosses!"), groups: [["soldier", 10], ["boss", 2]], gap: 1.5 },
    { name: t("Cannons!"), groups: [["soldier", 8], ["cannon", 7]], gap: 1.4 },
    { name: t("Big Big Boss!"), groups: [["cannon", 9], ["bigboss", 1]], gap: 1.4 },
    { name: t("Tanks!"), groups: [["soldier", 6], ["tank", 8]], gap: 1.4 },
    { name: t("Bigger tanks!"), groups: [["tank", 8], ["bigtank", 4]], gap: 1.4 },
    { name: t("Boss parade!"), groups: [["bigtank", 6], ["bigboss", 2]], gap: 1.5 },
    { name: t("Tank Boss!"), groups: [["tank", 10], ["tankboss", 1]], gap: 1.3 },
    { name: t("The whole tank army!"), groups: [["bigtank", 10], ["tankboss", 2]], gap: 1.3 },
    { name: t("THE KING TANK!"), groups: [["tank", 10], ["king", 1]], gap: 1.3 },
  ];
  // How tough each wave is (roughly the firepower a good player has by then).
  const POWER = [2, 9, 35, 100, 300, 500, 1500, 4000, 9000, 14000, 25000, 33000];

  // power = enemy toughness, boxes = chance that a door is a box (else a tough wall),
  // hurt = how hard enemies hit your wall and your life.
  const LEVELS = {
    easy: { name: t("Easy"), power: 0.5, boxes: 1, hurt: 1 },
    normal: { name: t("Normal"), power: 0.85, boxes: 2 / 3, hurt: 1.2 },
    hard: { name: t("Hard"), power: 1, boxes: 1 / 2, hurt: 1.4 },
    mega: { name: t("Mega-hard"), power: 1.05, boxes: 1 / 3, hurt: 1.6 },
  };

  const PARTY = ["#ffd93d", "#ff6b6b", "#4d96ff", "#6bcb77", "#9b5de5"];
  const FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

  const stage = document.getElementById("stage");
  const el = {
    wave: document.getElementById("wave"),
    life: document.getElementById("life"),
    weapon: document.getElementById("weapon"),
    lifeFill: document.getElementById("lifeFill"),
    wallFill: document.getElementById("wallFill"),
    wallGauge: document.getElementById("wallGauge"),
    gauges: document.querySelector(".gauges"),
    banner: document.getElementById("banner"),
    hurt: document.getElementById("hurt"),
    screen: document.getElementById("screen"),
    cross: document.getElementById("cross"),
    menu: document.getElementById("menu"),
    left: document.getElementById("left"),
    right: document.getElementById("right"),
  };
  const levelBtns = document.querySelectorAll("[data-level]");
  const viewBtns = document.querySelectorAll(".views [data-view]");

  let g;            // everything about the current battle
  let level = "easy";
  let state = "ready";
  let time = 0;     // seconds, keeps animations going on every screen
  let endedAt = -10; // a short pause after the end, so a stray tap does not restart at once
  // The view: "2d", "3d" or "fps". ?view=3d in the address (the old Army Rush 3D and FPS pages
  // send you here with it), else the one picked last time, else 2D.
  const VIEW_KEY = "army-rush-view";
  let mode = (location.search.match(/[?&]view=(2d|3d|fps)\b/) || [])[1];
  if (!mode) {
    try {
      mode = localStorage.getItem(VIEW_KEY);
    } catch (e) { /* no storage: 2D */ }
  }
  if (!ArmyViews[mode]) mode = "2d";
  // left / right move your army (2D, 3D) or turn your head (FPS), from the buttons or the keys.
  // targetX = where a finger slides your army to (2D, 3D). up / down move the cross-hair (FPS keys),
  // aim = where the cross-hair is, from -1 to 1 across and up the view, held = a finger is on it.
  const input = { left: false, right: false, up: false, down: false, targetX: null, dragging: false, aim: { x: 0, y: 0 }, held: false };

  // Two games share this code: Army Rush (games/army/), the battle alone, and Army Rush City
  // (games/armycity/, its <body> has data-city), where your own city makes your army (see city.js).
  // In 3D and FPS the city map is in 3D too (city3d.js), and you can fly over it or walk in it (explore.js).
  const FULL = document.body.hasAttribute("data-city");
  const city = ArmyCity.create({
    W, wallY: WALL_Y, weapons: WEAPONS, enemies: ENEMIES, always: FULL,
    game: () => g, state: () => state, start: () => start(), sync: () => syncStats(),
    placeButton: (btn) => document.querySelector(".hud .home").after(btn),
    map3d(canvas, world, words) {
      const map = window.ArmyCity3D(canvas, world, words);
      if (map) window.ArmyCityExplore(map, canvas, world);
      return map;
    },
    use3d: () => mode !== "2d",
  });

  // A few cards on how to play, the first time (see tutorial.js). The ❓ button shows them again.
  const tutorial = ArmyTutorial.create({
    view: mode,
    placeButton: (btn) => document.querySelector(".hud .home").after(btn),
    cityOn: () => city.on,
  });
  document.querySelector(".hud .home").after(Sound.button());

  // Pause and save: ⏸️ stops the battle, and a battle on is kept in this browser (see pause.js).
  const pause = ArmyPause.create({
    key: FULL ? "army-city-save" : "army-rush-save",
    game: () => g, state: () => state, level: () => level, levelName: (id) => LEVELS[id].name, city,
    resume(saved) {
      level = LEVELS[saved.level] ? saved.level : "easy";
      levelBtns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.level === level));
      newGame();
      city.load(saved.city);
      ArmyPause.battle(g, saved.g);
      state = "playing";
      aimReset();
      syncStats();
    },
    restart() { state = "ready"; newGame(); },
  });

  function newGame() {
    g = {
      wave: 0, spawnQueue: [], spawnIn: 0, breakIn: city.peace, banner: null,
      enemies: [], bullets: [], shots: [], doors: [], doorIn: 4, fx: [], tumblers: [],
      clock: 0, tier: 0, count: 1, missed: new Set(), life: 100, wall: 100, wallMax: 100, shield: 0,
      squadX: W / 2, fireIn: 0.3, shake: 0, hurt: 0, target: { x: W / 2, y: 0 }, targetH: 10, combo: 0, comboT: 0,
    };
    city.reset();
    startWave(0);
    syncStats();
  }

  function startWave(i) {
    g.wave = i;
    if (state === "playing") Sound.play("horn");
    const wave = WAVES[i];
    g.spawnQueue = [];
    wave.groups.forEach(([type, count]) => { for (let n = 0; n < count; n++) g.spawnQueue.push(type); });
    // With a city to look after, there is a calm moment before the first attack.
    g.calm = i === 0 && city.on;
    g.spawnIn = i === 0 ? city.firstWait : 2.5;
    g.banner = { text: city.on ? city.waveTitle(i, wave.name) : t("Wave {n}: {name}", { n: i + 1, name: wave.name }), t: 2.5 };
    // A fresh pair of doors with every wave, so there is always something to aim for.
    g.doorIn = Math.min(g.doorIn, 1);
    syncStats();
  }

  function dps() {
    const w = WEAPONS[g.tier];
    return w.dmg * w.rate * (w.multi || 1) * g.count;
  }

  function fmt(n) {
    n = Math.ceil(n);
    if (n < 1000) return String(n);
    if (n < 10000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    if (n < 1e6) return Math.round(n / 1000) + "k";
    return (n / 1e6).toFixed(1).replace(".0", "") + "M";
  }

  function syncStats() {
    el.wave.textContent = city.on ? city.round : g.wave + 1;
    el.life.textContent = Math.max(0, Math.ceil(g.life));
    el.lifeFill.style.width = Math.max(0, Math.min(100, g.life)) + "%";
    el.lifeFill.style.background = g.life > 50 ? "#6bcb77" : g.life > 25 ? "#ffd93d" : "#ff6b6b";
    const w = WEAPONS[g.tier];
    el.weapon.textContent = w.emoji + " " + w.name + (g.count > 1 ? " ×" + g.count : "");
  }

  // The next weapon you can still get: missed ones are gone for this game.
  function nextWeapon() {
    for (let t = g.tier + 1; t < WEAPONS.length; t++) if (!g.missed.has(t)) return t;
    return -1;
  }

  // ---------- Spawning ----------

  function spawnEnemy(type) {
    const T = ENEMIES[type];
    const hp = Math.max(1, Math.round(T.hp * POWER[g.wave] * LEVELS[level].power));
    g.enemies.push({
      type, x: T.r + 10 + Math.random() * (W - 2 * T.r - 20), y: -T.r - 10,
      wave: g.wave, hp, maxHp: hp, shownHp: hp, flash: 0, seed: Math.random() * 10, wobble: 0.6 + Math.random() * 0.8,
      shotIn: 1 + Math.random() * T.shot.every, bash: 0,
    });
  }

  function spawnDoors() {
    if (g.noDoors) return;
    const boxHp = (secs) => Math.max(4, Math.ceil(dps() * secs));
    // Managing a city: your city makes the army, so only a shield box comes now and then
    // (less often on harder levels), on one side of the road.
    if (city.on) {
      if (Math.random() >= LEVELS[level].boxes * 0.3) return;
      const box = { kind: "shield", hp: boxHp(2) };
      box.maxHp = box.hp;
      const left = Math.random() < 0.5;
      box.x0 = left ? 18 : W / 2 + 12; box.x1 = left ? W / 2 - 12 : W - 18;
      g.doors.push({ y: -90, h: 84, speed: 52, list: [box] });
      return;
    }
    const w = WEAPONS[g.tier];
    const next = nextWeapon();
    const offers = [];
    // New weapons arrive at a steady pace, about one per wave.
    if (next >= 0 && next <= g.wave + 2) offers.push({ kind: "weapon", tier: next, hp: boxHp(2.4) });
    if (g.count < w.max) offers.push({ kind: "army", amount: Math.min(w.add, w.max - g.count), hp: boxHp(2) });
    const wallHurt = g.wall < g.wallMax * 0.7;
    const wall = { kind: "wall", hp: boxHp(2) };
    const shield = { kind: "shield", hp: boxHp(2) };
    if (wallHurt || Math.random() < 0.5) offers.push(wall, shield); else offers.push(shield, wall);
    let pair = offers.slice(0, 2);
    // Where a box is missing there is a tough wall instead (more of them on harder levels).
    pair = pair.map((d) => (Math.random() < LEVELS[level].boxes ? d : { kind: "barrier", hp: boxHp(2) * 4 }));
    pair.forEach((d) => { d.maxHp = d.hp; });
    let [a, b] = pair;
    if (Math.random() < 0.5) [a, b] = [b, a];
    a.x0 = 18; a.x1 = W / 2 - 12;
    b.x0 = W / 2 + 12; b.x1 = W - 18;
    g.doors.push({ y: -90, h: 84, speed: 52, list: [a, b] });
  }

  // ---------- Update ----------

  function unitGap() {
    return WEAPONS[g.tier].vehicle ? 46 : 30;
  }

  // In 2D and 3D your army stands in a row. In FPS you (i = 0) stand in the middle and the
  // others take turns on your left and your right.
  function rank(i) {
    if (mode !== "fps") return i - (g.count - 1) / 2;
    return i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
  }

  function squadSpots() {
    const spots = [];
    const gap = unitGap();
    for (let i = 0; i < g.count; i++) spots.push({ x: g.squadX + rank(i) * gap, y: SQUAD_Y, i });
    return spots;
  }

  function squadHalfWidth() {
    const side = mode === "fps" ? Math.ceil((g.count - 1) / 2) : (g.count - 1) / 2;
    return side * unitGap() + (WEAPONS[g.tier].vehicle ? 22 : 15);
  }

  // How high each kind of shot flies above the grass.
  function shotHeight(kind) {
    return { plane: 46, laser: 30, bomb: 22, ball: 15, shell: 17, missile: 18 }[kind] || 20;
  }

  // Your army shoots straight up the field, or in FPS at the spot under your cross-hair.
  function fire() {
    const w = WEAPONS[g.tier];
    const multi = w.multi || 1;
    const fps = mode === "fps";
    const speed = fps ? w.speed * ZOOM : w.speed;
    squadSpots().forEach((s) => {
      let dx = 0, dy = -1;
      if (fps) {
        dx = g.target.x - s.x; dy = g.target.y - (s.y - 16);
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
      }
      for (let m = 0; m < multi; m++) {
        const off = multi > 1 ? (m - 0.5) * 10 : 0;
        g.bullets.push({ x: s.x - dy * off, y: s.y - 16 + dx * off, vx: dx * speed, vy: dy * speed, dmg: w.dmg, kind: w.kind,
          splash: w.splash || 0, pierce: w.pierce || 0, hit: [], age: 0, you: s.i === 0 });
      }
      if (mode === "3d") g.fx.push({ type: "flash", x: s.x, y: s.y - 18, h: shotHeight(w.kind), t: 0, life: 0.07 });
    });
    g.kick = fps ? 0.09 : 0.08;
    g.flash = 0.06;
    if (g.enemies.length || g.doors.length) Sound.shot(w.kind);
  }

  function hurtEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.15;
    if (e.hp > 0) Sound.play("hit");
    if (e.hp <= 0) {
      g.enemies.splice(g.enemies.indexOf(e), 1);
      const T = ENEMIES[e.type];
      // Knocked out: it falls where it stood and sinks away (t goes up to life).
      g.tumblers.push({ type: e.type, wave: e.wave, x: e.x, y: e.y, h: 0, rot: 0, seed: e.seed, t: 0, life: T.r > 40 ? 1.8 : 1.2, view: e.view });
      poof(e.x, e.y, T.r);
      if (T.r > 40) g.shake = 0.4;
      Sound.play(T.r > 40 ? "boom" : "thud");
      if (mode === "fps") {
        g.shake = Math.max(g.shake, 0.08);
        // Quick knock-outs in a row make a combo.
        g.combo = g.comboT > 0 ? g.combo + 1 : 1;
        g.comboT = 1.2;
        if (g.combo >= 3) say(t("COMBO ×{n}!", { n: g.combo }), e.x, e.y, 22 + Math.min(g.combo, 10) * 2, "#ffd93d", T.r * 2.4 + 50);
        g.hitMark = 0.25;
      }
      // The King Tank only comes in the very last wave (in the AI Empire with a city): knocking it out wins.
      if (e.type === "king") return win();
    } else {
      g.hitMark = Math.max(g.hitMark || 0, 0.12);
    }
  }

  // Effects live on the field too: x and y like everything else, plus h = height above the grass.
  // Smoke rising, and a few hot sparks.
  function poof(x, y, r, word) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fx.push({ type: "puff", x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.3, h: r * (0.3 + 0.4 * Math.abs(Math.sin(a))),
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 20, vh: 45, r: r * 0.4, t: 0, life: 0.9, color: i % 2 ? "#4a4a48" : "#6b6863" });
    }
    for (let i = 0; i < 4; i++) {
      g.fx.push({ type: "star", x, y, h: r, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 100, vh: 120 + Math.random() * 200,
        grav: 500, t: 0, life: 0.6, color: ["#ffb347", "#ff7b1c", "#ffd27a", "#ff7b1c"][i] });
    }
    if (word) say(word, x, y, 18 + r * 0.3, "#fff", r * 2.4 + 10);
  }

  function say(text, x, y, size, color, h) {
    g.fx.push({ type: "text", text, x, y, h: h === undefined ? 40 : h, vh: 50, t: 0, life: 1.1, size, color });
  }

  function boom(x, y, radius) {
    Sound.play(radius >= 100 ? "kaboom" : "boom");
    g.fx.push({ type: "boom", x, y, h: 18, r: radius, t: 0, life: 0.45 });
    if (radius >= 100) {
      say(t("KA-BOOM!"), x, y, 40, "#ffd93d", 90);
      g.shake = 0.35;
    }
  }

  function confetti(cx, cy, n, colors) {
    for (let i = 0; i < n; i++) {
      g.fx.push({ type: "confetti", x: cx + (Math.random() - 0.5) * 120, y: cy + (Math.random() - 0.5) * 30, h: 40,
        vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 120, vh: 150 + Math.random() * 250, grav: 500,
        t: 0, life: 1.4, rot: Math.random() * 6, color: colors[i % colors.length] });
    }
  }

  function breakDoor(pair, door) {
    door.broken = true;
    const cx = (door.x0 + door.x1) / 2;
    const cy = pair.y + pair.h;
    if (door.kind === "barrier") {
      // A wall is not a prize: it just crumbles out of the way.
      door.gone = true;
      Sound.play("crumble");
      confetti(cx, cy, 16, ["#adb5bd", "#6c757d", "#ced4da"]);
      say(t("CRUMBLE!"), cx, cy, 24, "#fff", 100);
      return;
    }
    confetti(cx, cy, 24, PARTY);
    Sound.play("box");
    let text;
    if (door.kind === "weapon") {
      g.tier = door.tier;
      g.count = 1;
      text = t("{name}!", { name: WEAPONS[g.tier].name });
    } else if (door.kind === "army") {
      g.count = Math.min(WEAPONS[g.tier].max, g.count + door.amount);
      text = "+" + door.amount + " " + WEAPONS[g.tier].emoji;
    } else if (door.kind === "wall") {
      g.wallMax += 40;
      g.wall = g.wallMax;
      text = t("Bigger wall!");
    } else {
      g.shield = 12;
      text = t("Shield!");
    }
    g.banner = { text: "🎉 " + text, t: 1.8 };
    // You only get one box of the pair: the other one fades away.
    pair.list.forEach((d) => { if (d !== door && d.kind !== "barrier") d.gone = true; });
    pair.done = true;
    closePair(pair);
    syncStats();
  }

  // When a pair is finished, a weapon you did not take is missed for the rest of the game.
  function closePair(pair) {
    pair.closed = true;
    pair.list.forEach((d) => {
      if (d.kind === "weapon" && !d.broken) {
        g.missed.add(d.tier);
        Sound.play("miss");
        g.banner = { text: t("😮 Missed the {name}!", { name: WEAPONS[d.tier].name }), t: 2 };
      }
    });
  }

  function hurtWall(dmg) {
    if (g.wall <= 0) return;
    g.wall -= dmg;
    if (g.wall <= 0) {
      g.wall = 0;
      Sound.play("crash");
      g.shake = 0.5;
      confetti(W / 2, WALL_Y, 30, ["#d4a373", "#a47148", "#e9c46a"]);
      say(t("CRASH! The wall broke!"), W / 2, WALL_Y, 28, "#ff6b6b", 60);
    }
  }

  function hurtLife(dmg) {
    g.life -= dmg;
    g.hurt = 0.4;
    Sound.play("hurt");
    g.shake = Math.max(g.shake, 0.25);
    // In FPS you are behind the wall, so the words go where you can see them.
    if (mode === "fps") say("-" + Math.ceil(dmg) + " ❤️", g.squadX, WALL_Y - 70, 24, "#ff6b6b", 60);
    else say("-" + Math.ceil(dmg) + " ❤️", g.squadX, SQUAD_Y, 24, "#ff6b6b", 50);
    syncStats();
    if (g.life <= 0) gameOver();
  }

  function breakThrough(e) {
    const T = ENEMIES[e.type];
    g.enemies.splice(g.enemies.indexOf(e), 1);
    poof(e.x, mode === "fps" ? WALL_Y - 20 : SQUAD_Y, T.r, t("Breach!"));
    g.leaks = (g.leaks || 0) + 1;
    hurtLife(T.hit * LEVELS[level].hurt);
  }

  function enemyShoot(e) {
    const T = ENEMIES[e.type];
    const s = T.shot;
    const x = e.x + (T.tank ? 0 : T.r * 0.6), y = e.y + T.r * 0.6, vy = s.kind === "bigshell" ? 190 : 150;
    g.shots.push({ x, y, vy, vx: city.towerAim(x, y, vy),
      dmg: s.dmg, kind: s.kind, age: 0, y0: e.y + T.r * 0.6, h0: T.tank ? T.r * 0.75 : T.r * 2.4 });
    e.throwT = 0.3;
    Sound.play("throw");
  }

  function update(dt) {
    if (state !== "playing") return;
    g.clock += dt;  // how long this battle has lasted, for Best scores
    const w = WEAPONS[g.tier];
    const L = LEVELS[level];
    city.tick(dt);
    g.comboT = Math.max(0, g.comboT - dt);

    // Move the army (in FPS you stand still and turn your head instead).
    if (mode !== "fps") {
      const speed = 380;
      if (input.left || input.right) {
        input.targetX = null;
        g.squadX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * speed * dt;
      } else if (input.targetX !== null) {
        const d = input.targetX - g.squadX;
        g.squadX += Math.sign(d) * Math.min(Math.abs(d), speed * 1.4 * dt);
      }
      const half = squadHalfWidth();
      g.squadX = Math.max(half, Math.min(W - half, g.squadX));
    }

    // Shoot all the time.
    g.fireIn -= dt;
    if (g.fireIn <= 0) {
      g.fireIn += 1 / w.rate;
      fire();
    }
    g.shield = Math.max(0, g.shield - dt);

    // Spawn the wave.
    if (g.spawnQueue.length) {
      g.spawnIn -= dt;
      if (g.spawnIn <= 0) {
        g.calm = false;
        spawnEnemy(g.spawnQueue.shift());
        g.spawnIn = WAVES[g.wave].gap * (0.7 + Math.random() * 0.6);
      } else if (g.calm && (!g.banner || g.banner.t <= 0.6)) {
        city.countdown(g.spawnIn);
      }
    } else if (!g.enemies.length) {
      // There is no last wave: the King Tank's wave comes back until you knock the King Tank out.
      g.breakIn -= dt;
      if (g.breakIn <= 0) {
        g.breakIn = city.peace;
        startWave(Math.min(city.nextWave(g.wave), WAVES.length - 1));
      } else if (city.on && g.breakIn < city.peace - 2.4) {
        city.countdown(g.breakIn);
      } else if (!g.banner || g.banner.t <= 0) {
        g.banner = { text: t("Wave {n} done! ⭐", { n: city.on ? city.round : g.wave + 1 }), t: 2.4 };
      }
    }

    // Doors.
    g.doorIn -= dt;
    if (g.doorIn <= 0) {
      spawnDoors();
      g.doorIn = 7;
    }
    g.doors.forEach((p) => {
      p.y += p.speed * dt;
      p.list.forEach((d) => { if (d.gone || d.broken) d.fade = (d.fade || 0) + dt; });
      if (!p.closed && p.y >= WALL_Y - p.h) closePair(p);
    });
    g.doors = g.doors.filter((p) => p.y < WALL_Y - p.h + 10 && !p.list.every((d) => d.fade > 0.5));

    // Enemies march down, stop to bash the wall, and throw things at you.
    g.enemies.slice().forEach((e) => {
      const T = ENEMIES[e.type];
      const stopY = WALL_Y - T.r * 0.9 - 8;
      e.atWall = g.wall > 0 && e.y >= stopY;
      if (e.atWall) {
        e.y = stopY;
        e.bash += dt;
        if (!city.towerBash(e.x, T.r, T.bash * L.hurt * dt)) hurtWall(T.bash * L.hurt * dt);
      } else {
        e.y += T.speed * dt;
        e.x += (Math.sin(time * e.wobble + e.seed) * 14 + city.towerPull(e.x, e.y)) * dt;
        e.x = Math.max(T.r, Math.min(W - T.r, e.x));
        e.shotIn -= dt;
        if (e.shotIn <= 0 && e.y > 30 && e.y < WALL_Y - 80) {
          e.shotIn = T.shot.every * (0.8 + Math.random() * 0.4);
          enemyShoot(e);
        }
      }
      e.throwT = Math.max(0, (e.throwT || 0) - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.shownHp += (e.hp - e.shownHp) * Math.min(1, dt * 6);
      if (e.y + T.r * 0.6 >= SQUAD_Y - 10) breakThrough(e);
    });
    if (state !== "playing") return;

    // Enemy shots hit the wall, or your army once the wall is gone. The shield blocks them all.
    g.shots.forEach((s) => {
      s.y += s.vy * dt;
      if (s.vx) s.x += s.vx * dt;
      s.age += dt;
      // The enemy aims at your towers first: they take the hit instead of the wall.
      if (city.towerShot(s.x, s.y, s.dmg * L.hurt)) { s.dead = true; return; }
      const lineY = g.wall > 0 ? WALL_Y - 6 : SQUAD_Y - 12;
      if (s.y < lineY) return;
      const onArmy = Math.abs(s.x - g.squadX) < squadHalfWidth() + 6;
      if (g.wall <= 0 && !onArmy) {
        if (s.y > H + 20) s.dead = true;
        return;
      }
      s.dead = true;
      if (g.shield > 0) {
        say(t("Blocked!"), s.x, lineY, 16, "#90e0ef", 50);
        return;
      }
      g.fx.push({ type: "puff", x: s.x, y: lineY, h: 10, vh: 20, r: 8, t: 0, life: 0.4 });
      if (g.wall > 0) hurtWall(s.dmg * L.hurt);
      else hurtLife(s.dmg * L.hurt);
    });
    g.shots = g.shots.filter((s) => !s.dead);
    if (state !== "playing") return;

    // Bullets fly up the field and hit the first thing in their way.
    g.bullets.forEach((b) => {
      b.y += b.vy * dt;
      if (b.vx) b.x += b.vx * dt;
      b.age += dt;
      for (const e of g.enemies) {
        if (b.hit.includes(e)) continue;
        const T = ENEMIES[e.type];
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (T.r + 6) * (T.r + 6)) {
          if (b.splash) {
            boom(b.x, b.y, b.splash);
            g.enemies.slice().forEach((o) => {
              const ox = o.x - b.x, oy = o.y - b.y, rr = b.splash + ENEMIES[o.type].r;
              if (ox * ox + oy * oy < rr * rr) hurtEnemy(o, b.dmg);
            });
          } else {
            hurtEnemy(e, b.dmg);
            g.fx.push({ type: "pow", x: b.x, y: b.y, h: shotHeight(b.kind), t: 0, life: 0.2 });
          }
          b.hit.push(e);
          if (b.hit.length > b.pierce) { b.dead = true; return; }
        }
      }
      // Tower shots fly past the boxes: picking a box is your choice.
      if (b.tower) return;
      for (const p of g.doors) {
        if (b.y > p.y + p.h || b.y < p.y) continue;
        for (const d of p.list) {
          if (d.gone || d.broken || b.x < d.x0 || b.x > d.x1) continue;
          d.hp -= b.dmg;
          d.flash = 0.1;
          g.hitMark = Math.max(g.hitMark || 0, 0.12);
          if (b.splash) boom(b.x, p.y + p.h, Math.min(60, b.splash));
          else g.fx.push({ type: "pow", x: b.x, y: p.y + p.h, h: shotHeight(b.kind), t: 0, life: 0.2 });
          if (d.hp <= 0) breakDoor(p, d);
          b.dead = true;
          return;
        }
      }
    });
    g.bullets = g.bullets.filter((b) => !b.dead && b.y > -60 && b.y < H + 40 && b.x > -60 && b.x < W + 60);

    g.doors.forEach((p) => p.list.forEach((d) => { if (d.flash) d.flash = Math.max(0, d.flash - dt); }));
  }

  // Effects keep moving even on the win / game-over screens.
  function updateFx(dt) {
    time += dt;
    if (!g) return;
    g.fx.forEach((f) => {
      f.t += dt;
      if (f.vx) f.x += f.vx * dt;
      if (f.vy) f.y += f.vy * dt;
      if (f.vh) f.h += f.vh * dt;
      if (f.grav) {
        f.vh -= f.grav * dt;
        if (f.h < 1) { f.h = 1; f.vh = 0; f.vx *= 0.8; f.vy *= 0.8; }
      }
    });
    g.fx = g.fx.filter((f) => f.t < f.life);
    g.tumblers.forEach((t) => {
      t.t += dt;
      if (t.t >= t.life) t.done = true;
    });
    g.tumblers = g.tumblers.filter((t) => !t.done);
    g.shake = Math.max(0, g.shake - dt);
    g.hurt = Math.max(0, g.hurt - dt);
    g.kick = Math.max(0, (g.kick || 0) - dt);
    g.flash = Math.max(0, (g.flash || 0) - dt);
    g.hitMark = Math.max(0, (g.hitMark || 0) - dt);
    if (g.banner) g.banner.t -= dt;
    if (state === "won" && Math.random() < 0.3) {
      g.fx.push({ type: "confetti", x: Math.random() * W, y: Math.random() * (H - 60), h: 200, vh: -70,
        t: 0, life: 3, rot: Math.random() * 6, color: PARTY[Math.floor(Math.random() * 5)] });
    }
  }

  // Best scores: only a win counts, with its level ("-city" in Army Rush City), and the time it
  // took. One list for Army Rush, whatever the view: you can switch views in the middle of a battle.
  function sendScore() {
    if (g.scored) return;
    g.scored = true;
    Accounts.submit("army", Math.round(g.clock), level + (city.on ? "-city" : ""));
  }

  function gameOver() {
    state = "over";
    Sound.play("lose");
    endedAt = time;
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  function win() {
    state = "won";
    Sound.play("win");
    endedAt = time;
    sendScore();
    g.banner = null;
    g.doors = [];
    g.shots = [];
  }

  // ---------- Screens and banner (plain HTML on top of the picture) ----------

  // Under the start, lose and win screens: who is playing, with Log in (or their name, which opens
  // the log in page to switch player) and the Best scores page. A tap on them doesn't start a battle.
  function accountRow() {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
    const me = Accounts.online && Accounts.player;
    const who = !Accounts.online ? "" : me
      ? "<a class='btn' href='login.html'>👤 " + esc(me.name) + "</a>"
      : "<a class='btn go' href='login.html'>" + t("👤 Log in") + "</a>";
    return "<div class='account-row'>" + who + "<a class='btn' href='scores.html'>" + t("🏆 Best scores") + "</a></div>";
  }

  let screenKey = "";
  function updateScreen() {
    const key = (state === "ready" ? "ready:" + level : state) + ":" + mode;
    if (key === screenKey) return;
    screenKey = key;
    el.screen.hidden = state === "playing";
    el.menu.hidden = state === "playing";
    el.gauges.hidden = state !== "playing";
    if (state === "ready") {
      const aim = mode === "fps"
        ? "<div>" + t("Tap where you want to shoot 🎯") + "</div>"
        : "";
      const look = mode === "fps" ? "<div>" + t("Hold ⬅️ ➡️ to look at your army") + "</div>" : "";
      const how = FULL
        ? "<div>" + t("Grow your city 🏘️ from the Stone Age") + "</div><div>" + t("to the AI Empire: it makes your army,") + "</div><div>" + t("your weapons and your wall 🧱") + "</div>"
        : "<div>" + t("Shoot boxes to get") + "</div><div>" + t("a new weapon 🏹, more of it,") + "</div><div>" + t("or a stronger defence 🧱") + "</div>";
      el.screen.innerHTML = "<div class='big'>" + t(FULL ? "🏰 Army Rush City!" : "🪖 Army Rush!") + "</div><div>" + t("An enemy army is coming!") + "</div>" + aim +
        how + look +
        "<div class='gold'>" + t("Level: {name}", { name: LEVELS[level].name }) + "</div><div class='go'>" + t("Tap to start!") + "</div>" + accountRow();
    } else if (state === "over") {
      el.screen.innerHTML = "<div class='big bad'>" + t("Oh no! 😵") + "</div><div>" + t("They got through!") + "</div>" +
        "<div>" + t("You reached wave {n}", { n: city.on ? city.round : g.wave + 1 }) + "</div><div class='gold'>" + t(FULL ? "Tip: build towers and barracks!" : "Tip: open more boxes!") + "</div>" +
        "<div class='go'>" + t("Tap to try again") + "</div>" + accountRow();
    } else if (state === "won") {
      el.screen.innerHTML = "<div class='big'>" + t("YOU WIN! 🏆") + "</div><div>" + t("The King Tank") + "</div><div>" + t("is destroyed!") + "</div>" +
        "<div class='gold'>⏱️ " + Accounts.formatTime(g.clock) + "</div><div class='go'>" + t("Tap to play again") + "</div>" +
        (Accounts.online && !Accounts.player ? "<div>" + t("Log in to keep your time!") + "</div>" : "") + accountRow();
    }
  }

  let bannerText = "";
  function updateHud() {
    const b = g.banner;
    const show = state === "playing" && b && b.t > 0;
    el.banner.hidden = !show;
    if (show) {
      if (b.text !== bannerText) { bannerText = b.text; el.banner.textContent = b.text; }
      el.banner.style.opacity = Math.min(1, b.t * 2);
    }
    el.hurt.style.opacity = g.hurt > 0 ? g.hurt * 0.6 : 0;
    updateScreen();
  }

  // ---------- The view: 2D, 3D or FPS ----------

  // What a view needs from the battle. g, time, state and level change: a view reads them again
  // each time it draws.
  const core = {
    W, H, WALL_Y, SQUAD_Y, WEAPONS, ENEMIES, LEVELS, PARTY, FONT, t,
    stage, el, input, city, squadSpots, shotHeight, fmt,
    get g() { return g; }, get time() { return time; }, get state() { return state; }, get level() { return level; },
  };

  // Each view is made the first time it is picked, and kept. A device that can't show 3D
  // keeps the 2D view, and its 3D and FPS buttons are turned off.
  const views = {};
  let current = null;

  function makeView(m) {
    if (!(m in views)) views[m] = ArmyViews[m](core);
    if (!views[m]) {
      // 3D and FPS both need 3D.
      viewBtns.forEach((b) => {
        if (b.dataset.view === "2d") return;
        b.disabled = true;
        b.title = t("This device can't show 3D.");
      });
    }
    return views[m];
  }

  // The aim starts again: no finger on the screen, and in FPS the cross-hair in the middle.
  function aimReset() {
    input.targetX = null;
    input.dragging = false;
    input.held = false;
    if (current && current.centreAim) current.centreAim();
  }

  function setView(m) {
    if (!ArmyViews[m] || m === mode && current) return;
    const next = makeView(m) || makeView("2d");
    m = next === views["2d"] ? "2d" : m;
    if (current && current !== next) current.hide();
    mode = m;
    current = next;
    stage.dataset.view = m;
    // In FPS you are the one in the middle of your army, right behind the middle of the wall.
    if (m === "fps") g.squadX = W / 2;
    current.show();
    aimReset();
    const look = m === "fps";
    el.left.setAttribute("aria-label", t(look ? "Look left" : "Move left"));
    el.right.setAttribute("aria-label", t(look ? "Look right" : "Move right"));
    viewBtns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === m));
    tutorial.view(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch (e) { /* the view is just not kept for next time */ }
  }

  viewBtns.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setView(btn.dataset.view);
      btn.blur();
    });
  });

  // ---------- Loop + controls ----------

  let last = 0, acc = 0;
  function loop(now) {
    const ms = last ? now - last : 16;
    const dt = Math.min(0.1, ms / 1000);
    acc += dt;
    last = now;
    // The music of your city's age (epic-music.js): the full orchestra while you fight (and in the
    // city while the enemy is at your walls), calmer on the start screen and in the city between
    // attacks, silence while paused or after the battle.
    const fighting = state === "playing" && (!city.open || g.enemies.length > 0);
    if (window.EpicMusic) EpicMusic.mood = fighting ? "battle" : "calm";
    const on = !pause.paused && (state === "playing" || state === "ready" || city.open);
    Sound.music(!on ? null : window.EpicMusic && city.on ? "epic" + city.c.era : state === "playing" ? "battle" : "town");
    if (pause.paused || tutorial.open) acc = 0; // nothing moves while paused or while a tutorial card is up
    while (acc >= STEP) {
      update(STEP);
      updateFx(STEP);
      acc -= STEP;
    }
    if (!city.open) { // the city view covers the battle
      current.render(dt, ms);
      updateHud();
    }
    requestAnimationFrame(loop);
  }

  function start() {
    if (time - endedAt < 1.2) return;
    newGame();
    state = "playing";
    Sound.play("horn");
    aimReset();
  }

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button, label")) return;
    e.preventDefault();
    if (state !== "playing") return start();
    if (mode === "fps") {
      input.held = true;
      current.aimAt(e);
    } else {
      input.dragging = true;
      input.targetX = current.fieldX(e);
    }
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (mode === "fps") {
      if (state === "playing" && (input.held || e.pointerType === "mouse")) current.aimAt(e);
    } else if (input.dragging) {
      input.targetX = current.fieldX(e);
    }
  });
  const letGo = () => { input.dragging = false; input.held = false; };
  stage.addEventListener("pointerup", letGo);
  stage.addEventListener("pointercancel", letGo);

  [[el.left, "left"], [el.right, "right"]].forEach(([btn, key]) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== "playing") return start();
      input[key] = true;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, () => { input[key] = false; }));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
  document.addEventListener("keydown", (e) => {
    const k = KEYS[e.key];
    if (k) { input[k] = true; e.preventDefault(); }
    else if ((e.key === " " || e.key === "Enter") && state !== "playing") { e.preventDefault(); start(); }
  });
  document.addEventListener("keyup", (e) => {
    const k = KEYS[e.key];
    if (k) input[k] = false;
  });

  levelBtns.forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    level = btn.dataset.level;
    levelBtns.forEach((b) => b.setAttribute("aria-pressed", b === btn));
    state = "ready";
    newGame();
    btn.blur();
  }));

  // ?debug lets the test script fast-forward the battle, aim and switch views.
  if (/[?&]debug/.test(location.search)) {
    window.armyDebug = {
      get g() { return g; }, get state() { return state; }, get mode() { return mode; }, get view() { return current; },
      dps, nextWeapon, WEAPONS, ENEMIES, input, start, city, pause, tutorial, views, setView,
      setLevel(l) { level = l; },
      step(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } current.render(0, 16); updateHud(); },
      tick(n) { for (let i = 0; i < n; i++) { update(STEP); updateFx(STEP); } },
    };
  }

  newGame();
  setView(mode);
  requestAnimationFrame(loop);
})();

// Army Rush City's city: a second screen of the battle, the same in every view (2D, 3D, FPS).
// A village starts with one house and one person. Give people jobs to make food, bricks,
// iron, gold and ideas; build houses so more people come, and grow the city age after age,
// from the Stone Age to the AI Empire. The city helps the battle: barracks train soldiers,
// the lab finds new weapons, towers shoot from the wall, and bricks make the wall stronger.
// The city only grows while the battle is on, and it warns you when the enemy attacks.
//
// Each game calls ArmyCity.create({...}) once, then city.reset() in newGame(),
// city.tick(dt) while playing, and draws city.towerSpots() on its wall.
window.ArmyCity = (function () {
  const t = I18n.t;

  // pop = people needed to reach this age, house = the look
  // of the houses, mark = the landmark built in this age (it stays in the city forever),
  // ride = what drives along the road, sky = what flies over the city.
  const ERAS = [
    { name: t("Stone Age"), emoji: "🦴", pop: 0, ground: "#a7c957", wall: "#8b5a2b", mark: "🗿", house: 0 },
    { name: t("First Farmers"), emoji: "🌾", pop: 4, ground: "#b5d67a", wall: "#8b5a2b", mark: "🌻", house: 0 },
    { name: t("Egyptian Empire"), emoji: "🐫", pop: 7, ground: "#e9d8a6", wall: "#c9a66b", mark: "pyramid", house: 1, tree: "🌴" },
    { name: t("Ancient Greece"), emoji: "🦉", pop: 10, ground: "#cfe1b9", wall: "#e0d6c8", mark: "🏛️", house: 2, tree: "🫒" },
    { name: t("Roman Empire"), emoji: "🦅", pop: 14, ground: "#b5c99a", wall: "#d6ccc2", mark: "🏟️", house: 2 },
    { name: t("Chinese Empire"), emoji: "🐉", pop: 18, ground: "#a7c4a0", wall: "#9c6644", mark: "🏯", house: 3, sky: "🪁", tree: "🎋" },
    { name: t("Viking Age"), emoji: "🛡️", pop: 23, ground: "#9cc5a1", wall: "#6f4518", mark: "🛶", house: 4, tree: "🌲" },
    { name: t("Middle Ages"), emoji: "🏰", pop: 29, ground: "#95d5b2", wall: "#8d99ae", mark: "🏰", house: 5 },
    { name: t("Renaissance"), emoji: "🎨", pop: 36, ground: "#b7e4c7", wall: "#bfb5a5", mark: "⛪", house: 6 },
    { name: t("Age of Explorers"), emoji: "🧭", pop: 44, ground: "#b7e4c7", wall: "#7f8c8d", mark: "⛵", house: 6, tree: "🌴" },
    { name: t("Industrial Age"), emoji: "🏭", pop: 53, ground: "#a3b18a", wall: "#9c6644", mark: "🏭", house: 7, sky: "🎈" },
    { name: t("Railway Age"), emoji: "🚂", pop: 63, ground: "#a3b18a", wall: "#7f5539", mark: "🚉", house: 7, ride: "🚂🚃🚃" },
    { name: t("Electric Age"), emoji: "💡", pop: 75, ground: "#b8c0a8", wall: "#6c757d", mark: "🗼", house: 8, ride: "🚋", sky: "🎈" },
    { name: t("Age of Cars"), emoji: "🚗", pop: 88, ground: "#ced4da", wall: "#6c757d", mark: "🎡", house: 8, ride: "🚗", sky: "🛩️" },
    { name: t("Jet Age"), emoji: "✈️", pop: 103, ground: "#ced4da", wall: "#6c757d", mark: "🛫", house: 9, ride: "🚌", sky: "✈️" },
    { name: t("Space Age"), emoji: "🚀", pop: 120, ground: "#dee2ff", wall: "#adb5bd", mark: "🚀", house: 10, ride: "🚙", sky: "🛰️" },
    { name: t("Computer Age"), emoji: "💻", pop: 140, ground: "#d8e2dc", wall: "#adb5bd", mark: "🖥️", house: 11, ride: "🚕", sky: "🚁" },
    { name: t("Internet Age"), emoji: "🌐", pop: 165, ground: "#cddafd", wall: "#8e9aaf", mark: "📡", house: 11, ride: "🚙", sky: "🛰️" },
    { name: t("Robot Age"), emoji: "🦾", pop: 195, ground: "#b8c0ff", wall: "#7b8cde", mark: "🤖", house: 12, ride: "🛸", sky: "🚁" },
    { name: t("AI Empire"), emoji: "🤖", pop: 230, ground: "#3d405b", wall: "#00dcff", mark: "🧠", house: 12, ride: "🛸", sky: "🛸", tree: "💠" },
  ];
  const LAST = ERAS.length - 1;
  // With a city, the enemy waves match your age: they repeat until you reach the next age,
  // and in the AI Empire they never stop coming (the King Tank too).
  const AGE_WAVES = [[0], [0, 1], [1], [2], [2, 3], [3], [3, 4], [4], [4, 5], [5], [5, 6],
    [6], [6, 7], [7], [7, 8], [8], [8, 9], [9, 10], [10], [10, 11]];
  // The age you need before the lab can find each weapon (same order as the battle's weapons).
  const WEAPON_ERA = [0, 0, 2, 8, 9, 9, 11, 12, 13, 14, 15, 18];

  const RES = [
    { id: "food", emoji: "🍞", name: t("Food") },
    { id: "bricks", emoji: "🧱", name: t("Bricks") },
    { id: "iron", emoji: "🔩", name: t("Iron") },
    { id: "gold", emoji: "🪙", name: t("Gold") },
    { id: "ideas", emoji: "💡", name: t("Ideas") },
  ];
  const ICON = {};
  RES.forEach((r) => { ICON[r.id] = r.emoji; });

  // rate = what one worker makes each second in the Stone Age (better tools in every new age).
  const JOBS = [
    { id: "farmer", emoji: "🌾", name: t("Farmer"), makes: "food", rate: 0.6, color: "#6bcb77" },
    { id: "builder", emoji: "👷", name: t("Brick maker"), makes: "bricks", rate: 0.3, color: "#e76f51" },
    { id: "miner", emoji: "⛏️", name: t("Miner"), makes: "iron", rate: 0.25, color: "#6c757d" },
    { id: "trader", emoji: "🛒", name: t("Trader"), makes: "gold", rate: 0.3, color: "#ffd93d" },
    { id: "herder", emoji: "🐄", name: t("Cow herder"), makes: "food", rate: 1, color: "#f4a261", era: 1 },
    { id: "scientist", emoji: "🧪", name: t("Scientist"), makes: "ideas", rate: 0.25, color: "#9b5de5", lab: true },
  ];
  const EAT = 0.12;        // food each person eats every second
  const NEWCOMER = 6;      // food for each new person
  const PER_LAB = 3;       // scientists in each lab
  const MAX_BUILD = { lab: 4, barracks: 4 };
  const TOWER_SLOTS = 4;
  const TRAIN_EVERY = 10;  // seconds for a barracks to train a soldier

  const MW = 480, MH = 360; // the city map: the town, then the road of history at the bottom
  const GATE = { x: 240, y: 266 };
  const ROAD = 343; // y of the road along the bottom

  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(".0", "") + "k";
    return (n / 1e6).toFixed(1).replace(".0", "") + "M";
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function create(opts) {
    const weapons = opts.weapons;
    // Army Rush City (opts.always) always has its city; plain Army Rush never has one.
    const on = !!opts.always;
    let open = false;
    let c;          // everything about the city
    let clock = 0;  // keeps the map moving

    function reset() {
      c = {
        people: 1, jobs: {}, houses: 1, lab: 0, barracks: 0, wallLevel: 0,
        towers: [], towerLevel: 0, lv: { house: 0, lab: 0, barracks: 0 }, // towers: one slot each, null once destroyed
        food: 10, bricks: 0, iron: 0, gold: 0, ideas: 0,
        era: 0, arriveIn: 3, trainIn: TRAIN_EVERY, towerIn: [0, 0.5, 0.25, 0.75], hungry: false,
        order: ["house"], // buildings in the town, in the order they were built
        round: 0, floats: [], lastWall: null, lastLife: null, alert: null, alertT: 0, made: {},
      };
      JOBS.forEach((j) => { c.jobs[j.id] = 0; });
      if (open) refresh(true);
    }

    // ---------- Economy ----------

    const g = () => opts.game();
    const tools = () => 1 + 0.3 * c.era;
    const idle = () => c.people - JOBS.reduce((s, j) => s + c.jobs[j.id], 0);
    // Every house upgrade (one per age) makes room for one more person in each house.
    const houseCap = (lv) => 2 + lv;
    const room = () => c.houses * houseCap(c.lv.house);
    const towerCount = () => c.towers.filter(Boolean).length;
    const labRoom = () => c.lab * PER_LAB;
    const labBoost = () => 1 + 0.5 * c.lv.lab;
    const campBoost = () => 1 + 0.3 * c.lv.barracks;
    const jobOpen = (j) => (!j.era || c.era >= j.era) && (!j.lab || c.jobs[j.id] < labRoom());

    function costs(what) {
      const tier = g().tier;
      switch (what) {
        case "house": return { bricks: 5 + 3 * c.houses };
        case "lab": return { bricks: 15 + 10 * c.lab, gold: 10 + 10 * c.lab };
        case "barracks": return { bricks: 12 + 10 * c.barracks, iron: 5 + 5 * c.barracks };
        case "tower": return { bricks: 15 + 15 * towerCount(), iron: 8 + 8 * towerCount() };
        case "towerUp": { const L = c.towerLevel; return { bricks: 15 + 12 * L, iron: 10 + 10 * L, gold: 5 + 8 * L }; }
        case "towerFix": {
          const missing = c.towers.reduce((s, tw) => s + (tw ? tw.max - tw.hp : 0), 0);
          return { bricks: Math.max(2, Math.ceil(missing / 8)) };
        }
        case "up_house": { const L = c.lv.house, n = c.houses; return { bricks: (3 + 2 * L) * n, gold: (1 + L) * n }; }
        case "up_lab": { const L = c.lv.lab, n = c.lab; return { bricks: (8 + 6 * L) * n, gold: (8 + 6 * L) * n, iron: (2 + 2 * L) * n }; }
        case "up_barracks": { const L = c.lv.barracks, n = c.barracks; return { bricks: (8 + 6 * L) * n, iron: (4 + 4 * L) * n }; }
        case "wall": return { bricks: 10 + 8 * c.wallLevel };
        case "fix": return { bricks: 4 };
        case "soldier": return { gold: 6 + 3 * tier, iron: 2 + 2 * tier };
        case "train": return { food: 4, iron: 1 + tier };
        case "invest": return { gold: 10 };
      }
      return {};
    }
    const affords = (cost) => Object.keys(cost).every((k) => c[k] >= cost[k]);
    const pay = (cost) => Object.keys(cost).forEach((k) => { c[k] -= cost[k]; });

    // The weapon the lab is working on, and what it needs.
    function research() {
      const tier = g().tier + 1;
      if (tier >= weapons.length) return null;
      return { tier, w: weapons[tier], era: WEAPON_ERA[tier], ideas: Math.round(10 * Math.pow(1.45, tier - 1)), iron: 3 * tier };
    }

    function float(text, x, y, color) {
      if (open) c.floats.push({ text, x, y, t: 0, color: color || "#fff" });
    }

    function tellBattle(text) {
      const b = g();
      b.banner = { text, t: 1.8 };
    }

    function tick(dt) {
      if (!on) return;
      const b = g();
      const playing = opts.state() === "playing";
      const m = tools() * (c.hungry ? 0.5 : 1);

      // Work.
      JOBS.forEach((j) => {
        const n = c.jobs[j.id];
        if (!n) return;
        c[j.makes] += n * j.rate * m * (j.lab ? labBoost() : 1) * dt;
        c.made[j.makes] = true;
      });
      // The bigger the city, the more each person eats.
      c.food -= c.people * EAT * (1 + c.people / 12) * dt;
      c.hungry = c.food <= 0;
      if (c.food < 0) c.food = 0;

      // New people come when there is a free bed and enough food.
      c.arriveIn -= dt;
      if (c.arriveIn <= 0) {
        // One newcomer at a time, so every age lasts a few waves. They need a bit more food in every new age.
        c.arriveIn = 3;
        const need = NEWCOMER * (1 + c.era * 0.3);
        if (c.people < room() && c.food >= need) {
          c.food -= need;
          c.people++;
          const home = houseSpot(c.people % c.houses);
          float("👶 +1", home.x, home.y - 14, "#ffd93d");
        }
      }

      // A new age when the city is big enough. Its walls get stronger too.
      const next = ERAS[c.era + 1];
      if (next && c.people >= next.pop) {
        c.era++;
        c.newAge = 1.5;
        Sound.play("ageup");
        b.wallMax += 30;
        b.wall = Math.min(b.wallMax, b.wall + 30);
        float(next.emoji + " " + next.name + "!", MW / 2, 120, "#ffd93d");
        tellBattle(t("🎉 New age: {name}!", { name: next.emoji + " " + next.name }));
        opts.sync();
      }

      if (!playing) return;

      // The lab finds the next weapon, and the whole army gets it.
      const r = research();
      if (r) {
        c.ideas = Math.min(c.ideas, r.ideas);
        if (c.ideas >= r.ideas && c.era >= r.era && c.iron >= r.iron) {
          c.ideas = 0;
          c.iron -= r.iron;
          b.tier = r.tier;
          b.count = Math.max(1, Math.min(r.w.max, b.count));
          b.missed.delete(r.tier);
          Sound.play("research");
          tellBattle(t("🔬 New weapon from the lab: {name}!", { name: r.w.emoji + " " + r.w.name }));
          float("🔬 " + r.w.emoji, MW / 2, 100, "#ffd93d");
          opts.sync();
        }
      }

      // Barracks train soldiers for your army.
      if (c.barracks) {
        c.trainIn -= dt * c.barracks * campBoost();
        if (c.trainIn <= 0) {
          const cost = costs("train");
          if (b.count < weapons[b.tier].max && affords(cost)) {
            pay(cost);
            c.trainIn = TRAIN_EVERY;
            b.count++;
            Sound.play("recruit");
            tellBattle(t("⛺ A soldier joins your army!") + " " + weapons[b.tier].emoji);
            opts.sync();
          } else {
            c.trainIn = 0;
          }
        }
      }

      fireTowers(dt);
      watchBattle(dt);
    }

    // ---------- Towers ----------

    // A tower shoots a weapon you paid for, always at least one step behind your army's,
    // so it never gets the mega bomb. It has its own life: the enemy goes for it first.
    const towerTop = () => Math.max(0, Math.min(g().tier - 1, weapons.length - 2));
    const towerTier = () => Math.min(c.towerLevel, towerTop());
    const towerMax = () => 60 + 30 * c.towerLevel + 10 * c.era;

    // Where the towers stand on the battle wall (the ones still standing).
    function towerSpots() {
      if (!on) return [];
      const W = opts.W, xs = [26, W - 26, 140, W - 140], tier = towerTier();
      const out = [];
      c.towers.forEach((tw, i) => { if (tw) out.push({ x: xs[i], y: opts.wallY, hp: tw.hp, max: tw.max, tier, slot: i }); });
      return out;
    }

    function nearestTower(x) {
      let best = null;
      towerSpots().forEach((s) => { if (!best || Math.abs(s.x - x) < Math.abs(best.x - x)) best = s; });
      return best;
    }

    function hurtTower(slot, dmg) {
      const tw = c.towers[slot];
      if (!tw) return;
      tw.hp -= dmg;
      if (tw.hp > 0) return;
      c.towers[slot] = null;
      Sound.play("crash");
      tellBattle(t("💥 A tower fell! Build a new one"));
      c.alert = { text: t("💥 A tower fell! Build a new one"), level: 3 };
      c.alertT = 2.5;
      opts.sync();
    }

    // The enemy goes for the towers first: it walks towards the nearest one...
    function towerPull(x, y) {
      const s = y < opts.wallY ? nearestTower(x) : null;
      return !s || Math.abs(s.x - x) < 4 ? 0 : Math.sign(s.x - x) * 30;
    }
    // ...throws its shots at it (the sideways speed that lands the shot on the tower)...
    function towerAim(x, y, vy) {
      const s = nearestTower(x);
      return s ? ((s.x - x) * vy) / Math.max(40, s.y - 20 - y) : 0;
    }
    // ...and a shot or a bash that reaches a tower hurts the tower, not the wall.
    // The shield keeps the shots off the towers too.
    function towerShot(x, y, dmg) {
      if (y < opts.wallY - 30) return false;
      const s = towerSpots().find((p) => Math.abs(p.x - x) < 16);
      if (!s) return false;
      if (!(g().shield > 0)) hurtTower(s.slot, dmg);
      return true;
    }
    function towerBash(x, r, dmg) {
      const s = towerSpots().find((p) => Math.abs(p.x - x) < r + 14);
      if (!s) return false;
      hurtTower(s.slot, dmg);
      return true;
    }

    // Each tower shoots at the nearest enemy, a bit slower than a soldier.
    function fireTowers(dt) {
      const b = g();
      const w = weapons[towerTier()];
      towerSpots().forEach((s) => {
        const i = s.slot;
        c.towerIn[i] -= dt;
        if (c.towerIn[i] > 0) return;
        const y0 = s.y - 24;
        let best = null;
        b.enemies.forEach((e) => {
          if (e.y < 0 || e.y > y0 - 20) return;
          const d = Math.hypot(e.x - s.x, e.y - y0);
          if (!best || d < best.d) best = { e, d };
        });
        if (!best) { c.towerIn[i] = 0.2; return; }
        c.towerIn[i] = 2 / w.rate;
        const dx = (best.e.x - s.x) / best.d, dy = (best.e.y - y0) / best.d;
        b.bullets.push({ x: s.x, y: y0, vx: dx * w.speed, vy: dy * w.speed, dmg: w.dmg * (w.multi || 1) * 1.2,
          kind: w.kind, splash: w.splash || 0, pierce: w.pierce || 0, hit: [], age: 0, tower: true });
      });
    }

    // ---------- Alerts ----------

    function watchBattle(dt) {
      const b = g();
      const attack = b.enemies.length > 0;
      let alert = null;
      if (b.wall <= 0 && attack) alert = { text: t("💥 Your wall is broken! Go and fight!"), level: 3 };
      else if (c.lastWall !== null && b.wall < c.lastWall - 0.01) alert = { text: t("🧱 They are hitting your wall! ({n}%)", { n: Math.ceil((100 * b.wall) / b.wallMax) }), level: 2 };
      else if (c.lastTowers !== undefined && towerHp() < c.lastTowers - 0.01) alert = { text: t("🗼 They are hitting your towers!"), level: 2 };
      else if (c.lastLife !== null && b.life < c.lastLife) alert = { text: t("❤️ Ouch! They got through!"), level: 3 };
      else if (attack) alert = { text: t("⚠️ Attack! The enemy is here!"), level: 1 };
      if (c.alert && c.alert.level === 3 && c.alertT > 0 && (!alert || alert.level < 3)) { c.alertT -= dt; alert = null; } // keep a big alert up a moment
      else if (alert) { c.alert = alert; c.alertT = alert.level >= 2 ? 1.5 : 0.3; }
      else if (c.alertT > 0) c.alertT -= dt;
      else c.alert = null;
      if (alert && !c.wasAttack && attack && open && navigator.vibrate) navigator.vibrate(200);
      c.wasAttack = attack;
      c.lastWall = b.wall;
      c.lastLife = b.life;
      c.lastTowers = towerHp();
    }
    const towerHp = () => c.towers.reduce((s, tw) => s + (tw ? tw.hp : 0), 0);

    // ---------- Actions ----------

    function addJob(j, n) {
      if (n > 0 && (idle() <= 0 || !jobOpen(j))) return;
      if (n < 0 && c.jobs[j.id] <= 0) return;
      c.jobs[j.id] += n;
      Sound.play("click");
      refresh();
    }

    // Give every free person a job, a fair share for each job you can have.
    function shareOut() {
      let free = idle();
      let guard = 200;
      while (free > 0 && guard--) {
        const open = JOBS.filter(jobOpen);
        if (!open.length) break;
        open.sort((a, b) => c.jobs[a.id] - c.jobs[b.id]);
        c.jobs[open[0].id]++;
        free--;
      }
      refresh();
    }

    function build(what) {
      const b = g();
      const cost = costs(what);
      if (!canBuild(what) || !affords(cost)) return;
      pay(cost);
      Sound.play(what === "soldier" ? "recruit" : "build");
      if (what === "house" || what === "lab" || what === "barracks") {
        c.order.push(what);
        if (what === "house") c.houses++; else c[what]++;
        const s = cellSpot(c.order.length - 1);
        float("✨", s.x, s.y - 10);
      } else if (what === "tower") {
        let slot = c.towers.indexOf(null);
        if (slot < 0) slot = c.towers.length;
        c.towers[slot] = { hp: towerMax(), max: towerMax() };
        c.towerIn[slot] = 0.5;
        tellBattle(t("🗼 New tower on your wall!"));
      } else if (what === "towerUp") {
        c.towerLevel++;
        c.towers.forEach((tw) => { if (tw) { const m = towerMax(); tw.hp += m - tw.max; tw.max = m; } });
        tellBattle(t("🗼 Your towers now shoot {name}!", { name: weapons[towerTier()].emoji + " " + weapons[towerTier()].name }));
      } else if (what === "towerFix") {
        c.towers.forEach((tw) => { if (tw) tw.hp = tw.max; });
        tellBattle(t("🔧 Towers fixed!"));
      } else if (what.startsWith("up_")) {
        const kind = what.slice(3);
        c.lv[kind]++;
        c.order.forEach((k, i) => { if (k === kind) { const s = cellSpot(i); float("⭐", s.x, s.y - 12, "#ffd93d"); } });
      } else if (what === "wall") {
        c.wallLevel++;
        b.wallMax += 50;
        b.wall = b.wallMax;
        tellBattle(t("🧱 Stronger wall!"));
      } else if (what === "fix") {
        b.wall = b.wallMax;
        tellBattle(t("🔧 Wall fixed!"));
      } else if (what === "soldier") {
        b.count++;
        tellBattle(t("🛒 You bought a soldier!") + " " + weapons[b.tier].emoji);
      } else if (what === "invest") {
        c.ideas += 8;
      }
      opts.sync();
      refresh();
    }

    function canBuild(what) {
      const b = g();
      if ((what === "house" || what === "lab" || what === "barracks") && c.order.length >= CELLS.length) return false;
      if (MAX_BUILD[what] !== undefined && c[what] >= MAX_BUILD[what]) return false;
      if (what === "tower") return towerCount() < TOWER_SLOTS;
      if (what === "towerUp") return towerCount() > 0 && c.towerLevel < towerTop();
      if (what === "towerFix") return c.towers.some((tw) => tw && tw.hp < tw.max);
      if (what.startsWith("up_")) { const kind = what.slice(3); return (kind === "house" ? c.houses : c[kind]) > 0 && c.lv[kind] < c.era; }
      if (what === "fix") return b.wall < b.wallMax;
      if (what === "soldier") return b.count < weapons[b.tier].max;
      if (what === "invest") { const r = research(); return !!r && c.ideas < r.ideas; }
      return true;
    }

    // ---------- The page ----------

    const cityBtn = el("button", "btn city-open");
    cityBtn.type = "button";
    cityBtn.setAttribute("aria-label", t("My city"));
    cityBtn.append(el("span", "", "🏘️"), el("b", "city-dot"));
    cityBtn.hidden = !on;
    opts.placeButton(cityBtn);
    // With a city the waves never end, so the "/12" next to the wave number goes away.
    const waveTail = document.getElementById("wave").nextSibling;
    if (on && waveTail && waveTail.nodeType === 3) waveTail.textContent = "";

    const view = el("div", "city");
    view.hidden = true;
    view.innerHTML = `
      <div class="city-in">
        <div class="city-top">
          <button class="btn city-back" type="button"></button>
          <h2></h2>
          <span class="city-era"></span>
        </div>
        <button class="city-alert" type="button" hidden></button>
        <div class="city-res"></div>
        <canvas class="city-map" width="${MW}" height="${MH}"></canvas>
        <div class="city-next"><span></span><div class="city-bar"><i></i></div></div>
        <div class="city-tabs" role="tablist"></div>
        <div class="city-panel"></div>
      </div>`;
    document.body.appendChild(view);
    const q = (s) => view.querySelector(s);
    const ui = {
      back: q(".city-back"), era: q(".city-era"), alert: q(".city-alert"), res: q(".city-res"),
      map: q(".city-map"), next: q(".city-next span"), nextBar: q(".city-next i"), tabs: q(".city-tabs"), panel: q(".city-panel"),
    };
    ui.back.textContent = t("⚔️ Battle");
    q("h2").textContent = t("🏘️ My city");
    // The map: drawn in 2D here, or in 3D by the game (city3d.js, see opts.map3d) while
    // opts.use3d() says so (in the 3D and FPS views). Each is set up the first time it shows.
    let ctx = null;   // the 2D map, or with a 3D map the layer of words drawn over it
    let map3d = null;
    const maps = { flat: null, deep: null, no3d: false };

    const resChips = {};
    [{ id: "people", emoji: "👥", name: t("People") }].concat(RES).forEach((r) => {
      const chip = el("span", "city-chip");
      chip.title = r.name;
      chip.setAttribute("aria-label", r.name);
      chip.append(r.id === "gold" ? coin() : el("span", "", r.emoji), el("b"));
      ui.res.appendChild(chip);
      resChips[r.id] = chip.querySelector("b");
    });

    // Three tabs: jobs, buildings, army.
    const TABS = [
      { id: "jobs", label: t("👷 Jobs") },
      { id: "build", label: t("🏗️ Build") },
      { id: "army", label: t("⚔️ Army") },
    ];
    let tab = "jobs";
    const tabBtns = TABS.map((tb) => {
      const btn = el("button", "btn", tb.label);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => { tab = tb.id; refresh(true); });
      ui.tabs.appendChild(btn);
      return { tb, btn };
    });

    // Gold is shown as a round coin with a $ on it (the 🪙 picture is hard to read).
    function coin() {
      const e = el("span", "city-coin", "$");
      e.setAttribute("aria-label", t("Gold"));
      return e;
    }
    function rich(elm, text) {
      if (elm.dataset.text === text) return;
      elm.dataset.text = text;
      elm.textContent = "";
      text.split("🪙").forEach((part, i) => {
        if (i) elm.appendChild(coin());
        if (part) elm.appendChild(document.createTextNode(part));
      });
    }

    function costText(cost) {
      return Object.keys(cost).map((k) => ICON[k] + " " + fmt(cost[k])).join("  ");
    }

    // A row: big emoji, a name and a line under it, and buttons on the right.
    function row(emoji, name) {
      const r = el("div", "city-row");
      const ic = el("span", "city-ic", emoji);
      const txt = el("div", "city-txt");
      const nm = el("b", "", name);
      const sub = el("small");
      txt.append(nm, sub);
      const act = el("div", "city-act");
      r.append(ic, txt, act);
      ui.panel.appendChild(r);
      return { r, ic, nm, sub, act };
    }

    function button(label, onClick, cls) {
      const btn = el("button", "btn " + (cls || ""), label);
      btn.type = "button";
      btn.addEventListener("click", onClick);
      return btn;
    }

    let rows = [];  // { update() } for the open tab

    function buildJobs() {
      const head = el("div", "city-idle");
      const headTxt = el("span");
      const share = button(t("👐 Give everyone a job"), shareOut, "go");
      head.append(headTxt, share);
      ui.panel.appendChild(head);
      rows.push({ update() {
        const n = idle();
        head.classList.toggle("on", n > 0);
        headTxt.textContent = n === 1 ? t("😴 1 free person: give them a job!")
          : n > 1 ? t("😴 {n} free people: give them a job!", { n }) : t("😊 Everybody has a job");
        share.hidden = n < 2;
      } });
      JOBS.forEach((j) => {
        const r = row(j.emoji, j.name);
        const minus = button("−", () => addJob(j, -1), "small");
        const count = el("b", "city-count");
        const plus = button("+", () => addJob(j, 1), "small go");
        minus.setAttribute("aria-label", t("One less {name}", { name: j.name }));
        plus.setAttribute("aria-label", t("One more {name}", { name: j.name }));
        r.act.append(minus, count, plus);
        rows.push({ update() {
          const locked = j.era && c.era < j.era;
          const noLab = j.lab && labRoom() === 0;
          r.r.classList.toggle("locked", !!(locked || noLab));
          if (locked) rich(r.sub, t("🔒 From the {name}", { name: ERAS[j.era].emoji + " " + ERAS[j.era].name }));
          else if (noLab) rich(r.sub, t("🔒 Build a lab first"));
          else {
            let s = t("makes {what}", { what: ICON[j.makes] + " " + fmt(j.rate * tools() * 10) / 10 + "/s" });
            if (j.lab) s += " · " + t("{n} in each lab", { n: PER_LAB });
            rich(r.sub, s);
          }
          count.textContent = c.jobs[j.id];
          minus.disabled = c.jobs[j.id] <= 0;
          plus.disabled = idle() <= 0 || !jobOpen(j);
        } });
      });
    }

    function buildRow(what, emoji, name, info, count) {
      const r = row(emoji, name);
      const btn = button("", () => build(what), "buy");
      r.act.appendChild(btn);
      rows.push({ update() {
        const can = canBuild(what);
        const cost = costs(what);
        rich(r.sub, info());
        r.nm.textContent = name + (count ? " " + count() : "");
        rich(btn, can ? costText(cost) : "—");
        btn.disabled = !can || !affords(cost);
        btn.setAttribute("aria-label", t("Build") + " " + name);
      } });
    }

    function buildBuild() {
      // "Level 2  ⬆️ what the next level gives", or a lock until the next age.
      const upInfo = (kind, next) => t("Level {n}", { n: c.lv[kind] + 1 }) + "  " + (c.lv[kind] < c.era ? "⬆️ " + next : t("🔒 Next age first"));
      buildRow("house", "🏠", t("House"), () => t("Room for {n} people", { n: houseCap(c.lv.house) }), () => "×" + c.houses);
      buildRow("up_house", "⬆️", t("Better houses"), () => upInfo("house", t("{n} people in each house", { n: houseCap(c.lv.house + 1) })));
      buildRow("lab", "🔬", t("Lab"), () => t("For {n} scientists, who find new weapons", { n: PER_LAB }), () => c.lab + "/" + MAX_BUILD.lab);
      buildRow("up_lab", "⬆️", t("Better labs"), () => upInfo("lab", t("ideas ×{n}", { n: labBoost() + 0.5 })));
      buildRow("barracks", "⛺", t("Barracks"), () => t("Trains soldiers for your army"), () => c.barracks + "/" + MAX_BUILD.barracks);
      buildRow("up_barracks", "⬆️", t("Better barracks"), () => upInfo("barracks", t("trains ×{n} faster", { n: Math.round((campBoost() + 0.3) * 10) / 10 })));
      buildRow("tower", "🗼", t("Tower"), () => t("Shoots at the enemy from your wall"), () => towerCount() + "/" + TOWER_SLOTS);
      buildRow("towerUp", "⬆️", t("Better towers"), () => {
        const w = weapons[towerTier()];
        let s = t("Towers shoot {name}", { name: w.emoji + " " + w.name });
        if (c.towerLevel >= towerTop()) s += "  " + t("🔒 Always one weapon behind your army");
        return s;
      });
      buildRow("towerFix", "🔧", t("Fix the towers"), () => {
        const max = c.towers.reduce((s, tw) => s + (tw ? tw.max : 0), 0);
        return max ? t("Towers: {n}%", { n: Math.ceil((100 * towerHp()) / max) }) : t("No tower yet");
      });
      buildRow("wall", "🧱", t("Stronger wall"), () => t("+50 wall, and fixes it"), () => "×" + c.wallLevel);
      buildRow("fix", "🔧", t("Fix the wall"), () => {
        const b = g();
        return t("Wall: {n}%", { n: Math.ceil((100 * b.wall) / b.wallMax) });
      });
    }

    function buildArmy() {
      const army = row("🪖", t("Your army"));
      rows.push({ update() {
        const b = g();
        const w = weapons[b.tier];
        army.ic.textContent = w.emoji;
        army.nm.textContent = w.name + " ×" + b.count;
        army.sub.textContent = b.count >= w.max ? t("Your army is full!") : t("Room for {n} more", { n: w.max - b.count });
      } });

      const camp = row("⛺", t("Barracks"));
      const campBar = el("div", "city-bar");
      campBar.appendChild(el("i"));
      camp.act.appendChild(campBar);
      rows.push({ update() {
        const b = g();
        const cost = costs("train");
        campBar.hidden = !c.barracks;
        campBar.firstChild.style.width = (100 * (1 - c.trainIn / TRAIN_EVERY)) + "%";
        if (!c.barracks) rich(camp.sub, t("Build barracks to train soldiers"));
        else if (b.count >= weapons[b.tier].max) rich(camp.sub, t("Your army is full!"));
        else rich(camp.sub, t("Next soldier for {cost}", { cost: costText(cost) }));
      } });

      const buy = row("🛒", t("Buy a soldier"));
      const buyBtn = button("", () => build("soldier"), "buy");
      buy.act.appendChild(buyBtn);
      rows.push({ update() {
        const can = canBuild("soldier");
        buy.sub.textContent = t("With gold from your traders");
        rich(buyBtn, can ? costText(costs("soldier")) : "—");
        buyBtn.disabled = !can || !affords(costs("soldier"));
      } });

      const lab = row("🔬", t("New weapon"));
      const labBar = el("div", "city-bar");
      labBar.appendChild(el("i"));
      lab.act.appendChild(labBar);
      rows.push({ update() {
        const r = research();
        labBar.hidden = !r;
        if (!r) { lab.nm.textContent = t("New weapon"); lab.sub.textContent = t("You have the best weapon!"); return; }
        lab.ic.textContent = r.w.emoji;
        lab.nm.textContent = t("Next: {name}", { name: r.w.name });
        labBar.firstChild.style.width = (100 * c.ideas) / r.ideas + "%";
        if (c.era < r.era) lab.sub.textContent = t("🔒 From the {name}", { name: ERAS[r.era].emoji + " " + ERAS[r.era].name });
        else if (!c.lab) lab.sub.textContent = t("Build a lab and give it scientists");
        else lab.sub.textContent = "💡 " + fmt(c.ideas) + "/" + r.ideas + "  ·  " + t("needs {cost}", { cost: costText({ iron: r.iron }) });
      } });

      const invest = row("💰", t("Pay the scientists"));
      const investBtn = button("", () => build("invest"), "buy");
      invest.act.appendChild(investBtn);
      rows.push({ update() {
        const can = canBuild("invest");
        invest.sub.textContent = t("Gold gives ideas: {cost}", { cost: "💡 +8" });
        rich(investBtn, costText(costs("invest")));
        investBtn.disabled = !can || !affords(costs("invest"));
      } });
    }

    let lastRefresh = 0;
    function refresh(rebuild) {
      if (!open || !c) return;
      if (rebuild) {
        ui.panel.textContent = "";
        rows = [];
        if (tab === "jobs") buildJobs(); else if (tab === "build") buildBuild(); else buildArmy();
        tabBtns.forEach(({ tb, btn }) => btn.setAttribute("aria-selected", String(tb.id === tab)));
      }
      const era = ERAS[c.era];
      ui.era.textContent = era.emoji + " " + era.name;
      resChips.people.textContent = c.people + "/" + room();
      RES.forEach((r) => { resChips[r.id].textContent = fmt(c[r.id]); });
      resChips.food.parentNode.classList.toggle("bad", c.hungry);
      const next = ERAS[c.era + 1];
      if (next) {
        ui.next.textContent = t("Next age: {name}", { name: next.emoji + " " + next.name }) + "  👥 " + c.people + "/" + next.pop;
        ui.nextBar.style.width = Math.min(100, (100 * (c.people - era.pop)) / (next.pop - era.pop)) + "%";
      } else {
        ui.next.textContent = t("🏆 You reached the last age!");
        ui.nextBar.style.width = "100%";
      }
      rows.forEach((r) => r.update());
      showAlert();
      lastRefresh = clock;
    }

    // The bar under the title: attacks first, then what to do next.
    function showAlert() {
      const st = opts.state();
      const b = g();
      let text = null, cls = "";
      if (st === "ready") { text = t("▶️ Start the battle to make your city grow!"); cls = "go"; }
      else if (st === "over") { text = t("😵 The battle is lost. Tap to try again"); cls = "bad"; }
      else if (st === "won") { text = t("🏆 You won the battle!"); cls = "go"; }
      else if (c.alert) { text = c.alert.text + "  " + t("⚔️ Defend!"); cls = c.alert.level >= 2 ? "bad blink" : "bad"; }
      else if (c.hungry) { text = t("😋 Your people are hungry! They work slower. More farmers!"); cls = "warn"; }
      else if (!b.enemies.length) { text = t("😌 Peace. Grow your city!"); cls = "calm"; }
      ui.alert.hidden = !text;
      if (text) {
        if (ui.alert.textContent !== text) ui.alert.textContent = text;
        ui.alert.className = "city-alert " + cls;
      }
      const dot = cityBtn.querySelector(".city-dot");
      const warn = st === "playing" && (b.enemies.length > 0);
      dot.textContent = warn ? "!" : idle() > 0 ? String(idle()) : "";
      dot.hidden = !dot.textContent;
      dot.classList.toggle("bad", warn);
    }

    // ---------- The map ----------

    // Town squares inside the wall, nearest to the middle first. The middle is the town hall.
    const CELLS = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        if (row === 2 && (col === 2 || col === 3)) continue;
        CELLS.push({ x: 140 + col * 44, y: 40 + row * 46 });
      }
    }
    CELLS.sort((a, b) => Math.hypot(a.x - 250, (a.y - 132) * 1.2) - Math.hypot(b.x - 250, (b.y - 132) * 1.2));
    const HALL = { x: 250, y: 132 };

    function cellSpot(i) { return CELLS[Math.min(i, CELLS.length - 1)]; }
    function houseSpot(n) {
      let k = -1;
      for (let i = 0; i < c.order.length; i++) if (c.order[i] === "house" && ++k === n) return cellSpot(i);
      return cellSpot(0);
    }
    function buildingSpot(kind, n) {
      let k = -1;
      for (let i = 0; i < c.order.length; i++) if (c.order[i] === kind && ++k === n) return cellSpot(i);
      return HALL;
    }

    // Where each job works.
    const FIELDS = [];
    for (let i = 0; i < 10; i++) FIELDS.push({ x: 12 + (i % 2) * 42, y: 104 + Math.floor(i / 2) * 38 });
    const MINE = { x: 46, y: 64 }, KILN = { x: 432, y: 58 }, PASTURE = { x: 440, y: 196 };
    // The main gate leads down to the road, where traders go and enemies come from. The
    // fields and the mine have their own gate on the left of the wall, the pasture and the
    // brick yard one on the right.
    const WGATE = { x: 112, y: 120 }, EGATE = { x: 388, y: 120 };
    const WLANE = { x: 98, y: WGATE.y }, ELANE = { x: 396, y: EGATE.y };
    const PATH_LINES = [
      [{ x: GATE.x, y: 150 }, GATE, { x: GATE.x, y: ROAD }],
      [{ x: WGATE.x + 18, y: WGATE.y }, WLANE],
      [{ x: MINE.x + 10, y: 76 }, { x: WLANE.x, y: 76 }, { x: WLANE.x, y: FIELDS[FIELDS.length - 1].y + 16 }],
      [{ x: EGATE.x - 18, y: EGATE.y }, ELANE],
      [{ x: KILN.x - 8, y: 80 }, { x: ELANE.x, y: 80 }, { x: ELANE.x, y: PASTURE.y + 64 }],
    ];
    function workPath(job, work) {
      switch (job) {
        case "farmer": return [WGATE, WLANE, { x: WLANE.x, y: work.y }, work];
        case "miner": return [WGATE, WLANE, { x: WLANE.x, y: 76 }, work];
        case "herder": return [EGATE, ELANE, { x: ELANE.x, y: work.y }, work];
        case "builder": return [EGATE, ELANE, { x: ELANE.x, y: 80 }, work];
        case "trader": return [GATE, { x: GATE.x, y: ROAD }, work];
      }
      return [work];
    }
    function workSpot(job, i) {
      switch (job) {
        case "farmer": { const f = FIELDS[i % FIELDS.length]; return { x: f.x + 18, y: f.y + 16 }; }
        case "herder": return { x: PASTURE.x - 24 + (i % 4) * 16, y: PASTURE.y - 56 + Math.floor(i / 4) % 6 * 22 };
        case "miner": return { x: MINE.x + (i % 3) * 8 - 8, y: MINE.y + 6 };
        case "builder": return { x: KILN.x - 16 + (i % 3) * 14, y: KILN.y + 18 };
        case "trader": return { x: MW + 20, y: ROAD };
        case "scientist": { const s = buildingSpot("lab", Math.floor(i / PER_LAB)); return { x: s.x, y: s.y + 14 }; }
      }
      return { x: HALL.x + Math.cos(i * 2.4) * 34, y: HALL.y + 26 + Math.sin(i * 2.4) * 10 };
    }

    // Everyone in a list: who they are, where they live and where they work.
    function crew() {
      const list = [];
      JOBS.forEach((j) => { for (let i = 0; i < c.jobs[j.id]; i++) list.push({ job: j.id, color: j.color, i }); });
      for (let i = 0; i < idle(); i++) list.push({ job: "idle", color: "#ffffff", i });
      return list;
    }

    function lerpPath(pts, f) {
      const lens = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); lens.push(l); total += l; }
      let d = f * total;
      for (let i = 1; i < pts.length; i++) {
        if (d <= lens[i - 1] || i === pts.length - 1) {
          const k = lens[i - 1] ? Math.min(1, d / lens[i - 1]) : 1;
          return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
        }
        d -= lens[i - 1];
      }
      return pts[pts.length - 1];
    }

    function emoji(text, x, y, size) {
      ctx.font = size + "px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000"; // a see-through colour would fade the picture too
      ctx.fillText(text, x, y);
    }

    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // A house in the style of the age, seen from the front.
    function drawHouse(x, y, style) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath(); ctx.ellipse(0, 16, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      const box = (w, h, color) => { ctx.fillStyle = color; ctx.fillRect(-w / 2, 16 - h, w, h); };
      const roof = (w, h, base, color) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(-w / 2, base); ctx.lineTo(0, base - h); ctx.lineTo(w / 2, base); ctx.closePath(); ctx.fill();
      };
      const door = (color) => { ctx.fillStyle = color; ctx.fillRect(-3, 6, 6, 10); };
      const smoke = (sx, sy) => {
        ctx.fillStyle = "rgba(200,200,200,0.7)";
        ctx.beginPath(); ctx.arc(sx + Math.sin(clock * 2 + x) * 2, sy - ((clock * 8 + x) % 10), 3, 0, Math.PI * 2); ctx.fill();
      };
      switch (style) {
        case 0: // straw hut
          ctx.fillStyle = "#8b5a2b"; ctx.beginPath(); ctx.ellipse(0, 10, 15, 8, 0, Math.PI, 0); ctx.fill();
          roof(32, 26, 12, "#e9c46a");
          ctx.fillStyle = "#3d2b1f"; ctx.beginPath(); ctx.ellipse(0, 12, 4, 5, 0, Math.PI, 0); ctx.fill();
          break;
        case 1: // mud house with a flat roof
          box(28, 20, "#ddb892"); ctx.fillStyle = "#b08968"; ctx.fillRect(-15, -6, 30, 4); door("#7f5539");
          break;
        case 2: // white walls, red tiles
          box(28, 16, "#f8f9fa"); roof(34, 14, 1, "#e76f51"); door("#9c6644");
          ctx.fillStyle = "#adb5bd"; ctx.fillRect(-12, 2, 2, 14); ctx.fillRect(10, 2, 2, 14);
          break;
        case 3: // red walls and a curved roof
          box(24, 14, "#c1121f");
          ctx.fillStyle = "#2d6a4f";
          ctx.beginPath(); ctx.moveTo(-19, -2); ctx.quadraticCurveTo(-10, 2, -8, -10); ctx.lineTo(8, -10); ctx.quadraticCurveTo(10, 2, 19, -2);
          ctx.lineTo(14, 2); ctx.lineTo(-14, 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#ffd93d"; ctx.fillRect(-2, -14, 4, 4);
          door("#6a040f");
          break;
        case 4: // long wooden house with grass on the roof
          box(32, 12, "#8b5a2b"); roof(38, 18, 4, "#588157");
          ctx.strokeStyle = "#6f4518"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(0, -12); ctx.lineTo(6, -16); ctx.stroke();
          door("#3d2b1f");
          break;
        case 5: // timber house
          box(26, 18, "#f1e3c8"); ctx.fillStyle = "#6f4518"; ctx.fillRect(-13, 4, 26, 2); ctx.fillRect(-1, -2, 2, 6);
          roof(32, 18, -1, "#7f4f24"); door("#6f4518");
          break;
        case 6: // stone house with a blue roof
          box(28, 18, "#e9ecef"); roof(34, 16, -1, "#457b9d"); door("#1d3557");
          ctx.fillStyle = "#a8dadc"; ctx.fillRect(-11, 2, 5, 5); ctx.fillRect(6, 2, 5, 5);
          break;
        case 7: // brick house with a smoking chimney
          box(28, 18, "#bc4749"); roof(32, 14, -1, "#495057"); ctx.fillStyle = "#495057"; ctx.fillRect(7, -14, 5, 10);
          door("#3d2b1f"); smoke(10, -18);
          break;
        case 8: // tall town house
          box(24, 30, "#f4d58d"); ctx.fillStyle = "#6d597a"; ctx.fillRect(-14, -16, 28, 4);
          ctx.fillStyle = "#8ecae6";
          for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) ctx.fillRect(-9 + k * 12, -9 + r * 9, 6, 6);
          door("#6d597a");
          break;
        case 9: // block of flats
          box(26, 34, "#adb5bd");
          ctx.fillStyle = "#e3f2fd";
          for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) ctx.fillRect(-10 + k * 7, -15 + r * 7, 5, 4);
          break;
        case 10: // dome
          ctx.fillStyle = "#f8f9fa"; ctx.beginPath(); ctx.ellipse(0, 16, 16, 20, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = "#4d96ff"; ctx.beginPath(); ctx.ellipse(0, 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 11: // glass tower
          rr(-11, -22, 22, 38, 3); ctx.fillStyle = "#90e0ef"; ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(-8, -19, 4, 32);
          ctx.fillStyle = "#0077b6"; ctx.fillRect(-11, -26, 22, 4);
          break;
        default: { // dark tower with glowing lines
          rr(-11, -24, 22, 40, 4); ctx.fillStyle = "#1b263b"; ctx.fill();
          const glow = 0.5 + 0.5 * Math.sin(clock * 3 + x);
          ctx.fillStyle = "rgba(0,220,255," + (0.5 + glow * 0.5) + ")";
          for (let r = 0; r < 5; r++) ctx.fillRect(-8, -20 + r * 8, 16, 2);
        }
      }
      ctx.restore();
    }

    // A landmark: the pyramid is drawn, every other one is a picture.
    function drawMark(e, x, y, size) {
      if (e.mark === "pyramid") {
        const w = size * 0.8, h = size;
        ctx.fillStyle = "#e9c46a";
        ctx.beginPath(); ctx.moveTo(x - w, y + h / 2); ctx.lineTo(x, y - h / 2); ctx.lineTo(x + w, y + h / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#d4a373";
        ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w * 0.25, y + h / 2); ctx.closePath(); ctx.fill();
      } else {
        emoji(e.mark, x, y, size);
      }
    }

    // A lab or barracks, with a star for every upgrade.
    function drawSpecial(kind, x, y, level) {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      if (kind === "lab") {
        rr(x - 15, y - 6, 30, 22, 4); ctx.fillStyle = level >= 13 ? "#e3f2fd" : "#f1faee"; ctx.fill();
        ctx.fillStyle = "#9b5de5"; ctx.fillRect(x - 15, y - 9, 30, 5);
        emoji("🔬", x, y + 4, 16);
      } else {
        ctx.fillStyle = "#606c38";
        ctx.beginPath(); ctx.moveTo(x - 17, y + 16); ctx.lineTo(x, y - 8); ctx.lineTo(x + 17, y + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#283618"; ctx.beginPath(); ctx.moveTo(x - 4, y + 16); ctx.lineTo(x, y + 4); ctx.lineTo(x + 4, y + 16); ctx.fill();
        ctx.strokeStyle = "#3d2b1f"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 20); ctx.stroke();
        ctx.fillStyle = "#ff6b6b"; ctx.fillRect(x, y - 20, 9 + Math.sin(clock * 6) * 1.5, 6);
      }
      if (level > 0) {
        rr(x + 6, y + 6, 18, 12, 6); ctx.fillStyle = "#ffd93d"; ctx.fill();
        ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#2b2d42";
        ctx.fillText("★" + level, x + 15, y + 12.5);
      }
    }

    // The middle of the town: the landmark of your age, with a little bounce when it is new.
    function drawHall(era) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath(); ctx.ellipse(HALL.x, HALL.y + 18, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
      const pop = c.newAge > 0 ? 1 + Math.sin(c.newAge * 12) * 0.15 * c.newAge : 1;
      drawMark(ERAS[era], HALL.x, HALL.y, 44 * pop);
      if (era === 0) emoji("🔥", HALL.x + 30, HALL.y + 12 + Math.sin(clock * 10), 16);
    }

    // Everyone looks different: skin, hair, clothes, a dress or trousers, sometimes a hat.
    const SKINS = ["#ffe0c4", "#f6c99f", "#e8b07f", "#c98b55", "#a2673a", "#7a4a26", "#5a361c"];
    const HAIRS = ["#2b1b12", "#3d2614", "#6b4423", "#1c1c1c", "#e8c26a", "#b5562d", "#9a9a9a"];
    const CLOTHES = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5", "#ffb4d0", "#3a86ff", "#06d6a0", "#ffd166", "#8d6e63", "#ef476f", "#118ab2"];
    const LEGS = ["#2b2d42", "#4a4e69", "#6d597a", "#5c4033", "#1d3557", "#3c6e71"];
    function lookOf(n) {
      const r = (k) => { const v = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const pick = (list, k) => list[Math.floor(r(k) * list.length)];
      const woman = r(1) < 0.5;
      const skin = Math.floor(r(2) * SKINS.length);
      // Fair hair and red hair mostly on lighter skin, dark hair on everyone.
      const hair = skin < 3 && r(3) < 0.45 ? pick(HAIRS.slice(4, 6), 4) : r(3) > 0.93 ? HAIRS[6] : pick(HAIRS.slice(0, 4), 4);
      return {
        woman, skin: SKINS[skin], hair, shirt: pick(CLOTHES, 5), legs: pick(LEGS, 6),
        dress: woman && r(7) < 0.55, hairStyle: Math.floor(r(8) * 3), hat: r(9) < 0.2 ? pick(CLOTHES, 10) : null,
      };
    }

    // What each worker carries: a drawn tool, or a little picture.
    const TOOLS = { builder: "🔨", miner: "⛏️", trader: "💰", scientist: "🧪" };
    function drawTool(job, x, y, swing) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(swing);
      if (job === "farmer" || job === "herder") {
        ctx.strokeStyle = "#8d5a2b"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -12); ctx.stroke();
        ctx.strokeStyle = job === "farmer" ? "#9aa0a6" : "#8d5a2b";
        ctx.beginPath();
        if (job === "farmer") { // a pitchfork
          ctx.moveTo(-3, -12); ctx.lineTo(3, -12);
          [-3, 0, 3].forEach((dx) => { ctx.moveTo(dx, -12); ctx.lineTo(dx, -17); });
        } else { // a shepherd's crook
          ctx.moveTo(0, -12); ctx.arc(3, -12, 3, Math.PI, 0); ctx.lineTo(6, -10);
        }
        ctx.stroke();
      } else if (TOOLS[job]) emoji(TOOLS[job], 0, -4, 11);
      ctx.restore();
    }

    function drawPerson(x, y, look, job, bounce, walk, working) {
      const yb = y - bounce;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.ellipse(x, y + 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2b2d42"; ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
      // Legs, swinging as they walk.
      const step = Math.sin(walk) * 2.5;
      ctx.strokeStyle = look.dress ? look.skin : look.legs; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x - 1.6, yb - 7); ctx.lineTo(x - 1.6 + step, y);
      ctx.moveTo(x + 1.6, yb - 7); ctx.lineTo(x + 1.6 - step, y); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = "#2b2d42";
      // Body: a dress, or a shirt.
      ctx.fillStyle = look.shirt;
      ctx.beginPath();
      if (look.dress) { ctx.moveTo(x - 3.5, yb - 15); ctx.lineTo(x + 3.5, yb - 15); ctx.lineTo(x + 6, yb - 5); ctx.lineTo(x - 6, yb - 5); }
      else { rr(x - 4.5, yb - 15, 9, 9, 2.5); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Arms: the one with the tool swings while they work.
      const swing = working ? Math.sin(clock * 7 + x) * 0.6 : Math.sin(walk) * 0.2;
      ctx.strokeStyle = look.shirt; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x - 4, yb - 13); ctx.lineTo(x - 6 - step * 0.4, yb - 7); ctx.stroke();
      const hx = x + 6 + Math.sin(swing) * 2, hy = yb - 8 - Math.cos(swing) * 1.5;
      ctx.beginPath(); ctx.moveTo(x + 4, yb - 13); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = "#2b2d42";
      // Head and hair.
      const hy0 = yb - 19.5;
      if (look.woman && look.hairStyle !== 2) { // long hair behind the head
        ctx.fillStyle = look.hair;
        ctx.beginPath(); rr(x - 4.6, hy0 - 2, 9.2, look.hairStyle ? 8 : 10, 3); ctx.fill();
      }
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.arc(x, hy0, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = look.hair;
      if (look.hat) {
        ctx.fillStyle = look.hat;
        ctx.beginPath(); ctx.ellipse(x, hy0 - 3, 6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, hy0 - 3, 3.6, Math.PI, 0); ctx.fill();
      } else if (!look.woman && look.hairStyle === 2) { // short curls
        ctx.beginPath(); ctx.arc(x, hy0 - 1, 4.4, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, hy0 - 0.8, 4.4, Math.PI, 0); ctx.fill();
        if (look.woman && look.hairStyle === 2) { ctx.beginPath(); ctx.arc(x, hy0 - 5, 2.4, 0, Math.PI * 2); ctx.fill(); } // a bun
      }
      ctx.fillStyle = "#2b2d42";
      ctx.fillRect(x - 1.9, hy0, 1.1, 1.3); ctx.fillRect(x + 0.8, hy0, 1.1, 1.3);
      if (job === "idle") {
        ctx.fillStyle = "#2b2d42"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText("?", x, y - 27 - Math.abs(Math.sin(clock * 4 + x)) * 3);
      } else drawTool(job, hx, hy, swing);
    }

    // Where the towers stand on the town wall (the same ones that shoot in the battle).
    const TOWERS = [[112, 12], [388, 12], [112, GATE.y], [388, GATE.y]];
    // The enemy marches along the road from the right, turns up to the gate, and once the
    // wall is broken comes inside. How far it is in the battle is how far it is here.
    const ENEMY_ROAD = [{ x: MW + 24, y: ROAD }, { x: GATE.x, y: ROAD }, { x: GATE.x, y: GATE.y + 14 }];
    const ENEMY_IN = [{ x: GATE.x, y: GATE.y + 14 }, { x: GATE.x, y: 210 }];
    const ENEMY_SIZE = { thrower: 7, soldier: 7, cannon: 8, boss: 11, bigboss: 13, tank: 9, bigtank: 12, tankboss: 14, king: 17 };

    function enemySpot(e, b) {
      const W = opts.W, wy = opts.wallY;
      const side = (e.x / W - 0.5) * 18;
      let pos;
      if (e.y > wy) pos = lerpPath(ENEMY_IN, Math.min(1, (e.y - wy) / 40));
      else pos = lerpPath(ENEMY_ROAD, e.atWall ? 1 : Math.max(0, Math.min(0.98, (e.y + 60) / (wy + 40))));
      return pos.y >= ROAD - 1 ? { x: pos.x, y: pos.y + side * 0.5 } : { x: pos.x + side, y: pos.y };
    }

    // The enemies on the map, back to front.
    function enemiesNow() {
      const b = g();
      if (opts.state() !== "playing") return [];
      const list = b.enemies.map((e) => ({ e, p: enemySpot(e, b), r: ENEMY_SIZE[e.type] || 6 }));
      list.sort((a, b2) => a.p.y - b2.p.y);
      return list;
    }

    // Which towers are shooting right now, and at whom (the nearest enemy).
    function towerShots(list) {
      const out = [];
      if (!list.length) return out;
      TOWERS.forEach(([x, y], i) => {
        if (!c.towers[i] || (clock * 2 + i * 0.3) % 1 > 0.2) return;
        let best = list[0];
        list.forEach((o) => { if (Math.hypot(o.p.x - x, o.p.y - y) < Math.hypot(best.p.x - x, best.p.y - y)) best = o; });
        if (Math.hypot(best.p.x - x, best.p.y - y) > 170) return; // too far for this tower
        out.push({ slot: i, x, y, to: best });
      });
      return out;
    }

    // The enemy on the map is the same army as in the battle: squads of soldiers dressed for
    // their age, tanks and giants (pictures of the 3D models, see sprites2d.js), only smaller.
    let sprites;
    function enemySet(type, wave) {
      if (sprites === undefined) sprites = window.ArmySprites ? window.ArmySprites() : null;
      const T = opts.enemies && opts.enemies[type];
      return sprites && T ? { set: sprites.enemy(type, T, wave || 0), T } : null;
    }
    // One enemy unit at (x, y) (the spot under its feet), r big on the map.
    function drawFoe(type, wave, x, y, r, seed, marching) {
      const s = enemySet(type, wave);
      if (s) {
        const walk = s.set.walk;
        const pic = marching ? walk[Math.floor((clock + seed) * 9 / (2 * Math.PI) * walk.length) % walk.length] : walk[0];
        const k = (r / s.T.r) * 1.6;
        ctx.drawImage(pic.img, x - pic.x * k, y - pic.y * k, pic.w * k, pic.h * k);
        return;
      }
      // No 3D on this device: little soldiers or a tank in plain shapes.
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      if (/tank|king/.test(type)) {
        ctx.fillStyle = "#2f3330"; rr(x - r * 1.2, y - r * 0.9, r * 2.4, r * 0.9, 2); ctx.fill();
        ctx.fillStyle = "#4e534f"; rr(x - r * 0.5, y - r * 1.4, r, r * 0.6, 2); ctx.fill();
        ctx.fillStyle = "#1b1b1b"; ctx.fillRect(x - r * 1.5, y - r * 1.2, r, 2);
        return;
      }
      const men = /boss/.test(type) ? [[0, 0]] : [[-0.5, -0.2], [0.5, -0.2], [0, 0.25]];
      const h = /boss/.test(type) ? r * 2 : r * 1.2;
      men.forEach(([dx, dy]) => {
        const mx = x + dx * r, my = y + dy * r;
        const step = marching ? Math.sin(clock * 9 + seed + dx * 3) * h * 0.08 : 0;
        ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = Math.max(1.2, h * 0.12);
        ctx.beginPath(); ctx.moveTo(mx - step, my); ctx.lineTo(mx, my - h * 0.45); ctx.lineTo(mx + step, my); ctx.stroke();
        ctx.fillStyle = "#5a2a27"; rr(mx - h * 0.16, my - h * 0.85, h * 0.32, h * 0.45, 1); ctx.fill();
        ctx.fillStyle = "#c69c7b"; ctx.beginPath(); ctx.arc(mx, my - h * 0.92, h * 0.11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3a3a3a"; ctx.beginPath(); ctx.arc(mx, my - h * 0.96, h * 0.13, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = "#6b5236"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx + h * 0.2, my - h * 0.2); ctx.lineTo(mx + h * 0.2, my - h * 1.15); ctx.stroke();
      });
    }

    function drawEnemies() {
      const list = enemiesNow();
      list.forEach(({ e, p, r }) => {
        drawFoe(e.type, e.wave, p.x, p.y + r * 0.6, r, e.seed, true);
        if (e.atWall && Math.floor(clock * 6 + e.seed) % 3 === 0) emoji("💥", p.x, p.y - r - 6, 12);
      });
      // Tower shots at the nearest enemy.
      towerShots(list).forEach(({ x, y, to }) => {
        ctx.strokeStyle = "#ffd93d"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(to.p.x, to.p.y); ctx.stroke();
      });
    }

    // When the battle is lost, the enemy plants its war banner in the middle of the town,
    // and its soldiers stand guard around it.
    function drawEnemyFlag() {
      const x = HALL.x + 34, base = HALL.y + 40, top = base - 120;
      const wave = g().wave || 0;
      // The guards behind the pole first, then the pole, then the ones in front.
      const guards = [0, 1, 2, 3, 4].map((k) => {
        const a = Math.PI * (0.15 + k * 0.175) + Math.PI;
        return { k, x: x + Math.cos(a) * 46, y: base + 8 + Math.sin(a) * -14, type: k === 2 ? "boss" : "soldier" };
      });
      const guard = (o) => drawFoe(o.type, wave, o.x, o.y, o.type === "boss" ? 11 : 7, o.k, false);
      guards.filter((o) => o.y < base).forEach(guard);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(x, base, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3b2f2a"; rr(x - 2.5, top, 5, base - top, 2); ctx.fill();
      ctx.fillStyle = "#8a6a35"; ctx.beginPath(); ctx.moveTo(x, top - 10); ctx.lineTo(x - 4, top + 2); ctx.lineTo(x + 4, top + 2); ctx.fill();
      // The cloth waves in the wind: dark red with a black border and two crossed swords.
      const fw = 92, fh = 60, wave2 = (u) => Math.sin(clock * 5 - u * 5) * 6 * u;
      const cloth = (y0, y1, inset, color) => {
        ctx.beginPath(); ctx.moveTo(x + 2 + inset, top + 4 + y0);
        for (let u = 0; u <= 1.001; u += 0.1) ctx.lineTo(x + 2 + inset + u * (fw - inset * 2), top + 4 + y0 + wave2(u));
        for (let u = 1; u >= -0.001; u -= 0.1) ctx.lineTo(x + 2 + inset + u * (fw - inset * 2), top + 4 + y1 + wave2(u));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      };
      cloth(0, fh, 0, "#1a1414");
      cloth(4, fh - 4, 4, "#7a1414");
      const fx = x + 2 + fw * 0.5, fy = top + 4 + fh / 2 + wave2(0.5);
      ctx.lineCap = "round";
      [-1, 1].forEach((k) => {
        ctx.strokeStyle = "#d9d4c7"; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(fx - 16 * k, fy + 16); ctx.lineTo(fx + 14 * k, fy - 16); ctx.stroke();
        ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fx - 20 * k, fy + 10); ctx.lineTo(fx - 8 * k, fy + 22); ctx.stroke();
      });
      ctx.lineCap = "butt";
      guards.filter((o) => o.y >= base).forEach(guard);
    }

    // How the defence is doing, in a little box at the top of the map.
    function drawDefence() {
      const b = g();
      const health = Math.max(0, b.wall / b.wallMax);
      const bx = 162, by = 1, bw = 156, bh = 22;
      rr(bx, by, bw, bh, 8); ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; ctx.fill();
      emoji(b.wall > 0 ? "🧱" : "💥", bx + 12, by + 11, 13);
      rr(bx + 24, by + 7, 54, 9, 4); ctx.fillStyle = "#2b2d42"; ctx.fill();
      if (health > 0) {
        rr(bx + 25, by + 8, 52 * health, 7, 3);
        ctx.fillStyle = health > 0.5 ? "#6bcb77" : health > 0.25 ? "#ffd93d" : "#ff6b6b"; ctx.fill();
      }
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#2b2d42";
      ctx.fillText(Math.ceil(health * 100) + "%", bx + 82, by + 12);
      emoji("🗼", bx + 116, by + 11, 12);
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#2b2d42";
      ctx.fillText(String(towerCount()), bx + 124, by + 12);
      ctx.globalAlpha = b.shield > 0 ? 1 : 0.25;
      emoji("🛡️", bx + 143, by + 11, 12);
      ctx.globalAlpha = 1;
    }

    function drawMap() {
      const era = c.era;
      const E = ERAS[era];
      ctx.fillStyle = E.ground;
      ctx.fillRect(0, 0, MW, MH);
      if (era === LAST) {
        ctx.strokeStyle = "rgba(0,220,255,0.15)"; ctx.lineWidth = 1;
        for (let x = 0; x < MW; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MH); ctx.stroke(); }
        for (let y = 0; y < MH; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MW, y); ctx.stroke(); }
      }

      // The road of history along the bottom, and the way down to it from the gate.
      const paved = era >= 13; // cars
      ctx.fillStyle = paved ? "#495057" : "#d4a373";
      ctx.fillRect(0, ROAD - 9, MW, 18);
      ctx.strokeStyle = paved ? "#6c757d" : "#ddb892";
      ctx.lineWidth = 10; ctx.lineJoin = "round"; ctx.lineCap = "round";
      PATH_LINES.forEach((line) => {
        ctx.beginPath();
        line.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();
      });
      ctx.lineWidth = 6; // little paths into each field
      for (let i = 0; i < FIELDS.length; i += 2) {
        const y = FIELDS[i + 1].y + 16;
        ctx.beginPath(); ctx.moveTo(98, y); ctx.lineTo(FIELDS[i + 1].x + 30, y); ctx.stroke();
      }
      if (paved) {
        ctx.fillStyle = "#f8f9fa";
        for (let x = (-clock * 10) % 24; x < MW; x += 24) ctx.fillRect(x, ROAD - 1, 12, 2);
      } else if (era >= 11) {
        ctx.fillStyle = "#6f4518"; // rails for the trains
        for (let x = 0; x < MW; x += 10) ctx.fillRect(x, ROAD - 6, 4, 12);
      }
      // A landmark from every age you went through, in a line beside the road.
      for (let i = 0; i <= era; i++) {
        const x = i < 10 ? 14 + i * 21 : 272 + (i - 10) * 21;
        drawMark(ERAS[i], x, ROAD - 26, 18);
      }
      // What drives along the road in this age.
      for (let k = 0; E.ride && k < 2; k++) {
        const x = MW + 40 - ((clock * 34 + k * 260) % (MW + 120));
        emoji(E.ride, x, ROAD - 2, E.ride.length > 3 ? 16 : 20);
      }

      // Trees.
      [[160, 300], [322, 300], [10, 96], [470, 292], [130, 296], [366, 296]].forEach(([x, y], i) => {
        emoji(E.tree || "🌳", x, y + Math.sin(clock + i) * 0.6, 15);
      });

      // Mine in the mountain.
      ctx.fillStyle = "#8d99ae";
      ctx.beginPath(); ctx.moveTo(-6, 86); ctx.lineTo(30, 6); ctx.lineTo(58, 50); ctx.lineTo(76, 22); ctx.lineTo(100, 86); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#edf2f4";
      ctx.beginPath(); ctx.moveTo(22, 24); ctx.lineTo(30, 6); ctx.lineTo(38, 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2b2d42";
      ctx.beginPath(); ctx.ellipse(MINE.x, MINE.y + 12, 12, 12, 0, Math.PI, 0); ctx.fill();
      if (c.jobs.miner) emoji("✨", MINE.x + 16, MINE.y - 6 + Math.sin(clock * 5) * 3, 12);

      // Fields: one for each farmer (an empty patch when nobody farms).
      const fields = Math.max(1, Math.min(FIELDS.length, c.jobs.farmer));
      for (let i = 0; i < fields; i++) {
        const f = FIELDS[i];
        ctx.fillStyle = c.jobs.farmer ? "#bc6c25" : "#a98467";
        rr(f.x, f.y, 36, 30, 4); ctx.fill();
        if (!c.jobs.farmer) continue;
        ctx.fillStyle = (Math.floor(clock / 4) + i) % 3 === 0 ? "#ffd93d" : "#70e000";
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
          ctx.beginPath(); ctx.arc(f.x + 6 + k * 8, f.y + 5 + r * 7, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Brick yard and its oven.
      ctx.fillStyle = "#c1121f";
      for (let i = 0; i < Math.min(6, Math.ceil(c.bricks / 10)); i++) ctx.fillRect(402 + (i % 3) * 12, 80 - Math.floor(i / 3) * 6, 10, 5);
      ctx.fillStyle = "#9c6644";
      ctx.beginPath(); ctx.ellipse(KILN.x + 16, KILN.y, 18, 22, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = c.jobs.builder ? "#ff9f1c" : "#3d2b1f";
      ctx.beginPath(); ctx.ellipse(KILN.x + 16, KILN.y, 7, 8, 0, Math.PI, 0); ctx.fill();
      if (c.jobs.builder) {
        ctx.fillStyle = "rgba(220,220,220,0.7)";
        for (let i = 0; i < 3; i++) {
          const k = (clock * 0.6 + i / 3) % 1;
          ctx.beginPath(); ctx.arc(KILN.x + 16 + Math.sin(k * 6) * 4, KILN.y - 22 - k * 30, 3 + k * 5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Pasture: fence and cows.
      ctx.strokeStyle = "#7f5539"; ctx.lineWidth = 2;
      ctx.strokeRect(PASTURE.x - 36, PASTURE.y - 76, 72, 152);
      if (era >= 1) {
        const cows = Math.min(8, c.jobs.herder * 2);
        for (let i = 0; i < cows; i++) {
          const x = PASTURE.x - 18 + (i % 2) * 34 + Math.sin(clock * 0.5 + i) * 5;
          const y = PASTURE.y - 52 + Math.floor(i / 2) * 36;
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#2b2d42"; ctx.beginPath(); ctx.arc(x - 3, y - 1, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffafcc"; ctx.beginPath(); ctx.arc(x + 10, y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        emoji("🔒", PASTURE.x, PASTURE.y, 18);
      }

      // The town wall is the battle wall: thicker for every stronger wall, cracked when it is
      // hurt, and only rubble once it is broken. Towers stand at the corners.
      const b = g();
      const health = Math.max(0, b.wall / b.wallMax);
      const thick = 4 + Math.min(8, c.wallLevel * 2);
      const wallLine = () => {
        ctx.beginPath();
        ctx.moveTo(GATE.x - 14, GATE.y); ctx.lineTo(112, GATE.y); ctx.lineTo(112, WGATE.y + 9);
        ctx.moveTo(112, WGATE.y - 9); ctx.lineTo(112, 12); ctx.lineTo(388, 12); ctx.lineTo(388, EGATE.y - 9);
        ctx.moveTo(388, EGATE.y + 9); ctx.lineTo(388, GATE.y); ctx.lineTo(GATE.x + 14, GATE.y);
      };
      ctx.lineCap = "butt";
      if (b.wall <= 0) {
        ctx.strokeStyle = "#a47148"; ctx.lineWidth = 5; ctx.setLineDash([3, 9]);
        wallLine(); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = E.wall; ctx.lineWidth = thick;
        if (era === LAST) { ctx.shadowColor = "#00dcff"; ctx.shadowBlur = 10; }
        wallLine(); ctx.stroke();
        ctx.shadowBlur = 0;
        if (health < 0.7) { // red when it is badly hurt, and cracks
          ctx.strokeStyle = "rgba(230, 57, 70, " + (0.7 - health) + ")";
          wallLine(); ctx.stroke();
        }
        ctx.strokeStyle = "#2b2d42"; ctx.lineWidth = 2;
        const cracks = Math.floor((1 - health) * 10);
        for (let i = 0; i < cracks; i++) {
          const k = (i * 0.37) % 1;
          const [x, y] = k < 0.5 ? [112 + k * 2 * 276, 12] : [112 + (k - 0.5) * 2 * 276, GATE.y];
          ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x + 2, y); ctx.lineTo(x - 2, y + 4); ctx.stroke();
        }
      }
      // The shield covers the whole town while it lasts (it blinks just before it ends).
      if (b.shield > 0 && !(b.shield < 2 && Math.floor(clock * 8) % 2)) {
        rr(102, 2, 296, GATE.y + 10, 18);
        ctx.fillStyle = "rgba(144, 224, 239, 0.22)"; ctx.fill();
        ctx.strokeStyle = "#4d96ff"; ctx.lineWidth = 3; ctx.stroke();
      }
      // Towers, each with its own life bar; a fallen one is a heap of stones until you build it again.
      const w = weapons[towerTier()];
      TOWERS.forEach(([x, y], i) => {
        const tw = c.towers[i];
        if (tw === null) { emoji("🪨", x - 5, y + 2, 10); emoji("🪨", x + 5, y - 1, 9); return; }
        if (!tw) return;
        ctx.fillStyle = "#6c757d"; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        emoji(w.emoji, x, y, 11);
        const r = Math.max(0, tw.hp / tw.max);
        rr(x - 13, y + 13, 26, 6, 3); ctx.fillStyle = "#2b2d42"; ctx.fill();
        rr(x - 12, y + 14, 24 * r, 4, 2); ctx.fillStyle = r > 0.5 ? "#6bcb77" : r > 0.25 ? "#ffd93d" : "#ff6b6b"; ctx.fill();
      });

      // Buildings and the town hall, back to front.
      const spots = c.order.map((kind, i) => ({ kind, s: cellSpot(i) }));
      spots.push({ kind: "hall", s: HALL });
      spots.sort((a, b) => a.s.y - b.s.y);
      spots.forEach(({ kind, s }) => {
        if (kind === "hall") drawHall(era);
        else if (kind === "house") drawHouse(s.x, s.y, ERAS[c.lv.house].house);
        else drawSpecial(kind, s.x, s.y, c.lv[kind]);
      });

      // People walk from home to work and back.
      peopleNow().forEach((p) => drawPerson(p.x, p.y, lookOf(p.n), p.job, p.bounce, p.walk, p.working));

      drawEnemies();
      if (opts.state() === "over") drawEnemyFlag();
      drawDefence();

      // Something flies over the city now and then.
      const fly = (clock * 45) % (MW * 2.5);
      if (E.sky && fly < MW + 60) emoji(E.sky, MW + 30 - fly, 34 + Math.sin(clock * 2) * 6, 22);

      // Day and night: at night the sky goes dark, stars come out and windows light up.
      const night = nightNow();
      if (night > 0) {
        ctx.fillStyle = "rgba(15, 20, 70, " + night * 0.5 + ")";
        ctx.fillRect(0, 0, MW, MH);
        ctx.globalAlpha = night;
        for (let i = 0; i < 24; i++) {
          const sx = (i * 197) % MW, sy = (i * 71) % 120;
          ctx.fillStyle = "#fff";
          ctx.fillRect(sx, sy, 2, 2);
        }
        emoji("🌙", 450, 22, 20);
        c.order.forEach((kind, i) => {
          const sp = cellSpot(i);
          const glow = ctx.createRadialGradient(sp.x, sp.y + 6, 1, sp.x, sp.y + 6, 16);
          glow.addColorStop(0, "rgba(255, 217, 61, 0.9)");
          glow.addColorStop(1, "rgba(255, 217, 61, 0)");
          ctx.fillStyle = glow;
          ctx.fillRect(sp.x - 16, sp.y - 10, 32, 32);
        });
        ctx.globalAlpha = 1;
      }

      drawWords((x, y) => ({ x, y }));
    }

    // Everyone in the city right now: where they are and what they do (at most 90 shown).
    function peopleNow() {
      const people = crew();
      const shown = Math.min(people.length, 90);
      const out = [];
      for (let n = 0; n < shown; n++) {
        const p = people[n];
        const home = houseSpot(n % c.houses);
        const homePt = { x: home.x + ((n * 7) % 13) - 6, y: home.y + 18 };
        const work = workSpot(p.job, p.i);
        const path = [homePt].concat(workPath(p.job, work));
        const cycle = 12, ph = (clock + n * 1.7) % cycle;
        let pos, bounce = 0, walk = 0, working = false;
        if (p.job === "idle") { pos = { x: work.x + Math.sin(clock * 0.7 + n) * 4, y: work.y }; }
        else if (ph < 3) { pos = lerpPath(path, ph / 3); walk = clock * 12 + n; bounce = Math.abs(Math.sin(walk)) * 1.2; }
        else if (ph < 10) { pos = work; working = true; bounce = Math.abs(Math.sin(clock * 6 + n)) * 1.2; }
        else { pos = lerpPath(path, 1 - (ph - 10) / 2); walk = clock * 12 + n; bounce = Math.abs(Math.sin(walk)) * 1.2; }
        if (p.job === "trader" && ph >= 3 && ph < 10) continue; // away selling things
        out.push({ n, x: pos.x, y: pos.y, job: p.job, bounce, walk, working });
      }
      return out;
    }

    // 0 by day, up to 1 in the middle of the night (a day lasts a minute).
    const nightNow = () => Math.max(0, Math.sin((clock / 60) * Math.PI * 2) * 1.4 - 0.4);

    // Little texts (a new person, a new age...) and the red flash when enemies are at the door.
    // at(x, y) is where a spot of the map is on the screen.
    function drawWords(at) {
      c.floats.forEach((f) => {
        const p = at(f.x, f.y);
        ctx.globalAlpha = Math.max(0, 1 - f.t / 2);
        ctx.font = "bold 20px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "#2b2d42";
        ctx.strokeText(f.text, p.x, p.y - f.t * 20);
        ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, p.y - f.t * 20);
        ctx.globalAlpha = 1;
      });

      // Enemies at the door: a red flash around the map.
      if (c.alert && opts.state() === "playing") {
        ctx.strokeStyle = "rgba(255,107,107," + (0.5 + 0.5 * Math.sin(clock * 8)) + ")";
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, MW - 8, MH - 8);
      }
    }

    // What the 3D map needs to know: the places on the map, and the city as it is now.
    const world = {
      MW, MH, GATE, ROAD, WGATE, EGATE, FIELDS, MINE, KILN, PASTURE, HALL, PATH_LINES, TOWERS, ERAS, LAST, weapons,
      get c() { return c; }, get clock() { return clock; }, battle: g, state: () => opts.state(),
      cellSpot, towerTier, lookOf, people: peopleNow, enemies: enemiesNow, enemyTypes: opts.enemies, towerShots, night: nightNow,
    };

    function setupMap() {
      if (opts.map3d && (!opts.use3d || opts.use3d()) && !maps.no3d && !maps.deep) {
        // The 3D map gets its own canvas next to the 2D one. The words and the defence box are
        // drawn on a see-through layer the 3D map shows on top.
        const canvas = ui.map.cloneNode();
        canvas.classList.add("city-map3d");
        ui.map.after(canvas);
        const words = document.createElement("canvas");
        words.width = MW * 2;
        words.height = MH * 2;
        const map = opts.map3d(canvas, world, words);
        if (map) maps.deep = { canvas, map, ctx: words.getContext("2d") };
        else { canvas.remove(); maps.no3d = true; } // no 3D on this device: the 2D map
      }
      const deep = !!maps.deep && (!opts.use3d || opts.use3d());
      if (!deep && !maps.flat) maps.flat = { ctx: ui.map.getContext("2d") };
      ui.map.hidden = deep;
      if (maps.deep) maps.deep.canvas.hidden = !deep;
      view.classList.toggle("flat", !deep);
      map3d = deep ? maps.deep.map : null;
      ctx = deep ? maps.deep.ctx : maps.flat.ctx;
    }

    // With a 3D map, only the words and the defence box are drawn here.
    function drawOver3d() {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, MW, MH);
      drawDefence();
      drawWords((x, y) => map3d.toScreen(x, y, 20));
    }

    let lastFrame = 0;
    function frame(now) {
      if (!open) return;
      const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
      lastFrame = now;
      clock += dt;
      c.floats.forEach((f) => { f.t += dt; });
      c.floats = c.floats.filter((f) => f.t < 2);
      c.newAge = Math.max(0, (c.newAge || 0) - dt);
      if (map3d) { drawOver3d(); map3d.draw(); } else drawMap();
      if (clock - lastRefresh > 0.25) refresh();
      requestAnimationFrame(frame);
    }

    function show(yes) {
      open = yes && on;
      view.hidden = !open;
      document.documentElement.classList.toggle("city-on", open);
      if (open) {
        setupMap();
        lastFrame = 0;
        refresh(true);
        requestAnimationFrame(frame);
        ui.back.focus();
      } else {
        cityBtn.focus();
      }
    }

    cityBtn.addEventListener("click", (e) => { e.stopPropagation(); show(true); });
    // A tap on the 🏘️ button must not start the battle behind it.
    cityBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    ui.back.addEventListener("click", () => show(false));
    ui.alert.addEventListener("click", () => {
      const st = opts.state();
      show(false);
      if (st === "ready" || st === "over") opts.start();
    });
    // While the city is open, the keys are for the city, not for the battle behind it.
    window.addEventListener("keydown", (e) => {
      if (!open) return;
      e.stopPropagation();
      // Exploring the city (in the 3D and FPS views), Escape only stops exploring.
      if (e.key === "Escape" && !view.classList.contains("exploring")) show(false);
    }, true);
    window.addEventListener("keyup", (e) => { if (open) e.stopPropagation(); }, true);

    reset();

    return {
      get on() { return on; },
      get open() { return open; },
      // Seconds of peace between waves (and before the first one), so there is time for the city.
      get peace() { return on ? 15 : 2.5; },
      get firstWait() { return on ? 12 : 2.5; },
      // How many waves came so far (with a city there is no last wave).
      get round() { return c.round + 1; },
      reset, tick, towerSpots, show,
      // The enemy goes for the towers first (see towerPull and the ones after it).
      towerPull, towerAim, towerShot, towerBash,
      // The wave after this one: the next in line, or with a city, one from your age.
      nextWave(cur) {
        if (!on) return cur + 1;
        const list = AGE_WAVES[c.era];
        return list[++c.round % list.length];
      },
      // "🦴 Stone Age: Stone throwers!" instead of "Wave 3: ..." when the waves follow your age.
      waveTitle(i, name) {
        const era = ERAS[AGE_WAVES.findIndex((l) => l.includes(i))];
        return t("{age}: {name}", { age: era.emoji + " " + era.name, name });
      },
      countdown(secs) {
        g().banner = { text: t("😌 Next attack in {n} s", { n: Math.ceil(secs) }) + "  🏘️", t: 0.6 };
      },
      // For the test script.
      get c() { return c; }, build, addJob: (id, n) => addJob(JOBS.find((j) => j.id === id), n), shareOut,
      // Pause and save (pause.js): the whole city as plain data, or null without a city.
      save() { return on ? JSON.parse(JSON.stringify(c)) : null; },
      // Puts a saved city back (call newGame() first).
      load(saved) {
        if (!on || !saved) return;
        reset();
        Object.assign(c, saved, { floats: [] });
      },
    };
  }

  return { create, ERAS, JOBS };
})();

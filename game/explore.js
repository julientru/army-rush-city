// Explore my city: in the 3D and FPS views the 3D city map (city3d.js) opens full screen and
// you move in it yourself, in two ways:
//   🦅 Fly: a free camera above the town. Go anywhere, up and down, zoom in on a house.
//   🚶 Walk: the commander in the streets, at people height, among the workers.
// Phone: the joystick under the left thumb moves, sliding anywhere else looks around, pinch (or
// ➕ ➖) zooms, ⬆️ ⬇️ fly up and down. Desktop: WASD / arrow keys move, drag the mouse to look,
// the wheel zooms, Space / Shift fly up and down, V switches Fly / Walk, Esc goes back.
// ArmyCityExplore(map, canvas, world) is called once the 3D map is made; map is what ArmyCity3D
// returned, world what the city told it (see `world` in city.js).
window.ArmyCityExplore = function (map, canvas, world) {
  const t = I18n.t;
  const view = canvas.closest(".city");
  const camera = map.camera;
  const EYE = 17;                 // the commander's eyes: as tall as the people of the town
  const FLY_FOV = 55, WALK_FOV = 62;
  const FAR = 650;                // how far from the middle of the town you can go
  const TOP = 700;                // how high you can fly
  // Inside the town walls, and the town hall in the middle (see the map in ../army/city.js).
  const TOWN = { x0: -110, x1: 130, z0: -150, z1: 70, hallX: 10, hallZ: -48 };

  // Where you are and where you look. Positions are in the map's 3D world (the town is around 0, 0).
  const me = { x: 0, y: 330, z: 330, yaw: 0, pitch: -0.8, fov: FLY_FOV };
  const goal = { y: me.y, pitch: me.pitch, fov: me.fov }; // eased towards, for smooth changes
  let mode = "fly", on = false;

  // ---------- The screen: the button to start, and the controls on top of the map ----------

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const button = (cls, text, label) => {
    const b = el("button", "btn " + cls, text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
  };

  const go = button("explore-go", t("🔭 Explore my city"));
  canvas.after(go);

  const pad = el("div", "explore");
  pad.hidden = true;
  const top = el("div", "explore-top");
  const back = button("explore-back", t("⬅️ My city"));
  const modes = el("div", "explore-modes");
  modes.setAttribute("role", "group");
  const flyBtn = button("explore-mode", t("🦅 Fly"));
  const walkBtn = button("explore-mode", t("🚶 Walk"));
  modes.append(flyBtn, walkBtn);
  top.append(back, modes);
  const hint = el("div", "explore-hint");
  const stick = el("div", "explore-stick");
  const knob = el("i");
  stick.append(knob);
  const side = el("div", "explore-side");
  const zoomIn = button("explore-zoom", "➕", t("Zoom in"));
  const zoomOut = button("explore-zoom", "➖", t("Zoom out"));
  const up = button("explore-up", "⬆️", t("Fly up"));
  const down = button("explore-up", "⬇️", t("Fly down"));
  side.append(zoomIn, zoomOut, up, down);
  pad.append(top, hint, stick, side);
  view.appendChild(pad);

  const coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  hint.textContent = coarse
    ? t("Move with the joystick, slide to look around")
    : t("Move with WASD or the arrows, drag to look around, wheel to zoom");

  let hintTimer = 0;
  function start() {
    on = true;
    view.classList.add("exploring");
    pad.hidden = false;
    map.words = false;
    map.moveCamera = moveCamera;
    camera.near = 0.5;
    last = 0;
    hint.classList.remove("gone");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add("gone"), 5000);
    setMode(mode);
  }
  function stop() {
    on = false;
    view.classList.remove("exploring");
    pad.hidden = true;
    map.words = true;
    map.moveCamera = null;
    camera.near = 5;
    camera.fov = 32;
    camera.updateProjectionMatrix();
    held.clear();
    sticky = null;
    looks.clear();
    stickMove(0, 0);
  }

  function setMode(m) {
    if (m === "walk" && mode === "fly") {
      // Land where you are looking (or right below you), facing the same way. Looking outside
      // the walls, land just inside them, facing the town hall.
      const drop = me.pitch < -0.15 ? me.y / Math.tan(-me.pitch) : 0;
      const x = me.x - Math.sin(me.yaw) * drop, z = me.z - Math.cos(me.yaw) * drop;
      me.x = clamp(x, TOWN.x0, TOWN.x1);
      me.z = clamp(z, TOWN.z0, TOWN.z1);
      if (me.x !== x || me.z !== z) me.yaw = Math.atan2(me.x - TOWN.hallX, me.z - TOWN.hallZ);
      goal.y = EYE; goal.pitch = 0; goal.fov = WALK_FOV;
    } else if (m === "fly" && mode === "walk") {
      // Take off, a little behind you, to see where you were.
      me.x += Math.sin(me.yaw) * 120;
      me.z += Math.cos(me.yaw) * 120;
      goal.y = 190; goal.pitch = -0.75; goal.fov = FLY_FOV;
    }
    mode = m;
    flyBtn.setAttribute("aria-pressed", m === "fly");
    walkBtn.setAttribute("aria-pressed", m === "walk");
    pad.classList.toggle("walking", m === "walk");
  }

  go.addEventListener("click", start);
  back.addEventListener("click", stop);
  flyBtn.addEventListener("click", () => setMode("fly"));
  walkBtn.addEventListener("click", () => setMode("walk"));
  // A tap on the map (not a slide) opens it too.
  let tapAt = null;
  canvas.addEventListener("pointerdown", (e) => { tapAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("click", (e) => {
    if (!on && tapAt && Math.hypot(e.clientX - tapAt.x, e.clientY - tapAt.y) < 8) start();
  });

  // ---------- Moving: keys, the joystick, held buttons ----------

  const held = new Set(); // what is pressed now: "fwd", "back", "left", "right", "turnL", "turnR", "up", "down"
  const KEYS = {
    w: "fwd", z: "fwd", ArrowUp: "fwd", s: "back", ArrowDown: "back",
    a: "left", q: "left", d: "right", ArrowLeft: "turnL", ArrowRight: "turnR",
    " ": "up", Shift: "down", e: "up", c: "down",
  };
  // Keys go to the city before the battle (which listens on the document) while exploring.
  window.addEventListener("keydown", (e) => {
    if (!on || view.hidden) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) held.add(KEYS[k]);
    else if (k === "v") setMode(mode === "fly" ? "walk" : "fly");
    else if (k === "Escape") stop();
    else if (k === "+" || k === "=") zoom(1);
    else if (k === "-") zoom(-1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  window.addEventListener("keyup", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) held.delete(KEYS[k]);
    if (on) e.stopPropagation();
  }, true);
  window.addEventListener("blur", () => held.clear());

  [[up, "up"], [down, "down"]].forEach(([b, what]) => {
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); held.add(what); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, () => held.delete(what)));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  [[zoomIn, 1], [zoomOut, -1]].forEach(([b, dir]) => {
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", () => zoom(dir * 2));
  });
  [top, side].forEach((box) => box.addEventListener("pointerdown", (e) => e.stopPropagation()));

  // Zoom: flying, you move towards what you look at; walking, you look through binoculars.
  function zoom(amount) {
    if (mode === "fly") {
      const step = amount * Math.max(12, me.y * 0.12);
      const dir = forward3();
      me.x += dir.x * step; me.y += dir.y * step; me.z += dir.z * step;
      me.y = clamp(me.y, 6, TOP);
      goal.y = me.y;
    } else {
      goal.fov = clamp(goal.fov - amount * 6, 18, 75);
    }
  }

  // The joystick: a finger that starts on the lower left part of the screen (or on the stick).
  // Looking: any other finger or the mouse. Two fingers looking at once pinch to zoom.
  let sticky = null;               // { id, x, y }: the finger on the joystick, and where it started
  let jx = 0, jy = 0;              // the joystick: -1..1 sideways and forward
  const looks = new Map();         // pointerId -> { x, y }
  let pinch = 0;
  const STICK = 56;                // how far the knob goes, in pixels

  function stickMove(dx, dy) {
    const d = Math.hypot(dx, dy);
    const k = d > STICK ? STICK / d : 1;
    jx = (dx * k) / STICK;
    jy = (-dy * k) / STICK;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  pad.addEventListener("pointerdown", (e) => {
    const r = pad.getBoundingClientRect();
    const onStick = e.target === stick || e.target === knob;
    const lowerLeft = e.pointerType !== "mouse" && e.clientX < r.left + r.width * 0.45 && e.clientY > r.top + r.height * 0.45;
    pad.setPointerCapture(e.pointerId);
    hint.classList.add("gone");
    if (!sticky && (onStick || lowerLeft)) {
      // The joystick comes under the thumb.
      const s = stick.getBoundingClientRect();
      const cx = onStick ? s.left + s.width / 2 : e.clientX;
      const cy = onStick ? s.top + s.height / 2 : e.clientY;
      if (!onStick) {
        stick.style.left = cx - r.left - s.width / 2 + "px";
        stick.style.top = cy - r.top - s.height / 2 + "px";
        stick.style.bottom = "auto";
      }
      sticky = { id: e.pointerId, x: cx, y: cy };
      stick.classList.add("on");
      stickMove(e.clientX - cx, e.clientY - cy);
      return;
    }
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = 0;
  });
  pad.addEventListener("pointermove", (e) => {
    if (sticky && e.pointerId === sticky.id) { stickMove(e.clientX - sticky.x, e.clientY - sticky.y); return; }
    const p = looks.get(e.pointerId);
    if (!p) return;
    if (looks.size >= 2) {
      // Pinch: fingers apart zoom in.
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...looks.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom((d - pinch) / 25);
      pinch = d;
      return;
    }
    // Slide to look (slide right to look right): the whole width of the screen turns you about half way round.
    const k = (2.6 / Math.max(pad.clientWidth, 1)) * (me.fov / 60);
    me.yaw -= (e.clientX - p.x) * k;
    goal.pitch = me.pitch = clamp(me.pitch - (e.clientY - p.y) * k, -1.5, 0.9);
    p.x = e.clientX; p.y = e.clientY;
  });
  function lift(e) {
    if (sticky && e.pointerId === sticky.id) {
      sticky = null;
      stick.classList.remove("on");
      stick.style.left = stick.style.top = stick.style.bottom = "";
      stickMove(0, 0);
    }
    looks.delete(e.pointerId);
    pinch = 0;
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => pad.addEventListener(ev, lift));
  pad.addEventListener("wheel", (e) => { e.preventDefault(); zoom(-Math.sign(e.deltaY)); }, { passive: false });
  pad.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- The camera, every picture ----------

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function forward3() {
    const c = Math.cos(me.pitch);
    return { x: -Math.sin(me.yaw) * c, y: Math.sin(me.pitch), z: -Math.cos(me.yaw) * c };
  }

  // Walking, you go round the houses and the town hall, and through the wall only at its gates.
  const { MW, MH, GATE, WGATE, EGATE, HALL, TOWERS } = world;
  const [L, R] = [TOWERS[0][0], TOWERS[1][0]], [T, B] = [TOWERS[0][1], TOWERS[2][1]];
  const WALLS = [ // [x1, y1, x2, y2] on the map, the gates left open
    [L, T, R, T],
    [L, T, L, WGATE.y - 16], [L, WGATE.y + 16, L, B],
    [R, T, R, EGATE.y - 16], [R, EGATE.y + 16, R, B],
    [L, B, GATE.x - 16, B], [GATE.x + 16, B, R, B],
  ];
  function pushOut(px, py, r) {
    const dx = me.x + MW / 2 - px, dz = me.z + MH / 2 - py, d = Math.hypot(dx, dz);
    if (d >= r || d < 0.001) return;
    me.x += (dx / d) * (r - d);
    me.z += (dz / d) * (r - d);
  }
  function bump() {
    const c = world.c;
    for (let i = 0; i < c.order.length; i++) { const s = world.cellSpot(i); pushOut(s.x, s.y, 19); }
    pushOut(HALL.x, HALL.y, 30);
    WALLS.forEach(([x1, y1, x2, y2]) => {
      // The nearest point of the wall, then out of it.
      const mx = me.x + MW / 2, my = me.z + MH / 2;
      const k = clamp(((mx - x1) * (x2 - x1) + (my - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2), 0, 1);
      pushOut(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 8);
    });
  }

  let last = 0;
  function moveCamera() {
    const now = performance.now();
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;

    // Keys and the joystick together: forward / back and sideways, on the ground plane.
    let fwd = jy, right = jx;
    if (held.has("fwd")) fwd += 1;
    if (held.has("back")) fwd -= 1;
    if (held.has("right")) right += 1;
    if (held.has("left")) right -= 1;
    if (held.has("turnL")) me.yaw += 1.8 * dt;
    if (held.has("turnR")) me.yaw -= 1.8 * dt;
    const len = Math.hypot(fwd, right);
    if (len > 1) { fwd /= len; right /= len; }
    const speed = mode === "walk" ? 55 : 40 + me.y * 0.35; // the higher you fly, the faster you go
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    me.x += (-sy * fwd + cy * right) * speed * dt;
    me.z += (-cy * fwd - sy * right) * speed * dt;
    if (mode === "walk") {
      me.x = clamp(me.x, -300, 300);
      me.z = clamp(me.z, -230, 260);
      bump();
    } else {
      me.x = clamp(me.x, -FAR, FAR);
      me.z = clamp(me.z, -FAR, FAR);
      if (held.has("up")) goal.y += speed * 0.8 * dt;
      if (held.has("down")) goal.y -= speed * 0.8 * dt;
      goal.y = clamp(goal.y, 6, TOP);
    }

    // Ease into a new height, tilt or zoom (after switching Fly / Walk, or zooming in walk).
    const ease = 1 - Math.pow(0.002, dt);
    me.y += (goal.y - me.y) * ease;
    me.pitch += (goal.pitch - me.pitch) * ease;
    me.fov += (goal.fov - me.fov) * ease;

    // A little bob while walking.
    const bob = mode === "walk" && len > 0.1 ? Math.abs(Math.sin(now / 140)) * 0.8 : 0;
    camera.position.set(me.x, me.y + bob, me.z);
    camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
    if (Math.abs(camera.fov - me.fov) > 0.01) {
      camera.fov = me.fov;
      camera.updateProjectionMatrix();
    }
  }
};

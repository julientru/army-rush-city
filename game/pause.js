// Pause and save for Army Rush, in every view.
// The ⏸️ button (or P / Escape) stops the battle and the city. While a battle is on, it is saved
// in this browser (localStorage, nothing is sent anywhere) every second, and when the page is
// hidden. Switching between 2D, 3D and FPS keeps the same battle, so the save has no view in it.
// When the page opens with a saved battle, it asks: keep playing, or start again?
//
// The game calls ArmyPause.create({...}) once, skips update() while pause.paused,
// and gives a resume(saved) that puts the saved battle back (see ArmyPause.battle).
window.ArmyPause = (function () {
  const t = I18n.t;
  // Army Rush and Army Rush City each keep their own battle (opts.key).
  let KEY = "army-rush-save";
  const VERSION = 1;
  // What flies around for a moment is not saved, and neither are the 3D drawings (view) or links.
  const SKIP_LISTS = ["bullets", "shots", "fx", "tumblers"];
  const SKIP_KEYS = new Set(["view", "pair", "hit"]);

  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && s.v === VERSION && s.g ? s : null;
    } catch (e) {
      return null;
    }
  }

  function write(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) { /* storage full or blocked: the game goes on without a save */ }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* nothing to clear */ }
  }

  // The battle (g) as plain data.
  function pack(g) {
    const copy = Object.assign({}, g, { missed: Array.from(g.missed || []) });
    SKIP_LISTS.forEach((k) => { copy[k] = []; });
    return JSON.parse(JSON.stringify(copy, (k, v) => (SKIP_KEYS.has(k) ? undefined : v)));
  }

  // Puts a saved battle into a fresh one (so a field one game has and another lacks gets its start value).
  function battle(fresh, saved) {
    Object.assign(fresh, saved);
    fresh.missed = new Set(saved.missed || []);
    SKIP_LISTS.forEach((k) => { fresh[k] = []; });
    fresh.banner = null;
    fresh.shake = 0;
    fresh.hurt = 0;
    return fresh;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // opts: game () => g, state () => state, level () => level, levelName (id) => name, city,
  // resume (saved) puts a saved battle back and plays it, restart () goes back to the start screen.
  function create(opts) {
    if (opts.key) KEY = opts.key;
    let paused = false;

    // One ⏸️ on the battle, one on the city (the battle goes on behind the city).
    function pauseButton(place) {
      const b = el("button", "btn pause-btn");
      b.type = "button";
      b.setAttribute("aria-label", t("Pause"));
      b.textContent = "⏸️";
      b.hidden = true;
      place(b);
      b.addEventListener("click", (e) => { e.stopPropagation(); pause(); b.blur(); });
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      return b;
    }
    const btns = [
      pauseButton((b) => document.querySelector(".hud .home").after(b)),
      pauseButton((b) => document.querySelector(".city .city-back").after(b)),
    ];

    const box = el("div", "pause");
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `
      <div class="pause-card">
        <div class="pause-title"></div>
        <div class="pause-info"></div>
        <div class="pause-note"></div>
        <div class="pause-btns">
          <button class="btn go" type="button" data-act="play"></button>
          <button class="btn warn" type="button" data-act="again"></button>
          <a class="btn home" href="../index.html"></a>
        </div>
      </div>`;
    document.body.appendChild(box);
    const q = (s) => box.querySelector(s);
    q("[data-act=play]").textContent = t("▶️ Keep playing");
    q("[data-act=again]").textContent = t("🔄 Start again");
    // Same "Julien's projects" grid icon as the top bar and the other games.
    q(".home").innerHTML = document.querySelector(".hud .home svg").outerHTML;
    q(".home").append(t("Julien's projects"));
    q(".pause-note").textContent = t("💾 Your battle is saved on this device.");
    // Taps on the box must not reach the battle behind it.
    box.addEventListener("pointerdown", (e) => e.stopPropagation());

    let onPlay = null, onAgain = null;
    function ask(title, info, play, again, home) {
      q(".pause-title").textContent = title;
      q(".pause-info").textContent = info;
      q(".home").hidden = !home;
      onPlay = play;
      onAgain = again;
      box.hidden = false;
      document.documentElement.classList.add("paused");
      q("[data-act=play]").focus();
    }
    function close() {
      box.hidden = true;
      document.documentElement.classList.remove("paused");
    }
    q("[data-act=play]").addEventListener("click", () => { close(); onPlay(); });
    q("[data-act=again]").addEventListener("click", () => { close(); onAgain(); });

    // "🌊 Wave 4 · Normal · 🏛️ Ancient Greece"
    function describe(s) {
      const parts = ["🌊 " + t("Wave {n}", { n: s.city ? s.city.round + 1 : s.g.wave + 1 }), opts.levelName(s.level)];
      if (s.city) {
        const era = ArmyCity.ERAS[s.city.era];
        parts.push(era.emoji + " " + era.name);
      }
      return parts.join(" · ");
    }

    function snapshot() {
      return { v: VERSION, at: Date.now(), level: opts.level(), city: opts.city.save(), g: pack(opts.game()) };
    }

    function save() {
      if (opts.state() === "playing") write(snapshot());
    }

    function pause() {
      if (paused || opts.state() !== "playing") return;
      paused = true;
      save();
      ask(t("⏸️ Paused"), describe(snapshot()), play, () => { paused = false; clear(); opts.restart(); }, true);
    }

    function play() {
      paused = false;
    }

    // P or Escape pauses and goes on. (While the city is open, the keys are the city's.)
    window.addEventListener("keydown", (e) => {
      if (e.key !== "p" && e.key !== "P" && e.key !== "Escape") return;
      e.preventDefault();
      if (box.hidden) pause();
      else if (paused) { close(); play(); }
    });

    // A phone that goes to sleep, or a switch to another app: pause and save straight away.
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
    window.addEventListener("pagehide", save);

    // Every second while the battle is on: save it. A lost or won battle has nothing to come back to.
    let lastState = opts.state(), ticks = 0;
    setInterval(() => {
      const st = opts.state();
      btns.forEach((b) => { b.hidden = st !== "playing"; });
      if (st === "playing" && !paused && ++ticks % 4 === 0) save();
      else if ((st === "over" || st === "won") && st !== lastState) clear();
      lastState = st;
    }, 250);

    // A saved battle from last time: go on, or start again?
    const saved = read();
    if (saved) {
      ask(t("👋 Welcome back!"), describe(saved), () => opts.resume(saved), clear, false);
      q(".pause-note").textContent = t("You have a battle saved on this device.");
    }
    // Once the welcome question is answered, the note is about the pause again.
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")) q(".pause-note").textContent = t("💾 Your battle is saved on this device.");
    });

    return {
      get paused() { return paused; },
      pause, save, clear,
      resume() { close(); play(); },
    };
  }

  return { create, battle, read, clear };
})();

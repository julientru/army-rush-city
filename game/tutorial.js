// A short tutorial for Army Rush, a few big cards with a picture and one or two lines each.
// Only the cards about the controls change with the view (2D, 3D or FPS).
//
// The first time someone plays, it shows the battle cards; the first time they play
// Army Rush City, the city cards. Switching to another view later shows only its own
// controls card. The ❓ button shows it all again. What was seen is kept in this browser.
//
//   const tutorial = ArmyTutorial.create({ view: "2d" | "3d" | "fps", placeButton(btn) {…} });
//   tutorial.open      // true while a card is up: the game stops its battle meanwhile
//   tutorial.view(v)   // the game switched to view v: its controls card, the first time
window.ArmyTutorial = (function () {
  const t = (s, v) => I18n.t(s, v);
  const STORE = "kids-games-army-tutorial";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE)) || {};
    } catch (e) {
      return {};
    }
  }
  function save(seen) {
    try {
      localStorage.setItem(STORE, JSON.stringify(seen));
    } catch (e) {
      // Private window: it shows again next time, which does no harm.
    }
  }

  // How to aim, for each view. "anim" moves the picture to show the gesture.
  const CONTROLS = {
    "2d": {
      pic: "👆", anim: "slide",
      text: "Slide your finger on the field to move your army. You can also hold ⬅️ ➡️, or use the arrow keys.",
    },
    "3d": {
      pic: "👆", anim: "slide",
      text: "Slide your finger on the field to move your army. You can also hold ⬅️ ➡️, or use the arrow keys.",
    },
    fps: {
      pic: "🎯", anim: "aim",
      text: "You are behind the wall! Tap or drag to move the cross-hair: your army shoots where it points. Hold ⬅️ ➡️ to look around.",
    },
  };

  // The 2D / 3D / FPS buttons. People who played before they came see it on its own, once.
  const SWITCH = { pic: "👀", text: "Tap 2D, 3D or FPS at the top to see the battle another way. It goes on just as it was!" };

  function battleCards(view) {
    return [
      { pic: "🪖", text: "Your army shoots all by itself! Stop the enemy before it breaks in." },
      CONTROLS[view],
      SWITCH,
      { pic: "📦", anim: "pop", text: "Shoot a box to open it: a new weapon, more soldiers, a bigger wall or a shield." },
      { pic: "🧱❤️", text: "The enemy breaks your wall first, then hits your ❤️. Don't let it reach zero!" },
      { pic: "👑", anim: "pop", text: "Knock out the King Tank to win the game. Tap the field to start!" },
    ];
  }

  function cityCards(view) {
    const cards = [
      { pic: "🏘️", text: "Tap 🏘️ to open your city. Careful: the battle goes on while you are there!" },
      { pic: "👷", text: "Give your people jobs. Farmers 🌾 make the food that everyone eats." },
      { pic: "🏠", anim: "pop", text: "Build houses so more people come. Your city grows through 20 ages, from the Stone Age to the AI Empire!" },
      { pic: "⚔️", text: "Your city makes your army: barracks train soldiers, the lab finds weapons, bricks fix the wall." },
    ];
    if (view !== "2d") cards.push({ pic: "🔭", text: "Tap the map to explore your city: fly over it like a bird, or walk in its streets." });
    return cards;
  }

  // Keys while a card is up are for the card only (Enter / → next, ← back, Escape skips).
  // Set up now, before the games and the city add their own keys, so it runs first.
  let current = null;
  window.addEventListener("keydown", (e) => {
    if (!current) return;
    e.stopImmediatePropagation();
    if (e.key === "Tab") return;
    e.preventDefault();
    if (e.key === "Escape") current.close();
    else if (e.key === "ArrowLeft") current.go(-1);
    else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      if (e.repeat) return;
      current.go(1);
    }
  }, true);
  window.addEventListener("keyup", (e) => { if (current) e.stopImmediatePropagation(); }, true);

  function create(opts) {
    let view = CONTROLS[opts.view] ? opts.view : "2d";
    const seen = load();

    const box = document.createElement("div");
    box.className = "tuto";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `
      <div class="tuto-card">
        <div class="tuto-pic" aria-hidden="true"></div>
        <p class="tuto-text" aria-live="polite"></p>
        <div class="tuto-dots" aria-hidden="true"></div>
        <div class="tuto-btns">
          <button class="btn tuto-skip" type="button"></button>
          <button class="btn tuto-back" type="button" aria-label="${t("Back")}">◀️</button>
          <button class="btn tuto-next" type="button"></button>
        </div>
      </div>`;
    document.body.appendChild(box);
    const q = (s) => box.querySelector(s);
    const ui = { pic: q(".tuto-pic"), text: q(".tuto-text"), dots: q(".tuto-dots"), skip: q(".tuto-skip"), back: q(".tuto-back"), next: q(".tuto-next") };
    ui.skip.textContent = t("Skip");
    box.setAttribute("aria-label", t("How to play"));

    let cards = [], at = 0;

    function paint() {
      const card = cards[at];
      ui.pic.textContent = card.pic;
      ui.pic.className = "tuto-pic" + (card.anim ? " " + card.anim : "");
      ui.text.textContent = t(card.text);
      ui.dots.textContent = "";
      cards.forEach((c, i) => {
        const dot = document.createElement("i");
        if (i === at) dot.className = "on";
        ui.dots.appendChild(dot);
      });
      ui.dots.hidden = cards.length < 2;
      ui.back.hidden = at === 0;
      ui.skip.hidden = at === cards.length - 1;
      ui.next.textContent = at === cards.length - 1 ? t("👍 Got it!") : t("Next ▶️");
    }

    const api = {
      get open() { return current === api; },
      go(step) {
        if (at + step >= cards.length) return api.close();
        at = Math.max(0, at + step);
        paint();
      },
      close() {
        if (current !== api) return;
        current = null;
        box.hidden = true;
        help.focus();
      },
      // Shows a list of cards: "battle", "city", "controls", "all", or the cards themselves.
      show(what) {
        if (Array.isArray(what)) cards = what;
        else if (what === "battle") cards = battleCards(view);
        else if (what === "city") cards = cityCards(view);
        else if (what === "controls") cards = [CONTROLS[view]];
        else cards = battleCards(view).concat(opts.cityOn && opts.cityOn() ? cityCards(view) : []);
        at = 0;
        current = api;
        box.hidden = false;
        paint();
        ui.next.focus();
      },
      view(v) {
        if (!CONTROLS[v] || v === view) return;
        view = v;
        firstTime();
      },
    };

    ui.next.addEventListener("click", () => api.go(1));
    ui.back.addEventListener("click", () => api.go(-1));
    ui.skip.addEventListener("click", () => api.close());
    // A tap on the card must never reach the battle behind it.
    box.addEventListener("pointerdown", (e) => e.stopPropagation());

    const help = document.createElement("button");
    help.className = "btn tuto-help";
    help.type = "button";
    help.textContent = "❓";
    help.setAttribute("aria-label", t("How to play"));
    help.addEventListener("pointerdown", (e) => e.stopPropagation());
    help.addEventListener("click", (e) => {
      e.stopPropagation();
      help.blur();
      api.show("all");
    });
    opts.placeButton(help);

    // First time in any view: the battle cards. First time in this view only: its controls
    // (and the 2D / 3D / FPS card for people who played before it came).
    function firstTime() {
      seen.views = seen.views || {};
      let list = [];
      if (!seen.battle) list = battleCards(view);
      else {
        if (!seen.views[view]) list.push(CONTROLS[view]);
        if (!seen.switch) list.push(SWITCH);
      }
      // Army Rush City: its city cards come after the battle ones, the first time.
      if (opts.cityOn && opts.cityOn() && !seen.city) {
        list = list.concat(cityCards(view));
        seen.city = true;
      }
      seen.battle = seen.switch = true;
      seen.views[view] = true;
      // 2D and 3D have the same controls, so seeing one is seeing both.
      if (view !== "fps") seen.views["2d"] = seen.views["3d"] = true;
      save(seen);
      if (!list.length) return;
      // A card already up (the city cards, say) is not cut short: these come after it.
      if (current && current !== api) return;
      if (current === api) {
        cards = cards.concat(list.filter((c) => !cards.includes(c)));
        paint();
      } else api.show(list);
    }
    firstTime();

    return api;
  }

  return { create };
})();

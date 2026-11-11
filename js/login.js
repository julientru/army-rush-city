// The log in page (login.html): the same name and PIN as kids-games, in the same Supabase project,
// so a player made here plays in kids-games too and the other way round. "I'm new" makes a new
// player (sign_up in kids-games' supabase/setup.sql); "Log in" signs in an existing one (log_in).
// Scores made on this device while signed out go to whoever signs in next (see js/accounts.js).
// login.html?next=scores.html comes back to the Best scores page once signed in; otherwise the game.
(function () {
  const t = I18n.t;
  const MSG = {
    login: "Welcome back! Type your name and your secret PIN.",
    new: "New here? Pick a name and a PIN of 4 to 6 numbers. Don't use your real full name!",
  };
  I18n.add({
    fr: {
      "Log in · Army Rush City": "Se connecter · Army Rush City",
      "Back to the game": "Retour au jeu",
      "👤 Who is playing?": "👤 Qui joue ?",
      "Log in or new player": "Se connecter ou nouveau joueur",
      "Your name": "Ton nom",
      "Your secret PIN": "Ton code secret",
      "Your secret PIN again": "Ton code secret encore une fois",
      "▶️ Log in": "▶️ Entrer",
      "🆕 I'm new": "🆕 Je suis nouveau",
      "🆕 Make my player": "🆕 Créer mon joueur",
      [MSG.login]: "Te revoilà ! Tape ton nom et ton code secret.",
      [MSG.new]: "Nouveau ? Choisis un nom et un code de 4 à 6 chiffres. N'utilise pas ton vrai nom complet !",
      "The two PINs are not the same. Try again!": "Les deux codes ne sont pas pareils. Réessaie !",
      "Hi {name}! 👋": "Salut {name} ! 👋",
      "🏆 Best scores": "🏆 Records",
      "👋 Log out": "👋 Sortir",
      "Scores are only kept on this device for now.": "Pour l'instant, les scores restent sur cet appareil.",
      "Only letters and numbers, no spaces or special characters.": "Seulement des lettres et des chiffres, sans espace ni caractère spécial.",
      "The PIN is 4 to 6 numbers.": "Le code, c'est 4 à 6 chiffres.",
    },
    "zh-HK": {
      "Log in · Army Rush City": "登入 · Army Rush City",
      "Back to the game": "返去遊戲",
      "👤 Who is playing?": "👤 邊個玩緊？",
      "Log in or new player": "登入或者新玩家",
      "Your name": "你個名",
      "Your secret PIN": "你嘅秘密密碼",
      "Your secret PIN again": "再打多次你嘅秘密密碼",
      "▶️ Log in": "▶️ 登入",
      "🆕 I'm new": "🆕 我係新嚟嘅",
      "🆕 Make my player": "🆕 開我嘅玩家",
      [MSG.login]: "歡迎返嚟！打你個名同你嘅秘密密碼。",
      [MSG.new]: "第一次嚟？揀個名同 4 至 6 個數字嘅密碼。唔好用你嘅真實全名！",
      "The two PINs are not the same. Try again!": "兩個密碼唔一樣，再試吓！",
      "Hi {name}! 👋": "你好 {name}！👋",
      "🏆 Best scores": "🏆 最高分",
      "👋 Log out": "👋 登出",
      "Scores are only kept on this device for now.": "暫時分數只會留喺呢部機。",
      "Only letters and numbers, no spaces or special characters.": "只可以用英文字母同數字，唔可以有空格或者特別符號。",
      "The PIN is 4 to 6 numbers.": "密碼係 4 至 6 個數字。",
    },
  });

  const $ = (id) => document.getElementById(id);
  const form = $("form");
  const errorEl = $("error");
  const go = $("go");
  const modeBtns = form.querySelectorAll("[data-mode]");
  const { player: nameIn, pin: pinIn, again: againIn } = form.elements;

  // Only these pages are a place to come back to.
  const next = new URLSearchParams(location.search).get("next");
  const back = next === "scores.html" ? "scores.html" : "index.html";

  let mode = "login";
  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    $("againLabel").hidden = m !== "new";
    pinIn.autocomplete = m === "new" ? "new-password" : "current-password";
    $("intro").textContent = t(MSG[m]);
    go.textContent = t(m === "new" ? "🆕 Make my player" : "▶️ Log in");
    errorEl.textContent = "";
  }
  modeBtns.forEach((b) => b.addEventListener("click", () => {
    setMode(b.dataset.mode);
    nameIn.focus();
  }));

  // Names are only letters A to Z and numbers, and PINs only numbers: anything else is dropped
  // as it is typed (or pasted), as in the kids-games sign-in window. "Léa" becomes "Lea".
  function keepOnly(input, clean, message) {
    input.addEventListener("input", () => {
      if (input.value === clean(input.value)) return;
      input.value = clean(input.value);
      errorEl.textContent = t(message);
    });
  }
  keepOnly(nameIn, (v) => v.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").slice(0, 16),
    "Only letters and numbers, no spaces or special characters.");
  [pinIn, againIn].forEach((input) => keepOnly(input, (v) => v.replace(/[^0-9]/g, "").slice(0, 6), "The PIN is 4 to 6 numbers."));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    if (mode === "new" && pinIn.value !== againIn.value) {
      errorEl.textContent = t("The two PINs are not the same. Try again!");
      return;
    }
    const buttons = form.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    try {
      await (mode === "new" ? Accounts.signUp : Accounts.logIn)(nameIn.value, pinIn.value);
      location.href = back;
    } catch (err) {
      errorEl.textContent = err.message;
      buttons.forEach((b) => (b.disabled = false));
    }
  });

  $("logOut").addEventListener("click", () => Accounts.logOut());

  function draw() {
    const me = Accounts.online && Accounts.player;
    $("offline").hidden = Accounts.online;
    $("signedIn").hidden = !me;
    form.hidden = !Accounts.online || !!me;
    if (me) {
      $("hello").textContent = t("Hi {name}! 👋", { name: me.name });
    } else if (Accounts.online) {
      form.reset();
      setMode(mode);
      nameIn.focus();
    }
  }
  Accounts.onChange(draw);
  // #new opens straight on "I'm new".
  setMode(location.hash === "#new" ? "new" : "login");
  draw();
})();

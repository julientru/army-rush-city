// Army Rush City's Best scores page (scores.html), in two tabs: this week's top 10 of each level,
// and the best of all time (my best on each level, the top 10 of each level, and the bests on this
// device). The game sends its wins as "army" with a "-city" level, the score being the seconds it
// took to win, so the fastest is the best (see js/accounts.js). scores.html#week and #best open a tab.
(function () {
  const t = I18n.t;
  I18n.add({
    fr: {
      "Best scores · Army Rush City": "Records · Army Rush City",
      "Back to the game": "Retour au jeu",
      "🏆 Best scores": "🏆 Records",
      "Player": "Joueur",
      "Scores": "Scores",
      "⭐ My best": "⭐ Mes records",
      "🏆 Top 10": "🏆 Top 10",
      "📱 On this device": "📱 Sur cet appareil",
      "Loading…": "Chargement…",
      "No wins yet. Knock out the King Tank to get on the list!": "Pas encore de victoire. Détruis le Tank Roi pour être sur la liste !",
      "Can't reach the internet. Try again later.": "Pas d'internet. Réessaie plus tard.",
      "Log in to keep your scores and see everyone's.": "Connecte-toi pour garder tes scores et voir ceux des autres.",
      "⏱️ Time to win: the fastest wins.": "⏱️ Temps pour gagner : le plus rapide gagne.",
      "📅 This week": "📅 Cette semaine",
      "🏆 All time": "🏆 Depuis toujours",
      "Nobody has won this week yet. Be the first!": "Personne n'a encore gagné cette semaine. Sois le premier !",
      "A new week starts on Monday: {n} days left.": "Une nouvelle semaine commence lundi : encore {n} jours.",
      "A new week starts on Monday: last day!": "Une nouvelle semaine commence lundi : dernier jour !",
      "👤 Log in": "👤 Se connecter",
      "👋 Log out": "👋 Sortir",
      "▶️ Play": "▶️ Jouer",
    },
    "zh-HK": {
      "Best scores · Army Rush City": "最高分 · Army Rush City",
      "Back to the game": "返去遊戲",
      "🏆 Best scores": "🏆 最高分",
      "Player": "玩家",
      "Scores": "分數",
      "⭐ My best": "⭐ 我嘅最高分",
      "🏆 Top 10": "🏆 頭十名",
      "📱 On this device": "📱 喺呢部機",
      "Loading…": "載入緊…",
      "No wins yet. Knock out the King Tank to get on the list!": "仲未有人贏。打低坦克王就可以上榜！",
      "Can't reach the internet. Try again later.": "上唔到網，遲啲再試啦。",
      "Log in to keep your scores and see everyone's.": "登入就可以留住你嘅分數，同埋睇到大家嘅分數。",
      "⏱️ Time to win: the fastest wins.": "⏱️ 幾耐贏到：最快嗰個贏。",
      "📅 This week": "📅 今個星期",
      "🏆 All time": "🏆 歷來",
      "Nobody has won this week yet. Be the first!": "今個星期仲未有人贏，快啲做第一個！",
      "A new week starts on Monday: {n} days left.": "新一個星期喺星期一開始：仲有 {n} 日。",
      "A new week starts on Monday: last day!": "新一個星期喺星期一開始：最後一日！",
      "👤 Log in": "👤 登入",
      "👋 Log out": "👋 登出",
      "▶️ Play": "▶️ 開始",
    },
  });

  const main = document.getElementById("scores");
  const tabsEl = document.getElementById("tabs");
  const accountEl = document.getElementById("account");

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text, cls) {
    const a = el("a", "btn" + (cls ? " " + cls : ""), text);
    a.href = href;
    return a;
  }

  // Who is signed in, with Log in (the log in page, which comes back here) or Log out.
  function drawAccount() {
    accountEl.innerHTML = "";
    const me = Accounts.online && Accounts.player;
    if (me) accountEl.appendChild(el("span", "me", "👤 " + me.name));
    accountEl.appendChild(link("index.html", t("▶️ Play")));
    if (!Accounts.online) return;
    if (me) {
      const b = el("button", "btn", t("👋 Log out"));
      b.type = "button";
      b.addEventListener("click", () => Accounts.logOut());
      accountEl.appendChild(b);
    } else {
      accountEl.appendChild(link("login.html?next=scores.html", t("👤 Log in"), "go"));
    }
  }

  // This week first: there everyone has a chance. Without Supabase there is no week to share.
  const TABS = (Accounts.online ? [["week", "📅 This week"]] : []).concat([["best", "🏆 All time"]]);
  const tabFromHash = () => (TABS.some(([id]) => "#" + id === location.hash) ? location.hash.slice(1) : TABS[0][0]);
  let tab = tabFromHash();
  TABS.forEach(([id, label]) => {
    const b = el("button", "btn", t(label));
    b.type = "button";
    b.dataset.tab = id;
    b.addEventListener("click", () => {
      history.replaceState(null, "", "#" + id);
      show(id);
    });
    tabsEl.appendChild(b);
  });
  function show(id) {
    tab = id;
    tabsEl.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === tab)));
    draw();
  }
  window.addEventListener("hashchange", () => show(tabFromHash()));

  // Only this game's lists, one per level: Easy, Normal, Hard, Mega-hard.
  const cityBoards = (rows) => Accounts.boards(rows).filter((b) => b.game.id === "armycity");

  const heading = (text) => main.appendChild(el("h2", null, text));
  const note = (text) => main.appendChild(el("p", "empty", text));

  // A card for one level: "⚔️ Hard".
  function card(board) {
    const c = el("section", "score-card");
    c.appendChild(el("h3", null, "⚔️ " + (Accounts.levelName(board.level) || t(board.game.name))));
    main.appendChild(c);
    return c;
  }

  // One big time: my best, or the best on this device.
  function bigCard(board) {
    card(board).appendChild(el("p", "big", "⏱️ " + Accounts.show(board.game.id, board.rows[0].score)));
  }

  function localSection() {
    const boards = cityBoards(Accounts.localBest());
    if (!boards.length) return false;
    heading(t("📱 On this device"));
    boards.forEach(bigCard);
    return true;
  }

  // The top 10 of one level. Equal times share a place. If I'm further down, my place comes after.
  function topList(board, me) {
    const list = el("ol");
    let place = 0, last = null;
    board.rows.forEach((r, i) => {
      if (r.score !== last) place = i + 1;
      last = r.score;
      const isMe = me && r.player_id === me.id;
      if (i >= 10 && !isMe) return;
      if (i >= 10) list.appendChild(el("li", "gap", "…"));
      const li = el("li", isMe ? "mine" : null);
      li.appendChild(el("span", "rank", place <= 3 ? ["🥇", "🥈", "🥉"][place - 1] : place + "."));
      li.appendChild(el("span", "who", r.username));
      li.appendChild(el("span", "pts", Accounts.show(r.game, r.score)));
      list.appendChild(li);
    });
    card(board).appendChild(list);
  }

  let drawing = 0;
  function draw() {
    drawAccount();
    return tab === "week" ? drawWeek() : drawBest();
  }

  // ---------- This week (since Monday, local time) ----------
  function weekStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  async function drawWeek() {
    const mine = ++drawing;
    main.innerHTML = "";
    note(t("Loading…"));
    const start = weekStart();
    let rows;
    try {
      rows = await Accounts.scoresBetween(start);
    } catch (e) {
      rows = null;
    }
    if (mine !== drawing) return;
    main.innerHTML = "";
    if (!rows) return note(t("Can't reach the internet. Try again later."));
    const next = new Date(start);
    next.setDate(next.getDate() + 7);
    const left = Math.ceil((next - Date.now()) / 86400000);
    note(left > 1 ? t("A new week starts on Monday: {n} days left.", { n: left }) : t("A new week starts on Monday: last day!"));
    note(t("⏱️ Time to win: the fastest wins."));
    const boards = cityBoards(Accounts.bestOf(rows));
    if (!boards.length) return note(t("Nobody has won this week yet. Be the first!"));
    boards.forEach((board) => topList(board, Accounts.player));
  }

  // ---------- All time ----------
  async function drawBest() {
    const mine = ++drawing;
    main.innerHTML = "";
    if (!Accounts.online) {
      if (!localSection()) note(t("No wins yet. Knock out the King Tank to get on the list!"));
      return;
    }
    note(t("Loading…"));
    let rows;
    try {
      rows = await Accounts.bestScores();
    } catch (e) {
      rows = null;
    }
    if (mine !== drawing) return;
    main.innerHTML = "";
    const me = Accounts.player;

    if (!rows) {
      note(t("Can't reach the internet. Try again later."));
      localSection();
      return;
    }

    if (me) {
      // Wins not sent yet (no internet) count too.
      const myBoards = cityBoards(rows.filter((r) => r.player_id === me.id).concat(Accounts.waitingFor(me.id)));
      if (myBoards.length) {
        heading(t("⭐ My best"));
        myBoards.forEach((b) => {
          b.rows.sort((x, y) => x.score - y.score);
          bigCard(b);
        });
      }
    } else {
      note(t("Log in to keep your scores and see everyone's."));
      localSection();
    }

    const boards = cityBoards(rows);
    heading(t("🏆 Top 10"));
    if (!boards.length) return note(t("No wins yet. Knock out the King Tank to get on the list!"));
    note(t("⏱️ Time to win: the fastest wins."));
    boards.forEach((board) => topList(board, me));
  }

  Accounts.onChange(draw);
  show(tab);
})();

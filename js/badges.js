// Badges: earned from the scores a player has saved (see js/accounts.js). Nothing new is stored in
// Supabase: a signed-in player's badges come from their scores on every device, and signed out
// from the rounds played on this device. "Champion of the week" looks at everyone's scores of the
// weeks gone by. A week starts on Monday at midnight, on this device's clock.
// The badges a player has seen are kept in this browser, so a new one pops up in the game once.
window.Badges = (function () {
  const t = I18n.t;
  const ARMY = ["army", "army3d", "armyfps"];
  const SEEN = "kids-games-badges"; // badges seen: { "<player id>" or "device": [badge ids] }

  const wins = (rows) => rows.filter((r) => ARMY.includes(r.game));
  const rounds = (rows) => rows.filter((r) => r.played_at);
  // The days played, as "2026-10-27" on this device's calendar, in order.
  const day = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const days = (rows) => [...new Set(rounds(rows).map((r) => day(new Date(r.played_at))))].sort();
  // The most days in a row.
  function streak(list) {
    let best = 0, run = 0, last = null;
    list.forEach((d) => {
      const prev = new Date(d + "T12:00:00");
      prev.setDate(prev.getDate() - 1);
      run = last === day(prev) ? run + 1 : 1;
      last = d;
      best = Math.max(best, run);
    });
    return best;
  }

  // test(rows) says if the scores earn it. Rows with no date (bests kept on this device from
  // before the badges came) count for what was won, not for how many rounds or which days.
  const LIST = [
    { id: "first", emoji: "🎈", name: "First score", how: "Save your first score.", test: (r) => r.length >= 1 },
    { id: "ten", emoji: "🔟", name: "Ten scores", how: "Save 10 scores.", test: (r) => rounds(r).length >= 10 },
    { id: "days", emoji: "📅", name: "Three days", how: "Play on 3 different days.", test: (r) => days(r).length >= 3 },
    { id: "streak", emoji: "🔥", name: "On fire", how: "Play 3 days in a row.", test: (r) => streak(days(r)) >= 3 },
    { id: "king", emoji: "👑", name: "King Tank down", how: "Win a battle in Army Rush.", test: (r) => wins(r).length >= 1 },
    { id: "hard", emoji: "💪", name: "Tough soldier", how: "Win Army Rush on Hard.",
      test: (r) => wins(r).some((w) => /^(hard|mega)/.test(w.level)) },
    { id: "mega", emoji: "🦸", name: "Mega hero", how: "Win Army Rush on Mega-hard.",
      test: (r) => wins(r).some((w) => /^mega/.test(w.level)) },
    { id: "city", emoji: "🏘️", name: "City commander", how: "Win Army Rush City.",
      test: (r) => wins(r).some((w) => /-city$/.test(w.level)) },
    { id: "fast", emoji: "⚡", name: "Lightning", how: "Win Army Rush in less than 10 minutes.",
      test: (r) => wins(r).some((w) => w.score < 600) },
    { id: "three", emoji: "🎖️", name: "Three victories", how: "Win 3 battles in Army Rush.", test: (r) => wins(r).length >= 3 },
    { id: "math", emoji: "🧑‍🚀", name: "Math astronaut", how: "Get 30 stars in Math Rocket.",
      test: (r) => r.some((x) => x.game === "math" && x.score >= 30) },
    { id: "tables", emoji: "🐣", name: "Egg hatcher", how: "Get 30 stars in Times Table Eggs.",
      test: (r) => r.some((x) => x.game === "tables" && x.score >= 30) },
    { id: "wobbly", emoji: "🦒", name: "Tower builder", how: "Stack 10 characters in Wobbly Tower.",
      test: (r) => r.some((x) => x.game === "wobbly" && x.score >= 10) },
    { id: "wobbly-hard", emoji: "🗼", name: "Wobbly master", how: "Stack 8 characters in Wobbly Tower on Hard or Mega-hard.",
      test: (r) => r.some((x) => x.game === "wobbly" && /^(hard|mega)$/.test(x.level) && x.score >= 8) },
    { id: "candy", emoji: "🍭", name: "Candy seller", how: "Get 30 stars in Candy Shop.",
      test: (r) => r.some((x) => x.game === "candy" && x.score >= 30) },
    { id: "bricks", emoji: "🏗️", name: "Master builder", how: "Save a building of 100 bricks in Legoworld.",
      test: (r) => r.some((x) => x.game === "bricks" && x.score >= 100) },
    { id: "champion", emoji: "🥇", name: "Champion of the week", how: "Be number 1 in a game when the week ends." },
  ];

  // Monday 00:00 of the week `d` is in, on this device's clock.
  function weekStart(d) {
    const x = new Date(d || Date.now());
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(SEEN)) || {};
    } catch (e) {
      return {};
    }
  }
  function store(all) {
    try {
      localStorage.setItem(SEEN, JSON.stringify(all));
    } catch (e) {
      // Private window: new badges may pop up again next time.
    }
  }
  const who = () => (Accounts.online && Accounts.player ? Accounts.player.id : "device");

  // The scores that count: from every device when signed in, else from this one.
  async function scores() {
    const me = Accounts.online && Accounts.player;
    if (me) {
      try {
        return (await Accounts.playerScores(me.id)).concat(Accounts.waitingFor(me.id));
      } catch (e) {
        return Accounts.history(me.id);
      }
    }
    const rows = Accounts.history();
    // Bests kept here before there was a history still win their badges.
    return rows.concat(Accounts.localBest().filter((b) => !rows.some((r) => r.game === b.game && r.level === b.level)));
  }

  // How many weeks the player ended at number 1 of a game (and level) that at least one other
  // player played that week. Signed out, or with no internet: 0.
  async function championWeeks(mine) {
    const me = Accounts.online && Accounts.player;
    const first = rounds(mine)[0];
    if (!me || !first) return 0;
    const from = weekStart(first.played_at), to = weekStart();
    if (from >= to) return 0;
    let rows;
    try {
      rows = await Accounts.scoresBetween(from, to);
    } catch (e) {
      return 0;
    }
    const weeks = new Map();
    rows.forEach((r) => {
      const k = weekStart(r.played_at).getTime();
      if (!weeks.has(k)) weeks.set(k, []);
      weeks.get(k).push(r);
    });
    let won = 0;
    weeks.forEach((list) => {
      const top = Accounts.boards(Accounts.bestOf(list)).some((b) =>
        b.rows.length >= 2 && b.rows.some((r) => r.player_id === me.id && r.score === b.rows[0].score));
      if (top) won++;
    });
    return won;
  }

  // Every badge with what the player did: [{ ...badge, got, times, fresh }]. fresh: not seen before.
  // withChampion also works out the weeks won (it reads everyone's scores, so only the Badges page does).
  async function list(withChampion) {
    const rows = await scores();
    const weeks = withChampion ? await championWeeks(rows) : 0;
    const all = load();
    const key = who();
    const seen = all[key] || [];
    const out = LIST.map((b) => {
      const got = b.id === "champion" ? weeks > 0 : b.test(rows);
      return Object.assign({}, b, { got, times: b.id === "champion" ? weeks : 0, fresh: got && !seen.includes(b.id) });
    });
    // The champion badge is only known on the Badges page: elsewhere, keep what was seen.
    all[key] = [...new Set(seen.filter((id) => id === "champion" && !withChampion)
      .concat(out.filter((b) => b.got).map((b) => b.id)))];
    store(all);
    return out;
  }

  // Badges the player has earned, as far as this browser knows.
  const count = () => (load()[who()] || []).length;

  // ---------- "New badge!" in a game ----------
  let box = null, hideAt = 0;
  function pop(badges) {
    if (!box) {
      box = document.createElement("div");
      box.className = "badge-pop";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = badges.length > 1 ? t("🏅 New badges!") : t("🏅 New badge!");
    box.appendChild(title);
    badges.slice(0, 4).forEach((b) => {
      const line = document.createElement("span");
      line.textContent = b.emoji + " " + t(b.name);
      box.appendChild(line);
    });
    box.classList.add("show");
    hideAt = Date.now() + 4500;
    setTimeout(() => {
      if (Date.now() >= hideAt) box.classList.remove("show");
    }, 4600);
  }

  // A player new to this browser (or the first visit since badges came): find the badges they
  // already have without popping them up, so only the next ones are "new".
  async function catchUp() {
    if (load()[who()]) return;
    await list(false);
    Accounts.redraw();
  }
  Accounts.onChange(catchUp);
  catchUp();

  // After every score: show the badges it earned.
  Accounts.onScore(async () => {
    const fresh = (await list(false)).filter((b) => b.fresh);
    if (fresh.length) pop(fresh);
  });

  I18n.add({
    fr: {
      "🏅 New badge!": "🏅 Nouveau badge !",
      "🏅 New badges!": "🏅 Nouveaux badges !",
      "First score": "Premier score",
      "Save your first score.": "Enregistre ton premier score.",
      "Ten scores": "Dix scores",
      "Save 10 scores.": "Enregistre 10 scores.",
      "Three days": "Trois jours",
      "Play on 3 different days.": "Joue 3 jours différents.",
      "On fire": "En feu",
      "Play 3 days in a row.": "Joue 3 jours de suite.",
      "King Tank down": "Roi Tank K.O.",
      "Win a battle in Army Rush.": "Gagne une bataille dans Armée en folie.",
      "Tough soldier": "Soldat costaud",
      "Win Army Rush on Hard.": "Gagne Armée en folie en Difficile.",
      "Mega hero": "Méga héros",
      "Win Army Rush on Mega-hard.": "Gagne Armée en folie en Méga-difficile.",
      "City commander": "Chef de ville",
      "Win Army Rush City.": "Gagne Armée en folie : la ville.",
      "Lightning": "Éclair",
      "Win Army Rush in less than 10 minutes.": "Gagne Armée en folie en moins de 10 minutes.",
      "Three victories": "Trois victoires",
      "Win 3 battles in Army Rush.": "Gagne 3 batailles dans Armée en folie.",
      "Math astronaut": "Astronaute des maths",
      "Get 30 stars in Math Rocket.": "Gagne 30 étoiles dans La fusée des maths.",
      "Egg hatcher": "Pro de l'éclosion",
      "Get 30 stars in Times Table Eggs.": "Gagne 30 étoiles dans Les œufs des tables.",
      "Tower builder": "Bâtisseur de tour",
      "Stack 10 characters in Wobbly Tower.": "Empile 10 personnages dans Tour bancale.",
      "Wobbly master": "Roi de l'équilibre",
      "Stack 8 characters in Wobbly Tower on Hard or Mega-hard.": "Empile 8 personnages dans Tour bancale en Difficile ou Méga-difficile.",
      "Candy seller": "Pro de la confiserie",
      "Get 30 stars in Candy Shop.": "Gagne 30 étoiles dans La confiserie.",
      "Master builder": "Grand bâtisseur",
      "Save a building of 100 bricks in Legoworld.": "Enregistre une construction de 100 briques dans Legoworld.",
      "Champion of the week": "Champion de la semaine",
      "Be number 1 in a game when the week ends.": "Sois numéro 1 d'un jeu quand la semaine se termine.",
    },
    "zh-HK": {
      "🏅 New badge!": "🏅 新徽章！",
      "🏅 New badges!": "🏅 新徽章！",
      "First score": "第一個分數",
      "Save your first score.": "留低你第一個分數。",
      "Ten scores": "十個分數",
      "Save 10 scores.": "留低 10 個分數。",
      "Three days": "玩咗三日",
      "Play on 3 different days.": "喺 3 日唔同嘅日子玩。",
      "On fire": "火熱",
      "Play 3 days in a row.": "連續 3 日都玩。",
      "King Tank down": "打低坦克王",
      "Win a battle in Army Rush.": "喺軍隊大衝鋒贏一場仗。",
      "Tough soldier": "硬淨士兵",
      "Win Army Rush on Hard.": "用「困難」贏軍隊大衝鋒。",
      "Mega hero": "超級英雄",
      "Win Army Rush on Mega-hard.": "用「超級難」贏軍隊大衝鋒。",
      "City commander": "城市司令",
      "Win Army Rush City.": "贏軍隊大衝鋒：城市版。",
      "Lightning": "閃電",
      "Win Army Rush in less than 10 minutes.": "10 分鐘之內贏軍隊大衝鋒。",
      "Three victories": "三場勝仗",
      "Win 3 battles in Army Rush.": "喺軍隊大衝鋒贏 3 場仗。",
      "Math astronaut": "數學太空人",
      "Get 30 stars in Math Rocket.": "喺數學火箭攞 30 粒星。",
      "Egg hatcher": "孵蛋高手",
      "Get 30 stars in Times Table Eggs.": "喺乘數表孵蛋攞 30 粒星。",
      "Tower builder": "砌塔師傅",
      "Stack 10 characters in Wobbly Tower.": "喺搖搖塔疊 10 個公仔。",
      "Wobbly master": "平衡大師",
      "Stack 8 characters in Wobbly Tower on Hard or Mega-hard.": "用「困難」或者「超級難」喺搖搖塔疊 8 個公仔。",
      "Candy seller": "糖果舖老闆",
      "Get 30 stars in Candy Shop.": "喺糖果舖攞 30 粒星。",
      "Master builder": "建築大師",
      "Save a building of 100 bricks in Legoworld.": "喺 Legoworld 積木世界儲存一個有 100 粒積木嘅作品。",
      "Champion of the week": "本週冠軍",
      "Be number 1 in a game when the week ends.": "一個星期完嗰陣，喺一個遊戲排第一。",
    },
  });

  return { list, count, weekStart, all: LIST };
})();

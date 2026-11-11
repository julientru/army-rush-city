// Languages: English, French and Cantonese (written in Traditional Chinese, zh-HK).
// The first visit picks a language from the browser settings; a choice made with the
// switch on the hub is remembered in this browser. ?lang=fr (or en, zh-HK) forces one.
//
// The English text is the key: I18n.t("Easy") gives "Facile" in French, and anything
// with no translation stays in English. "{n}" in a text is filled from the second
// argument: I18n.t("Wave {n} done!", { n: 3 }).
// Once the page has loaded, every text and aria-label in it that has a translation
// is swapped, so plain HTML needs no markup. Each page adds its own texts with I18n.add.
window.I18n = (function () {
  const LANGS = [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "zh-HK", label: "廣東話" },
  ];
  const STORE = "kids-games-lang";
  const dict = { fr: {}, "zh-HK": {} };

  function known(code) {
    return LANGS.some((l) => l.code === code) ? code : null;
  }

  // Browser language tags to one of ours: fr-CA → fr, yue / zh-HK / zh-MO / zh-Hant → zh-HK.
  function fromTag(tag) {
    tag = String(tag || "").toLowerCase();
    if (tag === "fr" || tag.startsWith("fr-")) return "fr";
    if (tag === "yue" || tag.startsWith("yue-") || tag.startsWith("zh-hk") || tag.startsWith("zh-mo") ||
      tag.startsWith("zh-hant")) return "zh-HK";
    if (tag === "en" || tag.startsWith("en-")) return "en";
    return null;
  }

  function saved() {
    try {
      return known(localStorage.getItem(STORE));
    } catch (e) {
      return null;
    }
  }

  function detect() {
    const forced = new URLSearchParams(location.search).get("lang");
    if (forced && (known(forced) || fromTag(forced))) return known(forced) || fromTag(forced);
    const mine = saved();
    if (mine) return mine;
    const tags = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      const code = fromTag(tag);
      if (code) return code;
    }
    return "en";
  }

  const lang = detect();
  document.documentElement.lang = lang;

  const squash = (s) => s.replace(/\s+/g, " ").trim();

  function t(text, vars) {
    const table = dict[lang];
    let out = (table && table[squash(text)]) || text;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  }

  // A list of texts (like random cheers): the translated list, or the English one.
  function list(texts) {
    const table = dict[lang];
    const key = "[" + texts.join("|") + "]";
    return (table && table[key]) || texts;
  }

  function add(tables) {
    Object.keys(tables).forEach((code) => {
      if (!dict[code]) return;
      const from = tables[code];
      Object.keys(from).forEach((k) => {
        const v = from[k];
        dict[code][Array.isArray(v) ? k : squash(k)] = v;
      });
    });
  }

  // Swap every translated text node and label under root, keeping the spaces around it.
  function translatePage(root) {
    if (lang === "en") return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const raw = node.nodeValue;
      const key = squash(raw);
      if (!key || !dict[lang][key]) return;
      node.nodeValue = raw.match(/^\s*/)[0] + dict[lang][key] + raw.match(/\s*$/)[0];
    });
    root.querySelectorAll("[aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("aria-label")));
    });
    document.title = t(document.title);
  }

  function choose(code) {
    try {
      localStorage.setItem(STORE, code);
    } catch (e) {
      // Private window: the choice lasts until the page is closed.
    }
    // Drop a forced ?lang= so the new choice wins, then reload in the new language.
    // Going to the same address only jumps to its #hash (the hub keeps #players=2 there)
    // without reloading, so that case needs a real reload.
    const url = new URL(location.href);
    url.searchParams.delete("lang");
    if (url.href !== location.href) location.href = url.href;
    else if (code !== lang) location.reload();
  }

  // Buttons to pick a language, filled into an element on the page (the hub has one).
  function makeSwitch(holder) {
    LANGS.forEach((l) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.lang = l.code;
      btn.textContent = l.label;
      btn.setAttribute("aria-pressed", String(l.code === lang));
      btn.addEventListener("click", () => choose(l.code));
      holder.appendChild(btn);
    });
  }

  // Texts shared by many games.
  add({
    fr: {
      "Back to games": "Retour aux jeux",
      "Easy": "Facile",
      "Medium": "Moyen",
      "Hard": "Difficile",
      "New game": "Nouvelle partie",
      "Play": "Jouer",
      "Play again": "Rejouer",
      "Restart": "Recommencer",
      "▶️ Play": "▶️ Jouer",
      "🔄 Again": "🔄 Encore",
      "😊 Good try!": "😊 Bien essayé !",
      "🏆 You win!": "🏆 Tu as gagné !",
      "⭐ Score:": "⭐ Score :",
      "🏆 Best:": "🏆 Record :",
      "👆 Moves:": "👆 Coups :",
      "⭐ Stars:": "⭐ Étoiles :",
      "Row {r} column {c}": "Ligne {r} colonne {c}",
      "Choose the board size": "Choisis la taille du plateau",
    },
    "zh-HK": {
      "Back to games": "返去遊戲",
      "Easy": "容易",
      "Medium": "中等",
      "Hard": "困難",
      "New game": "新一局",
      "Play": "開始",
      "Play again": "再玩",
      "Restart": "重新開始",
      "▶️ Play": "▶️ 開始",
      "🔄 Again": "🔄 再嚟",
      "😊 Good try!": "😊 好叻呀，下次再嚟！",
      "🏆 You win!": "🏆 你贏咗！",
      "⭐ Score:": "⭐ 分數：",
      "🏆 Best:": "🏆 最高分：",
      "👆 Moves:": "👆 步數：",
      "⭐ Stars:": "⭐ 星星：",
      "Row {r} column {c}": "第 {r} 排，第 {c} 個",
      "Choose the board size": "揀板嘅大細",
    },
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => translatePage(document.body));
  } else {
    translatePage(document.body);
  }

  return { lang, langs: LANGS, t, list, add, makeSwitch, translate: translatePage };
})();

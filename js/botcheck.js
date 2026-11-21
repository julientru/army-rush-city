// Bot check for new players: Cloudflare Turnstile (see supabase/README.md, "Bots").
// The same file is in kids-games (js/botcheck.js), army-rush-city (js/botcheck.js) and
// raiding-pirates (src/botcheck.js): change it here and copy it to the other two.
//
// BotCheck.token(siteKey) gives a one-time Turnstile token to send with sign_up.
// With no site key it gives "" at once, and sign-up works as before.
// Most people see nothing: Turnstile only shows a box ("Verify you are human") when it is unsure.
(function () {
  const API = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  let loading = null;

  function load() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = API;
        s.async = true;
        s.onload = function () { window.turnstile ? resolve(window.turnstile) : reject(new Error("botcheck")); };
        s.onerror = function () { loading = null; reject(new Error("botcheck")); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function token(siteKey) {
    if (!siteKey) return Promise.resolve("");
    return load().then(function (ts) {
      return new Promise(function (resolve, reject) {
        // Inside an open modal <dialog> (the rest of the page can't be clicked then), else on the page.
        const where = document.querySelector("dialog[open]") || document.body;
        const box = document.createElement("div");
        box.className = "botcheck";
        box.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;";
        where.appendChild(box);
        let id = null;
        let done = false;
        function finish(err, value) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { if (id !== null) ts.remove(id); } catch (e) { /* already gone */ }
          box.remove();
          err ? reject(err) : resolve(value);
        }
        // Someone who walks away from the "Verify you are human" box: give up after 2 minutes.
        const timer = setTimeout(function () { finish(new Error("botcheck")); }, 120000);
        try {
          id = ts.render(box, {
            sitekey: siteKey,
            appearance: "interaction-only",
            language: document.documentElement.lang || "auto",
            callback: function (value) { finish(null, value); },
            "error-callback": function () { finish(new Error("botcheck")); return true; },
            "expired-callback": function () { finish(new Error("botcheck")); },
            "timeout-callback": function () { finish(new Error("botcheck")); },
          });
        } catch (e) {
          finish(new Error("botcheck"));
        }
      });
    });
  }

  window.BotCheck = { token: token };
})();

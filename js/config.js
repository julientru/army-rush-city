// Supabase project for player accounts and best scores (see supabase/README.md).
// Paste your project's URL and its public key (Project Settings → API Keys:
// the "publishable" key, or the legacy "anon public" key). Both are safe to publish:
// row-level security in supabase/setup.sql decides what anyone can do.
// Left empty, the games still work and keep best scores on this device only.
window.KIDS_GAMES_SUPABASE = {
  url: "https://evwcfqrhrfvaovboevto.supabase.co",
  key: "sb_publishable_gfw0jfYXsgoG7uCF5edgMg_Wui6a95e",
  // Bot check for new players (js/botcheck.js): the Cloudflare Turnstile *site key* (0x4AAA…),
  // also public. The same key works in kids-games, army-rush-city and raiding-pirates.
  // Left empty, new players sign up with no bot check. See kids-games' supabase/README.md, "Bots".
  turnstileSiteKey: "",
};

// Copies the built site into the public-pages repo next to this one: empties
// ../public-pages/docs/army-rush, then copies everything inside ./dist there.
// Run `npm run build-standalone` first. Works the same on macOS, Linux and Windows.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(root, "dist");
const TARGET = resolve(root, "..", "public-pages", "docs", "army-rush");

function fail(message) {
  console.error("publish-dist: " + message);
  process.exit(1);
}

if (!existsSync(join(DIST, "index.html"))) {
  fail(`${DIST} has no index.html. Run "npm run build-standalone" first.`);
}
// The public-pages repo must already be checked out beside this one; never create it by mistake.
if (!existsSync(dirname(TARGET)) || !statSync(dirname(TARGET)).isDirectory()) {
  fail(`${dirname(TARGET)} does not exist. Clone public-pages next to army-rush-city first.`);
}

mkdirSync(TARGET, { recursive: true });
const old = readdirSync(TARGET);
for (const name of old) rmSync(join(TARGET, name), { recursive: true, force: true });
for (const name of readdirSync(DIST)) cpSync(join(DIST, name), join(TARGET, name), { recursive: true });

const count = (dir) => readdirSync(dir).reduce((n, name) => {
  const path = join(dir, name);
  return n + (statSync(path).isDirectory() ? count(path) : 1);
}, 0);
console.log(`Emptied ${TARGET} (${old.length} entries) and copied ${count(TARGET)} files from ./dist`);

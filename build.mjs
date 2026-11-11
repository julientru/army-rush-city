// Production build: minifies every page, script and stylesheet into ./dist.
// Scripts and stylesheets get a hash of their content in their name (js/hub.3f9a1c2b.js) and the pages
// point at those names, so a browser fetches a file again exactly when it changed.
// Only ./dist is published; supabase/, the READMEs and this script stay out of it.
import { minify as minifyHtml } from "html-minifier-terser";
import { minify as minifyJs } from "terser";
import CleanCSS from "clean-css";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, posix, relative } from "node:path";

const OUT = "dist";
// What the site is made of. Anything else in the repo is not published.
const SOURCES = ["index.html", "login.html", "scores.html", ".nojekyll", "css", "js", "game"];
// Already minified: hashed but not minified again.
const MINIFIED = /\.min\.js$/;

const css = new CleanCSS({ level: 1 });

function files(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

function write(file, content) {
  const out = join(OUT, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
}

async function minifyAsset(file, src) {
  if (MINIFIED.test(file)) return src;
  if (extname(file) === ".css") {
    const { styles, errors } = css.minify(src);
    if (errors.length) throw new Error(file + ": " + errors.join(", "));
    return styles;
  }
  // Every file is a classic script sharing globals with the others, so top-level names are kept.
  return (await minifyJs(src, { compress: true, mangle: true })).code;
}

// Points every src="…" / href="…" of a page at the hashed name of the script or stylesheet it loads.
function rewriteRefs(page, html, hashed) {
  return html.replace(/\b(src|href)="([^"#?:]+\.(?:js|css))"/g, (match, attr, ref) => {
    const target = posix.join(posix.dirname(page), ref);
    if (!hashed.has(target)) throw new Error(`${page}: ${ref} is not part of the site`);
    return `${attr}="${posix.relative(posix.dirname(page), hashed.get(target))}"`;
  });
}

rmSync(OUT, { recursive: true, force: true });
const all = SOURCES.flatMap(files).map((f) => f.split("\\").join("/"));
const assets = all.filter((f) => /\.(js|css)$/.test(f));
const pages = all.filter((f) => f.endsWith(".html"));

const hashed = new Map();
for (const file of assets) {
  const code = await minifyAsset(file, readFileSync(file, "utf8"));
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 8);
  const name = file.replace(/(\.min)?\.(js|css)$/, `.${hash}$&`);
  hashed.set(file, name);
  write(name, code);
}

for (const page of pages) {
  const html = rewriteRefs(page, readFileSync(page, "utf8"), hashed);
  write(page, await minifyHtml(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  }));
}

for (const file of all) {
  if (!hashed.has(file) && !pages.includes(file)) cpSync(file, join(OUT, file));
}

const size = (list) => list.reduce((n, f) => n + statSync(f).size, 0);
const kb = (n) => Math.round(n / 1024) + " KB";
const built = files(OUT);
console.log(`Built ${built.length} files into ./${OUT}: ${kb(size(all))} -> ${kb(size(built))}`);

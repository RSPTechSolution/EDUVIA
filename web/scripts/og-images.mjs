// Generates the 1200x630 share images in public/og/ (the default card and one per feature page).
//   node scripts/og-images.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, "..");
const out = path.join(web, "public", "og");
fs.mkdirSync(out, { recursive: true });

// Feature names and slugs, read from the content file (kept in one place).
const src = fs.readFileSync(path.join(web, "src", "content", "features.ts"), "utf8");
const features = [...src.matchAll(/slug: "([^"]+)",\s*name: "([^"]+)",\s*metaTitle: "([^"]+)"/g)].map((m) => ({ slug: m[1], name: m[2], title: m[3] }));

const crest = fs.readFileSync(path.join(web, "public", "brand", "crest-reverse.svg"), "utf8").replace(/<title>.*?<\/title>/, "");
const cinzel = "file:///" + path.join(web, "src", "fonts", "Cinzel-SemiBold.ttf").replace(/\\/g, "/");

const card = ({ eyebrow, title, line }) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@500&display=block">
<style>
@font-face { font-family: Cinzel; src: url("${cinzel}"); font-weight: 600; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #15233F; color: #F7F2E8; font-family: Inter, "Segoe UI", sans-serif; position: relative; overflow: hidden; }
.glow { position: absolute; width: 720px; height: 720px; right: -220px; top: -260px; border-radius: 50%; background: radial-gradient(closest-side, rgba(184,137,60,.35), transparent); }
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: #B8893C; }
.wrap { position: relative; height: 100%; padding: 64px 80px 74px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 22px; }
.brand svg { width: 74px; height: 83px; }
.name { font-family: Cinzel, serif; font-size: 40px; letter-spacing: 5px; }
.tag { font-family: Cinzel, serif; font-size: 15px; letter-spacing: 5px; color: #D9AE62; margin-top: 6px; }
.eyebrow { font-size: 22px; letter-spacing: 3px; text-transform: uppercase; color: #D9AE62; font-weight: 500; }
h1 { font-family: "Plus Jakarta Sans", sans-serif; font-weight: 800; font-size: 62px; line-height: 1.08; letter-spacing: -1px; margin-top: 14px; max-width: 980px; }
.line { font-size: 26px; color: #C9CFDB; }
</style></head><body><div class="glow"></div><div class="rule"></div><div class="wrap">
<div class="brand">${crest}<div><div class="name">VIDYANEXA</div><div class="tag">SCHOOL MANAGEMENT</div></div></div>
<div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>
<div class="line">${line}</div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
async function shot(name, data) {
  await page.setContent(card(data), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(`${name}.png`);
}
await shot("vidyanexa", { eyebrow: "School ERP for Indian schools", title: "Run your whole school from one place", line: "Admissions · Attendance · Fees · Exams · Transport · HR · Parent app" });
for (const f of features) {
  await shot(f.slug, { eyebrow: f.name, title: f.title.replace(/ \(.*\)$/, ""), line: "School management software for Indian schools" });
}
await browser.close();

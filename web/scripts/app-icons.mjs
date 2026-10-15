// Draws the mobile app's icon and splash images (theme version 2: the crest on Material navy) into mobile/assets/brand/.
//   node scripts/app-icons.mjs        then, in mobile/: dart run flutter_launcher_icons && dart run flutter_native_splash:create
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const brand = path.join(here, "..", "..", "mobile", "assets", "brand");
const crest = "data:image/png;base64," + fs.readFileSync(path.join(brand, "crest-reverse.png")).toString("base64");
const NAVY = "#2F4A86";

// name, size, background (null = transparent), crest height as a share of the size, white silhouette
const IMAGES = [
  ["launcher.png", 1024, NAVY, 0.6, false],             // iOS and the web: full square, no transparency
  ["launcher-foreground.png", 1024, null, 0.44, false], // Android adaptive icon: inside the 66% safe zone
  ["launcher-monochrome.png", 1024, null, 0.44, true],  // Android 13+ themed icon (tinted by the system)
  ["launcher-dark.png", 1024, null, 0.6, false],        // iOS 18 dark icon: transparent, the system adds the dark tile
  ["splash.png", 768, null, 0.5, false],                // splash logo, centred on the navy (or dark) splash colour
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, bg, share, mono] of IMAGES) {
  const data = await page.evaluate(async ({ crest, size, bg, share, mono }) => {
    const img = new Image();
    img.src = crest;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
    const h = size * share, w = h * (img.width / img.height);
    g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    // Themed icon: one colour, shaped by transparency. Light parts of the crest stay, the dark book becomes a cut-out.
    if (mono) {
      const px = g.getImageData(0, 0, size, size);
      for (let i = 0; i < px.data.length; i += 4) {
        const [r, gr, b, a] = px.data.subarray(i, i + 4);
        const light = (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255;
        px.data.set([255, 255, 255, light > 0.35 ? a : 0], i);
      }
      g.putImageData(px, 0, 0);
    }
    return c.toDataURL("image/png").split(",")[1];
  }, { crest, size, bg, share, mono });
  fs.writeFileSync(path.join(brand, name), Buffer.from(data, "base64"));
  console.log(name);
}
await browser.close();

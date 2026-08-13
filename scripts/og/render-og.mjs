// Rasterise l'OG de marque AlbaWay en PNG 1200x630 via Chromium (Playwright).
// Usage: node scripts/og/render-og.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlUrl = pathToFileURL(path.join(here, 'og-template.html')).href;
const out = path.join(here, '..', '..', 'public', 'og-image.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(htmlUrl, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('OG écrite ->', out);

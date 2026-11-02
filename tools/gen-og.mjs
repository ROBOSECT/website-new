// The social preview images public/og-logo.png (EN) and public/og-logo-it.png (IT), 1200 × 630: the layout of the B2 cards
// (proposte/B/work/og), with the logo D3 «Capocorda» (the kit's negativo, verbatim) whose stem runs on as the page cable down
// out of the card. Do not edit the PNGs by hand: run `python3 tools/gen-logo.py` first (it copies the logotype), then
//     node tools/gen-og.mjs            (from the site folder; Playwright from the global node modules)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(SITE + 'src/assets/brand/robosect-logotipo-negativo-stretto.svg', 'utf8');
const [, vb] = svg.match(/viewBox="([^"]+)"/);
const [vx, vy, vw, vh] = vb.split(' ').map(Number);
const paths = [...svg.matchAll(/<path [^>]*\/>/g)].map((m) => m[0]).join('');
// the R's stem, from the generated geometry (lib/cable-geometry.ts): its centre, the cable's width, the foot on the baseline
const geo = readFileSync(SITE + 'src/lib/cable-geometry.ts', 'utf8');
const val = (k) => +geo.match(new RegExp('\\b' + k + ': ([\\d.-]+)'))[1];
const stem = { x: val('stemX') - val('w') / 2, w: val('w'), foot: val('stemFootY') };
// the card's two faces, inlined (a page set from a string cannot load file:// fonts)
const font = (f) => 'data:font/woff2;base64,' + readFileSync(SITE + 'node_modules/@fontsource/' + f).toString('base64');

const W = 1200, H = 630, INK = '#0D1B2E', PAPER = '#F4F1EC', CU_LT = '#EC8A52', STEEL_LT = '#9AA6B5';
const scale = 1.08, capTop = 176, left = 96;
// the cable below the stem foot, down past the card's bottom edge (units)
const ext = (H - capTop) / scale - stem.foot + 2;
const tagX = left + Math.round((stem.x + stem.w + val('clear')) * scale) + 40; // the words: right of the cable, past the clear space
const tagY = capTop + Math.round(96 * scale) + 64;

const COPY = {
	en: { out: 'og-logo.png', lbl: 'Robotics for cables, wiring harnesses &amp; switchboards', tag: 'Automation, down to<br>the last <b>wire.</b>', foot: 'University of Bologna spin-off · Bologna, Italy' },
	it: { out: 'og-logo-it.png', lbl: 'Robotica per cavi, cablaggi e quadri elettrici', tag: 'Automazione, fino<br>all’ultimo <b>filo.</b>', foot: 'Spin-off dell’Università di Bologna · Bologna' },
};

const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(${font('space-grotesk/files/space-grotesk-latin-500-normal.woff2')}) format("woff2");font-weight:500}
@font-face{font-family:JB;src:url(${font('jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2')}) format("woff2");font-weight:500}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${INK}}
.card{position:relative;width:${W}px;height:${H}px;background:${INK};overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(244,241,236,.045) 1px,transparent 1px),linear-gradient(to bottom,rgba(244,241,236,.045) 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px;-webkit-mask-image:linear-gradient(100deg,transparent 35%,#000 95%)}
.lbl{position:absolute;font:500 15px/1 JB;letter-spacing:.14em;color:${STEEL_LT};text-transform:uppercase}
.tag{position:absolute;left:${tagX}px;top:${tagY}px;font:500 46px/1.1 SG;letter-spacing:-.01em;color:${PAPER}}
.tag b{font-weight:500;color:${CU_LT}}
</style></head><body><div class="card"><div class="grid"></div>
<div class="lbl" style="left:${left}px;top:96px">${c.lbl}</div>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh + ext}" width="${vw * scale}" height="${(vh + ext) * scale}" style="position:absolute;left:${left}px;top:${capTop + vy * scale}px;overflow:visible"><rect x="${stem.x}" y="${stem.foot - stem.w / 2}" width="${stem.w}" height="${ext + stem.w / 2}" fill="${PAPER}" stroke="none"/>${paths}</svg>
<div class="tag">${c.tag}</div>
<div class="lbl" style="left:${tagX}px;bottom:72px;font-size:13px">${c.foot}</div>
</div></body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const c of Object.values(COPY)) {
	await p.setContent(page(c), { waitUntil: 'load' });
	await p.evaluate(() => document.fonts.ready);
	await p.screenshot({ path: SITE + 'public/' + c.out });
}
await b.close();
console.log('og images:', Object.values(COPY).map((c) => c.out).join(', '), '· words at x', tagX);

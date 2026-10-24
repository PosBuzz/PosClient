// Builds the two user manuals from Markdown into PDFs that ship inside each app.
//
//   npm run build   (from docs/manual)  writes the PDFs
//   npm run check   fails if a committed PDF is older than its Markdown or images
//
// Source:  docs/manual/<app>/*.md (joined in file-name order) and docs/manual/images/<app>/*
// Output:  consumer/public/manual/PosBuzz-Shop-App-Manual.pdf
//          admin/public/manual/PosBuzz-Admin-Manual.pdf
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import sharp from "sharp";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const manuals = [
  { app: "consumer", title: "PosBuzz Shop App Manual", subtitle: "For shop owners, managers and cashiers", out: join(root, "consumer/public/manual/PosBuzz-Shop-App-Manual.pdf") },
  { app: "admin", title: "PosBuzz Admin Panel Manual", subtitle: "For the PosBuzz team", out: join(root, "admin/public/manual/PosBuzz-Admin-Manual.pdf") },
];

const files = (app) => readdirSync(join(here, app)).filter((f) => f.endsWith(".md")).sort().map((f) => join(here, app, f));
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])) : []);
const newest = (paths) => Math.max(0, ...paths.map((p) => statSync(p).mtimeMs));

if (process.argv.includes("--check")) {
  let stale = false;
  for (const m of manuals) {
    const sources = [...files(m.app), ...walk(join(here, "images", m.app)), join(here, "build.mjs")];
    if (!existsSync(m.out) || statSync(m.out).mtimeMs < newest(sources)) {
      console.error(`STALE: ${m.out} is older than its sources. Run "npm run build" in docs/manual and commit the PDF.`);
      stale = true;
    }
  }
  process.exit(stale ? 1 : 0);
}

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const imageCache = new Map();
const imageData = async (path) => {
  if (!imageCache.has(path)) {
    const jpg = await sharp(path).resize({ width: 960, withoutEnlargement: true }).flatten({ background: "#fff" }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
    imageCache.set(path, `data:image/jpeg;base64,${jpg.toString("base64")}`);
  }
  return imageCache.get(path);
};

async function render(m) {
  const md = files(m.app).map((f) => readFileSync(f, "utf8")).join("\n\n");
  const headings = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = `${slug(text)}-${headings.length}`;
    if (depth <= 2) headings.push({ depth, text, id });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  let html = marked.parse(md, { renderer, gfm: true });
  // Inline every image so the PDF is a single file; screenshots become compressed JPEGs.
  const srcs = [...new Set([...html.matchAll(/<img src="([^"]+)"/g)].map((x) => x[1]))];
  const missing = [];
  for (const src of srcs) {
    const p = join(here, src);
    if (!existsSync(p)) { missing.push(src); continue; }
    html = html.split(`src="${src}"`).join(`src="${await imageData(p)}"`);
  }
  if (missing.length) throw new Error(`${m.app}: missing images: ${missing.join(", ")}`);
  const toc = headings
    .map((h) => `<div class="toc${h.depth}"><a href="#${h.id}">${h.text}</a></div>`)
    .join("\n");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(m.title)}</title><style>
  @page { size: A4; margin: 18mm 15mm 18mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1f2933; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border-left: 8px solid #1677ff; padding-left: 14mm; }
  .cover h1 { font-size: 34pt; margin: 0 0 6mm; border: 0; }
  .cover p { font-size: 14pt; color: #52606d; margin: 0 0 3mm; }
  .toc-page { page-break-after: always; }
  .toc-page h1 { font-size: 20pt; }
  .toc1 { font-weight: 700; margin-top: 4mm; font-size: 11pt; }
  .toc2 { margin-left: 6mm; font-size: 10pt; }
  .toc-page a { color: inherit; text-decoration: none; }
  h1 { font-size: 22pt; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2px solid #1677ff; page-break-before: always; }
  .toc-page h1, .cover h1 { page-break-before: auto; }
  h2 { font-size: 16pt; margin: 9mm 0 3mm; color: #0b3d91; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 4mm 0 1mm; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  img { max-width: 100%; max-height: 108mm; width: auto; height: auto; border: 1px solid #d5dbe1; border-radius: 4px; display: block; margin: 3mm auto 0; page-break-inside: avoid; }
  p:has(> img) { page-break-after: avoid; margin-bottom: 0; }
  p > em:only-child { display: block; text-align: center; color: #52606d; font-size: 9pt; margin: 1mm 0 4mm; }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: #eef2f7; text-align: left; }
  th, td { border: 1px solid #cfd6dd; padding: 1.5mm 2.5mm; vertical-align: top; }
  blockquote { margin: 3mm 0; padding: 2mm 4mm; background: #fff8e1; border-left: 4px solid #f2a900; page-break-inside: avoid; }
  blockquote p { margin: 1mm 0; }
  code { background: #eef2f7; padding: 0 1mm; border-radius: 2px; font-size: 9.5pt; }
  ol, ul { padding-left: 6mm; }
  </style></head><body>
  <section class="cover"><h1>${esc(m.title)}</h1><p>${esc(m.subtitle)}</p><p>Edition of ${date}</p></section>
  <section class="toc-page"><h1>Contents</h1>${toc}</section>
  ${html}
  </body></html>`;
}

const browser = await chromium.launch();
try {
  for (const m of manuals) {
    const html = await render(m);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    mkdirSync(dirname(m.out), { recursive: true });
    const pdf = await page.pdf({
      path: m.out,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#7b8794;padding:0 15mm;display:flex;justify-content:space-between"><span>${esc(m.title)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", bottom: "18mm", left: "15mm", right: "15mm" },
    });
    console.log(`${m.app}: ${(pdf.length / 1024 / 1024).toFixed(1)} MB -> ${m.out}`);
    await page.close();
  }
} finally {
  await browser.close();
}

"use strict";
/**
 * exportService.js
 * Converts a generated Markdown report into:
 *   - styled HTML (for polished in-app view / email)
 *   - a Word .docx buffer (via html-to-docx)
 *   - a professional PDF buffer (via pdfmake, no browser engine required)
 *
 * Pure JS. No Chromium / Puppeteer dependency, so it installs and runs
 * reliably on any machine that can run the Node backend.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { marked } = require("marked");
const HTMLtoDOCX = require("html-to-docx");
const PdfPrinter = require("pdfmake");

/* ------------------------------------------------------------------ */
/* Fonts — materialized from pdfmake's bundled base64 virtual FS, so   */
/* no external font files are needed on the host machine.              */
/* ------------------------------------------------------------------ */
function materializeFonts() {
  const vfsModule = require("pdfmake/build/vfs_fonts");
  const vfs = vfsModule.pdfMake ? vfsModule.pdfMake.vfs : vfsModule.vfs || vfsModule;
  const dir = path.join(os.tmpdir(), "aina-pdf-fonts");
  fs.mkdirSync(dir, { recursive: true });
  const need = ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Italic.ttf", "Roboto-MediumItalic.ttf"];
  for (const name of need) {
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) {
      if (!vfs[name]) throw new Error("Missing bundled font in pdfmake vfs: " + name);
      fs.writeFileSync(target, Buffer.from(vfs[name], "base64"));
    }
  }
  return dir;
}

const fontDir = materializeFonts();
const printer = new PdfPrinter({
  Roboto: {
    normal: path.join(fontDir, "Roboto-Regular.ttf"),
    bold: path.join(fontDir, "Roboto-Medium.ttf"),
    italics: path.join(fontDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontDir, "Roboto-MediumItalic.ttf"),
  },
});

/* ------------------------------------------------------------------ */
/* Brand palette                                                       */
/* ------------------------------------------------------------------ */
const BRAND = "#ea580c"; // orange-600, matches the app
const INK = "#0f172a"; // slate-900
const MUTED = "#475569"; // slate-600
const LINE = "#e2e8f0"; // slate-200

/* ================================================================== */
/* 1. Markdown -> styled HTML                                          */
/* ================================================================== */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Drop a leading "# Title" that just duplicates the cover title.
function stripDuplicateTitle(markdown, title) {
  if (!title) return String(markdown || "");
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  return String(markdown || "").replace(/^\s*#\s+(.+?)\s*(?:\n+|$)/, (m, h1) =>
    norm(h1) === norm(title) ? "" : m
  );
}

function markdownToHtml(markdown, meta = {}) {
  const src = stripDuplicateTitle(markdown, meta.title);
  const body = marked.parse(src, { gfm: true, breaks: false });
  const title = escapeHtml(meta.title || "Report");
  const subtitle = escapeHtml(meta.template || "");
  const generated = escapeHtml(meta.generatedAt || new Date().toISOString().slice(0, 10));
  const objective = meta.objective ? `<p class="objective"><strong>Objective:</strong> ${escapeHtml(meta.objective)}</p>` : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: ${INK}; line-height: 1.6; max-width: 820px; margin: 0 auto; padding: 48px 40px; }
  header.cover { border-bottom: 3px solid ${BRAND}; padding-bottom: 20px; margin-bottom: 32px; }
  .eyebrow { font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: ${BRAND}; font-weight: 700; margin: 0 0 8px; }
  h1 { font-size: 30px; margin: 0 0 6px; line-height: 1.2; }
  .meta { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: ${MUTED}; margin: 6px 0 0; }
  .objective { font-family: Arial, Helvetica, sans-serif; background: #fff7ed; border-left: 4px solid ${BRAND}; padding: 10px 14px; font-size: 14px; margin: 20px 0; }
  h2 { font-family: Arial, Helvetica, sans-serif; font-size: 20px; margin: 32px 0 10px; padding-bottom: 6px; border-bottom: 1px solid ${LINE}; }
  h3 { font-family: Arial, Helvetica, sans-serif; font-size: 16px; margin: 24px 0 8px; color: ${INK}; }
  h4 { font-family: Arial, Helvetica, sans-serif; font-size: 14px; margin: 18px 0 6px; color: ${MUTED}; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 14px; padding-left: 24px; }
  li { margin: 4px 0; }
  blockquote { margin: 16px 0; padding: 8px 16px; border-left: 4px solid ${LINE}; color: ${MUTED}; font-style: italic; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
  th, td { border: 1px solid ${LINE}; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; }
  code { font-family: 'Courier New', monospace; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 90%; }
  hr { border: 0; border-top: 1px solid ${LINE}; margin: 28px 0; }
  a { color: ${BRAND}; }
  footer.foot { margin-top: 40px; padding-top: 14px; border-top: 1px solid ${LINE}; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: ${MUTED}; }
</style></head>
<body>
  <header class="cover">
    <p class="eyebrow">AINA Report Studio${subtitle ? " &middot; " + subtitle : ""}</p>
    <h1>${title}</h1>
    <p class="meta">Generated ${generated}</p>
  </header>
  ${objective}
  ${body}
  <footer class="foot">Generated by AINA Report Studio. Evidence-grounded AI report &mdash; verify clinical and scientific claims against the cited sources before use.</footer>
</body></html>`;
}

/* ================================================================== */
/* 2. HTML -> DOCX buffer                                              */
/* ================================================================== */
async function markdownToDocx(markdown, meta = {}) {
  const html = markdownToHtml(markdown, meta);
  const buffer = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
    font: "Calibri",
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
  });
  return buffer;
}

/* ================================================================== */
/* 3. Markdown -> PDF buffer (pdfmake)                                 */
/* ================================================================== */

// Convert marked inline tokens into pdfmake text runs.
function inlineToRuns(tokens) {
  const runs = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case "text":
        // text tokens may themselves carry nested inline tokens
        if (t.tokens && t.tokens.length) runs.push(...inlineToRuns(t.tokens));
        else runs.push({ text: t.text });
        break;
      case "strong":
        runs.push(...inlineToRuns(t.tokens).map((r) => ({ ...r, bold: true })));
        break;
      case "em":
        runs.push(...inlineToRuns(t.tokens).map((r) => ({ ...r, italics: true })));
        break;
      case "codespan":
        runs.push({ text: t.text, font: undefined, color: "#b91c1c", background: "#f1f5f9" });
        break;
      case "link":
        runs.push(...inlineToRuns(t.tokens).map((r) => ({ ...r, color: BRAND, link: t.href })));
        break;
      case "br":
        runs.push({ text: "\n" });
        break;
      case "del":
        runs.push(...inlineToRuns(t.tokens).map((r) => ({ ...r, decoration: "lineThrough" })));
        break;
      default:
        if (t.tokens && t.tokens.length) runs.push(...inlineToRuns(t.tokens));
        else if (t.text != null) runs.push({ text: t.text });
    }
  }
  return runs.length ? runs : [{ text: "" }];
}

function listToPdf(token) {
  const items = token.items.map((item) => {
    const parts = [];
    for (const child of item.tokens || []) {
      if (child.type === "text") {
        parts.push({ text: inlineToRuns(child.tokens || [{ type: "text", text: child.text }]) });
      } else if (child.type === "list") {
        parts.push(listToPdf(child));
      } else if (child.type === "paragraph") {
        parts.push({ text: inlineToRuns(child.tokens) });
      } else if (child.text) {
        parts.push({ text: child.text });
      }
    }
    return parts.length === 1 ? parts[0] : parts;
  });
  return token.ordered ? { ol: items, margin: [0, 2, 0, 8] } : { ul: items, margin: [0, 2, 0, 8] };
}

function tableToPdf(token) {
  const header = token.header.map((c) => ({ text: inlineToRuns(c.tokens), style: "th" }));
  const rows = token.rows.map((row) => row.map((c) => ({ text: inlineToRuns(c.tokens), style: "td" })));
  return {
    table: { headerRows: 1, widths: token.header.map(() => "*"), body: [header, ...rows] },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 6, 0, 12],
  };
}

function tokensToPdfContent(tokens) {
  const content = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading":
        content.push({ text: inlineToRuns(t.tokens), style: "h" + Math.min(t.depth, 4) });
        break;
      case "paragraph":
        content.push({ text: inlineToRuns(t.tokens), style: "p" });
        break;
      case "list":
        content.push(listToPdf(t));
        break;
      case "blockquote":
        content.push({
          text: inlineToRuns(t.tokens.flatMap((x) => x.tokens || [])),
          style: "quote",
          margin: [12, 4, 0, 12],
        });
        break;
      case "table":
        content.push(tableToPdf(t));
        break;
      case "code":
        content.push({ text: t.text, style: "code", margin: [0, 4, 0, 12] });
        break;
      case "hr":
        content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: LINE }], margin: [0, 8, 0, 16] });
        break;
      case "space":
        break;
      default:
        if (t.tokens) content.push({ text: inlineToRuns(t.tokens), style: "p" });
        else if (t.text) content.push({ text: t.text, style: "p" });
    }
  }
  return content;
}

function markdownToPdf(markdown, meta = {}) {
  const tokens = marked.lexer(stripDuplicateTitle(markdown, meta.title), { gfm: true });
  const bodyContent = tokensToPdfContent(tokens);

  const title = meta.title || "Report";
  const subtitle = meta.template ? " · " + meta.template : "";
  const generated = meta.generatedAt || new Date().toISOString().slice(0, 10);

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [56, 64, 56, 60],
    info: { title, author: "AINA Report Studio" },
    header: (currentPage) =>
      currentPage === 1
        ? null
        : { text: title, margin: [56, 28, 56, 0], fontSize: 8, color: MUTED, alignment: "left" },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "AINA Report Studio", fontSize: 8, color: MUTED, margin: [56, 0, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", fontSize: 8, color: MUTED, margin: [0, 0, 56, 0] },
      ],
      margin: [0, 16, 0, 0],
    }),
    content: [
      { text: ("AINA REPORT STUDIO" + subtitle).toUpperCase(), style: "eyebrow" },
      { text: title, style: "title" },
      { text: "Generated " + generated, style: "metaLine" },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 2, lineColor: BRAND }], margin: [0, 8, 0, 4] },
      ...(meta.objective
        ? [{
            table: { widths: ["*"], body: [[{ text: [{ text: "Objective: ", bold: true }, { text: meta.objective }], fillColor: "#fff7ed", margin: [10, 8, 10, 8], fontSize: 10 }]] },
            layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => BRAND },
            margin: [0, 14, 0, 6],
          }]
        : [{ text: "", margin: [0, 6, 0, 0] }]),
      ...bodyContent,
    ],
    styles: {
      eyebrow: { fontSize: 9, bold: true, color: BRAND, characterSpacing: 1, margin: [0, 0, 0, 6] },
      title: { fontSize: 24, bold: true, color: INK, margin: [0, 0, 0, 4] },
      metaLine: { fontSize: 10, color: MUTED, margin: [0, 0, 0, 2] },
      h1: { fontSize: 18, bold: true, color: INK, margin: [0, 16, 0, 8] },
      h2: { fontSize: 15, bold: true, color: INK, margin: [0, 14, 0, 6] },
      h3: { fontSize: 12.5, bold: true, color: INK, margin: [0, 10, 0, 4] },
      h4: { fontSize: 11, bold: true, color: MUTED, margin: [0, 8, 0, 4] },
      p: { fontSize: 10.5, color: INK, margin: [0, 0, 0, 8], lineHeight: 1.35, alignment: "justify" },
      quote: { fontSize: 10.5, italics: true, color: MUTED },
      code: { font: undefined, fontSize: 9, color: "#334155", background: "#f1f5f9" },
      th: { bold: true, fontSize: 9.5, fillColor: "#f8fafc", color: INK },
      td: { fontSize: 9.5, color: INK },
    },
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: INK },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on("data", (c) => chunks.push(c));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { markdownToHtml, markdownToDocx, markdownToPdf };

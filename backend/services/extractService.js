"use strict";
/**
 * extractService.js
 * Turns uploaded files and URLs into clean plain text for the source library.
 *   - PDF  (application/pdf)            -> pdf-parse
 *   - DOCX (Word)                       -> mammoth
 *   - TXT / MD / plain text             -> utf-8 decode
 *   - URL (article page or remote PDF)  -> fetch + Readability / pdf-parse
 *
 * All functions return { title, text, meta } and throw on unrecoverable errors.
 */

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

const MAX_TEXT = 2000000; // ~2MB text ceiling to protect the DB / LLM budget

/* ---------------- AI (Gemini vision) document extraction ---------------- */
// Uses Gemini's multimodal API to OCR scanned pages AND reconstruct tables as
// clean Markdown — far better than plain-text PDF parsing for complex documents.
const geminiVisionModel = () => process.env.GEMINI_EXTRACT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
function geminiVisionAvailable() {
  return Boolean(process.env.GEMINI_API_KEY?.trim()) && (process.env.AI_EXTRACTION || "on") !== "off";
}

const EXTRACT_PROMPTS = {
  full:
    "Extract ALL text from this document as clean GitHub-flavored Markdown. " +
    "Preserve every table as a proper Markdown table with correct columns and header row. " +
    "Keep headings, lists, numeric values, units, and confidence intervals exactly as shown. " +
    "Transcribe faithfully — do not summarize, add commentary, or omit content. Output only the extracted content.",
  tables:
    "Extract ONLY the data tables from this document, each as a clean GitHub-flavored Markdown table with a header row. " +
    "Include each table's caption or number if present. Keep numeric values, units and confidence intervals exactly as shown. " +
    "Ignore body prose, abstract, and references. If there are no tables, output nothing.",
};

async function geminiExtractDocument(buffer, mimeType, kind = "full") {
  const key = process.env.GEMINI_API_KEY.trim();
  const model = geminiVisionModel();
  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: buffer.toString("base64") } },
          { text: EXTRACT_PROMPTS[kind] || EXTRACT_PROMPTS.full },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: 8192, temperature: 0 },
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeout);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "Gemini extraction HTTP " + r.status);
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned no extractable text.");
  return text;
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[   ]/g, " ") // non-breaking spaces -> normal space
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

/* ---------------------------- files ------------------------------- */
async function extractFromBuffer(buffer, opts) {
  const { mimetype = "", originalName = "", mode = "auto" } = opts || {};
  const name = String(originalName || "");
  const ext = (name.split(".").pop() || "").toLowerCase();
  const isPdf = mimetype.includes("pdf") || ext === "pdf";
  const isDocx = mimetype.includes("word") || mimetype.includes("officedocument") || ext === "docx";
  const isImage = mimetype.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isText = mimetype.startsWith("text/") || ["txt", "md", "markdown", "csv"].includes(ext);

  let text = "";
  const meta = { kind: "file", originalName: name };

  if (isImage) {
    // Images have no text layer — AI vision is the only way to read them.
    if (!geminiVisionAvailable()) {
      throw new Error("Reading an image requires AI extraction. Add a GEMINI_API_KEY to enable it.");
    }
    text = await geminiExtractDocument(buffer, mimetype || "image/" + (ext === "jpg" ? "jpeg" : ext));
    meta.kind = "image";
    meta.extractedBy = "gemini";
  } else if (isPdf) {
    // Always get the plain-text layer first (mechanical, complete, no copyright limits).
    let parsed = null;
    try {
      parsed = await pdfParse(buffer);
    } catch {
      /* corrupt or image-only */
    }
    const pdfText = normalizeWhitespace(parsed?.text || "");
    const pages = parsed?.numpages || 0;
    // Heuristic: very little text for the page count => scanned / image-only PDF.
    const looksScanned = pages > 0 ? pdfText.length < pages * 40 : pdfText.length < 40;
    const canAi = geminiVisionAvailable() && buffer.length < 15 * 1024 * 1024;

    if (looksScanned && canAi) {
      // No usable text layer → full AI OCR is the only way to read it.
      try {
        const aiText = normalizeWhitespace(await geminiExtractDocument(buffer, "application/pdf", "full"));
        if (aiText.length > pdfText.length) {
          text = aiText;
          meta.kind = "pdf-ai";
          meta.extractedBy = "gemini";
        } else {
          text = pdfText;
          meta.kind = "pdf";
          meta.extractedBy = "pdf-parse";
        }
      } catch (e) {
        console.warn("[extract] AI OCR failed, using pdf-parse:", e.message);
        text = pdfText;
        meta.kind = "pdf";
        meta.extractedBy = "pdf-parse";
      }
    } else if (mode === "ai" && canAi && pdfText.length >= 200) {
      // Text-rich PDF + high-accuracy requested: keep the full plain text (which
      // AI full-extraction can refuse to reproduce for copyrighted articles) and
      // augment it with clean, correctly-structured tables extracted by AI.
      text = pdfText;
      meta.kind = "pdf";
      meta.extractedBy = "pdf-parse";
      try {
        const tables = normalizeWhitespace(await geminiExtractDocument(buffer, "application/pdf", "tables"));
        if (tables && tables.length > 40) {
          text = pdfText + "\n\n## Tables (AI-extracted)\n\n" + tables;
          meta.kind = "pdf-ai";
          meta.extractedBy = "pdf-parse+ai-tables";
        }
      } catch (e) {
        console.warn("[extract] AI table extraction failed:", e.message);
      }
    } else {
      // Fast path (default for normal digital PDFs).
      text = pdfText;
      meta.kind = "pdf";
      meta.extractedBy = "pdf-parse";
    }
    meta.pages = pages;
    if (!text && looksScanned) {
      throw new Error(
        "This looks like a scanned PDF with no text layer, and AI extraction is unavailable. Add a Gemini key to read scans."
      );
    }
  } else if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || "";
    meta.kind = "docx";
  } else if (isText) {
    text = buffer.toString("utf-8");
    meta.kind = "text";
  } else {
    try {
      const data = await pdfParse(buffer);
      text = data.text || "";
      meta.kind = "pdf";
      meta.pages = data.numpages;
    } catch {
      text = buffer.toString("utf-8");
      meta.kind = "text";
    }
  }

  text = normalizeWhitespace(text);
  if (!text || text.length < 20) {
    throw new Error(
      "Could not extract readable text from this file. If it is a scanned document, turn on AI extraction to read it."
    );
  }
  const title = name.replace(/\.[^.]+$/, "") || "Untitled source";
  return { title, text, meta };
}

/* ----------------------------- url -------------------------------- */
async function extractFromUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    throw new Error("That does not look like a valid URL.");
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Only http and https links are supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(url.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AINA-ReportStudio/1.0; +https://aina.app)",
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
      },
    });
  } catch (e) {
    clearTimeout(timeout);
    throw new Error("Could not reach that URL: " + (e.message || "network error"));
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error("The URL returned HTTP " + response.status + ".");
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  // Remote PDF
  if (contentType.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const data = await pdfParse(buffer);
    const text = normalizeWhitespace(data.text || "");
    if (!text || text.length < 20) throw new Error("The linked PDF had no extractable text (it may be scanned).");
    const title =
      decodeURIComponent(url.pathname.split("/").pop() || "").replace(/\.pdf$/i, "") || url.hostname;
    return { title, text, meta: { kind: "url-pdf", url: url.href, pages: data.numpages } };
  }

  // HTML article
  const html = await response.text();
  const dom = new JSDOM(html, { url: url.href });
  const doc = dom.window.document;
  let title = (doc.querySelector("title")?.textContent || "").trim();
  let text = "";
  try {
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article) {
      title = (article.title || title).trim();
      text = article.textContent || "";
    }
  } catch {
    /* fall through to body text */
  }
  if (!text || text.trim().length < 40) {
    text = doc.body ? doc.body.textContent || "" : "";
  }
  text = normalizeWhitespace(text);
  if (!text || text.length < 40) {
    throw new Error("Could not extract readable article text from that page.");
  }
  return { title: title || url.hostname, text, meta: { kind: "url", url: url.href } };
}

module.exports = { extractFromBuffer, extractFromUrl, normalizeWhitespace };

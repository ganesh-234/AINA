"use strict";

const crypto = require("crypto");
const Source = require("../models/Source");
const Report = require("../models/Report");
const { generateResponse, generateResponseStream, getProviderStatus, checkProviders } = require("../services/llmService");
const { extractFromBuffer, extractFromUrl } = require("../services/extractService");
const { resolveTemplate, listTemplates } = require("../services/reportTemplates");
const { generateChainedReport } = require("../services/promptChainService");
const { analyzeSources, buildSynthesisPrompt } = require("../services/parallelReportService");
const { markdownToHtml, markdownToDocx, markdownToPdf } = require("../services/exportService");
const { embedDocuments, embedQuery, cosine, getEmbeddingStatus } = require("../services/embeddingService");
const { buildDocumentIntelligence, chunkStructuredDocument } = require("../services/documentIntelligenceService");

/* In-memory cache for "Ask your documents" answers, keyed by question + source set. */
const ASK_CACHE = new Map();
const ASK_CACHE_TTL = parseInt(process.env.ASK_CACHE_TTL_MS || "600000", 10);
const ASK_CACHE_MAX = parseInt(process.env.ASK_CACHE_MAX || "200", 10);
const askCacheKey = (q, ids) => [...ids].sort().join(",") + "::" + String(q).toLowerCase().replace(/\s+/g, " ").trim();
function askCacheGet(k) { const h = ASK_CACHE.get(k); if (!h) return null; if (Date.now() - h.t > ASK_CACHE_TTL) { ASK_CACHE.delete(k); return null; } return h.v; }
function askCacheSet(k, v) { if (ASK_CACHE.size >= ASK_CACHE_MAX) ASK_CACHE.delete(ASK_CACHE.keys().next().value); ASK_CACHE.set(k, { t: Date.now(), v }); }

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */
const MAX_SOURCE_CHARS = 2_000_000;
const MAX_UPLOAD_TOTAL_BYTES = parseInt(process.env.REPORT_UPLOAD_MAX_TOTAL_BYTES || String(50 * 1024 * 1024), 10);
const MAX_EVIDENCE_CHARS = 14_000; // context budget handed to the model when using RAG retrieval
// If the combined source text fits within this budget, feed it ALL to the model
// (long-context mode, no retrieval loss). Above it, fall back to semantic RAG.
const ADAPTIVE_MAX_CHARS = 120_000;

function chunkText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p, i) => (p.match(/[\s\S]{1,900}(?:\s|$)/g) || []).map((t, j) => ({ index: i * 1000 + j, text: t.trim() })))
    .filter((c) => c.text);
}

const keywords = (text) => new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []);

// Rank chunks across all selected sources by keyword overlap with the query.
function retrieve(sources, query, limit) {
  const q = keywords(query);
  const scored = sources.flatMap((s) =>
    (s.chunks || []).map((c) => ({
      sourceId: s._id,
      sourceTitle: s.title,
      text: c.text,
      score: [...q].reduce((n, w) => n + (c.text.toLowerCase().includes(w) ? 1 : 0), 0),
    }))
  );
  // If nothing matched (e.g. very short query), fall back to leading chunks.
  const ranked = scored.some((x) => x.score > 0)
    ? scored.sort((a, b) => b.score - a.score)
    : scored;
  return ranked.slice(0, limit || 12);
}

function buildEvidence(items) {
  let out = [];
  let used = 0;
  let n = 0;
  for (const x of items) {
    const block = "[Source " + (n + 1) + ": " + x.sourceTitle + "]\n" + x.text;
    if (used + block.length > MAX_EVIDENCE_CHARS && n > 0) break;
    out.push(block);
    used += block.length;
    n += 1;
  }
  return out.join("\n\n");
}

// Long-context mode: hand the model every source in full (labeled), capped.
function buildEvidenceAll(sources) {
  return sources
    .map((s, i) => "[Source " + (i + 1) + ": " + s.title + "]\n" + String(s.content || "").slice(0, ADAPTIVE_MAX_CHARS))
    .join("\n\n")
    .slice(0, ADAPTIVE_MAX_CHARS);
}

// Ensure every selected source has chunk embeddings; embed + persist any that
// are missing (e.g. sources created before RAG was added). Mutates in place.
async function ensureEmbeddings(sources) {
  for (const s of sources) {
    const chunks = s.chunks || [];
    if (!chunks.length) continue;
    const missing = chunks.some((c) => !c.embedding || !c.embedding.length);
    if (!missing) continue;
    try {
      const res = await embedDocuments(chunks.map((c) => c.text));
      if (res && res.vectors.length === chunks.length) {
        chunks.forEach((c, i) => { c.embedding = res.vectors[i]; });
        s.embedModel = res.model;
        await Source.updateOne({ _id: s._id }, { $set: { chunks, embedModel: res.model } });
      }
    } catch (e) {
      console.warn("[reports] lazy embedding backfill failed for", String(s._id), e.message);
    }
  }
}

// Semantic retrieval: rank chunks by cosine similarity to the embedded query.
// Falls back to keyword scoring when embeddings are unavailable.
async function semanticRetrieve(sources, query, limit) {
  const q = await embedQuery(query).catch(() => null);
  const flat = sources.flatMap((s) =>
    (s.chunks || []).map((c) => ({ sourceTitle: s.title, text: c.text, embedding: c.embedding, embedModel: s.embedModel }))
  );
  const usable = q && flat.some((c) => c.embedding && c.embedding.length && c.embedModel === q.model);
  if (!usable) return retrieve(sources, query, limit); // keyword fallback

  return flat
    .map((c) => ({
      sourceTitle: c.sourceTitle,
      text: c.text,
      score: c.embedding && c.embedModel === q.model ? cosine(q.vector, c.embedding) : -1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const round3 = (n) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : null);
const snippet = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 240);

// Clean up common model artifacts so the saved report reads as a finished document:
// unwrap an outer code fence, drop a dangling unterminated fence, and strip
// scratchpad / meta-commentary lines that occasionally leak in.
function sanitizeReport(md) {
  let t = String(md || "").trim();

  // Unwrap a single code fence that wraps the whole document.
  const whole = t.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  if (whole) t = whole[1].trim();

  // Drop any preamble before the first heading when it reads as the model
  // narrating or acknowledging the instructions rather than report content.
  const hIdx = t.search(/^#{1,3}\s+\S/m);
  if (hIdx > 0) {
    const pre = t.slice(0, hIdx);
    if (/->|\bI will\b|\bI have (added|included|ensured|noted)\b|\bI've\b|instructions?|pure markdown|code fences?|as requested|as instructed/i.test(pre)) {
      t = t.slice(hIdx);
    }
  }

  // Remove obvious scratchpad asides, reasoning leaks, and rule-echo lines.
  t = t
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (/^\*{0,2}note on .*(pars|format|table).*/i.test(l)) return false;
      if (/^\**(let me|let'?s|i will|i'?ll|i need to|first,? i|now i)\b/i.test(l) && l.length < 200) return false;
      if (/->\s*(i will|i have|i've|added|done|noted|this)\b/i.test(l)) return false;
      if (/^\s*\*?\s*".*"\s*->/i.test(l)) return false; // "quoted rule" -> acknowledgment
      return true;
    })
    .join("\n");

  // If code fences are unbalanced, drop the trailing dangling fence.
  if (((t.match(/```/g) || []).length) % 2 === 1) {
    t = t.replace(/```[^\n]*\s*$/, "").trim();
  }

  return t.replace(/\n{3,}/g, "\n\n").trim();
}

// Build the evidence context + citation list for a query, using the adaptive strategy.
async function buildContext(sources, query) {
  const totalChars = sources.reduce((n, s) => n + (s.content ? s.content.length : 0), 0);
  if (totalChars <= ADAPTIVE_MAX_CHARS) {
    return {
      context: buildEvidenceAll(sources),
      retrievalMode: "long-context",
      citations: sources.map((s) => ({ sourceTitle: s.title, snippet: snippet(s.content), score: null })),
    };
  }
  await ensureEmbeddings(sources);
  const selected = await semanticRetrieve(sources, query, 16);
  return {
    context: buildEvidence(selected),
    retrievalMode: "semantic-rag",
    citations: selected.slice(0, 8).map((x) => ({ sourceTitle: x.sourceTitle, snippet: snippet(x.text), score: round3(x.score) })),
  };
}

function reportUserPrompt(tpl, title, objective, context) {
  const sectionList = tpl.sections.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return (
    `Write a complete, well-structured ${tpl.label} titled "${title}".\n` +
    `Objective: ${objective}\n\n` +
    `Cover these sections in order, each as a '##' Markdown heading:\n${sectionList}\n\n` +
    `Requirements:\n` +
    `- Ground every claim in the evidence below and cite as [Source N].\n` +
    `- State clearly when the evidence does not cover a section instead of inventing content.\n` +
    `- Use Markdown tables for structured comparisons where helpful.\n` +
    `- End with a "## Sources Used" section listing each cited source by its title.\n\n` +
    `Begin your response directly with the first '##' section heading. Do not restate, acknowledge, or comment on these instructions.\n\n` +
    `Evidence:\n${context}`
  );
}

// Output budget for report generation. Scales with the number of sources so a
// multi-document report is not truncated mid-section, capped at REPORT_MAX_TOKENS.
const REPORT_MAX_TOKENS = parseInt(process.env.REPORT_MAX_TOKENS || "8000", 10);
const reportTokenBudget = (n) => Math.min(REPORT_MAX_TOKENS, 4000 + 1500 * Math.max(1, n || 1));

const REPORT_GEN_OPTS = (tpl) => ({
  systemPrompt: tpl.system,
  maxTokens: REPORT_MAX_TOKENS,
  temperature: 0.5,
  preserveNewlines: true,
  throwOnFailure: true,
  taskType: "report-generation",
  preferLongContext: true,
  preferProvider: process.env.REPORT_PREFER_PROVIDER || "gemini",
});

// Resolve a boolean flag from the request body, falling back to an env default.
// Accepts true/false, "true"/"false", "on"/"off", 1/0.
function flag(value, envName, envDefault) {
  if (value !== undefined && value !== null && value !== "") {
    if (typeof value === "boolean") return value;
    const v = String(value).toLowerCase();
    if (["true", "on", "1", "yes"].includes(v)) return true;
    if (["false", "off", "0", "no"].includes(v)) return false;
  }
  return (process.env[envName] || envDefault).toLowerCase() !== "off";
}

const isFallbackModelResponse = (text) =>
  /^I.m here to help, but I don.t currently have a connected AI service\./.test(String(text || ""));

function requireLiveModel(text) {
  if (isFallbackModelResponse(text)) {
    throw new Error("No configured AI provider is currently available. Check the Provider health panel and try again.");
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Source ingestion                                                    */
/* ------------------------------------------------------------------ */
async function persistSource(userId, { title, text, meta }) {
  const content = String(text || "").slice(0, MAX_SOURCE_CHARS);
  let intelligence;
  let chunks;
  try {
    intelligence = buildDocumentIntelligence({ title, text: content, meta: meta || {} });
    chunks = chunkStructuredDocument(intelligence);
  } catch (e) {
    // Source ingestion must remain available for unusual or malformed files.
    console.warn("[reports] document intelligence failed; using plain chunks:", e.message);
    chunks = chunkText(content);
  }
  if (!chunks.length && content) chunks = chunkText(content);

  // Compute semantic embeddings for each chunk (RAG). Non-fatal on failure —
  // retrieval falls back to keyword search when embeddings are absent.
  let embedModel = "";
  try {
    const res = await embedDocuments(chunks.map((c) => c.text));
    if (res && res.vectors.length === chunks.length) {
      chunks.forEach((c, i) => { c.embedding = res.vectors[i]; });
      embedModel = res.model;
    }
  } catch (e) {
    console.warn("[reports] embedding on ingest failed:", e.message);
  }

  const source = await Source.create({
    userId,
    title: (title || "Untitled source").slice(0, 240),
    content,
    chunks,
    embedModel,
    documentType: intelligence?.classification || "other",
    documentMetadata: intelligence?.metadata || {},
    sections: intelligence?.sections || [],
    evidence: intelligence?.evidence || [],
    sourceType: (meta && meta.kind) || "paste",
    originalName: (meta && meta.originalName) || "",
    url: (meta && meta.url) || "",
    pages: (meta && meta.pages) || 0,
    charCount: content.length,
  });
  return {
    _id: source._id,
    title: source.title,
    sourceType: source.sourceType,
    chunkCount: chunks.length,
    charCount: content.length,
    pages: source.pages,
    url: source.url,
    createdAt: source.createdAt,
  };
}

// Paste text
async function createSource(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    if (!title || !content) return res.status(400).json({ error: "A source title and content are required." });
    if (content.length > MAX_SOURCE_CHARS) return res.status(400).json({ error: "Source is too large." });
    const source = await persistSource(req.user.id, { title, text: content, meta: { kind: "paste" } });
    res.status(201).json({ source });
  } catch (e) {
    console.error("[reports] createSource", e);
    res.status(500).json({ error: "Unable to save source." });
  }
}

// File upload (PDF / DOCX / TXT), one or many
async function uploadSources(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "No files were uploaded." });
    const totalBytes = files.reduce((sum, file) => sum + (file.size || file.buffer?.length || 0), 0);
    if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
      return res.status(413).json({ error: "The combined upload is too large. Upload fewer or smaller files." });
    }
    const mode = ["ai", "fast", "auto"].includes(req.body.mode) ? req.body.mode : "auto";
    const created = [];
    const failed = [];
    for (const f of files) {
      try {
        const extracted = await extractFromBuffer(f.buffer, { mimetype: f.mimetype, originalName: f.originalname, mode });
        created.push(await persistSource(req.user.id, extracted));
      } catch (err) {
        failed.push({ name: f.originalname, error: err.message });
      }
    }
    if (!created.length) {
      return res.status(422).json({ error: "None of the files could be read.", failed });
    }
    res.status(201).json({ sources: created, failed });
  } catch (e) {
    console.error("[reports] uploadSources", e);
    res.status(500).json({ error: "Unable to process the uploaded files." });
  }
}

// URL / link ingestion
async function addSourceFromUrl(req, res) {
  try {
    const url = String(req.body.url || "").trim();
    if (!url) return res.status(400).json({ error: "A URL is required." });
    const extracted = await extractFromUrl(url);
    if (req.body.title) extracted.title = String(req.body.title).trim();
    const source = await persistSource(req.user.id, extracted);
    res.status(201).json({ source });
  } catch (e) {
    console.error("[reports] addSourceFromUrl", e.message);
    res.status(422).json({ error: e.message || "Unable to read that URL." });
  }
}

async function listSources(req, res) {
  const sources = await Source.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .select("title chunks sourceType documentType originalName url pages charCount createdAt")
    .lean();
  res.json({
    sources: sources.map((s) => ({
      _id: s._id,
      title: s.title,
      sourceType: s.sourceType,
      documentType: s.documentType || "other",
      chunkCount: (s.chunks || []).length,
      charCount: s.charCount || 0,
      pages: s.pages || 0,
      url: s.url || "",
      createdAt: s.createdAt,
    })),
  });
}

async function deleteSource(req, res) {
  const r = await Source.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!r.deletedCount) return res.status(404).json({ error: "Source not found." });
  res.json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Report reads + templates                                            */
/* ------------------------------------------------------------------ */
async function listReports(req, res) {
  res.json({
    reports: await Report.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select("title objective template templateLabel generationMode status batchId createdAt updatedAt")
      .lean(),
  });
}

async function getReport(req, res) {
  const report = await Report.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!report) return res.status(404).json({ error: "Report not found." });
  res.json({ report });
}

function getTemplates(_req, res) {
  res.json({ templates: listTemplates() });
}

function getProviders(_req, res) {
  res.json({ providers: getProviderStatus(), embedding: getEmbeddingStatus() });
}

async function getProvidersHealth(_req, res) {
  try {
    res.json({ providers: await checkProviders() });
  } catch (e) {
    res.status(500).json({ error: "Health check failed." });
  }
}

// Run items through an async worker with bounded concurrency (preserves order).
async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane);
  await Promise.all(lanes);
  return results;
}

/* ------------------------------------------------------------------ */
/* Report generation                                                   */
/* ------------------------------------------------------------------ */
async function generateOneReport(userId, { title, objective, template, sourceIds, batchId, chain, refine, parallel }) {
  const tpl = resolveTemplate(template);
  const sources = await Source.find({ _id: { $in: sourceIds }, userId }).lean();
  if (!sources.length) throw new Error("No matching sources were found for this report.");

  const { context, retrievalMode, citations } = await buildContext(sources, title + " " + objective);

  const opts = REPORT_GEN_OPTS(tpl);
  opts.maxTokens = reportTokenBudget(sources.length);
  const gen = async (msg, o) => requireLiveModel(await generateResponse([], msg, { ...opts, ...o }));
  const useChain = flag(chain, "REPORT_CHAINING", "on");
  const useParallel = flag(parallel, "REPORT_PARALLEL", "off") && sources.length >= 2;

  let content = "";
  let brief = "";
  let generationMode = "single-pass";

  if (useParallel) {
    const providers = getProviderStatus().filter((p) => p.configured).map((p) => p.key);
    const analyses = await analyzeSources({ tpl, objective, sources, generate: gen, providers });
    content = sanitizeReport(await gen(buildSynthesisPrompt(tpl, title, objective, analyses), {}));
    brief = sanitizeReport(analyses.map((a) => "### " + a.title + "\n" + a.analysis).join("\n\n")).slice(0, 8000);
    generationMode = "parallel-map-reduce";
  } else if (useChain) {
    const r = await generateChainedReport({
      tpl, title, objective, context, opts,
      draftGenerate: gen, auxGenerate: gen,
      refine: flag(refine, "CHAIN_VERIFY", "on"),
    });
    content = sanitizeReport(r.content);
    brief = sanitizeReport(r.brief || "");
    generationMode = r.mode;
  } else {
    content = sanitizeReport(await gen(reportUserPrompt(tpl, title, objective, context), {}));
  }
  console.log(`[reports] "${title}" using ${retrievalMode} / ${generationMode}`);

  const report = await Report.create({
    userId,
    title,
    objective,
    template: tpl.key,
    templateLabel: tpl.label,
    outline: brief,
    content,
    citations,
    retrievalMode,
    generationMode,
    sourceIds: sources.map((s) => s._id),
    sourceTitles: sources.map((s) => s.title),
    status: "complete",
    batchId: batchId || "",
  });
  return report;
}

async function generateReport(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    const objective = String(req.body.objective || "").trim();
    const template = req.body.template || "generic";
    const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
    if (!title || !objective || !sourceIds.length) {
      return res.status(400).json({ error: "Title, objective, and at least one source are required." });
    }
    const report = await generateOneReport(req.user.id, {
      title, objective, template, sourceIds,
      chain: req.body.chain, refine: req.body.refine, parallel: req.body.parallel,
    });
    res.status(201).json({ report });
  } catch (e) {
    console.error("[reports] generateReport", e.message);
    res.status(500).json({ error: e.message || "Unable to generate the report." });
  }
}

// Batch generation.
// Body A: { jobs: [{title, objective, template, sourceIds}] }
// Body B: { perSource: true, objective, template, sourceIds:[...] }  -> one report per source
async function generateBatch(req, res) {
  try {
    let jobs = Array.isArray(req.body.jobs) ? req.body.jobs : [];

    if (!jobs.length && req.body.perSource) {
      const objective = String(req.body.objective || "").trim();
      const template = req.body.template || "generic";
      const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
      if (!objective || !sourceIds.length) {
        return res.status(400).json({ error: "An objective and at least one source are required." });
      }
      const sources = await Source.find({ _id: { $in: sourceIds }, userId: req.user.id }).select("title").lean();
      jobs = sources.map((s) => ({
        title: s.title,
        objective,
        template,
        sourceIds: [String(s._id)],
      }));
    }

    if (!jobs.length) return res.status(400).json({ error: "Provide jobs or perSource with sources." });
    if (jobs.length > 50) return res.status(400).json({ error: "A batch is limited to 50 reports at a time." });

    const batchId = crypto.randomUUID();
    // Parallel across the provider pool. Concurrency defaults to the number of
    // configured providers so each in-flight report tends to land on a
    // different provider (round-robin), multiplying throughput.
    const providerCount = getProviderStatus().filter((p) => p.configured).length || 1;
    const concurrency = parseInt(process.env.LLM_BATCH_CONCURRENCY || String(Math.max(2, providerCount)), 10);

    const results = await runWithConcurrency(
      jobs,
      async (job) => {
        const title = String(job.title || "").trim();
        const objective = String(job.objective || "").trim();
        const sourceIds = Array.isArray(job.sourceIds) ? job.sourceIds : [];
        if (!title || !objective || !sourceIds.length) {
          return { title: title || "(untitled)", status: "failed", error: "Missing title, objective, or sources." };
        }
        try {
          const report = await generateOneReport(req.user.id, {
            title,
            objective,
            template: job.template || "generic",
            sourceIds,
            batchId,
            chain: job.chain !== undefined ? job.chain : req.body.chain,
            refine: job.refine !== undefined ? job.refine : req.body.refine,
            parallel: job.parallel !== undefined ? job.parallel : req.body.parallel,
          });
          return { reportId: report._id, title: report.title, status: "complete" };
        } catch (err) {
          return { title, status: "failed", error: err.message };
        }
      },
      concurrency
    );

    res.status(201).json({ batchId, count: results.length, concurrency, results });
  } catch (e) {
    console.error("[reports] generateBatch", e.message);
    res.status(500).json({ error: e.message || "Unable to run the batch." });
  }
}

// Streaming BATCH generation via Server-Sent Events: emits one progress
// event as each report in the batch finishes, so the client can show live
// "N of M done" instead of waiting for the whole batch.
async function generateBatchStream(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    let jobs = Array.isArray(req.body.jobs) ? req.body.jobs : [];
    if (!jobs.length && req.body.perSource) {
      const objective = String(req.body.objective || "").trim();
      const template = req.body.template || "generic";
      const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
      if (!objective || !sourceIds.length) {
        send("error", { error: "An objective and at least one source are required." });
        return res.end();
      }
      const sources = await Source.find({ _id: { $in: sourceIds }, userId: req.user.id }).select("title").lean();
      jobs = sources.map((sMeta) => ({ title: sMeta.title, objective, template, sourceIds: [String(sMeta._id)] }));
    }
    if (!jobs.length) { send("error", { error: "Provide jobs or perSource with sources." }); return res.end(); }
    if (jobs.length > 50) { send("error", { error: "A batch is limited to 50 reports at a time." }); return res.end(); }

    const batchId = crypto.randomUUID();
    const providerCount = getProviderStatus().filter((p) => p.configured).length || 1;
    const concurrency = parseInt(process.env.LLM_BATCH_CONCURRENCY || String(Math.max(2, providerCount)), 10);

    send("start", { total: jobs.length, batchId, concurrency });

    let done = 0;
    const results = await runWithConcurrency(
      jobs,
      async (job) => {
        const title = String(job.title || "").trim();
        const objective = String(job.objective || "").trim();
        const sourceIds = Array.isArray(job.sourceIds) ? job.sourceIds : [];
        let out;
        if (!title || !objective || !sourceIds.length) {
          out = { title: title || "(untitled)", status: "failed", error: "Missing title, objective, or sources." };
        } else {
          try {
            const report = await generateOneReport(req.user.id, {
              title, objective, template: job.template || "generic", sourceIds, batchId,
              chain: job.chain !== undefined ? job.chain : req.body.chain,
              refine: job.refine !== undefined ? job.refine : req.body.refine,
              parallel: job.parallel !== undefined ? job.parallel : req.body.parallel,
            });
            out = { reportId: report._id, title: report.title, status: "complete" };
          } catch (err) {
            out = { title, status: "failed", error: err.message };
          }
        }
        done += 1;
        send("progress", { done, total: jobs.length, reportId: out.reportId || null, title: out.title, status: out.status, error: out.error || null });
        return out;
      },
      concurrency
    );

    const completed = results.filter((r) => r.status === "complete");
    send("done", {
      batchId,
      count: results.length,
      completed: completed.length,
      failed: results.length - completed.length,
      firstReportId: (completed[0] && completed[0].reportId) || null,
      results,
    });
    res.end();
  } catch (e) {
    console.error("[reports] generateBatchStream", e.message);
    try { send("error", { error: e.message || "Unable to run the batch." }); } catch { /* client gone */ }
    res.end();
  }
}

// Streaming report generation via Server-Sent Events.
async function generateReportStream(req, res) {
  const title = String(req.body.title || "").trim();
  const objective = String(req.body.objective || "").trim();
  const template = req.body.template || "generic";
  const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
  if (!title || !objective || !sourceIds.length) {
    return res.status(400).json({ error: "Title, objective, and at least one source are required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const tpl = resolveTemplate(template);
    const sources = await Source.find({ _id: { $in: sourceIds }, userId: req.user.id }).lean();
    if (!sources.length) {
      send("error", { error: "No matching sources were found." });
      return res.end();
    }
    const { context, retrievalMode, citations } = await buildContext(sources, title + " " + objective);
    send("meta", { retrievalMode });

    const opts = REPORT_GEN_OPTS(tpl);
    opts.maxTokens = reportTokenBudget(sources.length);
    // Non-streaming call used by the analyze/verify steps of the chain.
    const gen = async (msg, o) => {
      const t = await generateResponse([], msg, { ...opts, ...o });
      if (isFallbackModelResponse(t)) throw new Error("The AI provider is unavailable.");
      return t;
    };
    // Streaming call used for the visible draft step.
    const streamDraft = async (msg, o) => {
      const t = await generateResponseStream([], msg, { ...opts, ...o }, (delta) => send("token", { t: delta }));
      if (isFallbackModelResponse(t)) throw new Error("The AI provider is unavailable.");
      return t;
    };

    const useChain = flag(req.body.chain, "REPORT_CHAINING", "on");
    // For the streamed path, verification is off by default so that what the
    // user watches being written is exactly what is saved (the analyze step
    // still runs and grounds the draft). Opt in with refine / CHAIN_VERIFY_STREAM.
    const refine = flag(req.body.refine, "CHAIN_VERIFY_STREAM", "off");
    const useParallel = flag(req.body.parallel, "REPORT_PARALLEL", "off") && sources.length >= 2;

    let finalText = "";
    let brief = "";
    let generationMode = "single-pass";

    if (useParallel) {
      const providers = getProviderStatus().filter((p) => p.configured).map((p) => p.key);
      const analyses = await analyzeSources({ tpl, objective, sources, generate: gen, providers, onStep: (l) => send("step", { label: l }) });
      send("step", { label: "Synthesising report" });
      finalText = sanitizeReport(await streamDraft(buildSynthesisPrompt(tpl, title, objective, analyses), {}));
      brief = sanitizeReport(analyses.map((a) => "### " + a.title + "\n" + a.analysis).join("\n\n")).slice(0, 8000);
      generationMode = "parallel-map-reduce";
    } else if (useChain) {
      const r = await generateChainedReport({
        tpl, title, objective, context, opts,
        draftGenerate: streamDraft, auxGenerate: gen, refine,
        onStep: (name, info) => send("step", { name, ...(info || {}) }),
      });
      finalText = sanitizeReport(r.content);
      brief = sanitizeReport(r.brief || "");
      generationMode = r.mode;
      // If a verify pass rewrote the streamed draft, tell the client to swap in
      // the corrected text before it renders the final report.
      if (generationMode.includes("verified")) send("final", { content: finalText });
    } else {
      finalText = sanitizeReport(await streamDraft(reportUserPrompt(tpl, title, objective, context), {}));
    }

    const report = await Report.create({
      userId: req.user.id,
      title,
      objective,
      template: tpl.key,
      templateLabel: tpl.label,
      outline: brief,
      content: finalText,
      citations,
      retrievalMode,
      generationMode,
      sourceIds: sources.map((s) => s._id),
      sourceTitles: sources.map((s) => s.title),
      status: "complete",
    });
    send("done", { reportId: report._id, citations, retrievalMode, generationMode });
    res.end();
  } catch (e) {
    console.error("[reports] generateReportStream", e.message);
    send("error", { error: e.message || "Generation failed." });
    res.end();
  }
}

/* ------------------------------------------------------------------ */
/* Ask / Chat with documents (RAG Q&A)                                 */
/* ------------------------------------------------------------------ */
async function askDocuments(req, res) {
  try {
    const question = String(req.body.question || "").trim();
    const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
    if (!question || !sourceIds.length) {
      return res.status(400).json({ error: "A question and at least one source are required." });
    }
    const ckey = askCacheKey(question, sourceIds);
    const cachedAns = askCacheGet(ckey);
    if (cachedAns) return res.json({ ...cachedAns, cached: true });
    const sources = await Source.find({ _id: { $in: sourceIds }, userId: req.user.id }).lean();
    if (!sources.length) return res.status(404).json({ error: "No matching sources were found." });

    await ensureEmbeddings(sources);
    const selected = await semanticRetrieve(sources, question, 8);
    const context = buildEvidence(selected);
    const system =
      "You are AINA, answering questions strictly from the supplied evidence about the user's own documents. " +
      "Cite supporting claims as [Source N]. If the evidence does not contain the answer, say so plainly instead of guessing. " +
      "Be concise and accurate. Answer directly — do not restate, acknowledge, or comment on these instructions, and do not wrap your answer in code fences.";
    const answer = sanitizeReport(
      requireLiveModel(
        await generateResponse([], `Question: ${question}\n\nEvidence:\n${context}`, {
          systemPrompt: system,
          maxTokens: 1500,
          temperature: 0.3,
          preserveNewlines: true,
          throwOnFailure: true,
          preferProvider: process.env.REPORT_PREFER_PROVIDER || "gemini",
        })
      )
    );
    const citations = selected.slice(0, 6).map((x) => ({ sourceTitle: x.sourceTitle, snippet: snippet(x.text), score: round3(x.score) }));
    askCacheSet(ckey, { answer, citations });
    res.json({ answer, citations });
  } catch (e) {
    console.error("[reports] askDocuments", e.message);
    res.status(500).json({ error: e.message || "Unable to answer that question." });
  }
}

/* ------------------------------------------------------------------ */
/* Report management                                                   */
/* ------------------------------------------------------------------ */
async function renameReport(req, res) {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "A title is required." });
  const report = await Report.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { title: title.slice(0, 240) } },
    { new: true }
  ).lean();
  if (!report) return res.status(404).json({ error: "Report not found." });
  res.json({ report });
}

async function deleteReport(req, res) {
  const r = await Report.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!r.deletedCount) return res.status(404).json({ error: "Report not found." });
  res.json({ ok: true });
}

async function duplicateReport(req, res) {
  const src = await Report.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!src) return res.status(404).json({ error: "Report not found." });
  const copy = await Report.create({
    userId: req.user.id,
    title: (src.title || "Report") + " (copy)",
    objective: src.objective,
    template: src.template,
    templateLabel: src.templateLabel,
    outline: src.outline,
    content: src.content,
    citations: src.citations,
    retrievalMode: src.retrievalMode,
    sourceIds: src.sourceIds,
    sourceTitles: src.sourceTitles,
    status: src.status,
    batchId: "",
  });
  res.status(201).json({ report: copy });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */
function safeFilename(title) {
  return (String(title || "report").replace(/[^\w\d-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "report").slice(0, 80);
}

async function exportReport(req, res) {
  try {
    const report = await Report.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!report) return res.status(404).json({ error: "Report not found." });

    const format = String(req.query.format || "pdf").toLowerCase();
    const meta = {
      title: report.title,
      template: report.templateLabel || report.template,
      objective: report.objective,
      generatedAt: new Date(report.createdAt || Date.now()).toISOString().slice(0, 10),
    };
    const base = safeFilename(report.title);

    if (format === "pdf") {
      const buf = await markdownToPdf(report.content, meta);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
      return res.send(buf);
    }
    if (format === "docx") {
      const buf = await markdownToDocx(report.content, meta);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.docx"`);
      return res.send(Buffer.from(buf));
    }
    if (format === "html") {
      const html = markdownToHtml(report.content, meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.html"`);
      return res.send(html);
    }
    if (format === "md" || format === "markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.md"`);
      return res.send(report.content);
    }
    return res.status(400).json({ error: "Unsupported format. Use pdf, docx, html, or md." });
  } catch (e) {
    console.error("[reports] exportReport", e.message);
    res.status(500).json({ error: "Unable to export the report." });
  }
}

module.exports = {
  createSource,
  uploadSources,
  addSourceFromUrl,
  listSources,
  deleteSource,
  listReports,
  getReport,
  getTemplates,
  getProviders,
  getProvidersHealth,
  generateReport,
  generateReportStream,
  generateBatch,
  generateBatchStream,
  askDocuments,
  renameReport,
  deleteReport,
  duplicateReport,
  exportReport,
};

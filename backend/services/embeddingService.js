"use strict";
/**
 * embeddingService.js
 * Semantic embeddings for RAG retrieval.
 *   - Primary: Gemini native embedContent (gemini-embedding-001, 3072-dim) with
 *     task types (RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for queries) —
 *     this sharply improves retrieval separation.
 *   - Fallback: OpenRouter embeddings (OpenAI-compatible, e.g. NVIDIA Nemotron).
 * Returns null when no provider succeeds, so callers can fall back to keyword search.
 */

const geminiModel = () => process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001";
const openrouterModel = () => process.env.OPENROUTER_EMBED_MODEL?.trim() || "nvidia/nemotron-3-embed-1b:free";
// Matryoshka dimension reduction keeps stored vectors compact (default 768) so
// even large documents stay well under MongoDB's 16MB per-document limit.
const embedDims = () => parseInt(process.env.EMBED_DIMS || "768", 10);

function embedPool() {
  const order = (process.env.EMBED_POOL || "gemini,openrouter")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return order.filter(
    (k) =>
      (k === "gemini" && process.env.GEMINI_API_KEY?.trim()) ||
      (k === "openrouter" && process.env.OPENROUTER_API_KEY?.trim())
  );
}

const clip = (t) => String(t || "").slice(0, 8000);

// fetch with retry on transient 429/503.
async function fetchRetry(url, init, retries = 2) {
  let attempt = 0;
  while (true) {
    const r = await fetch(url, init);
    if ((r.status === 429 || r.status === 503) && attempt < retries) {
      const ra = parseInt(r.headers.get("retry-after") || "0", 10);
      await new Promise((res) => setTimeout(res, Math.min(ra ? ra * 1000 : 400 * Math.pow(2, attempt), 6000)));
      attempt += 1;
      continue;
    }
    return r;
  }
}

async function geminiEmbed(texts, taskType) {
  const key = process.env.GEMINI_API_KEY.trim();
  const model = geminiModel();
  const vectors = [];
  for (let i = 0; i < texts.length; i += 100) {
    const slice = texts.slice(i, i + 100);
    const body = {
      requests: slice.map((t) => ({
        model: "models/" + model,
        content: { parts: [{ text: clip(t) }] },
        taskType,
        outputDimensionality: embedDims(),
      })),
    };
    const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error?.message || "gemini embed HTTP " + r.status);
    (j.embeddings || []).forEach((e) => vectors.push(e.values));
  }
  return { model, vectors };
}

async function openrouterEmbed(texts) {
  const key = process.env.OPENROUTER_API_KEY.trim();
  const model = openrouterModel();
  const r = await fetchRetry("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts.map(clip) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || "openrouter embed HTTP " + r.status);
  const vectors = (j.data || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0)).map((d) => d.embedding);
  return { model, vectors };
}

// kind: "document" | "query"
async function embedMany(texts, kind) {
  if (!texts || !texts.length) return { model: "none", vectors: [] };
  const taskType = kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
  for (const p of embedPool()) {
    try {
      const res = p === "gemini" ? await geminiEmbed(texts, taskType) : await openrouterEmbed(texts);
      if (res.vectors.length === texts.length) return res;
      console.warn(`[embed] ${p} returned ${res.vectors.length}/${texts.length} vectors`);
    } catch (e) {
      console.warn(`[embed] ${p} failed: ${e.message}`);
    }
  }
  return null;
}

async function embedDocuments(texts) {
  return embedMany(texts, "document");
}

async function embedQuery(text) {
  const res = await embedMany([text], "query");
  return res && res.vectors.length ? { model: res.model, vector: res.vectors[0] } : null;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den ? dot / den : -1;
}

function getEmbeddingStatus() {
  return { pool: embedPool(), geminiModel: geminiModel(), openrouterModel: openrouterModel() };
}

module.exports = { embedDocuments, embedQuery, embedMany, cosine, getEmbeddingStatus };

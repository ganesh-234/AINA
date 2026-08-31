const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../.env.local");
const defaultEnvPath = path.resolve(__dirname, "../.env");
const loadedEnvPath = require("fs").existsSync(envPath) ? envPath : defaultEnvPath;
dotenv.config({ path: loadedEnvPath });

console.log("[llmService] loading env from", loadedEnvPath);

/* ================================================================== */
/* Provider registry                                                   */
/* All four providers speak the OpenAI Chat Completions format, so a    */
/* single call function serves all of them. Models are env-overridable  */
/* because provider model names change over time.                       */
/* ================================================================== */
const PROVIDERS = {
  cerebras: {
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
    tokenParam: "max_completion_tokens",
  },
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    tokenParam: "max_completion_tokens",
  },
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    tokenParam: "max_tokens",
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    tokenParam: "max_tokens",
  },
};

// Preferred order for the pool (Cerebras first: highest daily token volume).
const DEFAULT_POOL = ["cerebras", "groq", "gemini", "openrouter"];

function poolOrder() {
  const configured = (process.env.LLM_POOL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((k) => PROVIDERS[k]);
  return configured.length ? configured : DEFAULT_POOL;
}

function providerKey(key) {
  const p = PROVIDERS[key];
  return p ? process.env[p.keyEnv]?.trim() : "";
}

// Providers that actually have an API key set, in preferred order.
function availableProviders() {
  return poolOrder().filter((k) => providerKey(k));
}

function providerModel(key) {
  const p = PROVIDERS[key];
  return process.env[p.modelEnv]?.trim() || p.defaultModel;
}

/* ================================================================== */
/* Prompt assembly                                                     */
/* ================================================================== */
const prompt =
  process.env.PROMPT ||
  "You are a supportive AI companion that provides empathetic, non-medical mental wellness support. Use plain ASCII punctuation in replies.";
const runtimeContext =
  "AINA runtime: responses are served by a pool of AI providers (Cerebras, Groq, Gemini, OpenRouter). " +
  "If asked about the model, describe this app configuration and do not claim unverified details about a specific model architecture.";

const CHAT_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || "250", 10);

function cleanModelResponse(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("−", "-")
    .trim();
}

function localFallbackResponse(messages) {
  const lastUserMessage = messages.slice().reverse().find((m) => m.role === "user")?.content;
  const trimmed = String(lastUserMessage || "").trim();
  if (!trimmed) return "Hi there! I'm ready to chat whenever you are.";
  return `I'm here to help, but I don't currently have a connected AI service. You said: "${trimmed}". Can you tell me more?`;
}

function buildMessages(historyMessages, userMessage, options = {}) {
  const useCustomSystem = Boolean(options.systemPrompt);
  const preamble = useCustomSystem
    ? [{ role: "system", content: String(options.systemPrompt) }]
    : [
        { role: "system", content: prompt },
        { role: "system", content: runtimeContext },
      ];
  const history = (historyMessages || []).map((m) => ({
    role: m.role === "system" ? "system" : m.role === "user" ? "user" : "assistant",
    content: options.preserveNewlines ? String(m.content || "") : String(m.content || "").replace(/\n/g, " "),
  }));
  return [...preamble, ...history, { role: "user", content: String(userMessage) }];
}

/* ================================================================== */
/* Unified OpenAI-compatible call                                      */
/* ================================================================== */
const MAX_RETRIES = parseInt(process.env.LLM_RETRIES || "2", 10);

function requestBody(key, messages, options, stream) {
  const p = PROVIDERS[key];
  const body = {
    model: providerModel(key),
    messages,
    temperature: options.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
    top_p: options.topP ?? parseFloat(process.env.LLM_TOP_P || "0.95"),
  };
  body[p.tokenParam] = options.maxTokens || CHAT_MAX_TOKENS;
  if (stream) body.stream = true;
  return body;
}

// fetch with timeout and automatic retry on transient 429/503 (honours Retry-After).
async function fetchWithRetry(url, init, timeoutMs) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 90000);
    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
      const ra = parseInt(response.headers.get("retry-after") || "0", 10);
      const wait = Math.min(ra ? ra * 1000 : 400 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, wait));
      attempt += 1;
      continue;
    }
    return response;
  }
}

async function callProvider(key, messages, options = {}) {
  const p = PROVIDERS[key];
  const apiKey = providerKey(key);
  if (!apiKey) throw new Error(`Missing ${p.keyEnv}`);

  const response = await fetchWithRetry(
    p.url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(key, messages, options, false)),
    },
    options.timeoutMs
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = result.error?.message || result.error || result.message || `${p.label} HTTP ${response.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return cleanModelResponse(result.choices?.[0]?.message?.content);
}

// Streaming call: invokes onToken(deltaText) as tokens arrive; returns the full text.
async function callProviderStream(key, messages, options = {}, onToken) {
  const p = PROVIDERS[key];
  const apiKey = providerKey(key);
  if (!apiKey) throw new Error(`Missing ${p.keyEnv}`);

  const response = await fetchWithRetry(
    p.url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(key, messages, options, true)),
    },
    options.timeoutMs
  );
  if (!response.ok) {
    const j = await response.json().catch(() => ({}));
    const msg = j.error?.message || j.error || `${p.label} HTTP ${response.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          if (onToken) onToken(delta);
        }
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }
  return cleanModelResponse(full);
}

/* ================================================================== */
/* Round-robin load balancer + failover                                */
/* ================================================================== */
let rrCounter = 0;

// Rotate the available pool so concurrent/batch calls start on different
// providers (load balancing), then fail over through the rest (resilience).
// When preferProvider is set and available, it goes first (used by report
// generation, which prefers the big-context provider); otherwise round-robin.
function rotatedPool(prefer) {
  const pool = availableProviders();
  if (pool.length <= 1) return pool;
  if (prefer && pool.includes(prefer)) {
    return [prefer, ...pool.filter((p) => p !== prefer)];
  }
  const start = rrCounter++ % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

async function generateResponse(historyMessages, userMessage, options = {}) {
  const messages = buildMessages(historyMessages, userMessage, options);
  const pool = rotatedPool(options.preferProvider);

  if (pool.length === 0) {
    console.warn("[llmService] No provider API key configured; using local fallback.");
    if (options.throwOnFailure) {
      throw new Error(
        "No AI provider is configured. Add at least one of CEREBRAS_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY."
      );
    }
    return localFallbackResponse(messages);
  }

  const errors = [];
  for (const key of pool) {
    try {
      const text = await callProvider(key, messages, options);
      if (text) {
        if (process.env.LLM_LOG_PROVIDER === "1") console.log(`[llmService] served by ${PROVIDERS[key].label}`);
        return text;
      }
      errors.push(`${key}: empty response`);
    } catch (err) {
      console.warn(`[llmService] ${key} failed: ${err.message}`);
      errors.push(`${key}: ${err.message}`);
    }
  }

  const detail = errors.join(" | ");
  console.warn(`[llmService] All providers failed (${detail}); using local fallback.`);
  if (options.throwOnFailure) throw new Error("AI provider error - " + (detail || "all providers failed"));
  return localFallbackResponse(messages);
}

// Streaming variant: emits tokens via onToken as they arrive, returns full text.
// Fails over to the next provider only if a provider errors before any token.
async function generateResponseStream(historyMessages, userMessage, options = {}, onToken) {
  const messages = buildMessages(historyMessages, userMessage, options);
  const pool = rotatedPool(options.preferProvider);
  if (pool.length === 0) {
    if (options.throwOnFailure) throw new Error("No AI provider is configured.");
    const t = localFallbackResponse(messages);
    if (onToken) onToken(t);
    return t;
  }
  const errors = [];
  for (const key of pool) {
    let emitted = 0;
    try {
      const text = await callProviderStream(key, messages, options, (d) => {
        emitted += d.length;
        if (onToken) onToken(d);
      });
      if (text) return text;
      errors.push(`${key}: empty response`);
    } catch (err) {
      errors.push(`${key}: ${err.message}`);
      if (emitted > 0) throw new Error("Stream interrupted after partial output: " + err.message);
      console.warn(`[llmService] stream ${key} failed pre-token, trying next: ${err.message}`);
    }
  }
  if (options.throwOnFailure) throw new Error("AI provider error - " + errors.join(" | "));
  const t = localFallbackResponse(messages);
  if (onToken) onToken(t);
  return t;
}

// Diagnostics: which providers are configured and what model each uses.
function getProviderStatus() {
  return poolOrder().map((key) => ({
    key,
    label: PROVIDERS[key].label,
    configured: Boolean(providerKey(key)),
    model: providerModel(key),
  }));
}

// Live health check: send a tiny prompt to each configured provider in parallel
// and report up/down + latency. Costs a handful of tokens per call.
async function checkProviders(timeoutMs = 12000) {
  const keys = poolOrder();
  return Promise.all(
    keys.map(async (key) => {
      const p = PROVIDERS[key];
      const base = { key, label: p.label, model: providerModel(key), configured: Boolean(providerKey(key)) };
      if (!base.configured) return { ...base, ok: false, error: "no key" };
      const t0 = Date.now();
      try {
        await callProvider(key, [{ role: "user", content: "ping" }], { maxTokens: 4, temperature: 0, timeoutMs });
        return { ...base, ok: true, ms: Date.now() - t0 };
      } catch (e) {
        return { ...base, ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 120) };
      }
    })
  );
}

module.exports = { generateResponse, generateResponseStream, getProviderStatus, checkProviders };

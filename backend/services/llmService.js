const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../.env.local");
const defaultEnvPath = path.resolve(__dirname, "../.env");
const loadedEnvPath = require("fs").existsSync(envPath) ? envPath : defaultEnvPath;
dotenv.config({ path: loadedEnvPath });

console.log("[llmService] loading env from", loadedEnvPath);

/* ================================================================== */
/* Provider registry with enhanced metadata                            */
/* ================================================================== */
const PROVIDERS = {
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    tokenParam: "max_tokens",
    // Enhanced metadata for intelligent load balancing
    priority: 1, // Highest priority
    contextWindow: 1000000, // 1M tokens - excellent for long documents
    reliability: 0.95, // 95% uptime historically
    speed: "fast", // Response time category
    costTier: "free",
    strengths: ["long-context", "reliable", "fast", "medical-analysis"],
    idealFor: ["report-generation", "long-documents", "medical-reports", "research-papers"],
  },
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    // Kept aligned with the current Groq model configured by default in AINA.
    defaultModel: "openai/gpt-oss-20b",
    tokenParam: "max_completion_tokens",
    priority: 2,
    contextWindow: 32000,
    reliability: 0.85,
    speed: "very-fast", // Groq is known for speed
    costTier: "free",
    strengths: ["speed", "short-context"],
    idealFor: ["chat", "quick-questions", "short-responses"],
  },
  cerebras: {
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
    tokenParam: "max_completion_tokens",
    priority: 3,
    contextWindow: 128000,
    reliability: 0.80,
    speed: "fast",
    costTier: "free",
    strengths: ["high-volume", "batch-processing"],
    idealFor: ["batch-generation", "parallel-processing"],
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    tokenParam: "max_tokens",
    priority: 4, // Lowest priority - fallback only
    contextWindow: 128000,
    reliability: 0.75, // Variable (routes to different free models)
    speed: "medium",
    costTier: "free",
    strengths: ["diversity", "fallback"],
    idealFor: ["fallback", "general-use"],
  },
};

/* ================================================================== */
/* Provider performance tracking                                       */
/* ================================================================== */
const providerStats = {};

function initProviderStats(key) {
  if (!providerStats[key]) {
    providerStats[key] = {
      successCount: 0,
      failureCount: 0,
      totalLatency: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      avgLatency: 0,
      successRate: 1.0,
    };
  }
  return providerStats[key];
}

function recordSuccess(key, latencyMs) {
  const stats = initProviderStats(key);
  stats.successCount++;
  stats.totalLatency += latencyMs;
  stats.avgLatency = stats.totalLatency / stats.successCount;
  stats.lastSuccess = Date.now();
  stats.consecutiveFailures = 0;
  stats.successRate = stats.successCount / (stats.successCount + stats.failureCount);
}

function recordFailure(key) {
  const stats = initProviderStats(key);
  stats.failureCount++;
  stats.lastFailure = Date.now();
  stats.consecutiveFailures++;
  stats.successRate = stats.successCount / (stats.successCount + stats.failureCount);
}

function getProviderHealth(key) {
  const stats = providerStats[key];
  if (!stats) return 1.0; // No history = assume healthy

  // Penalize consecutive failures
  if (stats.consecutiveFailures >= 3) return 0.1;
  if (stats.consecutiveFailures >= 2) return 0.3;
  if (stats.consecutiveFailures >= 1) return 0.6;

  return stats.successRate;
}

/* ================================================================== */
/* Intelligent provider selection                                      */
/* ================================================================== */

/**
 * Select the best provider based on task type and current health
 * @param {string} taskType - 'report', 'chat', 'batch', 'verification', etc.
 * @param {object} options - Additional selection criteria
 * @returns {string} Provider key
 */
function selectOptimalProvider(taskType, options = {}) {
  const available = availableProviders();
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const { preferLongContext, preferSpeed, contextLength } = options;

  // Score each provider
  const scored = available.map((key) => {
    const provider = PROVIDERS[key];
    let score = 0;

    // Base priority (Gemini gets highest)
    score += (5 - provider.priority) * 20;

    // Current health
    const health = getProviderHealth(key);
    score += health * 30;

    // Task-specific scoring
    if (taskType === 'report' || taskType === 'report-generation') {
      // Gemini is ideal for reports
      if (key === 'gemini') score += 50;
      if (provider.idealFor.includes('report-generation')) score += 20;
      if (provider.idealFor.includes('long-documents')) score += 15;
    } else if (taskType === 'chat' || taskType === 'quick-question') {
      // Groq is fastest for chat
      if (provider.speed === 'very-fast') score += 30;
      if (provider.idealFor.includes('chat')) score += 20;
    } else if (taskType === 'batch') {
      // Cerebras is good for batch
      if (provider.idealFor.includes('batch-processing')) score += 25;
    } else if (taskType === 'verification') {
      // Verification needs reliability
      score += provider.reliability * 30;
    }

    // Context window requirements
    if (contextLength && contextLength > provider.contextWindow) {
      score = 0; // Cannot handle this request
    } else if (preferLongContext) {
      score += (provider.contextWindow / 1000000) * 20; // Gemini wins here
    }

    // Speed preference
    if (preferSpeed) {
      if (provider.speed === 'very-fast') score += 20;
      if (provider.speed === 'fast') score += 10;
    }

    // Latency penalty
    const stats = providerStats[key];
    if (stats && stats.avgLatency > 0) {
      score -= Math.min(stats.avgLatency / 100, 10); // Small penalty for slow responses
    }

    return { key, score, provider };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  if (process.env.LLM_LOG_SELECTION === "1") {
    console.log(`[llmService] Provider selection for ${taskType}:`);
    scored.forEach(s => console.log(`  ${s.provider.label}: ${s.score.toFixed(1)}`));
  }

  return scored[0].key;
}

/**
 * Build an ordered failover chain starting with optimal provider
 */
function buildFailoverChain(taskType, options = {}) {
  const available = availableProviders();
  if (available.length === 0) return [];
  if (available.length === 1) return available;

  // A caller can choose a provider for a workload (for example Gemini for a
  // long evidence-grounded report) without losing the safety of failover.
  const preferred = String(options.preferProvider || "").trim().toLowerCase();
  const optimal = available.includes(preferred) ? preferred : selectOptimalProvider(taskType, options);
  const others = available.filter(k => k !== optimal);

  // Sort others by priority (lower number = higher priority)
  others.sort((a, b) => {
    const healthA = getProviderHealth(a);
    const healthB = getProviderHealth(b);
    if (Math.abs(healthA - healthB) > 0.2) {
      return healthB - healthA; // Prefer healthier
    }
    return PROVIDERS[a].priority - PROVIDERS[b].priority;
  });

  return [optimal, ...others];
}

/* ================================================================== */
/* Provider pool configuration                                         */
/* ================================================================== */

// Priority-based pool (Gemini first by default)
const DEFAULT_POOL = ["gemini", "groq", "cerebras", "openrouter"];

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

function availableProviders() {
  return poolOrder().filter((k) => providerKey(k));
}

function providerModel(key) {
  const p = PROVIDERS[key];
  return process.env[p.modelEnv]?.trim() || p.defaultModel;
}

/* ================================================================== */
/* Prompt assembly (unchanged)                                         */
/* ================================================================== */
const prompt =
  process.env.PROMPT ||
  "You are a supportive AI companion that provides empathetic, non-medical mental wellness support. Use plain ASCII punctuation in replies.";
const runtimeContext =
  "AINA runtime: responses are served by a pool of AI providers (primarily Google Gemini for its reliability and large context window, with Groq, Cerebras, and OpenRouter as fallbacks). " +
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

  const startTime = Date.now();

  try {
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

    const latency = Date.now() - startTime;
    recordSuccess(key, latency);

    return cleanModelResponse(result.choices?.[0]?.message?.content);
  } catch (error) {
    recordFailure(key);
    throw error;
  }
}

async function callProviderStream(key, messages, options = {}, onToken) {
  const p = PROVIDERS[key];
  const apiKey = providerKey(key);
  if (!apiKey) throw new Error(`Missing ${p.keyEnv}`);

  const startTime = Date.now();

  try {
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

    const latency = Date.now() - startTime;
    recordSuccess(key, latency);

    return cleanModelResponse(full);
  } catch (error) {
    recordFailure(key);
    throw error;
  }
}

/* ================================================================== */
/* Enhanced load balancer with intelligent routing                     */
/* ================================================================== */

async function generateResponse(historyMessages, userMessage, options = {}) {
  const messages = buildMessages(historyMessages, userMessage, options);

  // Determine task type from options
  const taskType = options.taskType || 'chat';

  // Build optimal failover chain
  const pool = buildFailoverChain(taskType, {
    preferLongContext: options.preferLongContext,
    preferSpeed: options.preferSpeed,
    contextLength: options.contextLength,
    preferProvider: options.preferProvider,
  });

  if (pool.length === 0) {
    console.warn("[llmService] No provider API key configured; using local fallback.");
    if (options.throwOnFailure) {
      throw new Error(
        "No AI provider is configured. Add at least one of GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY."
      );
    }
    return localFallbackResponse(messages);
  }

  const errors = [];
  for (const key of pool) {
    try {
      const text = await callProvider(key, messages, options);
      if (text) {
        console.log(`[llmService] ✓ ${PROVIDERS[key].label} (${taskType})`);
        return text;
      }
      errors.push(`${key}: empty response`);
    } catch (err) {
      console.warn(`[llmService] ✗ ${key} failed: ${err.message}`);
      errors.push(`${key}: ${err.message}`);
    }
  }

  const detail = errors.join(" | ");
  console.warn(`[llmService] All providers failed (${detail}); using local fallback.`);
  if (options.throwOnFailure) throw new Error("AI provider error - " + (detail || "all providers failed"));
  return localFallbackResponse(messages);
}

async function generateResponseStream(historyMessages, userMessage, options = {}, onToken) {
  const messages = buildMessages(historyMessages, userMessage, options);
  const taskType = options.taskType || 'chat';

  const pool = buildFailoverChain(taskType, {
    preferLongContext: options.preferLongContext,
    preferSpeed: options.preferSpeed,
    contextLength: options.contextLength,
    preferProvider: options.preferProvider,
  });

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
      if (text) {
        console.log(`[llmService] ✓ ${PROVIDERS[key].label} stream (${taskType})`);
        return text;
      }
      errors.push(`${key}: empty response`);
    } catch (err) {
      errors.push(`${key}: ${err.message}`);
      if (emitted > 0) throw new Error("Stream interrupted after partial output: " + err.message);
      console.warn(`[llmService] ✗ ${key} stream failed pre-token, trying next: ${err.message}`);
    }
  }

  if (options.throwOnFailure) throw new Error("AI provider error - " + errors.join(" | "));
  const t = localFallbackResponse(messages);
  if (onToken) onToken(t);
  return t;
}

/* ================================================================== */
/* Provider diagnostics and health                                     */
/* ================================================================== */

function getProviderStatus() {
  return poolOrder().map((key) => {
    const stats = providerStats[key];
    return {
      key,
      label: PROVIDERS[key].label,
      configured: Boolean(providerKey(key)),
      model: providerModel(key),
      priority: PROVIDERS[key].priority,
      contextWindow: PROVIDERS[key].contextWindow,
      health: getProviderHealth(key),
      stats: stats || null,
    };
  });
}

async function checkProviders(timeoutMs = 12000) {
  const keys = poolOrder();
  return Promise.all(
    keys.map(async (key) => {
      const p = PROVIDERS[key];
      const base = {
        key,
        label: p.label,
        model: providerModel(key),
        configured: Boolean(providerKey(key)),
        priority: p.priority,
        contextWindow: p.contextWindow,
        strengths: p.strengths,
      };
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

function getProviderStats() {
  return Object.keys(providerStats).map((key) => ({
    key,
    label: PROVIDERS[key]?.label || key,
    ...providerStats[key],
  }));
}

module.exports = {
  generateResponse,
  generateResponseStream,
  getProviderStatus,
  checkProviders,
  getProviderStats,
  selectOptimalProvider,
  PROVIDERS,
};

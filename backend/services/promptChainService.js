"use strict";
/**
 * promptChainService.js
 * Multi-step ("prompt chaining") report generation for AINA Report Studio.
 *
 * Instead of asking one model call to read the evidence AND write a fully
 * grounded, well-structured report in a single shot, the work is decomposed
 * into a chain of smaller, verifiable steps. Each step has a narrow job, so
 * each is easier for the model to do well and easier for us to check:
 *
 *   1. ANALYZE  — read the raw evidence and distil an "evidence brief": a
 *                 compact list of concrete, citeable facts (figures, findings,
 *                 methods, entities), each tagged with its [Source N]. This
 *                 forces the model to actually read before it writes and gives
 *                 the drafting step a clean, pre-grounded base to build on.
 *   2. DRAFT    — write the full structured report against the template
 *                 sections, grounded in BOTH the evidence brief and the raw
 *                 evidence, citing [Source N] throughout.
 *   3. VERIFY   — act as a fact-checking editor: compare the draft against the
 *                 evidence, remove or soften any claim the evidence does not
 *                 support, correct citations, and tidy tables/formatting.
 *
 * Robustness: the ANALYZE and VERIFY steps are "best effort". If either fails
 * (provider error, empty output, timeout) the chain degrades gracefully and
 * still returns the best draft it has, so adding the extra steps can only
 * improve quality — it never makes generation fail where a single pass would
 * have succeeded. The DRAFT step is the only required one.
 *
 * The two model entry points are injected (draftGenerate / auxGenerate) rather
 * than imported, so the streaming controller can stream the *draft* to the user
 * token-by-token while the analyze/verify steps run as ordinary calls, and so
 * the service stays decoupled and unit-testable.
 */

const CHAIN_ON = () => (process.env.REPORT_CHAINING || "on").toLowerCase() !== "off";
const VERIFY_ON = () => (process.env.CHAIN_VERIFY || "on").toLowerCase() !== "off";

const BRIEF_MAX_TOKENS = parseInt(process.env.CHAIN_BRIEF_TOKENS || "1600", 10);
const MIN_VERIFIED_RATIO = 0.6; // reject a "verified" pass that collapses the draft

/* ---------------------------- prompts ---------------------------- */

function briefPrompt(title, objective, context) {
  return (
    `You are preparing to write a report titled "${title}".\n` +
    `Objective: ${objective}\n\n` +
    `First, read the evidence below and extract a factual EVIDENCE BRIEF that a writer ` +
    `can rely on. Produce a tight, skimmable list (Markdown bullets, grouped under short ` +
    `'###' subheadings such as Key Findings, Numeric Results, Methods, Entities, Caveats — ` +
    `include only the groups the evidence actually supports).\n\n` +
    `Rules:\n` +
    `- Capture concrete facts only: findings, numeric values with their units, dosages, ` +
    `p-values, confidence intervals, sample sizes, dates, named entities, and study methods.\n` +
    `- Tag every item with the source it comes from as [Source N].\n` +
    `- Copy numbers and units exactly as written. Do not calculate, infer, or round.\n` +
    `- Include ONLY facts present in the evidence. Do not add outside knowledge.\n` +
    `- No prose paragraphs, no introduction, no conclusion — just the grouped bullet list.\n\n` +
    `Evidence:\n${context}`
  );
}

function draftPrompt(tpl, title, objective, brief, context) {
  const sectionList = tpl.sections.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const briefBlock = brief
    ? `A pre-checked evidence brief has been prepared for you. Treat it as a grounded ` +
      `summary of what the evidence supports, but you may also draw on the full evidence ` +
      `below it. Keep the [Source N] tags.\n\nEvidence brief:\n${brief}\n\n`
    : "";
  return (
    `Write a complete, well-structured ${tpl.label} titled "${title}".\n` +
    `Objective: ${objective}\n\n` +
    briefBlock +
    `Cover these sections in order, each as a '##' Markdown heading:\n${sectionList}\n\n` +
    `Requirements:\n` +
    `- Ground every claim in the evidence and cite as [Source N].\n` +
    `- State clearly when the evidence does not cover a section instead of inventing content.\n` +
    `- Use Markdown tables for structured comparisons where helpful.\n` +
    `- Preserve numeric values, units, and confidence intervals exactly.\n` +
    `- End with a "## Sources Used" section listing each cited source by its title.\n\n` +
    `Begin your response directly with the first '##' section heading. Do not restate, ` +
    `acknowledge, or comment on these instructions.\n\n` +
    `Evidence:\n${context}`
  );
}

function verifyPrompt(tpl, draft, context) {
  return (
    `You are a meticulous fact-checking editor for AINA Report Studio. Below is a DRAFT ${tpl.label} ` +
    `and the EVIDENCE it must be grounded in. Return a corrected version of the report.\n\n` +
    `Editing rules:\n` +
    `- Remove or soften any statement the evidence does not support. Do not add new claims.\n` +
    `- Every [Source N] citation must point to evidence that actually supports the sentence; ` +
    `fix or remove citations that do not.\n` +
    `- Correct any numeric value, unit, or interval that does not match the evidence.\n` +
    `- Keep the section structure, headings, and overall length. Keep well-supported content as is.\n` +
    `- Clean up any malformed Markdown tables; keep genuine data, drop garbled fragments.\n` +
    `- Output ONLY the corrected report, starting at the first '##' heading. No notes, no ` +
    `explanation of what you changed, no code fences around the document.\n\n` +
    `DRAFT:\n${draft}\n\n` +
    `EVIDENCE:\n${context}`
  );
}

/* ------------------------- orchestration ------------------------- */

const now = () => Date.now();

/**
 * Run the report-generation chain.
 *
 * @param {object}   p
 * @param {object}   p.tpl            resolved template ({ label, sections, system, ... })
 * @param {string}   p.title
 * @param {string}   p.objective
 * @param {string}   p.context        evidence block (already built by buildContext)
 * @param {object}   p.opts           base LLM options (systemPrompt, maxTokens, temperature, preferProvider, ...)
 * @param {function} p.draftGenerate  async (userMessage, options) => text  (may stream to the user)
 * @param {function} [p.auxGenerate]  async (userMessage, options) => text  (non-streaming; defaults to draftGenerate)
 * @param {boolean}  [p.refine]       run the verify step (defaults to CHAIN_VERIFY env)
 * @param {function} [p.onStep]       (name, info) => void  progress callback for streaming UIs
 * @returns {Promise<{ content, brief, mode, steps }>}
 */
async function generateChainedReport(p) {
  const {
    tpl, title, objective, context, opts = {},
    draftGenerate, auxGenerate, refine, onStep,
  } = p;
  const aux = auxGenerate || draftGenerate;
  const step = (name, info) => { try { onStep && onStep(name, info || {}); } catch { /* non-fatal */ } };
  const steps = [];
  const record = (name, ok, t0, note) => steps.push({ name, ok, ms: now() - t0, note: note || "" });

  // If chaining is disabled globally, do a single grounded pass (the draft prompt
  // without a brief) so behaviour matches the classic single-call path.
  if (!CHAIN_ON()) {
    const draft = await draftGenerate(draftPrompt(tpl, title, objective, "", context), opts);
    return { content: draft, brief: "", mode: "single-pass", steps: [{ name: "draft", ok: true, ms: 0 }] };
  }

  // Step 1 — ANALYZE (best effort).
  let brief = "";
  {
    const t0 = now();
    step("analyze", { label: "Analysing evidence" });
    try {
      const out = await aux(briefPrompt(title, objective, context), {
        ...opts,
        maxTokens: BRIEF_MAX_TOKENS,
        temperature: 0.2,
      });
      brief = String(out || "").trim();
      record("analyze", Boolean(brief), t0, brief ? "" : "empty");
    } catch (e) {
      record("analyze", false, t0, e.message);
      console.warn("[chain] analyze step failed, continuing without brief:", e.message);
    }
  }

  // Step 2 — DRAFT (required; may stream).
  let draft = "";
  {
    const t0 = now();
    step("draft", { label: "Drafting report" });
    draft = String(await draftGenerate(draftPrompt(tpl, title, objective, brief, context), opts) || "").trim();
    record("draft", Boolean(draft), t0);
    if (!draft) throw new Error("The model returned an empty draft.");
  }

  // Step 3 — VERIFY (best effort).
  const doRefine = refine !== undefined ? refine : VERIFY_ON();
  let content = draft;
  let mode = brief ? "chained" : "chained-no-brief";
  if (doRefine) {
    const t0 = now();
    step("verify", { label: "Verifying against sources" });
    try {
      const verified = String(await aux(verifyPrompt(tpl, draft, context), {
        ...opts,
        temperature: 0.2,
      }) || "").trim();
      // Guard against a verify pass that hollows out the report (e.g. the model
      // misread the instruction and returned a change-log or a stub).
      if (verified && verified.length >= draft.length * MIN_VERIFIED_RATIO) {
        content = verified;
        mode += "+verified";
        record("verify", true, t0);
      } else {
        record("verify", false, t0, "output too short; kept draft");
      }
    } catch (e) {
      record("verify", false, t0, e.message);
      console.warn("[chain] verify step failed, keeping draft:", e.message);
    }
  }

  step("done", { mode });
  return { content, brief, mode, steps };
}

module.exports = {
  generateChainedReport,
  // exported for reuse/testing
  briefPrompt,
  draftPrompt,
  verifyPrompt,
  CHAIN_ON,
  VERIFY_ON,
};

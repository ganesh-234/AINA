"use strict";
const assert = require("assert");
const { resolveTemplate, listTemplates } = require("../services/reportTemplates");
const { cosine } = require("../services/embeddingService");
const { classifyDocument } = require("../services/documentIntelligenceService");
const { buildSynthesisPrompt } = require("../services/parallelReportService");
const { generateChainedReport } = require("../services/promptChainService");

// templates
assert.equal(resolveTemplate("medical").key, "medical");
assert.equal(resolveTemplate("Research paper analysis").key, "research");
assert.equal(resolveTemplate("totally unknown").key, "generic");
assert.ok(listTemplates().length >= 3);

// cosine similarity
assert.ok(Math.abs(cosine([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
assert.ok(Math.abs(cosine([1, 0, 0], [0, 1, 0])) < 1e-9);
assert.equal(cosine([1, 2, 3], null), -1);

// document classification
assert.equal(classifyDocument("", "Abstract Methods Results doi:10.1/x randomized trial"), "research_paper");
assert.equal(classifyDocument("", "patient chief complaint diagnosis medication assessment and plan"), "medical_report");

// synthesis prompt keeps source numbering + template sections
const tpl = resolveTemplate("research");
const sp = buildSynthesisPrompt(tpl, "T", "O", [{ n: 1, title: "A", analysis: "finding x" }, { n: 2, title: "B", analysis: "finding y" }]);
assert.ok(sp.includes("[Source 1: A]") && sp.includes("[Source 2: B]"));
assert.ok(sp.includes(tpl.sections[0]));

// report chain with stubbed model (no network)
(async () => {
  const gen = async (msg) =>
    /EVIDENCE BRIEF/.test(msg) ? "### Findings\n- x [Source 1]"
    : /fact-checking editor/.test(msg) ? "## Summary\nverified body ".repeat(30)
    : "## Summary\ndraft body ".repeat(30);
  const r = await generateChainedReport({
    tpl, title: "T", objective: "O", context: "[Source 1: A]\nx",
    opts: { maxTokens: 50 }, draftGenerate: gen, auxGenerate: gen, refine: true,
  });
  assert.ok(r.content && r.content.length > 0);
  assert.ok(r.steps.some((s) => s.name === "draft" && s.ok));
  console.log("units.test.js: all assertions passed");
})().catch((e) => { console.error("units.test.js FAILED:", e); process.exit(1); });

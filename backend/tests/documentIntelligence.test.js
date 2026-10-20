"use strict";

const assert = require("assert");
const { buildDocumentIntelligence, chunkStructuredDocument } = require("../services/documentIntelligenceService");
const { resolveTemplate } = require("../services/reportTemplates");

const paper = [
  "A pilot clinical study\nAbstract\nWe evaluated treatment X in 42 participants.",
  "Methods\nParticipants received treatment X for 12 weeks.",
  "Results\nTreatment X significantly reduced symptom score by 24% (p = 0.02).\nDiscussion\nThe finding requires confirmation.",
];
const doc = buildDocumentIntelligence({ title: "Pilot study", text: paper.join("\n"), meta: { pageTexts: paper } });
const chunks = chunkStructuredDocument(doc, 200);

assert.equal(doc.classification, "research_paper");
assert.equal(doc.sections.length, 3);
assert.ok(doc.evidence.some((e) => e.page === 3 && /24%/.test(e.claim)));
assert.ok(chunks.some((c) => c.page === 3 && c.section === "Results"));
assert.ok(chunks.every((c) => c.text.length <= 200));

const medical = resolveTemplate("medical");
assert.equal(medical.key, "medical");
assert.equal(medical.sections[0], "Clinical Summary");
assert.ok(!medical.sections.includes("Executive Summary"));
assert.match(medical.system, /not an executive/i);
console.log("document intelligence tests passed");

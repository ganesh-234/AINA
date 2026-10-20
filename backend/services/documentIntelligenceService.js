"use strict";

// Deterministic document intelligence keeps provenance intact before any model
// is asked to reason over a source.  This also makes ingestion testable when an
// LLM is not configured.
const SCIENCE_HEADINGS = /^(abstract|introduction|background|methods?|materials? and methods?|results?|discussion|conclusions?|limitations?|references|keywords?|case presentation|clinical history|assessment|plan)$/i;
const FINDING = /\b(significant(?:ly)?|associated with|increased|decreased|improved|reduced|higher|lower|odds ratio|hazard ratio|confidence interval|p\s*[<=>]|mean|median|incidence|prevalence)\b/i;

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

function classifyDocument(title, text) {
  const sample = (title + "\n" + String(text || "").slice(0, 18000)).toLowerCase();
  // A clinical study can mention patients; methods/results/DOIs are stronger
  // evidence that it is a research paper than those clinical terms are that it
  // is an individual medical report.
  if (/\b(abstract|methods?|results?|doi:|10\.\d{4,9}\/|randomi[sz]ed)\b/.test(sample)) return "research_paper";
  if (/\b(patient|diagnosis|clinical history|chief complaint|medication|assessment and plan)\b/.test(sample)) return "medical_report";
  if (/\b(p\s*[<=>]|participants?)\b/.test(sample)) return "research_paper";
  if (/\b(systematic review|meta-analysis|literature review)\b/.test(sample)) return "literature_review";
  return "other";
}

function splitSections(text, pageTexts) {
  const pages = (pageTexts && pageTexts.length ? pageTexts : [text]).map((p) => String(p || ""));
  // PDF text items frequently arrive as one visual line.  Keep every PDF page
  // as a provenance boundary even when its original line/heading layout cannot
  // be recovered; this is more useful and more honest than assigning all
  // chunks to page 1.
  if (pageTexts && pageTexts.length) {
    return pages.map((page, i) => {
      const match = page.match(/(?:^|\s)(?:\d+(?:\.\d+)*\s+)?(Abstract|Introduction|Background|Methods?|Materials? and Methods?|Results?|Discussion|Conclusions?|Limitations?|References|Clinical History|Assessment|Plan)(?:\s|$)/i);
      return { heading: match ? match[1] : "Page " + (i + 1), page: i + 1, text: clean(page) };
    }).filter((s) => s.text);
  }
  const sections = [];
  let active = { heading: "Document", page: 1, text: "" };
  pages.forEach((page, pageIndex) => {
    page.split(/\n+/).forEach((raw) => {
      const line = clean(raw);
      if (!line) return;
      const isHeading = SCIENCE_HEADINGS.test(line.replace(/^\d+(?:\.\d+)*\s*/, "")) || /^#{1,3}\s+/.test(line);
      if (isHeading) {
        if (active.text) sections.push(active);
        active = { heading: line.replace(/^#{1,3}\s+|^\d+(?:\.\d+)*\s*/, "") || "Document", page: pageIndex + 1, text: "" };
      } else active.text += (active.text ? "\n" : "") + line;
    });
  });
  if (active.text) sections.push(active);
  return sections.length ? sections : [{ heading: "Document", page: 1, text: clean(text) }];
}

function extractMetadata(title, text) {
  const lines = String(text || "").split(/\n+/).map(clean).filter(Boolean);
  const doi = String(text || "").match(/\b10\.\d{4,9}\/[\w.()/:;-]+/i)?.[0] || "";
  const year = String(text || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
  const abstractAt = lines.findIndex((l) => /^abstract$/i.test(l));
  return { title: clean(title) || lines[0] || "Untitled source", doi, publicationYear: year, abstract: abstractAt >= 0 ? clean(lines.slice(abstractAt + 1, abstractAt + 5).join(" ")).slice(0, 2400) : "" };
}

function extractEvidence(sections) {
  const evidence = [];
  sections.forEach((section) => {
    const sentences = section.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    sentences.forEach((sentence) => {
      const claim = clean(sentence);
      if (claim.length < 35 || claim.length > 1100 || !FINDING.test(claim)) return;
      evidence.push({
        id: "E" + (evidence.length + 1),
        kind: /p\s*[<=>]|confidence interval|odds ratio|hazard ratio|\d+(?:\.\d+)?\s*%/i.test(claim) ? "statistic" : "finding",
        claim,
        quote: claim,
        section: section.heading,
        page: section.page,
        confidence: 0.8,
      });
    });
  });
  return evidence.slice(0, 150);
}

function buildDocumentIntelligence({ title, text, meta = {} }) {
  const sections = splitSections(text, meta.pageTexts);
  const metadata = extractMetadata(title, text);
  const classification = classifyDocument(metadata.title, text);
  return { classification, metadata, sections: sections.map((s, i) => ({ id: "S" + (i + 1), heading: s.heading, page: s.page, charCount: s.text.length })), evidence: extractEvidence(sections), sectionTexts: sections };
}

function chunkStructuredDocument(intelligence, maxChars = 900) {
  const chunks = [];
  intelligence.sectionTexts.forEach((section) => {
    const parts = section.text.match(new RegExp("[\\s\\S]{1," + maxChars + "}(?:\\s|$)", "g")) || [];
    parts.forEach((part) => {
      const text = clean(part);
      if (!text) return;
      const evidenceIds = intelligence.evidence.filter((e) => e.page === section.page && e.section === section.heading && text.includes(e.quote.slice(0, 60))).map((e) => e.id);
      chunks.push({ index: chunks.length, text, page: section.page, section: section.heading, evidenceIds });
    });
  });
  return chunks;
}

module.exports = { buildDocumentIntelligence, chunkStructuredDocument, classifyDocument };

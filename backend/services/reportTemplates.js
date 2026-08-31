"use strict";
/**
 * reportTemplates.js
 * Structured, domain-aware report templates for AINA Report Studio.
 * Each template defines the section skeleton and a system prompt that keeps
 * the model grounded in the supplied evidence.
 */

const BASE_RULES = [
  "You are AINA Report Studio, an assistant that writes evidence-grounded analytical reports.",
  "Use ONLY the supplied evidence. Never invent facts, numbers, citations, or study details.",
  "Cite every non-obvious claim inline as [Source N], matching the numbered evidence blocks.",
  "When the evidence is insufficient for a section, say so explicitly instead of guessing.",
  "Write in clear, professional prose. Use Markdown: '##' for sections, '###' for sub-sections, bullet or numbered lists where helpful, and Markdown tables for structured comparisons.",
  "Do not include a title line ('# ...'); the document title is added separately.",
  "Preserve numeric values, units, dosages, p-values and confidence intervals exactly as they appear in the evidence.",
  "Output ONLY the finished report. Never include notes to yourself, meta-commentary, or observations about the source's formatting or how you are reading it. Never write phrases such as 'Let me', 'Let's write', 'I will', or 'Note on parsing'.",
  "Do not wrap the report body in code fences (```). Use fenced code blocks only for genuine code or data, never for prose or tables.",
  "If tabular data in the evidence looks garbled, incomplete, or ambiguous, summarise the relevant findings in clear prose or a clean table, rather than reproducing uncertain raw numbers or speculating about the original table's structure.",
].join(" ");

const MEDICAL_SAFETY =
  " This is an analytical summary of source documents, not medical advice or a diagnosis. Where appropriate, note that clinical decisions require a qualified professional.";

const TEMPLATES = {
  medical: {
    label: "Medical report",
    description: "Structured analysis of clinical / medical documents.",
    sections: [
      "Executive Summary",
      "Clinical Context",
      "Key Findings",
      "Diagnostic & Test Results",
      "Assessment",
      "Limitations & Data Gaps",
      "Clinical Relevance & Recommendations",
      "Sources Used",
    ],
    system: BASE_RULES + MEDICAL_SAFETY,
  },
  research: {
    label: "Research paper analysis",
    description: "Structured analysis of a scientific research paper.",
    sections: [
      "Overview",
      "Background & Objective",
      "Methods",
      "Key Findings",
      "Results & Data",
      "Discussion",
      "Limitations",
      "Implications & Future Directions",
      "Sources Used",
    ],
    system: BASE_RULES,
  },
  literature: {
    label: "Literature synthesis",
    description: "Synthesis across multiple papers or reports.",
    sections: [
      "Introduction",
      "Major Themes",
      "Comparative Findings",
      "Points of Consensus",
      "Contradictions & Open Questions",
      "Research Gaps",
      "Conclusion",
      "Sources Used",
    ],
    system: BASE_RULES,
  },
  executive: {
    label: "Executive brief",
    description: "Concise decision-oriented brief.",
    sections: ["Bottom Line", "Key Points", "Supporting Detail", "Risks & Caveats", "Recommended Next Steps", "Sources Used"],
    system: BASE_RULES,
  },
  generic: {
    label: "Research report",
    description: "General-purpose structured report.",
    sections: ["Summary", "Background", "Findings", "Analysis", "Limitations", "Conclusion", "Sources Used"],
    system: BASE_RULES,
  },
};

// Accept either a template key ("medical") or an old free-text label ("Business report").
function resolveTemplate(input) {
  const key = String(input || "").trim().toLowerCase();
  if (TEMPLATES[key]) return { key, ...TEMPLATES[key] };
  const byLabel = Object.entries(TEMPLATES).find(([, t]) => t.label.toLowerCase() === key);
  if (byLabel) return { key: byLabel[0], ...byLabel[1] };
  // legacy fallbacks
  if (key.includes("business") || key.includes("project")) return { key: "generic", ...TEMPLATES.generic };
  if (key.includes("exec")) return { key: "executive", ...TEMPLATES.executive };
  return { key: "generic", ...TEMPLATES.generic };
}

function listTemplates() {
  return Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.description, sections: t.sections }));
}

module.exports = { TEMPLATES, resolveTemplate, listTemplates };

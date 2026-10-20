"use strict";
/**
 * parallelReportService.js
 * Map-reduce report generation. Each selected source is analysed in parallel,
 * spread across the configured provider pool so several models work at the same
 * time (the "map" step). A final synthesis call then combines the per-source
 * analyses into one coherent, templated report (the "reduce" step). This is
 * faster for multi-source reports and avoids feeding every full document to a
 * single model at once.
 */

const PER_SOURCE_TOKENS = parseInt(process.env.PARALLEL_SOURCE_TOKENS || "2200", 10);
const PER_SOURCE_CHARS = parseInt(process.env.PARALLEL_SOURCE_CHARS || "40000", 10);

function analysisPrompt(tpl, objective, n, title, text) {
  return (
    `You are analysing ONE source document so it can later be combined into a ${tpl.label}.\n` +
    `Objective of the overall report: ${objective}\n\n` +
    `Source [${n}]: ${title}\n\n` +
    `Write a concise, structured analysis of THIS source only. Capture the key findings, methods, ` +
    `results, numeric values with units, and limitations that are relevant to the objective. ` +
    `Use short '###' subheadings and bullet points. Cite statements from this source as [Source ${n}]. ` +
    `Use only what is in the source; do not add outside knowledge. Do not write an introduction or a ` +
    `full report, and do not comment on these instructions.\n\n` +
    `Source content:\n${String(text || "").slice(0, PER_SOURCE_CHARS)}`
  );
}

// Map step: analyse every source in parallel, pinning each to a different
// provider so the work is spread across the pool. Best-effort per source: if a
// source analysis fails, a short slice of its raw text is used instead so the
// synthesis step still has something to work with.
async function analyzeSources({ tpl, objective, sources, generate, providers = [], onStep, perSourceTokens }) {
  if (onStep) onStep("Analysing sources in parallel");
  const jobs = sources.map((s, i) => {
    const n = i + 1;
    const prefer = providers.length ? providers[i % providers.length] : undefined;
    return generate(analysisPrompt(tpl, objective, n, s.title, s.content), {
      preferProvider: prefer,
      maxTokens: perSourceTokens || PER_SOURCE_TOKENS,
      temperature: 0.3,
    })
      .then((text) => ({ n, title: s.title, analysis: String(text || "").trim() }))
      .catch((e) => ({ n, title: s.title, analysis: String(s.content || "").slice(0, 2000), error: e.message }));
  });
  return Promise.all(jobs);
}

function buildSynthesisPrompt(tpl, title, objective, analyses) {
  const evidence = analyses.map((a) => `[Source ${a.n}: ${a.title}]\n${a.analysis}`).join("\n\n");
  const sectionList = tpl.sections.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return (
    `Write a complete, well-structured ${tpl.label} titled "${title}".\n` +
    `Objective: ${objective}\n\n` +
    `You are given per-source analyses that were prepared in parallel. Synthesise them into one ` +
    `coherent report. Compare and connect the sources where relevant; do not simply concatenate them.\n\n` +
    `Cover these sections in order, each as a '##' Markdown heading:\n${sectionList}\n\n` +
    `Requirements:\n` +
    `- Ground every claim in the analyses and cite as [Source N], keeping the original source numbers.\n` +
    `- Preserve numeric values, units, and confidence intervals exactly.\n` +
    `- State clearly when the evidence does not cover a section instead of inventing content.\n` +
    `- End with a "## Sources Used" section listing each cited source by its title.\n\n` +
    `Begin your response directly with the first '##' section heading. Do not restate, acknowledge, ` +
    `or comment on these instructions.\n\n` +
    `Per-source analyses:\n${evidence}`
  );
}

module.exports = { analyzeSources, buildSynthesisPrompt };

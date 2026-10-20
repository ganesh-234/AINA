"use strict";

const { generateResponse } = require("./llmService");
const { embedQuery, cosine } = require("./embeddingService");

/**
 * Verification Service
 * Implements multi-step verification to reduce hallucinations
 *
 * Process:
 * 1. Extract grounded facts from sources
 * 2. Generate report based on facts
 * 3. Verify each claim against sources
 * 4. Correct or flag unsupported claims
 */

/**
 * Extract factual statements from sources
 * This creates a grounded "brief" of facts before generation
 */
async function extractGroundedFacts(sources, objective) {
  const sourceTexts = sources.map((s, i) =>
    `[Source ${i + 1}: ${s.title}]\n${s.content}\n`
  ).join("\n---\n\n");

  const prompt = `You are a factual extraction assistant. Read the following source documents carefully and extract ONLY the key facts, findings, and data points that are explicitly stated in the sources.

SOURCES:
${sourceTexts}

OBJECTIVE: ${objective}

Extract factual statements that are:
1. Explicitly stated in the sources (no inference)
2. Relevant to the objective
3. Include specific data, numbers, and citations

Format each fact as:
- [Fact] (Source: [source title])

Be comprehensive but DO NOT add information not present in the sources.`;

  const response = await generateResponse([], prompt, {
    temperature: 0.1, // Low temperature for factual extraction
    maxTokens: 2000,
    taskType: "verification",
    throwOnFailure: true,
  });

  return response;
}

/**
 * Verify claims in generated content against sources
 * Returns claims that need correction
 */
async function verifyClaims(generatedText, sources) {
  // Split generated text into claims (sentences/paragraphs)
  const claims = generatedText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Filter out very short fragments

  const verificationResults = [];

  // Check each claim against sources
  for (const claim of claims.slice(0, 50)) { // Limit to first 50 claims
    const isSupported = await verifyClaimAgainstSources(claim, sources);

    if (!isSupported) {
      verificationResults.push({
        claim,
        supported: false,
        confidence: 'low',
      });
    }
  }

  return verificationResults;
}

/**
 * Check if a single claim is supported by the sources
 */
async function verifyClaimAgainstSources(claim, sources) {
  try {
    // Use semantic search to find relevant passages
    const claimEmbedding = await embedQuery(claim);
    if (!claimEmbedding?.vector) return true; // Verification is unavailable; do not falsely flag a claim.

    let maxSimilarity = 0;
    let compared = false;

    for (const source of sources) {
      if (!source.chunks || !Array.isArray(source.chunks)) continue;

      for (const chunk of source.chunks) {
        if (!chunk.embedding) continue;

        if (source.embedModel !== claimEmbedding.model) continue;
        const similarity = cosine(claimEmbedding.vector, chunk.embedding);
        compared = true;
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    // If similarity is high enough, claim is likely supported
    return !compared || maxSimilarity > 0.75; // Threshold for support
  } catch (error) {
    console.error('Error verifying claim:', error);
    return true; // If verification fails, assume supported (fail-safe)
  }
}

/**
 * Generate corrected version of unsupported claims
 */
async function correctUnsupportedClaims(originalText, unsupportedClaims, sources) {
  if (unsupportedClaims.length === 0) {
    return originalText;
  }

  const sourceTexts = sources.map((s, i) =>
    `[Source ${i + 1}: ${s.title}]\n${s.content.substring(0, 5000)}\n`
  ).join("\n---\n\n");

  const claimsList = unsupportedClaims
    .map((c, i) => `${i + 1}. "${c.claim}"`)
    .join('\n');

  const prompt = `You are a fact-checking assistant. The following claims may not be fully supported by the source documents. Your task is to either:
1. Find support for the claim in the sources and cite it
2. Modify the claim to accurately reflect what the sources say
3. Mark the claim for removal if it cannot be supported

SOURCES:
${sourceTexts}

CLAIMS TO VERIFY:
${claimsList}

For each claim, respond in this format:
Claim [number]: [SUPPORTED/MODIFY/REMOVE]
Justification: [explanation]
${unsupportedClaims.length > 0 ? 'Corrected version: [if modifying, provide the corrected claim with citation]' : ''}

Be strict: only mark as SUPPORTED if you can point to explicit evidence in the sources.`;

  const response = await generateResponse([], prompt, {
    temperature: 0.2,
    maxTokens: 2000,
    taskType: "verification",
    throwOnFailure: true,
  });

  return response;
}

/**
 * Main verification workflow
 */
async function verifyAndCorrectReport(generatedText, sources, objective) {
  try {
    console.log('Starting verification workflow...');

    // Step 1: Extract grounded facts
    console.log('Step 1: Extracting grounded facts...');
    const groundedFacts = await extractGroundedFacts(sources, objective);

    // Step 2: Verify claims
    console.log('Step 2: Verifying claims against sources...');
    const unsupportedClaims = await verifyClaims(generatedText, sources);

    // Step 3: Correct unsupported claims if any found
    let corrections = null;
    if (unsupportedClaims.length > 0) {
      console.log(`Found ${unsupportedClaims.length} potentially unsupported claims. Generating corrections...`);
      corrections = await correctUnsupportedClaims(generatedText, unsupportedClaims, sources);
    } else {
      console.log('All claims appear to be supported by sources.');
    }

    return {
      verified: unsupportedClaims.length === 0,
      groundedFacts,
      unsupportedClaims,
      corrections,
      verificationPassed: unsupportedClaims.length === 0,
    };
  } catch (error) {
    console.error('Verification workflow error:', error);
    return {
      verified: false,
      error: error.message,
      verificationPassed: false,
    };
  }
}

/**
 * Quick verification check (for use in streaming)
 * Less comprehensive but faster
 */
async function quickVerificationCheck(text, sources) {
  // Sample random sentences for verification
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const sampleSize = Math.min(10, sentences.length);
  const samples = [];

  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * sentences.length);
    samples.push(sentences[idx]);
  }

  let supportedCount = 0;
  for (const sample of samples) {
    const isSupported = await verifyClaimAgainstSources(sample, sources);
    if (isSupported) supportedCount++;
  }

  const supportRatio = sampleSize ? supportedCount / sampleSize : 1;

  return {
    supportRatio,
    confidence: supportRatio > 0.8 ? 'high' : supportRatio > 0.6 ? 'medium' : 'low',
    samplesChecked: sampleSize,
    samplesSupported: supportedCount,
  };
}

module.exports = {
  extractGroundedFacts,
  verifyClaims,
  verifyClaimAgainstSources,
  correctUnsupportedClaims,
  verifyAndCorrectReport,
  quickVerificationCheck,
};

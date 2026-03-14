import { callLlm, parseLlmJson, type LlmOptions } from './llm';
import type {
  TriTfmConfig,
  SmartQueueResult,
  ProposerResult,
  CriticResult,
  PairwiseVotes,
  ExplanationResult,
  VersionEntry,
} from './types';
import { djb2Hash } from './utils';

// ─── Smart Queue ───────────────────────────────────────────────
export async function runSmartQueue(
  prompt: string,
  config: TriTfmConfig,
  llmOpts: LlmOptions
): Promise<SmartQueueResult> {
  try {
    const raw = await callLlm(
      'Rate the following prompt on 3 dimensions (0.0-1.0 each): clarity, structure, constraints. Return JSON only: {"clarity": number, "structure": number, "constraints": number, "reasoning": "string"}',
      prompt,
      { ...llmOpts, temperature: 0.2 }
    );

    const parsed = parseLlmJson<{ clarity: number; structure: number; constraints: number; reasoning: string }>(
      raw,
      { clarity: 0.5, structure: 0.5, constraints: 0.5, reasoning: 'Parse failed, defaulting' }
    );

    const P = 0.5 * (1 - parsed.clarity) + 0.3 * (1 - parsed.structure) + 0.2 * (1 - parsed.constraints);
    const shouldOptimize = P < config.clarityThreshold;

    return {
      clarity: parsed.clarity,
      structure: parsed.structure,
      constraints: parsed.constraints,
      priorityScore: P,
      shouldOptimize,
      reasoning: parsed.reasoning,
    };
  } catch {
    return {
      clarity: 0.5,
      structure: 0.5,
      constraints: 0.5,
      priorityScore: 0.5,
      shouldOptimize: true,
      reasoning: 'Smart Queue fallback: defaulting to optimize',
    };
  }
}

// ─── Proposer ──────────────────────────────────────────────────
export async function runProposer(
  prompt: string,
  llmOpts: LlmOptions
): Promise<ProposerResult> {
  const systemPrompt = `You are a Prompt Engineer Proposer. Transform the given prompt into a more structured, precise, and effective version.

Rules:
- Add explicit structure: First... Then... Finally...
- Specify desired output format
- Add constraints to prevent hallucinations
- Include examples or templates if helpful
- Break complex requests into sub-tasks
- Add context for intent

Return JSON only: {"improvedPrompt": "string", "improvements": ["string"]}`;

  try {
    const raw = await callLlm(systemPrompt, prompt, llmOpts);
    const result = parseLlmJson<ProposerResult>(raw, { improvedPrompt: prompt, improvements: [] });
    if (!result.improvedPrompt || result.improvedPrompt.trim().length === 0) {
      return { improvedPrompt: prompt, improvements: [] };
    }
    return result;
  } catch {
    return { improvedPrompt: prompt, improvements: [] };
  }
}

// ─── Critic ────────────────────────────────────────────────────
export async function runCritic(
  originalPrompt: string,
  improvedPrompt: string,
  config: TriTfmConfig,
  llmOpts: LlmOptions
): Promise<CriticResult> {
  const systemPrompt = `You are a Prompt Critic. Evaluate if the improved prompt is genuinely better than the original.

Evaluation criteria:
- Is the improved prompt clearer and more structured?
- Does it reduce ambiguity?
- Does it add helpful constraints?
- Is it significantly better than the original?

Return JSON only: {"approved": boolean, "score": number (0-100), "reasoning": "string"}`;

  const userPrompt = `ORIGINAL PROMPT:\n${originalPrompt}\n\nIMPROVED PROMPT:\n${improvedPrompt}`;

  try {
    const raw = await callLlm(systemPrompt, userPrompt, { ...llmOpts, temperature: 0.2 });
    const result = parseLlmJson<CriticResult>(raw, { approved: true, score: 70, reasoning: 'Parse fallback' });
    // Apply gate rule
    result.approved = result.approved || result.score >= config.criticApprovalThreshold;
    return result;
  } catch {
    return { approved: true, score: 70, reasoning: 'Critic fallback: defaulting to approved' };
  }
}

// ─── D-Block (Detailer / Expansion) ───────────────────────────
export async function runDBlock(
  prompt: string,
  config: TriTfmConfig,
  llmOpts: LlmOptions
): Promise<string> {
  let systemPrompt: string;

  if (config.useEFMNB) {
    systemPrompt = `You are a Prompt Detailer using EFMNB taxonomy. Expand the prompt by 20-30%.

Apply these stages in order:
E (EVALUATION_1): Identify and evaluate core elements/concepts in the prompt
F (EVALUATION_2): Assess relationships and context between elements
M (COMPARISON): Compare aspects, perspectives, and interpretations
N (CONCLUSION): Synthesize into a coherent expanded narrative
B (Brevity): Keep expansion within 20-30% — do not over-expand

Return ONLY the expanded prompt text, no JSON, no explanation.`;
  } else {
    systemPrompt = `You are a Prompt Detailer. Expand and enrich the prompt by 20-30%.

Rules:
- Expand and structure the input
- Add missing details and context
- Improve clarity and completeness
- Maintain core message and intent
- Target 20-30% expansion in length

Return ONLY the expanded prompt text, no JSON, no explanation.`;
  }

  const raw = await callLlm(systemPrompt, prompt, llmOpts);
  if (!raw.trim()) throw new Error('D-block returned empty response');
  return raw.trim();
}

// ─── S-Block (Stabilizer / Compression) ───────────────────────
export async function runSBlock(
  prompt: string,
  config: TriTfmConfig,
  llmOpts: LlmOptions
): Promise<string> {
  let systemPrompt: string;

  if (config.useErikson && config.eriksonStage) {
    const stages: Record<number, { conflict: string; virtue: string; focus: string }> = {
      1: { conflict: 'Trust vs. Mistrust', virtue: 'Hope', focus: 'Basic safety and reliability' },
      2: { conflict: 'Autonomy vs. Shame', virtue: 'Will', focus: 'Independence and self-control' },
      3: { conflict: 'Initiative vs. Guilt', virtue: 'Purpose', focus: 'Taking initiative and planning' },
      4: { conflict: 'Industry vs. Inferiority', virtue: 'Competence', focus: 'Mastery and productivity' },
      5: { conflict: 'Identity vs. Role Confusion', virtue: 'Fidelity', focus: 'Identity formation and values' },
      6: { conflict: 'Intimacy vs. Isolation', virtue: 'Love', focus: 'Deep relationships and commitment' },
      7: { conflict: 'Generativity vs. Stagnation', virtue: 'Care', focus: 'Contribution and legacy' },
      8: { conflict: 'Integrity vs. Despair', virtue: 'Wisdom', focus: 'Life reflection and acceptance' },
    };
    const stage = stages[config.eriksonStage] || stages[4];
    systemPrompt = `You are a Prompt Stabilizer with Erikson filter (Stage ${config.eriksonStage}: ${stage.conflict}, Virtue: ${stage.virtue}).

Compress the prompt by 30-40%. Remove content not aligned with "${stage.focus}". Preserve insights related to "${stage.virtue}".

Rules:
- Remove redundancy and excessive details
- Normalize and condense
- Keep only essential information
- Maintain clarity and coherence

Return ONLY the compressed prompt text.`;
  } else {
    systemPrompt = `You are a Prompt Stabilizer. Compress the prompt by 30-40%.

Rules:
- Remove redundancy and excessive details
- Normalize and condense
- Keep only essential information
- Maintain clarity and coherence

Return ONLY the compressed prompt text.`;
  }

  const raw = await callLlm(systemPrompt, prompt, llmOpts);
  if (!raw.trim()) throw new Error('S-block returned empty response');
  return raw.trim();
}

// ─── Pairwise Judge ───────────────────────────────────────────
export async function runPairwiseJudge(
  originalPrompt: string,
  optimizedPrompt: string,
  llmOpts: LlmOptions
): Promise<PairwiseVotes> {
  const systemPrompt = `You are a Pairwise Quality Judge. Compare OLD vs NEW prompt across 4 dimensions.

Dimensions:
1. clarity — How clear and unambiguous
2. structure — Organization and logical flow
3. constraints — Preventing hallucinations, guiding output
4. factuality — Grounded in verifiable requirements

Vote scale per dimension:
+1.0 = NEW significantly better
+0.66 = NEW moderately better
+0.33 = NEW slightly better
0 = Equal
-0.33 = OLD slightly better
-0.66 = OLD moderately better
-1.0 = OLD significantly better

Return JSON only: {"votes": [v1, v2, v3, v4]}`;

  const userPrompt = `OLD PROMPT:\n${originalPrompt}\n\nNEW PROMPT:\n${optimizedPrompt}`;

  try {
    const raw = await callLlm(systemPrompt, userPrompt, { ...llmOpts, temperature: 0.1 });
    return parseLlmJson<PairwiseVotes>(raw, { votes: [0, 0, 0, 0] });
  } catch {
    return { votes: [0, 0, 0, 0] };
  }
}

// ─── Explanation Generator ────────────────────────────────────
export async function runExplain(
  originalPrompt: string,
  optimizedPrompt: string,
  iteration: number,
  llmOpts: LlmOptions
): Promise<ExplanationResult> {
  const systemPrompt = `You are an Explanation Generator. Describe the changes made during prompt optimization iteration ${iteration}.

Return JSON only (≤150 words total):
{
  "mainIssues": ["max 3 issues found in original"],
  "keyTransformations": ["max 3 transformations applied"],
  "expectedEffects": ["max 3 effects with arrows, e.g.: clarity ↑, ambiguity ↓"]
}`;

  const userPrompt = `BEFORE:\n${originalPrompt}\n\nAFTER:\n${optimizedPrompt}`;

  try {
    const raw = await callLlm(systemPrompt, userPrompt, { ...llmOpts, temperature: 0.3 });
    return parseLlmJson<ExplanationResult>(raw, {
      mainIssues: ['Structure enhanced'],
      keyTransformations: ['Restructured for clarity'],
      expectedEffects: ['clarity ↑'],
    });
  } catch {
    return {
      mainIssues: ['Structure enhanced'],
      keyTransformations: ['Restructured for clarity'],
      expectedEffects: ['clarity ↑'],
    };
  }
}

// ─── Versioning ───────────────────────────────────────────────
export function createVersion(
  promptContent: string,
  iteration: number,
  originalId: string,
  previousContent: string
): VersionEntry {
  return {
    originalId,
    newId: `${originalId}-v${iteration}`,
    iterationNumber: iteration,
    previousContentHash: djb2Hash(previousContent),
    contentHash: djb2Hash(promptContent),
    promptContent,
    reviewerAction: 'pending',
    timestamp: new Date().toISOString(),
  };
}

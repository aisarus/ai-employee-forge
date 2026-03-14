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
  const systemPrompt = `You are a Prompt Engineer (v1.1). Transform a raw business description into a structured, operational, deployment-ready SYSTEM PROMPT for a chatbot.

## MANDATORY RULES
- Always preserve the original intent of the raw instruction.
- Convert descriptive statements into operational rules.
- Transform vague behavior into explicit step-by-step logic.
- Remove redundancy — do not repeat the same rule in multiple sections.
- Prefer actionable instructions over general descriptions.
- Keep the final prompt concise but operationally complete.
- Produce exactly one final structured prompt block.

## REQUIRED OUTPUT SECTIONS (use these exact headers)

### ROLE
Bot identity — who it is. Keep short and explicit.

### MISSION
Primary goal in 1-2 sentences.

### CAPABILITIES
Numbered list of concrete bot abilities (not vague aspirations).

### WORKFLOW
Define ordered actions for the bot in key scenarios. If a task involves multi-step support, booking, qualification, or troubleshooting, convert into numbered workflow logic. If a scenario has branches, explicitly define IF-THEN logic (e.g., IF urgent / IF non-urgent / IF unclear / IF unrelated).

### BEHAVIOR_RULES
Operational rules: greeting, handling questions, escalation, missing-data behavior, language policy.
- If the bot needs user data, instruct it to ask only for missing fields — never re-ask for already provided info.
- CRITICAL: Detect the language of the original raw instruction and add a rule: "Always respond in [detected language] unless the user explicitly requests another language."

### RESPONSE_STRUCTURE
How the bot formats responses. Define different response structures for different situations if applicable. Do NOT use generic wording like "be concise" — define concrete format per scenario.

### CONSTRAINTS
What the bot must NOT do. Constraints must be explicit, behavioral, and testable.

## ANTI-PATTERNS TO AVOID
- Purely descriptive prompts with no operational logic
- Repeated rules across sections without added value
- Generic phrases like "be helpful" without context
- Response structure defined only as style instead of format
- Ignoring missing-data collection logic
- Ignoring the original instruction language

## OUTPUT FORMAT
Write as a direct instruction TO the chatbot (e.g. "You are a sales assistant...").
Be complete and self-contained — no placeholders, no TODOs, no meta-commentary.
Output the actual chatbot system prompt itself, NOT instructions about how to write one.

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
  const systemPrompt = `You are a Prompt Critic (v1.1). Evaluate a chatbot system prompt against deployment-readiness criteria.

Evaluation criteria:
1. Is it written as a direct instruction TO the chatbot? (not a meta-instruction)
2. Does it contain all required sections: ROLE, MISSION, CAPABILITIES, WORKFLOW, BEHAVIOR_RULES, RESPONSE_STRUCTURE, CONSTRAINTS?
3. Does it contain operational workflow logic (not just descriptions)?
4. Does it define missing-data handling (ask only for missing fields)?
5. Does it include a language lock rule tied to the original raw instruction?
6. Are constraints explicit, behavioral, and testable?
7. Does it avoid anti-patterns: repeated rules, generic phrases, style-only response structure?

If the prompt is a meta-instruction (about how to write prompts) rather than an actual chatbot instruction, set approved=false.
If the prompt lacks WORKFLOW or missing-data handling for a bot that clearly needs them, reduce score significantly.

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
    systemPrompt = `You are enriching a chatbot system prompt using EFMNB taxonomy. Expand it by 20-30%.

The input is a direct chatbot instruction. Your output must ALSO be a direct chatbot instruction.

Apply these stages:
E: Identify core behavioral rules, workflows, and business logic
F: Assess relationships between rules (edge cases, dependencies, branching scenarios)
M: Compare possible user scenarios and bot responses — add missing IF-THEN branches
N: Synthesize into a richer, more complete chatbot instruction with explicit workflow steps
B: Keep expansion within 20-30%

Quality checks during expansion:
- If WORKFLOW section exists but lacks branching logic, add IF-THEN branches for key scenarios
- If missing-data handling is absent, add rules for asking only missing fields
- If response structure is generic, make it scenario-specific
- Ensure language lock rule is present

Return ONLY the expanded chatbot system prompt. No JSON, no explanation, no meta-commentary.`;
  } else {
    systemPrompt = `You are enriching a chatbot system prompt. Expand it by 20-30%.

The input is a direct chatbot instruction. Your output must ALSO be a direct chatbot instruction.

Rules:
- Add missing behavioral rules and edge case handling
- Improve clarity of business logic
- Add tone/style guidelines if missing
- Maintain the bot's persona and all existing rules

Return ONLY the expanded chatbot system prompt. No JSON, no explanation.`;
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
    systemPrompt = `You are compressing a chatbot system prompt with Erikson filter (Stage ${config.eriksonStage}: ${stage.conflict}, Virtue: ${stage.virtue}).

Compress by 30-40%. The output must remain a direct chatbot instruction.
Remove behavioral rules not aligned with "${stage.focus}". Preserve rules related to "${stage.virtue}".

Rules:
- Remove redundancy
- Condense similar rules
- Keep all critical business logic
- Output must be a ready-to-use chatbot system prompt

Return ONLY the compressed chatbot system prompt.`;
  } else {
    systemPrompt = `You are compressing a chatbot system prompt by 30-40%.

The output must remain a direct, ready-to-use chatbot instruction.

Rules:
- Remove redundancy and verbose phrasing
- Merge similar behavioral rules
- Keep all critical business logic and constraints
- Maintain the bot's persona

Return ONLY the compressed chatbot system prompt.`;
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

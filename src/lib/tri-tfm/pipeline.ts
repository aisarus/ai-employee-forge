import type { TriTfmConfig, TriTfmOutput, ExplanationResult, VersionEntry, OnProgress } from './types';
import { DEFAULT_CONFIG } from './types';
import type { LlmOptions } from './llm';
import {
  runSmartQueue,
  runProposer,
  runCritic,
  runDBlock,
  runSBlock,
  runPairwiseJudge,
  runExplain,
  createVersion,
} from './stages';
import { estimateTokens, tokenChangeRate, analyzeComplexity } from './utils';

export interface PipelineInput {
  prompt: string;
  apiKey: string;
  config?: Partial<TriTfmConfig>;
  onProgress?: OnProgress;
}

export async function runTriTfmPipeline(input: PipelineInput): Promise<TriTfmOutput> {
  const startTime = Date.now();
  const config: TriTfmConfig = { ...DEFAULT_CONFIG, ...input.config };
  const llmOpts: LlmOptions = { apiKey: input.apiKey };
  const onProgress = input.onProgress ?? (() => {});

  const originalPrompt = input.prompt;
  const originalTokens = estimateTokens(originalPrompt);
  const originalId = `prompt-${Date.now()}`;

  // Pre-analysis
  const complexity = analyzeComplexity(originalPrompt);
  const effectiveMaxIter = Math.min(config.maxIterations, complexity.recommendedIterations);

  // Auto-set Erikson stage based on task type
  if (config.useErikson && !config.eriksonStage) {
    config.eriksonStage = complexity.taskType === 'technical' ? 5 : 3;
  }

  const explanations: ExplanationResult[] = [];
  const versionLog: VersionEntry[] = [];
  let currentPrompt = originalPrompt;
  let totalIterations = 0;
  let convergedAtIter: number | null = null;
  let refineTokens = 0;

  // ── Stage 1: Smart Queue ──────────────────────────────────
  if (config.smartQueueEnabled) {
    onProgress('smart_queue', 'Analyzing prompt quality and complexity...');
    const sqResult = await runSmartQueue(currentPrompt, config, llmOpts);

    if (!sqResult.shouldOptimize) {
      onProgress('smart_queue', 'Prompt already high quality, skipping optimization');
      const finalTokens = estimateTokens(currentPrompt);
      return buildOutput(originalPrompt, currentPrompt, originalTokens, finalTokens, 0, explanations, versionLog, null, convergedAtIter, startTime, config);
    }
  }

  // ── Stage 2: PCV Pipeline ────────────────────────────────
  if (config.useProposerCriticVerifier || config.proposerCriticOnly) {
    onProgress('pcv', 'Starting Proposer-Critic pipeline...');

    if (config.proposerCriticOnly) {
      // Iterative PCV mode
      for (let i = 1; i <= effectiveMaxIter; i++) {
        onProgress('pcv', `Iteration ${i}/${effectiveMaxIter}: Decomposing prompt...`);
        totalIterations = i;

        const previousPrompt = currentPrompt;

        // Proposer
        const proposed = await runProposer(currentPrompt, llmOpts);
        refineTokens += estimateTokens(proposed.improvedPrompt);

        onProgress('pcv', `Iteration ${i}/${effectiveMaxIter}: Analyzing quality...`);

        // Critic — always accept the improved prompt; the proposer structures raw input
        await runCritic(currentPrompt, proposed.improvedPrompt, config, llmOpts);
        currentPrompt = proposed.improvedPrompt;

        // Versioning
        if (config.versioningEnabled) {
          versionLog.push(createVersion(currentPrompt, i, originalId, previousPrompt));
        }

        // Explanation
        if (config.explainModeEnabled) {
          onProgress('pcv', `Iteration ${i}/${effectiveMaxIter}: Generating explanation...`);
          const exp = await runExplain(previousPrompt, currentPrompt, i, llmOpts);
          explanations.push(exp);
        }

        // Check convergence (no change from previous)
        if (currentPrompt === previousPrompt) {
          convergedAtIter = i;
          break;
        }

        const changeRate = tokenChangeRate(previousPrompt, currentPrompt);
        if (changeRate < config.convergenceThreshold) {
          convergedAtIter = i;
          break;
        }
      }
    } else {
      // Single PCV pass
      totalIterations = 1;
      const proposed = await runProposer(currentPrompt, llmOpts);
      refineTokens += estimateTokens(proposed.improvedPrompt);

      // Critic — always accept the improved prompt; the proposer structures raw input
      await runCritic(currentPrompt, proposed.improvedPrompt, config, llmOpts);
      currentPrompt = proposed.improvedPrompt;

      if (config.versioningEnabled) {
        versionLog.push(createVersion(currentPrompt, 1, originalId, originalPrompt));
      }

      if (config.explainModeEnabled) {
        const exp = await runExplain(originalPrompt, currentPrompt, 1, llmOpts);
        explanations.push(exp);
      }
    }
  }

  // ── Stage 3: D-S Loop ────────────────────────────────────
  if (!config.proposerCriticOnly) {
    for (let i = 1; i <= effectiveMaxIter; i++) {
      const iterNum = totalIterations + i;
      onProgress('ds_loop', `D-S iteration ${i}/${effectiveMaxIter}`);

      const previousPrompt = currentPrompt;

      // D-Block (Expansion)
      onProgress('d_block', `Expanding (iteration ${i})...`);
      try {
        currentPrompt = await runDBlock(currentPrompt, config, llmOpts);
      } catch (e) {
        throw new Error(`D-block failed at iteration ${i}: ${e}`);
      }

      // S-Block (Compression)
      onProgress('s_block', `Compressing (iteration ${i})...`);
      try {
        currentPrompt = await runSBlock(currentPrompt, config, llmOpts);
      } catch (e) {
        throw new Error(`S-block failed at iteration ${i}: ${e}`);
      }

      // Versioning
      if (config.versioningEnabled) {
        versionLog.push(createVersion(currentPrompt, iterNum, originalId, previousPrompt));
      }

      // Explanation
      if (config.explainModeEnabled) {
        const exp = await runExplain(previousPrompt, currentPrompt, iterNum, llmOpts);
        explanations.push(exp);
      }

      // Convergence check
      const changeRate = tokenChangeRate(previousPrompt, currentPrompt);
      if (changeRate < config.convergenceThreshold) {
        convergedAtIter = iterNum;
        totalIterations = iterNum;
        break;
      }

      totalIterations = iterNum;
    }
  }

  // ── Stage 4: Pairwise Judge ──────────────────────────────
  onProgress('pairwise_judge', 'Evaluating final prompt quality...');
  const pairwiseVotes = await runPairwiseJudge(originalPrompt, currentPrompt, llmOpts);

  // ── Build output ─────────────────────────────────────────
  const finalTokens = estimateTokens(currentPrompt);

  // Mark final version as accepted
  if (versionLog.length > 0) {
    versionLog[versionLog.length - 1].reviewerAction = 'accept';
  }

  return buildOutput(
    originalPrompt, currentPrompt, originalTokens, finalTokens,
    totalIterations, explanations, versionLog, pairwiseVotes,
    convergedAtIter, startTime, config, refineTokens
  );
}

function buildOutput(
  originalPrompt: string,
  finalPrompt: string,
  origTokens: number,
  finalTokens: number,
  iterations: number,
  explanations: ExplanationResult[],
  versionLog: VersionEntry[],
  pairwiseVotes: { votes: [number, number, number, number] } | null,
  convergedAtIter: number | null,
  startTime: number,
  config: TriTfmConfig,
  refineTokens: number = 0,
): TriTfmOutput {
  const votes = pairwiseVotes?.votes ?? [0, 0, 0, 0];
  const deltaQ = votes.reduce((a, b) => a + b, 0) / 4;
  const deltaT = origTokens > 0 ? (finalTokens - origTokens) / origTokens : 0;
  const qualityGainPercent = Math.round(100 * deltaQ);
  const compactnessPercent = Math.round(-100 * deltaT);
  const rgi = deltaQ / Math.max(Math.abs(deltaT), 1e-6);
  const rgiPercent = Math.round(rgi * 100);
  const efficiency = deltaQ - config.lambda * deltaT;
  const effPercent = Math.round(efficiency * 100);

  return {
    finalText: finalPrompt,
    originalPrompt,
    metrics: {
      deltaQ,
      deltaT,
      qualityGainPercent,
      compactnessPercent,
      rgi,
      rgiPercent,
      efficiency,
      effPercent,
      iterations,
    },
    explanations,
    versionLog,
    pairwiseVotes: pairwiseVotes,
    telemetry: {
      accepted: convergedAtIter !== null || iterations > 0,
      accepted_iter: convergedAtIter,
      tta_sec: (Date.now() - startTime) / 1000,
      cost_cents: finalTokens * 0.000002 * 100,
      tokens_breakdown: {
        orig: origTokens,
        refine: refineTokens,
        final: finalTokens,
      },
    },
    // Compat fields for existing Workspace UI
    modeFreeMetrics: {
      rgiPercent: Math.abs(rgiPercent),
      qualityGainPercent: Math.abs(qualityGainPercent),
    },
  };
}

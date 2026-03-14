export interface TriTfmConfig {
  a: number;
  b: number;
  maxIterations: number;
  convergenceThreshold: number;
  clarityThreshold: number;
  lambda: number;
  criticApprovalThreshold: number;
  useEFMNB: boolean;
  useErikson: boolean;
  eriksonStage?: number;
  useProposerCriticVerifier: boolean;
  proposerCriticOnly: boolean;
  smartQueueEnabled: boolean;
  explainModeEnabled: boolean;
  versioningEnabled: boolean;
}

export const DEFAULT_CONFIG: TriTfmConfig = {
  a: 0.20,
  b: 0.35,
  maxIterations: 10,
  convergenceThreshold: 0.05,
  clarityThreshold: 0.85,
  lambda: 0.2,
  criticApprovalThreshold: 60,
  useEFMNB: true,
  useErikson: true,
  useProposerCriticVerifier: false,
  proposerCriticOnly: false,
  smartQueueEnabled: true,
  explainModeEnabled: true,
  versioningEnabled: true,
};

export interface SmartQueueResult {
  clarity: number;
  structure: number;
  constraints: number;
  priorityScore: number;
  shouldOptimize: boolean;
  reasoning: string;
}

export interface ProposerResult {
  improvedPrompt: string;
  improvements: string[];
}

export interface CriticResult {
  approved: boolean;
  score: number;
  reasoning: string;
}

export interface PairwiseVotes {
  votes: [number, number, number, number]; // clarity, structure, constraints, factuality
}

export interface ExplanationResult {
  mainIssues: string[];
  keyTransformations: string[];
  expectedEffects: string[];
}

export interface VersionEntry {
  originalId: string;
  newId: string;
  iterationNumber: number;
  previousContentHash: string;
  contentHash: string;
  promptContent: string;
  reviewerAction: 'pending' | 'accept' | 'reject' | 'rollback';
  timestamp: string;
}

export interface TriTfmMetrics {
  deltaQ: number;
  deltaT: number;
  qualityGainPercent: number;
  compactnessPercent: number;
  rgi: number;
  rgiPercent: number;
  efficiency: number;
  effPercent: number;
  iterations: number;
}

export interface TriTfmOutput {
  finalText: string;
  originalPrompt: string;
  metrics: TriTfmMetrics;
  explanations: ExplanationResult[];
  versionLog: VersionEntry[];
  pairwiseVotes: PairwiseVotes | null;
  telemetry: {
    accepted: boolean;
    accepted_iter: number | null;
    tta_sec: number;
    cost_cents: number;
    tokens_breakdown: { orig: number; refine: number; final: number };
  };
  // compat fields for existing UI
  modeFreeMetrics?: {
    rgiPercent: number;
    qualityGainPercent: number;
  };
}

export type OnProgress = (stage: string, detail?: string) => void;

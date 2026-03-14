/** Estimate token count (rough: ~4 chars per token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** DJB2 hash → hex string (16 chars, zero-padded) */
export function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash | 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/** Token change rate between two texts */
export function tokenChangeRate(oldText: string, newText: string): number {
  const tOld = estimateTokens(oldText);
  const tNew = estimateTokens(newText);
  if (tOld === 0) return 1;
  return Math.abs(tNew - tOld) / tOld;
}

/** Analyze prompt complexity (client-side pre-analysis) */
export function analyzeComplexity(prompt: string): { score: number; recommendedIterations: number; taskType: 'creative' | 'technical' | 'general' } {
  const tokens = estimateTokens(prompt);

  // Length factor
  const lengthScore = Math.min(tokens / 10, 100) * 0.25;

  // Structure factor
  const structureSignals = [
    /[-*•]\s/gm,    // lists
    /^#{1,6}\s/gm,  // headers
    /\*\*.+?\*\*/g, // bold
    /\n\n/g,        // paragraphs
    /```/g,         // code blocks
  ];
  const structureHits = structureSignals.reduce((sum, re) => sum + (prompt.match(re)?.length || 0), 0);
  const structureScore = Math.min(structureHits * 10, 100) * 0.25;

  // Technical terms
  const techTerms = /\b(API|REST|GraphQL|ML|AI|LLM|GPT|database|SQL|architecture|security|authentication|OAuth|webhook|microservice|kubernetes|docker|CI\/CD|testing|algorithm|optimization)\b/gi;
  const techHits = prompt.match(techTerms)?.length || 0;
  const techScore = Math.min(techHits * 15, 100) * 0.25;

  // Specificity
  const specSignals = /\b(must|should|exactly|required|specific|format|template|example|step|phase|constraint)\b/gi;
  const specHits = prompt.match(specSignals)?.length || 0;
  const specScore = Math.min(specHits * 12, 100) * 0.25;

  const totalScore = Math.min(lengthScore + structureScore + techScore + specScore, 100);

  // Determine iterations
  let recommendedIterations: number;
  if (totalScore < 20) recommendedIterations = 1;
  else if (totalScore < 40) recommendedIterations = 2;
  else if (totalScore < 60) recommendedIterations = 3;
  else if (totalScore < 80) recommendedIterations = 4;
  else recommendedIterations = 5;

  // Task type detection
  const creativeKw = /\b(create|draw|design|imagine|story|art|video|music|write|compose)\b/gi;
  const technicalKw = /\b(code|algorithm|API|database|optimize|architecture|testing|debug|deploy|implement)\b/gi;
  const creativeCount = prompt.match(creativeKw)?.length || 0;
  const technicalCount = prompt.match(technicalKw)?.length || 0;
  const taskType = technicalCount > creativeCount ? 'technical' : creativeCount > 0 ? 'creative' : 'general';

  return { score: totalScore, recommendedIterations, taskType };
}

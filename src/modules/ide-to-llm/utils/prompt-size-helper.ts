import { LlmContextLimits, LlmCopypasterConfig } from '../../../config';

export interface BuildPromptWithSizeStatsArgs {
  promptText: string;
  config: LlmCopypasterConfig;
}

export interface BuildPromptWithSizeStatsResult {
  promptTextWithStats: string;
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: ('LINES' | 'TOKENS')[];
}

export function buildPromptWithSizeStats(args: BuildPromptWithSizeStatsArgs): BuildPromptWithSizeStatsResult {
  const normalizedPromptText = args.promptText ?? '';

  const linesCount = countLines(normalizedPromptText);
  const approxTokensCount = estimateTokensCount(normalizedPromptText, args.config);

  const limits = resolveLimitsForCurrentLlm(args.config);

  const exceededBy: ('LINES' | 'TOKENS')[] = [];

  if (limits.maxLinesCountInContext !== 0 && linesCount > limits.maxLinesCountInContext) exceededBy.push('LINES');
  if (limits.maxTokensCountInContext !== 0 && approxTokensCount > limits.maxTokensCountInContext) exceededBy.push('TOKENS');

  const isExceeded = exceededBy.length > 0;

  const statsFooterText = buildPromptFooterText({
    linesCount,
    approxTokensCount,
    maxLinesCountInContext: limits.maxLinesCountInContext,
    maxTokensCountInContext: limits.maxTokensCountInContext,
    isExceeded,
    exceededBy,
  });

  const promptTextWithStats = `${normalizedPromptText}\n\n${statsFooterText}\n`;

  return {
    promptTextWithStats,
    linesCount,
    approxTokensCount,
    maxLinesCountInContext: limits.maxLinesCountInContext,
    maxTokensCountInContext: limits.maxTokensCountInContext,
    isExceeded,
    exceededBy,
  };
}

function resolveLimitsForCurrentLlm(config: LlmCopypasterConfig): LlmContextLimits {
  const limitsByLlm = config.llmContextLimitsByLlm ?? {};
  const currentLlmKey = String(config.currentLLM ?? 'default');

  const currentLlmLimits = limitsByLlm[currentLlmKey];
  if (currentLlmLimits) return normalizeLimits(currentLlmLimits);

  const defaultLimits = limitsByLlm['default'];
  if (defaultLimits) return normalizeLimits(defaultLimits);

  return normalizeLimits({ maxLinesCountInContext: 0, maxTokensCountInContext: 0 });
}

function normalizeLimits(limits: LlmContextLimits): LlmContextLimits {
  const maxLinesCountInContext = Number.isFinite(limits.maxLinesCountInContext)
    ? Math.max(0, limits.maxLinesCountInContext)
    : 0;
  const maxTokensCountInContext = Number.isFinite(limits.maxTokensCountInContext)
    ? Math.max(0, limits.maxTokensCountInContext)
    : 0;

  return { maxLinesCountInContext, maxTokensCountInContext };
}

function countLines(text: string): number {
  if (!text) return 0;

  const parts = text.split(/\r\n|\r|\n/);
  return parts.length;
}

function estimateTokensCount(text: string, config: LlmCopypasterConfig): number {
  if (!text) return 0;

  const configuredApproxCharsPerToken = Number(config.promptSizeApproxCharsPerToken);
  const approxCharsPerToken = Number.isFinite(configuredApproxCharsPerToken) ? configuredApproxCharsPerToken : 4;
  const safeApproxCharsPerToken = Math.max(1, approxCharsPerToken);

  return Math.ceil(text.length / safeApproxCharsPerToken);
}

function buildPromptFooterText(args: {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: ('LINES' | 'TOKENS')[];
}): string {
  const baseStats = `[CONTEXT STATS] Lines: ${args.linesCount} | Tokens (approx): ${args.approxTokensCount}`;

  const maxLinesPart =
    args.maxLinesCountInContext === 0 ? 'Max lines: unlimited' : `Max lines: ${args.maxLinesCountInContext}`;
  const maxTokensPart =
    args.maxTokensCountInContext === 0 ? 'Max tokens: unlimited' : `Max tokens: ${args.maxTokensCountInContext}`;
  const limitsPart = `${maxLinesPart} | ${maxTokensPart}`;

  if (!args.isExceeded) return `${baseStats}\n${limitsPart}`;

  const exceededParts: string[] = [];
  if (args.exceededBy.includes('LINES')) exceededParts.push('lines');
  if (args.exceededBy.includes('TOKENS')) exceededParts.push('tokens');

  return `${baseStats}\n${limitsPart}\nExceeded by: ${exceededParts.join(', ')}`;
}

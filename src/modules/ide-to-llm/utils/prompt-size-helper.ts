import { LlmCopypasterConfig } from '../../../config-service';

export interface BuildPromptWithSizeStatsArgs {
  promptText: string;
  config: LlmCopypasterConfig;
}

export enum PromptSizeExceededBy {
  LINES = 'LINES',
  TOKENS = 'TOKENS',
}

export interface BuildPromptWithSizeStatsResult {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: PromptSizeExceededBy[];
}

interface LlmContextLimits {
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export function buildPromptWithSizeStats(args: BuildPromptWithSizeStatsArgs): BuildPromptWithSizeStatsResult {
  const normalizedPromptText = args.promptText ?? '';

  const linesCount = countLines(normalizedPromptText);
  const approxTokensCount = estimateTokensCount(normalizedPromptText, args.config);

  const limits = normalizeLimits(args.config.baseSettings.ideToLlmContextConfig);

  const exceededBy: PromptSizeExceededBy[] = [];

  if (limits.maxLinesCountInContext !== 0 && linesCount > limits.maxLinesCountInContext)
    exceededBy.push(PromptSizeExceededBy.LINES);

  if (limits.maxTokensCountInContext !== 0 && approxTokensCount > limits.maxTokensCountInContext)
    exceededBy.push(PromptSizeExceededBy.TOKENS);

  const isExceeded = exceededBy.length > 0;

  return {
    linesCount,
    approxTokensCount,
    maxLinesCountInContext: limits.maxLinesCountInContext,
    maxTokensCountInContext: limits.maxTokensCountInContext,
    isExceeded,
    exceededBy,
  };
}

function normalizeLimits(limits: { maxLinesCountInContext: number; maxTokensCountInContext: number }): LlmContextLimits {
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

  const configuredApproxCharsPerToken = Number(config.baseSettings.ideToLlmContextConfig.promptSizeApproxCharsPerToken);
  const approxCharsPerToken = Number.isFinite(configuredApproxCharsPerToken) ? configuredApproxCharsPerToken : 4;
  const safeApproxCharsPerToken = Math.max(1, approxCharsPerToken);

  return Math.ceil(text.length / safeApproxCharsPerToken);
}

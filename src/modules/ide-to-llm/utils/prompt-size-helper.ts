import { IdeToLlmContextConfig, LlmToIdeContextConfig } from '../../../config-service';

export interface TextSizeStatsInput {
  promptText: string;
  contextConfig: IdeToLlmContextConfig | LlmToIdeContextConfig;
}

export enum PromptSizeExceededBy {
  LINES = 'LINES',
  TOKENS = 'TOKENS',
}

export interface TextSizeStatsOutput {
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

export function buildTextSizeStats(input: TextSizeStatsInput): TextSizeStatsOutput {
  const normalizedPromptText = input.promptText ?? '';

  const linesCount = countLines(normalizedPromptText);
  const approxTokensCount = estimateTokensCount(normalizedPromptText, input.contextConfig);

  const limits = normalizeLimits(input.contextConfig);

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

export function buildPromptSizeStatsSuffix(promptSizeStats: TextSizeStatsOutput | null): string {
  if (!promptSizeStats) return '';

  const isLinesExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.LINES);
  const isTokensExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.TOKENS);

  const linesPart = `${isLinesExceeded ? 'Lines!:' : 'Lines:'} ~${formatCountInThousands(promptSizeStats.linesCount)}/${formatCountInThousands(
    promptSizeStats.maxLinesCountInContext
  )}`;

  const tokensPart = `${isTokensExceeded ? 'Tokens!:' : 'Tokens:'} ~${formatCountInThousands(
    promptSizeStats.approxTokensCount
  )}/${formatCountInThousands(promptSizeStats.maxTokensCountInContext)}`;

  return `${linesPart}; ${tokensPart};`;
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

function estimateTokensCount(text: string, contextConfig: { promptSizeApproxCharsPerToken: number }): number {
  if (!text) return 0;

  const configuredApproxCharsPerToken = Number(contextConfig.promptSizeApproxCharsPerToken);
  const approxCharsPerToken = Number.isFinite(configuredApproxCharsPerToken) ? configuredApproxCharsPerToken : 4;
  const safeApproxCharsPerToken = Math.max(1, approxCharsPerToken);

  return Math.ceil(text.length / safeApproxCharsPerToken);
}

function formatCountInThousands(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (Math.abs(safeValue) < 1000) return String(Math.trunc(safeValue));

  const roundedK = Math.round((safeValue / 1000) * 10) / 10;
  const text = roundedK % 1 === 0 ? roundedK.toFixed(0) : roundedK.toFixed(1);

  return `${text}K`;
}

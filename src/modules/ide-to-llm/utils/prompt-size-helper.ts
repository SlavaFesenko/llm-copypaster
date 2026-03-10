import { IdeToLlmConfig, LlmToIdeConfig } from '../../../config/system-config-contracts';

export interface TextSizeStatsInput {
  promptText: string;
  contextConfig: IdeToLlmConfig | LlmToIdeConfig;
}

export enum PromptSizeExceededBy {
  LINES = 'LINES',
  TOKENS = 'TOKENS',
}

export interface TextSizeStatsOutput {
  linesCount: number;
  approxTokensCount: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
  isExceeded: boolean;
  exceededBy: PromptSizeExceededBy[];
}

interface LlmContextLimits {
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
}

export function buildTextSizeStats(input: TextSizeStatsInput): TextSizeStatsOutput {
  const normalizedPromptText = input.promptText ?? '';

  const linesCount = countLines(normalizedPromptText);
  const approxTokensCount = estimateTokensCount(normalizedPromptText, input.contextConfig);

  const limits = normalizeLimits(input.contextConfig);

  const exceededBy: PromptSizeExceededBy[] = [];

  if (limits.linesMaxToShowWarning !== 0 && linesCount > limits.linesMaxToShowWarning)
    exceededBy.push(PromptSizeExceededBy.LINES);

  if (limits.tokensMaxToShowWarning !== 0 && approxTokensCount > limits.tokensMaxToShowWarning)
    exceededBy.push(PromptSizeExceededBy.TOKENS);

  const isExceeded = exceededBy.length > 0;

  return {
    linesCount,
    approxTokensCount,
    linesMaxToShowWarning: limits.linesMaxToShowWarning,
    tokensMaxToShowWarning: limits.tokensMaxToShowWarning,
    isExceeded,
    exceededBy,
  };
}

export function buildPromptSizeStatsSuffix(promptSizeStats: TextSizeStatsOutput | null): string {
  if (!promptSizeStats) return '';

  const isLinesExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.LINES);
  const isTokensExceeded = promptSizeStats.exceededBy.includes(PromptSizeExceededBy.TOKENS);

  const linesPart = `${isLinesExceeded ? 'Lines!:' : 'Lines:'} ~${formatCountInThousands(promptSizeStats.linesCount)}/${formatCountInThousands(
    promptSizeStats.linesMaxToShowWarning
  )}`;

  const tokensPart = `${isTokensExceeded ? 'Tokens!:' : 'Tokens:'} ~${formatCountInThousands(
    promptSizeStats.approxTokensCount
  )}/${formatCountInThousands(promptSizeStats.tokensMaxToShowWarning)}`;

  return `${linesPart}; ${tokensPart};`;
}

function normalizeLimits(limits: { linesMaxToShowWarning: number; tokensMaxToShowWarning: number }): LlmContextLimits {
  const linesMaxToShowWarning = Number.isFinite(limits.linesMaxToShowWarning)
    ? Math.max(0, limits.linesMaxToShowWarning)
    : 0;
  const tokensMaxToShowWarning = Number.isFinite(limits.tokensMaxToShowWarning)
    ? Math.max(0, limits.tokensMaxToShowWarning)
    : 0;

  return { linesMaxToShowWarning, tokensMaxToShowWarning };
}

function countLines(text: string): number {
  if (!text) return 0;

  const parts = text.split(/\r\n|\r|\n/);
  return parts.length;
}

function estimateTokensCount(text: string, contextConfig: { charsPerToken: number }): number {
  if (!text) return 0;

  const configuredCharsPerToken = Number(contextConfig.charsPerToken);
  const approxCharsPerToken = Number.isFinite(configuredCharsPerToken) ? configuredCharsPerToken : 4;
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

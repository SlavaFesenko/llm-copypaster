import * as vscode from 'vscode';

import { LlmContextLimits, LlmCopypasterConfig } from '../../../config';

export interface BuildPromptWithSizeStatsAndNotifyArgs {
  commandDisplayName: string;
  promptText: string;
  config: LlmCopypasterConfig;
}

export interface BuildPromptWithSizeStatsAndNotifyResult {
  promptTextWithStats: string;
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: ('LINES' | 'TOKENS')[];
}

export async function buildPromptWithSizeStatsAndNotify(
  args: BuildPromptWithSizeStatsAndNotifyArgs
): Promise<BuildPromptWithSizeStatsAndNotifyResult> {
  const normalizedPromptText = args.promptText ?? '';

  const linesCount = countLines(normalizedPromptText);
  const approxTokensCount = estimateTokensCount(normalizedPromptText);

  const limits = resolveLimitsForCurrentLlm(args.config);

  const exceededBy: ('LINES' | 'TOKENS')[] = [];

  if (limits.maxLinesCountInContext !== 0 && linesCount > limits.maxLinesCountInContext) exceededBy.push('LINES');
  if (limits.maxTokensCountInContext !== 0 && approxTokensCount > limits.maxTokensCountInContext) exceededBy.push('TOKENS');

  const isExceeded = exceededBy.length > 0;

  const notificationText = buildNotificationText({
    commandDisplayName: args.commandDisplayName,
    linesCount,
    approxTokensCount,
    maxLinesCountInContext: limits.maxLinesCountInContext,
    maxTokensCountInContext: limits.maxTokensCountInContext,
    isExceeded,
    exceededBy,
  });

  if (isExceeded) {
    await vscode.window.showWarningMessage(notificationText);
  } else {
    await vscode.window.showInformationMessage(notificationText);
  }

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

function estimateTokensCount(text: string): number {
  if (!text) return 0;

  return Math.ceil(text.length / 4);
}

function buildNotificationText(args: {
  commandDisplayName: string;
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: ('LINES' | 'TOKENS')[];
}): string {
  const baseStats = `[${args.commandDisplayName}] Context size: ${args.linesCount} line(s), ~${args.approxTokensCount} token(s)`;

  const maxLinesPart = args.maxLinesCountInContext === 0 ? 'maxLines=unlimited' : `maxLines=${args.maxLinesCountInContext}`;
  const maxTokensPart =
    args.maxTokensCountInContext === 0 ? 'maxTokens=unlimited' : `maxTokens=${args.maxTokensCountInContext}`;
  const limitsPart = `(${maxLinesPart}, ${maxTokensPart})`;

  if (!args.isExceeded) return `${baseStats} ${limitsPart}`;

  const exceededParts: string[] = [];
  if (args.exceededBy.includes('LINES')) exceededParts.push('lines');
  if (args.exceededBy.includes('TOKENS')) exceededParts.push('tokens');

  return `${baseStats} ${limitsPart} Exceeded by: ${exceededParts.join(', ')}`;
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

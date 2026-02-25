import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { PromptSizeExceededBy } from './utils/prompt-size-helper';
import { closeUnavailableTabs, formatCountInThousands } from './utils/uncategorized-helpers';

export interface EditorToLlmModulePrivateHelpersDependencies {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export interface EditorToLlmCollectedFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

export interface ReadUrisAsFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export interface TabBasedFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

export type ExplorerCopySelectionSource = 'SELECTED' | 'CLICKED' | 'BOTH';

export function tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }

  const anyInput = tab.input as unknown as { uri?: vscode.Uri };
  if (anyInput?.uri instanceof vscode.Uri) {
    return anyInput.uri;
  }

  return null;
}

export function buildUriKey(uri: vscode.Uri): string {
  if (uri.scheme === 'file' && uri.fsPath) return uri.fsPath;

  return uri.toString();
}

export async function readUrisAsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  uris: vscode.Uri[]
): Promise<ReadUrisAsFileItemsResult> {
  const dedupedByPathMap = new Map<string, vscode.Uri>();

  for (const uri of uris) {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (!relativePath) continue;

    if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
  }

  const fileItems: EditorToLlmCollectedFileItem[] = [];
  const deletedFileUris: vscode.Uri[] = [];

  for (const [relativePath, uri] of dedupedByPathMap.entries()) {
    const readResult = await tryReadFileAsText(uri);

    if (readResult.isFileNotFound) {
      deletedFileUris.push(uri);
      continue;
    }

    fileItems.push({
      path: relativePath,
      content: readResult.text,
      languageId: readResult.languageId,
      readError: readResult.readError,
    });
  }

  return { fileItems, deletedFileUris };
}

export async function tryReadFileAsText(
  uri: vscode.Uri
): Promise<{ text: string | null; languageId?: string; readError?: string; isFileNotFound: boolean }> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);

    return { text: document.getText(), languageId: document.languageId, isFileNotFound: false };
  } catch (error) {
    const message = String(error);

    return { text: null, readError: message, isFileNotFound: isFileNotFoundError(error) };
  }
}

export function isFileNotFoundError(error: unknown): boolean {
  const anyError = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = String(anyError?.code ?? '');
  if (code === 'FileNotFound') return true;

  const message = String(anyError?.message ?? error ?? '');

  if (message.includes('FileNotFound')) return true;
  if (message.includes('ENOENT')) return true;
  if (message.includes('no such file or directory')) return true;

  const name = String(anyError?.name ?? '');
  if (name.includes('FileNotFound')) return true;

  return false;
}

export async function showCopyResultNotification(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    commandName: string;
    includeTechPrompt: boolean;
    copiedFilesCount: number;
    totalFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
    promptSizeStats?: {
      linesCount: number;
      approxTokensCount: number;
      maxLinesCountInContext: number;
      maxTokensCountInContext: number;
      isExceeded: boolean;
      exceededBy: PromptSizeExceededBy[];
    };
  }
): Promise<void> {
  const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

  const baseMessage =
    unavailableFilesCount === 0
      ? `Copied ${args.copiedFilesCount} file(s)`
      : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s)`;

  const shouldShowPromptSizeStats = await tryGetShouldShowPromptSizeStats(deps, args.promptSizeStats);
  const promptSizeStatsSuffix = shouldShowPromptSizeStats ? buildPromptSizeStatsSuffix(args.promptSizeStats ?? null) : '';

  const message = promptSizeStatsSuffix ? `${baseMessage} | ${promptSizeStatsSuffix}` : baseMessage;

  const closeUnavailableActionLabel =
    unavailableFilesCount > 0 ? `Close ${unavailableFilesCount} unavailable file(s) in Editor` : '';

  const shouldWarn = shouldShowPromptSizeStats ? Boolean(args.promptSizeStats?.isExceeded) : false;

  let selectedAction: string | undefined;

  if (closeUnavailableActionLabel)
    selectedAction = await vscode.window.showWarningMessage(message, closeUnavailableActionLabel);
  else if (shouldWarn) selectedAction = await vscode.window.showWarningMessage(message);
  else selectedAction = await vscode.window.showInformationMessage(message);

  if (selectedAction !== closeUnavailableActionLabel) return;

  await closeUnavailableTabs(deps, {
    deletedFileUris: args.deletedFileUris,
    unresolvedTabs: args.unresolvedTabs,
  });
}

async function tryGetShouldShowPromptSizeStats(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  promptSizeStats:
    | {
        linesCount: number;
        approxTokensCount: number;
        maxLinesCountInContext: number;
        maxTokensCountInContext: number;
        isExceeded: boolean;
        exceededBy: PromptSizeExceededBy[];
      }
    | undefined
): Promise<boolean> {
  if (!promptSizeStats) return false;

  try {
    const config = await deps.configService.getConfig();
    return config.showPromptSizeStatsInCopyNotification !== false;
  } catch (error) {
    deps.logger.debug(`Failed reading config for prompt size stats notification: ${String(error)}`);
    return true;
  }
}

function buildPromptSizeStatsSuffix(
  promptSizeStats: {
    linesCount: number;
    approxTokensCount: number;
    maxLinesCountInContext: number;
    maxTokensCountInContext: number;
    isExceeded: boolean;
    exceededBy: PromptSizeExceededBy[];
  } | null
): string {
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

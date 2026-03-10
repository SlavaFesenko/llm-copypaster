import * as vscode from 'vscode';

import { ConfigService } from '../../config-service';
import { CollectedFileItem } from '../../contracts/files-payload';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { ShowCopyResultNotificationArgs } from './copy-result-notificator';

export interface EditorToLlmModulePrivateHelpersDependencies {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export interface ReadUrisAsFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export interface TabBasedFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

export interface EditorToLlmPromptSizeStats {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: string[];
}

export { ShowCopyResultNotificationArgs };

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

export async function readUrisAsFileItems(uris: vscode.Uri[]): Promise<ReadUrisAsFileItemsResult> {
  const dedupedByPathMap = new Map<string, vscode.Uri>();

  for (const uri of uris) {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (!relativePath) continue;

    if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
  }

  const fileItems: CollectedFileItem[] = [];
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

async function tryReadFileAsText(
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

function isFileNotFoundError(error: unknown): boolean {
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

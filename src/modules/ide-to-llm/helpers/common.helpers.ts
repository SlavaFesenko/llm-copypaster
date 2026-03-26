import * as vscode from 'vscode';

import { LlmCopypasterConfig } from '../../../config/system-config-contracts';
import { CollectedFileItem } from '../../../contracts/files-payload';
import { BuildLlmContextTextArgs, IdeToLlmFile, ReadUrisAsFileItemsResult } from '../contracts';

export function getUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) return tab.input.uri;

  const anyInput = tab.input as { uri?: vscode.Uri };

  if (anyInput?.uri instanceof vscode.Uri) return anyInput.uri;

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

export function buildFinalPromptText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem, args.config)).join('\n');

  const techPromptDelimiter = args.config.nonOverrideableSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR;

  if (args.ignorePromptInstructions) return `\n${techPromptDelimiter}\n${listings}`;

  const instructionsText = args.instructionsText ?? '';

  if (!instructionsText.trim()) return listings;

  return `\n${techPromptDelimiter}\n${instructionsText}\n${techPromptDelimiter}\n${listings}`;
}

function buildSingleFileListing(fileItem: IdeToLlmFile, config: LlmCopypasterConfig): string {
  const headerLine = `${config.nonOverrideableSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR} ${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
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

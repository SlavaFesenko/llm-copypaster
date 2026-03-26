import * as path from 'path';
import * as vscode from 'vscode';
import { CollectedFileItem, ReadUrisAsFileItemsResult } from '../contracts/file-contracts';
import { OutputChannelLogger } from './output-channel-logger';
import { isInsideWorkspace, toDisplayPath } from './uri-tab-utils';

export async function readUrisAsFileItems(
  uris: vscode.Uri[],
  allowOutsideWorkspaceOps: boolean
): Promise<ReadUrisAsFileItemsResult> {
  const dedupedByPathMap = new Map<string, vscode.Uri>();
  const skippedOutsideWorkspaceUris: vscode.Uri[] = [];

  for (const uri of uris) {
    if (!allowOutsideWorkspaceOps && !isInsideWorkspace(uri)) {
      skippedOutsideWorkspaceUris.push(uri);
      continue;
    }

    const displayPath = toDisplayPath(uri, allowOutsideWorkspaceOps);
    if (!displayPath) continue;

    if (!dedupedByPathMap.has(displayPath)) dedupedByPathMap.set(displayPath, uri);
  }

  const fileItems: CollectedFileItem[] = [];
  const deletedFileUris: vscode.Uri[] = [];

  for (const [displayPath, uri] of dedupedByPathMap.entries()) {
    const readResult = await tryReadFileAsText(uri);

    if (readResult.isFileNotFound) {
      deletedFileUris.push(uri);
      continue;
    }

    fileItems.push({
      path: displayPath,
      content: readResult.text,
      languageId: readResult.languageId,
      readError: readResult.readError,
    });
  }

  return { fileItems, deletedFileUris, skippedOutsideWorkspaceUris };
}

export async function collectExplorerItemsFileItems(
  selectedUris: vscode.Uri[],
  logger: OutputChannelLogger,
  allowOutsideWorkspaceOps: boolean
): Promise<ReadUrisAsFileItemsResult> {
  const allFileUris: vscode.Uri[] = [];

  for (const selectedUri of selectedUris) {
    const stat = await getStat(selectedUri, logger);
    if (!stat) continue;

    if (stat.type & vscode.FileType.Directory) {
      const folderFileUris = await collectAllFilesInFolderRecursively(selectedUri, logger);

      for (const fileUri of folderFileUris) {
        allFileUris.push(fileUri);
      }

      continue;
    }

    if (stat.type & vscode.FileType.File) {
      allFileUris.push(selectedUri);
      continue;
    }
  }

  return await readUrisAsFileItems(allFileUris, allowOutsideWorkspaceOps);
}

export async function collectAllFilesInFolderRecursively(
  folderUri: vscode.Uri,
  logger: OutputChannelLogger
): Promise<vscode.Uri[]> {
  const collectedFileUris: vscode.Uri[] = [];

  const entries = await readDirectory(folderUri, logger);
  if (!entries) return collectedFileUris;

  for (const [entryName, entryType] of entries) {
    const entryUri = vscode.Uri.joinPath(folderUri, entryName);

    if (entryType & vscode.FileType.Directory) {
      const nestedFileUris = await collectAllFilesInFolderRecursively(entryUri, logger);

      for (const nestedFileUri of nestedFileUris) {
        collectedFileUris.push(nestedFileUri);
      }

      continue;
    }

    if (entryType & vscode.FileType.File) {
      collectedFileUris.push(entryUri);
      continue;
    }
  }

  return collectedFileUris;
}

export function isOutsideWorkspaceFilePath(filePath: string): boolean {
  if (!path.isAbsolute(filePath)) return false;

  return !isPathInsideWorkspaceRoot(filePath);
}

export function isPathInsideWorkspaceRoot(absoluteFilePath: string): boolean {
  const workspaceRootFsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;

  if (!workspaceRootFsPath) return false;

  const normalizedWorkspaceRootFsPath = normalizePathForCompare(workspaceRootFsPath);
  const normalizedAbsoluteFilePath = normalizePathForCompare(absoluteFilePath);

  if (normalizedAbsoluteFilePath === normalizedWorkspaceRootFsPath) return true;

  return normalizedAbsoluteFilePath.startsWith(normalizedWorkspaceRootFsPath + path.sep);
}

export function normalizePathForCompare(inputPath: string): string {
  const normalizedPath = path.resolve(inputPath);

  if (process.platform === 'win32') return normalizedPath.toLowerCase();

  return normalizedPath;
}

async function getStat(uri: vscode.Uri, logger: OutputChannelLogger): Promise<vscode.FileStat | null> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    logger.warn(`Explorer stat failed for ${uri.toString()}: ${String(error)}`);
    return null;
  }
}

async function readDirectory(uri: vscode.Uri, logger: OutputChannelLogger): Promise<[string, vscode.FileType][] | null> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch (error) {
    // to~do most likely it should be aggregated user-warning, but for now it's ok
    logger.warn(`Explorer readDirectory failed for ${uri.toString()}: ${String(error)}`);
    return null;
  }
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

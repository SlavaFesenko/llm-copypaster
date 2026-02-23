import * as vscode from 'vscode';

import { OutputChannelLogger } from '../utils/output-channel-logger';
import { toWorkspaceRelativePath } from '../utils/path-utils';

export interface EditorToLlmFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

export interface EditorToLlmSelection {
  fileItems: EditorToLlmFileItem[];
}

export async function collectActiveFileSelection(logger: OutputChannelLogger): Promise<EditorToLlmSelection | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return null;

  const fileItem = await readEditorDocumentAsFileItem(activeEditor.document, logger);

  return { fileItems: [fileItem] };
}

export async function collectAllOpenFilesSelection(logger: OutputChannelLogger): Promise<EditorToLlmSelection | null> {
  const visibleEditors = vscode.window.visibleTextEditors;
  const uniqueByPath = new Map<string, EditorToLlmFileItem>();

  for (const editor of visibleEditors) {
    const fileItem = await readEditorDocumentAsFileItem(editor.document, logger);
    if (!uniqueByPath.has(fileItem.path)) uniqueByPath.set(fileItem.path, fileItem);
  }

  const fileItems = [...uniqueByPath.values()];
  if (fileItems.length === 0) return null;

  return { fileItems };
}

export async function collectExplorerSelection(
  resourceUris: vscode.Uri[] | vscode.Uri | undefined,
  logger: OutputChannelLogger
): Promise<EditorToLlmSelection | null> {
  const urisArray = normalizeExplorerUris(resourceUris);
  if (urisArray.length === 0) return null;

  const uniqueByPath = new Map<string, EditorToLlmFileItem>();

  for (const uri of urisArray) {
    const stat = await safeStat(uri, logger);
    if (!stat) continue;

    if (stat.type & vscode.FileType.Directory) {
      const folderFileUris = await collectAllFilesInFolderRecursively(uri, logger);
      for (const fileUri of folderFileUris) {
        const fileItem = await readUriAsFileItem(fileUri, logger);
        if (!uniqueByPath.has(fileItem.path)) uniqueByPath.set(fileItem.path, fileItem);
      }

      continue;
    }

    if (stat.type & vscode.FileType.File) {
      const fileItem = await readUriAsFileItem(uri, logger);
      if (!uniqueByPath.has(fileItem.path)) uniqueByPath.set(fileItem.path, fileItem);
    }
  }

  const fileItems = [...uniqueByPath.values()];
  if (fileItems.length === 0) return null;

  return { fileItems };
}

async function readEditorDocumentAsFileItem(
  document: vscode.TextDocument,
  logger: OutputChannelLogger
): Promise<EditorToLlmFileItem> {
  const relativePath = toWorkspaceRelativePath(document.uri);

  if (!relativePath) {
    return {
      path: document.uri.fsPath,
      content: document.getText(),
      languageId: document.languageId,
    };
  }

  return {
    path: relativePath,
    content: document.getText(),
    languageId: document.languageId,
  };
}

async function readUriAsFileItem(uri: vscode.Uri, logger: OutputChannelLogger): Promise<EditorToLlmFileItem> {
  const relativePath = toWorkspaceRelativePath(uri) ?? uri.fsPath;

  try {
    const document = await vscode.workspace.openTextDocument(uri);

    return { path: relativePath, content: document.getText(), languageId: document.languageId };
  } catch (error) {
    const readError = String(error);

    logger.warn(`Failed reading file ${relativePath}: ${readError}`);

    return {
      path: relativePath,
      content: null,
      readError,
    };
  }
}

function normalizeExplorerUris(resourceUris: vscode.Uri[] | vscode.Uri | undefined): vscode.Uri[] {
  if (!resourceUris) return [];

  if (Array.isArray(resourceUris)) return resourceUris;

  return [resourceUris];
}

async function safeStat(uri: vscode.Uri, logger: OutputChannelLogger): Promise<vscode.FileStat | null> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    logger.warn(`Failed stat for ${uri.fsPath}: ${String(error)}`);
    return null;
  }
}

async function safeReadDirectory(uri: vscode.Uri, logger: OutputChannelLogger): Promise<[string, vscode.FileType][] | null> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch (error) {
    logger.warn(`Failed readDirectory for ${uri.fsPath}: ${String(error)}`);
    return null;
  }
}

async function collectAllFilesInFolderRecursively(
  folderUri: vscode.Uri,
  logger: OutputChannelLogger
): Promise<vscode.Uri[]> {
  const collectedFileUris: vscode.Uri[] = [];

  const entries = await safeReadDirectory(folderUri, logger);
  if (!entries) return collectedFileUris;

  for (const [entryName, entryType] of entries) {
    const entryUri = vscode.Uri.joinPath(folderUri, entryName);

    if (entryType & vscode.FileType.Directory) {
      const nestedFileUris = await collectAllFilesInFolderRecursively(entryUri, logger);
      for (const nestedFileUri of nestedFileUris) collectedFileUris.push(nestedFileUri);

      continue;
    }

    if (entryType & vscode.FileType.File) {
      collectedFileUris.push(entryUri);
      continue;
    }
  }

  return collectedFileUris;
}

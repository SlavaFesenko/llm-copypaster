import * as vscode from 'vscode';

import { OutputChannelLogger } from '../utils/output-channel-logger';
import { toWorkspaceRelativePath } from '../utils/path-utils';

export interface EditorToLlmFileItem {
  path: string;
  content: string;
  languageId?: string;
  readError?: string;
}

export interface EditorToLlmSelection {
  fileItems: EditorToLlmFileItem[];
}

export async function collectActiveFileSelection(logger: OutputChannelLogger): Promise<EditorToLlmSelection | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return null;
  }

  const fileItem = await readEditorDocumentAsFileItem(activeEditor.document, logger);

  return { fileItems: [fileItem] };
}

export async function collectAllOpenFilesSelection(logger: OutputChannelLogger): Promise<EditorToLlmSelection | null> {
  const visibleEditors = vscode.window.visibleTextEditors;
  const uniqueByPath = new Map<string, EditorToLlmFileItem>();

  for (const editor of visibleEditors) {
    const fileItem = await readEditorDocumentAsFileItem(editor.document, logger);
    if (!uniqueByPath.has(fileItem.path)) {
      uniqueByPath.set(fileItem.path, fileItem);
    }
  }

  const fileItems = [...uniqueByPath.values()];
  if (fileItems.length === 0) {
    return null;
  }

  return { fileItems };
}

export async function collectExplorerSelection(
  resourceUris: vscode.Uri[] | vscode.Uri | undefined,
  logger: OutputChannelLogger
): Promise<EditorToLlmSelection | null> {
  const urisArray = normalizeExplorerUris(resourceUris);

  if (urisArray.length === 0) {
    return null;
  }

  const fileItems: EditorToLlmFileItem[] = [];

  for (const uri of urisArray) {
    const stat = await safeStat(uri, logger);
    if (!stat) {
      continue;
    }

    if (stat.type === vscode.FileType.Directory) {
      continue;
    }

    const fileItem = await readUriAsFileItem(uri, logger);
    fileItems.push(fileItem);
  }

  if (fileItems.length === 0) {
    return null;
  }

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
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString('utf8');

    return { path: relativePath, content };
  } catch (error) {
    const readError = String(error);

    logger.warn(`Failed reading file ${relativePath}: ${readError}`);

    return {
      path: relativePath,
      content: '',
      readError,
    };
  }
}

function normalizeExplorerUris(resourceUris: vscode.Uri[] | vscode.Uri | undefined): vscode.Uri[] {
  if (!resourceUris) {
    return [];
  }

  if (Array.isArray(resourceUris)) {
    return resourceUris;
  }

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

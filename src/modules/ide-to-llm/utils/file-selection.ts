import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';
import { toWorkspaceRelativePath } from '../../../utils/path-utils';

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

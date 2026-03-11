import * as vscode from 'vscode';
import { toWorkspaceRelativePath } from '../../../utils/path-utils';

export interface EditorToLlmFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

export async function collectActiveFileSelection(): Promise<EditorToLlmFileItem | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    await vscode.window.showWarningMessage('No active file to copy');
    return null;
  }

  const fileItem = await readEditorDocumentAsFileItem(activeEditor.document);
  if (fileItem?.content === null) {
    await vscode.window.showWarningMessage('No active file to copy');
    return null;
  }

  return fileItem;
}

async function readEditorDocumentAsFileItem(document: vscode.TextDocument): Promise<EditorToLlmFileItem> {
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

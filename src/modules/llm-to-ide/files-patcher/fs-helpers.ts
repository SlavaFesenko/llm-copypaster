import * as vscode from 'vscode';

export async function ensureParentDirectoryExists(targetFileUri: vscode.Uri): Promise<void> {
  const parentUri = vscode.Uri.joinPath(targetFileUri, '..');

  try {
    await vscode.workspace.fs.createDirectory(parentUri);
  } catch {
    // ignore
  }
}

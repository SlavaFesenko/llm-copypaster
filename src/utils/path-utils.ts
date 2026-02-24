import * as vscode from 'vscode';

export function toWorkspaceRelativePath(uri: vscode.Uri): string | null {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) return null;

  const relativePath = vscode.workspace.asRelativePath(uri, false);
  return relativePath;
}

export function toWorkspaceUri(relativePath: string): vscode.Uri | null {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return null;

  return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
}

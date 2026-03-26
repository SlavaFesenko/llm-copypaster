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

export function uniqueByUriKeyKeepOrder(uris: vscode.Uri[]): vscode.Uri[] {
  const uniqueUris: vscode.Uri[] = [];
  const uniqueKeys = new Set<string>();

  for (const uri of uris) {
    const key = buildUriKey(uri);
    if (uniqueKeys.has(key)) continue;

    uniqueKeys.add(key);
    uniqueUris.push(uri);
  }

  return uniqueUris;
}

export function isInsideWorkspace(uri: vscode.Uri): boolean {
  return toWorkspaceRelativePath(uri) !== null;
}

export function toDisplayPath(uri: vscode.Uri, allowOutsideWorkspaceOps: boolean): string {
  const workspaceRelativePath = toWorkspaceRelativePath(uri);

  if (!allowOutsideWorkspaceOps && workspaceRelativePath) return workspaceRelativePath;
  if (allowOutsideWorkspaceOps && uri.scheme === 'file' && uri.fsPath) return uri.fsPath;
  if (workspaceRelativePath) return workspaceRelativePath;
  if (uri.scheme === 'file' && uri.fsPath) return uri.fsPath;

  return uri.toString();
}

export function buildSkippedOutsideWorkspaceWarningMessage(skippedOutsideWorkspaceUris: vscode.Uri[]): string {
  const skippedPaths = skippedOutsideWorkspaceUris.map(skippedOutsideWorkspaceUri =>
    toDisplayPath(skippedOutsideWorkspaceUri, true)
  );

  return `Skipped ${skippedOutsideWorkspaceUris.length} file(s) outside workspace: ${skippedPaths.join(', ')}`;
}

import * as vscode from 'vscode';

export async function clearExtensionCache(extensionContext: vscode.ExtensionContext): Promise<void> {
  await Promise.all([
    ...extensionContext.workspaceState
      .keys()
      .map(workspaceStateKey => extensionContext.workspaceState.update(workspaceStateKey, undefined)),
    ...extensionContext.globalState
      .keys()
      .map(globalStateKey => extensionContext.globalState.update(globalStateKey, undefined)),
  ]);
}

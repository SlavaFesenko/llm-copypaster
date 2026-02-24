import * as vscode from 'vscode';

import type { EditorToLlmModulePrivateHelpersDependencies } from '../common.helpers';

export async function closeUnavailableTabs(
  deps: Pick<EditorToLlmModulePrivateHelpersDependencies, 'logger'>,
  args: { deletedFileUris: vscode.Uri[]; unresolvedTabs: vscode.Tab[] }
): Promise<void> {
  const tabsToClose: vscode.Tab[] = [];

  for (const unresolvedTab of args.unresolvedTabs) tabsToClose.push(unresolvedTab);

  if (args.deletedFileUris.length > 0) {
    const deletedUriStrings = new Set<string>(args.deletedFileUris.map(uri => uri.toString()));

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const tabUri = tryGetUriFromTab(tab);
        if (!tabUri) continue;

        if (deletedUriStrings.has(tabUri.toString())) tabsToClose.push(tab);
      }
    }
  }

  if (tabsToClose.length === 0) return;

  try {
    await vscode.window.tabGroups.close(tabsToClose);
  } catch (error) {
    deps.logger.warn(`Failed closing unavailable tabs: ${String(error)}`);
  }
}

function tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) return tab.input.uri;

  const anyInput = tab.input as unknown as { uri?: vscode.Uri };
  if (anyInput?.uri instanceof vscode.Uri) return anyInput.uri;

  return null;
}

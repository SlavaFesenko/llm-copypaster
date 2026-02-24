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

export function formatCountInThousands(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (Math.abs(safeValue) < 1000) return String(Math.trunc(safeValue));

  const roundedK = Math.round((safeValue / 1000) * 10) / 10;
  const text = roundedK % 1 === 0 ? roundedK.toFixed(0) : roundedK.toFixed(1);

  return `${text}K`;
}

function tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) return tab.input.uri;

  const anyInput = tab.input as unknown as { uri?: vscode.Uri };
  if (anyInput?.uri instanceof vscode.Uri) return anyInput.uri;

  return null;
}

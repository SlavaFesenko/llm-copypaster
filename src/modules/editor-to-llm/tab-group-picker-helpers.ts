import * as vscode from 'vscode';
import { tryGetUriFromTab } from './common.helpers';

export interface TabGroupPickItem extends vscode.QuickPickItem {
  tabGroup: vscode.TabGroup;
}

export function findTabGroupsContainingUri(args: {
  uri: vscode.Uri;
  tabGroups: readonly vscode.TabGroup[];
}): vscode.TabGroup[] {
  const uriString = args.uri.toString();

  const matchingTabGroups: vscode.TabGroup[] = [];

  for (const tabGroup of args.tabGroups) {
    for (const tab of tabGroup.tabs) {
      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) continue;

      if (tabUri.toString() !== uriString) continue;

      matchingTabGroups.push(tabGroup);
      break;
    }
  }

  return matchingTabGroups;
}

export function buildTabGroupQuickPickItems(args: {
  tabGroups: vscode.TabGroup[];
  allTabGroups: readonly vscode.TabGroup[];
}): TabGroupPickItem[] {
  const quickPickItems: TabGroupPickItem[] = [];

  for (let index = 0; index < args.tabGroups.length; index++) {
    const tabGroup = args.tabGroups[index];

    const tabGroupIndexInAllGroups = args.allTabGroups.indexOf(tabGroup);
    const tabGroupLabel = tabGroupIndexInAllGroups >= 0 ? `Tab Group ${tabGroupIndexInAllGroups + 1}` : 'Tab Group';

    const tabGroupFilesSummary = buildTabGroupFilesSummary(tabGroup);

    quickPickItems.push({
      label: tabGroupLabel,
      description: tabGroupFilesSummary,
      tabGroup,
    });
  }

  return quickPickItems;
}

function buildTabGroupFilesSummary(tabGroup: vscode.TabGroup): string {
  const fileNames: string[] = [];

  for (const tab of tabGroup.tabs) {
    const tabLabel = tryGetTabLabel(tab);
    if (!tabLabel) continue;

    fileNames.push(tabLabel);
  }

  const uniqueFileNames: string[] = [];

  for (const fileName of fileNames) {
    if (uniqueFileNames.includes(fileName)) continue;

    uniqueFileNames.push(fileName);
  }

  const previewFileNamesCount = 2;

  const previewFileNames = uniqueFileNames.slice(0, previewFileNamesCount);
  const remainingFilesCount = uniqueFileNames.length - previewFileNames.length;

  const previewText = previewFileNames.join(', ');

  if (!previewText && uniqueFileNames.length > 0) return `${uniqueFileNames.length} file(s)`;
  if (!previewText) return 'No file tabs';

  if (remainingFilesCount <= 0) return previewText;

  return `${previewText} and ${remainingFilesCount} more`;
}

function tryGetTabLabel(tab: vscode.Tab): string | null {
  const tabUri = tryGetUriFromTab(tab);
  if (tabUri && tabUri.scheme === 'file') return getFileNameFromUri(tabUri);

  const anyTab = tab as unknown as { label?: unknown } | null;
  const label = String(anyTab?.label ?? '').trim();

  return label ? label : null;
}

function getFileNameFromUri(uri: vscode.Uri): string {
  const uriPath = uri.path ?? '';
  const parts = uriPath.split('/').filter(part => part.trim());

  if (parts.length > 0) return parts[parts.length - 1];

  return (
    uri.fsPath
      .split(/[/\\]/)
      .filter(part => part.trim())
      .pop() ?? uri.toString()
  );
}

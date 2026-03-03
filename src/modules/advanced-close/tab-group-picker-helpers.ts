import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { tryGetUriFromTab } from '../ide-to-llm/common.helpers';

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

export function tryFindTabGroupContainingTab(args: {
  tab: vscode.Tab;
  tabGroups: readonly vscode.TabGroup[];
}): vscode.TabGroup | null {
  for (const tabGroup of args.tabGroups) {
    if (tabGroup.tabs.includes(args.tab)) return tabGroup;
  }

  return null;
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

export async function pickTabGroupForOpenSelectedFiles(): Promise<vscode.TabGroup | null> {
  const allTabGroups = vscode.window.tabGroups.all;
  if (allTabGroups.length === 0) return null;

  if (allTabGroups.length === 1) return allTabGroups[0];

  const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: [...allTabGroups], allTabGroups });

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select tab group to open selected files in',
    canPickMany: false,
  });

  return selectedItem?.tabGroup ?? null;
}

export async function pickTabGroupForTabGroupAction(args: {
  clickedContext?: unknown;
  logger: OutputChannelLogger;
}): Promise<vscode.TabGroup | null> {
  const allTabGroups = vscode.window.tabGroups.all;

  const clickedTabGroup = tryGetTabGroupFromClickedContext(args.clickedContext, allTabGroups);
  if (clickedTabGroup) return clickedTabGroup;

  const clickedFileUri = tryGetFileUriFromClickedContext(args.clickedContext);
  if (clickedFileUri && clickedFileUri.scheme === 'file') {
    const matchingTabGroups = findTabGroupsContainingUri({ uri: clickedFileUri, tabGroups: allTabGroups });

    if (matchingTabGroups.length === 1) return matchingTabGroups[0];

    if (matchingTabGroups.length > 1)
      return await pickFromMultipleMatchingTabGroups({
        matchingTabGroups,
        allTabGroups,
        placeHolder:
          "Select tab group to act on, since this file is open in multiple tab groups and VS Code API can't tell which group was clicked",
      });
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return vscode.window.tabGroups.activeTabGroup;

  const activeDocumentUri = activeEditor.document.uri;
  if (activeDocumentUri.scheme !== 'file') return vscode.window.tabGroups.activeTabGroup;

  const matchingTabGroups = findTabGroupsContainingUri({ uri: activeDocumentUri, tabGroups: allTabGroups });

  if (matchingTabGroups.length === 0) return vscode.window.tabGroups.activeTabGroup;

  if (matchingTabGroups.length === 1) return matchingTabGroups[0];

  return await pickFromMultipleMatchingTabGroups({
    matchingTabGroups,
    allTabGroups,
    placeHolder:
      "Select tab group to act on, since this file is open in multiple tab groups and VS Code API can't tell which group was clicked",
  });
}

export function tryGetTabGroupFromClickedContext(
  clickedContext: unknown,
  allTabGroups: readonly vscode.TabGroup[]
): vscode.TabGroup | null {
  const anyTab = clickedContext as vscode.Tab | null;

  if (!anyTab || typeof anyTab !== 'object') return null;

  const hasTabLikeShape = 'input' in anyTab;
  if (!hasTabLikeShape) return null;

  return tryFindTabGroupContainingTab({ tab: anyTab, tabGroups: allTabGroups });
}

export function tryGetFileUriFromClickedContext(clickedContext: unknown): vscode.Uri | null {
  if (clickedContext instanceof vscode.Uri) return clickedContext;

  const anyTab = clickedContext as vscode.Tab | null;

  if (anyTab && typeof anyTab === 'object' && 'input' in anyTab) return tryGetUriFromTab(anyTab);

  return null;
}

export async function pickFromMultipleMatchingTabGroups(args: {
  matchingTabGroups: vscode.TabGroup[];
  allTabGroups: readonly vscode.TabGroup[];
  placeHolder: string;
}): Promise<vscode.TabGroup | null> {
  const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: args.matchingTabGroups, allTabGroups: args.allTabGroups });

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: args.placeHolder,
    canPickMany: false,
  });

  return selectedItem?.tabGroup ?? null;
}

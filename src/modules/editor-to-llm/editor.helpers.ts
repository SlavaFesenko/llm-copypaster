import * as vscode from 'vscode';

import { EditorToLlmModulePrivateHelpersDependencies, TabBasedFileItemsResult, tryGetUriFromTab } from './common.helpers';
import { readUrisAsFileItems } from './explorer.helpers';
import { buildTabGroupQuickPickItems, findTabGroupsContainingUri } from './tab-group-picker-helpers';

export async function showCopyResultNotification(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    commandName: string;
    includeTechPrompt: boolean;
    copiedFilesCount: number;
    totalFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
    selectionSourceLabel?: string;
  }
): Promise<void> {
  const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;
  const techPromptMarker = args.includeTechPrompt ? 'With Tech Prompt' : 'Without Tech Prompt';
  const commandDisplayName = `${args.commandName} ${techPromptMarker}`;

  const messagePrefix = args.selectionSourceLabel ? `Copied ${args.selectionSourceLabel} ` : 'Copied ';

  const message =
    unavailableFilesCount === 0
      ? `${messagePrefix}${args.copiedFilesCount} file(s) by '${commandDisplayName}'`
      : `${messagePrefix}${args.copiedFilesCount}/${args.totalFilesCount} available file(s) by '${commandDisplayName}'`;

  const closeUnavailableActionLabel =
    unavailableFilesCount > 0 ? `Close ${unavailableFilesCount} unavailable file(s) in Editor` : '';

  const selectedAction = closeUnavailableActionLabel
    ? await vscode.window.showInformationMessage(message, closeUnavailableActionLabel)
    : await vscode.window.showInformationMessage(message);

  if (selectedAction !== closeUnavailableActionLabel) return;

  await closeUnavailableTabs(deps, {
    deletedFileUris: args.deletedFileUris,
    unresolvedTabs: args.unresolvedTabs,
  });
}

export async function closeUnavailableTabs(
  deps: EditorToLlmModulePrivateHelpersDependencies,
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

export async function collectActiveTabGroupFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabGroup = await pickTabGroupForTabGroupCopyCommand(deps);
  if (!tabGroup) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tab of tabGroup.tabs) {
    const tabUri = tryGetUriFromTab(tab);
    if (!tabUri) {
      unresolvedTabs.push(tab);
      continue;
    }

    if (tabUri.scheme !== 'file') continue;

    tabUris.push(tabUri);
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectAllOpenTabsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectAllPinnedTabsFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (!tab.isPinned) continue;

      const tabUri = tryGetUriFromTab(tab);
      if (!tabUri) {
        unresolvedTabs.push(tab);
        continue;
      }

      if (tabUri.scheme !== 'file') continue;

      tabUris.push(tabUri);
    }
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function collectPinnedTabsInActiveTabGroupFileItems(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<TabBasedFileItemsResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabGroup = await pickTabGroupForTabGroupCopyCommand(deps);
  if (!tabGroup) {
    return { fileItems: [], deletedFileUris: [], unresolvedTabs: [] };
  }

  const tabUris: vscode.Uri[] = [];
  const unresolvedTabs: vscode.Tab[] = [];

  for (const tab of tabGroup.tabs) {
    if (!tab.isPinned) continue;

    const tabUri = tryGetUriFromTab(tab);
    if (!tabUri) {
      unresolvedTabs.push(tab);
      continue;
    }

    if (tabUri.scheme !== 'file') continue;

    tabUris.push(tabUri);
  }

  const readResult = await readUrisAsFileItems(deps, tabUris);

  return { ...readResult, unresolvedTabs };
}

export async function pickTabGroupForTabGroupCopyCommand(
  deps: EditorToLlmModulePrivateHelpersDependencies
): Promise<vscode.TabGroup | null> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return vscode.window.tabGroups.activeTabGroup;

  const activeDocumentUri = activeEditor.document.uri;
  if (activeDocumentUri.scheme !== 'file') return vscode.window.tabGroups.activeTabGroup;

  const allTabGroups = vscode.window.tabGroups.all;

  const matchingTabGroups = findTabGroupsContainingUri({ uri: activeDocumentUri, tabGroups: allTabGroups });

  if (matchingTabGroups.length === 0) return vscode.window.tabGroups.activeTabGroup;

  if (matchingTabGroups.length === 1) return matchingTabGroups[0];

  const quickPickItems = buildTabGroupQuickPickItems({ tabGroups: matchingTabGroups, allTabGroups });

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder:
      "Select tab group to copy, since this file is open in multiple tab groups and VS Code API can't tell which group was clicked",
    canPickMany: false,
  });

  return selectedItem?.tabGroup ?? null;
}

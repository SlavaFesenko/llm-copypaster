import * as vscode from 'vscode';

import {
  EditorToLlmModulePrivateHelpersDependencies,
  readUrisAsFileItems,
  showCopyResultNotification,
  TabBasedFileItemsResult,
  tryGetUriFromTab,
  wrapContentWithCodeFence,
} from './common.helpers';
import { buildTabGroupQuickPickItems, findTabGroupsContainingUri } from './tab-group-picker-helpers';
import { loadDefaultCopyAsContextPrompt } from './utils/default-copy-as-context-prompt-loader';
import { collectActiveFileSelection } from './utils/file-selection';
import { buildLlmContextText } from './utils/llm-context-formatter';

export async function copyThisActiveFileAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  includeTechPrompt: boolean = true
): Promise<void> {
  const selection = await collectActiveFileSelection(deps.logger);
  if (!selection) {
    await vscode.window.showWarningMessage('No active file to copy');
    return;
  }

  const nonDeletedFileItems = selection.fileItems.filter(fileItem => fileItem.content !== null);

  const totalFilesCount = selection.fileItems.length;
  const copiedFilesCount = nonDeletedFileItems.length;

  if (copiedFilesCount === 0) {
    await vscode.window.showWarningMessage('No active file to copy');
    return;
  }

  await copyFileItemsSelectionAsContext(deps, {
    selectionFileItems: nonDeletedFileItems,
    includeTechPrompt,
    warningWhenEmpty: 'No active file to copy',
    commandName: 'Copy File',
    totalFilesCount,
    copiedFilesCount,
    deletedFileUris: [],
    unresolvedTabs: [],
  });
}

export async function copyThisTabGroupAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  includeTechPrompt: boolean = true
): Promise<void> {
  const selection = await collectActiveTabGroupFileItems(deps);

  const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

  if (totalFilesCount === 0) {
    await vscode.window.showWarningMessage('No tab group files to copy!');
    return;
  }

  await copyTabBasedSelectionAsContext(deps, {
    selection,
    includeTechPrompt,
    warningWhenEmpty: 'No tab group files to copy!',
    commandName: 'Copy Tab Group',
    totalFilesCount,
  });
}

export async function copyAllOpenTabsAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  includeTechPrompt: boolean = true
): Promise<void> {
  const selection = await collectAllOpenTabsFileItems(deps);

  const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

  if (totalFilesCount === 0) {
    await vscode.window.showWarningMessage('No open files to copy');
    return;
  }

  await copyTabBasedSelectionAsContext(deps, {
    selection,
    includeTechPrompt,
    warningWhenEmpty: 'No open files to copy',
    commandName: 'Copy All',
    totalFilesCount,
  });
}

export async function copyAllPinnedTabsAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  includeTechPrompt: boolean = true
): Promise<void> {
  const selection = await collectAllPinnedTabsFileItems(deps);

  const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

  if (totalFilesCount === 0) {
    await vscode.window.showWarningMessage('No pinned files to copy');
    return;
  }

  await copyTabBasedSelectionAsContext(deps, {
    selection,
    includeTechPrompt,
    warningWhenEmpty: 'No pinned files to copy',
    commandName: 'Copy All Pinned',
    totalFilesCount,
  });
}

export async function copyPinnedTabsInActiveTabGroupAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  includeTechPrompt: boolean = true
): Promise<void> {
  const selection = await collectPinnedTabsInActiveTabGroupFileItems(deps);

  const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

  if (totalFilesCount === 0) {
    await vscode.window.showWarningMessage('No pinned tab group files to copy');
    return;
  }

  await copyTabBasedSelectionAsContext(deps, {
    selection,
    includeTechPrompt,
    warningWhenEmpty: 'No pinned tab group files to copy',
    commandName: 'Copy Pinned Tab Group',
    totalFilesCount,
  });
}

async function collectActiveTabGroupFileItems(
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

async function collectAllOpenTabsFileItems(
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

async function collectAllPinnedTabsFileItems(
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

async function collectPinnedTabsInActiveTabGroupFileItems(
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

async function pickTabGroupForTabGroupCopyCommand(
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

async function copyTabBasedSelectionAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    selection: TabBasedFileItemsResult;
    includeTechPrompt: boolean;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
  }
): Promise<void> {
  if (args.selection.fileItems.length > 0) {
    await copyFileItemsSelectionAsContext(deps, {
      selectionFileItems: args.selection.fileItems,
      includeTechPrompt: args.includeTechPrompt,
      warningWhenEmpty: args.warningWhenEmpty,
      commandName: args.commandName,
      totalFilesCount: args.totalFilesCount,
      copiedFilesCount: args.selection.fileItems.length,
      deletedFileUris: args.selection.deletedFileUris,
      unresolvedTabs: args.selection.unresolvedTabs,
    });

    return;
  }

  await vscode.window.showWarningMessage(args.warningWhenEmpty);
}

async function copyFileItemsSelectionAsContext(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: {
    selectionFileItems: Array<{ path: string; content: string | null; languageId?: string; readError?: string }>;
    includeTechPrompt: boolean;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
    copiedFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
  }
): Promise<void> {
  if (args.selectionFileItems.length === 0) {
    await vscode.window.showWarningMessage(args.warningWhenEmpty);
    return;
  }

  const config = await deps.configService.getConfig();
  const techPromptText = args.includeTechPrompt ? await loadDefaultCopyAsContextPrompt(deps.extensionContext) : '';

  const fileItems = config.EnableCodefenceWrappingOnCopying
    ? args.selectionFileItems.map(fileItem => ({
        ...fileItem,
        content: wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
      }))
    : args.selectionFileItems;

  const contextText = buildLlmContextText({
    fileItems,
    includeTechPrompt: args.includeTechPrompt,
    config,
    techPromptText,
  });

  await vscode.env.clipboard.writeText(contextText);

  await showCopyResultNotification(deps, {
    commandName: args.commandName,
    includeTechPrompt: args.includeTechPrompt,
    copiedFilesCount: args.copiedFilesCount,
    totalFilesCount: args.totalFilesCount,
    deletedFileUris: args.deletedFileUris,
    unresolvedTabs: args.unresolvedTabs,
  });
}

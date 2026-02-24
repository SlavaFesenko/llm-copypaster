import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { loadDefaultCopyAsContextPrompt } from './default-copy-as-context-prompt-loader';
import { EditorToLlmModulePrivateHelpers } from './editor-to-llm-module-private-helpers';
import { collectActiveFileSelection } from './file-selection';
import { buildLlmContextText } from './llm-context-formatter';

interface EditorToLlmCollectedFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

interface ReadUrisAsFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

interface TabBasedFileItemsResult {
  fileItems: EditorToLlmCollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

type ExplorerCopySelectionSource = 'SELECTED' | 'CLICKED' | 'BOTH';

export interface CopySelectedExplorerItemsArgs {
  clickedUri?: vscode.Uri;
  selectedUris?: vscode.Uri[];
}

export class EditorToLlmModule {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {
    this._privateHelpers = new EditorToLlmModulePrivateHelpers({
      extensionContext: this._extensionContext,
      configService: this._configService,
      logger: this._logger,
    });
  }

  public async copyThisFileAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await collectActiveFileSelection(this._logger);
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

    const config = await this._configService.getConfig();
    const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

    const fileItems = config.EnableCodefenceWrappingOnCopying
      ? nonDeletedFileItems.map(fileItem => ({
          ...fileItem,
          content: this._privateHelpers.wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
        }))
      : nonDeletedFileItems;

    const contextText = buildLlmContextText({
      fileItems,
      includeTechPrompt,
      config,
      techPromptText,
    });

    await vscode.env.clipboard.writeText(contextText);

    await this._privateHelpers.showCopyResultNotification({
      commandName: 'Copy File',
      includeTechPrompt,
      copiedFilesCount,
      totalFilesCount,
      deletedFileUris: [],
      unresolvedTabs: [],
    });
  }

  public async copyThisTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._privateHelpers.collectActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No tab group files to copy!');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const fileItems = config.EnableCodefenceWrappingOnCopying
        ? selection.fileItems.map(fileItem => ({
            ...fileItem,
            content: this._privateHelpers.wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
          }))
        : selection.fileItems;

      const contextText = buildLlmContextText({
        fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No tab group files to copy!');
      return;
    }

    await this._privateHelpers.showCopyResultNotification({
      commandName: 'Copy Tab Group',
      includeTechPrompt,
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copyAllOpenFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._privateHelpers.collectAllOpenTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const fileItems = config.EnableCodefenceWrappingOnCopying
        ? selection.fileItems.map(fileItem => ({
            ...fileItem,
            content: this._privateHelpers.wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
          }))
        : selection.fileItems;

      const contextText = buildLlmContextText({
        fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    await this._privateHelpers.showCopyResultNotification({
      commandName: 'Copy All',
      includeTechPrompt,
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copyAllPinnedFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._privateHelpers.collectAllPinnedTabsFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const fileItems = config.EnableCodefenceWrappingOnCopying
        ? selection.fileItems.map(fileItem => ({
            ...fileItem,
            content: this._privateHelpers.wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
          }))
        : selection.fileItems;

      const contextText = buildLlmContextText({
        fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    await this._privateHelpers.showCopyResultNotification({
      commandName: 'Copy All Pinned',
      includeTechPrompt,
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    const selection = await this._privateHelpers.collectPinnedTabsInActiveTabGroupFileItems();

    const totalFilesCount = selection.fileItems.length + selection.deletedFileUris.length + selection.unresolvedTabs.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned tab group files to copy');
      return;
    }

    if (selection.fileItems.length > 0) {
      const config = await this._configService.getConfig();
      const techPromptText = includeTechPrompt ? await loadDefaultCopyAsContextPrompt(this._extensionContext) : '';

      const fileItems = config.EnableCodefenceWrappingOnCopying
        ? selection.fileItems.map(fileItem => ({
            ...fileItem,
            content: this._privateHelpers.wrapContentWithCodeFence(fileItem.content ?? '', fileItem.languageId ?? ''),
          }))
        : selection.fileItems;

      const contextText = buildLlmContextText({
        fileItems,
        includeTechPrompt,
        config,
        techPromptText,
      });

      await vscode.env.clipboard.writeText(contextText);
    } else {
      await vscode.window.showWarningMessage('No pinned tab group files to copy');
      return;
    }

    await this._privateHelpers.showCopyResultNotification({
      commandName: 'Copy Pinned Tab Group',
      includeTechPrompt,
      copiedFilesCount: selection.fileItems.length,
      totalFilesCount,
      deletedFileUris: selection.deletedFileUris,
      unresolvedTabs: selection.unresolvedTabs,
    });
  }

  public async copySelectedExplorerItemsAsContext(
    args?: CopySelectedExplorerItemsArgs,
    includeTechPrompt: boolean = true
  ): Promise<void> {
    const clickedUri = args?.clickedUri;
    const selectedUrisCopy = [...(args?.selectedUris ?? [])];

    const normalizedSelectedUris = this._privateHelpers.uniqueByUriKeyKeepOrder(selectedUrisCopy);
    const clickedUriKey = clickedUri ? this._privateHelpers.buildUriKey(clickedUri) : null;

    if (normalizedSelectedUris.length === 0 && clickedUri) {
      await this._privateHelpers.copyExplorerUrisAsContext({
        inputUris: [clickedUri],
        selectionSource: 'CLICKED',
        includeTechPrompt,
      });

      return;
    }

    if (normalizedSelectedUris.length > 0 && !clickedUri) {
      await this._privateHelpers.copyExplorerUrisAsContext({
        inputUris: normalizedSelectedUris,
        selectionSource: 'SELECTED',
        includeTechPrompt,
      });

      return;
    }

    if (normalizedSelectedUris.length > 0 && clickedUri) {
      const selectedUriKeys = new Set<string>(normalizedSelectedUris.map(uri => this._privateHelpers.buildUriKey(uri)));
      const isClickedInSelected = clickedUriKey ? selectedUriKeys.has(clickedUriKey) : false;

      if (isClickedInSelected) {
        await this._privateHelpers.copyExplorerUrisAsContext({
          inputUris: normalizedSelectedUris,
          selectionSource: 'SELECTED',
          includeTechPrompt,
        });

        return;
      }

      const quickPickItems = this._privateHelpers.buildExplorerSelectionSourceQuickPickItems({
        selectedUris: normalizedSelectedUris,
        clickedUri,
      });

      const pickedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Choose what to copy from Explorer',
        canPickMany: false,
      });

      if (!pickedItem) return;

      await this._privateHelpers.copyExplorerUrisAsContext({
        inputUris: pickedItem.uris,
        selectionSource: pickedItem.selectionSource,
        includeTechPrompt,
      });

      return;
    }

    await vscode.window.showWarningMessage('No explorer selection to copy');
  }

  private readonly _privateHelpers: EditorToLlmModulePrivateHelpers;
}

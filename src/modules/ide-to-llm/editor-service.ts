import * as vscode from 'vscode';

import { TabBasedFileItemsResult } from '../../contracts/file-contracts';
import { TabsCollector, TabsCollectorBuildOption } from '../../utils/tabs-collector';
import { buildSkippedOutsideWorkspaceWarningMessage } from '../../utils/uri-tab-utils';
import { InstructionsBuilder } from '../common/instructions-builder/instructions-builder';
import { IdeToLlmDeps } from './contracts';
import { buildFinalPromptText } from './helpers/common.helpers';
import { CopiedNotificator } from './helpers/copied-notificator';
import { buildTextSizeStats } from './helpers/text-size-helper';

export class EditorService {
  public constructor(
    private readonly _deps: IdeToLlmDeps,
    private readonly _allowOutsideWorkspaceRead: boolean
  ) {
    this._tabsCollector = new TabsCollector(this._allowOutsideWorkspaceRead);
  }

  private readonly _tabsCollector: TabsCollector;

  public async copyThisFileAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.ActiveEditorFile);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No active file to copy',
      commandName: 'Copy File',
      totalFilesCount:
        selection.fileItems.length + selection.deletedFileUris.length + selection.skippedOutsideWorkspaceUris.length,
    });
  }

  public async copyThisTabGroupAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.ActiveTabGroup);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No tab group files to copy!');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No tab group files to copy!',
      commandName: 'Copy Tab Group',
      totalFilesCount,
    });
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.AllOpenTabs);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No open files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No open files to copy',
      commandName: 'Copy All',
      totalFilesCount,
    });
  }

  public async copyAllPinnedFilesAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.AllPinnedTabs);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No pinned files to copy',
      commandName: 'Copy All Pinned',
      totalFilesCount,
    });
  }

  public async copyAllUnpinnedFilesAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.AllUnpinnedTabs);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No unpinned files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No unpinned files to copy',
      commandName: 'Copy All Unpinned',
      totalFilesCount,
    });
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.PinnedTabsInActiveTabGroup);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No pinned tab group files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No pinned tab group files to copy',
      commandName: 'Copy Pinned Tab Group',
      totalFilesCount,
    });
  }

  public async copyUnpinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    const selection = await this._tabsCollector.collectFileItems(TabsCollectorBuildOption.UnpinnedTabsInActiveTabGroup);

    await this._showSkippedOutsideWorkspaceWarning(selection.skippedOutsideWorkspaceUris);

    const totalFilesCount =
      selection.fileItems.length +
      selection.deletedFileUris.length +
      selection.unresolvedTabs.length +
      selection.skippedOutsideWorkspaceUris.length;

    if (totalFilesCount === 0) {
      await vscode.window.showWarningMessage('No unpinned tab group files to copy');
      return;
    }

    await this._copyTabBasedSelectionAsContext({
      selection,
      warningWhenEmpty: 'No unpinned tab group files to copy',
      commandName: 'Copy Unpinned Tab Group',
      totalFilesCount,
    });
  }

  private async _copyTabBasedSelectionAsContext(args: {
    selection: TabBasedFileItemsResult;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
  }): Promise<void> {
    if (args.selection.fileItems.length > 0) {
      await this._copyFileItemsSelectionAsContext({
        selectionFileItems: args.selection.fileItems,
        warningWhenEmpty: args.warningWhenEmpty,
        commandName: args.commandName,
        totalFilesCount: args.totalFilesCount,
        copiedFilesCount: args.selection.fileItems.length,
        deletedFileUris: args.selection.deletedFileUris,
        unresolvedTabs: args.selection.unresolvedTabs,
        skippedOutsideWorkspaceUris: args.selection.skippedOutsideWorkspaceUris,
      });

      return;
    }

    await vscode.window.showWarningMessage(args.warningWhenEmpty);
  }

  private async _copyFileItemsSelectionAsContext(args: {
    selectionFileItems: Array<{ path: string; content: string | null; languageId?: string; readError?: string }>;
    warningWhenEmpty: string;
    commandName: string;
    totalFilesCount: number;
    copiedFilesCount: number;
    deletedFileUris: vscode.Uri[];
    unresolvedTabs: vscode.Tab[];
    skippedOutsideWorkspaceUris: vscode.Uri[];
  }): Promise<void> {
    if (args.selectionFileItems.length === 0) {
      await vscode.window.showWarningMessage(args.warningWhenEmpty);
      return;
    }

    const config = await this._deps.configService.getSystemUserMergedConfig(true);
    const fileItems = args.selectionFileItems;

    const instructionsText = await new InstructionsBuilder(this._deps.extensionContext, config).build();

    const finalPromptText = buildFinalPromptText({
      fileItems,
      config,
      instructionsText,
    });

    const promptStatsResult = buildTextSizeStats({
      promptText: finalPromptText,
      contextConfig: config.presetDependentSettings.ideToLlm,
    });

    await vscode.env.clipboard.writeText(finalPromptText);

    await new CopiedNotificator(this._deps).showCopyResultNotification({
      commandName: args.commandName,
      includeTechPrompt: true,
      copiedFilesCount: args.copiedFilesCount,
      totalFilesCount: args.totalFilesCount,
      deletedFileUris: args.deletedFileUris,
      unresolvedTabs: args.unresolvedTabs,
      skippedOutsideWorkspaceUris: args.skippedOutsideWorkspaceUris,
      promptText: finalPromptText,
      fileItems: args.selectionFileItems,
      promptSizeStats: {
        linesCount: promptStatsResult.linesCount,
        approxTokensCount: promptStatsResult.approxTokensCount,
        maxLinesCountInContext: promptStatsResult.linesMaxToShowWarning,
        maxTokensCountInContext: promptStatsResult.tokensMaxToShowWarning,
        isExceeded: promptStatsResult.isExceeded,
        exceededBy: promptStatsResult.exceededBy,
      },
    });
  }

  private async _showSkippedOutsideWorkspaceWarning(skippedOutsideWorkspaceUris: vscode.Uri[]): Promise<void> {
    if (skippedOutsideWorkspaceUris.length === 0) return;

    await vscode.window.showWarningMessage(buildSkippedOutsideWorkspaceWarningMessage(skippedOutsideWorkspaceUris));
  }
}

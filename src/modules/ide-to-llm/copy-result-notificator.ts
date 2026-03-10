import * as vscode from 'vscode';

import { OverrideOptionMetadata } from '../../config-service';
import { CollectedFileItem } from '../../contracts/files-payload';
import { ConfigStateReportBuilder } from '../../utils/config-state-report-builder';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../utils/editor-virtual-doc-helpers';
import { EditorToLlmModulePrivateHelpersDependencies, EditorToLlmPromptSizeStats } from './common.helpers';
import { PromptBuilder } from './liquid-builder/prompt-builder';
import { buildLlmContextText } from './utils/llm-context-formatter';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from './utils/prompt-size-helper';

export interface ShowCopyResultNotificationArgs {
  commandName: string;
  includeTechPrompt: boolean;
  copiedFilesCount: number;
  totalFilesCount: number;
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
  promptText: string;
  fileItems: CollectedFileItem[];
  promptSizeStats?: EditorToLlmPromptSizeStats;
}

export class CopyResultNotificator {
  public constructor(private readonly _deps: EditorToLlmModulePrivateHelpersDependencies) {}

  public async showCopyResultNotification(args: ShowCopyResultNotificationArgs): Promise<void> {
    const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

    const overrideOptions = this._deps.configService.overrideOptions;
    const hasProfiles = overrideOptions.length > 0;

    const openPromptInEditor = 'Open Prompt in Editor';
    const eraseInstructions = 'Erase Instructions';

    let selectedProfileIds: string[] = [];
    let currentPromptText = args.promptText;
    let isTechPromptErased = false;

    while (true) {
      const effectiveConfig = await this._deps.configService.getMergedConfigByOverrideIds(selectedProfileIds);

      const promptStatsResult = buildTextSizeStats({
        promptText: currentPromptText,
        contextConfig: effectiveConfig.coreSettings.ideToLlmContextConfig,
      });

      const shouldShowPromptSizeStats =
        effectiveConfig.coreSettings.ideToLlmContextConfig.skipPromptSizeStatsInCopyNotification !== true;

      const baseMessage =
        unavailableFilesCount === 0
          ? `Copied ${args.copiedFilesCount} file(s)`
          : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s)`;

      const promptSizeStatsSuffix = shouldShowPromptSizeStats ? buildPromptSizeStatsSuffix(promptStatsResult) : '';

      const message = promptSizeStatsSuffix ? `${baseMessage} | ${promptSizeStatsSuffix}` : baseMessage;

      const shouldWarn = shouldShowPromptSizeStats ? Boolean(promptStatsResult.isExceeded) : false;

      const hasNoSelectedProfiles = selectedProfileIds.length === 0;

      const applyOrChangeProfilesLabel = hasNoSelectedProfiles ? 'Apply Profiles' : 'Change Profiles';

      const actionLabels = [
        openPromptInEditor,
        ...(isTechPromptErased ? [] : [eraseInstructions]),
        ...(hasProfiles ? [applyOrChangeProfilesLabel] : []),
      ];

      let selectedAction: string | undefined;

      if (actionLabels.length > 0) {
        selectedAction = shouldWarn
          ? await vscode.window.showWarningMessage(message, ...actionLabels)
          : await vscode.window.showInformationMessage(message, ...actionLabels);
      } else {
        selectedAction = shouldWarn
          ? await vscode.window.showWarningMessage(message)
          : await vscode.window.showInformationMessage(message);
      }

      if (!selectedAction) return;

      if (selectedAction === openPromptInEditor) {
        await this._openPromptTextInEditor(currentPromptText);
        return;
      }

      if (selectedAction === eraseInstructions) {
        isTechPromptErased = true;

        const rebuiltPrompt = await this._buildLlmPromptTextForProfiles({
          profileIds: selectedProfileIds,
          includeTechPromptFromCommand: args.includeTechPrompt,
          fileItems: args.fileItems,
          forceSkipTechPrompt: true,
        });

        currentPromptText = rebuiltPrompt;

        await vscode.env.clipboard.writeText(currentPromptText);

        continue;
      }

      if (selectedAction === applyOrChangeProfilesLabel) {
        const nextPickResult = await this._pickProfileIds({ overrideOptions, selectedProfileIds });
        if (!nextPickResult) return;

        selectedProfileIds = nextPickResult.profileIds;

        const rebuiltPrompt = await this._buildLlmPromptTextForProfiles({
          profileIds: selectedProfileIds,
          includeTechPromptFromCommand: args.includeTechPrompt,
          fileItems: args.fileItems,
          forceSkipTechPrompt: isTechPromptErased,
        });

        currentPromptText = rebuiltPrompt;

        await vscode.env.clipboard.writeText(currentPromptText);

        if (nextPickResult.shouldAdditionallyOpenMergedConfigInEditor) {
          await new ConfigStateReportBuilder({
            extensionContext: this._deps.extensionContext,
            configService: this._deps.configService,
            activeOverrideIds: selectedProfileIds,
          }).displayOverridesAppliedReport(selectedProfileIds);
        }

        continue;
      }
    }
  }

  private async _pickProfileIds(args: {
    overrideOptions: OverrideOptionMetadata[];
    selectedProfileIds: string[];
  }): Promise<PickProfileIdsResult | null> {
    const selectedProfileIdsSet = new Set(args.selectedProfileIds);

    const items: ApplyProfileQuickPickItem[] = [
      {
        isAdditionallyOpenMergedConfigInEditorOption: true,
        label: '[DEBUG OPTION] Afterwards open merged config in Editor',
        detail: 'Profiles are merged into base settings (order matters: last wins)',
        picked: false,
      },
    ];

    for (const overrideOption of args.overrideOptions) {
      const descriptionSuffix = overrideOption.description ? `${overrideOption.description}` : '';
      const version = overrideOption.version ? `v${overrideOption.version}: ` : '';

      items.push({
        profileId: overrideOption.id,
        label: overrideOption.id,
        detail: `${version}${descriptionSuffix}`,
        picked: selectedProfileIdsSet.has(overrideOption.id),
      });
    }

    const selectedItems = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select profiles to merge and apply to prompt (empty selection = base only)',
      canPickMany: true,
    });

    if (!selectedItems) return null;

    const shouldAdditionallyOpenMergedConfigInEditor = selectedItems.some(
      selectedItem => selectedItem.isAdditionallyOpenMergedConfigInEditorOption === true
    );

    const profileIds = selectedItems
      .map(selectedItem => selectedItem.profileId)
      .filter((profileId): profileId is string => Boolean(profileId));

    return { profileIds, shouldAdditionallyOpenMergedConfigInEditor };
  }

  private async _buildLlmPromptTextForProfiles(args: {
    profileIds: string[];
    includeTechPromptFromCommand: boolean;
    fileItems: CollectedFileItem[];
    forceSkipTechPrompt?: boolean;
  }): Promise<string> {
    const effectiveConfig = await this._deps.configService.getMergedConfigByOverrideIds(args.profileIds);

    const shouldIncludeTechPrompt =
      args.includeTechPromptFromCommand &&
      args.forceSkipTechPrompt !== true &&
      effectiveConfig.coreSettings.skipInstructions !== true;

    const effectiveFileItems = effectiveConfig.coreSettings.skipCodeListings === true ? [] : args.fileItems;

    const techPromptText = shouldIncludeTechPrompt
      ? await new PromptBuilder(this._deps.extensionContext, effectiveConfig).build()
      : '';

    return buildLlmContextText({
      fileItems: effectiveFileItems,
      ignorePromptInstructions: !shouldIncludeTechPrompt,
      config: effectiveConfig,
      techPromptText,
    });
  }

  private async _openPromptTextInEditor(promptText: string): Promise<void> {
    await ensureReadonlyVirtualMarkdownDocOpened({
      extensionContext: this._deps.extensionContext,
      docId: 'prompt',
      markdownText: promptText,
    });
  }
}

interface ApplyProfileQuickPickItem extends vscode.QuickPickItem {
  profileId?: string;
  isAdditionallyOpenMergedConfigInEditorOption?: boolean;
}

interface PickProfileIdsResult {
  profileIds: string[];
  shouldAdditionallyOpenMergedConfigInEditor: boolean;
}

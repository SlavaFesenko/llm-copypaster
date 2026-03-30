import * as vscode from 'vscode';

import { OverrideOptionMetadata } from '../../../config/config-service';
import { ConfigReportFacade } from '../../../config/reporters/config-report-facade';
import { LlmCopypasterConfig } from '../../../config/system-config-contracts';
import { CollectedFileItem } from '../../../contracts/file-contracts';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../../utils/editor-virtual-doc-helpers';
import { InstructionsBuilder } from '../../common/instructions-builder/instructions-builder';
import { IdeToLlmDeps, ShowCopyResultNotificationArgs } from '../contracts';
import { buildFinalPromptText } from './common.helpers';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from './text-size-helper';

export class CopiedNotificator {
  public constructor(private readonly _deps: IdeToLlmDeps) {}

  public async showCopyResultNotification(args: ShowCopyResultNotificationArgs): Promise<void> {
    const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

    const overrideOptions = this._deps.configService.overrideOptions ?? [];
    const hasProfiles = overrideOptions.length > 0;

    const openPromptInEditor = 'Open Prompt in Editor';
    const eraseInstructions = 'Erase Instructions';

    let selectedProfileIds: string[] = [];
    let currentPromptText = args.promptText;
    let isTechPromptErased = false;

    while (true) {
      const mergedConfigResult = await this._deps.configService.getSystemUserMergedConfigByOverrideIds(selectedProfileIds);
      const effectiveConfig = mergedConfigResult.mergedConfig;

      const promptStatsResult = buildTextSizeStats({
        promptText: currentPromptText,
        contextConfig: effectiveConfig.coreSettings.ideToLlm,
      });

      const shouldShowPromptSizeStats = effectiveConfig.coreSettings.ideToLlm.skipPromptSizeStatsInCopyNotification !== true;

      const baseMessage =
        unavailableFilesCount === 0
          ? `Copied ${args.copiedFilesCount} file(s)`
          : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s)`;

      const promptSizeStatsSuffix = shouldShowPromptSizeStats ? buildPromptSizeStatsSuffix(promptStatsResult) : '';

      const message = promptSizeStatsSuffix ? `${baseMessage} | ${promptSizeStatsSuffix}` : baseMessage;

      const shouldWarn = shouldShowPromptSizeStats ? Boolean(promptStatsResult.isExceeded) : false;

      const hasNoSelectedProfiles = selectedProfileIds.length === 0;

      const applyOrChangeOverridesCommand = hasNoSelectedProfiles ? 'Apply Overrides' : 'Change Overrides';

      const actionLabels = [
        openPromptInEditor,
        ...(isTechPromptErased ? [] : [eraseInstructions]),
        ...(hasProfiles ? [applyOrChangeOverridesCommand] : []),
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

        currentPromptText = await this._buildLlmPromptText({
          effectiveConfig,
          includeTechPromptFromCommand: args.includeTechPrompt,
          fileItems: args.fileItems,
          forceSkipTechPrompt: true,
        });

        await vscode.env.clipboard.writeText(currentPromptText);

        continue;
      }

      if (selectedAction === applyOrChangeOverridesCommand) {
        const nextPickResult = await this._pickProfileIds({ overrideOptions, selectedProfileIds });
        if (!nextPickResult) return;

        selectedProfileIds = nextPickResult.profileIds;

        const nextMergedConfigResult =
          await this._deps.configService.getSystemUserMergedConfigByOverrideIds(selectedProfileIds);

        currentPromptText = await this._buildLlmPromptText({
          effectiveConfig: nextMergedConfigResult.mergedConfig,
          includeTechPromptFromCommand: args.includeTechPrompt,
          fileItems: args.fileItems,
          forceSkipTechPrompt: isTechPromptErased,
        });

        await vscode.env.clipboard.writeText(currentPromptText);

        if (nextPickResult.shouldAdditionallyOpenMergedConfigInEditor) {
          await new ConfigReportFacade({
            extensionContext: this._deps.extensionContext,
            configService: this._deps.configService,
            activeOverrideIds: selectedProfileIds,
          }).displayOverridesAppliedReportFromData(nextMergedConfigResult.debugData);
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

  private async _buildLlmPromptText(args: {
    effectiveConfig: LlmCopypasterConfig;
    includeTechPromptFromCommand: boolean;
    fileItems: CollectedFileItem[];
    forceSkipTechPrompt?: boolean;
  }): Promise<string> {
    const shouldIncludeTechPrompt =
      args.includeTechPromptFromCommand &&
      args.forceSkipTechPrompt !== true &&
      args.effectiveConfig.coreSettings.skipInstructions !== true;

    const effectiveFileItems = args.effectiveConfig.coreSettings.skipCodeListings === true ? [] : args.fileItems;

    const techPromptText = shouldIncludeTechPrompt
      ? await new InstructionsBuilder(this._deps.extensionContext, args.effectiveConfig).build()
      : '';

    return buildFinalPromptText({
      fileItems: effectiveFileItems,
      ignorePromptInstructions: !shouldIncludeTechPrompt,
      config: args.effectiveConfig,
      instructionsText: techPromptText,
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

import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { InstructionConfig } from '../../config/contracts/system-config-contracts';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../utils/editor-virtual-doc-helpers';
import { InstructionsBuilder, InstructionsBuilderMode } from '../common/instructions-builder/instructions-builder';

interface QuickInstructionQuickPickItem extends vscode.QuickPickItem {
  instructionId: string;
}

export class QuickInstructionFacade {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService
  ) {}

  public async replaceClipboardByInstruction(): Promise<void> {
    const instructionsSet = await this._getInstructionsSet('Select instructions to replace clipboard');
    if (!instructionsSet) return;

    await vscode.env.clipboard.writeText(instructionsSet);
    await this._showClipboardChangedNotification(instructionsSet, 'replace');
  }

  public async prependInstructionToClipboard(): Promise<void> {
    const instructionsSet = await this._getInstructionsSet('Select instructions to prepend to clipboard');
    if (!instructionsSet) return;

    const currentClipboardText = await vscode.env.clipboard.readText();

    if (!currentClipboardText.trim()) {
      await vscode.env.clipboard.writeText(instructionsSet);
      await this._showClipboardChangedNotification(instructionsSet, 'prepend');
      return;
    }

    const llmCopypasterConfig = await this._configService.getSystemUserMergedConfig();

    const delimiterLine = `\n${llmCopypasterConfig.nonOverrideableSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR}\n`;
    const nextClipboardText = `${delimiterLine}${instructionsSet}${delimiterLine}${currentClipboardText}`;

    await vscode.env.clipboard.writeText(nextClipboardText);
    await this._showClipboardChangedNotification(nextClipboardText, 'prepend');
  }

  private async _showClipboardChangedNotification(
    clipboardText: string,
    operationType: 'prepend' | 'replace'
  ): Promise<void> {
    const openPromptInEditor = 'Open Prompt in Editor';
    const message = operationType === 'prepend' ? 'Clipboard content was prepended' : 'Clipboard content was replaced';

    const selectedAction = await vscode.window.showInformationMessage(message, openPromptInEditor);

    if (selectedAction !== openPromptInEditor) return;

    await ensureReadonlyVirtualMarkdownDocOpened({
      extensionContext: this._extensionContext,
      docId: 'clipboard',
      markdownText: clipboardText,
    });
  }

  private async _getInstructionsSet(quickPickPlaceHolder: string): Promise<string> {
    const llmCopypasterConfig = await this._configService.getSystemUserMergedConfig();
    const instructionsById = llmCopypasterConfig.coreSettings.instructionsAndVariables.instructionsById ?? {};
    const availableInstructionItems = this._buildAvailableInstructionItems(instructionsById);

    if (availableInstructionItems.length === 0) return '';

    const selectedInstructionItems = await vscode.window.showQuickPick(availableInstructionItems, {
      canPickMany: true,
      placeHolder: quickPickPlaceHolder,
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true,
    });

    if (!selectedInstructionItems || selectedInstructionItems.length === 0) return '';

    const onlyForInstructionsIds = selectedInstructionItems.map(
      selectedInstructionItem => selectedInstructionItem.instructionId
    );

    return await new InstructionsBuilder(this._extensionContext, llmCopypasterConfig).build({
      mode: InstructionsBuilderMode.QuickInstruction,
      onlyForInstructionsIds,
    });
  }

  private _buildAvailableInstructionItems(
    instructionsById: Record<string, InstructionConfig>
  ): QuickInstructionQuickPickItem[] {
    return Object.entries(instructionsById)
      .filter(([, instructionConfig]) => !instructionConfig.skip && instructionConfig.showInQuickInstructionMode)
      .map(([instructionId, instructionConfig]) => ({
        instructionId,
        label: instructionId,
        description: instructionConfig.path,
      }));
  }
}

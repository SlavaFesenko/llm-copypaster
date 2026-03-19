import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { InstructionConfig } from '../../config/system-config-contracts';
import { InstructionsBuilder, InstructionsBuilderMode } from '../common/instructions-builder/instructions-builder';

interface QuickInstructionQuickPickItem extends vscode.QuickPickItem {
  instructionId: string;
}

export class QuickInstructionModule {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService
  ) {}

  public async replaceClipboardByInstruction(): Promise<void> {
    const instructionsSet = await this._getInstructionsSet('Select instructions to replace clipboard');
    if (!instructionsSet) return;

    await vscode.env.clipboard.writeText(instructionsSet);
  }

  public async prependInstructionToClipboard(): Promise<void> {
    const instructionsSet = await this._getInstructionsSet('Select instructions to prepend to clipboard');
    if (!instructionsSet) return;

    const currentClipboardText = await vscode.env.clipboard.readText();

    if (!currentClipboardText.trim()) {
      await vscode.env.clipboard.writeText(instructionsSet);
      return;
    }

    const llmCopypasterConfig = await this._configService.getLlmCopypasterConfig();

    const delimiterLine = `\n${llmCopypasterConfig.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR}\n`;
    const nextClipboardText = `${instructionsSet}${delimiterLine}${currentClipboardText}`;

    await vscode.env.clipboard.writeText(nextClipboardText);
  }

  private async _getInstructionsSet(quickPickPlaceHolder: string): Promise<string> {
    const llmCopypasterConfig = await this._configService.getLlmCopypasterConfig();
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
      .filter(([, instructionConfig]) => !instructionConfig.skip && !instructionConfig.skipInQuickInstructionMode)
      .map(([instructionId, instructionConfig]) => ({
        instructionId,
        label: instructionId,
        description: instructionConfig.path,
      }));
  }
}

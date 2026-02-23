import * as vscode from 'vscode';

import { AdvancedCloseModule } from './advanced-close/advanced-close-module';
import { EditorToLlmModule } from './editor-to-llm/editor-to-llm-module';
import { GuidedRetryStore } from './llm-to-editor/guided-retry/guided-retry-store';
import { LlmToEditorModule } from './llm-to-editor/llm-to-editor-module';
import { OutputChannelLogger } from './utils/output-channel-logger';

export const commandIds = {
  helloWorld: 'llm-copypaster.helloWorld',

  copyThisFileAsLlmContext: 'llm-copypaster.copyThisFileAsLlmContext',
  copyThisTabGroupAsLlmContext: 'llm-copypaster.copyThisTabGroupAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copyPinnedFilesAsLlmContext: 'llm-copypaster.copyPinnedFilesAsLlmContext',
  copyThisFileAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyThisFileAsLlmContextWithoutTechPrompt',
  copyThisTabGroupAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyThisTabGroupAsLlmContextWithoutTechPrompt',
  copyAllOpenFilesAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyAllOpenFilesAsLlmContextWithoutTechPrompt',
  copyPinnedFilesAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyPinnedFilesAsLlmContextWithoutTechPrompt',
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',
  validateClipboardPayload: 'llm-copypaster.validateClipboardPayload',
  sanitizeClipboardPayload: 'llm-copypaster.sanitizeClipboardPayload',
  copyGuidedRetryPromptLastError: 'llm-copypaster.copyGuidedRetryPromptLastError',

  closeAllIncludingPinned: 'llm-copypaster.closeAllIncludingPinned',
  closeAllButPinnedInActiveTabGroup: 'llm-copypaster.closeAllButPinnedInActiveTabGroup',
  closeAllIncludingPinnedInActiveTabGroup: 'llm-copypaster.closeAllIncludingPinnedInActiveTabGroup',
} as const;

export type CommandId = (typeof commandIds)[keyof typeof commandIds];

export interface RegisterCommandsDeps {
  editorToLlmModule: EditorToLlmModule;
  llmToEditorModule: LlmToEditorModule;
  guidedRetryStore: GuidedRetryStore;
  advancedCloseModule: AdvancedCloseModule;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  // #region Editor 2 LLM

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyPinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyPinnedFilesAsContext(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyPinnedFilesAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyPinnedFilesAsContext(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerItemsAsLlmContext,
      async (resourceUris?: vscode.Uri[] | vscode.Uri) => {
        await deps.editorToLlmModule.copySelectedExplorerItemsAsContext(resourceUris);
      }
    )
  );

  // #endregion

  // #region LLM 2 Editor

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.applyClipboardToFiles, async () => {
      await deps.llmToEditorModule.applyClipboardToFiles();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.validateClipboardPayload, async () => {
      await deps.llmToEditorModule.validateClipboardPayload();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.sanitizeClipboardPayload, async () => {
      await deps.llmToEditorModule.sanitizeClipboardPayload();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyGuidedRetryPromptLastError, async () => {
      const retryPrompt = deps.guidedRetryStore.buildRetryPromptForLastError();
      if (!retryPrompt) {
        await vscode.window.showWarningMessage('No guided retry data yet');
        return;
      }

      await vscode.env.clipboard.writeText(retryPrompt);
      await vscode.window.showInformationMessage('Guided retry prompt copied to clipboard');
    })
  );

  // #endregion

  // #region Advanced Close

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.closeAllIncludingPinned, async () => {
      await deps.advancedCloseModule.closeAllIncludingPinned();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.closeAllButPinnedInActiveTabGroup, async () => {
      await deps.advancedCloseModule.closeAllButPinnedInActiveTabGroup();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.closeAllIncludingPinnedInActiveTabGroup, async () => {
      await deps.advancedCloseModule.closeAllIncludingPinnedInActiveTabGroup();
    })
  );

  // #endregion
}

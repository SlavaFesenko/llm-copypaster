import * as vscode from 'vscode';

import { AdvancedCloseModule } from './modules/advanced-close/advanced-close-module';
import { EditorToLlmModule } from './modules/editor-to-llm/editor-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-editor/guided-retry/guided-retry-store';
import { LlmToEditorModule } from './modules/llm-to-editor/llm-to-editor-module';
import { OutputChannelLogger } from './utils/output-channel-logger';

export const commandIds = {
  helloWorld: 'llm-copypaster.helloWorld',

  copyThisFileAsLlmContext: 'llm-copypaster.copyThisFileAsLlmContext',
  copyThisTabGroupAsLlmContext: 'llm-copypaster.copyThisTabGroupAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copyAllPinnedFilesAsLlmContext: 'llm-copypaster.copyAllPinnedFilesAsLlmContext',
  copyPinnedFilesInActiveTabGroupAsLlmContext: 'llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContext',
  copyThisFileAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyThisFileAsLlmContextWithoutTechPrompt',
  copyThisTabGroupAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyThisTabGroupAsLlmContextWithoutTechPrompt',
  copyAllOpenFilesAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyAllOpenFilesAsLlmContextWithoutTechPrompt',
  copyAllPinnedFilesAsLlmContextWithoutTechPrompt: 'llm-copypaster.copyAllPinnedFilesAsLlmContextWithoutTechPrompt',
  copyPinnedFilesInActiveTabGroupAsLlmContextWithoutTechPrompt:
    'llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContextWithoutTechPrompt',
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',
  copySelectedExplorerItemsAsLlmContextWithoutTechPrompt:
    'llm-copypaster.copySelectedExplorerItemsAsLlmContextWithoutTechPrompt',

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
  const commandDisposables: vscode.Disposable[] = [
    // #region Editor 2 LLM

    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext(true);
    }),

    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext(true);
    }),

    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext(true);
    }),

    vscode.commands.registerCommand(commandIds.copyAllPinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllPinnedFilesAsContext(true);
    }),

    vscode.commands.registerCommand(commandIds.copyPinnedFilesInActiveTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyPinnedFilesInActiveTabGroupAsContext(true);
    }),

    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext(false);
    }),

    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext(false);
    }),

    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext(false);
    }),

    vscode.commands.registerCommand(commandIds.copyAllPinnedFilesAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyAllPinnedFilesAsContext(false);
    }),

    vscode.commands.registerCommand(commandIds.copyPinnedFilesInActiveTabGroupAsLlmContextWithoutTechPrompt, async () => {
      await deps.editorToLlmModule.copyPinnedFilesInActiveTabGroupAsContext(false);
    }),

    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerItemsAsLlmContext,
      async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        await deps.editorToLlmModule.copySelectedExplorerItemsAsContext({ clickedUri, selectedUris }, true);
      }
    ),

    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerItemsAsLlmContextWithoutTechPrompt,
      async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        await deps.editorToLlmModule.copySelectedExplorerItemsAsContext({ clickedUri, selectedUris }, false);
      }
    ),

    // #endregion

    // #region LLM 2 Editor

    vscode.commands.registerCommand(commandIds.applyClipboardToFiles, async () => {
      await deps.llmToEditorModule.applyClipboardToFiles();
    }),

    vscode.commands.registerCommand(commandIds.validateClipboardPayload, async () => {
      await deps.llmToEditorModule.validateClipboardPayload();
    }),

    vscode.commands.registerCommand(commandIds.sanitizeClipboardPayload, async () => {
      await deps.llmToEditorModule.sanitizeClipboardPayload();
    }),

    vscode.commands.registerCommand(commandIds.copyGuidedRetryPromptLastError, async () => {
      const retryPrompt = deps.guidedRetryStore.buildRetryPromptForLastError();
      if (!retryPrompt) {
        await vscode.window.showWarningMessage('No guided retry data yet');
        return;
      }

      await vscode.env.clipboard.writeText(retryPrompt);
      await vscode.window.showInformationMessage('Guided retry prompt copied to clipboard');
    }),

    // #endregion

    // #region Advanced Close

    vscode.commands.registerCommand(commandIds.closeAllIncludingPinned, async () => {
      await deps.advancedCloseModule.closeAllIncludingPinned();
    }),

    vscode.commands.registerCommand(commandIds.closeAllButPinnedInActiveTabGroup, async () => {
      await deps.advancedCloseModule.closeAllButPinnedInActiveTabGroup();
    }),

    vscode.commands.registerCommand(commandIds.closeAllIncludingPinnedInActiveTabGroup, async () => {
      await deps.advancedCloseModule.closeAllIncludingPinnedInActiveTabGroup();
    }),

    // #endregion
  ];

  context.subscriptions.push(...commandDisposables);
}

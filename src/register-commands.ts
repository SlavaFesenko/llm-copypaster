import * as vscode from 'vscode';

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
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',
  validateClipboardPayload: 'llm-copypaster.validateClipboardPayload',
  sanitizeClipboardPayload: 'llm-copypaster.sanitizeClipboardPayload',
  copyGuidedRetryPromptLastError: 'llm-copypaster.copyGuidedRetryPromptLastError',
} as const;

export type CommandId = (typeof commandIds)[keyof typeof commandIds];

export interface RegisterCommandsDeps {
  editorToLlmModule: EditorToLlmModule;
  llmToEditorModule: LlmToEditorModule;
  guidedRetryStore: GuidedRetryStore;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  // #region Editor 2 LLM

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyPinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyPinnedFilesAsContext();
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
}

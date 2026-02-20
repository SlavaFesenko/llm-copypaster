import * as vscode from 'vscode';

import { EditorToLlmModule } from '../editor-to-llm/editor-to-llm-module';
import { GuidedRetryStore } from '../llm-to-editor/guided-retry/guided-retry-store';
import { LlmToEditorModule } from '../llm-to-editor/llm-to-editor-module';
import { OutputChannelLogger } from '../utils/output-channel-logger';
import { commandIds } from './command-ids';

export interface RegisterCommandsDeps {
  editorToLlmModule: EditorToLlmModule;
  llmToEditorModule: LlmToEditorModule;
  guidedRetryStore: GuidedRetryStore;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyActiveFileAsLlmContext, async () => {
      await deps.editorToLlmModule.copyActiveFileAsContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerFilesAsLlmContext,
      async (resourceUris?: vscode.Uri[] | vscode.Uri) => {
        await deps.editorToLlmModule.copySelectedExplorerFilesAsContext(resourceUris);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyLlmContextWithResponseFormatPrompt, async () => {
      await deps.editorToLlmModule.copyContextWithResponseFormatPrompt();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(commandIds.copyLlmContextWithoutResponseFormatPrompt, async () => {
      await deps.editorToLlmModule.copyContextWithoutResponseFormatPrompt();
    })
  );

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
}

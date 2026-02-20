// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ConfigService } from './config/config-service';
import { EditorToLlmModule } from './editor-to-llm/editor-to-llm-module';
import { GuidedRetryStore } from './llm-to-editor/guided-retry/guided-retry-store';
import { LlmToEditorModule } from './llm-to-editor/llm-to-editor-module';
import { registerCommands } from './register-commands';
import { OutputChannelLogger } from './utils/output-channel-logger';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService(context, logger);
  const guidedRetryStore = new GuidedRetryStore(context, logger);

  const editorToLlmModule = new EditorToLlmModule(configService, logger);
  const llmToEditorModule = new LlmToEditorModule(configService, guidedRetryStore, logger);

  registerCommands(context, {
    editorToLlmModule,
    llmToEditorModule,
    guidedRetryStore,
    logger,
  });

  logger.info('Extension activated');
}

// This method is called when your extension is deactivated
export function deactivate() {}

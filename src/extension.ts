// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ConfigService } from './config-service';
import { AdvancedCloseModule } from './modules/advanced-close/advanced-close-module';
import { IdeToLlmModule } from './modules/ide-to-llm/ide-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-ide/guided-retry/guided-retry-store';
import { LlmToIdeModule } from './modules/llm-to-ide/llm-to-ide-module';
import { registerCommands } from './register-commands';
import { OutputChannelLogger } from './utils/output-channel-logger';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService(logger);
  const guidedRetryStore = new GuidedRetryStore(context, logger);

  const editorToLlmModule = new IdeToLlmModule(context, configService, logger);
  const llmToEditorModule = new LlmToIdeModule(configService, guidedRetryStore, logger);
  const advancedCloseModule = new AdvancedCloseModule(logger);

  registerCommands(context, {
    editorToLlmModule,
    llmToEditorModule,
    guidedRetryStore,
    advancedCloseModule,
    logger,
  });

  logger.info('Extension activated');
}

// This method is called when your extension is deactivated
export function deactivate() {}

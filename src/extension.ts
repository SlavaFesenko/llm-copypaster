import * as vscode from 'vscode';

import { ConfigService } from './config/config-service';
import { AdvancedTabOptionsModule } from './modules/advanced-tab-options/advanced-file-options-module';
import { IdeToLlmModule } from './modules/ide-to-llm/ide-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-ide/guided-retry/guided-retry-store';
import { LlmToIdeModule } from './modules/llm-to-ide/llm-to-ide-module';
import { QuickInstructionModule } from './modules/quick-instruction/quick-instruction-module';
import { registerCommands } from './register-commands';
import { OutputChannelLogger } from './utils/output-channel-logger';

// This method is called when your extension is activated, extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService();
  const guidedRetryStore = new GuidedRetryStore(context, logger);

  const editorToLlmModule = new IdeToLlmModule(context, configService, logger);
  const llmToEditorModule = new LlmToIdeModule(configService, guidedRetryStore, logger);
  const advancedTabOptionsModule = new AdvancedTabOptionsModule(logger);
  const quickInstructionModule = new QuickInstructionModule(context, configService);

  registerCommands(context, {
    editorToLlmModule,
    llmToEditorModule,
    quickInstructionModule,
    guidedRetryStore,
    advancedCloseModule: advancedTabOptionsModule,
    configService,
    logger,
  });

  logger.info('Extension activated');
}

export function deactivate() {}

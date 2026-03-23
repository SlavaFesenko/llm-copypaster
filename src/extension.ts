import * as vscode from 'vscode';

import { ConfigService } from './config/config-service';
import { IdeToLlmModule } from './modules/ide-to-llm/ide-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-ide/guided-retry/guided-retry-store';
import { LlmToIdeModule } from './modules/llm-to-ide/llm-to-ide-module';
import { QuickInstructionModule } from './modules/quick-instruction/quick-instruction-module';
import { registerCommands } from './register-commands';
import { OutputChannelLogger } from './utils/output-channel-logger';

export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService();
  const guidedRetryStore = new GuidedRetryStore(context, logger);

  const ideToLlmModule = new IdeToLlmModule(context, configService, logger);
  const llmToIdeModule = new LlmToIdeModule(configService, guidedRetryStore, logger);
  const quickInstructionModule = new QuickInstructionModule(context, configService);

  registerCommands(context, {
    editorToLlmModule: ideToLlmModule,
    llmToEditorModule: llmToIdeModule,
    quickInstructionModule,
    guidedRetryStore,
    configService,
    logger,
  });

  logger.info('Extension activated');
}

export function deactivate() {}

import * as vscode from 'vscode';

import { ConfigService } from './config/config-service';
import { IdeToLlmFacade } from './modules/ide-to-llm/ide-to-llm-facade';
import { LlmToIdeFacade } from './modules/llm-to-ide/llm-to-ide-facade';
import { QuickInstructionFacade } from './modules/quick-instruction/quick-instruction-facade';
import { registerCommands } from './register-commands';
import { OutputChannelLogger } from './utils/output-channel-logger';

export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService();

  const ideToLlmFacade = new IdeToLlmFacade(context, configService, logger);
  const llmToIdeFacade = new LlmToIdeFacade(configService, logger);
  const quickInstructionFacade = new QuickInstructionFacade(context, configService);

  registerCommands(context, {
    editorToLlmFacade: ideToLlmFacade,
    llmToIdeFacade: llmToIdeFacade,
    quickInstructionFacade: quickInstructionFacade,
    configService,
    logger,
  });

  logger.info('Extension activated');
}

export function deactivate() {}

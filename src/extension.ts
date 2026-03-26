import * as vscode from 'vscode';

import { ConfigService } from './config/config-service';
import { ConfigReportFacade } from './config/reporters/config-report-facade';
import { CopySelectedExplorerItemsArgs } from './modules/ide-to-llm/contracts';
import { IdeToLlmFacade } from './modules/ide-to-llm/ide-to-llm-facade';
import { LlmToIdeFacade } from './modules/llm-to-ide/llm-to-ide-facade';
import { QuickInstructionFacade } from './modules/quick-instruction/quick-instruction-facade';
import { OutputChannelLogger } from './utils/output-channel-logger';

export async function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger('LLM Copypaster');
  const configService = new ConfigService();
  const config = await configService.getLlmCopypasterConfig();

  const ideToLlmFacade = new IdeToLlmFacade(
    context,
    configService,
    logger,
    config.nonOverrideableSettings.allowOutsideWorkspaceRead
  );

  const llmToIdeFacade = new LlmToIdeFacade(
    configService,
    logger,
    config.nonOverrideableSettings.allowOutsideWorkspaceWrite,
    config.nonOverrideableSettings.allowOutsideWorkspaceWriteViaConfirmation
  );

  const quickInstructionFacade = new QuickInstructionFacade(context, configService);

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-copypaster.copyThisFileAsLlmContext', async () => {
      await ideToLlmFacade.copyThisFileAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyThisTabGroupAsLlmContext', async () => {
      await ideToLlmFacade.copyThisTabGroupAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyAllOpenFilesAsLlmContext', async () => {
      await ideToLlmFacade.copyAllOpenFilesAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyAllPinnedFilesAsLlmContext', async () => {
      await ideToLlmFacade.copyAllPinnedFilesAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyAllUnpinnedFilesAsLlmContext', async () => {
      await ideToLlmFacade.copyAllUnpinnedFilesAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContext', async () => {
      await ideToLlmFacade.copyPinnedFilesInActiveTabGroupAsContext();
    }),
    vscode.commands.registerCommand('llm-copypaster.copyUnpinnedFilesInActiveTabGroupAsLlmContext', async () => {
      await ideToLlmFacade.copyUnpinnedFilesInActiveTabGroupAsContext();
    }),
    vscode.commands.registerCommand(
      'llm-copypaster.copySelectedExplorerItemsAsLlmContext',
      async (_clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        await ideToLlmFacade.copySelectedExplorerItemsAsContext({ selectedUris } as CopySelectedExplorerItemsArgs);
      }
    ),
    vscode.commands.registerCommand('llm-copypaster.applyClipboardToFiles', async () => {
      await llmToIdeFacade.applyClipboardToFiles();
    }),
    vscode.commands.registerCommand('llm-copypaster.replaceClipboardByInstruction', async () => {
      await quickInstructionFacade.replaceClipboardByInstruction();
    }),
    vscode.commands.registerCommand('llm-copypaster.prependInstructionToClipboard', async () => {
      await quickInstructionFacade.prependInstructionToClipboard();
    }),
    vscode.commands.registerCommand('llm-copypaster.lsConfig', async () => {
      await new ConfigReportFacade({
        extensionContext: context,
        configService,
      }).displayLsConfigReport();
    })
  );

  logger.info('Extension activated');
}

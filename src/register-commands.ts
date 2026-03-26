import * as vscode from 'vscode';
import { ConfigService } from './config/config-service';
import { ConfigReportFacade } from './config/reporters/config-report-facade';
import { CopySelectedExplorerItemsArgs } from './modules/ide-to-llm/contracts';
import { IdeToLlmFacade } from './modules/ide-to-llm/ide-to-llm-facade';
import { LlmToIdeFacade } from './modules/llm-to-ide/llm-to-ide-facade';
import { QuickInstructionFacade } from './modules/quick-instruction/quick-instruction-facade';
import { OutputChannelLogger } from './utils/output-channel-logger';

const commandIds = {
  helloWorld: 'llm-copypaster.helloWorld',

  copyThisFileAsLlmContext: 'llm-copypaster.copyThisFileAsLlmContext',
  copyThisTabGroupAsLlmContext: 'llm-copypaster.copyThisTabGroupAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copyAllPinnedFilesAsLlmContext: 'llm-copypaster.copyAllPinnedFilesAsLlmContext',
  copyAllUnpinnedFilesAsLlmContext: 'llm-copypaster.copyAllUnpinnedFilesAsLlmContext',
  copyPinnedFilesInActiveTabGroupAsLlmContext: 'llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContext',
  copyUnpinnedFilesInActiveTabGroupAsLlmContext: 'llm-copypaster.copyUnpinnedFilesInActiveTabGroupAsLlmContext',
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',
  replaceClipboardByInstruction: 'llm-copypaster.replaceClipboardByInstruction',
  prependInstructionToClipboard: 'llm-copypaster.prependInstructionToClipboard',

  lsConfig: 'llm-copypaster.lsConfig',
} as const;

export interface RegisterCommandsDeps {
  editorToLlmFacade: IdeToLlmFacade;
  llmToIdeFacade: LlmToIdeFacade;
  quickInstructionFacade: QuickInstructionFacade;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  const commandDisposables: vscode.Disposable[] = [
    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyThisFileAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyThisTabGroupAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyAllOpenFilesAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyAllPinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyAllPinnedFilesAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyAllUnpinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyAllUnpinnedFilesAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyPinnedFilesInActiveTabGroupAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyPinnedFilesInActiveTabGroupAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyUnpinnedFilesInActiveTabGroupAsLlmContext, async () => {
      await deps.editorToLlmFacade.copyUnpinnedFilesInActiveTabGroupAsContext();
    }),

    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerItemsAsLlmContext,
      async (_clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        await deps.editorToLlmFacade.copySelectedExplorerItemsAsContext({ selectedUris } as CopySelectedExplorerItemsArgs);
      }
    ),

    vscode.commands.registerCommand(commandIds.applyClipboardToFiles, async () => {
      await deps.llmToIdeFacade.applyClipboardToFiles();
    }),

    vscode.commands.registerCommand(commandIds.replaceClipboardByInstruction, async () => {
      await deps.quickInstructionFacade.replaceClipboardByInstruction();
    }),

    vscode.commands.registerCommand(commandIds.prependInstructionToClipboard, async () => {
      await deps.quickInstructionFacade.prependInstructionToClipboard();
    }),

    vscode.commands.registerCommand(commandIds.lsConfig, async () => {
      await new ConfigReportFacade({
        extensionContext: context,
        configService: deps.configService,
      }).displayLsConfigReport();
    }),
  ];

  context.subscriptions.push(...commandDisposables);
}

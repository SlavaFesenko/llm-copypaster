import * as vscode from 'vscode';
import { ConfigService } from './config/config-service';
import { ConfigReportFacade } from './config/reporters/config-report-facade';
import { CopySelectedExplorerItemsArgs } from './modules/ide-to-llm/explorer-helper';
import { IdeToLlmModule } from './modules/ide-to-llm/ide-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-ide/guided-retry/guided-retry-store';
import { LlmToIdeModule } from './modules/llm-to-ide/llm-to-ide-module';
import { QuickInstructionModule } from './modules/quick-instruction/quick-instruction-module';
import { OutputChannelLogger } from './utils/output-channel-logger';

export const commandIds = {
  helloWorld: 'llm-copypaster.helloWorld',

  copyThisFileAsLlmContext: 'llm-copypaster.copyThisFileAsLlmContext',
  copyThisTabGroupAsLlmContext: 'llm-copypaster.copyThisTabGroupAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copyAllPinnedFilesAsLlmContext: 'llm-copypaster.copyAllPinnedFilesAsLlmContext',
  copyPinnedFilesInActiveTabGroupAsLlmContext: 'llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContext',
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',
  replaceClipboardByInstruction: 'llm-copypaster.replaceClipboardByInstruction',
  prependInstructionToClipboard: 'llm-copypaster.prependInstructionToClipboard',

  lsConfig: 'llm-copypaster.lsConfig',
} as const;

export type CommandId = (typeof commandIds)[keyof typeof commandIds];

export interface RegisterCommandsDeps {
  editorToLlmModule: IdeToLlmModule;
  llmToEditorModule: LlmToIdeModule;
  quickInstructionModule: QuickInstructionModule;
  guidedRetryStore: GuidedRetryStore;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  const commandDisposables: vscode.Disposable[] = [
    // #region Editor 2 LLM
    vscode.commands.registerCommand(commandIds.copyThisFileAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisFileAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyThisTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyThisTabGroupAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyAllOpenFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllOpenFilesAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyAllPinnedFilesAsLlmContext, async () => {
      await deps.editorToLlmModule.copyAllPinnedFilesAsContext();
    }),

    vscode.commands.registerCommand(commandIds.copyPinnedFilesInActiveTabGroupAsLlmContext, async () => {
      await deps.editorToLlmModule.copyPinnedFilesInActiveTabGroupAsContext();
    }),

    vscode.commands.registerCommand(
      commandIds.copySelectedExplorerItemsAsLlmContext,
      async (_clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        await deps.editorToLlmModule.copySelectedExplorerItemsAsContext({ selectedUris } as CopySelectedExplorerItemsArgs);
      }
    ),

    // #endregion

    // #region LLM 2 Editor

    vscode.commands.registerCommand(commandIds.applyClipboardToFiles, async () => {
      await deps.llmToEditorModule.applyClipboardToFiles();
    }),

    vscode.commands.registerCommand(commandIds.replaceClipboardByInstruction, async () => {
      await deps.quickInstructionModule.replaceClipboardByInstruction();
    }),

    vscode.commands.registerCommand(commandIds.prependInstructionToClipboard, async () => {
      await deps.quickInstructionModule.prependInstructionToClipboard();
    }),

    vscode.commands.registerCommand(commandIds.lsConfig, async () => {
      await new ConfigReportFacade({
        extensionContext: context,
        configService: deps.configService,
      }).displayLsConfigReport();
    }),

    // #endregion
  ];

  context.subscriptions.push(...commandDisposables);
}

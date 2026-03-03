import * as vscode from 'vscode';
import { ConfigService } from './config-service';
import { AdvancedCloseModule } from './modules/advanced-close/advanced-close-module';
import { CopySelectedExplorerItemsArgs } from './modules/ide-to-llm/explorer-helper';
import { IdeToLlmModule } from './modules/ide-to-llm/ide-to-llm-module';
import { GuidedRetryStore } from './modules/llm-to-ide/guided-retry/guided-retry-store';
import { LlmToIdeModule } from './modules/llm-to-ide/llm-to-ide-module';
import { OutputChannelLogger } from './utils/output-channel-logger';
import { createReadonlyTextView } from './utils/text-view-helpers';

export const commandIds = {
  helloWorld: 'llm-copypaster.helloWorld',

  copyThisFileAsLlmContext: 'llm-copypaster.copyThisFileAsLlmContext',
  copyThisTabGroupAsLlmContext: 'llm-copypaster.copyThisTabGroupAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copyAllPinnedFilesAsLlmContext: 'llm-copypaster.copyAllPinnedFilesAsLlmContext',
  copyPinnedFilesInActiveTabGroupAsLlmContext: 'llm-copypaster.copyPinnedFilesInActiveTabGroupAsLlmContext',
  copySelectedExplorerItemsAsLlmContext: 'llm-copypaster.copySelectedExplorerItemsAsLlmContext',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',

  forceCloseAllTabs: 'llm-copypaster.forceCloseAllTabs',
  forceCloseTabsInTabGroup: 'llm-copypaster.forceCloseTabsInTabGroup',
  pinAllTabs: 'llm-copypaster.pinAllTabs',
  pinTabsInTabGroup: 'llm-copypaster.pinTabsInTabGroup',
  unpinAllTabs: 'llm-copypaster.unpinAllTabs',
  unpinTabsInTabGroup: 'llm-copypaster.unpinTabsInTabGroup',

  lsConfig: 'llm-copypaster.lsConfig',
} as const;

export type CommandId = (typeof commandIds)[keyof typeof commandIds];

export interface RegisterCommandsDeps {
  editorToLlmModule: IdeToLlmModule;
  llmToEditorModule: LlmToIdeModule;
  guidedRetryStore: GuidedRetryStore;
  advancedCloseModule: AdvancedCloseModule;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: RegisterCommandsDeps) {
  const lsConfigReadonlyView = createReadonlyTextView(context, 'llm-copypaster-lsconfig', 'current-config-state', 'json');

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

    vscode.commands.registerCommand(commandIds.lsConfig, async () => {
      const config = await deps.configService.getConfig();
      const configJson = JSON.stringify(config, null, 2);

      await lsConfigReadonlyView.open(configJson);
    }),

    // #endregion

    // #region Advanced Close

    vscode.commands.registerCommand(commandIds.forceCloseAllTabs, async () => {
      await deps.advancedCloseModule.forceCloseAllTabs();
    }),
    vscode.commands.registerCommand(commandIds.forceCloseTabsInTabGroup, async (clickedContext?: unknown) => {
      await deps.advancedCloseModule.forceCloseTabsInTabGroup(clickedContext);
    }),

    vscode.commands.registerCommand(commandIds.pinAllTabs, async () => {
      await deps.advancedCloseModule.pinAllTabs();
    }),
    vscode.commands.registerCommand(commandIds.pinTabsInTabGroup, async (clickedContext?: unknown) => {
      await deps.advancedCloseModule.pinTabsInTabGroup(clickedContext);
    }),
    vscode.commands.registerCommand(commandIds.unpinAllTabs, async () => {
      await deps.advancedCloseModule.unpinAllTabs();
    }),
    vscode.commands.registerCommand(commandIds.unpinTabsInTabGroup, async (clickedContext?: unknown) => {
      await deps.advancedCloseModule.unpinTabsInTabGroup(clickedContext);
    }),

    // #endregion
  ];

  context.subscriptions.push(...commandDisposables);
}

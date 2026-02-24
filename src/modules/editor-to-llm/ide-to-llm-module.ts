import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { EditorToLlmModulePrivateHelpersDependencies } from './common.helpers';
import {
  copyAllOpenTabsAsContext,
  copyAllPinnedTabsAsContext,
  copyPinnedTabsInActiveTabGroupAsContext,
  copyThisActiveFileAsContext,
  copyThisTabGroupAsContext,
} from './editor.helpers';
import { CopySelectedExplorerItemsArgs, copySelectedExplorerItemsAsContext } from './explorer.helpers';

export class IdeToLlmModule {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {
    this._privateHelpersDeps = {
      extensionContext: this._extensionContext,
      configService: this._configService,
      logger: this._logger,
    };
  }

  public async copyThisFileAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await copyThisActiveFileAsContext(this._privateHelpersDeps, includeTechPrompt);
  }

  public async copyThisTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await copyThisTabGroupAsContext(this._privateHelpersDeps, includeTechPrompt);
  }

  public async copyAllOpenFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await copyAllOpenTabsAsContext(this._privateHelpersDeps, includeTechPrompt);
  }

  public async copyAllPinnedFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await copyAllPinnedTabsAsContext(this._privateHelpersDeps, includeTechPrompt);
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await copyPinnedTabsInActiveTabGroupAsContext(this._privateHelpersDeps, includeTechPrompt);
  }

  public async copySelectedExplorerItemsAsContext(
    args?: CopySelectedExplorerItemsArgs,
    includeTechPrompt: boolean = true
  ): Promise<void> {
    await copySelectedExplorerItemsAsContext(this._privateHelpersDeps, args, includeTechPrompt);
  }

  private readonly _privateHelpersDeps: EditorToLlmModulePrivateHelpersDependencies;
}

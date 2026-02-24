import * as vscode from 'vscode';

import { ConfigService } from '../../config';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { EditorToLlmModulePrivateHelpersDependencies } from './common.helpers';
import { EditorHelper } from './editor-helper';
import { CopySelectedExplorerItemsArgs, ExplorerHelper } from './explorer-helper';

export class IdeToLlmModule {
  private readonly _editorHelper: EditorHelper;
  private readonly _explorerHelper: ExplorerHelper;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {
    const privateHelpersDeps: EditorToLlmModulePrivateHelpersDependencies = {
      extensionContext: this._extensionContext,
      configService: this._configService,
      logger: this._logger,
    };

    this._editorHelper = new EditorHelper(privateHelpersDeps);
    this._explorerHelper = new ExplorerHelper(privateHelpersDeps);
  }

  public async copyThisFileAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await this._editorHelper.copyThisFileAsContext(includeTechPrompt);
  }

  public async copyThisTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await this._editorHelper.copyThisTabGroupAsContext(includeTechPrompt);
  }

  public async copyAllOpenFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await this._editorHelper.copyAllOpenFilesAsContext(includeTechPrompt);
  }

  public async copyAllPinnedFilesAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await this._editorHelper.copyAllPinnedFilesAsContext(includeTechPrompt);
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(includeTechPrompt: boolean = true): Promise<void> {
    await this._editorHelper.copyPinnedFilesInActiveTabGroupAsContext(includeTechPrompt);
  }

  public async copySelectedExplorerItemsAsContext(
    args?: CopySelectedExplorerItemsArgs,
    includeTechPrompt: boolean = true
  ): Promise<void> {
    await this._explorerHelper.copySelectedExplorerItemsAsContext(args, includeTechPrompt);
  }
}

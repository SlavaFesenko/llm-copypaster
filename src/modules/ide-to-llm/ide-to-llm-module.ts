import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
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

  public async copyThisFileAsContext(): Promise<void> {
    await this._editorHelper.copyThisFileAsContext();
  }

  public async copyThisTabGroupAsContext(): Promise<void> {
    await this._editorHelper.copyThisTabGroupAsContext();
  }

  public async copyAllOpenFilesAsContext(): Promise<void> {
    await this._editorHelper.copyAllOpenFilesAsContext();
  }

  public async copyAllPinnedFilesAsContext(): Promise<void> {
    await this._editorHelper.copyAllPinnedFilesAsContext();
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    await this._editorHelper.copyPinnedFilesInActiveTabGroupAsContext();
  }

  public async copySelectedExplorerItemsAsContext(args?: CopySelectedExplorerItemsArgs): Promise<void> {
    await this._explorerHelper.copySelectedExplorerItemsAsContext(args);
  }
}

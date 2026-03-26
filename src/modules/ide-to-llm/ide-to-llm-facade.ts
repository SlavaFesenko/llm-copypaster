import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { CopySelectedExplorerItemsArgs, IdeToLlmDeps } from './contracts';
import { EditorService } from './editor-service';
import { ExplorerService } from './explorer-service';

export class IdeToLlmFacade {
  private readonly _editorHelper: EditorService;
  private readonly _explorerHelper: ExplorerService;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger,
    private readonly _allowOutsideWorkspaceRead: boolean
  ) {
    const privateHelpersDeps: IdeToLlmDeps = {
      extensionContext: this._extensionContext,
      configService: this._configService,
      logger: this._logger,
    };

    this._editorHelper = new EditorService(privateHelpersDeps, this._allowOutsideWorkspaceRead);
    this._explorerHelper = new ExplorerService(privateHelpersDeps, this._allowOutsideWorkspaceRead);
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

  public async copyAllUnpinnedFilesAsContext(): Promise<void> {
    await this._editorHelper.copyAllUnpinnedFilesAsContext();
  }

  public async copyPinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    await this._editorHelper.copyPinnedFilesInActiveTabGroupAsContext();
  }

  public async copyUnpinnedFilesInActiveTabGroupAsContext(): Promise<void> {
    await this._editorHelper.copyUnpinnedFilesInActiveTabGroupAsContext();
  }

  public async copySelectedExplorerItemsAsContext(args?: CopySelectedExplorerItemsArgs): Promise<void> {
    await this._explorerHelper.copySelectedExplorerItemsAsContext(args);
  }
}

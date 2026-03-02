import * as vscode from 'vscode';

import { ConfigService } from '../../../config-service';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';
import { PromptWorkbenchView } from './prompt-workbench-view';
import { PromptWorkbenchBridge } from './prompt-workbench.types';

export async function tryOpenPromptWorkbench(): Promise<void> {
  try {
    await vscode.commands.executeCommand('llmCopypaster.promptWorkbench.focus');
    return;
  } catch (error) {
    await vscode.commands.executeCommand('workbench.view.explorer');
    try {
      await vscode.commands.executeCommand('llmCopypaster.promptWorkbench.focus');
    } catch (secondError) {
      void vscode.window.showWarningMessage(`Failed to open Prompt Workbench: ${String(secondError)}`);
    }
  }
}

export class PromptWorkbenchModule {
  public readonly promptWorkbenchBridge: PromptWorkbenchBridge;

  private readonly _viewProvider: PromptWorkbenchView;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {
    this._viewProvider = new PromptWorkbenchView(this._extensionContext, this._configService, this._logger);

    this.promptWorkbenchBridge = {
      onNewCopiedContext: args => {
        this._viewProvider.setLastCopiedContext(args);
      },
    };
  }

  public register(): void {
    const disposable = vscode.window.registerWebviewViewProvider(PromptWorkbenchView.ViewId, this._viewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    });

    this._extensionContext.subscriptions.push(disposable);
  }
}

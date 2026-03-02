import * as vscode from 'vscode';

import { ConfigService } from '../../config-service';
import { CollectedFileItem } from '../../types/files-payload';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { buildWorkbenchState, rebuildPromptAndState } from './prompt-workbench-prompt-builder';
import { PromptWorkbenchInboundMessage, PromptWorkbenchOutboundMessage } from './prompt-workbench.types';

export class PromptWorkbenchView implements vscode.WebviewViewProvider {
  public static readonly ViewId: string = 'llmCopypaster.promptWorkbench';

  private _view: vscode.WebviewView | null = null;
  private _lastCopiedContext: {
    includeTechPrompt: boolean;
    fileItems: CollectedFileItem[];
    commandName: string;
  } | null = null;

  private _selectedProfileId: string | null = null;
  private _isInstructionsErased: boolean = false;
  private _isCodeListingsErased: boolean = false;

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _configService: ConfigService,
    private readonly _logger: OutputChannelLogger
  ) {}

  public setLastCopiedContext(args: {
    includeTechPrompt: boolean;
    fileItems: CollectedFileItem[];
    commandName: string;
  }): void {
    this._lastCopiedContext = args;

    void this._pushStateToWebview();
  }

  public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: PromptWorkbenchInboundMessage) => {
      await this._handleInboundMessage(message);
    });

    void this._pushStateToWebview();
  }

  private async _handleInboundMessage(message: PromptWorkbenchInboundMessage): Promise<void> {
    if (message.type === 'ready') {
      await this._pushStateToWebview();
      return;
    }

    if (message.type === 'selectProfile') {
      this._selectedProfileId = message.selectedProfileId;
      await this._pushStateToWebview();
      return;
    }

    if (message.type === 'toggleEraseInstructions') {
      this._isInstructionsErased = !this._isInstructionsErased;
      await this._copyAndRefresh();
      return;
    }

    if (message.type === 'toggleEraseCodeListings') {
      this._isCodeListingsErased = !this._isCodeListingsErased;
      await this._copyAndRefresh();
      return;
    }

    if (message.type === 'copyToClipboard') {
      await this._copyAndRefresh();
      return;
    }

    if (message.type === 'showFullPrompt') {
      await this._showFullPrompt();
      return;
    }
  }

  private async _copyAndRefresh(): Promise<void> {
    const config = await this._configService.getConfig();

    const rebuilt = await rebuildPromptAndState({
      extensionContext: this._extensionContext,
      config,
      lastCopiedContext: this._lastCopiedContext,
      selectedProfileId: this._selectedProfileId,
      isInstructionsErased: this._isInstructionsErased,
      isCodeListingsErased: this._isCodeListingsErased,
    });

    if (!rebuilt.promptText.trim()) {
      await this._postMessage({ type: 'error', message: 'Nothing to copy for selected mode' });
      await this._pushStateToWebview();
      return;
    }

    await vscode.env.clipboard.writeText(rebuilt.promptText);

    await this._postMessage({ type: 'state', state: rebuilt.state });
  }

  private async _showFullPrompt(): Promise<void> {
    const config = await this._configService.getConfig();

    const rebuilt = await rebuildPromptAndState({
      extensionContext: this._extensionContext,
      config,
      lastCopiedContext: this._lastCopiedContext,
      selectedProfileId: this._selectedProfileId,
      isInstructionsErased: this._isInstructionsErased,
      isCodeListingsErased: this._isCodeListingsErased,
    });

    if (!rebuilt.promptText.trim()) {
      await this._postMessage({ type: 'error', message: 'Nothing to show for selected mode' });
      return;
    }

    const doc = await vscode.workspace.openTextDocument({ content: rebuilt.promptText, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
  }

  private async _pushStateToWebview(): Promise<void> {
    if (!this._view) return;

    const config = await this._configService.getConfig();

    const state = await buildWorkbenchState({
      extensionContext: this._extensionContext,
      config,
      lastCopiedContext: this._lastCopiedContext,
      selectedProfileId: this._selectedProfileId,
      isInstructionsErased: this._isInstructionsErased,
      isCodeListingsErased: this._isCodeListingsErased,
    });

    await this._postMessage({ type: 'state', state });
  }

  private async _postMessage(message: PromptWorkbenchOutboundMessage): Promise<void> {
    if (!this._view) return;

    try {
      await this._view.webview.postMessage(message);
    } catch (error) {
      this._logger.debug(`PromptWorkbench postMessage failed: ${String(error)}`);
    }
  }

  private _buildHtml(webview: vscode.Webview): string {
    const nonce = this._createNonce();

    return `<!DOCTYPE html>


<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt Workbench</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 10px; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .col { display: flex; flex-direction: column; gap: 8px; }
    select, button, input { font-family: inherit; }
    select { width: 100%; }
    .muted { opacity: 0.8; }
    .error { color: var(--vscode-errorForeground); }
    .box { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px; }
    .outline-item { padding: 3px 0; border-bottom: 1px dashed rgba(127,127,127,0.25); }
    .outline-item:last-child { border-bottom: none; }
    .stats { font-variant-numeric: tabular-nums; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-border, transparent); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border, transparent); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
    .btn-ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
    .btn-primary:disabled, .btn-secondary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    label { display: flex; gap: 6px; align-items: center; }
    hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 10px 0; }
  </style>
</head>
<body>
  <div class="col">
    <div class="row">
      <div style="flex: 1 1 auto;">
        <div class="muted">Profile</div>
        <select id="profileSelect"></select>
      </div>
    </div>


<div class="row">
  <label><input type="checkbox" id="eraseInstructionsToggle"> <span id="eraseInstructionsLabel">Erase instructions</span></label>
  <label><input type="checkbox" id="eraseCodeListingsToggle"> <span id="eraseCodeListingsLabel">Erase codelisting(s)</span></label>
</div>

<div class="row">
  <button class="btn-primary" id="copyButton">Copy</button>
  <button class="btn-secondary" id="showFullPromptButton">Show full prompt</button>
</div>

<div id="errorBox" class="error" style="display:none;"></div>

<hr />

<div class="box">
  <div class="muted" id="contextTitle">Outline</div>
  <div id="outlineBox"></div>
</div>

<div class="box stats" id="statsBox" style="display:none;"></div>


  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const profileSelect = document.getElementById('profileSelect');
    const eraseInstructionsToggle = document.getElementById('eraseInstructionsToggle');
    const eraseCodeListingsToggle = document.getElementById('eraseCodeListingsToggle');
    const eraseInstructionsLabel = document.getElementById('eraseInstructionsLabel');
    const eraseCodeListingsLabel = document.getElementById('eraseCodeListingsLabel');
    const copyButton = document.getElementById('copyButton');
    const showFullPromptButton = document.getElementById('showFullPromptButton');
    const outlineBox = document.getElementById('outlineBox');
    const statsBox = document.getElementById('statsBox');
    const errorBox = document.getElementById('errorBox');
    const contextTitle = document.getElementById('contextTitle');

    function post(message) { vscode.postMessage(message); }

    function renderState(state) {
      errorBox.style.display = 'none';
      errorBox.textContent = '';

      profileSelect.innerHTML = '';
      for (const p of state.profiles) {
        const option = document.createElement('option');
        option.value = p.id === null ? '' : p.id;
        option.textContent = p.id === null ? 'Default profile' : p.id;
        profileSelect.appendChild(option);
      }
      profileSelect.value = state.selectedProfileId ?? '';

      eraseInstructionsToggle.checked = state.isInstructionsErased;
      eraseCodeListingsToggle.checked = state.isCodeListingsErased;

      eraseInstructionsToggle.disabled = !state.canEraseInstructions;
      eraseCodeListingsToggle.disabled = !state.canEraseCodeListings;

      eraseInstructionsLabel.textContent = state.isInstructionsErased ? 'Restore instructions' : 'Erase instructions';
      eraseCodeListingsLabel.textContent = state.isCodeListingsErased ? 'Restore codelisting(s)' : 'Erase codelisting(s)';

      copyButton.disabled = state.isEmpty;

      showFullPromptButton.disabled = state.isEmpty;

      contextTitle.textContent = state.isEmpty ? 'Outline (no copied context yet)' : ('Outline' + (state.lastCommandName ? ' — ' + state.lastCommandName : ''));

      outlineBox.innerHTML = '';

      const instructionSections = state.outline.instructionSections || [];
      const filePaths = state.outline.filePaths || [];

      if (instructionSections.length === 0 && filePaths.length === 0) {
        const div = document.createElement('div');
        div.className = 'muted';
        div.textContent = state.isEmpty ? 'Run any Copy command to populate Workbench' : 'No sections in this mode';
        outlineBox.appendChild(div);
      }

      for (const section of instructionSections) {
        const div = document.createElement('div');
        div.className = 'outline-item';
        div.textContent = section;
        outlineBox.appendChild(div);
      }

      for (const fp of filePaths) {
        const div = document.createElement('div');
        div.className = 'outline-item';
        div.textContent = fp;
        outlineBox.appendChild(div);
      }

      if (state.stats) {
        statsBox.style.display = '';
        const exceeded = state.stats.isExceeded ? ' ⚠️ exceeded' : '';
        statsBox.textContent = 'Lines: ~' + state.stats.linesCount + '/' + state.stats.maxLinesCountInContext + ' | Tokens: ~' + state.stats.approxTokensCount + '/' + state.stats.maxTokensCountInContext + exceeded;
      } else {
        statsBox.style.display = 'none';
        statsBox.textContent = '';
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'state') {
        renderState(msg.state);
        return;
      }

      if (msg.type === 'error') {
        errorBox.style.display = '';
        errorBox.textContent = msg.message;
        return;
      }
    });

    profileSelect.addEventListener('change', () => {
      const selectedProfileId = profileSelect.value ? profileSelect.value : null;
      post({ type: 'selectProfile', selectedProfileId });
    });

    eraseInstructionsToggle.addEventListener('change', () => {
      post({ type: 'toggleEraseInstructions' });
    });

    eraseCodeListingsToggle.addEventListener('change', () => {
      post({ type: 'toggleEraseCodeListings' });
    });

    copyButton.addEventListener('click', () => post({ type: 'copyToClipboard' }));

    showFullPromptButton.addEventListener('click', () => post({ type: 'showFullPrompt' }));

    post({ type: 'ready' });
  </script>

</body>
</html>`;
  }

  private _createNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';

    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }
}

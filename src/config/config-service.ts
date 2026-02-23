import * as vscode from 'vscode';

import { OutputChannelLogger } from '../utils/output-channel-logger';
import { LlmCopypasterConfig, buildDefaultConfig, mergeConfigs } from './llm-copypaster-config';
import { readWorkspaceJsonConfigFile } from './workspace-config-file';

export class ConfigService {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const defaultConfig = buildDefaultConfig();

    const settingsConfig = this._readSettingsConfig(defaultConfig);
    const fileConfig = await readWorkspaceJsonConfigFile(this._logger);

    return mergeConfigs(defaultConfig, settingsConfig, fileConfig);
  }

  private _readSettingsConfig(defaultConfig: LlmCopypasterConfig): Partial<LlmCopypasterConfig> {
    const configuration = vscode.workspace.getConfiguration('llmCopypaster');

    const currentLlm = configuration.get<string>('currentLLM', defaultConfig.currentLLM);
    const autoFormatAfterApply = configuration.get<boolean>('autoFormatAfterApply', defaultConfig.autoFormatAfterApply);
    const enableAdvancedCloseFeature = configuration.get<boolean>(
      'EnableAdvancedCloseFeature',
      defaultConfig.EnableAdvancedCloseFeature
    );

    return { currentLLM: currentLlm, autoFormatAfterApply, EnableAdvancedCloseFeature: enableAdvancedCloseFeature };
  }
}

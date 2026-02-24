import * as vscode from 'vscode';

import { OutputChannelLogger } from './utils/output-channel-logger';

export interface LlmCopypasterPromptsConfig {
  default: string;
  overrides: Record<string, string>;
}

export interface LlmCopypasterSanitizationRule {
  id: string;
  pattern: string;
  replaceWith: string;
  disabledForLanguages?: string[];
  disabledForPaths?: string[];
}

export interface LlmContextLimits {
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export type LlmContextLimitsByLlm = Record<string, LlmContextLimits>;

export interface LlmCopypasterConfig {
  currentLLM: string;
  prompts: LlmCopypasterPromptsConfig;
  sanitizationRules: LlmCopypasterSanitizationRule[];
  autoFormatAfterApply: boolean;
  includeTechPrompt: boolean;
  llmContextLimitsByLlm: LlmContextLimitsByLlm;
  showPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
}

export function buildDefaultConfig(): LlmCopypasterConfig {
  return {
    currentLLM: 'default',
    prompts: {
      default: '',
      overrides: {},
    },
    sanitizationRules: [
      {
        id: 'strip-codefence',
        pattern: '`{3}[^\r\n]*', // Matches a triple-backtick fence marker with an optional language tag on the same line (does not consume the newline)
        replaceWith: '',
        disabledForLanguages: ['markdown'],
        disabledForPaths: ['docs/'],
      },
    ],
    autoFormatAfterApply: false,
    includeTechPrompt: true,
    llmContextLimitsByLlm: {
      default: {
        maxLinesCountInContext: 1000,
        maxTokensCountInContext: 15000,
      },
    },
    showPromptSizeStatsInCopyNotification: true,
    promptSizeApproxCharsPerToken: 4,
  };
}

export function mergeConfigs(
  defaultConfig: LlmCopypasterConfig,
  settingsConfig: Partial<LlmCopypasterConfig>,
  fileConfig: Partial<LlmCopypasterConfig> | null
): LlmCopypasterConfig {
  const mergedLlmContextLimitsByLlm: LlmContextLimitsByLlm = {
    ...(defaultConfig.llmContextLimitsByLlm ?? {}),
    ...((settingsConfig.llmContextLimitsByLlm ?? {}) as LlmContextLimitsByLlm),
    ...(((fileConfig?.llmContextLimitsByLlm ?? {}) as LlmContextLimitsByLlm) ?? {}),
  };

  const mergedConfig: LlmCopypasterConfig = {
    ...defaultConfig,
    ...settingsConfig,
    prompts: {
      ...defaultConfig.prompts,
      ...(settingsConfig.prompts ?? {}),
      ...(fileConfig?.prompts ?? {}),
    },
    sanitizationRules: fileConfig?.sanitizationRules ?? settingsConfig.sanitizationRules ?? defaultConfig.sanitizationRules,
    autoFormatAfterApply:
      fileConfig?.autoFormatAfterApply ?? settingsConfig.autoFormatAfterApply ?? defaultConfig.autoFormatAfterApply,
    includeTechPrompt: fileConfig?.includeTechPrompt ?? settingsConfig.includeTechPrompt ?? defaultConfig.includeTechPrompt,
    currentLLM: fileConfig?.currentLLM ?? settingsConfig.currentLLM ?? defaultConfig.currentLLM,
    llmContextLimitsByLlm: mergedLlmContextLimitsByLlm,
    showPromptSizeStatsInCopyNotification:
      fileConfig?.showPromptSizeStatsInCopyNotification ??
      settingsConfig.showPromptSizeStatsInCopyNotification ??
      defaultConfig.showPromptSizeStatsInCopyNotification,
    promptSizeApproxCharsPerToken:
      fileConfig?.promptSizeApproxCharsPerToken ??
      settingsConfig.promptSizeApproxCharsPerToken ??
      defaultConfig.promptSizeApproxCharsPerToken,
  };

  return mergedConfig;
}

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

    return { currentLLM: currentLlm, autoFormatAfterApply };
  }
}

const workspaceConfigFileName = '.llm-copypaster.json';

export async function readWorkspaceJsonConfigFile(
  logger: OutputChannelLogger
): Promise<Partial<LlmCopypasterConfig> | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return null;
  }

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceConfigFileName);

  try {
    const bytes = await vscode.workspace.fs.readFile(configUri);
    const jsonText = Buffer.from(bytes).toString('utf8');
    const parsed = JSON.parse(jsonText) as Partial<LlmCopypasterConfig>;

    return parsed;
  } catch (error) {
    logger.debug(`Workspace config not loaded: ${String(error)}`);
    return null;
  }
}

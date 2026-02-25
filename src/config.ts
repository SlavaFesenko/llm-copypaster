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

export interface PostFilesPatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
}

export interface LlmCopypasterConfig {
  currentLLM: string;
  prompts: LlmCopypasterPromptsConfig;
  sanitizationRules: LlmCopypasterSanitizationRule[];
  autoFormatAfterApply: boolean;
  includeTechPrompt: boolean;
  llmContextLimitsByLlm: LlmContextLimitsByLlm;
  showPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
  postFilesPatchActions: PostFilesPatchActionsConfig;
  headerRegex: string;
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
        maxLinesCountInContext: 1000, // personal observation, after this limit LLM degrades
        maxTokensCountInContext: 12000, // personal observation, after this limit LLM degrades
      },
    },
    showPromptSizeStatsInCopyNotification: true,
    promptSizeApproxCharsPerToken: 3.5, // for code with long var names 3 is more accurate, but not to spam with warning picked 3.5
    postFilesPatchActions: {
      enableSaveAfterFilePatch: true,
      enableLintingAfterFilePatch: false, // if settings have "editor.formatOnSave": true, no need to do it again
    },
    headerRegex: '^#\s+(.+)\s*$', // catches format like: # path/filename
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

  const mergedPostFilesPatchActions: PostFilesPatchActionsConfig = {
    ...(defaultConfig.postFilesPatchActions ?? {
      enableLintingAfterFilePatch: defaultConfig.autoFormatAfterApply,
      enableSaveAfterFilePatch: false,
    }),
    ...(settingsConfig.postFilesPatchActions ?? {}),
    ...((fileConfig?.postFilesPatchActions ?? {}) as PostFilesPatchActionsConfig),
  };

  if (mergedPostFilesPatchActions.enableLintingAfterFilePatch === undefined)
    mergedPostFilesPatchActions.enableLintingAfterFilePatch =
      fileConfig?.autoFormatAfterApply ?? settingsConfig.autoFormatAfterApply ?? defaultConfig.autoFormatAfterApply;

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
    postFilesPatchActions: mergedPostFilesPatchActions,
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
    const postFilesPatchAutoFormatAfterApply = configuration.get<boolean>(
      'postFilesPatchActions.autoFormatAfterApply',
      defaultConfig.postFilesPatchActions.enableLintingAfterFilePatch
    );
    const postFilesPatchAutoSaveAfterApply = configuration.get<boolean>(
      'postFilesPatchActions.autoSaveAfterApply',
      defaultConfig.postFilesPatchActions.enableSaveAfterFilePatch
    );

    return {
      currentLLM: currentLlm,
      autoFormatAfterApply,
      postFilesPatchActions: {
        enableLintingAfterFilePatch: postFilesPatchAutoFormatAfterApply ?? autoFormatAfterApply,
        enableSaveAfterFilePatch: postFilesPatchAutoSaveAfterApply,
      },
    };
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

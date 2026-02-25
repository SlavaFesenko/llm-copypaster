import * as vscode from 'vscode';

import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptsConfig {
  default: string;
  overrides: Record<string, string>;
}

export interface TechPromptBuilderDetails {
  id: string;
  builderHandlerId: string;
  promptConcatenationEnabled: boolean;
  relativePathToPrompt: string;
}

export interface TechPromptConfig {
  techPromptDelimiter: string;
  placeholderRegexPattern: string;
  builders: TechPromptBuilderDetails[];
}

export interface SanitizationRule {
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
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface LlmCopypasterConfig {
  currentLLM: string;
  sanitizationRules: SanitizationRule[];
  includeTechPrompt: boolean;
  llmContextLimitsByLlm: LlmContextLimitsByLlm;
  showPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
  postFilesPatchActions: PostFilesPatchActionsConfig;
  codeListingHeaderRegex: string;
  codeListingHeaderStartFragment: string;
  techPrompt: TechPromptConfig;
}

export function buildDefaultConfig(): LlmCopypasterConfig {
  return {
    currentLLM: 'default',
    sanitizationRules: [
      {
        id: 'strip-codefence',
        pattern: '`{3}[^\r\n]*', // Matches a triple-backtick fence marker with an optional language tag on the same line (does not consume the newline)
        replaceWith: '',
        disabledForLanguages: ['markdown'],
        disabledForPaths: ['docs/'],
      },
    ],
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
      enableOpeningPatchedFilesInEditor: true,
    },
    codeListingHeaderRegex: String.raw`^#\s+(.+)\s*$`, // catches format like: # path/filename
    codeListingHeaderStartFragment: '# ',
    techPrompt: {
      techPromptDelimiter: '--' + '-', // avoid a literal '---' in source (it can be treated as a special delimiter by some parsers/linters);
      placeholderRegexPattern: String.raw`{{([a-zA-Z0-9*]+)}}`, // {{placeholder}}
      builders: [
        {
          id: 'llm-response-rules',
          builderHandlerId: 'llmResponseRules',
          promptConcatenationEnabled: true,
          relativePathToPrompt: 'prompts/llm-response-rules-prompt.md',
        },
        {
          id: 'web-git-prompt',
          builderHandlerId: 'webGitPrompt',
          promptConcatenationEnabled: true,
          relativePathToPrompt: 'prompts/web-git-prompt.md',
        },
      ],
    },
  };
}

export class ConfigService {
  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: OutputChannelLogger
  ) {}

  public async getConfig(): Promise<LlmCopypasterConfig> {
    const defaultConfig = buildDefaultConfig();

    // settingsConfig and fileConfig are not read for now, just for a structure
    const settingsConfig = this._readSettingsConfig(defaultConfig);
    const fileConfig = await this._readWorkspaceJsonConfigFile(this._logger);

    const mergedConfig = this._mergeConfigs(defaultConfig, settingsConfig, fileConfig);

    this._notifyIfInvalidCodeListingHeaderConfig(mergedConfig);

    return mergedConfig;
  }

  private _notifyIfInvalidCodeListingHeaderConfig(config: LlmCopypasterConfig): void {
    const exampleHeaderLine = `${config.codeListingHeaderStartFragment}path/filename`;

    let headerRegex: RegExp;

    try {
      headerRegex = new RegExp(config.codeListingHeaderRegex);
    } catch (error) {
      vscode.window.showErrorMessage(`Invalid "codeListingHeaderRegex" in config: ${String(error)}`);
      return;
    }

    if (headerRegex.test(exampleHeaderLine)) return;

    vscode.window.showErrorMessage(
      `Invalid listing header config: "${exampleHeaderLine}" does not match codeListingHeaderRegex`
    );
  }

  private _mergeConfigs(
    defaultConfig: LlmCopypasterConfig,
    settingsConfig: Partial<LlmCopypasterConfig>,
    fileConfig: Partial<LlmCopypasterConfig> | null
  ): LlmCopypasterConfig {
    return defaultConfig; // for now it's fine, we don't work with configs yet
  }

  private _readSettingsConfig(defaultConfig: LlmCopypasterConfig): Partial<LlmCopypasterConfig> {
    return defaultConfig; // for now it's fine, we don't work with configs yet
  }

  private async _readWorkspaceJsonConfigFile(logger: OutputChannelLogger): Promise<Partial<LlmCopypasterConfig> | null> {
    const workspaceConfigFileName = '.llm-copypaster.json';

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
}

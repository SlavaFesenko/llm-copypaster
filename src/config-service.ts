import { LlmCopypasterUserConfig } from './contracts/user-config';
import { mergeConfigs } from './utils/config-helpers/config-mergers';
import { readSystemJsonConfigFile, readUserJsonConfigFile } from './utils/config-helpers/config-tech-helpers';
import { OutputChannelLogger } from './utils/output-channel-logger';

export interface PromptInstructionsConfig {
  relativePathToSubInstruction: string;
  ignore: boolean;
}

export interface VitalParsingAnchorsConfig {
  techPromptDelimiter: string;
  codeListingHeaderStartFragment: string;
  fileStatusPrefix: string;
  placeholderStartFragment: string;
  placeholderEndFragment: string;
  filePayloadOperationTypeEditedFull: string;
  filePayloadOperationTypeCreated: string;
  filePayloadOperationTypeDeleted: string;
  configVariablePrefix: string;
}

export interface PromptInstructionConfig {
  sharedVariablesById: Record<string, string>;
  subInstructionsById: Record<string, PromptInstructionsConfig>;
}

export interface LlmToIdeSanitizationRuleConfig {
  pattern: string;
  replaceWith: string;
  disabledForLanguages: string[];
  disabledForPaths: string[];
}

export interface IdeToLlmContextConfig {
  skipPromptSizeStatsInCopyNotification: boolean;
  promptSizeApproxCharsPerToken: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export interface LlmToIdeContextConfig {
  promptSizeApproxCharsPerToken: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
}

export interface PostFilePatchActionsConfig {
  enableSaveAfterFilePatch: boolean;
  enableLintingAfterFilePatch: boolean;
  enableOpeningPatchedFilesInEditor: boolean;
}

export interface CoreSettingsConfig {
  skipInstructions: boolean;
  skipCodeListings: boolean;
  ideToLlmContextConfig: IdeToLlmContextConfig;
  llmToIdeContextConfig: LlmToIdeContextConfig;
  postFilePatchActionsConfig: PostFilePatchActionsConfig;
  promptInstructionConfig: PromptInstructionConfig;
  llmToIdeSanitizationRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export interface OverrideConfig {
  description?: string;
  version?: string;
  shouldBeSkipped: boolean;
  coreSettings: CoreSettingsConfig;
}

export interface LlmCopypasterPublicConfig {
  vitalParsingAnchors: VitalParsingAnchorsConfig;
  coreSettings: CoreSettingsConfig;
}

export interface LlmCopypasterInternalConfig extends LlmCopypasterPublicConfig {
  overridesById?: Record<string, OverrideConfig>;
}

export interface OverrideOptionMetadata {
  id: string;
  description?: string;
  version?: string;
}

export class ConfigService {
  public constructor(private readonly _logger: OutputChannelLogger) {}

  public get overrideOptions(): OverrideOptionMetadata[] {
    return this._overrideOptions;
  }

  private _systemConfig?: LlmCopypasterInternalConfig;
  private _llmCopypasterConfig?: LlmCopypasterInternalConfig;
  private _overrideOptions: OverrideOptionMetadata[] = [];

  public async getSystemConfig(): Promise<LlmCopypasterInternalConfig> {
    if (this._systemConfig) return this._systemConfig;

    this._systemConfig = await readSystemJsonConfigFile<LlmCopypasterInternalConfig>();

    return this._systemConfig;
  }

  public async getCoreSettingsConfig(overrideId?: string): Promise<CoreSettingsConfig> {
    const llmCopypasterConfig = await this._getLlmCopypasterConfig();

    if (!overrideId) return llmCopypasterConfig.coreSettings;

    return llmCopypasterConfig.overridesById?.[overrideId]?.coreSettings ?? llmCopypasterConfig.coreSettings;
  }

  public async getVitalParsingAnchorsConfig(): Promise<VitalParsingAnchorsConfig> {
    const llmCopypasterConfig = await this._getLlmCopypasterConfig();

    return llmCopypasterConfig.vitalParsingAnchors;
  }

  public async getLlmCopypasterPublicConfig(overrideId?: string): Promise<LlmCopypasterPublicConfig> {
    const coreSettings = await this.getCoreSettingsConfig(overrideId);
    const vitalParsingAnchors = await this.getVitalParsingAnchorsConfig();

    return {
      coreSettings,
      vitalParsingAnchors,
    };
  }

  private async _getLlmCopypasterConfig(): Promise<LlmCopypasterInternalConfig> {
    if (this._llmCopypasterConfig) return this._llmCopypasterConfig;

    this._llmCopypasterConfig = await this._buildLlmCopypasterConfig();
    this._setOverrideOptions(this._llmCopypasterConfig);

    return this._llmCopypasterConfig;
  }

  private async _buildLlmCopypasterConfig(): Promise<LlmCopypasterInternalConfig> {
    const systemConfig = await this.getSystemConfig();
    const userFileConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>();

    return mergeConfigs(systemConfig, userFileConfig);
  }

  private _setOverrideOptions(llmCopypasterConfig: LlmCopypasterInternalConfig): void {
    this._overrideOptions = [];

    const overridesById = llmCopypasterConfig.overridesById ?? {};

    for (const overrideId of Object.keys(overridesById)) {
      const overrideConfig = overridesById[overrideId];

      if (overrideConfig.shouldBeSkipped) continue;

      this._overrideOptions.push({
        id: overrideId,
        description: overrideConfig.description,
        version: overrideConfig.version,
      });
    }
  }
}

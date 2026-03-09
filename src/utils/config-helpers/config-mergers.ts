import {
  CoreSettingsConfig,
  IdeToLlmContextConfig,
  LlmCopypasterInternalConfig,
  LlmToIdeContextConfig,
  LlmToIdeSanitizationRuleConfig,
  OverrideConfig,
  PostFilePatchActionsConfig,
  PromptInstructionConfig,
  PromptInstructionsConfig,
  VitalParsingAnchorsConfig,
} from '../../config-service';
import {
  CoreSettingsUserConfig,
  IdeToLlmContextUserConfig,
  LlmCopypasterUserConfig,
  LlmToIdeContextUserConfig,
  LlmToIdeSanitizationRuleUserConfig,
  OverrideUserConfig,
  PostFilePatchActionsUserConfig,
  PromptInstructionsUserConfig,
  PromptInstructionUserConfig,
  VitalParsingAnchorsUserConfig,
} from '../../contracts/user-config';

export interface MergeConfigsOptions {
  normalizeOverrides?: boolean;
}

export function mergeConfigs(
  systemConfig: LlmCopypasterInternalConfig,
  userConfig: LlmCopypasterUserConfig | null,
  options?: MergeConfigsOptions
): LlmCopypasterInternalConfig {
  if (!userConfig) {
    if (options?.normalizeOverrides === false) return systemConfig;

    return normalizeInternalConfig(systemConfig);
  }

  return applyUserConfig(systemConfig, userConfig, options);
}

export function applyUserConfig(
  systemConfig: LlmCopypasterInternalConfig,
  userConfig: LlmCopypasterUserConfig,
  options?: MergeConfigsOptions
): LlmCopypasterInternalConfig {
  const mergedCoreSettings = mergeCoreSettingsConfig(systemConfig.coreSettings, userConfig.coreSettings);
  const mergedProfilesById = mergeProfilesById(systemConfig.overridesById, userConfig, mergedCoreSettings);

  const nextConfig: LlmCopypasterInternalConfig = {
    vitalParsingAnchors: mergeLlmToIdeParsingAnchors(systemConfig.vitalParsingAnchors, userConfig.vitalParsingAnchors),
    coreSettings: mergedCoreSettings,
    ...(mergedProfilesById ? { overridesById: mergedProfilesById } : {}),
  };

  if (options?.normalizeOverrides === false) return nextConfig;

  return normalizeInternalConfig(nextConfig);
}

export function normalizeInternalConfig(config: LlmCopypasterInternalConfig): LlmCopypasterInternalConfig {
  const normalizedOverridesById = normalizeProfilesById(config.overridesById, config.coreSettings);

  return {
    vitalParsingAnchors: config.vitalParsingAnchors,
    coreSettings: config.coreSettings,
    ...(normalizedOverridesById ? { overridesById: normalizedOverridesById } : {}),
  };
}

export function normalizeProfilesById(
  profilesById: Record<string, OverrideConfig> | undefined,
  baseCoreSettings: CoreSettingsConfig
): Record<string, OverrideConfig> | undefined {
  if (!profilesById) return profilesById;

  const normalizedProfilesById: Record<string, OverrideConfig> = {};

  for (const profileId of Object.keys(profilesById)) {
    const profileConfig = profilesById[profileId];

    normalizedProfilesById[profileId] = {
      ...profileConfig,
      coreSettings: mergeCoreSettingsConfig(baseCoreSettings, profileConfig.coreSettings),
    };
  }

  return normalizedProfilesById;
}

export function mergeLlmToIdeParsingAnchors(
  baseAnchors: VitalParsingAnchorsConfig,
  userAnchors?: VitalParsingAnchorsUserConfig
): VitalParsingAnchorsConfig {
  if (!userAnchors) return baseAnchors;

  return {
    techPromptDelimiter: userAnchors.techPromptDelimiter ?? baseAnchors.techPromptDelimiter,
    codeListingHeaderStartFragment: userAnchors.codeListingHeaderStartFragment ?? baseAnchors.codeListingHeaderStartFragment,
    fileStatusPrefix: userAnchors.fileStatusPrefix ?? baseAnchors.fileStatusPrefix,
    placeholderStartFragment: userAnchors.placeholderStartFragment ?? baseAnchors.placeholderStartFragment,
    placeholderEndFragment: userAnchors.placeholderEndFragment ?? baseAnchors.placeholderEndFragment,
    filePayloadOperationTypeEditedFull:
      userAnchors.filePayloadOperationTypeEditedFull ?? baseAnchors.filePayloadOperationTypeEditedFull,
    filePayloadOperationTypeCreated:
      userAnchors.filePayloadOperationTypeCreated ?? baseAnchors.filePayloadOperationTypeCreated,
    filePayloadOperationTypeDeleted:
      userAnchors.filePayloadOperationTypeDeleted ?? baseAnchors.filePayloadOperationTypeDeleted,
    configVariablePrefix: userAnchors.configVariablePrefix ?? baseAnchors.configVariablePrefix,
  };
}

export function mergeCoreSettingsConfig(
  baseSettings: CoreSettingsConfig,
  userSettings: CoreSettingsUserConfig | undefined
): CoreSettingsConfig {
  if (!userSettings) return baseSettings;

  return {
    skipInstructions: userSettings.skipInstructions ?? baseSettings.skipInstructions,
    skipCodeListings: userSettings.skipCodeListings ?? baseSettings.skipCodeListings,
    ideToLlmContextConfig: mergeIdeToLlmContextConfig(
      baseSettings.ideToLlmContextConfig,
      userSettings.ideToLlmContextConfig
    ),
    llmToIdeContextConfig: mergeLlmToIdeContextConfig(
      baseSettings.llmToIdeContextConfig,
      userSettings.llmToIdeContextConfig
    ),
    postFilePatchActionsConfig: mergePostFilePatchActionsConfig(
      baseSettings.postFilePatchActionsConfig,
      userSettings.postFilePatchActionsConfig
    ),
    promptInstructionConfig: mergePromptInstructionConfig(
      baseSettings.promptInstructionConfig,
      userSettings.promptInstructionConfig
    ),
    llmToIdeSanitizationRulesById: mergeLlmToIdeSanitizationRulesById(
      baseSettings.llmToIdeSanitizationRulesById,
      userSettings
    ),
  };
}

export function mergeIdeToLlmContextConfig(
  baseConfig: IdeToLlmContextConfig,
  userConfig: IdeToLlmContextUserConfig | undefined
): IdeToLlmContextConfig {
  if (!userConfig) return baseConfig;

  return {
    skipPromptSizeStatsInCopyNotification:
      userConfig.skipPromptSizeStatsInCopyNotification ?? baseConfig.skipPromptSizeStatsInCopyNotification,
    promptSizeApproxCharsPerToken: userConfig.promptSizeApproxCharsPerToken ?? baseConfig.promptSizeApproxCharsPerToken,
    maxLinesCountInContext: userConfig.maxLinesCountInContext ?? baseConfig.maxLinesCountInContext,
    maxTokensCountInContext: userConfig.maxTokensCountInContext ?? baseConfig.maxTokensCountInContext,
  };
}

export function mergeLlmToIdeContextConfig(
  baseConfig: LlmToIdeContextConfig,
  userConfig: LlmToIdeContextUserConfig | undefined
): LlmToIdeContextConfig {
  if (!userConfig) return baseConfig;

  return {
    promptSizeApproxCharsPerToken: userConfig.promptSizeApproxCharsPerToken ?? baseConfig.promptSizeApproxCharsPerToken,
    maxLinesCountInContext: userConfig.maxLinesCountInContext ?? baseConfig.maxLinesCountInContext,
    maxTokensCountInContext: userConfig.maxTokensCountInContext ?? baseConfig.maxTokensCountInContext,
  };
}

export function mergePostFilePatchActionsConfig(
  baseConfig: PostFilePatchActionsConfig,
  userConfig: PostFilePatchActionsUserConfig | undefined
): PostFilePatchActionsConfig {
  if (!userConfig) return baseConfig;

  return {
    enableSaveAfterFilePatch: userConfig.enableSaveAfterFilePatch ?? baseConfig.enableSaveAfterFilePatch,
    enableLintingAfterFilePatch: userConfig.enableLintingAfterFilePatch ?? baseConfig.enableLintingAfterFilePatch,
    enableOpeningPatchedFilesInEditor:
      userConfig.enableOpeningPatchedFilesInEditor ?? baseConfig.enableOpeningPatchedFilesInEditor,
  };
}

export function mergePromptInstructionConfig(
  baseConfig: PromptInstructionConfig,
  userConfig: PromptInstructionUserConfig | undefined
): PromptInstructionConfig {
  if (!userConfig) return baseConfig;

  const baseSharedVariablesById = baseConfig.sharedVariablesById;
  const baseSubInstructionsById = baseConfig.subInstructionsById;

  const nextSharedVariablesById = { ...baseSharedVariablesById, ...(userConfig.sharedVariablesById ?? {}) };
  const nextSubInstructionsById = mapSubInstructionsById(baseSubInstructionsById, userConfig.subInstructionsById ?? {});

  return {
    sharedVariablesById: nextSharedVariablesById,
    subInstructionsById: nextSubInstructionsById,
  };
}

export function mapSubInstructionsById(
  baseSubInstructionsById: Record<string, PromptInstructionsConfig>,
  userSubInstructionsById: Record<string, PromptInstructionsUserConfig>
): Record<string, PromptInstructionsConfig> {
  const nextSubInstructionsById: Record<string, PromptInstructionsConfig> = { ...baseSubInstructionsById };

  for (const subInstructionId of Object.keys(userSubInstructionsById)) {
    const baseSubInstruction = baseSubInstructionsById[subInstructionId];
    const userSubInstruction = userSubInstructionsById[subInstructionId];

    if (!baseSubInstruction) {
      if (!userSubInstruction.relativePathToSubInstruction || userSubInstruction.ignore === undefined) continue;

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction: userSubInstruction.relativePathToSubInstruction,
        ignore: userSubInstruction.ignore,
      };

      continue;
    }

    nextSubInstructionsById[subInstructionId] = {
      relativePathToSubInstruction:
        userSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
      ignore: userSubInstruction.ignore ?? baseSubInstruction.ignore,
    };
  }

  return nextSubInstructionsById;
}

export function mergeLlmToIdeSanitizationRulesById(
  baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
  userSettings: CoreSettingsUserConfig
): Record<string, LlmToIdeSanitizationRuleConfig> {
  const userRulesById = userSettings.llmToIdeSanitizationRulesById;
  if (!userRulesById) return baseRulesById;

  return mapLlmToIdeSanitizationRulesById(baseRulesById, userRulesById);
}

export function mapLlmToIdeSanitizationRulesById(
  baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
  userRulesById: Record<string, LlmToIdeSanitizationRuleUserConfig>
): Record<string, LlmToIdeSanitizationRuleConfig> {
  const nextRulesById: Record<string, LlmToIdeSanitizationRuleConfig> = { ...baseRulesById };

  for (const ruleId of Object.keys(userRulesById)) {
    const baseRule = baseRulesById[ruleId];
    const userRule = userRulesById[ruleId];

    if (!baseRule) {
      if (
        !userRule.pattern ||
        userRule.replaceWith === undefined ||
        !userRule.disabledForLanguages ||
        !userRule.disabledForPaths
      )
        continue;

      nextRulesById[ruleId] = {
        pattern: userRule.pattern,
        replaceWith: userRule.replaceWith,
        disabledForLanguages: userRule.disabledForLanguages,
        disabledForPaths: userRule.disabledForPaths,
      };

      continue;
    }

    nextRulesById[ruleId] = {
      pattern: userRule.pattern ?? baseRule.pattern,
      replaceWith: userRule.replaceWith ?? baseRule.replaceWith,
      disabledForLanguages: userRule.disabledForLanguages ?? baseRule.disabledForLanguages,
      disabledForPaths: userRule.disabledForPaths ?? baseRule.disabledForPaths,
    };
  }

  return nextRulesById;
}

export function mergeProfilesById(
  baseProfilesById: Record<string, OverrideConfig> | undefined,
  userConfig: LlmCopypasterUserConfig,
  baseCoreSettings: CoreSettingsConfig
): Record<string, OverrideConfig> | undefined {
  const userProfilesById = userConfig.overridesById;

  if (!userProfilesById) return baseProfilesById;

  return mapProfilesById(baseProfilesById ?? {}, userProfilesById, baseCoreSettings);
}

export function mapProfilesById(
  baseProfilesById: Record<string, OverrideConfig>,
  userProfilesById: Record<string, OverrideUserConfig>,
  baseCoreSettings: CoreSettingsConfig
): Record<string, OverrideConfig> {
  const nextProfilesById: Record<string, OverrideConfig> = { ...baseProfilesById };

  for (const profileId of Object.keys(userProfilesById)) {
    const baseProfile = baseProfilesById[profileId];
    const userProfile = userProfilesById[profileId];
    const baseProfileCoreSettings = baseProfile?.coreSettings ?? baseCoreSettings;

    if (!baseProfile) {
      nextProfilesById[profileId] = {
        description: userProfile.description,
        version: userProfile.version,
        shouldBeSkipped: userProfile.shouldBeSkipped ?? false,
        coreSettings: mergeCoreSettingsConfig(baseProfileCoreSettings, userProfile.coreSettings),
      };

      continue;
    }

    nextProfilesById[profileId] = {
      description: userProfile.description ?? baseProfile.description,
      version: userProfile.version ?? baseProfile.version ?? '',
      shouldBeSkipped: userProfile.shouldBeSkipped ?? baseProfile.shouldBeSkipped ?? false,
      coreSettings: mergeCoreSettingsConfig(baseProfileCoreSettings, userProfile.coreSettings),
    };
  }

  return nextProfilesById;
}

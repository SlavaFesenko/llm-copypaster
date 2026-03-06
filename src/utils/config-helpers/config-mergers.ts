import {
  CoreSettingsConfig,
  IdeToLlmContextConfig,
  LlmCopypasterConfig,
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
} from './user-config';

export function mergeConfigs(
  defaultConfig: LlmCopypasterConfig,
  userFileConfig: LlmCopypasterUserConfig | null,
  buildBaseSettingsFn: () => CoreSettingsConfig
): LlmCopypasterConfig {
  if (!userFileConfig) return defaultConfig;

  return applyUserConfig(defaultConfig, userFileConfig, buildBaseSettingsFn);
}

export function applyUserConfig(
  baseConfig: LlmCopypasterConfig,
  userConfig: LlmCopypasterUserConfig,
  buildBaseSettingsFn: () => CoreSettingsConfig
): LlmCopypasterConfig {
  const mergedProfilesById = mergeProfilesById(baseConfig.overridesById, userConfig, buildBaseSettingsFn);

  const nextConfig: LlmCopypasterConfig = {
    vitalParsingAnchors: mergeLlmToIdeParsingAnchors(baseConfig.vitalParsingAnchors, userConfig.vitalParsingAnchors),
    coreSettings: mergeProfileSettingsConfig(baseConfig.coreSettings, userConfig.coreSettings, buildBaseSettingsFn),
    ...(mergedProfilesById ? { overridesById: mergedProfilesById } : {}),
  };

  return nextConfig;
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

export function mergeProfileSettingsConfig(
  baseSettings: CoreSettingsConfig,
  userSettings: CoreSettingsUserConfig | undefined,
  buildBaseSettingsFn: () => CoreSettingsConfig
): CoreSettingsConfig {
  if (!userSettings) return baseSettings;

  const nextSettings: CoreSettingsConfig = {
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

  void buildBaseSettingsFn;

  return nextSettings;
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
    const isUserOverridingRelativePath = userSubInstruction.relativePathToSubInstruction !== undefined;

    if (!baseSubInstruction) {
      if (!userSubInstruction.relativePathToSubInstruction || userSubInstruction.ignore === undefined) continue;

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction: userSubInstruction.relativePathToSubInstruction,
        isSystemBundledFile: false,
        ignore: userSubInstruction.ignore,
      };

      continue;
    }

    if (baseSubInstruction.isSystemBundledFile && isUserOverridingRelativePath && userSubInstruction.ignore === true)
      continue;

    nextSubInstructionsById[subInstructionId] = {
      relativePathToSubInstruction:
        userSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
      isSystemBundledFile: isUserOverridingRelativePath ? false : baseSubInstruction.isSystemBundledFile,
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
  buildBaseSettingsFn: () => CoreSettingsConfig
): Record<string, OverrideConfig> | undefined {
  const userProfilesById = userConfig.overridesById;

  if (!userProfilesById) return baseProfilesById;

  return mapProfilesById(baseProfilesById ?? {}, userProfilesById, buildBaseSettingsFn);
}

export function mapProfilesById(
  baseProfilesById: Record<string, OverrideConfig>,
  userProfilesById: Record<string, OverrideUserConfig>,
  buildBaseSettingsFn: () => CoreSettingsConfig
): Record<string, OverrideConfig> {
  const nextProfilesById: Record<string, OverrideConfig> = { ...baseProfilesById };

  for (const profileId of Object.keys(userProfilesById)) {
    const baseProfile = baseProfilesById[profileId];
    const userProfile = userProfilesById[profileId];
    const baseProfileCoreSettings = baseProfile?.coreSettings ?? buildBaseSettingsFn();

    if (!baseProfile) {
      if (!userProfile.description || !userProfile.version) continue;

      nextProfilesById[profileId] = {
        description: userProfile.description,
        version: userProfile.version ?? '',
        coreSettings: userProfile.coreSettings
          ? mergeProfileSettingsConfig(baseProfileCoreSettings, userProfile.coreSettings, buildBaseSettingsFn)
          : baseProfileCoreSettings,
      };

      continue;
    }

    nextProfilesById[profileId] = {
      description: userProfile.description ?? baseProfile.description,
      version: userProfile.version ?? baseProfile.version ?? '',
      coreSettings: userProfile.coreSettings
        ? mergeProfileSettingsConfig(baseProfileCoreSettings, userProfile.coreSettings, buildBaseSettingsFn)
        : baseProfileCoreSettings,
    };
  }

  return nextProfilesById;
}

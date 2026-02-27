import type {
  IdeToLlmContextConfig,
  IdeToLlmContextUserConfig,
  LlmCopypasterConfig,
  LlmCopypasterUserConfig,
  LlmToIdeParsingAnchorsConfig,
  LlmToIdeParsingAnchorsUserConfig,
  LlmToIdeSanitizationRuleConfig,
  LlmToIdeSanitizationRuleUserConfig,
  PostFilePatchActionsConfig,
  PostFilePatchActionsUserConfig,
  ProfileConfig,
  ProfileSettingsConfig,
  ProfileSettingsUserConfig,
  ProfileUserConfig,
  PromptInstructionConfig,
  PromptInstructionUserConfig,
  PromptInstructionsConfig,
  PromptInstructionsUserConfig,
} from '../../config';

export function mergeConfigs(
  defaultConfig: LlmCopypasterConfig,
  userFileConfig: LlmCopypasterUserConfig | null,
  buildBaseSettingsFn: () => ProfileSettingsConfig
): LlmCopypasterConfig {
  if (!userFileConfig) return defaultConfig;

  return applyUserConfig(defaultConfig, userFileConfig, buildBaseSettingsFn);
}

export function applyUserConfig(
  baseConfig: LlmCopypasterConfig,
  userConfig: LlmCopypasterUserConfig,
  buildBaseSettingsFn: () => ProfileSettingsConfig
): LlmCopypasterConfig {
  const nextConfig: LlmCopypasterConfig = {
    llmToIdeParsingAnchors: mergeLlmToIdeParsingAnchors(
      baseConfig.llmToIdeParsingAnchors,
      userConfig.llmToIdeParsingAnchors
    ),
    baseSettings: mergeProfileSettingsConfig(baseConfig.baseSettings, userConfig.baseSettings, buildBaseSettingsFn),
    profilesById: mergeProfilesById(baseConfig.profilesById, userConfig, buildBaseSettingsFn),
  };

  return nextConfig;
}

export function mergeLlmToIdeParsingAnchors(
  baseAnchors: LlmToIdeParsingAnchorsConfig,
  userAnchors?: LlmToIdeParsingAnchorsUserConfig
): LlmToIdeParsingAnchorsConfig {
  if (!userAnchors) return baseAnchors;

  return {
    techPromptDelimiter: userAnchors.techPromptDelimiter ?? baseAnchors.techPromptDelimiter,
    codeListingHeaderStartFragment: userAnchors.codeListingHeaderStartFragment ?? baseAnchors.codeListingHeaderStartFragment,
    fileStatusPrefix: userAnchors.fileStatusPrefix ?? baseAnchors.fileStatusPrefix,
    placeholderStartFragment: userAnchors.placeholderStartFragment ?? baseAnchors.placeholderStartFragment,
    placeholderEndFragment: userAnchors.placeholderEndFragment ?? baseAnchors.placeholderEndFragment,
  };
}

export function mergeProfileSettingsConfig(
  baseSettings: ProfileSettingsConfig,
  userSettings: ProfileSettingsUserConfig | undefined,
  buildBaseSettingsFn: () => ProfileSettingsConfig
): ProfileSettingsConfig {
  if (!userSettings) return baseSettings;

  const nextSettings: ProfileSettingsConfig = {
    skipTechPrompt: userSettings.skipTechPrompt ?? baseSettings.skipTechPrompt,
    skipCodeListings: userSettings.skipCodeListings ?? baseSettings.skipCodeListings,
    ideToLlmContextConfig: mergeIdeToLlmContextConfig(
      baseSettings.ideToLlmContextConfig,
      userSettings.ideToLlmContextConfig
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
  baseConfig: Partial<PromptInstructionConfig>,
  userConfig: PromptInstructionUserConfig | undefined
): Partial<PromptInstructionConfig> {
  if (!userConfig) return baseConfig;

  const baseSharedVariablesById = baseConfig.sharedVariablesById ?? {};
  const baseSubInstructionsById = baseConfig.subInstructionsById ?? {};

  const nextSharedVariablesById = userConfig.onMergeIgnoreAll_sharedVariablesById
    ? (userConfig.sharedVariablesById ?? {})
    : { ...baseSharedVariablesById, ...(userConfig.sharedVariablesById ?? {}) };

  const nextSubInstructionsById = userConfig.onMergeIgnoreAll_subInstructionsById
    ? mapSubInstructionsById({}, userConfig.subInstructionsById ?? {})
    : mapSubInstructionsById(baseSubInstructionsById, userConfig.subInstructionsById ?? {});

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
      if (!userSubInstruction.relativePathToSubInstruction || userSubInstruction.skipSubInstruction === undefined) continue;

      nextSubInstructionsById[subInstructionId] = {
        relativePathToSubInstruction: userSubInstruction.relativePathToSubInstruction,
        skipSubInstruction: userSubInstruction.skipSubInstruction,
      };

      continue;
    }

    nextSubInstructionsById[subInstructionId] = {
      relativePathToSubInstruction:
        userSubInstruction.relativePathToSubInstruction ?? baseSubInstruction.relativePathToSubInstruction,
      skipSubInstruction: userSubInstruction.skipSubInstruction ?? baseSubInstruction.skipSubInstruction,
    };
  }

  return nextSubInstructionsById;
}

export function mergeLlmToIdeSanitizationRulesById(
  baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
  userSettings: ProfileSettingsUserConfig
): Record<string, LlmToIdeSanitizationRuleConfig> {
  const userRulesById = userSettings.llmToIdeSanitizationRulesById;
  if (!userRulesById) return baseRulesById;

  if (userSettings.onMergeIgnoreAll_llmToIdeSanitizationRulesById)
    return mapLlmToIdeSanitizationRulesById({}, userRulesById);

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
  baseProfilesById: Record<string, ProfileConfig>,
  userConfig: LlmCopypasterUserConfig,
  buildBaseSettingsFn: () => ProfileSettingsConfig
): Record<string, ProfileConfig> {
  const userProfilesById = userConfig.profilesById;
  if (!userProfilesById) return baseProfilesById;

  if (userConfig.onMergeIgnoreAll_profilesById) return mapProfilesById({}, userProfilesById, buildBaseSettingsFn);

  return mapProfilesById(baseProfilesById, userProfilesById, buildBaseSettingsFn);
}

export function mapProfilesById(
  baseProfilesById: Record<string, ProfileConfig>,
  userProfilesById: Record<string, ProfileUserConfig>,
  buildBaseSettingsFn: () => ProfileSettingsConfig
): Record<string, ProfileConfig> {
  const nextProfilesById: Record<string, ProfileConfig> = { ...baseProfilesById };

  for (const profileId of Object.keys(userProfilesById)) {
    const baseProfile = baseProfilesById[profileId];
    const userProfile = userProfilesById[profileId];

    if (!baseProfile) {
      if (!userProfile.description || !userProfile.version) continue;

      nextProfilesById[profileId] = {
        description: userProfile.description,
        version: userProfile.version,
        profileSettingsConfig: userProfile.profileSettingsConfig
          ? mergeProfileSettingsConfig(buildBaseSettingsFn(), userProfile.profileSettingsConfig, buildBaseSettingsFn)
          : {},
      };

      continue;
    }

    nextProfilesById[profileId] = {
      description: userProfile.description ?? baseProfile.description,
      version: userProfile.version ?? baseProfile.version,
      profileSettingsConfig: userProfile.profileSettingsConfig
        ? mergeProfileSettingsConfig(
            { ...buildBaseSettingsFn(), ...baseProfile.profileSettingsConfig } as ProfileSettingsConfig,
            userProfile.profileSettingsConfig,
            buildBaseSettingsFn
          )
        : baseProfile.profileSettingsConfig,
    };
  }

  return nextProfilesById;
}

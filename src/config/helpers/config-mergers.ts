import {
  ConfigValidationNotificationSettingsConfig,
  CoreSettingsConfig,
  IdeToLlmConfig,
  InstructionConfig,
  InstructionsAndVariablesConfig,
  LlmCopypasterConfig,
  LlmToIdeConfig,
  LlmToIdeSanitizationRuleConfig,
  NonOverrideableSettingsConfig,
  NotificationSettingsConfig,
  PostFilePatchActionsConfig,
  VitalParsingAnchorsConfig,
} from '../contracts/system-config-contracts';
import {
  ConfigValidationNotificationSettingsUserConfig,
  CoreSettingsUserConfig,
  IdeToLlmUserConfig,
  InstructionUserConfig,
  InstructionsAndVariablesUserConfig,
  LlmCopypasterUserConfig,
  LlmToIdeSanitizationRuleUserConfig,
  LlmToIdeUserConfig,
  NonOverrideableSettingsUserConfig,
  NotificationSettingsUserConfig,
  PostFilePatchActionsUserConfig,
  VitalParsingAnchorsUserConfig,
} from '../contracts/user-config-contracts';

export function mergeConfigs(
  systemConfig: LlmCopypasterConfig,
  userConfig: LlmCopypasterUserConfig | null
): LlmCopypasterConfig {
  if (!userConfig) return systemConfig;

  return applyUserConfig(systemConfig, userConfig);
}

export function applyUserConfig(
  systemConfig: LlmCopypasterConfig,
  userConfig: LlmCopypasterUserConfig
): LlmCopypasterConfig {
  const nextConfig: LlmCopypasterConfig = {
    nonOverrideableSettings: mergeNonOverrideableSettingsConfig(
      systemConfig.nonOverrideableSettings,
      userConfig.nonOverrideableSettings
    ),
    coreSettings: mergeCoreSettingsConfig(systemConfig.coreSettings, userConfig.coreSettings),
  };

  return nextConfig;
}

export function mergeNonOverrideableSettingsConfig(
  baseSettings: NonOverrideableSettingsConfig,
  userSettings?: NonOverrideableSettingsUserConfig
): NonOverrideableSettingsConfig {
  if (!userSettings) return baseSettings;

  return {
    allowOutsideWorkspaceRead: mergeOptionalValue(
      baseSettings.allowOutsideWorkspaceRead,
      userSettings.allowOutsideWorkspaceRead
    ),
    allowOutsideWorkspaceWrite: mergeOptionalValue(
      baseSettings.allowOutsideWorkspaceWrite,
      userSettings.allowOutsideWorkspaceWrite
    ),
    vitalParsingAnchors: mergeLlmToIdeParsingAnchors(baseSettings.vitalParsingAnchors, userSettings.vitalParsingAnchors),
    notificationSettings: mergeNotificationSettingsConfig(
      baseSettings.notificationSettings,
      userSettings.notificationSettings
    ),
  };
}

export function mergeLlmToIdeParsingAnchors(
  baseAnchors: VitalParsingAnchorsConfig,
  userAnchors?: VitalParsingAnchorsUserConfig
): VitalParsingAnchorsConfig {
  if (!userAnchors) return baseAnchors;

  return {
    PROMPT_DELIMITER_ANCHOR: mergeOptionalValue(baseAnchors.PROMPT_DELIMITER_ANCHOR, userAnchors.PROMPT_DELIMITER_ANCHOR),
    CODE_LISTING_HEADER_ANCHOR: mergeOptionalValue(
      baseAnchors.CODE_LISTING_HEADER_ANCHOR,
      userAnchors.CODE_LISTING_HEADER_ANCHOR
    ),
    FILE_STATUS_ANCHOR: mergeOptionalValue(baseAnchors.FILE_STATUS_ANCHOR, userAnchors.FILE_STATUS_ANCHOR),
    FILE_EDITED_FULL_ANCHOR: mergeOptionalValue(baseAnchors.FILE_EDITED_FULL_ANCHOR, userAnchors.FILE_EDITED_FULL_ANCHOR),
    FILE_CREATED_ANCHOR: mergeOptionalValue(baseAnchors.FILE_CREATED_ANCHOR, userAnchors.FILE_CREATED_ANCHOR),
    FILE_DELETED_ANCHOR: mergeOptionalValue(baseAnchors.FILE_DELETED_ANCHOR, userAnchors.FILE_DELETED_ANCHOR),
    END_OF_OUTPUT_ANCHOR: mergeNullableAnchor(baseAnchors.END_OF_OUTPUT_ANCHOR, userAnchors.END_OF_OUTPUT_ANCHOR),
  };
}

export function mergeNotificationSettingsConfig(
  baseSettings: NotificationSettingsConfig,
  userSettings?: NotificationSettingsUserConfig
): NotificationSettingsConfig {
  if (!userSettings) return baseSettings;

  return {
    configValidation: mergeConfigValidationNotificationSettingsConfig(
      baseSettings.configValidation,
      userSettings.configValidation
    ),
  };
}

export function mergeConfigValidationNotificationSettingsConfig(
  baseSettings: ConfigValidationNotificationSettingsConfig,
  userSettings?: ConfigValidationNotificationSettingsUserConfig
): ConfigValidationNotificationSettingsConfig {
  if (!userSettings) return baseSettings;

  return {
    suppressWarningIssuesToast: mergeOptionalValue(
      baseSettings.suppressWarningIssuesToast,
      userSettings.suppressWarningIssuesToast
    ),
    suppressRecommendationIssuesToast: mergeOptionalValue(
      baseSettings.suppressRecommendationIssuesToast,
      userSettings.suppressRecommendationIssuesToast
    ),
    suppressNoIssuesToast: mergeOptionalValue(baseSettings.suppressNoIssuesToast, userSettings.suppressNoIssuesToast),
  };
}

export function mergeNullableAnchor(
  baseAnchorValue: string | null,
  userAnchorValue: string | null | undefined
): string | null {
  if (userAnchorValue === undefined) return baseAnchorValue;

  return userAnchorValue;
}

export function mergeCoreSettingsConfig(
  baseSettings: CoreSettingsConfig,
  userSettings: CoreSettingsUserConfig | undefined
): CoreSettingsConfig {
  if (!userSettings) return baseSettings;

  return {
    skipInstructions: mergeOptionalValue(baseSettings.skipInstructions, userSettings.skipInstructions),
    skipCodeListings: mergeOptionalValue(baseSettings.skipCodeListings, userSettings.skipCodeListings),
    ideToLlm: mergeIdeToLlmContextConfig(baseSettings.ideToLlm, userSettings.ideToLlm),
    llmToIde: mergeLlmToIdeContextConfig(baseSettings.llmToIde, userSettings.llmToIde),
    postFilePatchActions: mergePostFilePatchActionsConfig(
      baseSettings.postFilePatchActions,
      userSettings.postFilePatchActions
    ),
    instructionsAndVariables: mergeInstructionsAndVariablesConfig(
      baseSettings.instructionsAndVariables,
      userSettings.instructionsAndVariables
    ),
    llmToIdeSanitizationRulesById: mergeLlmToIdeSanitizationRulesById(
      baseSettings.llmToIdeSanitizationRulesById,
      userSettings
    ),
  };
}

export function mergeIdeToLlmContextConfig(
  baseConfig: IdeToLlmConfig,
  userConfig: IdeToLlmUserConfig | undefined
): IdeToLlmConfig {
  if (!userConfig) return baseConfig;

  return {
    skipPromptSizeStatsInCopyNotification: mergeOptionalValue(
      baseConfig.skipPromptSizeStatsInCopyNotification,
      userConfig.skipPromptSizeStatsInCopyNotification
    ),
    charsPerToken: mergeOptionalValue(baseConfig.charsPerToken, userConfig.charsPerToken),
    linesMaxToShowWarning: mergeOptionalValue(baseConfig.linesMaxToShowWarning, userConfig.linesMaxToShowWarning),
    tokensMaxToShowWarning: mergeOptionalValue(baseConfig.tokensMaxToShowWarning, userConfig.tokensMaxToShowWarning),
  };
}

export function mergeLlmToIdeContextConfig(
  baseConfig: LlmToIdeConfig,
  userConfig: LlmToIdeUserConfig | undefined
): LlmToIdeConfig {
  if (!userConfig) return baseConfig;

  return {
    skipPromptSizeStatsInCopyNotification: mergeOptionalValue(
      baseConfig.skipPromptSizeStatsInCopyNotification,
      userConfig.skipPromptSizeStatsInCopyNotification
    ),
    charsPerToken: mergeOptionalValue(baseConfig.charsPerToken, userConfig.charsPerToken),
    linesMaxToShowWarning: mergeOptionalValue(baseConfig.linesMaxToShowWarning, userConfig.linesMaxToShowWarning),
    tokensMaxToShowWarning: mergeOptionalValue(baseConfig.tokensMaxToShowWarning, userConfig.tokensMaxToShowWarning),
  };
}

export function mergePostFilePatchActionsConfig(
  baseConfig: PostFilePatchActionsConfig,
  userConfig: PostFilePatchActionsUserConfig | undefined
): PostFilePatchActionsConfig {
  if (!userConfig) return baseConfig;

  return {
    enableSaveAfterFilePatch: mergeOptionalValue(baseConfig.enableSaveAfterFilePatch, userConfig.enableSaveAfterFilePatch),
    enableLintingAfterFilePatch: mergeOptionalValue(
      baseConfig.enableLintingAfterFilePatch,
      userConfig.enableLintingAfterFilePatch
    ),
    enableOpeningPatchedFilesInEditor: mergeOptionalValue(
      baseConfig.enableOpeningPatchedFilesInEditor,
      userConfig.enableOpeningPatchedFilesInEditor
    ),
  };
}

export function mergeInstructionsAndVariablesConfig(
  baseConfig: InstructionsAndVariablesConfig,
  userConfig: InstructionsAndVariablesUserConfig | undefined
): InstructionsAndVariablesConfig {
  if (!userConfig) return baseConfig;

  const baseSharedVariablesById = baseConfig.sharedVariablesById;
  const baseSharedReferenceVariablesById = baseConfig.sharedReferenceVariablesById;
  const baseInstructionsById = baseConfig.instructionsById;

  const nextSharedVariablesById = { ...baseSharedVariablesById, ...(userConfig.sharedVariablesById ?? {}) };
  const nextSharedReferenceVariablesById = {
    ...baseSharedReferenceVariablesById,
    ...(userConfig.sharedReferenceVariablesById ?? {}),
  };
  const nextInstructionsById = mapInstructionsById(baseInstructionsById, userConfig.instructionsById ?? {});

  return {
    sharedVariablesById: nextSharedVariablesById,
    sharedReferenceVariablesById: nextSharedReferenceVariablesById,
    instructionsById: nextInstructionsById,
  };
}

export function mapInstructionsById(
  baseInstructionsById: Record<string, InstructionConfig>,
  userInstructionsById: Record<string, InstructionUserConfig>
): Record<string, InstructionConfig> {
  // Start from the base dictionary and override only instruction ids provided by the user
  const nextInstructionsById: Record<string, InstructionConfig> = { ...baseInstructionsById };

  // Process only user-defined instruction ids, because untouched base instructions are already copied above
  for (const instructionId of Object.keys(userInstructionsById)) {
    const baseInstruction = baseInstructionsById[instructionId];
    const userInstruction = userInstructionsById[instructionId];

    // This branch handles a brand new instruction that does not exist in the base config yet
    if (!baseInstruction) {
      // A new instruction is valid only when its required fields are provided explicitly
      if (userInstruction.path === undefined || userInstruction.skip === undefined) continue;

      nextInstructionsById[instructionId] = {
        path: userInstruction.path,
        skip: userInstruction.skip,
        // Optional visibility flags default to false for newly created instructions
        showInOverrideMode: !!userInstruction.showInOverrideMode,
        showInQuickInstructionMode: !!userInstruction.showInQuickInstructionMode,
      };

      continue;
    }

    // This branch merges a user override into an existing base instruction
    nextInstructionsById[instructionId] = {
      path: mergeOptionalValue(baseInstruction.path, userInstruction.path),
      skip: mergeOptionalValue(baseInstruction.skip, userInstruction.skip),
      // Preserve the base flag when the user did not specify an override explicitly
      showInOverrideMode:
        userInstruction.showInOverrideMode === undefined
          ? baseInstruction.showInOverrideMode
          : userInstruction.showInOverrideMode,
      // Preserve the base flag when the user did not specify an override explicitly
      showInQuickInstructionMode:
        userInstruction.showInQuickInstructionMode === undefined
          ? baseInstruction.showInQuickInstructionMode
          : userInstruction.showInQuickInstructionMode,
    };
  }

  return nextInstructionsById;
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
        userRule.regexPattern === undefined ||
        userRule.replaceWith === undefined ||
        userRule.skipForLanguages === undefined ||
        userRule.skipForPaths === undefined
      )
        continue;

      nextRulesById[ruleId] = {
        regexPattern: userRule.regexPattern,
        replaceWith: userRule.replaceWith,
        skipForLanguages: userRule.skipForLanguages,
        skipForPaths: userRule.skipForPaths,
      };

      continue;
    }

    nextRulesById[ruleId] = {
      regexPattern: mergeOptionalValue(baseRule.regexPattern, userRule.regexPattern),
      replaceWith: mergeOptionalValue(baseRule.replaceWith, userRule.replaceWith),
      skipForLanguages: mergeOptionalValue(baseRule.skipForLanguages, userRule.skipForLanguages),
      skipForPaths: mergeOptionalValue(baseRule.skipForPaths, userRule.skipForPaths),
    };
  }

  return nextRulesById;
}

export function mergeOptionalValue<T>(baseValue: T, userValue: T | undefined): T {
  if (userValue === undefined) return baseValue;

  return userValue;
}

import {
  ConfigValidationNotificationSettingsConfig,
  IdeToLlmConfig,
  InstructionConfig,
  InstructionsConfig,
  LlmToIdeConfig,
  LlmToIdeSanitizationRuleConfig,
  NotificationSettingsConfig,
  PostFilePatchActionsConfig,
  PresetDependentSettingsConfig,
  PresetIndependentSettingsConfig,
  SystemConfig,
  VitalParsingAnchorsConfig,
} from '../contracts/system-config-contracts';
import {
  ConfigValidationNotificationSettingsUserConfig,
  IdeToLlmUserConfig,
  InstructionUserConfig,
  InstructionsSettingsUserConfig,
  LlmToIdeSanitizationRuleUserConfig,
  LlmToIdeUserConfig,
  NotificationSettingsUserConfig,
  PostFilePatchActionsUserConfig,
  PresetDependentSettingsUserConfig,
  PresetIndependentSettingsUserConfig,
  UserConfig,
  VitalParsingAnchorsUserConfig,
} from '../contracts/user-config-contracts';

export function mergeConfigs(systemConfig: SystemConfig, userConfig: UserConfig | null): SystemConfig {
  if (!userConfig) return systemConfig;

  return applyUserConfig(systemConfig, userConfig);
}

export function applyUserConfig(systemConfig: SystemConfig, userConfig: UserConfig): SystemConfig {
  const nextConfig: SystemConfig = {
    presetIndependentSettings: mergePresetIndependentSettingsConfig(
      systemConfig.presetIndependentSettings,
      userConfig.presetIndependentSettings
    ),
    presetDependentSettings: mergePresetDependentSettingsConfig(
      systemConfig.presetDependentSettings,
      userConfig.presetDependentSettings
    ),
  };

  return nextConfig;
}

export function mergePresetIndependentSettingsConfig(
  baseSettings: PresetIndependentSettingsConfig,
  userSettings?: PresetIndependentSettingsUserConfig
): PresetIndependentSettingsConfig {
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

export function mergePresetDependentSettingsConfig(
  baseSettings: PresetDependentSettingsConfig,
  userSettings: PresetDependentSettingsUserConfig | undefined
): PresetDependentSettingsConfig {
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
    instructionsSettings: mergeInstructionsSettingsConfig(
      baseSettings.instructionsSettings,
      userSettings.instructionsSettings
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

export function mergeInstructionsSettingsConfig(
  baseConfig: InstructionsConfig,
  userConfig: InstructionsSettingsUserConfig | undefined
): InstructionsConfig {
  if (!userConfig) return baseConfig;

  const baseVariablesById = baseConfig.variablesById;
  const baseReferencesById = baseConfig.referencesById;
  const baseInstructionsById = baseConfig.instructionsById;

  const nextVariablesById = { ...baseVariablesById, ...(userConfig.variablesById ?? {}) };
  const nextReferencesById = {
    ...baseReferencesById,
    ...(userConfig.referencesById ?? {}),
  };
  const nextInstructionsById = mapInstructionsById(baseInstructionsById, userConfig.instructionsById ?? {});

  return {
    variablesById: nextVariablesById,
    referencesById: nextReferencesById,
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
        showInPresetsMode: !!userInstruction.showInPresetsMode,
        showInQuickInstructionMode: !!userInstruction.showInQuickInstructionMode,
      };

      continue;
    }

    // This branch merges a user preset-dependent change into an existing base instruction
    nextInstructionsById[instructionId] = {
      path: mergeOptionalValue(baseInstruction.path, userInstruction.path),
      skip: mergeOptionalValue(baseInstruction.skip, userInstruction.skip),
      // Preserve the base flag when the user did not specify a preset-dependent value explicitly
      showInPresetsMode:
        userInstruction.showInPresetsMode === undefined
          ? baseInstruction.showInPresetsMode
          : userInstruction.showInPresetsMode,
      // Preserve the base flag when the user did not specify a preset-dependent value explicitly
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
  userSettings: PresetDependentSettingsUserConfig
): Record<string, LlmToIdeSanitizationRuleConfig> {
  const userRulesById = userSettings.llmToIdeSanitizationRulesById;
  if (!userRulesById) return baseRulesById;

  return mapLlmToIdeSanitizationRulesById(baseRulesById, userRulesById);
}

export function mapLlmToIdeSanitizationRulesById(
  baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>,
  userRulesById: Record<string, LlmToIdeSanitizationRuleUserConfig>
): Record<string, LlmToIdeSanitizationRuleConfig> {
  // 1: Start from a shallow copy so untouched base rules stay in the final map
  const nextRulesById: Record<string, LlmToIdeSanitizationRuleConfig> = { ...baseRulesById };

  // 2: Then process only rule ids explicitly provided by the user if any
  for (const ruleId of Object.keys(userRulesById)) {
    const baseRule = baseRulesById[ruleId];
    const userRule = userRulesById[ruleId];

    // 2-a: If baseRule was found by key, update only fields explicitly provided by the user
    if (baseRule !== undefined) {
      nextRulesById[ruleId] = {
        regexPattern: mergeOptionalValue(baseRule.regexPattern, userRule.regexPattern),
        replaceWith: mergeOptionalValue(baseRule.replaceWith, userRule.replaceWith),
        skipForLanguages: mergeOptionalValue(baseRule.skipForLanguages, userRule.skipForLanguages),
        skipForPaths: mergeOptionalValue(baseRule.skipForPaths, userRule.skipForPaths),
      };

      continue;
    }

    // 2-b: If baseRule was not found by key, treat it as a NEW rule candidate
    if (
      userRule.regexPattern === undefined ||
      userRule.replaceWith === undefined ||
      userRule.skipForLanguages === undefined ||
      userRule.skipForPaths === undefined
    )
      continue; // If at least one required field is missing for a new rule, skip it

    // 2-c: All required fields are present, so add a new rule
    nextRulesById[ruleId] = {
      regexPattern: userRule.regexPattern,
      replaceWith: userRule.replaceWith,
      skipForLanguages: userRule.skipForLanguages,
      skipForPaths: userRule.skipForPaths,
    };
  }

  return nextRulesById;
}

export function mergeOptionalValue<T>(baseValue: T, userValue: T | undefined): T {
  if (userValue === undefined) return baseValue;

  return userValue;
}

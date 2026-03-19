import {
  CoreSettingsConfig,
  IdeToLlmConfig,
  InstructionConfig,
  InstructionsAndVariablesConfig,
  LlmCopypasterConfig,
  LlmToIdeConfig,
  LlmToIdeSanitizationRuleConfig,
  PostFilePatchActionsConfig,
  VitalParsingAnchorsConfig,
} from '../system-config-contracts';
import {
  CoreSettingsUserConfig,
  IdeToLlmUserConfig,
  InstructionUserConfig,
  InstructionsAndVariablesUserConfig,
  LlmCopypasterUserConfig,
  LlmToIdeSanitizationRuleUserConfig,
  LlmToIdeUserConfig,
  PostFilePatchActionsUserConfig,
  VitalParsingAnchorsUserConfig,
} from '../user-config-contracts';

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
    vitalParsingAnchors: mergeLlmToIdeParsingAnchors(systemConfig.vitalParsingAnchors, userConfig.vitalParsingAnchors),
    coreSettings: mergeCoreSettingsConfig(systemConfig.coreSettings, userConfig.coreSettings),
  };

  return nextConfig;
}

export function mergeLlmToIdeParsingAnchors(
  baseAnchors: VitalParsingAnchorsConfig,
  userAnchors?: VitalParsingAnchorsUserConfig
): VitalParsingAnchorsConfig {
  if (!userAnchors) return baseAnchors;

  return {
    PROMPT_DELIMITER_ANCHOR: userAnchors.PROMPT_DELIMITER_ANCHOR ?? baseAnchors.PROMPT_DELIMITER_ANCHOR,
    CODE_LISTING_HEADER_ANCHOR: userAnchors.CODE_LISTING_HEADER_ANCHOR ?? baseAnchors.CODE_LISTING_HEADER_ANCHOR,
    FILE_STATUS_ANCHOR: userAnchors.FILE_STATUS_ANCHOR ?? baseAnchors.FILE_STATUS_ANCHOR,
    FILE_EDITED_FULL_ANCHOR: userAnchors.FILE_EDITED_FULL_ANCHOR ?? baseAnchors.FILE_EDITED_FULL_ANCHOR,
    FILE_CREATED_ANCHOR: userAnchors.FILE_CREATED_ANCHOR ?? baseAnchors.FILE_CREATED_ANCHOR,
    FILE_DELETED_ANCHOR: userAnchors.FILE_DELETED_ANCHOR ?? baseAnchors.FILE_DELETED_ANCHOR,
    CONFIG_REF_VAR_ANCHOR: userAnchors.CONFIG_REF_VAR_ANCHOR ?? baseAnchors.CONFIG_REF_VAR_ANCHOR,
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
    skipPromptSizeStatsInCopyNotification:
      userConfig.skipPromptSizeStatsInCopyNotification ?? baseConfig.skipPromptSizeStatsInCopyNotification,
    charsPerToken: userConfig.charsPerToken ?? baseConfig.charsPerToken,
    linesMaxToShowWarning: userConfig.linesMaxToShowWarning ?? baseConfig.linesMaxToShowWarning,
    tokensMaxToShowWarning: userConfig.tokensMaxToShowWarning ?? baseConfig.tokensMaxToShowWarning,
  };
}

export function mergeLlmToIdeContextConfig(
  baseConfig: LlmToIdeConfig,
  userConfig: LlmToIdeUserConfig | undefined
): LlmToIdeConfig {
  if (!userConfig) return baseConfig;

  return {
    skipPromptSizeStatsInCopyNotification:
      userConfig.skipPromptSizeStatsInCopyNotification ?? baseConfig.skipPromptSizeStatsInCopyNotification,
    charsPerToken: userConfig.charsPerToken ?? baseConfig.charsPerToken,
    linesMaxToShowWarning: userConfig.linesMaxToShowWarning ?? baseConfig.linesMaxToShowWarning,
    tokensMaxToShowWarning: userConfig.tokensMaxToShowWarning ?? baseConfig.tokensMaxToShowWarning,
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

export function mergeInstructionsAndVariablesConfig(
  baseConfig: InstructionsAndVariablesConfig,
  userConfig: InstructionsAndVariablesUserConfig | undefined
): InstructionsAndVariablesConfig {
  if (!userConfig) return baseConfig;

  const baseSharedVariablesById = baseConfig.sharedVariablesById;
  const baseInstructionsById = baseConfig.instructionsById;

  const nextSharedVariablesById = { ...baseSharedVariablesById, ...(userConfig.sharedVariablesById ?? {}) };
  const nextInstructionsById = mapInstructionsById(baseInstructionsById, userConfig.instructionsById ?? {});

  return {
    sharedVariablesById: nextSharedVariablesById,
    instructionsById: nextInstructionsById,
  };
}

export function mapInstructionsById(
  baseInstructionsById: Record<string, InstructionConfig>,
  userInstructionsById: Record<string, InstructionUserConfig>
): Record<string, InstructionConfig> {
  const nextInstructionsById: Record<string, InstructionConfig> = { ...baseInstructionsById };

  for (const instructionId of Object.keys(userInstructionsById)) {
    const baseInstruction = baseInstructionsById[instructionId];
    const userInstruction = userInstructionsById[instructionId];

    if (!baseInstruction) {
      if (!userInstruction.path || userInstruction.skip === undefined) continue;

      nextInstructionsById[instructionId] = {
        path: userInstruction.path,
        skip: userInstruction.skip,
        skipInOverrideMode: userInstruction.skipInOverrideMode,
        skipInQuickInstructionMode: userInstruction.skipInQuickInstructionMode,
      };

      continue;
    }

    nextInstructionsById[instructionId] = {
      path: userInstruction.path ?? baseInstruction.path,
      skip: userInstruction.skip ?? baseInstruction.skip,
      skipInOverrideMode: userInstruction.skipInOverrideMode,
      skipInQuickInstructionMode: userInstruction.skipInQuickInstructionMode,
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
        !userRule.regexPattern ||
        userRule.replaceWith === undefined ||
        !userRule.skipForLanguages ||
        !userRule.skipForPaths
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
      regexPattern: userRule.regexPattern ?? baseRule.regexPattern,
      replaceWith: userRule.replaceWith ?? baseRule.replaceWith,
      skipForLanguages: userRule.skipForLanguages ?? baseRule.skipForLanguages,
      skipForPaths: userRule.skipForPaths ?? baseRule.skipForPaths,
    };
  }

  return nextRulesById;
}

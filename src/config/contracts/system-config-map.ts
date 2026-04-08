// This map has two goals.
//
// 1) It is the single source of truth for system contract field names.
// Zod schema, and path metadata should read field names from here, so contract rename happens in one place and stays consistent.
//
// 2) It provides a convenient helper for string property paths.
// TypeScript has no reflection for property access chains, so code like x.y.z cannot be converted into "x.y.z" automatically.
//
// System-Zod-config intentionally uses this map do not forget update the map in case of field renaming.
//
// This map is metadata for field names and paths, NOT for compile-time/runtime config values.
//
// This map is intentionally NOT used by regular TS-interface clients such as config readers/mergers at runtime.
// Those clients should keep normal dot access to maintain IDE-renaming easy.
//
// This is also the best price/performance trade-off found for this project.
// A Zod-first / z.infer-based approach was tried before,
// where the schema becomes the primary source of truth and TS types are derived from it,
// for example: const schema = z.object(...); type Config = z.infer<typeof schema>.
// In practice, that approach made this config setup much more complex than needed,
// so it was dropped in favor of this simpler map-based solution.

export interface ConfigFieldPathNode<TName extends string = string, TPath extends string = string> {
  name: TName;
  path: TPath;
  pathAndName: TPath extends '' ? TName : `${TPath}.${TName}`;
}

const systemConfigPathNode = buildConfigFieldPathNode('systemConfig');
const presetIndependentSettingsConfigPathNode = buildConfigFieldPathNode('presetIndependentSettings');
const allowOutsideWorkspaceReadConfigPathNode = buildConfigFieldPathNode(
  'allowOutsideWorkspaceRead',
  presetIndependentSettingsConfigPathNode.pathAndName
);
const allowOutsideWorkspaceWriteConfigPathNode = buildConfigFieldPathNode(
  'allowOutsideWorkspaceWrite',
  presetIndependentSettingsConfigPathNode.pathAndName
);
const vitalParsingAnchorsConfigPathNode = buildConfigFieldPathNode(
  'vitalParsingAnchors',
  presetIndependentSettingsConfigPathNode.pathAndName
);
const promptDelimiterAnchorConfigPathNode = buildConfigFieldPathNode(
  'PROMPT_DELIMITER_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const codeListingHeaderAnchorConfigPathNode = buildConfigFieldPathNode(
  'CODE_LISTING_HEADER_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const fileStatusAnchorConfigPathNode = buildConfigFieldPathNode(
  'FILE_STATUS_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const fileEditedFullAnchorConfigPathNode = buildConfigFieldPathNode(
  'FILE_EDITED_FULL_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const fileCreatedAnchorConfigPathNode = buildConfigFieldPathNode(
  'FILE_CREATED_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const fileDeletedAnchorConfigPathNode = buildConfigFieldPathNode(
  'FILE_DELETED_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const endOfOutputAnchorConfigPathNode = buildConfigFieldPathNode(
  'END_OF_OUTPUT_ANCHOR',
  vitalParsingAnchorsConfigPathNode.pathAndName
);
const notificationSettingsConfigPathNode = buildConfigFieldPathNode(
  'notificationSettings',
  presetIndependentSettingsConfigPathNode.pathAndName
);
const configValidationNotificationSettingsConfigPathNode = buildConfigFieldPathNode(
  'configValidation',
  notificationSettingsConfigPathNode.pathAndName
);
const suppressWarningIssuesToastConfigPathNode = buildConfigFieldPathNode(
  'suppressWarningIssuesToast',
  configValidationNotificationSettingsConfigPathNode.pathAndName
);
const suppressRecommendationIssuesToastConfigPathNode = buildConfigFieldPathNode(
  'suppressRecommendationIssuesToast',
  configValidationNotificationSettingsConfigPathNode.pathAndName
);
const suppressNoIssuesToastConfigPathNode = buildConfigFieldPathNode(
  'suppressNoIssuesToast',
  configValidationNotificationSettingsConfigPathNode.pathAndName
);

const presetDependentSettingsConfigPathNode = buildConfigFieldPathNode('presetDependentSettings');
const skipInstructionsConfigPathNode = buildConfigFieldPathNode(
  'skipInstructions',
  presetDependentSettingsConfigPathNode.pathAndName
);
const skipCodeListingsConfigPathNode = buildConfigFieldPathNode(
  'skipCodeListings',
  presetDependentSettingsConfigPathNode.pathAndName
);
const ideToLlmConfigPathNode = buildConfigFieldPathNode('ideToLlm', presetDependentSettingsConfigPathNode.pathAndName);
const llmToIdeConfigPathNode = buildConfigFieldPathNode('llmToIde', presetDependentSettingsConfigPathNode.pathAndName);
const postFilePatchActionsConfigPathNode = buildConfigFieldPathNode(
  'postFilePatchActions',
  presetDependentSettingsConfigPathNode.pathAndName
);
const instructionsAndVariablesConfigPathNode = buildConfigFieldPathNode(
  'instructionsAndVariables',
  presetDependentSettingsConfigPathNode.pathAndName
);
const llmToIdeSanitizationRulesByIdConfigPathNode = buildConfigFieldPathNode(
  'llmToIdeSanitizationRulesById',
  presetDependentSettingsConfigPathNode.pathAndName
);

const skipPromptSizeStatsInCopyNotificationPromptLimitsPathNode = buildConfigFieldPathNode(
  'skipPromptSizeStatsInCopyNotification'
);
const charsPerTokenPromptLimitsPathNode = buildConfigFieldPathNode('charsPerToken');
const linesMaxToShowWarningPromptLimitsPathNode = buildConfigFieldPathNode('linesMaxToShowWarning');
const tokensMaxToShowWarningPromptLimitsPathNode = buildConfigFieldPathNode('tokensMaxToShowWarning');

const skipPromptSizeStatsInCopyNotificationIdeToLlmConfigPathNode = buildConfigFieldPathNode(
  skipPromptSizeStatsInCopyNotificationPromptLimitsPathNode.name,
  ideToLlmConfigPathNode.pathAndName
);
const charsPerTokenIdeToLlmConfigPathNode = buildConfigFieldPathNode(
  charsPerTokenPromptLimitsPathNode.name,
  ideToLlmConfigPathNode.pathAndName
);
const linesMaxToShowWarningIdeToLlmConfigPathNode = buildConfigFieldPathNode(
  linesMaxToShowWarningPromptLimitsPathNode.name,
  ideToLlmConfigPathNode.pathAndName
);
const tokensMaxToShowWarningIdeToLlmConfigPathNode = buildConfigFieldPathNode(
  tokensMaxToShowWarningPromptLimitsPathNode.name,
  ideToLlmConfigPathNode.pathAndName
);

const skipPromptSizeStatsInCopyNotificationLlmToIdeConfigPathNode = buildConfigFieldPathNode(
  skipPromptSizeStatsInCopyNotificationPromptLimitsPathNode.name,
  llmToIdeConfigPathNode.pathAndName
);
const charsPerTokenLlmToIdeConfigPathNode = buildConfigFieldPathNode(
  charsPerTokenPromptLimitsPathNode.name,
  llmToIdeConfigPathNode.pathAndName
);
const linesMaxToShowWarningLlmToIdeConfigPathNode = buildConfigFieldPathNode(
  linesMaxToShowWarningPromptLimitsPathNode.name,
  llmToIdeConfigPathNode.pathAndName
);
const tokensMaxToShowWarningLlmToIdeConfigPathNode = buildConfigFieldPathNode(
  tokensMaxToShowWarningPromptLimitsPathNode.name,
  llmToIdeConfigPathNode.pathAndName
);

const enableSaveAfterFilePatchConfigPathNode = buildConfigFieldPathNode(
  'enableSaveAfterFilePatch',
  postFilePatchActionsConfigPathNode.pathAndName
);
const enableLintingAfterFilePatchConfigPathNode = buildConfigFieldPathNode(
  'enableLintingAfterFilePatch',
  postFilePatchActionsConfigPathNode.pathAndName
);
const enableOpeningPatchedFilesInEditorConfigPathNode = buildConfigFieldPathNode(
  'enableOpeningPatchedFilesInEditor',
  postFilePatchActionsConfigPathNode.pathAndName
);

const instructionsByIdConfigPathNode = buildConfigFieldPathNode(
  'instructionsById',
  instructionsAndVariablesConfigPathNode.pathAndName
);
const sharedVariablesByIdConfigPathNode = buildConfigFieldPathNode(
  'sharedVariablesById',
  instructionsAndVariablesConfigPathNode.pathAndName
);
const sharedReferenceVariablesByIdConfigPathNode = buildConfigFieldPathNode(
  'sharedReferenceVariablesById',
  instructionsAndVariablesConfigPathNode.pathAndName
);

const instructionPathConfigPathNode = buildConfigFieldPathNode('path');
const instructionSkipConfigPathNode = buildConfigFieldPathNode('skip');
const instructionShowInPresetsModeConfigPathNode = buildConfigFieldPathNode('showInPresetsMode');
const instructionShowInQuickInstructionModeConfigPathNode = buildConfigFieldPathNode('showInQuickInstructionMode');

const llmToIdeSanitizationRuleRegexPatternConfigPathNode = buildConfigFieldPathNode('regexPattern');
const llmToIdeSanitizationRuleReplaceWithConfigPathNode = buildConfigFieldPathNode('replaceWith');
const llmToIdeSanitizationRuleSkipForLanguagesConfigPathNode = buildConfigFieldPathNode('skipForLanguages');
const llmToIdeSanitizationRuleSkipForPathsConfigPathNode = buildConfigFieldPathNode('skipForPaths');

export const systemConfigPropsMap = {
  llmCopypasterConfig: systemConfigPathNode,
  presetIndependentSettings: {
    ...presetIndependentSettingsConfigPathNode,
    allowOutsideWorkspaceRead: allowOutsideWorkspaceReadConfigPathNode,
    allowOutsideWorkspaceWrite: allowOutsideWorkspaceWriteConfigPathNode,
    vitalParsingAnchors: {
      ...vitalParsingAnchorsConfigPathNode,
      PROMPT_DELIMITER_ANCHOR: promptDelimiterAnchorConfigPathNode,
      CODE_LISTING_HEADER_ANCHOR: codeListingHeaderAnchorConfigPathNode,
      FILE_STATUS_ANCHOR: fileStatusAnchorConfigPathNode,
      FILE_EDITED_FULL_ANCHOR: fileEditedFullAnchorConfigPathNode,
      FILE_CREATED_ANCHOR: fileCreatedAnchorConfigPathNode,
      FILE_DELETED_ANCHOR: fileDeletedAnchorConfigPathNode,
      END_OF_OUTPUT_ANCHOR: endOfOutputAnchorConfigPathNode,
    },
    notificationSettings: {
      ...notificationSettingsConfigPathNode,
      configValidation: {
        ...configValidationNotificationSettingsConfigPathNode,
        suppressWarningIssuesToast: suppressWarningIssuesToastConfigPathNode,
        suppressRecommendationIssuesToast: suppressRecommendationIssuesToastConfigPathNode,
        suppressNoIssuesToast: suppressNoIssuesToastConfigPathNode,
      },
    },
  },
  presetDependentSettings: {
    ...presetDependentSettingsConfigPathNode,
    skipInstructions: skipInstructionsConfigPathNode,
    skipCodeListings: skipCodeListingsConfigPathNode,
    ideToLlm: {
      ...ideToLlmConfigPathNode,
      skipPromptSizeStatsInCopyNotification: skipPromptSizeStatsInCopyNotificationIdeToLlmConfigPathNode,
      charsPerToken: charsPerTokenIdeToLlmConfigPathNode,
      linesMaxToShowWarning: linesMaxToShowWarningIdeToLlmConfigPathNode,
      tokensMaxToShowWarning: tokensMaxToShowWarningIdeToLlmConfigPathNode,
    },
    llmToIde: {
      ...llmToIdeConfigPathNode,
      skipPromptSizeStatsInCopyNotification: skipPromptSizeStatsInCopyNotificationLlmToIdeConfigPathNode,
      charsPerToken: charsPerTokenLlmToIdeConfigPathNode,
      linesMaxToShowWarning: linesMaxToShowWarningLlmToIdeConfigPathNode,
      tokensMaxToShowWarning: tokensMaxToShowWarningLlmToIdeConfigPathNode,
    },
    postFilePatchActions: {
      ...postFilePatchActionsConfigPathNode,
      enableSaveAfterFilePatch: enableSaveAfterFilePatchConfigPathNode,
      enableLintingAfterFilePatch: enableLintingAfterFilePatchConfigPathNode,
      enableOpeningPatchedFilesInEditor: enableOpeningPatchedFilesInEditorConfigPathNode,
    },
    instructionsAndVariables: {
      ...instructionsAndVariablesConfigPathNode,
      instructionsById: instructionsByIdConfigPathNode,
      sharedVariablesById: sharedVariablesByIdConfigPathNode,
      sharedReferenceVariablesById: sharedReferenceVariablesByIdConfigPathNode,
    },
    llmToIdeSanitizationRulesById: llmToIdeSanitizationRulesByIdConfigPathNode,
  },
  promptLimits: {
    skipPromptSizeStatsInCopyNotification: skipPromptSizeStatsInCopyNotificationPromptLimitsPathNode,
    charsPerToken: charsPerTokenPromptLimitsPathNode,
    linesMaxToShowWarning: linesMaxToShowWarningPromptLimitsPathNode,
    tokensMaxToShowWarning: tokensMaxToShowWarningPromptLimitsPathNode,
  },
  instruction: {
    path: instructionPathConfigPathNode,
    skip: instructionSkipConfigPathNode,
    showInPresetsMode: instructionShowInPresetsModeConfigPathNode,
    showInQuickInstructionMode: instructionShowInQuickInstructionModeConfigPathNode,
  },
  llmToIdeSanitizationRule: {
    regexPattern: llmToIdeSanitizationRuleRegexPatternConfigPathNode,
    replaceWith: llmToIdeSanitizationRuleReplaceWithConfigPathNode,
    skipForLanguages: llmToIdeSanitizationRuleSkipForLanguagesConfigPathNode,
    skipForPaths: llmToIdeSanitizationRuleSkipForPathsConfigPathNode,
  },
} as const;

function buildConfigFieldPathNode<const TName extends string>(fieldName: TName): ConfigFieldPathNode<TName, ''>;
function buildConfigFieldPathNode<const TName extends string, const TPath extends string>(
  fieldName: TName,
  parentPath: TPath
): ConfigFieldPathNode<TName, TPath>;
function buildConfigFieldPathNode(fieldName: string, normalizedParentPath = '') {
  return {
    name: fieldName,
    path: normalizedParentPath,
    pathAndName: normalizedParentPath ? `${normalizedParentPath}.${fieldName}` : fieldName,
  };
}

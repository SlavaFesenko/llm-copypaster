// This map has two goals.
//
// 1) It is the single source of truth for system contract field names.
// TS interfaces, Zod schemas, and path metadata should read field names from here,
// so contract rename happens in one place and stays consistent.
//
// 2) It provides a convenient helper for string property paths.
// TypeScript has no reflection for property access chains,
// so code like x.y.z cannot be converted into "x.y.z" automatically.
//
// This map is metadata for field names and paths, not for runtime config values.
//
// This map is intentionally NOT used by regular TS-interface clients
// such as config readers/mergers at runtime.
// Those clients should keep normal dot access for readability.
// Rename safety there is already provided by contract-driven compile-time errors,
// and fixing them after a rename is cheaper than permanently polluting consumer code
// with map-based property access.
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

const llmCopypasterConfigPathNode = buildConfigFieldPathNode('llmCopypasterConfig');
const nonOverrideableSettingsConfigPathNode = buildConfigFieldPathNode('nonOverrideableSettings');
const allowOutsideWorkspaceReadConfigPathNode = buildConfigFieldPathNode(
  'allowOutsideWorkspaceRead',
  nonOverrideableSettingsConfigPathNode.pathAndName
);
const allowOutsideWorkspaceWriteConfigPathNode = buildConfigFieldPathNode(
  'allowOutsideWorkspaceWrite',
  nonOverrideableSettingsConfigPathNode.pathAndName
);
const vitalParsingAnchorsConfigPathNode = buildConfigFieldPathNode(
  'vitalParsingAnchors',
  nonOverrideableSettingsConfigPathNode.pathAndName
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

const coreSettingsConfigPathNode = buildConfigFieldPathNode('coreSettings');
const skipInstructionsConfigPathNode = buildConfigFieldPathNode('skipInstructions', coreSettingsConfigPathNode.pathAndName);
const skipCodeListingsConfigPathNode = buildConfigFieldPathNode('skipCodeListings', coreSettingsConfigPathNode.pathAndName);
const ideToLlmConfigPathNode = buildConfigFieldPathNode('ideToLlm', coreSettingsConfigPathNode.pathAndName);
const llmToIdeConfigPathNode = buildConfigFieldPathNode('llmToIde', coreSettingsConfigPathNode.pathAndName);
const postFilePatchActionsConfigPathNode = buildConfigFieldPathNode(
  'postFilePatchActions',
  coreSettingsConfigPathNode.pathAndName
);
const instructionsAndVariablesConfigPathNode = buildConfigFieldPathNode(
  'instructionsAndVariables',
  coreSettingsConfigPathNode.pathAndName
);
const llmToIdeSanitizationRulesByIdConfigPathNode = buildConfigFieldPathNode(
  'llmToIdeSanitizationRulesById',
  coreSettingsConfigPathNode.pathAndName
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
const instructionShowInOverrideModeConfigPathNode = buildConfigFieldPathNode('showInOverrideMode');
const instructionShowInQuickInstructionModeConfigPathNode = buildConfigFieldPathNode('showInQuickInstructionMode');

const llmToIdeSanitizationRuleRegexPatternConfigPathNode = buildConfigFieldPathNode('regexPattern');
const llmToIdeSanitizationRuleReplaceWithConfigPathNode = buildConfigFieldPathNode('replaceWith');
const llmToIdeSanitizationRuleSkipForLanguagesConfigPathNode = buildConfigFieldPathNode('skipForLanguages');
const llmToIdeSanitizationRuleSkipForPathsConfigPathNode = buildConfigFieldPathNode('skipForPaths');

export const systemConfigFieldPathMap = {
  llmCopypasterConfig: llmCopypasterConfigPathNode,
  nonOverrideableSettings: {
    ...nonOverrideableSettingsConfigPathNode,
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
  },
  coreSettings: {
    ...coreSettingsConfigPathNode,
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
    showInOverrideMode: instructionShowInOverrideModeConfigPathNode,
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

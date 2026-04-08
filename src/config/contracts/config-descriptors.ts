import { z } from 'zod';
import {
  arrayConfigField,
  buildConfigPathTree,
  buildSystemSchema,
  buildUserSchema,
  nullableConfigField,
  objectConfigField,
  recordConfigField,
  scalarConfigField,
  unknownConfigField,
} from '../helpers/dynamic-config-builders';

// #region Shared Zod-Helpers (has to be declared before use)

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveFiniteNumberSchema = z.number().finite().positive();

function buildVitalAnchorSchema() {
  const vitalAnchorMinLength = 3;

  return z.string().refine(anchorValue => anchorValue.trim().length >= vitalAnchorMinLength, {
    message: `Anchor must be at least ${vitalAnchorMinLength} chars after trim to make parsing more fragile`,
  });
}

// #endregion

// This descriptor tree is the single source of truth for config field names, schemas, paths, and merge policies
export const llmCopypasterConfigDescriptor = objectConfigField({
  nonOverrideableSettings: objectConfigField({
    allowOutsideWorkspaceRead: scalarConfigField(z.boolean()),
    allowOutsideWorkspaceWrite: scalarConfigField(z.boolean()),
    vitalParsingAnchors: objectConfigField({
      PROMPT_DELIMITER_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      CODE_LISTING_HEADER_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      FILE_STATUS_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      FILE_EDITED_FULL_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      FILE_CREATED_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      FILE_DELETED_ANCHOR: scalarConfigField(buildVitalAnchorSchema()),
      END_OF_OUTPUT_ANCHOR: nullableConfigField(scalarConfigField(buildVitalAnchorSchema())),
    }),
  }),
  coreSettings: objectConfigField({
    skipInstructions: scalarConfigField(z.boolean()),
    skipCodeListings: scalarConfigField(z.boolean()),
    ideToLlm: objectConfigField({
      skipPromptSizeStatsInCopyNotification: scalarConfigField(z.boolean()),
      charsPerToken: scalarConfigField(positiveFiniteNumberSchema),
      linesMaxToShowWarning: scalarConfigField(nonNegativeIntegerSchema),
      tokensMaxToShowWarning: scalarConfigField(nonNegativeIntegerSchema),
    }),
    llmToIde: objectConfigField({
      skipPromptSizeStatsInCopyNotification: scalarConfigField(z.boolean()),
      charsPerToken: scalarConfigField(positiveFiniteNumberSchema),
      linesMaxToShowWarning: scalarConfigField(nonNegativeIntegerSchema),
      tokensMaxToShowWarning: scalarConfigField(nonNegativeIntegerSchema),
    }),
    postFilePatchActions: objectConfigField({
      enableSaveAfterFilePatch: scalarConfigField(z.boolean()),
      enableLintingAfterFilePatch: scalarConfigField(z.boolean()),
      enableOpeningPatchedFilesInEditor: scalarConfigField(z.boolean()),
    }),
    instructionsAndVariables: objectConfigField({
      instructionsById: recordConfigField(
        objectConfigField({
          path: scalarConfigField(nonEmptyStringSchema),
          skip: scalarConfigField(z.boolean()),
          showInOverrideMode: scalarConfigField(z.boolean(), false),
          showInQuickInstructionMode: scalarConfigField(z.boolean(), false),
        }),
        ['path', 'skip']
      ),
      sharedVariablesById: recordConfigField(unknownConfigField()),
      sharedReferenceVariablesById: recordConfigField(unknownConfigField()),
    }),
    llmToIdeSanitizationRulesById: recordConfigField(
      objectConfigField({
        regexPattern: scalarConfigField(nonEmptyStringSchema),
        replaceWith: scalarConfigField(z.string()),
        skipForLanguages: arrayConfigField(nonEmptyStringSchema),
        skipForPaths: arrayConfigField(nonEmptyStringSchema),
      }),
      ['regexPattern', 'replaceWith', 'skipForLanguages', 'skipForPaths']
    ),
  }),
});

export const nonOverrideableSettingsConfigDescriptor = llmCopypasterConfigDescriptor.fields.nonOverrideableSettings;
export const coreSettingsConfigDescriptor = llmCopypasterConfigDescriptor.fields.coreSettings;
export const vitalParsingAnchorsConfigDescriptor = nonOverrideableSettingsConfigDescriptor.fields.vitalParsingAnchors;
export const promptLimitsConfigDescriptor = coreSettingsConfigDescriptor.fields.ideToLlm;
export const llmToIdeConfigDescriptor = coreSettingsConfigDescriptor.fields.llmToIde;
export const postFilePatchActionsConfigDescriptor = coreSettingsConfigDescriptor.fields.postFilePatchActions;
export const instructionsAndVariablesConfigDescriptor = coreSettingsConfigDescriptor.fields.instructionsAndVariables;
export const llmToIdeSanitizationRulesByIdConfigDescriptor =
  coreSettingsConfigDescriptor.fields.llmToIdeSanitizationRulesById;
export const llmToIdeSanitizationRuleConfigDescriptor = llmToIdeSanitizationRulesByIdConfigDescriptor.valueDescriptor;
export const instructionsByIdConfigDescriptor = instructionsAndVariablesConfigDescriptor.fields.instructionsById;
export const instructionConfigDescriptor = instructionsByIdConfigDescriptor.valueDescriptor;

export const llmCopypasterConfigSchema = buildSystemSchema(llmCopypasterConfigDescriptor);
export const nonOverrideableSettingsConfigSchema = buildSystemSchema(nonOverrideableSettingsConfigDescriptor);
export const coreSettingsConfigSchema = buildSystemSchema(coreSettingsConfigDescriptor);
export const vitalParsingAnchorsConfigSchema = buildSystemSchema(vitalParsingAnchorsConfigDescriptor);
export const promptLimitsConfigSchema = buildSystemSchema(promptLimitsConfigDescriptor);
export const ideToLlmConfigSchema = buildSystemSchema(promptLimitsConfigDescriptor);
export const llmToIdeConfigSchema = buildSystemSchema(llmToIdeConfigDescriptor);
export const postFilePatchActionsConfigSchema = buildSystemSchema(postFilePatchActionsConfigDescriptor);
export const instructionsAndVariablesConfigSchema = buildSystemSchema(instructionsAndVariablesConfigDescriptor);
export const llmToIdeSanitizationRuleConfigSchema = buildSystemSchema(llmToIdeSanitizationRuleConfigDescriptor);
export const instructionConfigSchema = buildSystemSchema(instructionConfigDescriptor);

export const llmCopypasterUserConfigBaseSchema = buildUserSchema(llmCopypasterConfigDescriptor);
export const nonOverrideableSettingsUserConfigSchema = buildUserSchema(nonOverrideableSettingsConfigDescriptor);
export const coreSettingsUserConfigSchema = buildUserSchema(coreSettingsConfigDescriptor);
export const vitalParsingAnchorsUserConfigSchema = buildUserSchema(vitalParsingAnchorsConfigDescriptor);
export const promptLimitsUserConfigSchema = buildUserSchema(promptLimitsConfigDescriptor);
export const ideToLlmUserConfigSchema = buildUserSchema(promptLimitsConfigDescriptor);
export const llmToIdeUserConfigSchema = buildUserSchema(llmToIdeConfigDescriptor);
export const postFilePatchActionsUserConfigSchema = buildUserSchema(postFilePatchActionsConfigDescriptor);
export const instructionsAndVariablesUserConfigSchema = buildUserSchema(instructionsAndVariablesConfigDescriptor);
export const llmToIdeSanitizationRuleUserConfigSchema = buildUserSchema(llmToIdeSanitizationRuleConfigDescriptor);
export const instructionUserConfigSchema = buildUserSchema(instructionConfigDescriptor);

export const llmCopypasterConfigPaths = buildConfigPathTree(llmCopypasterConfigDescriptor);

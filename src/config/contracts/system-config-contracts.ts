import {
  coreSettingsConfigSchema,
  ideToLlmConfigSchema,
  instructionConfigSchema,
  instructionsAndVariablesConfigSchema,
  llmCopypasterConfigSchema,
  llmToIdeConfigSchema,
  llmToIdeSanitizationRuleConfigSchema,
  nonOverrideableSettingsConfigSchema,
  postFilePatchActionsConfigSchema,
  promptLimitsConfigSchema,
  vitalParsingAnchorsConfigSchema,
} from './config-descriptors';

// TODO: сделай фабрику для TS-типов + zod-config если можно, задача - сделать схему всех полей в одном месте проекта
// чтобы поддерживать как минмум переименование в одном месте фабрики, а не разбросанным в куче мест.

// !!! After changing zod-schema run manually "npm run compile", which will trigger "postcompile" → "node ./scripts/generate-json-schema.js"

// ! this llmCopypasterConfigSchema + path is hardcoded in "generate-json-schema.js", so be careful, auto-rename won't work!
export { llmCopypasterConfigSchema };

export type LlmCopypasterConfig = typeof llmCopypasterConfigSchema._output;
export type NonOverrideableSettingsConfig = typeof nonOverrideableSettingsConfigSchema._output;
export type CoreSettingsConfig = typeof coreSettingsConfigSchema._output;
export type VitalParsingAnchorsConfig = typeof vitalParsingAnchorsConfigSchema._output;
export type IdeToLlmConfig = typeof ideToLlmConfigSchema._output;
export type LlmToIdeConfig = typeof llmToIdeConfigSchema._output;
export type PromptLimitsConfig = typeof promptLimitsConfigSchema._output;
export type PostFilePatchActionsConfig = typeof postFilePatchActionsConfigSchema._output;
export type InstructionsAndVariablesConfig = typeof instructionsAndVariablesConfigSchema._output;
export type LlmToIdeSanitizationRuleConfig = typeof llmToIdeSanitizationRuleConfigSchema._output;
export type InstructionConfig = typeof instructionConfigSchema._output;

export {
  coreSettingsConfigSchema,
  ideToLlmConfigSchema,
  instructionConfigSchema,
  instructionsAndVariablesConfigSchema,
  llmToIdeConfigSchema,
  llmToIdeSanitizationRuleConfigSchema,
  nonOverrideableSettingsConfigSchema,
  postFilePatchActionsConfigSchema,
  promptLimitsConfigSchema,
  vitalParsingAnchorsConfigSchema,
};

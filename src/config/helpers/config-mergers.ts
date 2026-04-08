import {
  coreSettingsConfigDescriptor,
  instructionsAndVariablesConfigDescriptor,
  llmCopypasterConfigDescriptor,
  llmToIdeSanitizationRulesByIdConfigDescriptor,
  nonOverrideableSettingsConfigDescriptor,
  postFilePatchActionsConfigDescriptor,
  promptLimitsConfigDescriptor,
  vitalParsingAnchorsConfigDescriptor,
} from '../contracts/config-descriptors';
import {
  CoreSettingsConfig,
  IdeToLlmConfig,
  InstructionConfig,
  InstructionsAndVariablesConfig,
  LlmCopypasterConfig,
  LlmToIdeConfig,
  LlmToIdeSanitizationRuleConfig,
  NonOverrideableSettingsConfig,
  PostFilePatchActionsConfig,
  VitalParsingAnchorsConfig,
} from '../contracts/system-config-contracts';
import {
  CoreSettingsUserConfig,
  IdeToLlmUserConfig,
  InstructionsAndVariablesUserConfig,
  InstructionUserConfig,
  LlmCopypasterUserConfig,
  LlmToIdeSanitizationRuleUserConfig,
  LlmToIdeUserConfig,
  NonOverrideableSettingsUserConfig,
  PostFilePatchActionsUserConfig,
  VitalParsingAnchorsUserConfig,
} from '../contracts/user-config-contracts';
import { mergeByDescriptor, mergeRecordDescriptorValues } from './dynamic-config-builders';

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
  // Only the schema-backed system fields participate in the main merge flow
  return mergeObjectDescriptorFields(llmCopypasterConfigDescriptor, systemConfig, {
    nonOverrideableSettings: userConfig.nonOverrideableSettings,
    coreSettings: userConfig.coreSettings,
  });
}

export function mergeNonOverrideableSettingsConfig(
  baseSettings: NonOverrideableSettingsConfig,
  userSettings?: NonOverrideableSettingsUserConfig
): NonOverrideableSettingsConfig {
  return mergeObjectDescriptorFields(nonOverrideableSettingsConfigDescriptor, baseSettings, userSettings);
}

export function mergeLlmToIdeParsingAnchors(
  baseAnchors: VitalParsingAnchorsConfig,
  userAnchors?: VitalParsingAnchorsUserConfig
): VitalParsingAnchorsConfig {
  return mergeObjectDescriptorFields(vitalParsingAnchorsConfigDescriptor, baseAnchors, userAnchors);
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
  return mergeObjectDescriptorFields(coreSettingsConfigDescriptor, baseSettings, userSettings);
}

export function mergeIdeToLlmContextConfig(
  baseConfig: IdeToLlmConfig,
  userConfig: IdeToLlmUserConfig | undefined
): IdeToLlmConfig {
  return mergeObjectDescriptorFields(promptLimitsConfigDescriptor, baseConfig, userConfig);
}

export function mergeLlmToIdeContextConfig(
  baseConfig: LlmToIdeConfig,
  userConfig: LlmToIdeUserConfig | undefined
): LlmToIdeConfig {
  return mergeObjectDescriptorFields(promptLimitsConfigDescriptor, baseConfig, userConfig);
}

export function mergePostFilePatchActionsConfig(
  baseConfig: PostFilePatchActionsConfig,
  userConfig: PostFilePatchActionsUserConfig | undefined
): PostFilePatchActionsConfig {
  return mergeObjectDescriptorFields(postFilePatchActionsConfigDescriptor, baseConfig, userConfig);
}

export function mergeInstructionsAndVariablesConfig(
  baseConfig: InstructionsAndVariablesConfig,
  userConfig: InstructionsAndVariablesUserConfig | undefined
): InstructionsAndVariablesConfig {
  return mergeObjectDescriptorFields(instructionsAndVariablesConfigDescriptor, baseConfig, userConfig);
}

export function mapInstructionsById(
  baseInstructionsById: Record<string, InstructionConfig>,
  userInstructionsById: Record<string, InstructionUserConfig>
): Record<string, InstructionConfig> {
  return mergeRecordDescriptorValues(
    instructionsAndVariablesConfigDescriptor.fields.instructionsById,
    baseInstructionsById,
    userInstructionsById
  );
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
  return mergeRecordDescriptorValues(llmToIdeSanitizationRulesByIdConfigDescriptor, baseRulesById, userRulesById);
}

export function mergeOptionalValue<T>(baseValue: T, userValue: T | undefined): T {
  if (userValue === undefined) return baseValue;

  return userValue;
}

function mergeObjectDescriptorFields<TDescriptor extends typeof llmCopypasterConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: LlmCopypasterConfig,
  userValue: LlmCopypasterUserConfig | undefined
): LlmCopypasterConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof nonOverrideableSettingsConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: NonOverrideableSettingsConfig,
  userValue: NonOverrideableSettingsUserConfig | undefined
): NonOverrideableSettingsConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof vitalParsingAnchorsConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: VitalParsingAnchorsConfig,
  userValue: VitalParsingAnchorsUserConfig | undefined
): VitalParsingAnchorsConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof coreSettingsConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: CoreSettingsConfig,
  userValue: CoreSettingsUserConfig | undefined
): CoreSettingsConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof promptLimitsConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: IdeToLlmConfig | LlmToIdeConfig,
  userValue: IdeToLlmUserConfig | LlmToIdeUserConfig | undefined
): IdeToLlmConfig | LlmToIdeConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof postFilePatchActionsConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: PostFilePatchActionsConfig,
  userValue: PostFilePatchActionsUserConfig | undefined
): PostFilePatchActionsConfig;
function mergeObjectDescriptorFields<TDescriptor extends typeof instructionsAndVariablesConfigDescriptor>(
  descriptor: TDescriptor,
  baseValue: InstructionsAndVariablesConfig,
  userValue: InstructionsAndVariablesUserConfig | undefined
): InstructionsAndVariablesConfig;
function mergeObjectDescriptorFields(
  descriptor:
    | typeof llmCopypasterConfigDescriptor
    | typeof nonOverrideableSettingsConfigDescriptor
    | typeof vitalParsingAnchorsConfigDescriptor
    | typeof coreSettingsConfigDescriptor
    | typeof promptLimitsConfigDescriptor
    | typeof postFilePatchActionsConfigDescriptor
    | typeof instructionsAndVariablesConfigDescriptor,
  baseValue: unknown,
  userValue: unknown
): unknown {
  return mergeByDescriptor(descriptor, baseValue as never, userValue as never);
}

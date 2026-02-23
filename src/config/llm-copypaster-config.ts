export interface LlmCopypasterPromptsConfig {
  default: string;
  overrides: Record<string, string>;
}

export interface LlmCopypasterSanitizationRule {
  id: string;
  pattern: string;
  replaceWith: string;
  disabledForLanguages?: string[];
  disabledForPaths?: string[];
}

export interface LlmCopypasterConfig {
  currentLLM: string;
  prompts: LlmCopypasterPromptsConfig;
  sanitizationRules: LlmCopypasterSanitizationRule[];
  autoFormatAfterApply: boolean;
  includeTechPrompt: boolean;
}

export function buildDefaultConfig(): LlmCopypasterConfig {
  return {
    currentLLM: 'default',
    prompts: {
      default: '',
      overrides: {},
    },
    sanitizationRules: [
      {
        id: 'strip-codefence',
        pattern: '`{3}[^\r\n]*', // Matches a triple-backtick fence marker with an optional language tag on the same line (does not consume the newline)
        replaceWith: '',
        disabledForLanguages: ['markdown'],
        disabledForPaths: ['docs/'],
      },
    ],
    autoFormatAfterApply: false,
    includeTechPrompt: true,
  };
}

export function mergeConfigs(
  defaultConfig: LlmCopypasterConfig,
  settingsConfig: Partial<LlmCopypasterConfig>,
  fileConfig: Partial<LlmCopypasterConfig> | null
): LlmCopypasterConfig {
  const mergedConfig: LlmCopypasterConfig = {
    ...defaultConfig,
    ...settingsConfig,
    prompts: {
      ...defaultConfig.prompts,
      ...(settingsConfig.prompts ?? {}),
      ...(fileConfig?.prompts ?? {}),
    },
    sanitizationRules: fileConfig?.sanitizationRules ?? settingsConfig.sanitizationRules ?? defaultConfig.sanitizationRules,
    autoFormatAfterApply:
      fileConfig?.autoFormatAfterApply ?? settingsConfig.autoFormatAfterApply ?? defaultConfig.autoFormatAfterApply,
    includeTechPrompt: fileConfig?.includeTechPrompt ?? settingsConfig.includeTechPrompt ?? defaultConfig.includeTechPrompt,
    currentLLM: fileConfig?.currentLLM ?? settingsConfig.currentLLM ?? defaultConfig.currentLLM,
  };

  return mergedConfig;
}

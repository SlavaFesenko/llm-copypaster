import { LlmCopypasterConfig } from '../llm-copypaster-config';

export function buildTechPromptText(config: LlmCopypasterConfig): string {
  const activePrompt = pickPromptByCurrentLlm(config);

  if (!activePrompt.trim()) return '';

  return activePrompt;
}

function pickPromptByCurrentLlm(config: LlmCopypasterConfig): string {
  const override = config.prompts.overrides[config.currentLLM];

  if (override?.trim()) return override;

  return config.prompts.default ?? '';
}

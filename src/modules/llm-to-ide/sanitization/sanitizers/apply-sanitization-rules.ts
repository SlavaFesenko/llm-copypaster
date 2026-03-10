import { LlmCopypasterConfig } from '../../../../config-service';

export interface ApplySanitizationRulesFileMeta {
  path: string;
  languageId?: string;
}

export function applySanitizationRules(
  inputText: string,
  fileMeta: ApplySanitizationRulesFileMeta,
  config: LlmCopypasterConfig
): string {
  let outputText = inputText;

  const sanitizationRulesById = config.coreSettings.llmToIdeSanitizationRulesById;

  for (const [ruleId, ruleConfig] of Object.entries(sanitizationRulesById)) {
    if (isRuleDisabledForFile(ruleConfig, fileMeta)) continue;

    const regexp = new RegExp(ruleConfig.regexPattern, 'g');
    outputText = outputText.replace(regexp, ruleConfig.replaceWith);
  }

  return outputText;
}

function isRuleDisabledForFile(
  rule: { skipForLanguages?: string[]; skipForPaths?: string[] },
  fileMeta: ApplySanitizationRulesFileMeta
): boolean {
  const skipForLanguages = rule.skipForLanguages ?? [];
  const skipForPaths = rule.skipForPaths ?? [];

  if (fileMeta.languageId && skipForLanguages.includes(fileMeta.languageId)) return true;

  for (const skipPathPrefix of skipForPaths) {
    if (fileMeta.path.startsWith(skipPathPrefix)) return true;
  }

  return false;
}

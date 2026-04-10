import { SystemConfig } from '../../../../config/contracts/system-config-contracts';

export interface ApplySanitizationRulesFileMeta {
  path: string;
  languageId?: string;
}

export function applySanitizationRules(
  inputText: string,
  fileMeta: ApplySanitizationRulesFileMeta,
  config: SystemConfig
): string {
  let outputText = inputText;

  const sanitizationRulesById = config.presetDependentSettings.llmToIdeSanitizationRulesById;

  for (const [_, rule] of Object.entries(sanitizationRulesById)) {
    if (rule.skip) continue;

    if (isRuleDisabledForFile(rule.skipForLanguages, rule.skipForPaths, fileMeta)) continue;

    const regexp = new RegExp(rule.regexPattern, rule.regexFlags ?? '');

    outputText = outputText.replace(regexp, rule.replaceWith);
  }

  return outputText;
}

function isRuleDisabledForFile(
  skipForLanguages: string[] | null,
  skipForPaths: string[] | null,
  fileMeta: ApplySanitizationRulesFileMeta
): boolean {
  // Null means "no filter configured"
  if (fileMeta.languageId && skipForLanguages?.includes(fileMeta.languageId)) return true;

  for (const skipPathPrefix of skipForPaths ?? []) {
    if (fileMeta.path.startsWith(skipPathPrefix)) return true;
  }

  return false;
}

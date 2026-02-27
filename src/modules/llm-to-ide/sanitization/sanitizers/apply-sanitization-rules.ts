import { LlmCopypasterConfig } from '../../../../config-service';
import { OutputChannelLogger } from '../../../../utils/output-channel-logger';

export interface ApplySanitizationRulesFileMeta {
  path: string;
  languageId?: string;
}

export function applySanitizationRules(
  inputText: string,
  fileMeta: ApplySanitizationRulesFileMeta,
  config: LlmCopypasterConfig,
  logger: OutputChannelLogger
): string {
  let outputText = inputText;

  const sanitizationRulesById = config.baseSettings.llmToIdeSanitizationRulesById;

  for (const [ruleId, ruleConfig] of Object.entries(sanitizationRulesById)) {
    if (isRuleDisabledForFile(ruleConfig, fileMeta)) continue;

    try {
      const regexp = new RegExp(ruleConfig.pattern, 'g');
      outputText = outputText.replace(regexp, ruleConfig.replaceWith);
    } catch (error) {
      logger.warn(`Sanitization rule failed (${ruleId}) for ${fileMeta.path}: ${String(error)}`);
    }
  }

  return outputText;
}

function isRuleDisabledForFile(
  rule: { disabledForLanguages?: string[]; disabledForPaths?: string[] },
  fileMeta: ApplySanitizationRulesFileMeta
): boolean {
  const disabledForLanguages = rule.disabledForLanguages ?? [];
  const disabledForPaths = rule.disabledForPaths ?? [];

  if (fileMeta.languageId && disabledForLanguages.includes(fileMeta.languageId)) return true;

  for (const disabledPathPrefix of disabledForPaths) {
    if (fileMeta.path.startsWith(disabledPathPrefix)) return true;
  }

  return false;
}

import { LlmCopypasterConfig } from '../../../config/llm-copypaster-config';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';

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

  for (const rule of config.sanitizationRules) {
    if (isRuleDisabledForFile(rule, fileMeta)) continue;

    try {
      const regexp = new RegExp(rule.pattern, 'g');
      outputText = outputText.replace(regexp, rule.replaceWith);
    } catch (error) {
      logger.warn(`Sanitization rule failed (${rule.id}) for ${fileMeta.path}: ${String(error)}`);
    }
  }

  return outputText;
}

function isRuleDisabledForFile(
  rule: { disabledForLanguages?: string[]; disabledForPaths?: string[] },
  fileMeta: ApplySanitizationRulesFileMeta
): boolean {
  if (fileMeta.languageId && rule.disabledForLanguages?.includes(fileMeta.languageId)) return true;

  if (rule.disabledForPaths) {
    for (const disabledPathPrefix of rule.disabledForPaths) {
      if (fileMeta.path.startsWith(disabledPathPrefix)) return true;
    }
  }

  return false;
}

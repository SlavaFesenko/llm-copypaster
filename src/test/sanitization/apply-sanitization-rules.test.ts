import get from 'lodash/get';
import assert from 'node:assert/strict';

import { ConfigService } from '../../config/config-service';
import { LlmCopypasterConfig, LlmToIdeSanitizationRuleConfig } from '../../config/system-config-contracts';
import { applySanitizationRules } from '../../modules/llm-to-ide/sanitization/sanitizers/apply-sanitization-rules';
import { buildStripCodefenceCases } from './cases/strip-codefence-cases';

suite('applySanitizationRules', () => {
  test('applies strip-codefence cases from current system config', async () => {
    const cases = [...buildStripCodefenceCases()];
    const systemConfig = await new ConfigService().getSystemConfig();

    const stripCodefenceRule = get(systemConfig, 'coreSettings.llmToIdeSanitizationRulesById.strip-codefence') as
      | LlmToIdeSanitizationRuleConfig
      | undefined;

    assert.ok(stripCodefenceRule, 'strip-codefence rule was not found in current system config');

    const config: LlmCopypasterConfig = {
      ...systemConfig,
      coreSettings: {
        ...systemConfig.coreSettings,
        llmToIdeSanitizationRulesById: {
          'strip-codefence': stripCodefenceRule,
        },
      },
    };

    for (const testCase of cases) {
      const outputText = applySanitizationRules(testCase.inputText, testCase.fileMeta, config);

      assert.equal(outputText, testCase.expectedText, `Case failed: ${testCase.name}`);
    }
  });

  test('logs warn and keeps output unchanged when rule RegExp construction fails', async () => {
    const systemConfig = await new ConfigService().getSystemConfig();

    const invalidRule: LlmToIdeSanitizationRuleConfig = {
      regexPattern: '[',
      replaceWith: '',
      skipForLanguages: [],
      skipForPaths: [],
    };

    const config: LlmCopypasterConfig = {
      ...systemConfig,
      coreSettings: {
        ...systemConfig.coreSettings,
        llmToIdeSanitizationRulesById: {
          'invalid-regexp': invalidRule,
        },
      },
    };

    const inputText = 'hello';
    const outputText = applySanitizationRules(inputText, { path: 'src/a.ts' }, config);

    assert.equal(outputText, inputText);
  });
});

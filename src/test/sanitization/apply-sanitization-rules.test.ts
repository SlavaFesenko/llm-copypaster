import get from 'lodash/get';
import assert from 'node:assert/strict';

import { ConfigService, LlmCopypasterInternalConfig, LlmToIdeSanitizationRuleConfig } from '../../config-service';
import { applySanitizationRules } from '../../modules/llm-to-ide/sanitization/sanitizers/apply-sanitization-rules';
import { buildStripCodefenceCases } from './cases/strip-codefence-cases';
import { createLoggerMock } from './test-helpers/logger-mock';

suite('applySanitizationRules', () => {
  test('applies strip-codefence cases from current system config', async () => {
    const cases = [...buildStripCodefenceCases()];
    const { logger, warnCalls } = createLoggerMock();
    const systemConfig = await new ConfigService(logger).getSystemConfig();

    const stripCodefenceRule = get(systemConfig, 'coreSettings.llmToIdeSanitizationRulesById.strip-codefence') as
      | LlmToIdeSanitizationRuleConfig
      | undefined;

    assert.ok(stripCodefenceRule, 'strip-codefence rule was not found in current system config');

    const config: LlmCopypasterInternalConfig = {
      ...systemConfig,
      coreSettings: {
        ...systemConfig.coreSettings,
        llmToIdeSanitizationRulesById: {
          'strip-codefence': stripCodefenceRule,
        },
      },
    };

    for (const testCase of cases) {
      const outputText = applySanitizationRules(testCase.inputText, testCase.fileMeta, config, logger);

      assert.equal(outputText, testCase.expectedText, `Case failed: ${testCase.name}`);
    }

    assert.equal(warnCalls.length, 0);
  });

  test('logs warn and keeps output unchanged when rule RegExp construction fails', async () => {
    const { logger, warnCalls } = createLoggerMock();
    const systemConfig = await new ConfigService(logger).getSystemConfig();

    const invalidRule: LlmToIdeSanitizationRuleConfig = {
      pattern: '[',
      replaceWith: '',
      disabledForLanguages: [],
      disabledForPaths: [],
    };

    const config: LlmCopypasterInternalConfig = {
      ...systemConfig,
      coreSettings: {
        ...systemConfig.coreSettings,
        llmToIdeSanitizationRulesById: {
          'invalid-regexp': invalidRule,
        },
      },
    };

    const inputText = 'hello';
    const outputText = applySanitizationRules(inputText, { path: 'src/a.ts' }, config, logger);

    assert.equal(outputText, inputText);
    assert.equal(warnCalls.length, 1);
    assert.ok(warnCalls[0].includes('Sanitization rule failed (invalid-regexp) for src/a.ts'));
  });
});

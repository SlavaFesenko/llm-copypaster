import assert from 'node:assert/strict';

import { buildSystemConfig, LlmCopypasterConfig, LlmToIdeSanitizationRuleConfig } from '../../config';
import { applySanitizationRules } from '../../modules/llm-to-ide/sanitization/sanitizers/apply-sanitization-rules';
import { buildStripCodefenceCases } from './cases/strip-codefence-cases';
import { createLoggerMock } from './test-helpers/logger-mock';

suite('applySanitizationRules', () => {
  const defaultConfig = buildSystemConfig();

  test('applies strip-codefence cases', () => {
    const cases = [...buildStripCodefenceCases()];

    for (const testCase of cases) {
      const { logger, warnCalls } = createLoggerMock();

      const outputText = applySanitizationRules(testCase.inputText, testCase.fileMeta, defaultConfig, logger);

      assert.equal(outputText, testCase.expectedText, `Case failed: ${testCase.name}`);
      assert.equal(warnCalls.length, 0, `Unexpected warn for case: ${testCase.name}`);
    }
  });

  test('logs warn and keeps output unchanged when rule RegExp construction fails', () => {
    const { logger, warnCalls } = createLoggerMock();

    const invalidRule: LlmToIdeSanitizationRuleConfig = {
      id: 'invalid-regexp',
      pattern: '[',
      replaceWith: '',
    };

    const config: LlmCopypasterConfig = {
      ...buildSystemConfig(),
      sanitizationRules: [invalidRule],
    };

    const inputText = 'hello';
    const outputText = applySanitizationRules(inputText, { path: 'src/a.ts' }, config, logger);

    assert.equal(outputText, inputText);
    assert.equal(warnCalls.length, 1);
    assert.ok(warnCalls[0].includes('Sanitization rule failed (invalid-regexp) for src/a.ts'));
  });
});

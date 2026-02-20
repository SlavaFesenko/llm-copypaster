import assert from 'node:assert/strict';

import { buildDefaultConfig, LlmCopypasterConfig, LlmCopypasterSanitizationRule } from '../../config/llm-copypaster-config';
import { applySanitizationRules } from '../../llm-to-editor/sanitization/sanitizers/apply-sanitization-rules';
import { buildStripCodefenceCases } from './cases/strip-codefence-cases';
import { createLoggerMock } from './test-helpers/logger-mock';

suite('applySanitizationRules', () => {
  const defaultConfig = buildDefaultConfig();

  const cases = [...buildStripCodefenceCases()];

  for (const testCase of cases) {
    test(testCase.name, () => {
      const { logger, warnCalls } = createLoggerMock();

      const outputText = applySanitizationRules(testCase.inputText, testCase.fileMeta, defaultConfig, logger);

      assert.equal(outputText, testCase.expectedText);
      assert.equal(warnCalls.length, 0);
    });
  }

  test('logs warn and keeps output unchanged when rule RegExp construction fails', () => {
    const { logger, warnCalls } = createLoggerMock();

    const invalidRule: LlmCopypasterSanitizationRule = {
      id: 'invalid-regexp',
      pattern: '[',
      replaceWith: '',
    };

    const config: LlmCopypasterConfig = {
      ...buildDefaultConfig(),
      sanitizationRules: [invalidRule],
    };

    const inputText = 'hello';
    const outputText = applySanitizationRules(inputText, { path: 'src/a.ts' }, config, logger);

    assert.equal(outputText, inputText);
    assert.equal(warnCalls.length, 1);
    assert.ok(warnCalls[0].includes('Sanitization rule failed (invalid-regexp) for src/a.ts'));
  });
});

// import * as assert from 'node:assert';
import assert from 'node:assert/strict';
// import test, { suite } from 'node:test';
import { mapLlmToIdeSanitizationRulesById } from '../../../config/contracts/config-mergers';
import { buildMapLlmToIdeSanitizationRulesByIdCases } from './cases/map-llm-to-ide-sanitization-rules-by-id-cases';

suite('mapLlmToIdeSanitizationRulesById', () => {
  test('merges sanitization rules cases', () => {
    const cases = buildMapLlmToIdeSanitizationRulesByIdCases();

    for (const testCase of cases) {
      const actualResult = mapLlmToIdeSanitizationRulesById(testCase.baseRulesById, testCase.userRulesById);

      assert.deepEqual(actualResult, testCase.expectedRulesById, `Case failed: ${testCase.name}`);
    }
  });
});

import assert from 'node:assert/strict';
import {
  applyUserConfig,
  mapInstructionsById,
  mapLlmToIdeSanitizationRulesById,
  mergeInstructionsSettingsConfig,
  mergeNullableAnchor,
} from '../../../config/contracts/config-mergers';
import { buildApplyUserConfigCases } from './cases/apply-user-config-cases';
import { buildMapInstructionsByIdCases } from './cases/map-instructions-by-id-cases';
import { buildMapLlmToIdeSanitizationRulesByIdCases } from './cases/map-llm-to-ide-sanitization-rules-by-id-cases';
import { buildMergeInstructionsSettingsConfigCases } from './cases/merge-instructions-settings-config-cases';
import { buildMergeNullableAnchorCases } from './cases/merge-nullable-anchor-cases';

suite('mergeNullableAnchor', () => {
  test('merges nullable anchor cases', () => {
    const cases = buildMergeNullableAnchorCases();

    for (const testCase of cases) {
      const actualResult = mergeNullableAnchor(testCase.baseAnchorValue, testCase.userAnchorValue);

      assert.equal(actualResult, testCase.expectedAnchorValue, `Case failed: ${testCase.name}`);
    }
  });
});

suite('mapInstructionsById', () => {
  test('merges instruction cases', () => {
    const cases = buildMapInstructionsByIdCases();

    for (const testCase of cases) {
      const actualResult = mapInstructionsById(testCase.baseInstructionsById, testCase.userInstructionsById);

      assert.deepEqual(actualResult, testCase.expectedInstructionsById, `Case failed: ${testCase.name}`);
    }
  });
});

suite('mergeInstructionsSettingsConfig', () => {
  test('merges instruction settings cases', () => {
    const cases = buildMergeInstructionsSettingsConfigCases();

    for (const testCase of cases) {
      const actualResult = mergeInstructionsSettingsConfig(testCase.baseConfig, testCase.userConfig);

      assert.deepEqual(actualResult, testCase.expectedConfig, `Case failed: ${testCase.name}`);
    }
  });
});

suite('mapLlmToIdeSanitizationRulesById', () => {
  test('merges sanitization rules cases', () => {
    const cases = buildMapLlmToIdeSanitizationRulesByIdCases();

    for (const testCase of cases) {
      const actualResult = mapLlmToIdeSanitizationRulesById(testCase.baseRulesById, testCase.userRulesById);

      assert.deepEqual(actualResult, testCase.expectedRulesById, `Case failed: ${testCase.name}`);
    }
  });
});

suite('applyUserConfig', () => {
  test('applies user config cases', () => {
    const cases = buildApplyUserConfigCases();

    for (const testCase of cases) {
      const actualResult = applyUserConfig(testCase.systemConfig, testCase.userConfig);

      assert.deepEqual(actualResult, testCase.expectedConfig, `Case failed: ${testCase.name}`);
    }
  });
});

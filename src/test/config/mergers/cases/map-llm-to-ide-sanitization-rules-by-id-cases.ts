import { LlmToIdeSanitizationRuleConfig } from '../../../../config/contracts/system-config-contracts';
import { LlmToIdeSanitizationRuleUserConfig } from '../../../../config/contracts/user-config-contracts';

interface MapLlmToIdeSanitizationRulesByIdTestCase {
  name: string;
  baseRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
  userRulesById: Record<string, LlmToIdeSanitizationRuleUserConfig>;
  expectedRulesById: Record<string, LlmToIdeSanitizationRuleConfig>;
}

export function buildMapLlmToIdeSanitizationRulesByIdCases(): MapLlmToIdeSanitizationRulesByIdTestCase[] {
  const codeFence = buildBackticks(3);
  const stripCodeFenceRegexPattern = String.raw`${escapeForRegex(codeFence)}[\s\S]*?${escapeForRegex(codeFence)}`;
  const stripCodeFenceTestRuleId = 'strip-codefence-test';

  return [
    {
      name: 'updates only provided fields for an existing rule and preserves untouched base rules',
      baseRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
        'trim-trailing-spaces': {
          skip: false,
          regexPattern: String.raw`[ \t]+$`,
          regexFlags: 'gm',
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: null,
        },
      },
      userRulesById: {
        [stripCodeFenceTestRuleId]: {
          replaceWith: '\n',
          regexFlags: null,
          skipForPaths: ['generated/'],
        },
      },
      expectedRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: null,
          replaceWith: '\n',
          skipForLanguages: ['markdown'],
          skipForPaths: ['generated/'],
        },
        'trim-trailing-spaces': {
          skip: false,
          regexPattern: String.raw`[ \t]+$`,
          regexFlags: 'gm',
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: null,
        },
      },
    },
    {
      name: 'creates a new rule when all required fields are provided and normalizes optional fields',
      baseRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        'trim-empty-lines': {
          regexPattern: String.raw`^\n+|\n+$`,
          replaceWith: '',
        },
      },
      expectedRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
        'trim-empty-lines': {
          skip: false,
          regexPattern: String.raw`^\n+|\n+$`,
          regexFlags: null,
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: null,
        },
      },
    },
    {
      name: 'skips a new rule when replaceWith is missing',
      baseRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        'trim-empty-lines': {
          regexPattern: String.raw`^\n+|\n+$`,
          regexFlags: 'gm',
          skip: true,
          skipForLanguages: ['plaintext'],
          skipForPaths: ['README.md'],
        },
      },
      expectedRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
    },
    {
      name: 'allows overriding existing rule fields with empty string nulls and false',
      baseRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: true,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'gm',
          replaceWith: 'REMOVED',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/', 'generated/'],
        },
      },
      userRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexFlags: null,
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: null,
        },
      },
      expectedRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: null,
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: null,
        },
      },
    },
    {
      name: 'does not remove existing values when user fields are undefined for an existing rule',
      baseRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        [stripCodeFenceTestRuleId]: {},
      },
      expectedRulesById: {
        [stripCodeFenceTestRuleId]: {
          skip: false,
          regexPattern: stripCodeFenceRegexPattern,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
    },
    {
      name: 'creates a new ignored rule with explicit regex flags and nullable filters',
      baseRulesById: {},
      userRulesById: {
        'strip-html-comments': {
          skip: true,
          regexPattern: String.raw`<!--[\s\S]*?-->`,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: ['generated/'],
        },
      },
      expectedRulesById: {
        'strip-html-comments': {
          skip: true,
          regexPattern: String.raw`<!--[\s\S]*?-->`,
          regexFlags: 'g',
          replaceWith: '',
          skipForLanguages: null,
          skipForPaths: ['generated/'],
        },
      },
    },
  ];
}

function buildBackticks(count: number): string {
  return new Array(count).fill('`').join('');
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

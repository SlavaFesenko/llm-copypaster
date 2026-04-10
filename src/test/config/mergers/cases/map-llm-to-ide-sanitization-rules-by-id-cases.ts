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

  return [
    {
      name: 'updates only provided fields for an existing rule and preserves untouched base rules',
      baseRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
        'trim-trailing-spaces': {
          regexPattern: String.raw`[ \t]+$`,
          replaceWith: '',
          skipForLanguages: [],
          skipForPaths: [],
        },
      },
      userRulesById: {
        'strip-codefence': {
          replaceWith: '\n',
          skipForPaths: ['generated/'],
        },
      },
      expectedRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '\n',
          skipForLanguages: ['markdown'],
          skipForPaths: ['generated/'],
        },
        'trim-trailing-spaces': {
          regexPattern: String.raw`[ \t]+$`,
          replaceWith: '',
          skipForLanguages: [],
          skipForPaths: [],
        },
      },
    },
    {
      name: 'creates a new rule when all required fields are provided',
      baseRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        'trim-empty-lines': {
          regexPattern: String.raw`^\n+|\n+$`,
          replaceWith: '',
          skipForLanguages: ['plaintext'],
          skipForPaths: ['README.md'],
        },
      },
      expectedRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
        'trim-empty-lines': {
          regexPattern: String.raw`^\n+|\n+$`,
          replaceWith: '',
          skipForLanguages: ['plaintext'],
          skipForPaths: ['README.md'],
        },
      },
    },
    {
      name: 'skips a new rule when at least one required field is missing',
      baseRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        'trim-empty-lines': {
          regexPattern: String.raw`^\n+|\n+$`,
          replaceWith: '',
          skipForLanguages: ['plaintext'],
        },
      },
      expectedRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
    },
    {
      name: 'allows overriding existing rule fields with empty string and empty arrays',
      baseRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: 'REMOVED',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/', 'generated/'],
        },
      },
      userRulesById: {
        'strip-codefence': {
          replaceWith: '',
          skipForLanguages: [],
          skipForPaths: [],
        },
      },
      expectedRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: [],
          skipForPaths: [],
        },
      },
    },
    {
      name: 'does not remove existing values when user fields are undefined for an existing rule',
      baseRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
        },
      },
      userRulesById: {
        'strip-codefence': {},
      },
      expectedRulesById: {
        'strip-codefence': {
          regexPattern: stripCodeFenceRegexPattern,
          replaceWith: '',
          skipForLanguages: ['markdown'],
          skipForPaths: ['docs/'],
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

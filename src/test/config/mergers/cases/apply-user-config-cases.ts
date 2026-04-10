import { SystemConfig } from '../../../../config/contracts/system-config-contracts';
import { UserConfig } from '../../../../config/contracts/user-config-contracts';

interface ApplyUserConfigTestCase {
  name: string;
  systemConfig: SystemConfig;
  userConfig: UserConfig;
  expectedConfig: SystemConfig;
}

export function buildApplyUserConfigCases(): ApplyUserConfigTestCase[] {
  const stripCodeFenceTestRuleId = 'strip-codefence-test';

  return [
    {
      name: 'preserves untouched dependent settings while applying only preset independent overrides',
      systemConfig: {
        presetIndependentSettings: {
          allowOutsideWorkspaceRead: false,
          allowOutsideWorkspaceWrite: false,
          vitalParsingAnchors: {
            PROMPT_DELIMITER_ANCHOR: '---',
            CODE_LISTING_HEADER_ANCHOR: '## LLM-CPP-FILE',
            FILE_STATUS_ANCHOR: '#### FILE WAS',
            FILE_EDITED_FULL_ANCHOR: 'EDITED_FULL',
            FILE_CREATED_ANCHOR: 'CREATED',
            FILE_DELETED_ANCHOR: 'DELETED',
            END_OF_OUTPUT_ANCHOR: '## LLM-CPP-EOF-OUTPUT',
          },
          notificationSettings: {
            configValidation: {
              suppressWarningIssuesToast: false,
              suppressRecommendationIssuesToast: false,
              suppressNoIssuesToast: false,
            },
          },
        },
        presetDependentSettings: {
          skipInstructions: false,
          skipCodeListings: false,
          ideToLlm: {
            skipPromptSizeStatsInCopyNotification: false,
            charsPerToken: 4,
            linesMaxToShowWarning: 200,
            tokensMaxToShowWarning: 2000,
          },
          llmToIde: {
            skipPromptSizeStatsInCopyNotification: false,
            charsPerToken: 4,
            linesMaxToShowWarning: 200,
            tokensMaxToShowWarning: 2000,
          },
          postFilePatchActions: {
            enableSaveAfterFilePatch: true,
            enableLintingAfterFilePatch: false,
            enableOpeningPatchedFilesInEditor: true,
          },
          instructionsSettings: {
            variablesById: {
              sharedLanguage: 'TypeScript',
            },
            referencesById: {
              repoGuide: 'docs/repo-guide.md',
            },
            instructionsById: {
              existing: {
                path: 'instructions/existing.md',
                skip: false,
                showInPresetsMode: true,
                showInQuickInstructionMode: true,
              },
            },
          },
          llmToIdeSanitizationRulesById: {
            [stripCodeFenceTestRuleId]: {
              skip: false,
              regexPattern: String.raw`\`\`\`[\s\S]*?\`\`\``,
              regexFlags: 'g',
              replaceWith: '',
              skipForLanguages: ['markdown'],
              skipForPaths: ['docs/'],
            },
          },
        },
      },
      userConfig: {
        presetIndependentSettings: {
          allowOutsideWorkspaceRead: true,
          vitalParsingAnchors: {
            END_OF_OUTPUT_ANCHOR: null,
          },
        },
      },
      expectedConfig: {
        presetIndependentSettings: {
          allowOutsideWorkspaceRead: true,
          allowOutsideWorkspaceWrite: false,
          vitalParsingAnchors: {
            PROMPT_DELIMITER_ANCHOR: '---',
            CODE_LISTING_HEADER_ANCHOR: '## LLM-CPP-FILE',
            FILE_STATUS_ANCHOR: '#### FILE WAS',
            FILE_EDITED_FULL_ANCHOR: 'EDITED_FULL',
            FILE_CREATED_ANCHOR: 'CREATED',
            FILE_DELETED_ANCHOR: 'DELETED',
            END_OF_OUTPUT_ANCHOR: null,
          },
          notificationSettings: {
            configValidation: {
              suppressWarningIssuesToast: false,
              suppressRecommendationIssuesToast: false,
              suppressNoIssuesToast: false,
            },
          },
        },
        presetDependentSettings: {
          skipInstructions: false,
          skipCodeListings: false,
          ideToLlm: {
            skipPromptSizeStatsInCopyNotification: false,
            charsPerToken: 4,
            linesMaxToShowWarning: 200,
            tokensMaxToShowWarning: 2000,
          },
          llmToIde: {
            skipPromptSizeStatsInCopyNotification: false,
            charsPerToken: 4,
            linesMaxToShowWarning: 200,
            tokensMaxToShowWarning: 2000,
          },
          postFilePatchActions: {
            enableSaveAfterFilePatch: true,
            enableLintingAfterFilePatch: false,
            enableOpeningPatchedFilesInEditor: true,
          },
          instructionsSettings: {
            variablesById: {
              sharedLanguage: 'TypeScript',
            },
            referencesById: {
              repoGuide: 'docs/repo-guide.md',
            },
            instructionsById: {
              existing: {
                path: 'instructions/existing.md',
                skip: false,
                showInPresetsMode: true,
                showInQuickInstructionMode: true,
              },
            },
          },
          llmToIdeSanitizationRulesById: {
            [stripCodeFenceTestRuleId]: {
              skip: false,
              regexPattern: String.raw`\`\`\`[\s\S]*?\`\`\``,
              regexFlags: 'g',
              replaceWith: '',
              skipForLanguages: ['markdown'],
              skipForPaths: ['docs/'],
            },
          },
        },
      },
    },
  ];
}

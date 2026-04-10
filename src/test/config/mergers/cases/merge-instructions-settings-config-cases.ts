import { InstructionConfig, InstructionsConfig } from '../../../../config/contracts/system-config-contracts';
import { InstructionsSettingsUserConfig } from '../../../../config/contracts/user-config-contracts';

interface MergeInstructionsSettingsConfigTestCase {
  name: string;
  baseConfig: InstructionsConfig;
  userConfig: InstructionsSettingsUserConfig | undefined;
  expectedConfig: InstructionsConfig;
}

export function buildMergeInstructionsSettingsConfigCases(): MergeInstructionsSettingsConfigTestCase[] {
  return [
    {
      name: 'adds new variable and reference keys while overriding existing keys',
      baseConfig: {
        variablesById: {
          sharedLanguage: 'TypeScript',
          sharedFramework: 'Angular',
        },
        referencesById: {
          codingStyle: 'docs/coding-style.md',
          repoGuide: 'docs/repo-guide.md',
        },
        instructionsById: buildBaseInstructionsById(),
      },
      userConfig: {
        variablesById: {
          sharedFramework: 'React',
          sharedProject: 'llm-copypaster',
        },
        referencesById: {
          repoGuide: 'docs/custom-repo-guide.md',
          testingGuide: 'docs/testing-guide.md',
        },
      },
      expectedConfig: {
        variablesById: {
          sharedLanguage: 'TypeScript',
          sharedFramework: 'React',
          sharedProject: 'llm-copypaster',
        },
        referencesById: {
          codingStyle: 'docs/coding-style.md',
          repoGuide: 'docs/custom-repo-guide.md',
          testingGuide: 'docs/testing-guide.md',
        },
        instructionsById: buildBaseInstructionsById(),
      },
    },
    {
      name: 'keeps base config when user settings are undefined',
      baseConfig: {
        variablesById: {
          sharedLanguage: 'TypeScript',
        },
        referencesById: {
          codingStyle: 'docs/coding-style.md',
        },
        instructionsById: buildBaseInstructionsById(),
      },
      userConfig: undefined,
      expectedConfig: {
        variablesById: {
          sharedLanguage: 'TypeScript',
        },
        referencesById: {
          codingStyle: 'docs/coding-style.md',
        },
        instructionsById: buildBaseInstructionsById(),
      },
    },
  ];
}

function buildBaseInstructionsById(): Record<string, InstructionConfig> {
  return {
    existing: {
      path: 'instructions/existing.md',
      skip: false,
      showInPresetsMode: true,
      showInQuickInstructionMode: false,
    },
  };
}

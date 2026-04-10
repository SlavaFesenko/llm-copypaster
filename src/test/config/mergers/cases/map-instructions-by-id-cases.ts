import { InstructionConfig } from '../../../../config/contracts/system-config-contracts';
import { InstructionUserConfig } from '../../../../config/contracts/user-config-contracts';

interface MapInstructionsByIdTestCase {
  name: string;
  baseInstructionsById: Record<string, InstructionConfig>;
  userInstructionsById: Record<string, InstructionUserConfig>;
  expectedInstructionsById: Record<string, InstructionConfig>;
}

export function buildMapInstructionsByIdCases(): MapInstructionsByIdTestCase[] {
  return [
    {
      name: 'creates a new instruction only when path and skip are provided and defaults visibility flags to false',
      baseInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: false,
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
      },
      userInstructionsById: {
        created: {
          path: 'instructions/new.md',
          skip: true,
        },
      },
      expectedInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: false,
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
        created: {
          path: 'instructions/new.md',
          skip: true,
          showInPresetsMode: false,
          showInQuickInstructionMode: false,
        },
      },
    },
    {
      name: 'skips a new instruction when a required field is missing',
      baseInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: false,
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
      },
      userInstructionsById: {
        skippedBecauseMissingSkip: {
          path: 'instructions/new.md',
        },
      },
      expectedInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: false,
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
      },
    },
    {
      name: 'updates only provided fields for an existing instruction and preserves explicit false values',
      baseInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: true,
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
      },
      userInstructionsById: {
        existing: {
          skip: false,
          showInPresetsMode: false,
        },
      },
      expectedInstructionsById: {
        existing: {
          path: 'instructions/existing.md',
          skip: false,
          showInPresetsMode: false,
          showInQuickInstructionMode: true,
        },
      },
    },
    {
      name: 'does not create a new instruction from visibility flags only',
      baseInstructionsById: {},
      userInstructionsById: {
        visibilityOnly: {
          showInPresetsMode: true,
          showInQuickInstructionMode: true,
        },
      },
      expectedInstructionsById: {},
    },
  ];
}

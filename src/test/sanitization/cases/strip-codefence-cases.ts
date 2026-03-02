import { SanitizationTestCase } from '../contracts/sanitization-test-case';

export function buildStripCodefenceCases(): SanitizationTestCase[] {
  const fence = buildBackticks(3);

  return [
    {
      name: 'strip-codefence removes opening and closing fences and keeps inner content',
      fileMeta: { path: 'src/a.ts' },
      inputText: `${fence}typescript\nconst a = 1;\n${fence}\n`,
      expectedText: '\nconst a = 1;\n\n',
    },
    {
      name: 'strip-codefence removes multiple fences across the same text',
      fileMeta: { path: 'src/a.ts' },
      inputText: `a\n${fence}ts\nb\n${fence}\nc\n${fence}\nd\n${fence}\n`,
      expectedText: 'a\n\nb\n\nc\n\nd\n\n',
    },
    {
      name: 'does not apply a rule when disabledForLanguages matches file languageId',
      fileMeta: { path: 'README.md', languageId: 'markdown' },
      inputText: `${fence}md\nhello\n${fence}\n`,
      expectedText: `${fence}md\nhello\n${fence}\n`,
    },
    {
      name: 'does not apply a rule when disabledForPaths prefix matches file path',
      fileMeta: { path: 'docs/a.ts' },
      inputText: `${fence}ts\nconst a = 1;\n${fence}\n`,
      expectedText: `${fence}ts\nconst a = 1;\n${fence}\n`,
    },
  ];
}

function buildBackticks(count: number): string {
  return new Array(count).fill('`').join('');
}

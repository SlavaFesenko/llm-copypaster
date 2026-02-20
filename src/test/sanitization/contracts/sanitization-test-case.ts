export interface SanitizationTestCase {
  name: string;
  fileMeta: { path: string; languageId?: string };
  inputText: string;
  expectedText: string;
}

import { GuidedRetryLastError } from './guided-retry-store';

export function buildGuidedRetryPrompt(lastError: GuidedRetryLastError): string {
  const stageLine = `Stage: ${lastError.stage}`;
  const errorLine = `Error: ${lastError.message}`;

  const formatLine =
    'Return format: concatenated file listings, each file starts with "# relative/path.ext" then full raw content';

  const contextLines: string[] = [];
  contextLines.push(stageLine);
  contextLines.push(errorLine);
  contextLines.push(formatLine);

  contextLines.push('');
  contextLines.push('Clipboard input (as received):');
  contextLines.push(lastError.rawClipboardText);

  return contextLines.join('\n');
}

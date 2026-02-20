import { LlmCopypasterConfig } from '../config/llm-copypaster-config';
import { EditorToLlmFileItem } from './file-selection';

export interface BuildLlmContextTextArgs {
  fileItems: EditorToLlmFileItem[];
  includeResponsePrompt: boolean;
  config: LlmCopypasterConfig;
  responsePromptText?: string;
}

export function buildLlmContextText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem)).join('\n');

  if (!args.includeResponsePrompt) {
    return listings;
  }

  const promptText = args.responsePromptText ?? '';

  if (!promptText.trim()) {
    return listings;
  }

  return `${promptText}\n\n${listings}`;
}

function buildSingleFileListing(fileItem: EditorToLlmFileItem): string {
  const headerLine = `## File: ${fileItem.path}`;

  const errorNote = fileItem.readError ? `\n// READ ERROR: ${fileItem.readError}\n` : '\n';
  const content = fileItem.content ?? '';

  return `${headerLine}\n\ \n${errorNote}${content}\n \n`;
}

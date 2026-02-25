import { LlmCopypasterConfig } from '../../../config';
import { EditorToLlmFileItem } from './file-selection';

export interface BuildLlmContextTextArgs {
  fileItems: EditorToLlmFileItem[];
  includeTechPrompt: boolean;
  config: LlmCopypasterConfig;
  techPromptText?: string;
}

export function buildLlmContextText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem, args.config)).join('\n');

  if (!args.includeTechPrompt) return listings;

  const techPromptText = args.techPromptText ?? '';

  if (!techPromptText.trim()) return listings;

  const techPromptDelimiter = args.config.techPrompt.techPromptDelimiter;

  return `\n${techPromptDelimiter}\n${techPromptText}\n${techPromptDelimiter}\n${listings}`;
}

function buildSingleFileListing(fileItem: EditorToLlmFileItem, config: LlmCopypasterConfig): string {
  const headerLine = `${config.codeListingHeaderStartFragment}${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
}

import { LlmCopypasterConfig } from '../../../config-service';
import { EditorToLlmFileItem } from './file-selection';

export interface BuildLlmContextTextArgs {
  fileItems: EditorToLlmFileItem[];
  config: LlmCopypasterConfig;
  ignorePromptInstructions?: boolean;
  techPromptText?: string;
}

export function buildLlmContextText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem, args.config)).join('\n');

  const techPromptDelimiter = args.config.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR;

  if (args.ignorePromptInstructions) return `\n${techPromptDelimiter}\n${listings}`;

  const techPromptText = args.techPromptText ?? '';

  if (!techPromptText.trim()) return listings;

  return `\n${techPromptDelimiter}\n${techPromptText}\n${techPromptDelimiter}\n${listings}`;
}

function buildSingleFileListing(fileItem: EditorToLlmFileItem, config: LlmCopypasterConfig): string {
  const headerLine = `${config.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR} ${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
}

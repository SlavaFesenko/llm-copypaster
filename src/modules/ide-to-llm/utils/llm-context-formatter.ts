import { LlmCopypasterConfig } from '../../../config/system-config-contracts';
import { EditorToLlmFileItem } from './file-selection';

export interface BuildLlmContextTextArgs {
  fileItems: EditorToLlmFileItem[];
  config: LlmCopypasterConfig;
  ignorePromptInstructions?: boolean;
  instructionsText?: string;
}

export function buildFinalPromptText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem, args.config)).join('\n');

  const techPromptDelimiter = args.config.nonOverrideableSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR;

  if (args.ignorePromptInstructions) return `\n${techPromptDelimiter}\n${listings}`;

  const instructionsText = args.instructionsText ?? '';

  if (!instructionsText.trim()) return listings;

  return `\n${techPromptDelimiter}\n${instructionsText}\n${techPromptDelimiter}\n${listings}`;
}

function buildSingleFileListing(fileItem: EditorToLlmFileItem, config: LlmCopypasterConfig): string {
  const headerLine = `${config.nonOverrideableSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR} ${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
}

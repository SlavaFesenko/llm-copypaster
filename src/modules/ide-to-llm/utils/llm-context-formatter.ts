import { LlmCopypasterConfig } from '../../../config';
import { EditorToLlmFileItem } from './file-selection';

export interface BuildLlmContextTextArgs {
  fileItems: EditorToLlmFileItem[];
  includeTechPrompt: boolean;
  config: LlmCopypasterConfig;
  techPromptText?: string;
}

const TECH_PROMPT_DELIMITER = '---';

export function buildLlmContextText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem)).join('\n');

  if (!args.includeTechPrompt) {
    return listings;
  }

  const techPromptText = args.techPromptText ?? '';

  if (!techPromptText.trim()) {
    return listings;
  }

  return `\n${TECH_PROMPT_DELIMITER}\n${techPromptText}\n${TECH_PROMPT_DELIMITER}\n${listings}`;
}

function buildSingleFileListing(fileItem: EditorToLlmFileItem): string {
  const fileListingHeaderStartFragment = '# '; // TODO replace to config
  const headerLine = `${fileListingHeaderStartFragment}${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
}

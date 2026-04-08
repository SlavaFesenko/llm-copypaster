import { SystemConfig } from '../../../config/contracts/system-config-contracts';
import { BuildLlmContextTextArgs, IdeToLlmFile } from '../contracts';

export function buildFinalPromptText(args: BuildLlmContextTextArgs): string {
  const listings = args.fileItems.map(fileItem => buildSingleFileListing(fileItem, args.config)).join('\n');

  const techPromptDelimiter = args.config.presetIndependentSettings.vitalParsingAnchors.PROMPT_DELIMITER_ANCHOR;

  if (args.ignorePromptInstructions) return `\n${techPromptDelimiter}\n${listings}`;

  const instructionsText = args.instructionsText ?? '';

  if (!instructionsText.trim()) return listings;

  return `\n${techPromptDelimiter}\n${instructionsText}\n${techPromptDelimiter}\n${listings}`;
}

function buildSingleFileListing(fileItem: IdeToLlmFile, config: SystemConfig): string {
  const headerLine = `${config.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR} ${fileItem.path}`;

  const contentLines: string[] = [];

  if (fileItem.readError?.trim()) contentLines.push(`// READ ERROR: ${fileItem.readError}`);

  const content = fileItem.content ?? '';
  contentLines.push(content);

  return `${headerLine}\n${contentLines.join('\n')}\n`;
}

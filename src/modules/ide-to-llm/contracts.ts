import * as vscode from 'vscode';

import { ConfigService } from '../../config/config-service';
import { IdeToLlmConfig, LlmCopypasterConfig, LlmToIdeConfig } from '../../config/system-config-contracts';
import { CollectedFileItem } from '../../contracts/file-contracts';
import { OutputChannelLogger } from '../../utils/output-channel-logger';

export interface IdeToLlmDeps {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export interface CopySelectedExplorerItemsArgs {
  selectedUris?: vscode.Uri[];
}

export interface EditorToLlmPromptSizeStats {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: string[];
}

export interface ShowCopyResultNotificationArgs {
  commandName: string;
  includeTechPrompt: boolean;
  copiedFilesCount: number;
  totalFilesCount: number;
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
  promptText: string;
  fileItems: CollectedFileItem[];
  promptSizeStats?: EditorToLlmPromptSizeStats;
}

export interface IdeToLlmFile {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

export interface BuildLlmContextTextArgs {
  fileItems: IdeToLlmFile[];
  config: LlmCopypasterConfig;
  ignorePromptInstructions?: boolean;
  instructionsText?: string;
}

export interface TextSizeStatsInput {
  promptText: string;
  contextConfig: IdeToLlmConfig | LlmToIdeConfig;
}

export enum PromptSizeExceededBy {
  LINES = 'LINES',
  TOKENS = 'TOKENS',
}

export interface TextSizeStatsOutput {
  linesCount: number;
  approxTokensCount: number;
  linesMaxToShowWarning: number;
  tokensMaxToShowWarning: number;
  isExceeded: boolean;
  exceededBy: PromptSizeExceededBy[];
}

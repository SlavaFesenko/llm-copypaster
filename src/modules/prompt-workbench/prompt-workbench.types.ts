import { CollectedFileItem } from '../../types/files-payload';

export interface PromptWorkbenchBridge {
  onNewCopiedContext(args: { includeTechPrompt: boolean; fileItems: CollectedFileItem[]; commandName: string }): void;
}

export interface PromptWorkbenchProfileItemModel {
  id: string | null;
  description: string;
  version?: string;
}

export interface PromptWorkbenchOutlineModel {
  instructionSections: string[];
  filePaths: string[];
}

export interface PromptWorkbenchStatsModel {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: string[];
}

export interface PromptWorkbenchStateModel {
  isReady: boolean;
  isEmpty: boolean;
  lastCommandName?: string;
  profiles: PromptWorkbenchProfileItemModel[];
  selectedProfileId: string | null;
  isInstructionsErased: boolean;
  isCodeListingsErased: boolean;
  canEraseInstructions: boolean;
  canEraseCodeListings: boolean;
  outline: PromptWorkbenchOutlineModel;
  stats?: PromptWorkbenchStatsModel;
}

export type PromptWorkbenchInboundMessage =
  | { type: 'ready' }
  | { type: 'selectProfile'; selectedProfileId: string | null }
  | { type: 'toggleEraseInstructions' }
  | { type: 'toggleEraseCodeListings' }
  | { type: 'copyToClipboard' }
  | { type: 'showFullPrompt' };

export type PromptWorkbenchOutboundMessage =
  | { type: 'state'; state: PromptWorkbenchStateModel }
  | { type: 'error'; message: string };

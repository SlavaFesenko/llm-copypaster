export const commandIds = {
  copyActiveFileAsLlmContext: 'llm-copypaster.copyActiveFileAsLlmContext',
  copyAllOpenFilesAsLlmContext: 'llm-copypaster.copyAllOpenFilesAsLlmContext',
  copySelectedExplorerFilesAsLlmContext: 'llm-copypaster.copySelectedExplorerFilesAsLlmContext',
  copyLlmContextWithResponseFormatPrompt: 'llm-copypaster.copyLlmContextWithResponseFormatPrompt',
  copyLlmContextWithoutResponseFormatPrompt: 'llm-copypaster.copyLlmContextWithoutResponseFormatPrompt',

  applyClipboardToFiles: 'llm-copypaster.applyClipboardToFiles',
  validateClipboardPayload: 'llm-copypaster.validateClipboardPayload',
  sanitizeClipboardPayload: 'llm-copypaster.sanitizeClipboardPayload',
  copyGuidedRetryPromptLastError: 'llm-copypaster.copyGuidedRetryPromptLastError',
} as const;

export type CommandId = (typeof commandIds)[keyof typeof commandIds];

import * as vscode from 'vscode';

import type { LlmCopypasterConfig } from '../../../config';

export async function getTechPrompt(
  extensionContext: vscode.ExtensionContext,
  config?: LlmCopypasterConfig
): Promise<string> {}

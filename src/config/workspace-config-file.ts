import * as vscode from 'vscode';

import { OutputChannelLogger } from '../utils/output-channel-logger';
import { LlmCopypasterConfig } from './llm-copypaster-config';

const workspaceConfigFileName = '.llm-copypaster.json';

export async function readWorkspaceJsonConfigFile(
  logger: OutputChannelLogger
): Promise<Partial<LlmCopypasterConfig> | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return null;
  }

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceConfigFileName);

  try {
    const bytes = await vscode.workspace.fs.readFile(configUri);
    const jsonText = Buffer.from(bytes).toString('utf8');
    const parsed = JSON.parse(jsonText) as Partial<LlmCopypasterConfig>;

    return parsed;
  } catch (error) {
    logger.debug(`Workspace config not loaded: ${String(error)}`);
    return null;
  }
}

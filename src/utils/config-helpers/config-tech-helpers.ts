import { parse, ParseError } from 'jsonc-parser';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { GLOB_CONSTS } from '../../global-constants';
import { OutputChannelLogger } from '../output-channel-logger';

export async function readUserJsonConfigFile<TConfig>(logger: OutputChannelLogger): Promise<TConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) return null;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, GLOB_CONSTS.USER_CONFIG_FILE_NAME);

  return await readJsoncConfigFile<TConfig>(configUri, logger, 'Workspace config not loaded');
}

export async function readSystemJsonConfigFile<TConfig>(): Promise<TConfig> {
  const extensionConfigFileName = GLOB_CONSTS.SYS_CONFIG_FILE_NAME;
  const extensionConfigPath = path.resolve(__dirname, '..', '..', '..', extensionConfigFileName);
  const jsonText = await fs.readFile(extensionConfigPath, 'utf8');
  const parseErrors: ParseError[] = [];
  const parsed = parse(jsonText, parseErrors, { allowTrailingComma: true }) as TConfig;

  if (parseErrors.length > 0) {
    throw new Error(`JSONC parse errors: ${parseErrors.map(parseError => parseError.error).join(', ')}`);
  }

  return parsed;
}

export async function readJsoncConfigFile<TConfig>(
  configUri: vscode.Uri,
  logger: OutputChannelLogger,
  notLoadedMessagePrefix: string
): Promise<TConfig | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(configUri);
    const jsonText = Buffer.from(bytes).toString('utf8');
    const parseErrors: ParseError[] = [];
    const parsed = parse(jsonText, parseErrors, { allowTrailingComma: true }) as TConfig;

    if (parseErrors.length > 0) {
      throw new Error(`JSONC parse errors: ${parseErrors.map(parseError => parseError.error).join(', ')}`);
    }

    return parsed;
  } catch (error) {
    logger.debug(`${notLoadedMessagePrefix}: ${String(error)}`);
    return null;
  }
}

import { parse, ParseError } from 'jsonc-parser';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { GLOB_CONSTS } from '../../global-constants';
import { OutputChannelLogger } from '../output-channel-logger';

export async function readUserConfigFile<TConfig>(logger: OutputChannelLogger): Promise<TConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) return null;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, GLOB_CONSTS.USER_CONFIG_FILE_NAME);

  return await readJsoncConfigFile<TConfig>(configUri, logger, 'Workspace config not loaded');
}

// TODO: don't return null, only exception + extension failure (or exit?)
export async function readSystemJsonConfigFile<TConfig>(logger: OutputChannelLogger): Promise<TConfig | null> {
  const extensionConfigFileName = GLOB_CONSTS.SYS_CONFIG_FILE_NAME;
  const extensionConfigPath = await findFileUpwards(__dirname, extensionConfigFileName);

  if (!extensionConfigPath) {
    const errorMessage = `System config not loaded: ${extensionConfigFileName} was not found`;

    logger.error(errorMessage);
    void vscode.window.showErrorMessage(errorMessage);

    return null;
  }

  try {
    const jsonText = await fs.readFile(extensionConfigPath, 'utf8');
    const parseErrors: ParseError[] = [];
    const parsed = parse(jsonText, parseErrors, { allowTrailingComma: true }) as TConfig;

    if (parseErrors.length > 0) {
      throw new Error(`JSONC parse errors: ${parseErrors.map(parseError => parseError.error).join(', ')}`);
    }

    return parsed;
  } catch (error) {
    const errorMessage = `System config not loaded: ${String(error)}`;

    logger.error(errorMessage);
    void vscode.window.showErrorMessage(errorMessage);

    return null;
  }
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

export async function findFileUpwards(startDirectoryPath: string, fileName: string): Promise<string | null> {
  let currentDirectoryPath = startDirectoryPath;

  while (true) {
    const candidateFilePath = path.join(currentDirectoryPath, fileName);

    try {
      await fs.access(candidateFilePath);
      return candidateFilePath;
    } catch {
      void 0;
    }

    const parentDirectoryPath = path.dirname(currentDirectoryPath);

    if (parentDirectoryPath === currentDirectoryPath) {
      return null;
    }

    currentDirectoryPath = parentDirectoryPath;
  }
}

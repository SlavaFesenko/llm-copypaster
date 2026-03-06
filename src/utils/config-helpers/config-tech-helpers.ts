import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { GLOB_CONSTS } from '../../global-constants';
import { OutputChannelLogger } from '../output-channel-logger';

export async function readUserConfigFile<TConfig>(logger: OutputChannelLogger): Promise<TConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return null;
  }

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, GLOB_CONSTS.USER_CONFIG_FILE_NAME);

  return await readJsoncConfigFile<TConfig>(configUri, logger, 'Workspace config not loaded');
}

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
    const jsonTextWithoutComments = stripJsoncComments(jsonText);
    const jsonTextWithoutTrailingCommas = stripJsoncTrailingCommas(jsonTextWithoutComments);
    const parsed = JSON.parse(jsonTextWithoutTrailingCommas) as TConfig;

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
    const jsonTextWithoutComments = stripJsoncComments(jsonText);
    const jsonTextWithoutTrailingCommas = stripJsoncTrailingCommas(jsonTextWithoutComments);
    const parsed = JSON.parse(jsonTextWithoutTrailingCommas) as TConfig;

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

export function stripJsoncComments(jsonText: string): string {
  let result = '';

  let isInsideString = false;
  let isEscaped = false;

  let isInsideLineComment = false;
  let isInsideBlockComment = false;

  for (let index = 0; index < jsonText.length; index++) {
    const currentChar = jsonText[index];
    const nextChar = index + 1 < jsonText.length ? jsonText[index + 1] : '';

    if (isInsideLineComment) {
      if (currentChar === '\n') {
        isInsideLineComment = false;
        result += currentChar;
      }

      continue;
    }

    if (isInsideBlockComment) {
      if (currentChar === '*' && nextChar === '/') {
        isInsideBlockComment = false;
        index++;
      }

      continue;
    }

    if (!isInsideString && currentChar === '/' && nextChar === '/') {
      isInsideLineComment = true;
      index++;
      continue;
    }

    if (!isInsideString && currentChar === '/' && nextChar === '*') {
      isInsideBlockComment = true;
      index++;
      continue;
    }

    if (currentChar === '"' && !isEscaped) isInsideString = !isInsideString;

    if (currentChar === '\\' && isInsideString) isEscaped = !isEscaped;
    else isEscaped = false;

    result += currentChar;
  }

  return result;
}

export function stripJsoncTrailingCommas(jsonText: string): string {
  let result = '';

  let isInsideString = false;
  let isEscaped = false;

  for (let index = 0; index < jsonText.length; index++) {
    const currentChar = jsonText[index];

    if (currentChar === '"' && !isEscaped) isInsideString = !isInsideString;

    if (currentChar === '\\' && isInsideString) isEscaped = !isEscaped;
    else isEscaped = false;

    if (isInsideString) {
      result += currentChar;
      continue;
    }

    if (currentChar !== ',') {
      result += currentChar;
      continue;
    }

    let lookAheadIndex = index + 1;
    while (lookAheadIndex < jsonText.length && /\s/.test(jsonText[lookAheadIndex])) lookAheadIndex++;

    const nextNonSpaceChar = lookAheadIndex < jsonText.length ? jsonText[lookAheadIndex] : '';

    if (nextNonSpaceChar === '}' || nextNonSpaceChar === ']') continue;

    result += currentChar;
  }

  return result;
}

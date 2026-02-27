import * as vscode from 'vscode';
import { OutputChannelLogger } from '../output-channel-logger';

export async function readWorkspaceJsonConfigFile<TConfig>(logger: OutputChannelLogger): Promise<TConfig | null> {
  const workspaceConfigFileName = 'llm-copypaster.config.jsonc';

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return null;
  }

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceConfigFileName);

  try {
    const bytes = await vscode.workspace.fs.readFile(configUri);
    const jsonText = Buffer.from(bytes).toString('utf8');
    const jsonTextWithoutComments = stripJsoncComments(jsonText);
    const jsonTextWithoutTrailingCommas = stripJsoncTrailingCommas(jsonTextWithoutComments);
    const parsed = JSON.parse(jsonTextWithoutTrailingCommas) as TConfig;

    return parsed;
  } catch (error) {
    logger.debug(`Workspace config not loaded: ${String(error)}`);
    return null;
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

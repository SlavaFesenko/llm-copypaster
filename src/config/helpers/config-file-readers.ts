import { parse, ParseError } from 'jsonc-parser';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { GLOB_CONSTS } from '../../contracts/global-constants';

export async function readUserJsonConfigFile<TConfig>(): Promise<TConfig | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return null;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, GLOB_CONSTS.USER_CONFIG_FILE_NAME);

  try {
    await vscode.workspace.fs.stat(configUri);
  } catch {
    return null;
  }

  const bytes = await vscode.workspace.fs.readFile(configUri);
  const jsonText = Buffer.from(bytes).toString('utf8');
  const parseErrors: ParseError[] = [];
  const parsed = parse(jsonText, parseErrors, { allowTrailingComma: true }) as TConfig;

  if (parseErrors.length > 0) throw new Error(buildConfigReadErrorMessage(GLOB_CONSTS.USER_CONFIG_FILE_NAME));

  return parsed;
}

export async function readSystemJsonConfigFile<TConfig>(): Promise<TConfig> {
  const extensionConfigFileName = GLOB_CONSTS.SYS_CONFIG_FILE_NAME;
  const extensionConfigPath = path.resolve(__dirname, '..', '..', '..', extensionConfigFileName);
  const jsonText = await fs.readFile(extensionConfigPath, 'utf8');
  const parseErrors: ParseError[] = [];
  const parsed = parse(jsonText, parseErrors, { allowTrailingComma: true }) as TConfig;

  if (parseErrors.length > 0) throw new Error(buildConfigReadErrorMessage(GLOB_CONSTS.SYS_CONFIG_FILE_NAME));

  return parsed;
}

function buildConfigReadErrorMessage(configFileName: string): string {
  return `Invalid JSON structure in "${configFileName}"!`;
}

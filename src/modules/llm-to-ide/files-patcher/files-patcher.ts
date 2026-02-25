import * as vscode from 'vscode';

import { FilesPayload } from '../../../types/files-payload';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';
import { toWorkspaceUri } from '../../../utils/path-utils';

export interface ApplyFilesPayloadOptions {
  autoFormatAfterApply: boolean;
}

export interface ApplyOk {
  ok: true;
  appliedFilesCount: number;
}

export interface ApplyFail {
  ok: false;
  errorMessage: string;
}

export type ApplyResult = ApplyOk | ApplyFail;

export async function applyFilesPayloadToWorkspace(
  payload: FilesPayload,
  options: ApplyFilesPayloadOptions,
  logger: OutputChannelLogger
): Promise<ApplyResult> {
  try {
    const workspaceEdit = new vscode.WorkspaceEdit();

    let appliedFilesCount = 0;

    for (const file of payload.files) {
      const targetUri = toWorkspaceUri(file.path);

      if (!targetUri) return { ok: false, errorMessage: `No workspace folder for path: ${file.path}` };

      await ensureParentDirectoryExists(targetUri);

      const exists = await fileExists(targetUri);

      if (exists) {
        const currentDocument = await vscode.workspace.openTextDocument(targetUri);
        const fullRange = new vscode.Range(
          currentDocument.positionAt(0),
          currentDocument.positionAt(currentDocument.getText().length)
        );

        workspaceEdit.replace(targetUri, fullRange, file.content);
      } else {
        workspaceEdit.createFile(targetUri, { ignoreIfExists: true });
        workspaceEdit.insert(targetUri, new vscode.Position(0, 0), file.content);
      }

      appliedFilesCount++;
    }

    const applied = await vscode.workspace.applyEdit(workspaceEdit);
    if (!applied) return { ok: false, errorMessage: 'VS Code refused to apply WorkspaceEdit' };

    if (options.autoFormatAfterApply) await tryFormatAppliedDocuments(payload, logger);

    return { ok: true, appliedFilesCount };
  } catch (error) {
    return { ok: false, errorMessage: String(error) };
  }
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function tryFormatAppliedDocuments(payload: FilesPayload, logger: OutputChannelLogger): Promise<void> {
  for (const file of payload.files) {
    const targetUri = toWorkspaceUri(file.path);
    if (!targetUri) continue;

    try {
      const document = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(document, { preview: true, preserveFocus: true });

      await vscode.commands.executeCommand('editor.action.formatDocument');
    } catch (error) {
      logger.debug(`Format skipped for ${file.path}: ${String(error)}`);
    }
  }
}

export async function ensureParentDirectoryExists(targetFileUri: vscode.Uri): Promise<void> {
  const parentUri = vscode.Uri.joinPath(targetFileUri, '..');

  try {
    await vscode.workspace.fs.createDirectory(parentUri);
  } catch {
    // ignore
  }
}

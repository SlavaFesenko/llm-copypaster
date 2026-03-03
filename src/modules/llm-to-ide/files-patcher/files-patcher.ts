import * as vscode from 'vscode';

import { PostFilePatchActionsConfig } from '../../../config-service';
import { FilePayloadOperationType, FilesPayload } from '../../../types/files-payload';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';
import { toWorkspaceUri } from '../../../utils/path-utils';

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
  postFilesPatchActions: PostFilePatchActionsConfig,
  logger: OutputChannelLogger
): Promise<ApplyResult> {
  try {
    const workspaceEdit = new vscode.WorkspaceEdit();

    let appliedFilesCount = 0;

    for (const file of payload.files) {
      const targetUri = toWorkspaceUri(file.path);

      if (!targetUri) return { ok: false, errorMessage: `No workspace folder for path: ${file.path}` };

      const operation = file.operation ?? FilePayloadOperationType.EditedFull;

      if (operation === FilePayloadOperationType.Deleted) {
        workspaceEdit.deleteFile(targetUri, { ignoreIfNotExists: true });
        appliedFilesCount++;
        continue;
      }

      await ensureParentDirectoryExists(targetUri, logger);

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

    if (postFilesPatchActions.enableLintingAfterFilePatch) await tryFormatAppliedDocuments(payload, logger);

    if (postFilesPatchActions.enableSaveAfterFilePatch) await trySaveAppliedDocuments(payload, logger);

    if (postFilesPatchActions.enableOpeningPatchedFilesInEditor) await tryOpenAppliedDocumentsInEditor(payload, logger);

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
  await tryApplyToFilesPayloadDocuments(payload, logger, 'Format', toWorkspaceUri, async document => {
    await vscode.window.showTextDocument(document, { preview: true, preserveFocus: true });

    await vscode.commands.executeCommand('editor.action.formatDocument');
  });
}

async function trySaveAppliedDocuments(payload: FilesPayload, logger: OutputChannelLogger): Promise<void> {
  await tryApplyToFilesPayloadDocuments(payload, logger, 'Save', toWorkspaceUri, async document => {
    await document.save();
  });
}

async function tryOpenAppliedDocumentsInEditor(payload: FilesPayload, logger: OutputChannelLogger): Promise<void> {
  await tryApplyToFilesPayloadDocuments(payload, logger, 'Open in editor', toWorkspaceUri, async document => {
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
  });
}

export async function ensureParentDirectoryExists(targetFileUri: vscode.Uri, logger?: OutputChannelLogger): Promise<void> {
  const parentUri = vscode.Uri.joinPath(targetFileUri, '..');

  try {
    await vscode.workspace.fs.createDirectory(parentUri);
  } catch (error) {
    logger?.debug(`Create directory skipped for ${parentUri.toString()}: ${String(error)}`);
  }
}

export async function tryApplyToFilesPayloadDocuments(
  payload: FilesPayload,
  logger: OutputChannelLogger,
  actionName: string,
  resolveTargetUri: (filePath: string) => vscode.Uri | null,
  action: (document: vscode.TextDocument, targetUri: vscode.Uri) => Promise<void>
): Promise<void> {
  for (const file of payload.files) {
    const operation = file.operation ?? FilePayloadOperationType.EditedFull;
    if (operation === FilePayloadOperationType.Deleted) continue;

    const targetUri = resolveTargetUri(file.path);
    if (!targetUri) continue;

    try {
      const document = await vscode.workspace.openTextDocument(targetUri);
      await action(document, targetUri);
    } catch (error) {
      await vscode.window.showErrorMessage(`${actionName} failed for ${file.path}: ${String(error)}`);
    }
  }
}

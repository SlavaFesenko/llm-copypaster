import * as path from 'path';
import * as vscode from 'vscode';

import { PostFilePatchActionsConfig, VitalParsingAnchorsConfig } from '../../../config/system-config-contracts';
import { FilesPayload } from '../../../contracts/files-payload';
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
  llmToIdeParsingAnchors: VitalParsingAnchorsConfig,
  logger: OutputChannelLogger
): Promise<ApplyResult> {
  try {
    const workspaceEdit = new vscode.WorkspaceEdit();

    let appliedFilesCount = 0;
    let hasWorkspaceEdits = false;

    const workspaceRootFsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;

    const normalizePathForCompare = (inputPath: string): string => {
      const normalizedPath = path.resolve(inputPath);

      if (process.platform === 'win32') return normalizedPath.toLowerCase();

      return normalizedPath;
    };

    const isPathInsideWorkspaceRoot = (absoluteFilePath: string): boolean => {
      if (!workspaceRootFsPath) return false;

      const normalizedWorkspaceRootFsPath = normalizePathForCompare(workspaceRootFsPath);
      const normalizedAbsoluteFilePath = normalizePathForCompare(absoluteFilePath);

      if (normalizedAbsoluteFilePath === normalizedWorkspaceRootFsPath) return true;

      return normalizedAbsoluteFilePath.startsWith(normalizedWorkspaceRootFsPath + path.sep);
    };

    const insideWorkspaceFiles: FilesPayload['files'] = [];
    const outsideWorkspaceFiles: FilesPayload['files'] = [];

    for (const file of payload.files) {
      const isAbsolutePath = path.isAbsolute(file.path);

      if (!isAbsolutePath) {
        insideWorkspaceFiles.push(file);
        continue;
      }

      if (isPathInsideWorkspaceRoot(file.path)) {
        const normalizedWorkspaceRootFsPath = path.resolve(workspaceRootFsPath as string);
        const normalizedAbsoluteFilePath = path.resolve(file.path);
        const workspaceRelativePath = path.relative(normalizedWorkspaceRootFsPath, normalizedAbsoluteFilePath);

        insideWorkspaceFiles.push({ ...file, path: workspaceRelativePath });
        continue;
      }

      outsideWorkspaceFiles.push(file);
    }

    for (const file of insideWorkspaceFiles) {
      const targetUri = toWorkspaceUri(file.path);

      if (!targetUri) return { ok: false, errorMessage: `No workspace folder for path: ${file.path}` };

      const operation = file.operation ?? llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR;

      if (operation === llmToIdeParsingAnchors.FILE_DELETED_ANCHOR) {
        workspaceEdit.deleteFile(targetUri, { ignoreIfNotExists: true });
        hasWorkspaceEdits = true;
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
        hasWorkspaceEdits = true;
      } else {
        workspaceEdit.createFile(targetUri, { ignoreIfExists: true });
        workspaceEdit.insert(targetUri, new vscode.Position(0, 0), file.content);
        hasWorkspaceEdits = true;
      }

      appliedFilesCount++;
    }

    for (const file of outsideWorkspaceFiles) {
      const externalTargetUri = vscode.Uri.file(file.path);

      const isConfirmed = await confirmOutOfWorkspaceFileOperation(externalTargetUri);
      if (!isConfirmed) return { ok: false, errorMessage: `Cancelled by user: ${file.path}` };

      const operation = file.operation ?? llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR;

      if (operation === llmToIdeParsingAnchors.FILE_DELETED_ANCHOR) {
        try {
          await vscode.workspace.fs.delete(externalTargetUri, { recursive: false, useTrash: true });
        } catch (error) {
          logger.debug(`Delete out of workspace skipped for ${externalTargetUri.toString()}: ${String(error)}`);
        }

        appliedFilesCount++;
        continue;
      }

      await ensureParentDirectoryExists(externalTargetUri, logger);

      const encodedContent = new TextEncoder().encode(file.content);

      await vscode.workspace.fs.writeFile(externalTargetUri, encodedContent);

      appliedFilesCount++;
    }

    if (hasWorkspaceEdits) {
      const applied = await vscode.workspace.applyEdit(workspaceEdit);
      if (!applied) return { ok: false, errorMessage: 'VS Code refused to apply WorkspaceEdit' };

      const insideWorkspacePayload: FilesPayload = { ...payload, files: insideWorkspaceFiles };

      if (postFilesPatchActions.enableLintingAfterFilePatch)
        await tryFormatAppliedDocuments(insideWorkspacePayload, llmToIdeParsingAnchors, logger);

      if (postFilesPatchActions.enableSaveAfterFilePatch)
        await trySaveAppliedDocuments(insideWorkspacePayload, llmToIdeParsingAnchors, logger);

      if (postFilesPatchActions.enableOpeningPatchedFilesInEditor)
        await tryOpenAppliedDocumentsInEditor(insideWorkspacePayload, llmToIdeParsingAnchors, logger);
    }

    return { ok: true, appliedFilesCount };
  } catch (error) {
    return { ok: false, errorMessage: String(error) };
  }
}

async function confirmOutOfWorkspaceFileOperation(targetUri: vscode.Uri): Promise<boolean> {
  const fileName = path.basename(targetUri.fsPath);
  const messageLines = [
    'You are about to write a file OUTSIDE the current workspace.',
    'Double-check the path — Git may not be used for this location.',
    '',
    `File: ${fileName}`,
    `Path: ${targetUri.fsPath}`,
  ];

  const pickedAction = await vscode.window.showWarningMessage(
    messageLines.join('\n'),
    { modal: true },
    'Write file',
    'Cancel'
  );

  return pickedAction === 'Write file';
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function tryFormatAppliedDocuments(
  payload: FilesPayload,
  llmToIdeParsingAnchors: VitalParsingAnchorsConfig,
  logger: OutputChannelLogger
): Promise<void> {
  await tryApplyToFilesPayloadDocuments(
    payload,
    llmToIdeParsingAnchors,
    logger,
    'Format',
    toWorkspaceUri,
    async document => {
      await vscode.window.showTextDocument(document, { preview: true, preserveFocus: true });

      await vscode.commands.executeCommand('editor.action.formatDocument');
    }
  );
}

async function trySaveAppliedDocuments(
  payload: FilesPayload,
  llmToIdeParsingAnchors: VitalParsingAnchorsConfig,
  logger: OutputChannelLogger
): Promise<void> {
  await tryApplyToFilesPayloadDocuments(payload, llmToIdeParsingAnchors, logger, 'Save', toWorkspaceUri, async document => {
    await document.save();
  });
}

async function tryOpenAppliedDocumentsInEditor(
  payload: FilesPayload,
  llmToIdeParsingAnchors: VitalParsingAnchorsConfig,
  logger: OutputChannelLogger
): Promise<void> {
  await tryApplyToFilesPayloadDocuments(
    payload,
    llmToIdeParsingAnchors,
    logger,
    'Open in editor',
    toWorkspaceUri,
    async document => {
      await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
    }
  );
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
  llmToIdeParsingAnchors: VitalParsingAnchorsConfig,
  logger: OutputChannelLogger,
  actionName: string,
  resolveTargetUri: (filePath: string) => vscode.Uri | null,
  action: (document: vscode.TextDocument, targetUri: vscode.Uri) => Promise<void>
): Promise<void> {
  for (const file of payload.files) {
    const operation = file.operation ?? llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR;
    if (operation === llmToIdeParsingAnchors.FILE_DELETED_ANCHOR) continue;

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

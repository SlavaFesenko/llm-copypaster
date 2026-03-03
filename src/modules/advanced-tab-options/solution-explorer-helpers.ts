import * as vscode from 'vscode';
import { OutputChannelLogger } from '../../utils/output-channel-logger';

export async function getSelectedFileUris(args: {
  selectedUris?: vscode.Uri[];
  logger: OutputChannelLogger;
}): Promise<vscode.Uri[]> {
  const selectedUris = args.selectedUris ?? [];
  if (selectedUris.length === 0) return [];

  const collectedFileUris: vscode.Uri[] = [];
  const collectedFileUriStrings: string[] = [];

  for (const selectedUri of selectedUris) {
    if (!selectedUri) continue;

    if (selectedUri.scheme !== 'file') continue;

    const isFile = await tryIsFile({ uri: selectedUri, logger: args.logger });
    if (isFile) {
      const uriString = selectedUri.toString();
      if (collectedFileUriStrings.includes(uriString)) continue;

      collectedFileUriStrings.push(uriString);
      collectedFileUris.push(selectedUri);
      continue;
    }

    const isDirectory = await tryIsDirectory({ uri: selectedUri, logger: args.logger });
    if (!isDirectory) continue;

    const directoryFileUris = await collectFileUrisRecursively({ rootDirectoryUri: selectedUri, logger: args.logger });

    for (const directoryFileUri of directoryFileUris) {
      const directoryFileUriString = directoryFileUri.toString();
      if (collectedFileUriStrings.includes(directoryFileUriString)) continue;

      collectedFileUriStrings.push(directoryFileUriString);
      collectedFileUris.push(directoryFileUri);
    }
  }

  return collectedFileUris;
}

export async function collectFileUrisRecursively(args: {
  rootDirectoryUri: vscode.Uri;
  logger: OutputChannelLogger;
}): Promise<vscode.Uri[]> {
  const collectedFileUris: vscode.Uri[] = [];
  const collectedFileUriStrings: string[] = [];

  const directoryUrisToProcess: vscode.Uri[] = [args.rootDirectoryUri];

  while (directoryUrisToProcess.length > 0) {
    const currentDirectoryUri = directoryUrisToProcess.pop();
    if (!currentDirectoryUri) continue;

    try {
      const directoryEntries = await vscode.workspace.fs.readDirectory(currentDirectoryUri);

      for (const [entryName, entryType] of directoryEntries) {
        const entryUri = vscode.Uri.joinPath(currentDirectoryUri, entryName);

        if (entryType === vscode.FileType.Directory) {
          directoryUrisToProcess.push(entryUri);
          continue;
        }

        if (entryType !== vscode.FileType.File) continue;

        const entryUriString = entryUri.toString();
        if (collectedFileUriStrings.includes(entryUriString)) continue;

        collectedFileUriStrings.push(entryUriString);
        collectedFileUris.push(entryUri);
      }
    } catch (error) {
      args.logger.warn(`Failed reading directory entries: ${String(error)}`);
    }
  }

  return collectedFileUris;
}

export async function tryIsFile(args: { uri: vscode.Uri; logger: OutputChannelLogger }): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(args.uri);
    return stat.type === vscode.FileType.File;
  } catch (error) {
    args.logger.warn(`Failed reading uri stat: ${String(error)}`);
    return false;
  }
}

export async function tryIsDirectory(args: { uri: vscode.Uri; logger: OutputChannelLogger }): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(args.uri);
    return stat.type === vscode.FileType.Directory;
  } catch (error) {
    args.logger.warn(`Failed reading uri stat: ${String(error)}`);
    return false;
  }
}

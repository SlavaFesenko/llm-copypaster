import * as vscode from 'vscode';

export interface FilePayload {
  path: string;
  content: string;
  sourceRangeStart?: number;
  sourceRangeEnd?: number;
  operation?: string;
}

export interface FilesPayload {
  files: FilePayload[];
  warnings: string[];
  errors: string[];
}

export interface CollectedFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

export interface ReadUrisAsFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

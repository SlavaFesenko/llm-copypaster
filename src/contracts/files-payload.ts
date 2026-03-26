import * as vscode from 'vscode';

export interface FilesPayload {
  files: FilePayload[];
  warnings: string[];
  errors: string[];
}

export interface FilePayload {
  path: string;
  content: string;
  sourceRangeStart?: number;
  sourceRangeEnd?: number;
  operation?: string;
}

export interface TabBasedFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

export interface ReadUrisAsFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export interface CollectedFileItem {
  path: string;
  content: string | null;
  languageId?: string;
  readError?: string;
}

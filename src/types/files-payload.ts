export enum FilePayloadOperationType {
  EditedFull = 'EDITED_FULL',
  Created = 'CREATED',
  Deleted = 'DELETED',
}

export interface FilesPayloadSourceRange {
  start: number;
  end: number;
}

export interface FilesPayloadFile {
  path: string;
  content: string;
  sourceRange?: FilesPayloadSourceRange;
  operation?: FilePayloadOperationType;
}

export interface FilesPayload {
  files: FilesPayloadFile[];
  warnings: string[];
  errors: string[];
}

export interface FilesPayloadSourceRange {
  start: number;
  end: number;
}

export interface FilesPayloadFile {
  path: string;
  content: string;
  sourceRange?: FilesPayloadSourceRange;
  operation?: 'create' | 'update' | 'deleteMarker';
}

export interface FilesPayload {
  files: FilesPayloadFile[];
  warnings: string[];
  errors: string[];
}

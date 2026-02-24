import { FilesPayload } from '../../../types/files-payload';
import { parseConcatenatedFileListings } from './validators/parse-concatenated-file-listings';

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationFail {
  ok: false;
  errorMessage: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

export function validateClipboardTextToFilesPayload(rawClipboardText: string): ValidationResult<FilesPayload> {
  const parsed = parseConcatenatedFileListings(rawClipboardText);

  if (!parsed.ok) return parsed;

  if (parsed.value.files.length === 0) return { ok: false, errorMessage: 'No files found in clipboard text' };

  return parsed;
}

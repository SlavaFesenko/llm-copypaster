import { FilesPayload, FilesPayloadFile } from '../../../types/files-payload';

export interface ParseOk<T> {
  ok: true;
  value: T;
}

export interface ParseFail {
  ok: false;
  errorMessage: string;
}

export type ParseResult<T> = ParseOk<T> | ParseFail;

const headerRegex = /^#\s+(.+)\s*$/gm;

export function parseConcatenatedFileListings(rawText: string): ParseResult<FilesPayload> {
  const matches = [...rawText.matchAll(headerRegex)];

  if (matches.length === 0) return { ok: false, errorMessage: 'No file headers found (expected "# relative/path.ext")' };

  const files: FilesPayloadFile[] = [];

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const next = matches[index + 1];

    const path = (current[1] ?? '').trim();

    if (!path) return { ok: false, errorMessage: 'Empty file path in header' };

    const contentStartIndex = (current.index ?? 0) + current[0].length;
    const contentEndIndex = next?.index ?? rawText.length;

    const content = rawText.slice(contentStartIndex, contentEndIndex).replace(/^\r?\n/, '');

    files.push({
      path,
      content,
      sourceRange: { start: contentStartIndex, end: contentEndIndex },
    });
  }

  return { ok: true, value: { files, warnings: [], errors: [] } };
}

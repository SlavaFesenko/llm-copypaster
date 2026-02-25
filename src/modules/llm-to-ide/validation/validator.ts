import { LlmCopypasterConfig } from '../../../config';
import { FilePayloadOperationType, FilesPayload, FilesPayloadFile } from '../../../types/files-payload';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

type ParseResult<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

export function validateClipboardTextToFilesPayload(
  rawClipboardText: string,
  config: LlmCopypasterConfig
): ValidationResult<FilesPayload> {
  const headerRegex = new RegExp(config.codeListingHeaderRegex, 'gm');

  const parsed = parseConcatenatedFileListings(rawClipboardText, headerRegex);

  if (!parsed.ok) return parsed;

  if (parsed.value.files.length === 0) return { ok: false, errorMessage: 'No files found in clipboard text' };

  return parsed;
}

function parseConcatenatedFileListings(rawText: string, headerRegex: RegExp): ParseResult<FilesPayload> {
  const matches = [...rawText.matchAll(headerRegex)];

  if (matches.length === 0)
    return { ok: false, errorMessage: 'No file headers found (expected "## FILE: relative/path.ext")' };

  const files: FilesPayloadFile[] = [];

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const next = matches[index + 1];

    const path = (current[1] ?? '').trim();

    if (!path) return { ok: false, errorMessage: 'Empty file path in header' };

    const sectionStartIndex = (current.index ?? 0) + current[0].length;
    const sectionEndIndex = next?.index ?? rawText.length;

    const sectionRawText = rawText.slice(sectionStartIndex, sectionEndIndex).replace(/^\r?\n/, '');
    const parsedSection = parseFileSection(sectionRawText);

    if (!parsedSection.ok) return { ok: false, errorMessage: `${path}: ${parsedSection.errorMessage}` };

    files.push({
      path,
      content: parsedSection.value.content,
      operation: parsedSection.value.operation,
      sourceRange: { start: sectionStartIndex, end: sectionEndIndex },
    });
  }

  return { ok: true, value: { files, warnings: [], errors: [] } };
}

function parseFileSection(rawSectionText: string): ParseResult<{ content: string; operation?: FilePayloadOperationType }> {
  const { firstLine, restText } = splitFirstLine(rawSectionText);

  if (!firstLine) return { ok: true, value: { content: rawSectionText } };

  const operation = tryParseOperationLine(firstLine);

  if (!operation) return { ok: true, value: { content: rawSectionText } };

  if (operation === FilePayloadOperationType.Deleted) return { ok: true, value: { content: '', operation } };

  const normalizedContent = restText.replace(/^\r?\n/, '');

  return { ok: true, value: { content: normalizedContent, operation } };
}

function splitFirstLine(text: string): { firstLine: string; restText: string } {
  const newLineMatch = text.match(/\r?\n/);

  if (!newLineMatch) return { firstLine: text.trimEnd(), restText: '' };

  const newLineIndex = newLineMatch.index ?? 0;
  const newLineLength = newLineMatch[0].length;

  const firstLine = text.slice(0, newLineIndex).trimEnd();
  const restText = text.slice(newLineIndex + newLineLength);

  return { firstLine, restText };
}

function tryParseOperationLine(line: string): FilePayloadOperationType | undefined {
  const trimmedLine = line.trim();

  if (trimmedLine === 'FILE WAS EDITED_FULL') return FilePayloadOperationType.EditedFull;

  if (trimmedLine === 'FILE WAS CREATED') return FilePayloadOperationType.Created;

  if (trimmedLine === 'FILE WAS DELETED') return FilePayloadOperationType.Deleted;

  return undefined;
}

import { LlmCopypasterConfig, VitalParsingAnchorsConfig } from '../../../config/system-config-contracts';
import { FilePayloadOperationType, FilesPayload, FilesPayloadFile } from '../../../contracts/files-payload';

export type RawLlmOutputParserResult<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

type ParseResult<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

export class RawLlmOutputParser {
  public constructor(private readonly _config: LlmCopypasterConfig) {}

  public parseFilesPayload(rawClipboardText: string): RawLlmOutputParserResult<FilesPayload> {
    const headerRegex = new RegExp(
      String.raw`^${this._config.nonOverrideableSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR}\s+(.+)\s*$`,
      'gm'
    );

    const parsed = this._parseConcatenatedFileListings(
      rawClipboardText,
      headerRegex,
      this._config.nonOverrideableSettings.vitalParsingAnchors
    );

    if (!parsed.ok) return parsed;

    if (parsed.value.files.length === 0) return { ok: false, errorMessage: 'No files found in clipboard text' };

    return parsed;
  }

  private _parseConcatenatedFileListings(
    rawText: string,
    headerRegex: RegExp,
    llmToIdeParsingAnchors: VitalParsingAnchorsConfig
  ): ParseResult<FilesPayload> {
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
      const parsedSection = this._parseFileSection(
        sectionRawText,
        llmToIdeParsingAnchors.FILE_STATUS_ANCHOR,
        llmToIdeParsingAnchors
      );

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

  private _parseFileSection(
    rawSectionText: string,
    fileStatusPrefix: string,
    llmToIdeParsingAnchors: VitalParsingAnchorsConfig
  ): ParseResult<{ content: string; operation?: FilePayloadOperationType }> {
    const { firstLine, restText } = this._splitFirstLine(rawSectionText);

    if (!firstLine) return { ok: true, value: { content: rawSectionText } };

    const operation = this._tryParseOperationLine(firstLine, fileStatusPrefix, llmToIdeParsingAnchors);

    if (!operation) return { ok: true, value: { content: rawSectionText } };

    if (operation === llmToIdeParsingAnchors.FILE_DELETED_ANCHOR) return { ok: true, value: { content: '', operation } };

    const normalizedContent = restText.replace(/^\r?\n/, '');

    return { ok: true, value: { content: normalizedContent, operation } };
  }

  private _splitFirstLine(text: string): { firstLine: string; restText: string } {
    const newLineMatch = text.match(/\r?\n/);

    if (!newLineMatch) return { firstLine: text.trimEnd(), restText: '' };

    const newLineIndex = newLineMatch.index ?? 0;
    const newLineLength = newLineMatch[0].length;

    const firstLine = text.slice(0, newLineIndex).trimEnd();
    const restText = text.slice(newLineIndex + newLineLength);

    return { firstLine, restText };
  }

  private _tryParseOperationLine(
    line: string,
    fileStatusPrefix: string,
    llmToIdeParsingAnchors: VitalParsingAnchorsConfig
  ): FilePayloadOperationType | undefined {
    const trimmedLine = line.trim();
    const trimmedPrefix = fileStatusPrefix.trim();

    const prefix = trimmedPrefix ? `${trimmedPrefix} ` : '';

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR;

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_CREATED_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_CREATED_ANCHOR;

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_DELETED_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_DELETED_ANCHOR;

    return undefined;
  }
}

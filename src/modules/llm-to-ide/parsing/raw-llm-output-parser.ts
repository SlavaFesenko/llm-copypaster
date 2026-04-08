import { SystemConfig, VitalParsingAnchorsConfig } from '../../../config/contracts/system-config-contracts';
import { FilePayload, FilesPayload } from '../../../contracts/file-contracts';
import { isOutsideWorkspaceFilePath } from '../../../utils/file-utils';

export class RawLlmOutputParser {
  private readonly _codeListingHeaderAnchor: string;
  private readonly _endOfOutputAnchor: string | null;
  private readonly _fileHeaderRegex: RegExp;
  private readonly _firstNewLineRegex: RegExp = /\r?\n/;
  private readonly _leadingNewLineRegex: RegExp = /^\r?\n/;

  public constructor(private readonly _config: SystemConfig) {
    this._codeListingHeaderAnchor = this._config.presetIndependentSettings.vitalParsingAnchors.CODE_LISTING_HEADER_ANCHOR;
    this._endOfOutputAnchor = this._config.presetIndependentSettings.vitalParsingAnchors.END_OF_OUTPUT_ANCHOR;
    this._fileHeaderRegex = new RegExp(String.raw`^${this._codeListingHeaderAnchor}\s+(.+)\s*$`, 'gm');
  }

  public parseFilesPayload(rawClipboardText: string): FilesPayload {
    const rawClipboardTextWithoutIgnoredTail = this._cutOffIgnoredTextAfterEndOfOutputAnchor(rawClipboardText);

    const parsedFilesPayload = this._parseConcatenatedFileListings(
      rawClipboardTextWithoutIgnoredTail,
      this._config.presetIndependentSettings.vitalParsingAnchors
    );

    if (parsedFilesPayload.files.length === 0) throw new Error('No files found in clipboard text');

    return parsedFilesPayload;
  }

  private _cutOffIgnoredTextAfterEndOfOutputAnchor(rawClipboardText: string): string {
    if (!this._endOfOutputAnchor) return rawClipboardText;

    const configEndOfOutputAnchorIndex = rawClipboardText.indexOf(this._endOfOutputAnchor);

    if (configEndOfOutputAnchorIndex === -1) return rawClipboardText;

    return rawClipboardText.slice(0, configEndOfOutputAnchorIndex);
  }

  private _parseConcatenatedFileListings(rawText: string, llmToIdeParsingAnchors: VitalParsingAnchorsConfig): FilesPayload {
    const matches = [...rawText.matchAll(this._fileHeaderRegex)];

    if (matches.length === 0)
      throw new Error(`No file headers found (expected "${this._codeListingHeaderAnchor} path/filename.ext")`);

    const files: FilePayload[] = [];

    for (let index = 0; index < matches.length; index++) {
      const current = matches[index];
      const next = matches[index + 1];

      const path = (current[1] ?? '').trim();

      if (!path) throw new Error('Empty file path in header');

      const sectionStartIndex = (current.index ?? 0) + current[0].length;
      const sectionEndIndex = next?.index ?? rawText.length;

      const sectionRawText = rawText.slice(sectionStartIndex, sectionEndIndex).replace(this._leadingNewLineRegex, '');
      const parsedSection = this._parseFileSection(
        sectionRawText,
        llmToIdeParsingAnchors.FILE_STATUS_ANCHOR,
        llmToIdeParsingAnchors
      );

      files.push({
        path,
        content: parsedSection.content,
        operation: parsedSection.operation,
        sourceRangeStart: sectionStartIndex,
        sourceRangeEnd: sectionEndIndex,
        isOutsideWorkspace: isOutsideWorkspaceFilePath(path),
      });
    }

    return { files, warnings: [], errors: [] };
  }

  private _parseFileSection(
    rawSectionText: string,
    fileStatusPrefix: string,
    llmToIdeParsingAnchors: VitalParsingAnchorsConfig
  ): { content: string; operation?: string } {
    const { firstLine, restText } = this._splitFirstLine(rawSectionText);

    if (!firstLine) return { content: rawSectionText };

    const operation = this._tryParseOperationLine(firstLine, fileStatusPrefix, llmToIdeParsingAnchors);

    if (!operation) return { content: rawSectionText };

    if (operation === llmToIdeParsingAnchors.FILE_DELETED_ANCHOR) return { content: '', operation };

    const normalizedContent = restText.replace(this._leadingNewLineRegex, '');

    return { content: normalizedContent, operation };
  }

  private _splitFirstLine(text: string): { firstLine: string; restText: string } {
    const newLineMatch = this._firstNewLineRegex.exec(text);

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
  ): string | null {
    const trimmedLine = line.trim();
    const trimmedPrefix = fileStatusPrefix.trim();

    const prefix = trimmedPrefix ? `${trimmedPrefix} ` : '';

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_EDITED_FULL_ANCHOR;

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_CREATED_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_CREATED_ANCHOR;

    if (trimmedLine === `${prefix}${llmToIdeParsingAnchors.FILE_DELETED_ANCHOR}`)
      return llmToIdeParsingAnchors.FILE_DELETED_ANCHOR;

    return null;
  }
}

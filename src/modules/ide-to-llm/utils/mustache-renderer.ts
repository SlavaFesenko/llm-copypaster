// 'Supported Mustache-like syntax:',
// '',
// '1) Placeholder replacement (one-by-one):',
// '   - {{someKey}}',
// '',
// '2) Conditional blocks (explicit evaluation is passed by caller):',
// '   - {{#if someFlag}} ... {{/if}}',
// '   - {{#if someFlag}} ... {{else}} ... {{/if}}',
// '   - {{#if someFlag}} ... {{else if otherFlag}} ... {{else}} ... {{/if}}',
// '',
// 'Public API:',
// ' - renderConstant(promptText, key, value)',
// ' - renderIf(promptText, flagName, isEnabled)',
// ' - renderIfElse(promptText, flagName, isEnabled)',
// '',
// 'Notes:',
// ' - Unknown/mismatched tags are kept unchanged',
// ' - renderIf/renderIfElse supports nested {{#if ...}} blocks',
// ' - Expressions are not evaluated by MustacheParser; the caller decides booleans',
export class MustacheRenderer {
  private readonly _placeholderRegexPattern: string;

  public constructor(placeholderRegexPattern: string) {
    this._placeholderRegexPattern = placeholderRegexPattern;
  }

  public renderConstant(promptText: string, placeholderKey: string, placeholderValue: string): string {
    let placeholderRegex: RegExp;

    try {
      placeholderRegex = new RegExp(this._placeholderRegexPattern, 'g');
    } catch {
      return promptText;
    }

    return promptText.replace(placeholderRegex, (fullMatch, foundPlaceholderKey: string) => {
      if (foundPlaceholderKey !== placeholderKey) return fullMatch;
      return placeholderValue;
    });
  }

  public renderIf(promptText: string, flagName: string, isEnabled: boolean): string {
    return this._renderIfInternal(promptText, flagName, isEnabled, false);
  }

  public renderIfElse(promptText: string, flagName: string, isEnabled: boolean): string {
    return this._renderIfInternal(promptText, flagName, isEnabled, true);
  }

  private _renderIfInternal(promptText: string, flagName: string, isEnabled: boolean, allowElseBranches: boolean): string {
    let nextPromptText = promptText;
    let searchStartIndex = 0;

    while (searchStartIndex < nextPromptText.length) {
      const ifStartTagIndex = this._findIfStartTagIndex(nextPromptText, searchStartIndex, flagName);
      if (ifStartTagIndex === -1) break;

      const parsedIfBlock = this._tryParseIfBlock(nextPromptText, ifStartTagIndex, flagName, allowElseBranches);
      if (!parsedIfBlock) {
        searchStartIndex = ifStartTagIndex + 2;
        continue;
      }

      const selectedText = this._selectIfBlockText(parsedIfBlock, isEnabled);

      nextPromptText =
        nextPromptText.slice(0, parsedIfBlock.blockStartIndex) +
        selectedText +
        nextPromptText.slice(parsedIfBlock.blockEndIndexExclusive);

      searchStartIndex = parsedIfBlock.blockStartIndex + selectedText.length;
    }

    return nextPromptText;
  }

  private _findIfStartTagIndex(promptText: string, searchStartIndex: number, flagName: string): number {
    const exactStartTag = `{{#if ${flagName}}}`;
    return promptText.indexOf(exactStartTag, searchStartIndex);
  }

  private _selectIfBlockText(parsedIfBlock: ParsedIfBlock, isEnabled: boolean): string {
    if (isEnabled) return parsedIfBlock.ifBranchText;
    if (parsedIfBlock.elseBranchText !== null) return parsedIfBlock.elseBranchText;

    for (const elseIfBranch of parsedIfBlock.elseIfBranches) {
      if (!elseIfBranch.isConditionMet) continue;
      return elseIfBranch.branchText;
    }

    return '';
  }

  private _tryParseIfBlock(
    promptText: string,
    ifStartTagIndex: number,
    flagName: string,
    allowElseBranches: boolean
  ): ParsedIfBlock | null {
    const ifStartTag = `{{#if ${flagName}}}`;
    const blockStartIndex = ifStartTagIndex;
    const ifContentStartIndex = ifStartTagIndex + ifStartTag.length;

    const readResult = this._readUntilIfBlockEnd(promptText, ifContentStartIndex, allowElseBranches);
    if (!readResult) return null;

    return {
      blockStartIndex,
      blockEndIndexExclusive: readResult.blockEndIndexExclusive,
      ifBranchText: readResult.ifBranchText,
      elseIfBranches: readResult.elseIfBranches,
      elseBranchText: readResult.elseBranchText,
    };
  }

  private _readUntilIfBlockEnd(
    promptText: string,
    startIndex: number,
    allowElseBranches: boolean
  ): ReadIfBlockResult | null {
    let nextIndex = startIndex;

    let ifBranchText = '';
    const elseIfBranches: ElseIfBranch[] = [];
    let elseBranchText: string | null = null;

    let currentTextBuffer = '';
    let currentSection: 'if' | 'elseIf' | 'else' = 'if';
    let currentElseIfBranch: ElseIfBranch | null = null;

    while (nextIndex < promptText.length) {
      const nextTagStartIndex = promptText.indexOf('{{', nextIndex);
      if (nextTagStartIndex === -1) return null;

      currentTextBuffer += promptText.slice(nextIndex, nextTagStartIndex);

      const tagEndIndex = promptText.indexOf('}}', nextTagStartIndex + 2);
      if (tagEndIndex === -1) return null;

      const tagRaw = promptText.slice(nextTagStartIndex, tagEndIndex + 2);
      const tagContent = promptText.slice(nextTagStartIndex + 2, tagEndIndex).trim();

      if (tagContent === '/if') {
        if (currentSection === 'if') ifBranchText = currentTextBuffer;
        if (currentSection === 'elseIf' && currentElseIfBranch) {
          currentElseIfBranch.branchText = currentTextBuffer;
          elseIfBranches.push(currentElseIfBranch);
        }
        if (currentSection === 'else') elseBranchText = currentTextBuffer;

        return {
          blockEndIndexExclusive: tagEndIndex + 2,
          ifBranchText,
          elseIfBranches,
          elseBranchText,
        };
      }

      if (!allowElseBranches) {
        currentTextBuffer += tagRaw;
        nextIndex = tagEndIndex + 2;
        continue;
      }

      if (tagContent === 'else') {
        if (currentSection === 'if') ifBranchText = currentTextBuffer;
        if (currentSection === 'elseIf' && currentElseIfBranch) {
          currentElseIfBranch.branchText = currentTextBuffer;
          elseIfBranches.push(currentElseIfBranch);
        }

        currentTextBuffer = '';
        currentSection = 'else';
        currentElseIfBranch = null;

        nextIndex = tagEndIndex + 2;
        continue;
      }

      if (tagContent.startsWith('else if ')) {
        if (currentSection === 'if') ifBranchText = currentTextBuffer;
        if (currentSection === 'elseIf' && currentElseIfBranch) {
          currentElseIfBranch.branchText = currentTextBuffer;
          elseIfBranches.push(currentElseIfBranch);
        }

        const elseIfFlagName = tagContent.replace(/^else\s+if\s+/, '').trim();

        currentTextBuffer = '';
        currentSection = 'elseIf';
        currentElseIfBranch = {
          conditionFlagName: elseIfFlagName,
          isConditionMet: false,
          branchText: '',
        };

        nextIndex = tagEndIndex + 2;
        continue;
      }

      currentTextBuffer += tagRaw;
      nextIndex = tagEndIndex + 2;
    }

    return null;
  }
}

interface ElseIfBranch {
  conditionFlagName: string;
  isConditionMet: boolean;
  branchText: string;
}

interface ParsedIfBlock {
  blockStartIndex: number;
  blockEndIndexExclusive: number;
  ifBranchText: string;
  elseIfBranches: ElseIfBranch[];
  elseBranchText: string | null;
}

interface ReadIfBlockResult {
  blockEndIndexExclusive: number;
  ifBranchText: string;
  elseIfBranches: ElseIfBranch[];
  elseBranchText: string | null;
}

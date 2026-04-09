import { LiquidError } from 'liquidjs';

import { type LiquidJsResolveIssue } from './report-helpers';

interface LiquidErrorsContract extends LiquidError {
  errors: unknown[];
}

export class LiquidJsErrorsResolver {
  public static resolve(instructionId: string, error: unknown): LiquidJsResolveIssue[] {
    const liquidErrors = this._tryGetLiquidErrors(error);
    if (liquidErrors) {
      return liquidErrors.errors.map(nestedLiquidError => ({
        instructionId,
        errorText: this._buildLiquidJsIssueText(nestedLiquidError),
      }));
    }

    return [
      {
        instructionId,
        errorText: this._buildLiquidJsIssueText(error),
      },
    ];
  }

  private static _buildLiquidJsIssueText(error: unknown): string {
    if (LiquidError.is(error)) return this._buildSingleLiquidJsErrorText(error);

    return this._buildUnknownErrorText(error);
  }

  private static _buildSingleLiquidJsErrorText(error: LiquidError): string {
    const lines: string[] = [error.message];

    if (error.originalError?.message && error.originalError.message !== error.message)
      lines.push(`Original error: ${error.originalError.message}`);

    if (error.context) {
      lines.push('Context:');
      lines.push(error.context);
    }

    return lines.join('\n');
  }

  private static _buildUnknownErrorText(error: unknown): string {
    if (error instanceof Error) return error.message || error.name;

    return String(error);
  }

  private static _tryGetLiquidErrors(error: unknown): LiquidErrorsContract | null {
    if (!LiquidError.is(error)) return null;
    if (error.name !== 'LiquidErrors') return null;

    const liquidErrorsCandidate = error as LiquidErrorsContract;
    if (!Array.isArray(liquidErrorsCandidate.errors)) return null;

    return liquidErrorsCandidate;
  }
}

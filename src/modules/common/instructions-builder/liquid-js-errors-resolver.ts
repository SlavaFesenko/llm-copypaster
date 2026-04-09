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
        ...this._buildLiquidJsIssueDetails(nestedLiquidError),
      }));
    }

    return [
      {
        instructionId,
        ...this._buildLiquidJsIssueDetails(error),
      },
    ];
  }

  private static _buildLiquidJsIssueDetails(error: unknown): Omit<LiquidJsResolveIssue, 'instructionId'> {
    if (LiquidError.is(error)) return this._buildSingleLiquidJsIssueDetails(error);

    return {
      summary: this._buildUnknownErrorText(error),
    };
  }

  private static _buildSingleLiquidJsIssueDetails(error: LiquidError): Omit<LiquidJsResolveIssue, 'instructionId'> {
    return {
      summary: error.message,
      originalErrorText:
        error.originalError?.message && error.originalError.message !== error.message
          ? error.originalError.message
          : undefined,
      contextText: error.context || undefined,
    };
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

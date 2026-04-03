import { LlmCopypasterConfig } from '../contracts/system-config-contracts';
import { LlmCopypasterUserConfig, llmCopypasterUserConfigSchema } from '../contracts/user-config-contracts';
import { ValidationIssue, ValidationIssueSeverity } from './contracts';

export class UserConfigValidator {
  public constructor(
    private readonly _userConfig: LlmCopypasterUserConfig,
    private readonly _targetConfig: LlmCopypasterConfig
  ) {}

  public validate(): ValidationIssue[] {
    return [...this._validateSchemaConsistencyIssues(), ...this._validateOverridesIssues()];
  }

  private _validateSchemaConsistencyIssues(): ValidationIssue[] {
    const validationIssues: ValidationIssue[] = [];
    const zodValidationResult = llmCopypasterUserConfigSchema.safeParse(this._userConfig);

    if (!zodValidationResult.success) {
      validationIssues.push(
        ...zodValidationResult.error.issues.map(zodIssue => {
          const normalizedPath = zodIssue.path.length ? zodIssue.path.join('.') : 'root';

          return {
            targetConfigName: 'User Config',
            violatedRuleName: 'Static Zod User Config Schema Validation',
            ruleRationale: 'User config JSON must stay consistent with the declared TS user-config contract',
            violationDescription: `${normalizedPath}: ${zodIssue.message}`,
            severity: ValidationIssueSeverity.Critical,
          };
        })
      );
    }

    return validationIssues;
  }

  private _validateOverridesIssues(): ValidationIssue[] {
    void this._targetConfig;

    // Placeholder for future overrides validation against targetConfig,
    // including checks that override paths resolve to existing values in live config records
    return [];
  }
}

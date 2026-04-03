import { llmCopypasterUserConfigSchema } from '../../contracts/user-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class UserConfigSchemaValidationRule implements ValidationRule {
  public readonly name = 'Static Zod User Config Schema Validation';
  public readonly rationale = 'User config JSON must stay consistent with the declared TS user-config contract';
  public readonly severity = ValidationIssueSeverity.Critical;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const userConfig = validationRuleContext.userConfig;

    if (!userConfig) return [];

    const zodValidationResult = llmCopypasterUserConfigSchema.safeParse(userConfig);

    if (zodValidationResult.success) return [];

    return zodValidationResult.error.issues.map(zodIssue => {
      const normalizedPath = zodIssue.path.length ? zodIssue.path.join('.') : 'root';

      return `${normalizedPath}: ${zodIssue.message}`;
    });
  }
}

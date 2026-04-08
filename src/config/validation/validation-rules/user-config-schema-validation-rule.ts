import { userConfigSchema } from '../../contracts/user-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

// Important note: this rule already checks presets-validity as it's described as zod-schema in user config contracts
export class UserConfigSchemaValidationRule implements ValidationRule {
  public readonly name = 'Static Zod User Config Schema Validation';
  public readonly rationale =
    'User config must match the static runtime patch schema before business-rule validation can safely run';
  public readonly severity = ValidationIssueSeverity.Warning;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const userConfig = validationRuleContext.userConfig;

    if (!userConfig) return [];

    const zodValidationResult = userConfigSchema.safeParse(userConfig);

    if (zodValidationResult.success) return [];

    return zodValidationResult.error.issues.map(zodIssue => {
      const normalizedPath = zodIssue.path.length ? zodIssue.path.join('.') : 'root';

      return `${normalizedPath}: ${zodIssue.message}`;
    });
  }
}

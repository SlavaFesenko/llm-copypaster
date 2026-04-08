import { systemConfigSchema } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class SystemConfigSchemaValidationRule implements ValidationRule {
  public readonly name = 'Static Zod Config Schema Validation';
  public readonly rationale = 'Config must match the static runtime schema before business-rule validation can safely run';
  public readonly severity = ValidationIssueSeverity.Critical;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const zodValidationResult = systemConfigSchema.safeParse(validationRuleContext.targetConfig);

    if (zodValidationResult.success) return [];

    return zodValidationResult.error.issues.map(zodIssue => {
      const normalizedPath = zodIssue.path.length ? zodIssue.path.join('.') : 'root';

      return `${normalizedPath}: ${zodIssue.message}`;
    });
  }
}

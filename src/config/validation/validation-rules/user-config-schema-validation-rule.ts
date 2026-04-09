import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { userConfigSchema } from '../../contracts/user-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

// Important note: this rule already checks presets-validity as it's described as zod-schema in user config contracts
export class UserConfigSchemaValidationRule implements ValidationRule {
  public readonly severity = ValidationIssueSeverity.Warning;
  public readonly name = 'Static Zod User Config Schema Validation';
  public readonly rationale = 'User config must match the static runtime patch schema to be applied in resulted config';
  public readonly fixTip = `Fix the invalid fields in ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`;

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

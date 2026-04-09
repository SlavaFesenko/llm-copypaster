import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { systemConfigPropsMap } from '../../contracts/system-config-map';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

const flag =
  systemConfigPropsMap.presetIndependentSettings.notificationSettings.configValidation.suppressWarningIssuesToast
    .pathAndName;

export class SuppressWarningIssuesToastRule implements ValidationRule {
  public readonly severity = ValidationIssueSeverity.Recommendation;
  public readonly name = 'Suppress Warning Issues Toast';
  public readonly rationale = 'Warning validation toasts highlight config problems, which may impact app work';
  public readonly fixTip = `Set "${flag}" = false in ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}.`;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    if (
      !validationRuleContext.targetConfig.presetIndependentSettings.notificationSettings.configValidation
        .suppressWarningIssuesToast
    )
      return [];

    return [`"${flag}" = true, so warning-level config validation issues will be hidden`];
  }
}

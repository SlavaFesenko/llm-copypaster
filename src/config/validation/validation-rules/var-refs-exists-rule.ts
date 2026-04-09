import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { systemConfigMap } from '../../contracts/system-config-map';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class VarRefsExistRule implements ValidationRule {
  public readonly severity = ValidationIssueSeverity.Warning;
  public readonly name = 'Shared variable config refs must point to existing config sections';
  public readonly rationale = 'Otherwise instructions will receive garbage instead of expected variables-values';
  public readonly fixTip = `Fix the broken references in ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const invalidConfigRefs = this._getInvalidConfigRefs(validationRuleContext);

    if (!invalidConfigRefs.length) return [];

    return [`These ref-vars were not resolved:\n- ${invalidConfigRefs.join('\n- ')}`];
  }

  private _getInvalidConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
    const instructionsAndVariables = validationRuleContext.targetConfig.presetDependentSettings.instructionsSettings;
    const sharedReferenceVariablesById = instructionsAndVariables.referencesById;

    return Object.entries(sharedReferenceVariablesById).map(([sharedVariableId, variableValue]) => {
      const fullVariablePath = `${systemConfigMap.presetDependentSettings.instructionsSettings.variablesById.pathAndName}.${sharedVariableId}`;
      const configReferenceValuePath = typeof variableValue === 'string' ? variableValue : JSON.stringify(variableValue);

      return `"${fullVariablePath}": "${configReferenceValuePath}"`;
    });
  }
}

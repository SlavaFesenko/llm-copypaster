import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class VarRefsExistRule implements ValidationRule {
  public readonly name = 'Shared variable config refs must point to existing config sections';
  public readonly rationale = 'Otherwise instructions will receive garbage instead of expected variables-values';
  public readonly severity = ValidationIssueSeverity.Warning;
  public readonly skipForOverrides = false;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const invalidConfigRefs = this._getInvalidConfigRefs(validationRuleContext);

    if (!invalidConfigRefs.length) return [];

    return [`These ref-vars were not resolved:\n- ${invalidConfigRefs.join('\n- ')}`];
  }

  private _getInvalidConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
    const instructionsAndVariables = validationRuleContext.targetConfig.coreSettings.instructionsAndVariables;
    const sharedReferenceVariablesById = instructionsAndVariables.sharedReferenceVariablesById;

    return Object.entries(sharedReferenceVariablesById).map(([sharedVariableId, variableValue]) => {
      // TODO: если нельзя избежать хардкодных ссылок, нужно обеспечить струкутуру, обеспечивающую автопереименование по
      // всему проекту, например, названия конфига хранить в обьекте, или все-таки задуматься о c#-аналоге nameof
      const fullVariablePath = `coreSettings.instructionsAndVariables.sharedReferenceVariablesById.${sharedVariableId}`;
      const configReferenceValuePath = typeof variableValue === 'string' ? variableValue : JSON.stringify(variableValue);

      return `"${fullVariablePath}": "${configReferenceValuePath}"`;
    });
  }
}

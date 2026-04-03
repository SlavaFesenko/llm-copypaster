import { ConfigRefVarsResolver, UnresolvedConfigVarRefValuePayload } from '../../helpers/config-ref-vars-resolver';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class VarRefsExistRule implements ValidationRule {
  getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    throw new Error('Method not implemented.');
  }
  public readonly name = 'Shared variable config refs must point to existing config sections';
  public readonly rationale = 'Otherwise instructions will receive garbage instead of expected variables-values';
  public readonly severity = ValidationIssueSeverity.Warning;
  public readonly skipForOverrides = false;

  public getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
    const invalidConfigRefs = this._getInvalidConfigRefs(validationRuleContext);

    if (!invalidConfigRefs.length) return null;

    return `These ref-vars were not resolved:\n- ${invalidConfigRefs.join('\n- ')}`;
  }

  private _getInvalidConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
    const instructionsAndVariables = validationRuleContext.targetConfig.coreSettings.instructionsAndVariables;
    const sharedReferenceVariablesById = instructionsAndVariables.sharedReferenceVariablesById;

    return [...this._collectUnresolvedVariablesById(sharedReferenceVariablesById)];
  }

  private _collectUnresolvedVariablesById(variablesById: Record<string, unknown>): string[] {
    return Object.entries(variablesById)
      .map(([, variableValue]) => ConfigRefVarsResolver.tryParseUnresolvedConfigVarRefValue(variableValue))
      .filter((unresolvedPayload): unresolvedPayload is UnresolvedConfigVarRefValuePayload => !!unresolvedPayload)
      .map(
        unresolvedPayload =>
          `"${unresolvedPayload.fullVariablePath}": "${unresolvedPayload.configReferenceValuePath}": ${unresolvedPayload.unresolvedReason}`
      );
  }
}

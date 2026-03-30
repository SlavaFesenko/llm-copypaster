import { LlmCopypasterConfig } from '../../contracts/system-config-contracts';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

export class VarRefsExistRule implements ValidationRule {
  public readonly name = 'Shared variable config refs must point to existing config sections';
  public readonly rationale = 'Otherwise prompt variables resolve to broken paths';
  public readonly severity = ValidationIssueSeverity.Warning;
  public readonly skipForOverrides = false;

  public getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
    const invalidConfigRefs = this._getInvalidConfigRefs(validationRuleContext);

    if (!invalidConfigRefs.length) return null;

    return `These sharedVariablesById config refs must point to existing config sections:\n- ${invalidConfigRefs.join('\n- ')}`;
  }

  private _getInvalidConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
    const configRefVarAnchor =
      validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors.CONFIG_REF_VAR_ANCHOR;
    const sharedVariablesById = validationRuleContext.mergedConfig.coreSettings.instructionsAndVariables.sharedVariablesById;

    return Object.entries(sharedVariablesById)
      .filter(([, sharedVariableValue]) => sharedVariableValue.startsWith(configRefVarAnchor))
      .filter(
        ([, sharedVariableValue]) =>
          !this._doesConfigRefPathExist(validationRuleContext.mergedConfig, sharedVariableValue, configRefVarAnchor)
      )
      .map(
        ([sharedVariableId, sharedVariableValue]) =>
          `coreSettings.instructionsAndVariables.sharedVariablesById.${sharedVariableId}: "${sharedVariableValue}"`
      );
  }

  private _doesConfigRefPathExist(
    mergedConfig: LlmCopypasterConfig,
    sharedVariableValue: string,
    configRefVarAnchor: string
  ): boolean {
    const configRefPath = sharedVariableValue.slice(configRefVarAnchor.length);
    const configRefPathSegments = configRefPath.split('.').filter(configRefPathSegment => configRefPathSegment.length);

    let currentConfigNode: unknown = mergedConfig;

    for (const configRefPathSegment of configRefPathSegments) {
      if (!this._isObjectLike(currentConfigNode)) return false;
      if (!(configRefPathSegment in currentConfigNode)) return false;

      currentConfigNode = currentConfigNode[configRefPathSegment];
    }

    return true;
  }

  private _isObjectLike(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }
}

// import { resolveConfigVarRefValue } from '../../../utils/config-var-ref-resolver';
// import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

// export class VarRefsExistRule implements ValidationRule {
//   public readonly name = 'Shared variable config refs must point to existing config sections';
//   public readonly rationale = 'Otherwise prompt variables will not be resolved';
//   public readonly severity = ValidationIssueSeverity.Warning;
//   public readonly skipForOverrides = false;

//   public getViolationDescription(validationRuleContext: ValidationRuleContext): string | null {
//     const invalidConfigRefs = this._getInvalidConfigRefs(validationRuleContext);

//     if (!invalidConfigRefs.length) return null;

//     return `These sharedVariablesById config refs must point to existing config sections:\n- ${invalidConfigRefs.join('\n- ')}`;
//   }

//   private _getInvalidConfigRefs(validationRuleContext: ValidationRuleContext): string[] {
//     const configRefVarAnchor =
//       validationRuleContext.mergedConfig.nonOverrideableSettings.vitalParsingAnchors.CONFIG_REF_VAR_ANCHOR;
//     const sharedVariablesById = validationRuleContext.mergedConfig.coreSettings.instructionsAndVariables.sharedVariablesById;

//     return Object.entries(sharedVariablesById)
//       .filter(([, sharedVariableValue]) => {
//         const configVarRefResolution = resolveConfigVarRefValue(
//           validationRuleContext.mergedConfig,
//           sharedVariableValue,
//           configRefVarAnchor
//         );

//         return configVarRefResolution.isConfigVarRef && configVarRefResolution.resolvedValue === undefined;
//       })
//       .map(
//         ([sharedVariableId, sharedVariableValue]) =>
//           `coreSettings.instructionsAndVariables.sharedVariablesById.${sharedVariableId}: "${sharedVariableValue}"`
//       );
//   }
// }

import get from 'lodash/get';

import { LlmCopypasterConfig } from '../contracts/system-config-contracts';

export interface UnresolvedConfigVarRefValuePayload {
  unresolvedReason: string;
  configReferenceValuePath: string;
  fullVariablePath: string;
}

export class ConfigRefVarsResolver {
  public static tryParseUnresolvedConfigVarRefValue(variableValue: unknown): UnresolvedConfigVarRefValuePayload | null {
    if (typeof variableValue !== 'string') return null; // unresolved var may be only in string format

    try {
      return JSON.parse(variableValue) as UnresolvedConfigVarRefValuePayload;
    } catch {
      return null;
    }
  }

  public resolve(config: LlmCopypasterConfig): LlmCopypasterConfig {
    const instructionsAndVariables = config.coreSettings.instructionsAndVariables;
    const sharedReferenceVariablesById = instructionsAndVariables.sharedReferenceVariablesById;

    const resolvedSharedReferenceVariablesById = Object.fromEntries(
      Object.entries(sharedReferenceVariablesById).map(([sharedRefVariableId, configRefPath]) => [
        sharedRefVariableId,
        this._resolveConfigVarRefValue(
          config,
          configRefPath,
          `coreSettings.instructionsAndVariables.sharedReferenceVariablesById.${sharedRefVariableId}`
        ),
      ])
    );

    return {
      ...config,
      coreSettings: {
        ...config.coreSettings,
        instructionsAndVariables: {
          ...instructionsAndVariables,
          sharedReferenceVariablesById: resolvedSharedReferenceVariablesById,
        },
      },
    };
  }

  private _resolveConfigVarRefValue(
    config: LlmCopypasterConfig,
    configRefPath: unknown,
    fullConfigVariablePath: string
  ): unknown {
    if (typeof configRefPath !== 'string')
      return this._buildUnresolvedConfigVarRefValue(
        'Initial reference value type is not string',
        'no-path-was-obtained',
        fullConfigVariablePath
      );

    const normalizedConfigRefPath = configRefPath.trim();

    if (!normalizedConfigRefPath)
      return this._buildUnresolvedConfigVarRefValue(
        'Initial reference value is empty string',
        configRefPath,
        fullConfigVariablePath
      );

    const resolvedValue = get(config, normalizedConfigRefPath);

    if (resolvedValue === undefined)
      return this._buildUnresolvedConfigVarRefValue(
        'Referenced config value was not found',
        configRefPath,
        fullConfigVariablePath
      );

    return resolvedValue;
  }

  private _buildUnresolvedConfigVarRefValue(
    unresolvedReason: string,
    initialConfigReferenceValue: string,
    fullConfigVariablePath: string
  ): string {
    const unresolvedConfigVarRefValuePayload: UnresolvedConfigVarRefValuePayload = {
      unresolvedReason,
      configReferenceValuePath: initialConfigReferenceValue,
      fullVariablePath: fullConfigVariablePath,
    };

    return JSON.stringify(unresolvedConfigVarRefValuePayload);
  }
}

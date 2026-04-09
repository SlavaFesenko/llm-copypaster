import get from 'lodash/get';

import { SystemConfig } from '../contracts/system-config-contracts';

export class ConfigRefVarsResolver {
  public resolve(config: SystemConfig): SystemConfig {
    const instructionsAndVariables = config.presetDependentSettings.instructionsSettings;
    const sharedVariablesById = instructionsAndVariables.variablesById;
    const sharedReferenceVariablesById = instructionsAndVariables.referencesById;
    const nextSharedVariablesById = { ...sharedVariablesById };
    const nextSharedReferenceVariablesById: Record<string, unknown> = {};

    for (const [sharedRefVariableId, configRefPath] of Object.entries(sharedReferenceVariablesById)) {
      const resolveConfigVarRefValueResult = this._resolveConfigVarRefValue(config, configRefPath);

      if (resolveConfigVarRefValueResult.isResolved) {
        nextSharedVariablesById[sharedRefVariableId] = resolveConfigVarRefValueResult.resolvedValue;

        continue;
      }

      nextSharedReferenceVariablesById[sharedRefVariableId] = configRefPath;
    }

    return {
      ...config,
      presetDependentSettings: {
        ...config.presetDependentSettings,
        instructionsSettings: {
          ...instructionsAndVariables,
          variablesById: nextSharedVariablesById,
          referencesById: nextSharedReferenceVariablesById,
        },
      },
    };
  }

  private _resolveConfigVarRefValue(config: SystemConfig, configRefPath: unknown): ResolveConfigVarRefValueResult {
    if (typeof configRefPath !== 'string') return { isResolved: false, resolvedValue: configRefPath };

    const normalizedConfigRefPath = configRefPath.trim();

    if (!normalizedConfigRefPath) return { isResolved: false, resolvedValue: configRefPath };

    const resolvedValue = get(config, normalizedConfigRefPath);

    if (resolvedValue === undefined) return { isResolved: false, resolvedValue: configRefPath };

    return {
      isResolved: true,
      resolvedValue,
    };
  }
}

interface ResolveConfigVarRefValueResult {
  isResolved: boolean;
  resolvedValue: unknown;
}

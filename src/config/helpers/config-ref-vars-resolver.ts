import get from 'lodash/get';

import { LlmCopypasterConfig } from '../contracts/system-config-contracts';

export class ConfigRefVarsResolver {
  public resolve(config: LlmCopypasterConfig): LlmCopypasterConfig {
    const instructionsAndVariables = config.coreSettings.instructionsAndVariables;
    const sharedVariablesById = instructionsAndVariables.sharedVariablesById;
    const sharedReferenceVariablesById = instructionsAndVariables.sharedReferenceVariablesById;
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
      coreSettings: {
        ...config.coreSettings,
        instructionsAndVariables: {
          ...instructionsAndVariables,
          sharedVariablesById: nextSharedVariablesById,
          sharedReferenceVariablesById: nextSharedReferenceVariablesById,
        },
      },
    };
  }

  private _resolveConfigVarRefValue(config: LlmCopypasterConfig, configRefPath: unknown): ResolveConfigVarRefValueResult {
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

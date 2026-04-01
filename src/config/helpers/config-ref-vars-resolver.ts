import get from 'lodash/get';

import { LlmCopypasterConfig, SharedVariableValueType } from '../contracts/system-config-contracts';

export class ConfigRefVarsResolver {
  public static readonly unresolvedConfigVarRefValue = '__unresolved_ref_var_value__';

  public resolve(config: LlmCopypasterConfig): LlmCopypasterConfig {
    const instructionsAndVariables = config.coreSettings.instructionsAndVariables;
    const sharedVariablesById = instructionsAndVariables.sharedVariablesById;

    const resolvedSharedVariablesById = Object.fromEntries(
      Object.entries(sharedVariablesById).map(([sharedVariableId, sharedVariableValue]) => [
        sharedVariableId,
        this._resolveSharedVariableValue(config, sharedVariableValue),
      ])
    );

    return {
      ...config,
      coreSettings: {
        ...config.coreSettings,
        instructionsAndVariables: {
          ...instructionsAndVariables,
          sharedVariablesById: resolvedSharedVariablesById,
        },
      },
    };
  }

  private _resolveConfigVarRefValue(
    config: LlmCopypasterConfig,
    rawTemplate: SharedVariableValueType
  ): SharedVariableValueType | undefined {
    if (typeof rawTemplate !== 'string') return undefined;

    const configRefVarAnchor = config.nonOverrideableSettings.vitalParsingAnchors.CONFIG_REF_VAR_ANCHOR;
    const normalizedRawTemplate = (rawTemplate ?? '').trim();

    if (!configRefVarAnchor || !normalizedRawTemplate.startsWith(configRefVarAnchor)) return undefined;

    const configRefPath = normalizedRawTemplate.slice(configRefVarAnchor.length).trim();

    if (!configRefPath) return rawTemplate;

    const resolvedValue = get(config, configRefPath);

    if (resolvedValue === undefined) return ConfigRefVarsResolver.unresolvedConfigVarRefValue;
    if (resolvedValue === null) return null;

    if (typeof resolvedValue === 'string') return resolvedValue;
    if (typeof resolvedValue === 'number') return resolvedValue;
    if (typeof resolvedValue === 'boolean') return resolvedValue;

    // Arrays need two modes:
    // * scalar items => item1|item2|item3
    // * object/nested items => stableJson(item1)|stableJson(item2)
    if (Array.isArray(resolvedValue)) return this._stringifyArrayValue(resolvedValue);

    // Plain objects are serialized with stable key order so the prompt text is deterministic
    if (typeof resolvedValue === 'object') return this._stringifyStableJsonValue(resolvedValue);

    return ConfigRefVarsResolver.unresolvedConfigVarRefValue;
  }

  private _resolveSharedVariableValue(
    config: LlmCopypasterConfig,
    sharedVariableValue: SharedVariableValueType
  ): SharedVariableValueType {
    const resolvedConfigVarValue = this._resolveConfigVarRefValue(config, sharedVariableValue);

    if (resolvedConfigVarValue === undefined) return sharedVariableValue;

    return resolvedConfigVarValue;
  }

  private _stringifyArrayValue(arrayValue: unknown[]): string {
    if (arrayValue.every(arrayItem => this._isScalarValue(arrayItem) || arrayItem === null))
      return arrayValue.map(arrayItem => String(arrayItem)).join('|');

    return arrayValue.map(arrayItem => this._stringifyStableJsonValue(arrayItem)).join('|');
  }

  private _stringifyStableJsonValue(value: unknown): string {
    return JSON.stringify(this._buildStableJsonCompatibleValue(value));
  }

  private _buildStableJsonCompatibleValue(value: unknown): unknown {
    if (value === null) return null;
    if (this._isScalarValue(value)) return value;

    if (Array.isArray(value)) return value.map(arrayItem => this._buildStableJsonCompatibleValue(arrayItem));

    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      const sortedObjectEntries = Object.keys(objectValue)
        .sort()
        .map(objectKey => [objectKey, this._buildStableJsonCompatibleValue(objectValue[objectKey])]);

      return Object.fromEntries(sortedObjectEntries);
    }

    return String(value);
  }

  private _isScalarValue(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }
}

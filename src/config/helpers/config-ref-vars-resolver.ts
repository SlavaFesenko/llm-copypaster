import get from 'lodash/get';

import { LlmCopypasterConfig } from '../contracts/system-config-contracts';

export interface ConfigVarRefResolution {
  isConfigVarRef: boolean;
  configRefPath: string | null;
  resolvedValue: unknown;
}

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

  public resolveConfigVarRefValue(config: LlmCopypasterConfig, rawTemplate: string): ConfigVarRefResolution {
    const configRefVarAnchor = config.nonOverrideableSettings.vitalParsingAnchors.CONFIG_REF_VAR_ANCHOR;
    const normalizedRawTemplate = (rawTemplate ?? '').trim();

    if (!configRefVarAnchor || !normalizedRawTemplate.startsWith(configRefVarAnchor)) {
      return {
        isConfigVarRef: false,
        configRefPath: null,
        resolvedValue: undefined,
      };
    }

    const configRefPath = normalizedRawTemplate.slice(configRefVarAnchor.length).trim();

    if (!configRefPath) {
      return {
        isConfigVarRef: true,
        configRefPath,
        resolvedValue: rawTemplate,
      };
    }

    return {
      isConfigVarRef: true,
      configRefPath,
      resolvedValue: get(config, configRefPath),
    };
  }

  private _resolveSharedVariableValue(config: LlmCopypasterConfig, sharedVariableValue: string): string {
    const configVarRefResolution = this.resolveConfigVarRefValue(config, sharedVariableValue);

    if (!configVarRefResolution.isConfigVarRef) return sharedVariableValue;

    if (configVarRefResolution.resolvedValue === undefined) return ConfigRefVarsResolver.unresolvedConfigVarRefValue;
    if (configVarRefResolution.resolvedValue === null) return ConfigRefVarsResolver.unresolvedConfigVarRefValue;

    if (typeof configVarRefResolution.resolvedValue === 'string') return configVarRefResolution.resolvedValue;
    if (typeof configVarRefResolution.resolvedValue === 'number') return String(configVarRefResolution.resolvedValue);
    if (typeof configVarRefResolution.resolvedValue === 'boolean') return String(configVarRefResolution.resolvedValue);

    // Arrays need two modes:
    // * scalar items => item1|item2|item3
    // * object/nested items => stableJson(item1)|stableJson(item2)
    if (Array.isArray(configVarRefResolution.resolvedValue))
      return this._stringifyArrayValue(configVarRefResolution.resolvedValue);

    // Plain objects are serialized with stable key order so the prompt text is deterministic
    if (typeof configVarRefResolution.resolvedValue === 'object')
      return this._stringifyStableJsonValue(configVarRefResolution.resolvedValue);

    return ConfigRefVarsResolver.unresolvedConfigVarRefValue;
  }

  private _stringifyArrayValue(arrayValue: unknown[]): string {
    if (arrayValue.every(arrayItem => this._isScalarValue(arrayItem)))
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

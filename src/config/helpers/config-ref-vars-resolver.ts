import get from 'lodash/get';

import { LlmCopypasterConfig } from '../contracts/system-config-contracts';

export interface ConfigVarRefResolution {
  isConfigVarRef: boolean;
  configRefPath: string | null;
  resolvedValue: unknown;
}

export class ConfigRefVarsResolver {
  public static readonly unresolvedConfigVarRefValue = '__unresolved_ref_var_value__';
  public static readonly objectNotSupportedAsRefVarValue = '__object_not_supported_as_ref_var_value__';

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

    if (Array.isArray(configVarRefResolution.resolvedValue))
      return configVarRefResolution.resolvedValue.map(arrayItem => String(arrayItem)).join('|');

    if (typeof configVarRefResolution.resolvedValue === 'object')
      return ConfigRefVarsResolver.objectNotSupportedAsRefVarValue;

    return ConfigRefVarsResolver.unresolvedConfigVarRefValue;
  }
}

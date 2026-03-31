import get from 'lodash/get';

import { LlmCopypasterConfig } from '../config/contracts/system-config-contracts';

export interface ConfigVarRefResolution {
  isConfigVarRef: boolean;
  configRefPath: string | null;
  resolvedValue: unknown;
}

export function resolveConfigVarRefValue(
  config: LlmCopypasterConfig,
  rawTemplate: string,
  configRefVarAnchor: string
): ConfigVarRefResolution {
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

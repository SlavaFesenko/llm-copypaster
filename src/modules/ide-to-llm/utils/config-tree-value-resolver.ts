export class ConfigTreeValueResolver {
  public constructor(private readonly _rootConfig: unknown) {}

  public tryResolvePlaceholderValue(placeholderKey: string, predefinedValuesById: Record<string, string>): string | null {
    const rawValue = this._tryResolveRawValue(placeholderKey, predefinedValuesById);
    if (rawValue === undefined) return null;

    return this._stringifyPlaceholderValue(rawValue);
  }

  public tryResolveIfFlagValue(flagName: string, predefinedValuesById: Record<string, string>): boolean {
    const parsedFlagName = this._parseNegatableFlagName(flagName);

    const rawValue = this._tryResolveRawValue(parsedFlagName.normalizedFlagName, predefinedValuesById);
    if (rawValue === undefined) return parsedFlagName.isNegated;

    const resolvedValue = this._toBoolean(rawValue);

    return parsedFlagName.isNegated ? !resolvedValue : resolvedValue;
  }

  public tryResolveValueByPath(rawPath: string): unknown | undefined {
    const normalizedPath = (rawPath ?? '').trim();
    if (!normalizedPath) return undefined;

    const pathSegments = this._splitPath(normalizedPath);
    if (pathSegments.length === 0) return undefined;

    const directValue = this._tryResolveFromNode(this._rootConfig, pathSegments);
    if (directValue !== undefined) return directValue;

    const [firstSegment, ...restSegments] = pathSegments;

    const candidates = this._findNodesByKeyDeep(this._rootConfig, firstSegment, 40);
    for (const candidateNode of candidates) {
      const candidateValue = this._tryResolveFromNode(candidateNode, restSegments);
      if (candidateValue !== undefined) return candidateValue;
    }

    return undefined;
  }

  private _parseNegatableFlagName(rawFlagName: string): { normalizedFlagName: string; isNegated: boolean } {
    const trimmed = (rawFlagName ?? '').trim();
    if (!trimmed) return { normalizedFlagName: '', isNegated: false };

    let nextFlagName = trimmed;
    let isNegated = false;

    while (nextFlagName.startsWith('!')) {
      isNegated = !isNegated;
      nextFlagName = nextFlagName.slice(1).trim();
    }

    return { normalizedFlagName: nextFlagName, isNegated };
  }

  private _tryResolveRawValue(key: string, predefinedValuesById: Record<string, string>): unknown | undefined {
    const configValue = this._tryResolveConfigVariableValue(key);
    if (configValue !== undefined) return configValue;

    const predefinedValue = predefinedValuesById?.[key];
    if (predefinedValue !== undefined) return predefinedValue;

    return undefined;
  }

  private _tryResolveConfigVariableValue(placeholderOrFlagName: string): unknown | undefined {
    const configVariablePrefix = this._tryGetConfigVariablePrefix();
    if (!configVariablePrefix) return undefined;

    if (!placeholderOrFlagName.startsWith(configVariablePrefix)) return undefined;

    const rawPath = placeholderOrFlagName.slice(configVariablePrefix.length).trim();
    if (!rawPath) return undefined;

    return this.tryResolveValueByPath(rawPath);
  }

  private _tryGetConfigVariablePrefix(): string {
    if (!this._isRecord(this._rootConfig)) return '';

    const llmToIdeParsingAnchors = (this._rootConfig as Record<string, unknown>)['llmToIdeParsingAnchors'];
    if (!this._isRecord(llmToIdeParsingAnchors)) return '';

    const configVariablePrefix = (llmToIdeParsingAnchors as Record<string, unknown>)['configVariablePrefix'];
    if (typeof configVariablePrefix !== 'string') return '';

    return configVariablePrefix;
  }

  private _stringifyPlaceholderValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return '';

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private _toBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;

    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return Boolean(value);

    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') return true;
    if (normalized === 'false') return false;

    if (normalized === '1') return true;
    if (normalized === '0') return false;

    if (normalized === 'yes') return true;
    if (normalized === 'no') return false;

    if (normalized === 'on') return true;
    if (normalized === 'off') return false;

    return Boolean(normalized);
  }

  private _splitPath(rawPath: string): string[] {
    return rawPath
      .split('.')
      .map(segment => segment.trim())
      .filter(Boolean);
  }

  private _tryResolveFromNode(node: unknown, pathSegments: string[]): unknown | undefined {
    let current: unknown = node;

    for (const segment of pathSegments) {
      if (!this._isRecord(current)) return undefined;

      const next = (current as Record<string, unknown>)[segment];
      if (next === undefined) return undefined;

      current = next;
    }

    return current;
  }

  private _findNodesByKeyDeep(root: unknown, key: string, maxDepth: number): unknown[] {
    const foundNodes: unknown[] = [];

    this._walkDeep(root, 0, maxDepth, currentNode => {
      if (!this._isRecord(currentNode)) return;

      const value = (currentNode as Record<string, unknown>)[key];
      if (value === undefined) return;

      foundNodes.push(value);
    });

    return foundNodes;
  }

  private _walkDeep(node: unknown, currentDepth: number, maxDepth: number, onVisit: (node: unknown) => void): void {
    if (currentDepth > maxDepth) return;

    onVisit(node);

    if (Array.isArray(node)) {
      for (const item of node) this._walkDeep(item, currentDepth + 1, maxDepth, onVisit);
      return;
    }

    if (!this._isRecord(node)) return;

    for (const child of Object.values(node)) {
      this._walkDeep(child, currentDepth + 1, maxDepth, onVisit);
    }
  }

  private _isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}

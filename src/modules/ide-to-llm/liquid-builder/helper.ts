export function collapseEmptyLines(text: string): string {
  const normalized = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const collapsedLines: string[] = [];

  let wasPreviousLineEmpty = false;

  for (const line of lines) {
    const isCurrentLineEmpty = !(line ?? '').trim();

    if (isCurrentLineEmpty && wasPreviousLineEmpty) continue;

    collapsedLines.push(line);
    wasPreviousLineEmpty = isCurrentLineEmpty;
  }

  return collapsedLines.join('\n');
}

export function normalizeDirectPlaceholderValue(value: unknown): unknown {
  if (value === null) return 'null';
  if (value === undefined) return '';

  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function tryParseScalarLiquidValue(rawValue: string): unknown {
  const normalized = (rawValue ?? '').trim();
  const normalizedLower = normalized.toLowerCase();

  if (normalizedLower === 'true') return true;
  if (normalizedLower === 'false') return false;

  return rawValue;
}

export function tryExtractConfigVariablePath(rawTemplate: string, configVariablePrefix: string): string | undefined {
  const normalized = (rawTemplate ?? '').trim();
  if (!configVariablePrefix) return undefined;
  if (!normalized.startsWith(configVariablePrefix)) return undefined;

  return normalized;
}

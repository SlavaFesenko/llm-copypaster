import { z } from 'zod';

export type MergePolicy = 'replace' | 'deep-merge' | 'record-merge' | 'nullable-replace';

export interface ConfigFieldDescriptorBase {
  mergePolicy: MergePolicy;
}

export interface ObjectConfigFieldDescriptor<TShape extends ConfigObjectShape> extends ConfigFieldDescriptorBase {
  kind: 'object';
  fields: TShape;
}

export interface RecordConfigFieldDescriptor<
  TValueDescriptor extends AnyConfigFieldDescriptor,
> extends ConfigFieldDescriptorBase {
  kind: 'record';
  valueDescriptor: TValueDescriptor;
  requiredFieldsForNewRecordItem?: string[];
}

export interface NullableConfigFieldDescriptor<
  TInnerDescriptor extends AnyConfigFieldDescriptor,
> extends ConfigFieldDescriptorBase {
  kind: 'nullable';
  innerDescriptor: TInnerDescriptor;
  defaultValue?: null;
}

export interface ScalarConfigFieldDescriptor<TValue> extends ConfigFieldDescriptorBase {
  kind: 'scalar';
  valueSchema: z.ZodType<TValue>;
  defaultValue?: TValue;
}

export interface ArrayConfigFieldDescriptor<TItem> extends ConfigFieldDescriptorBase {
  kind: 'array';
  itemSchema: z.ZodType<TItem>;
  defaultValue?: TItem[];
}

export interface UnknownConfigFieldDescriptor extends ConfigFieldDescriptorBase {
  kind: 'unknown';
  defaultValue?: unknown;
}

export type ConfigObjectShape = Record<string, AnyConfigFieldDescriptor>;

export type AnyConfigFieldDescriptor =
  | ObjectConfigFieldDescriptor<ConfigObjectShape>
  | RecordConfigFieldDescriptor<AnyConfigFieldDescriptor>
  | NullableConfigFieldDescriptor<AnyConfigFieldDescriptor>
  | ScalarConfigFieldDescriptor<unknown>
  | ArrayConfigFieldDescriptor<unknown>
  | UnknownConfigFieldDescriptor;

export type InferSystemConfigValue<TDescriptor extends AnyConfigFieldDescriptor> =
  TDescriptor extends ObjectConfigFieldDescriptor<infer TShape>
    ? { [TKey in keyof TShape]: InferSystemConfigValue<TShape[TKey]> }
    : TDescriptor extends RecordConfigFieldDescriptor<infer TValueDescriptor>
      ? Record<string, InferSystemConfigValue<TValueDescriptor>>
      : TDescriptor extends NullableConfigFieldDescriptor<infer TInnerDescriptor>
        ? InferSystemConfigValue<TInnerDescriptor> | null
        : TDescriptor extends ScalarConfigFieldDescriptor<infer TValue>
          ? TValue
          : TDescriptor extends ArrayConfigFieldDescriptor<infer TItem>
            ? TItem[]
            : unknown;

export type InferUserConfigValue<TDescriptor extends AnyConfigFieldDescriptor> =
  TDescriptor extends ObjectConfigFieldDescriptor<infer TShape>
    ? { [TKey in keyof TShape]?: InferUserConfigValue<TShape[TKey]> }
    : TDescriptor extends RecordConfigFieldDescriptor<infer TValueDescriptor>
      ? Record<string, InferUserConfigValue<TValueDescriptor>>
      : TDescriptor extends NullableConfigFieldDescriptor<infer TInnerDescriptor>
        ? InferUserConfigValue<TInnerDescriptor> | null
        : TDescriptor extends ScalarConfigFieldDescriptor<infer TValue>
          ? TValue
          : TDescriptor extends ArrayConfigFieldDescriptor<infer TItem>
            ? TItem[]
            : unknown;

export type InferConfigPathTree<TDescriptor extends AnyConfigFieldDescriptor> =
  TDescriptor extends ObjectConfigFieldDescriptor<infer TShape>
    ? { $path: string } & { [TKey in keyof TShape]: InferConfigPathTree<TShape[TKey]> }
    : { $path: string };

// These small builders keep the descriptor declaration compact and readable
export function objectConfigField<TShape extends ConfigObjectShape>(fields: TShape): ObjectConfigFieldDescriptor<TShape> {
  return {
    kind: 'object',
    fields,
    mergePolicy: 'deep-merge',
  };
}

export function recordConfigField<TValueDescriptor extends AnyConfigFieldDescriptor>(
  valueDescriptor: TValueDescriptor,
  requiredFieldsForNewRecordItem?: string[]
): RecordConfigFieldDescriptor<TValueDescriptor> {
  return {
    kind: 'record',
    valueDescriptor,
    mergePolicy: 'record-merge',
    requiredFieldsForNewRecordItem,
  };
}

export function nullableConfigField<TInnerDescriptor extends AnyConfigFieldDescriptor>(
  innerDescriptor: TInnerDescriptor
): NullableConfigFieldDescriptor<TInnerDescriptor> {
  return {
    kind: 'nullable',
    innerDescriptor,
    mergePolicy: 'nullable-replace',
    defaultValue: null,
  };
}

export function scalarConfigField<TValue>(
  valueSchema: z.ZodType<TValue>,
  defaultValue?: TValue
): ScalarConfigFieldDescriptor<TValue> {
  return {
    kind: 'scalar',
    valueSchema,
    mergePolicy: 'replace',
    defaultValue,
  };
}

export function arrayConfigField<TItem>(
  itemSchema: z.ZodType<TItem>,
  defaultValue?: TItem[]
): ArrayConfigFieldDescriptor<TItem> {
  return {
    kind: 'array',
    itemSchema,
    mergePolicy: 'replace',
    defaultValue,
  };
}

export function unknownConfigField(defaultValue?: unknown): UnknownConfigFieldDescriptor {
  return {
    kind: 'unknown',
    mergePolicy: 'replace',
    defaultValue,
  };
}

// The exported builders stay strongly typed, while recursion itself happens in simple internal helpers
export function buildSystemSchema<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor
): z.ZodType<InferSystemConfigValue<TDescriptor>> {
  return buildSystemSchemaInternal(descriptor) as z.ZodType<InferSystemConfigValue<TDescriptor>>;
}

export function buildUserSchema<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor
): z.ZodType<InferUserConfigValue<TDescriptor>> {
  return buildUserSchemaInternal(descriptor) as z.ZodType<InferUserConfigValue<TDescriptor>>;
}

// Every path node is now an object with $path, so nested access stays typed without string unions
export function buildConfigPathTree<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor,
  currentPath = ''
): InferConfigPathTree<TDescriptor> {
  return buildConfigPathTreeInternal(descriptor, currentPath) as InferConfigPathTree<TDescriptor>;
}

// The merge engine follows the same descriptor tree as the schemas
export function mergeByDescriptor<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor,
  baseValue: InferSystemConfigValue<TDescriptor>,
  userValue: InferUserConfigValue<TDescriptor> | undefined
): InferSystemConfigValue<TDescriptor> {
  if (userValue === undefined) return baseValue;

  switch (descriptor.kind) {
    case 'object':
      return mergeObjectValue(
        descriptor.fields,
        baseValue as Record<string, unknown>,
        userValue as Record<string, unknown> | undefined
      ) as InferSystemConfigValue<TDescriptor>;

    case 'record':
      return mergeRecordDescriptorValues(
        descriptor,
        baseValue as Record<string, InferSystemConfigValue<typeof descriptor.valueDescriptor>>,
        userValue as Record<string, InferUserConfigValue<typeof descriptor.valueDescriptor>> | undefined
      ) as InferSystemConfigValue<TDescriptor>;

    case 'nullable':
      return userValue as InferSystemConfigValue<TDescriptor>;

    case 'scalar':
    case 'array':
    case 'unknown':
      return userValue as InferSystemConfigValue<TDescriptor>;
  }
}

export function mergeRecordDescriptorValues<TValueDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: RecordConfigFieldDescriptor<TValueDescriptor>,
  baseValue: Record<string, InferSystemConfigValue<TValueDescriptor>>,
  userValue: Record<string, InferUserConfigValue<TValueDescriptor>> | undefined
): Record<string, InferSystemConfigValue<TValueDescriptor>> {
  const userRecordValue = userValue ?? {};
  const nextRecordValue: Record<string, InferSystemConfigValue<TValueDescriptor>> = { ...baseValue };

  for (const [recordKey, userRecordItemValue] of Object.entries(userRecordValue)) {
    const baseRecordItemValue = nextRecordValue[recordKey];

    if (baseRecordItemValue === undefined) {
      if (!canCreateNewRecordItem(descriptor, userRecordItemValue)) continue;

      nextRecordValue[recordKey] = createNewValueFromDescriptor(descriptor.valueDescriptor, userRecordItemValue);
      continue;
    }

    nextRecordValue[recordKey] = mergeByDescriptor(descriptor.valueDescriptor, baseRecordItemValue, userRecordItemValue);
  }

  return nextRecordValue;
}

function buildSystemSchemaInternal(descriptor: AnyConfigFieldDescriptor): z.ZodTypeAny {
  switch (descriptor.kind) {
    case 'object': {
      const objectShape: Record<string, z.ZodTypeAny> = {};

      for (const [fieldKey, fieldDescriptor] of Object.entries(descriptor.fields))
        objectShape[fieldKey] = buildSystemSchemaInternal(fieldDescriptor);

      return z.object(objectShape);
    }

    case 'record':
      return z.record(z.string(), buildSystemSchemaInternal(descriptor.valueDescriptor));

    case 'nullable':
      return buildSystemSchemaInternal(descriptor.innerDescriptor).nullable();

    case 'scalar':
      return descriptor.valueSchema;

    case 'array':
      return z.array(descriptor.itemSchema);

    case 'unknown':
      return z.unknown();
  }
}

function buildUserSchemaInternal(descriptor: AnyConfigFieldDescriptor): z.ZodTypeAny {
  switch (descriptor.kind) {
    case 'object': {
      const objectShape: Record<string, z.ZodTypeAny> = {};

      for (const [fieldKey, fieldDescriptor] of Object.entries(descriptor.fields))
        objectShape[fieldKey] = buildUserSchemaInternal(fieldDescriptor).optional();

      return z.object(objectShape);
    }

    case 'record':
      return z.record(z.string(), buildUserSchemaInternal(descriptor.valueDescriptor));

    case 'nullable':
      return buildUserSchemaInternal(descriptor.innerDescriptor).nullable();

    case 'scalar':
      return descriptor.valueSchema;

    case 'array':
      return z.array(descriptor.itemSchema);

    case 'unknown':
      return z.unknown();
  }
}

function buildConfigPathTreeInternal(descriptor: AnyConfigFieldDescriptor, currentPath: string): { $path: string } {
  const nextPathTree: Record<string, unknown> = {
    $path: currentPath,
  };

  if (descriptor.kind !== 'object') return nextPathTree as { $path: string };

  for (const [fieldKey, fieldDescriptor] of Object.entries(descriptor.fields)) {
    const nextFieldPath = currentPath ? `${currentPath}.${fieldKey}` : fieldKey;
    nextPathTree[fieldKey] = buildConfigPathTreeInternal(fieldDescriptor, nextFieldPath);
  }

  return nextPathTree as { $path: string };
}

function mergeObjectValue(
  fieldDescriptors: ConfigObjectShape,
  baseValue: Record<string, unknown>,
  userValue: Record<string, unknown> | undefined
): Record<string, unknown> {
  const nextObjectValue: Record<string, unknown> = { ...baseValue };
  const nextUserValue = userValue ?? {};

  for (const [fieldKey, fieldDescriptor] of Object.entries(fieldDescriptors))
    nextObjectValue[fieldKey] = mergeByDescriptor(
      fieldDescriptor,
      baseValue[fieldKey] as never,
      nextUserValue[fieldKey] as never
    );

  return nextObjectValue;
}

function canCreateNewRecordItem(
  descriptor: RecordConfigFieldDescriptor<AnyConfigFieldDescriptor>,
  userRecordItemValue: unknown
): boolean {
  if (!descriptor.requiredFieldsForNewRecordItem?.length) return true;
  if (!isPlainObject(userRecordItemValue)) return false;

  return descriptor.requiredFieldsForNewRecordItem.every(fieldKey => userRecordItemValue[fieldKey] !== undefined);
}

// New record items can materialize defaults declared in the descriptor tree
function createNewValueFromDescriptor<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor,
  userValue: InferUserConfigValue<TDescriptor> | undefined
): InferSystemConfigValue<TDescriptor> {
  if (userValue === undefined) return getDescriptorDefaultValue(descriptor);

  switch (descriptor.kind) {
    case 'object': {
      const userObjectValue = userValue as Record<string, unknown>;
      const nextObjectValue: Record<string, unknown> = {};

      for (const [fieldKey, fieldDescriptor] of Object.entries(descriptor.fields))
        nextObjectValue[fieldKey] = createNewValueFromDescriptor(fieldDescriptor, userObjectValue[fieldKey] as never);

      return nextObjectValue as InferSystemConfigValue<TDescriptor>;
    }

    case 'record': {
      const userRecordValue = userValue as Record<string, unknown>;
      const nextRecordValue: Record<string, unknown> = {};

      for (const [recordKey, recordItemValue] of Object.entries(userRecordValue))
        nextRecordValue[recordKey] = createNewValueFromDescriptor(descriptor.valueDescriptor, recordItemValue as never);

      return nextRecordValue as InferSystemConfigValue<TDescriptor>;
    }

    case 'nullable':
      return userValue as InferSystemConfigValue<TDescriptor>;

    case 'scalar':
    case 'array':
    case 'unknown':
      return userValue as InferSystemConfigValue<TDescriptor>;
  }
}

function getDescriptorDefaultValue<TDescriptor extends AnyConfigFieldDescriptor>(
  descriptor: TDescriptor
): InferSystemConfigValue<TDescriptor> {
  switch (descriptor.kind) {
    case 'object': {
      const nextObjectValue: Record<string, unknown> = {};

      for (const [fieldKey, fieldDescriptor] of Object.entries(descriptor.fields))
        nextObjectValue[fieldKey] = createNewValueFromDescriptor(fieldDescriptor, undefined);

      return nextObjectValue as InferSystemConfigValue<TDescriptor>;
    }

    case 'record':
      return {} as InferSystemConfigValue<TDescriptor>;

    case 'nullable':
    case 'scalar':
    case 'array':
    case 'unknown':
      return descriptor.defaultValue as InferSystemConfigValue<TDescriptor>;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Use the Ajv entrypoint for JSON Schema draft 2020-12 because the generated config schema declares this dialect
import Ajv2020, { ErrorObject, ValidateFunction } from 'ajv/dist/2020';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GLOB_CONSTS } from '../../../contracts/global-constants';
import { ValidationIssueSeverity, ValidationRule, ValidationRuleContext } from '../contracts';

const validateUserConfigByJsonSchema = buildUserConfigJsonSchemaValidator();

export class UserConfigSchemaValidationRule implements ValidationRule {
  public readonly name = 'Generated JSON Schema User Config Validation';
  public readonly rationale = 'User config JSON must not contain unknown or misplaced properties';
  public readonly severity = ValidationIssueSeverity.Critical;

  public getViolationDescriptions(validationRuleContext: ValidationRuleContext): string[] {
    const userConfig = validationRuleContext.userConfig;

    if (!userConfig) return [];

    const isUserConfigValid = validateUserConfigByJsonSchema(userConfig);

    if (isUserConfigValid) return [];
    if (!validateUserConfigByJsonSchema.errors?.length) return ['root: User config does not match generated JSON schema'];

    return validateUserConfigByJsonSchema.errors.map(validationError => this._buildValidationErrorMessage(validationError));
  }

  private _buildValidationErrorMessage(validationError: ErrorObject): string {
    if (validationError.keyword === 'additionalProperties')
      return this._buildUnsupportedPropertyValidationErrorMessage(validationError);

    const rawInstancePath = validationError.instancePath || 'root';

    return `${rawInstancePath}: ${validationError.message ?? 'Schema validation failed'}`;
  }

  private _buildUnsupportedPropertyValidationErrorMessage(validationError: ErrorObject): string {
    const unsupportedPropertyName =
      typeof validationError.params.additionalProperty === 'string'
        ? validationError.params.additionalProperty
        : 'unknownProperty';

    const normalizedInstancePath = validationError.instancePath.replace(/^\//, '').replace(/\//g, '.');
    const unsupportedPropertyPath = normalizedInstancePath
      ? `${normalizedInstancePath}.${unsupportedPropertyName}`
      : unsupportedPropertyName;

    return `${unsupportedPropertyPath} is unsupported, please check it in ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}`;
  }
}

function buildUserConfigJsonSchemaValidator(): ValidateFunction {
  const extensionProjectRootPath = path.resolve(__dirname, '../../../../'); // TO~Do: don't like such ../... but didn't find appropriate fix
  const schemaFilePath = path.resolve(extensionProjectRootPath, GLOB_CONSTS.USER_CONFIG_SCHEMA_FILE_NAME);
  const rawSchemaContent = fs.readFileSync(schemaFilePath, 'utf8');
  const userConfigJsonSchema = JSON.parse(rawSchemaContent) as object;

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  return ajv.compile(userConfigJsonSchema);
}

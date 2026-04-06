// Use the Ajv entrypoint for JSON Schema draft 2020-12 because the generated config schema declares this dialect
import Ajv2020, { ValidateFunction } from 'ajv/dist/2020';
import * as fs from 'node:fs';
import * as path from 'node:path';
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

    return validateUserConfigByJsonSchema.errors.map(validationError => {
      const rawInstancePath = validationError.instancePath || 'root';

      return `${rawInstancePath}: ${validationError.message ?? 'Schema validation failed'}`;
    });
  }
}

function buildUserConfigJsonSchemaValidator(): ValidateFunction {
  const schemaFilePath = path.resolve(__dirname, '../../../../llm-copypaster.schema.json');
  const rawSchemaContent = fs.readFileSync(schemaFilePath, 'utf8');
  const userConfigJsonSchema = JSON.parse(rawSchemaContent) as object;

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  return ajv.compile(userConfigJsonSchema);
}

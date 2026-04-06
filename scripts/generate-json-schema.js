const fs = require('node:fs');
const path = require('node:path');
const z = require('zod');

// This script runs after `tsc` has compiled the project into `out/`
//
// Because plain Node.js executes this file, we intentionally import the compiled JavaScript module
// from `out/...` instead of importing the source TypeScript file from `src/...`
//
// This keeps schema generation dependency-free at runtime:
// no ts-node / tsx is needed, and the generator uses the same compiled artifacts as the real build
const { llmCopypasterConfigSchema } = require('../out/config/contracts/system-config-contracts.js');
const { GLOB_CONSTS } = require('../out/contracts/global-constants.js');

const projectRootPath = path.resolve(__dirname, '..');
const targetSchemaFilePath = path.resolve(projectRootPath, GLOB_CONSTS.USER_CONFIG_SCHEMA_FILE_NAME);

// Convert the runtime Zod schema into a JSON Schema document
const generatedJsonSchema = z.toJSONSchema(llmCopypasterConfigSchema);

const jsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'llm-copypaster.schema.json',
  title: 'LLM Copypaster Config',
  ...generatedJsonSchema,
};

// Persist the generated schema into the repository root so editors can use it for JSON/JSONC validation
fs.writeFileSync(targetSchemaFilePath, `${JSON.stringify(jsonSchemaDocument, null, 2)}\n`, 'utf8');

console.log(`JSON schema generated: ${targetSchemaFilePath}`);

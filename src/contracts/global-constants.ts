export const GLOB_CONSTS = {
  SYS_CONFIG_FILE_NAME: 'sys-config.jsonc',
  USER_CONFIG_FILE_NAME: 'llm-copypaster.jsonc',
  USER_CONFIG_SCHEMA_FILE_NAME: 'llm-copypaster.schema.json',

  SYSTEM_INSTRUCTIONS: {
    LLM_RESPONSE_RULES: '.sys-instructions/llm-response-rules.liquid',
  },
} as const;

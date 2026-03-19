export const GLOB_CONSTS = {
  SYS_CONFIG_FILE_NAME: 'sys-config.jsonc',
  USER_CONFIG_FILE_NAME: 'llm-copypaster.jsonc',

  LLM_RESPONSE_RULES_INSTRUCTION_PATH: '.sys-instructions/llm-response-rules.txt',
  FORGET_RESPONSE_RULES_INSTRUCTION_PATH: '.sys-instructions/forget-response-rules.txt',
} as const;

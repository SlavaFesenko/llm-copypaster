export const GLOB_CONSTS = {
  SYS_CONFIG_FILE_NAME: 'sys-config.jsonc',
  USER_CONFIG_FILE_NAME: 'llm-copypaster.jsonc',

  SYSTEM_INSTRUCTIONS: {
    LLM_RESPONSE_RULES: '.sys-instructions/llm-response-rules.txt',
    FORGET_RESPONSE_RULES: '.sys-instructions/forget-response-rules.txt',
  },
} as const;

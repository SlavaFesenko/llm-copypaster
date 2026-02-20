import { OutputChannelLogger } from '../../../utils/output-channel-logger';

export interface LoggerMockState {
  logger: OutputChannelLogger;
  warnCalls: string[];
}

export function createLoggerMock(): LoggerMockState {
  const warnCalls: string[] = [];

  const logger = {
    info: () => undefined,
    warn: (message: string) => warnCalls.push(message),
    error: () => undefined,
    debug: () => undefined,
  } as unknown as OutputChannelLogger;

  return { logger, warnCalls };
}

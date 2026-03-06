import { LlmCopypasterInternalConfig } from '../../../config-service';
import { FilesPayload } from '../../../types/files-payload';
import { OutputChannelLogger } from '../../../utils/output-channel-logger';
import { applySanitizationRules } from './sanitizers/apply-sanitization-rules';

export function sanitizeFilesPayload(
  payload: FilesPayload,
  config: LlmCopypasterInternalConfig,
  logger: OutputChannelLogger
): FilesPayload {
  const sanitizedFiles = payload.files.map(file => {
    const nextContent = applySanitizationRules(file.content, { path: file.path }, config, logger);

    return { ...file, content: nextContent };
  });

  return { ...payload, files: sanitizedFiles };
}

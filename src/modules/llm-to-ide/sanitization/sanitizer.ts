import { LlmCopypasterConfig } from '../../../config/config-service';
import { FilesPayload } from '../../../contracts/files-payload';
import { applySanitizationRules } from './sanitizers/apply-sanitization-rules';

export function sanitizeFilesPayload(payload: FilesPayload, config: LlmCopypasterConfig): FilesPayload {
  const sanitizedFiles = payload.files.map(file => {
    const nextContent = applySanitizationRules(file.content, { path: file.path }, config);

    return { ...file, content: nextContent };
  });

  return { ...payload, files: sanitizedFiles };
}

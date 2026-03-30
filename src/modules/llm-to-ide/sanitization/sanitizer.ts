import { LlmCopypasterConfig } from '../../../config/contracts/system-config-contracts';
import { FilesPayload } from '../../../contracts/file-contracts';
import { applySanitizationRules } from './sanitizers/apply-sanitization-rules';

export function sanitizeFilesPayload(payload: FilesPayload, config: LlmCopypasterConfig): FilesPayload {
  const sanitizedFiles = payload.files.map(file => {
    const nextContent = applySanitizationRules(file.content, { path: file.path }, config);

    return { ...file, content: nextContent };
  });

  return { ...payload, files: sanitizedFiles };
}

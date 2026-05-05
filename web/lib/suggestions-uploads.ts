/**
 * Suggestions screenshot uploads — thin wrapper over the shared
 * `blob-uploads.ts` helper. Maintains the original API surface so existing
 * callers (web/routes/suggestions.ts) work unchanged.
 */
import {
  uploadImage as sharedUploadImage,
  type ValidatedImage,
} from './blob-uploads.js';

export {
  MAX_FILE_BYTES,
  ALLOWED_CONTENT_TYPES,
  validateImageBuffer,
  UploadValidationError,
  type AllowedContentType,
  type ValidatedImage,
} from './blob-uploads.js';

export const MAX_FILES_PER_DRAFT = 6;

export async function uploadImage(params: {
  sessionId: string;
  filename: string | null;
  image: ValidatedImage;
}): Promise<{ url: string; pathname: string }> {
  return sharedUploadImage({
    pathPrefix: `suggestions/${params.sessionId}`,
    filename: params.filename,
    image: params.image,
  });
}

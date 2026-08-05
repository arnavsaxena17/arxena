import {
  type ExtendedFileUIPart,
  type ExtendedUIMessage,
  isExtendedFileUIPart,
} from 'twenty-shared/ai';

export type InlineFileContent = {
  buffer: Buffer;
  mimeType: string;
};

export type InlineFileContentLoader = (
  filePart: ExtendedFileUIPart,
) => Promise<InlineFileContent | null>;

// Providers fetch file `url`s from their own network. Signed SERVER_URL paths
// (localhost in dev, auth-gated hosts in prod) fail with upstream 407 /
// invalid_value. Always send bytes as data URLs when we have a fileId.
export const shouldInlineFileUrlForModel = (url: string): boolean => {
  return !url.startsWith('data:');
};

export const inlineFilePartsForModel = async (
  messages: ExtendedUIMessage[],
  loadFileContent: InlineFileContentLoader,
): Promise<ExtendedUIMessage[]> => {
  return Promise.all(
    messages.map(async (message) => {
      if (!message.parts || message.parts.length === 0) {
        return message;
      }

      const parts = await Promise.all(
        message.parts.map(async (part) => {
          if (!isExtendedFileUIPart(part)) {
            return part;
          }

          if (!shouldInlineFileUrlForModel(part.url)) {
            return part;
          }

          const fileContent = await loadFileContent(part);

          if (!fileContent) {
            const filename = part.filename ?? 'uploaded_file';

            return {
              type: 'text' as const,
              text: `[Attached file: ${filename} could not be loaded for model analysis]`,
            };
          }

          const mimeType = fileContent.mimeType || part.mediaType;

          return {
            ...part,
            mediaType: mimeType,
            url: `data:${mimeType};base64,${fileContent.buffer.toString('base64')}`,
          };
        }),
      );

      return {
        ...message,
        parts,
      };
    }),
  );
};

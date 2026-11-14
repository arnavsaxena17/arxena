import * as mammoth from 'mammoth';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
]);

export const isOutreachSenderCollateralExtensionSupported = (
  fileName: string,
): boolean => {
  const extension = path.extname(fileName).toLowerCase();

  return SUPPORTED_EXTENSIONS.has(extension);
};

export const extractOutreachSenderCollateralText = async ({
  fileName,
  fileBuffer,
}: {
  fileName: string;
  fileBuffer: Buffer;
}): Promise<string> => {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === '.pptx' || extension === '.ppt') {
    throw new Error(
      'PowerPoint extraction is not supported yet. Paste deck talking points as text instead.',
    );
  }

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported file type "${extension || '(none)'}". Use PDF, DOCX, TXT, or Markdown.`,
    );
  }

  if (extension === '.pdf') {
    const parsed = await pdfParse.default(fileBuffer);

    return (parsed.text ?? '').trim();
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });

    return (result.value ?? '').trim();
  }

  return fileBuffer.toString('utf8').trim();
};

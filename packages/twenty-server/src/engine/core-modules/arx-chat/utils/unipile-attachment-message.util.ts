import { UnipileWebhookAttachment } from '../types/unipile-webhook.types';

type AttachmentLike = {
  type?: string | null;
  attachment_type?: string | null;
  mimetype?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  filename?: string | null;
  name?: string | null;
};

const DOCUMENT_TYPES = new Set(['file', 'document', 'pdf', 'doc', 'docx']);
const IMAGE_TYPES = new Set(['img', 'image']);
const VIDEO_TYPES = new Set(['video']);
const AUDIO_TYPES = new Set(['audio', 'ptt', 'voice']);

const CV_FILENAME_PATTERN = /(cv|resume|curriculum|biodata|bio[\s_-]?data)/i;
const DOCUMENT_MIME_PATTERN =
  /(pdf|msword|officedocument|opendocument|rtf|text\/plain)/i;

const normalizeAttachments = (
  attachments?: UnipileWebhookAttachment | UnipileWebhookAttachment[] | AttachmentLike[] | null,
): AttachmentLike[] => {
  if (!attachments) {
    return [];
  }

  return Array.isArray(attachments) ? attachments : [attachments];
};

const getAttachmentType = (attachment: AttachmentLike): string =>
  (attachment.type || attachment.attachment_type || '').toLowerCase();

const getMimeType = (attachment: AttachmentLike): string =>
  (attachment.mimetype || attachment.mime_type || '').toLowerCase();

const getFileName = (attachment: AttachmentLike): string =>
  attachment.file_name || attachment.filename || attachment.name || '';

export const isDocumentAttachment = (attachment: AttachmentLike): boolean => {
  const type = getAttachmentType(attachment);
  const mimeType = getMimeType(attachment);
  const fileName = getFileName(attachment);

  if (DOCUMENT_TYPES.has(type)) {
    return true;
  }

  if (DOCUMENT_MIME_PATTERN.test(mimeType)) {
    return true;
  }

  if (/\.(pdf|docx?|rtf|txt|odt)$/i.test(fileName)) {
    return true;
  }

  return false;
};

export const isLikelyCvAttachment = (attachment: AttachmentLike): boolean => {
  if (!isDocumentAttachment(attachment)) {
    return false;
  }

  const fileName = getFileName(attachment);
  if (fileName && CV_FILENAME_PATTERN.test(fileName)) {
    return true;
  }

  // In recruiting WhatsApp chats, document attachments are almost always CVs.
  return true;
};

export const resolveAttachmentMessageLabel = (
  attachments?: UnipileWebhookAttachment | UnipileWebhookAttachment[] | AttachmentLike[] | null,
): string => {
  const attachmentsArray = normalizeAttachments(attachments);
  if (attachmentsArray.length === 0) {
    return '';
  }

  const first = attachmentsArray[0];
  const type = getAttachmentType(first);

  if (IMAGE_TYPES.has(type) || getMimeType(first).startsWith('image/')) {
    return '[Image]';
  }

  if (VIDEO_TYPES.has(type) || getMimeType(first).startsWith('video/')) {
    return '[Video]';
  }

  if (AUDIO_TYPES.has(type) || getMimeType(first).startsWith('audio/')) {
    return '[Audio Message]';
  }

  if (isLikelyCvAttachment(first)) {
    return 'CV Received';
  }

  if (isDocumentAttachment(first)) {
    return 'Document Received';
  }

  return 'Attachment Received';
};

/**
 * Builds the chat message text stored for incoming Unipile messages.
 * Ensures attachment-only messages are never blank, and that document/CV
 * attachments are visible to chat history / LLM agents.
 */
export const buildIncomingAttachmentChatReply = (
  message: string | null | undefined,
  attachments?: UnipileWebhookAttachment | UnipileWebhookAttachment[] | AttachmentLike[] | null,
): string => {
  const trimmedMessage = message?.trim() || '';
  const attachmentLabel = resolveAttachmentMessageLabel(attachments);

  if (trimmedMessage && attachmentLabel) {
    return `${trimmedMessage}\n${attachmentLabel}`;
  }

  if (trimmedMessage) {
    return trimmedMessage;
  }

  return attachmentLabel;
};

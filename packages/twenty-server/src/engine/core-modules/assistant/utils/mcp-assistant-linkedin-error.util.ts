import { LINKEDIN_SEARCH_ERROR_TOOLS } from '../mcp-assistant.constants';

export const isLinkedInSearchError = (
  toolName: string,
  textContent: string,
): boolean => {
  if (!LINKEDIN_SEARCH_ERROR_TOOLS.has(toolName)) return false;
  if (textContent.startsWith('Error:')) return true;
  if (
    textContent.toLowerCase().includes('failed') &&
    (textContent.includes('500') || textContent.includes('REST API'))
  ) {
    return true;
  }
  try {
    const parsed = JSON.parse(textContent) as Record<string, unknown>;
    return typeof parsed === 'object' && parsed !== null && 'error' in parsed;
  } catch {
    return false;
  }
};

export const extractLinkedInSearchErrorMessage = (
  textContent: string,
): string => {
  try {
    const parsed = JSON.parse(textContent) as Record<string, unknown>;
    const err = parsed?.error;
    if (typeof err === 'string') {
      return err.length > 200 ? err.slice(0, 200) + '...' : err;
    }
  } catch {
    // not JSON
  }
  if (textContent.startsWith('Error:')) {
    const msg = textContent.slice(6).trim();
    return msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
  }
  return textContent.length > 200
    ? textContent.slice(0, 200) + '...'
    : textContent;
};

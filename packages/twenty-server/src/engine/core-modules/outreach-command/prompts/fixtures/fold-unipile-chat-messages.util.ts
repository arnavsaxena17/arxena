import { isNonEmptyString } from '@sniptt/guards';

export type UnipileChatMessageLike = {
  text?: string | null;
  is_sender?: number | boolean | null;
  timestamp?: string | null;
  message_type?: string | null;
  is_event?: number | boolean | null;
};

// Sort oldest→newest (Unipile dumps are often newest-first) and fold for prompts.
export const foldUnipileChatMessagesToTranscript = (
  messages: UnipileChatMessageLike[],
): string => {
  const sorted = [...messages].sort((left, right) => {
    const leftTime = left.timestamp ?? '';
    const rightTime = right.timestamp ?? '';

    return leftTime.localeCompare(rightTime);
  });

  const lines = sorted.flatMap((message) => {
    if (message.is_event === 1 || message.is_event === true) {
      return [];
    }

    const text = message.text?.trim() ?? '';

    if (!isNonEmptyString(text)) {
      return [];
    }

    const role =
      message.is_sender === 1 || message.is_sender === true ? 'us' : 'them';

    return [`${role}: ${text}`];
  });

  return lines.join('\n---\n');
};

export const truncateTranscriptAfterLastInbound = (transcript: string): string => {
  const parts = transcript.split('\n---\n');
  let lastThemIndex = -1;

  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]?.startsWith('them:')) {
      lastThemIndex = index;
    }
  }

  if (lastThemIndex < 0) {
    return transcript;
  }

  return parts.slice(0, lastThemIndex + 1).join('\n---\n');
};

export const truncateTranscriptAfterOurReply = (transcript: string): string => {
  const parts = transcript.split('\n---\n');
  let cutoff = parts.length - 1;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index]?.startsWith('us:')) {
      cutoff = index;
      break;
    }
  }

  return parts.slice(0, cutoff + 1).join('\n---\n');
};

import { useCallback, useState } from 'react';

import type { AssistantChatMessage } from '@/assistant/types/assistant.types';

export const useControlledMessages = (
  controlled: AssistantChatMessage[] | undefined,
  onControlledChange?: (messages: AssistantChatMessage[]) => void,
) => {
  const [internal, setInternal] = useState<AssistantChatMessage[]>([]);
  const isControlled = controlled !== undefined && onControlledChange !== undefined;
  const messages = isControlled ? controlled : internal;

  const setMessages = useCallback(
    (
      arg:
        | AssistantChatMessage[]
        | ((prev: AssistantChatMessage[]) => AssistantChatMessage[]),
    ) => {
      if (isControlled && onControlledChange) {
        const next =
          typeof arg === 'function'
            ? arg(controlled ?? [])
            : arg;
        onControlledChange(next);
      } else {
        setInternal((prev) =>
          typeof arg === 'function' ? arg(prev) : arg,
        );
      }
    },
    [isControlled, controlled, onControlledChange],
  );

  return [messages, setMessages] as const;
};


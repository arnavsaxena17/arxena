import { useCallback } from 'react';

type UseStartChatsParams = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

export const useStartChats = (_params?: UseStartChatsParams) => {
  const sendStartChatRequest = useCallback(async (_candidateIds: string[]) => {
    return { success: false };
  }, []);

  return { sendStartChatRequest };
};

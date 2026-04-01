import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

type UpdateMessagingChannelResponse = {
  status: string;
  updated: number;
  failed: number;
};

type UseUpdateCandidateMessagingChannelsProps = {
  onSuccess?: (result: UpdateMessagingChannelResponse) => void;
  onError?: (error: Error) => void;
};

const getErrorMessage = (err: unknown): string => {
  if (
    axios.isAxiosError(err) &&
    err.response !== undefined &&
    err.response.data !== undefined
  ) {
    const data = err.response.data as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Failed to update messaging channels';
};

export const useUpdateCandidateMessagingChannels = ({
  onSuccess,
  onError,
}: UseUpdateCandidateMessagingChannelsProps = {}) => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useRecoilValue(tokenPairState);

  const updateMessagingChannels = useCallback(
    async (candidateIds: string[], messagingChannel: string) => {
      setLoading(true);
      try {
        const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/update-messaging-channel-for-candidates`;
        const { data } = await axios.post<UpdateMessagingChannelResponse>(
          url,
          { candidateIds, messagingChannel },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = new Error(getErrorMessage(err));
        onError?.(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError, tokenPair?.accessToken?.token],
  );

  return { updateMessagingChannels, loading };
};

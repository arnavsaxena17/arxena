import { tokenPairState } from '@/auth/states/tokenPairState';
import { useNotifyLinkedInNotConnected } from '@/unipile/hooks/useNotifyLinkedInNotConnected';
import { readHttpErrorMessageFromResponse } from '@/unipile/utils/linkedinNotConnectedError';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback } from 'react';
import { type LinkedInParameterType } from 'twenty-shared/workflow';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const PARAMETER_PATH: Record<LinkedInParameterType, string> = {
  COMPANY: 'companies',
  LOCATION: 'locations',
  INDUSTRY: 'industries',
};

export type LinkedInParameterOption = {
  id: string;
  title: string;
};

export const useLinkedInSearchParameters = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { notifyLinkedInNotConnected } = useNotifyLinkedInNotConnected();

  const searchParameters = useCallback(
    async ({
      type,
      keywords,
      limit = 20,
    }: {
      type: LinkedInParameterType;
      keywords?: string;
      limit?: number;
    }): Promise<LinkedInParameterOption[]> => {
      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';
      if (!accessToken) {
        return [];
      }

      const query = new URLSearchParams();
      if (keywords?.trim()) {
        query.set('keywords', keywords.trim());
      }
      query.set('limit', String(limit));

      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/linkedin-search/parameters/${PARAMETER_PATH[type]}?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorMessage = await readHttpErrorMessageFromResponse(response);
        notifyLinkedInNotConnected(errorMessage);
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as {
        items?: Array<{ id?: string; title?: string }>;
      };

      return (payload.items ?? [])
        .filter(
          (item): item is { id: string; title: string } =>
            typeof item.id === 'string' &&
            item.id.length > 0 &&
            typeof item.title === 'string' &&
            item.title.length > 0,
        )
        .map((item) => ({ id: item.id, title: item.title }));
    },
    [notifyLinkedInNotConnected, tokenPair],
  );

  return { searchParameters };
};

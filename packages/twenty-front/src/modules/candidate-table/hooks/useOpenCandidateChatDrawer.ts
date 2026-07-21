import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { selectedCandidateIdState } from '@/candidate-table/states/states';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { IconMessages } from 'twenty-ui';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { TransformedCandidateForTable } from 'twenty-shared';

export type OpenCandidateChatDrawerParams = {
  candidateId: string;
  displayName?: string;
  /** When set, upsert into searchResultsState before opening (org-chart / ephemeral rows). */
  seedRow?: TransformedCandidateForTable | Record<string, unknown>;
};

export const useOpenCandidateChatDrawer = () => {
  const { openRightDrawer } = useRightDrawer();
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);
  const setSearchResults = useSetRecoilState(searchResultsState);

  return useCallback(
    ({ candidateId, displayName, seedRow }: OpenCandidateChatDrawerParams) => {
      if (seedRow !== undefined && seedRow !== null) {
        const rowId =
          typeof (seedRow as { id?: unknown }).id === 'string'
            ? (seedRow as { id: string }).id
            : candidateId;
        setSearchResults((prev) => {
          const nextRow = {
            ...seedRow,
            id: rowId,
          } as TransformedCandidateForTable;
          const without = prev.filter((row) => row.id !== rowId);
          return [nextRow, ...without];
        });
      }

      setSelectedCandidateId(candidateId);
      openRightDrawer(RightDrawerPages.CandidateChat, {
        title: `Chat with ${displayName?.trim() || 'Candidate'}`,
        Icon: IconMessages,
      });
    },
    [openRightDrawer, setSearchResults, setSelectedCandidateId],
  );
};

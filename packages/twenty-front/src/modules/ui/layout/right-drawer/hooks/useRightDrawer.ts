import { selectedCandidateIdState, tableStateAtom } from '@/candidate-table/states/states';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { IconMessage, type IconComponent } from 'twenty-ui/icon';
import { v4 } from 'uuid';

import { RightDrawerPages } from '../types/RightDrawerPages';

type OpenRightDrawerOptions = {
  title?: string;
  Icon?: IconComponent;
  meta?: {
    candidateId?: string;
    unreadMessageIds?: string[];
  };
};

const mapRightDrawerPageToSidePanelPage = (
  page: RightDrawerPages,
): SidePanelPages | null => {
  switch (page) {
    case RightDrawerPages.CandidateChat:
      return SidePanelPages.CandidateChat;
    case RightDrawerPages.CandidateActions:
      return null;
    default:
      return null;
  }
};

export const useRightDrawer = () => {
  const { navigateSidePanelMenu } = useSidePanelMenu();
  const setTableState = useSetAtomState(tableStateAtom);
  const setSelectedCandidateId = useSetAtomState(selectedCandidateIdState);

  const openRightDrawer = useCallback(
    (page: RightDrawerPages, options?: OpenRightDrawerOptions) => {
      const candidateId = options?.meta?.candidateId;

      if (candidateId) {
        setSelectedCandidateId(candidateId);
      }

      setTableState((previousState) => ({
        ...previousState,
        isRightPanelOpen: true,
        currentRightPanelRowId:
          candidateId ?? previousState.currentRightPanelRowId,
      }));

      const sidePanelPage = mapRightDrawerPageToSidePanelPage(page);

      if (sidePanelPage === null) {
        return;
      }

      navigateSidePanelMenu({
        page: sidePanelPage,
        pageTitle: options?.title ?? 'Candidate Info',
        pageIcon: options?.Icon ?? IconMessage,
        pageId: v4(),
        resetNavigationStack: true,
      });
    },
    [navigateSidePanelMenu, setSelectedCandidateId, setTableState],
  );

  return { openRightDrawer };
};

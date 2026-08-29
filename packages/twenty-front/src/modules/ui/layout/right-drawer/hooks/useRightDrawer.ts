import { selectedCandidateIdState, tableStateAtom } from '@/candidate-table/states/states';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { IconMessage, type IconComponent } from 'twenty-ui/icon';

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
      return SidePanelPages.CommandMenuDisplay;
    default:
      return null;
  }
};

export const useRightDrawer = () => {
  const { navigateSidePanelMenu } = useSidePanelMenu();
  const setTableStateAtom = useSetAtomState(tableStateAtom);
  const setSelectedCandidateId = useSetAtomState(selectedCandidateIdState);

  const openRightDrawer = useCallback(
    (page: RightDrawerPages, options?: OpenRightDrawerOptions) => {
      const candidateId = options?.meta?.candidateId;

      if (candidateId) {
        setSelectedCandidateId(candidateId);
      }

      setTableStateAtom((previousState) => {
        const nextRowId = candidateId ?? previousState.currentRightPanelRowId;

        if (
          previousState.isRightPanelOpen &&
          previousState.currentRightPanelRowId === nextRowId
        ) {
          return previousState;
        }

        return {
          ...previousState,
          isRightPanelOpen: true,
          currentRightPanelRowId: nextRowId,
        };
      });

      const sidePanelPage = mapRightDrawerPageToSidePanelPage(page);

      if (sidePanelPage === null) {
        return;
      }

      navigateSidePanelMenu({
        page: sidePanelPage,
        pageTitle: options?.title ?? 'Candidate Info',
        pageIcon: options?.Icon ?? IconMessage,
        pageId: candidateId,
        resetNavigationStack: true,
      });
    },
    [navigateSidePanelMenu, setSelectedCandidateId, setTableStateAtom],
  );

  return { openRightDrawer };
};

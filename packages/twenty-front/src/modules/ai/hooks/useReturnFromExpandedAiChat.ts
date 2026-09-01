import { useStore } from 'jotai';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getExpandedAiChatReturnLocation } from '@/ai/utils/getExpandedAiChatReturnLocation';
import { useDefaultHomePagePath } from '@/navigation/hooks/useDefaultHomePagePath';
import { shouldOpenAiChatAfterOnboardingState } from '@/onboarding/states/shouldOpenAiChatAfterOnboardingState';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';

type UseReturnFromExpandedAiChatParams = {
  reopenSidePanel: boolean;
  destinationPath?: string;
};

export const useReturnFromExpandedAiChat = ({
  reopenSidePanel,
  destinationPath,
}: UseReturnFromExpandedAiChatParams) => {
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { defaultHomePagePath } = useDefaultHomePagePath();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel({ force: true });
  const { closeSidePanelMenu } = useSidePanelMenu();

  const returnLocation = getExpandedAiChatReturnLocation(location.state);

  return useCallback(() => {
    if (reopenSidePanel) {
      openAskAiPage({ resetNavigationStack: true });
    } else {
      void closeSidePanelMenu();
    }

    navigate(destinationPath ?? returnLocation ?? defaultHomePagePath);

    store.set(shouldOpenAiChatAfterOnboardingState.atom, false);
  }, [
    reopenSidePanel,
    destinationPath,
    openAskAiPage,
    closeSidePanelMenu,
    store,
    navigate,
    returnLocation,
    defaultHomePagePath,
  ]);
};

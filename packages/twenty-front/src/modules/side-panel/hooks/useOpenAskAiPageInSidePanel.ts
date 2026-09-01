import { hasAgentChatBeenOpenedState } from '@/ai/states/hasAgentChatBeenOpenedState';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { isSidePanelOpenedState } from '@/side-panel/states/isSidePanelOpenedState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { t } from '@lingui/core/macro';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { IconSparkles } from 'twenty-ui/icon';
import { v4 } from 'uuid';
import { isCurrentPathAiChatPage } from '~/utils/isCurrentPathAiChatPage';

type UseOpenAskAiPageInSidePanelParams = {
  force?: boolean;
};

export const useOpenAskAiPageInSidePanel = ({
  force = false,
}: UseOpenAskAiPageInSidePanelParams = {}) => {
  const store = useStore();
  const { navigateSidePanelMenu } = useSidePanelMenu();
  const setHasAgentChatBeenOpened = useSetAtomState(
    hasAgentChatBeenOpenedState,
  );

  const openAskAiPage = useCallback(
    ({
      resetNavigationStack,
    }: {
      resetNavigationStack?: boolean;
    } = {}) => {
      if (!force && isCurrentPathAiChatPage()) {
        return;
      }

      const shouldReset =
        resetNavigationStack !== undefined
          ? resetNavigationStack
          : store.get(isSidePanelOpenedState.atom);

      setHasAgentChatBeenOpened(true);

      navigateSidePanelMenu({
        page: SidePanelPages.AskAI,
        pageTitle: t`Ask AI`,
        pageIcon: IconSparkles,
        pageId: v4(),
        resetNavigationStack: shouldReset,
      });
    },
    [force, navigateSidePanelMenu, setHasAgentChatBeenOpened, store],
  );

  return {
    openAskAiPage,
  };
};

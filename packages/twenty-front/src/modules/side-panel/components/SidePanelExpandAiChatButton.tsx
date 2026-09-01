import { useLingui } from '@lingui/react/macro';
import { SidePanelPages } from 'twenty-shared/types';
import { useIsMobile } from 'twenty-ui/utilities';
import { IconMaximize } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';

import { useOpenAiChatPage } from '@/ai/hooks/useOpenAiChatPage';
import { currentAiChatThreadState } from '@/ai/states/currentAiChatThreadState';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const SidePanelExpandAiChatButton = () => {
  const { t } = useLingui();
  const isMobile = useIsMobile();
  const sidePanelPage = useAtomStateValue(sidePanelPageState);
  const currentAiChatThread = useAtomStateValue(currentAiChatThreadState);
  const { openAiChatPage } = useOpenAiChatPage();

  const isOnAskAiPage = sidePanelPage === SidePanelPages.AskAI;

  if (isMobile || !isOnAskAiPage) {
    return null;
  }

  const handleClick = () => {
    openAiChatPage({ threadId: currentAiChatThread });
  };

  return (
    <IconButton
      Icon={IconMaximize}
      size="small"
      variant="tertiary"
      onClick={handleClick}
      ariaLabel={t`Expand chat`}
    />
  );
};

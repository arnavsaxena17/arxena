import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { SidePanelPages } from 'twenty-shared/types';
import { IconCopy } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';

import { currentAiChatThreadState } from '@/ai/states/currentAiChatThreadState';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

export const SidePanelCopyAiChatIdButton = () => {
  const { t } = useLingui();
  const sidePanelPage = useAtomStateValue(sidePanelPageState);
  const currentAiChatThread = useAtomStateValue(currentAiChatThreadState);
  const { copyToClipboard } = useCopyToClipboard();

  const isOnAskAiPage = sidePanelPage === SidePanelPages.AskAI;

  if (!isOnAskAiPage || !isDefined(currentAiChatThread)) {
    return null;
  }

  return (
    <IconButton
      Icon={IconCopy}
      size="small"
      variant="tertiary"
      onClick={() =>
        copyToClipboard(currentAiChatThread, t`Chat ID copied to clipboard`)
      }
      ariaLabel={t`Copy chat ID`}
    />
  );
};

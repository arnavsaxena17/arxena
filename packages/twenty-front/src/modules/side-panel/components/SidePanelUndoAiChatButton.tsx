import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { SidePanelPages } from 'twenty-shared/types';
import { IconArrowBackUp } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';

import { useUndoChatOutreach } from '@/ai/hooks/useUndoChatOutreach';
import { currentAiChatThreadState } from '@/ai/states/currentAiChatThreadState';
import { AGENT_CHAT_NEW_THREAD_DRAFT_KEY } from '@/ai/states/agentChatDraftsByThreadIdState';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const UNDO_AI_CHAT_OUTREACH_MODAL_ID = 'undo-ai-chat-outreach-modal';

export const SidePanelUndoAiChatButton = () => {
  const { t } = useLingui();
  const sidePanelPage = useAtomStateValue(sidePanelPageState);
  const currentAiChatThread = useAtomStateValue(currentAiChatThreadState);
  const { openModal } = useModal();
  const { undoChatOutreach, loading } = useUndoChatOutreach();

  const isOnAskAiPage = sidePanelPage === SidePanelPages.AskAI;
  const hasPersistedThread =
    isDefined(currentAiChatThread) &&
    currentAiChatThread !== AGENT_CHAT_NEW_THREAD_DRAFT_KEY;

  const handleOpenConfirm = useCallback(() => {
    openModal(UNDO_AI_CHAT_OUTREACH_MODAL_ID);
  }, [openModal]);

  const handleConfirm = useCallback(async () => {
    if (!hasPersistedThread) {
      return;
    }

    await undoChatOutreach(currentAiChatThread);
  }, [currentAiChatThread, hasPersistedThread, undoChatOutreach]);

  if (!isOnAskAiPage || !hasPersistedThread) {
    return null;
  }

  return (
    <>
      <IconButton
        Icon={IconArrowBackUp}
        size="small"
        variant="tertiary"
        onClick={handleOpenConfirm}
        disabled={loading}
        ariaLabel={t`Undo AI columns from this chat`}
      />
      <ConfirmationModal
        modalInstanceId={UNDO_AI_CHAT_OUTREACH_MODAL_ID}
        title={t`Undo this chat's AI columns?`}
        subtitle={t`Removes AI columns this chat added and clears any table filters it applied. Does not restore overwritten values or undo list, CRM, or send actions.`}
        onConfirmClick={handleConfirm}
        confirmButtonText={t`Undo`}
        confirmButtonAccent="danger"
        loading={loading}
      />
    </>
  );
};

import { agentChatDraftsByThreadIdState } from '@/ai/states/agentChatDraftsByThreadIdState';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import { currentAiChatThreadState } from '@/ai/states/currentAiChatThreadState';
import { useProjectAiChatThreadToUrl } from '@/ai/hooks/useProjectAiChatThreadToUrl';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useStore } from 'jotai';
import { isDefined } from 'twenty-shared/utils';

export const useSwitchAgentChatThreadWithDraft = () => {
  const [currentAiChatThread, setCurrentAiChatThread] = useAtomState(
    currentAiChatThreadState,
  );
  const setAgentChatInput = useSetAtomState(agentChatInputState);
  const setAgentChatDraftsByThreadId = useSetAtomState(
    agentChatDraftsByThreadIdState,
  );
  const store = useStore();
  const { projectAiChatThreadToUrl } = useProjectAiChatThreadToUrl();

  const switchThreadWithDraft = (toThreadId: string) => {
    const isSameThread = toThreadId === currentAiChatThread;

    if (isDefined(currentAiChatThread)) {
      setAgentChatDraftsByThreadId((prev) => ({
        ...prev,
        [currentAiChatThread]: store.get(agentChatInputState.atom),
      }));
    }

    setCurrentAiChatThread(toThreadId);

    if (!isSameThread) {
      const destinationDraft =
        store.get(agentChatDraftsByThreadIdState.atom)[toThreadId] ?? '';
      setAgentChatInput(destinationDraft);
    }

    projectAiChatThreadToUrl(toThreadId);
  };

  return { switchThreadWithDraft };
};

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';

import { currentAiChatThreadState } from '@/ai/states/currentAiChatThreadState';
import { AGENT_CHAT_NEW_THREAD_DRAFT_KEY } from '@/ai/states/agentChatDraftsByThreadIdState';
import { SidePanelUndoAiChatButton } from '@/side-panel/components/SidePanelUndoAiChatButton';
import { sidePanelPageState } from '@/side-panel/states/sidePanelPageState';
import { SidePanelPages } from 'twenty-shared/types';

const mockOpenModal = jest.fn();
const mockUndoChatOutreach = jest.fn();

jest.mock('@/ui/layout/modal/hooks/useModal', () => ({
  useModal: () => ({ openModal: mockOpenModal, closeModal: jest.fn() }),
}));

jest.mock('@/ai/hooks/useUndoChatOutreach', () => ({
  useUndoChatOutreach: () => ({
    undoChatOutreach: mockUndoChatOutreach,
    loading: false,
  }),
}));

jest.mock('@/ui/layout/modal/components/ConfirmationModal', () => ({
  ConfirmationModal: () => null,
}));

const renderButton = (threadId: string | null) => {
  const store = createStore();

  store.set(sidePanelPageState.atom, SidePanelPages.AskAI);
  store.set(currentAiChatThreadState.atom, threadId);

  return render(
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <SidePanelUndoAiChatButton />
      </I18nProvider>
    </JotaiProvider>,
  );
};

describe('SidePanelUndoAiChatButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    i18n.load('en', {});
    i18n.activate('en');
  });

  it('renders on Ask AI with a persisted thread and opens confirm modal', () => {
    renderButton('4844dfe4-24e2-4c79-98cc-5d9de299fe4a');

    fireEvent.click(
      screen.getByRole('button', { name: /undo ai columns from this chat/i }),
    );

    expect(mockOpenModal).toHaveBeenCalledWith('undo-ai-chat-outreach-modal');
  });

  it('hides for a draft thread', () => {
    renderButton(AGENT_CHAT_NEW_THREAD_DRAFT_KEY);

    expect(
      screen.queryByRole('button', { name: /undo ai columns from this chat/i }),
    ).toBeNull();
  });
});

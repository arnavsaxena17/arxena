import type { AssistantThread } from '@/assistant/types/assistant.types';
import styled from '@emotion/styled';
import { Loader } from 'twenty-ui';
import type { MouseEvent } from 'react';
import { Button } from 'twenty-ui';

import { displayThreadName } from './AssistantThreadUtils';

const StyledThreadSidebar = styled.aside<{ isMobile: boolean }>`
  display: ${({ isMobile }) => (isMobile ? 'none' : 'flex')};
  flex-direction: column;
  flex: 0 0 260px;
  max-width: 280px;
  min-width: 220px;
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.secondary};
  overflow: hidden;
`;

const StyledThreadSidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2, 3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledNewThreadHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSmallInlineLoader = styled.div`
  display: flex;
  align-items: center;
  transform: scale(0.65);
  transform-origin: center;
`;

const StyledThreadSidebarList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${({ theme }) => theme.spacing(1, 1, 2)};
  scrollbar-width: thin;
`;

const StyledThreadSidebarItem = styled.button<{ isActive: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing(1.5, 2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme, isActive }) =>
    isActive ? theme.background.primary : 'transparent'};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
  transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:hover {
    background: ${({ theme }) => theme.background.primary};
  }

  ${({ isActive, theme }) =>
    isActive
      ? `box-shadow: 0 0 0 1px ${theme.border.color.medium};`
      : ''}
`;

const StyledThreadSidebarItemTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledThreadModeBadge = styled.span<{ mode: 'fully_autonomous' | 'permissioned' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: ${({ theme }) => theme.spacing(0.5)};
  padding: 0 ${({ theme }) => theme.spacing(0.75)};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: ${({ theme, mode }) =>
    mode === 'fully_autonomous'
      ? theme.background.tertiary
      : theme.background.quaternary};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledThreadSidebarItemSubtitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type AssistantThreadSidebarProps = {
  isMobile: boolean;
  threads: AssistantThread[];
  currentThreadId: string;
  threadsLoading: boolean;
  threadsLoadedFromBackend: boolean;
  onSelectThread: (threadId: string) => void;
  onNewThread: (event?: MouseEvent<HTMLButtonElement>) => void;
  isCreatingNewThread: boolean;
  onPatchThread: (
    threadId: string,
    patch: { assistantMode?: 'fully_autonomous' | 'permissioned'; jobId?: string | null; name?: string },
  ) => Promise<void> | void;
  threadPatchInFlightById: Record<string, boolean>;
};

export const AssistantThreadSidebar = ({
  isMobile,
  threads,
  currentThreadId,
  threadsLoading,
  threadsLoadedFromBackend,
  onSelectThread,
  onNewThread,
  isCreatingNewThread,
  onPatchThread: _onPatchThread,
  threadPatchInFlightById: _threadPatchInFlightById,
}: AssistantThreadSidebarProps) => {
  return (
    <StyledThreadSidebar isMobile={isMobile}>
      <StyledThreadSidebarHeader>
        <span>Threads</span>
        <StyledNewThreadHeaderRight>
          <Button
            title="New thread"
            onClick={onNewThread}
            size="small"
            variant="tertiary"
            disabled={isCreatingNewThread || (threadsLoading && threadsLoadedFromBackend)}
          />
          {isCreatingNewThread ? (
            <StyledSmallInlineLoader
              data-testid="assistant-new-thread-loader-sidebar"
              role="status"
            >
              <Loader color="gray" />
            </StyledSmallInlineLoader>
          ) : null}
        </StyledNewThreadHeaderRight>
      </StyledThreadSidebarHeader>
      <StyledThreadSidebarList>
        {threads.map((thread) => {
          const isActive = thread.id === currentThreadId;
          const lastMessage = thread.messages[thread.messages.length - 1];
          const preview =
            lastMessage?.content?.trim() ||
            (thread.messages.length === 0 ? 'No messages yet' : '');
          const previewText =
            preview.length > 80 ? `${preview.slice(0, 77)}…` : preview;

          return (
            <StyledThreadSidebarItem
              key={thread.id}
              type="button"
              isActive={isActive}
              onClick={() => onSelectThread(thread.id)}
            >
              <StyledThreadSidebarItemTitle>
                {displayThreadName(thread.name)}
                {thread.assistantMode && (
                  <StyledThreadModeBadge mode={thread.assistantMode}>
                    {thread.assistantMode === 'fully_autonomous' ? 'Autonomous' : 'Permissioned'}
                  </StyledThreadModeBadge>
                )}
              </StyledThreadSidebarItemTitle>
              {previewText && (
                <StyledThreadSidebarItemSubtitle>
                  {previewText}
                </StyledThreadSidebarItemSubtitle>
              )}
            </StyledThreadSidebarItem>
          );
        })}
      </StyledThreadSidebarList>
    </StyledThreadSidebar>
  );
};


import type { AssistantThread } from '@/assistant/types/assistant.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Button } from 'twenty-ui/input';
import { Loader } from 'twenty-ui/feedback';
import type { MouseEvent } from 'react';

import { displayThreadName } from './AssistantThreadUtils';

const StyledThreadSidebar = styled.aside<{ isMobile: boolean }>`
  display: ${({ isMobile }) => (isMobile ? 'none' : 'flex')};
  flex-direction: column;
  flex: 0 0 260px;
  max-width: 280px;
  min-width: 220px;
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  overflow: hidden;
`;

const StyledThreadSidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledNewThreadHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
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
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  scrollbar-width: thin;
`;

const StyledThreadSidebarItem = styled.button<{ isActive: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: none;
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.background.primary : 'transparent'};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  margin-bottom: ${themeCssVariables.spacing[1]};
  transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:hover {
    background: ${themeCssVariables.background.primary};
  }

  ${({ isActive }) =>
    isActive
      ? `box-shadow: 0 0 0 1px ${themeCssVariables.border.color.medium};`
      : ''}
`;

const StyledThreadSidebarItemTitle = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin-bottom: ${themeCssVariables.spacing[1]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledThreadModeBadge = styled.span<{ mode: 'fully_autonomous' | 'permissioned' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: ${themeCssVariables.spacing[1]};
  padding: 0 ${themeCssVariables.spacing['1']};
  border-radius: ${themeCssVariables.border.radius.xs};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: ${({ mode }) =>
    mode === 'fully_autonomous'
      ? themeCssVariables.background.tertiary
      : themeCssVariables.background.quaternary};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledThreadSidebarItemSubtitle = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
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
    patch: { assistantMode?: 'fully_autonomous' | 'permissioned'; projectId?: string | null; name?: string },
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


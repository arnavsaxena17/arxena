import { styled } from '@linaria/react';
import { useState } from 'react';
import {
  IconCalendarEvent,
  IconChevronLeft,
  IconMessageCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconPlayerStop,
  IconCircleOff,
  IconX,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';

const CHAT_TYPE_LABELS: Record<string, string> = {
  startChat: 'Start chat',
  resumeChat: 'Resume chat',
  remindCandidate: 'Remind candidate',
  restartChatWithNewPhone: 'Restart chat with new phone',
  firstInterviewReminder: '1st interview reminder',
  secondInterviewReminder: '2nd interview reminder',
};

const StyledFollowUpForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  width: 220px;
`;

const StyledDateInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  height: 32px;
  padding: 0 ${themeCssVariables.spacing[2]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.md};
`;

type ActionsView = 'root' | 'follow-up' | 'chat';

type CandidateDrawerActionsDropdownProps = {
  dropdownId: string;
  isJourneyEnrolled: boolean;
  isJourneyPaused: boolean;
  isJourneyActionLoading: boolean;
  canSendNextStepNow: boolean;
  onPauseJourney: () => void;
  onResumeJourney: () => void;
  onFollowUpOn: (resumeAt: string) => void;
  onSendNextStepNow: () => void;
  onMarkNotInterested: () => void;
  onStopOutreach: () => void;
  onStartChat: (chatType: string) => void;
  onStopChat: () => void;
};

export const CandidateDrawerActionsDropdown = ({
  dropdownId,
  isJourneyEnrolled,
  isJourneyPaused,
  isJourneyActionLoading,
  canSendNextStepNow,
  onPauseJourney,
  onResumeJourney,
  onFollowUpOn,
  onSendNextStepNow,
  onMarkNotInterested,
  onStopOutreach,
  onStartChat,
  onStopChat,
}: CandidateDrawerActionsDropdownProps) => {
  const [view, setView] = useState<ActionsView>('root');
  const [followUpDate, setFollowUpDate] = useState('');
  const { closeDropdown } = useCloseDropdown();

  const runAndClose = (action: () => void) => () => {
    action();
    closeDropdown(dropdownId);
  };

  const subViewHeader = (title: string) => (
    <DropdownMenuHeader
      StartComponent={
        <DropdownMenuHeaderLeftComponent
          onClick={() => setView('root')}
          Icon={IconChevronLeft}
        />
      }
    >
      {title}
    </DropdownMenuHeader>
  );

  const followUpView = (
    <DropdownContent>
      {subViewHeader('Follow up on')}
      <StyledFollowUpForm>
        <StyledDateInput
          type="datetime-local"
          aria-label="Follow-up date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
        <StyledHint>
          The sequence waits until this date, then sends the next step.
        </StyledHint>
        <Button
          title="Set follow-up"
          variant="primary"
          accent="blue"
          size="small"
          justify="center"
          disabled={followUpDate.length === 0 || isJourneyActionLoading}
          onClick={runAndClose(() => {
            onFollowUpOn(new Date(followUpDate).toISOString());
            setFollowUpDate('');
          })}
        />
      </StyledFollowUpForm>
    </DropdownContent>
  );

  const chatView = (
    <DropdownContent>
      {subViewHeader('Recruiting chat')}
      <DropdownMenuItemsContainer>
        {Object.entries(CHAT_TYPE_LABELS).map(([chatType, label]) => (
          <MenuItem
            key={chatType}
            text={label}
            onClick={runAndClose(() => onStartChat(chatType))}
          />
        ))}
        <MenuItem
          LeftIcon={IconX}
          text="Stop chat"
          onClick={runAndClose(onStopChat)}
        />
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );

  const rootView = (
    <DropdownContent>
      {isJourneyEnrolled && (
        <>
          <DropdownMenuItemsContainer>
            {isJourneyPaused ? (
              <MenuItem
                LeftIcon={IconPlayerPlay}
                text="Resume sequence"
                disabled={isJourneyActionLoading}
                onClick={runAndClose(onResumeJourney)}
              />
            ) : (
              <MenuItem
                LeftIcon={IconPlayerPause}
                text="Pause sequence"
                disabled={isJourneyActionLoading}
                onClick={runAndClose(onPauseJourney)}
              />
            )}
            <MenuItem
              LeftIcon={IconCalendarEvent}
              text="Follow up on…"
              hasSubMenu
              onClick={() => setView('follow-up')}
            />
            {canSendNextStepNow && (
              <MenuItem
                LeftIcon={IconPlayerSkipForward}
                text="Send next step now"
                disabled={isJourneyActionLoading}
                onClick={runAndClose(onSendNextStepNow)}
              />
            )}
            <MenuItem
              LeftIcon={IconCircleOff}
              text="Mark not interested"
              disabled={isJourneyActionLoading}
              onClick={runAndClose(onMarkNotInterested)}
            />
            <MenuItem
              LeftIcon={IconPlayerStop}
              accent="danger"
              text="Stop outreach"
              onClick={runAndClose(onStopOutreach)}
            />
          </DropdownMenuItemsContainer>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItemsContainer>
        <MenuItem
          LeftIcon={IconMessageCircle}
          text="Recruiting chat"
          hasSubMenu
          onClick={() => setView('chat')}
        />
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownPlacement="bottom-end"
      onClose={() => setView('root')}
      clickableComponent={
        <Button title="Actions" variant="secondary" size="small" />
      }
      dropdownComponents={
        view === 'follow-up'
          ? followUpView
          : view === 'chat'
            ? chatView
            : rootView
      }
    />
  );
};

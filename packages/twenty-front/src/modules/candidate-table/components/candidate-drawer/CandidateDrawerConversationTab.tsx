import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useMemo } from 'react';
import {
  OUTREACH_CONVERSATION_STAGE_LABELS,
  type MessageNode,
} from 'twenty-shared/arx';
import { Tag } from 'twenty-ui/data-display';
import { IconInfoCircle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  formatDrawerDateTime,
  type CandidateDrawerNextStep,
} from '@/candidate-table/utils/candidateDrawerStatus';
import { OUTREACH_STAGE_LABELS } from '@/outreach-home/constants/outreach-stages';
import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';

// Two sends this close together read as automated to the recipient
const TIMING_FLAG_THRESHOLD_MS = 10 * 60 * 1000;

const StyledTimeline = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[6]};
`;

const StyledEvent = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledDot = styled.span<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 50%;
  flex: none;
  height: 8px;
  margin-top: 6px;
  width: 8px;
`;

const StyledEventBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledEventTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledBubble = styled.div<{ isSent: boolean; isFailed: boolean }>`
  background: ${({ isSent }) =>
    isSent
      ? themeCssVariables.color.blue
      : themeCssVariables.background.tertiary};
  border: 1px solid
    ${({ isFailed }) =>
      isFailed ? themeCssVariables.color.red : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${({ isSent }) =>
    isSent
      ? themeCssVariables.font.color.white
      : themeCssVariables.font.color.primary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  max-width: 92%;
  overflow-wrap: anywhere;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
`;

const StyledSkipped = styled.div`
  border: 1px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  font-style: italic;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledNotice = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledPlaceholder = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

type TimelineEvent =
  | { kind: 'stage'; at: string; stage: string }
  | { kind: 'message'; at: string; message: MessageNode };

const isDoNotRespondMessage = (content: string | undefined) =>
  typeof content === 'string' && content.includes('DONTRESPOND');

const toTime = (value: string) => new Date(value).getTime();

type CandidateDrawerConversationTabProps = {
  messages: MessageNode[];
  journey: CandidateOutreachJourney | null;
  nextStep: CandidateDrawerNextStep | null;
  hasOpenDecision: boolean;
  candidateName: string;
  senderName: string;
  recruitingStatusLabel: string | null;
  isLoading: boolean;
  error: string | null;
};

export const CandidateDrawerConversationTab = ({
  messages,
  journey,
  nextStep,
  hasOpenDecision,
  candidateName,
  senderName,
  recruitingStatusLabel,
  isLoading,
  error,
}: CandidateDrawerConversationTabProps) => {
  const events = useMemo(() => {
    const stageEvents: TimelineEvent[] = (journey?.stageHistory ?? [])
      .filter((entry) => isNonEmptyString(entry.at))
      .map((entry) => ({ kind: 'stage', at: entry.at, stage: entry.stage }));
    const messageEvents: TimelineEvent[] = messages.map((message) => ({
      kind: 'message',
      at: message.createdAt,
      message,
    }));

    return [...stageEvents, ...messageEvents].sort(
      (left, right) => toTime(left.at) - toTime(right.at),
    );
  }, [journey?.stageHistory, messages]);

  const latestReceivedMessageId = [...messages]
    .reverse()
    .find((message) => message.name !== 'botMessage')?.id;

  const conversationStage = journey?.outreachConversationStage ?? 'NONE';
  const intentLabel =
    conversationStage !== 'NONE'
      ? (OUTREACH_CONVERSATION_STAGE_LABELS[
          conversationStage as keyof typeof OUTREACH_CONVERSATION_STAGE_LABELS
        ] ?? conversationStage)
      : null;

  let previousSentAt: number | null = null;

  const renderMessage = (message: MessageNode) => {
    const isSent = message.name === 'botMessage';
    const deliveryStatus = message.whatsappDeliveryStatus || 'sent';
    const sentAt = toTime(message.createdAt);
    const gapMs =
      isSent && previousSentAt !== null ? sentAt - previousSentAt : null;

    if (isSent) {
      previousSentAt = sentAt;
    }

    const gapMinutes = gapMs !== null ? Math.round(gapMs / 60000) : null;
    const meta = [
      formatDrawerDateTime(message.createdAt),
      isSent ? `sent by ${senderName}` : `from ${candidateName}`,
      isSent && deliveryStatus !== 'sent' ? deliveryStatus : null,
      gapMinutes !== null && gapMs !== null && gapMs < 60 * 60 * 1000
        ? `${gapMinutes} min after the previous message`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (isSent && isDoNotRespondMessage(message.message)) {
      return (
        <StyledEventBody>
          <StyledMeta>{formatDrawerDateTime(message.createdAt)}</StyledMeta>
          <StyledSkipped>Agent chose not to respond</StyledSkipped>
        </StyledEventBody>
      );
    }

    return (
      <StyledEventBody>
        <StyledMeta>{meta}</StyledMeta>
        <StyledBubble isSent={isSent} isFailed={deliveryStatus === 'failed'}>
          {message.message}
        </StyledBubble>
        <StyledTags>
          {gapMs !== null && gapMs < TIMING_FLAG_THRESHOLD_MS && (
            <Tag
              color="amber"
              text="Timing: sent minutes apart, may read as automated"
            />
          )}
          {deliveryStatus === 'failed' && (
            <Tag color="red" text="Not delivered" />
          )}
          {message.id === latestReceivedMessageId && intentLabel !== null && (
            <Tag color="sky" text={`Classified: ${intentLabel}`} />
          )}
        </StyledTags>
      </StyledEventBody>
    );
  };

  const nextStepEvent = (() => {
    if (journey === null) {
      return null;
    }

    if (journey.outreachPaused) {
      return {
        color: themeCssVariables.color.red,
        title: 'Next step',
        text: hasOpenDecision
          ? 'Paused until you decide on the card above.'
          : 'Sequence paused. Resume it from Actions.',
      };
    }

    if (nextStep !== null) {
      const when = formatDrawerDateTime(nextStep.at);

      return {
        color: themeCssVariables.color.blue,
        title: when !== null ? `Next step · ${when}` : 'Next step',
        text: nextStep.label,
      };
    }

    if (journey.lastFailedRun !== null) {
      return {
        color: themeCssVariables.color.red,
        title: 'Next step',
        text: 'The last run failed. See Activity to retry.',
      };
    }

    return null;
  })();

  return (
    <StyledTimeline>
      {recruitingStatusLabel !== null && (
        <StyledNotice>
          <IconInfoCircle size={16} />
          Recruiting chat status: {recruitingStatusLabel}
        </StyledNotice>
      )}
      {isLoading && events.length === 0 ? (
        <StyledPlaceholder>Loading conversation…</StyledPlaceholder>
      ) : error !== null ? (
        <StyledPlaceholder>{error}</StyledPlaceholder>
      ) : events.length === 0 ? (
        <StyledPlaceholder>
          Nothing sent to {candidateName} yet.
        </StyledPlaceholder>
      ) : (
        events.map((event) =>
          event.kind === 'stage' ? (
            <StyledEvent key={`stage-${event.stage}-${event.at}`}>
              <StyledDot
                color={
                  event.stage === 'REPLIED'
                    ? themeCssVariables.color.green
                    : themeCssVariables.font.color.light
                }
              />
              <StyledEventBody>
                <StyledEventTitle>
                  {OUTREACH_STAGE_LABELS[event.stage] ?? event.stage}
                </StyledEventTitle>
                <StyledMeta>{formatDrawerDateTime(event.at)}</StyledMeta>
              </StyledEventBody>
            </StyledEvent>
          ) : (
            <StyledEvent key={`message-${event.message.id}`}>
              <StyledDot
                color={
                  event.message.name === 'botMessage'
                    ? themeCssVariables.color.blue
                    : themeCssVariables.color.orange
                }
              />
              {renderMessage(event.message)}
            </StyledEvent>
          ),
        )
      )}
      {nextStepEvent !== null && (
        <StyledEvent>
          <StyledDot color={nextStepEvent.color} />
          <StyledEventBody>
            <StyledEventTitle>{nextStepEvent.title}</StyledEventTitle>
            <StyledMeta>{nextStepEvent.text}</StyledMeta>
          </StyledEventBody>
        </StyledEvent>
      )}
    </StyledTimeline>
  );
};

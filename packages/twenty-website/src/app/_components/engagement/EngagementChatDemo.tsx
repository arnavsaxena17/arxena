'use client';

import styled from '@emotion/styled';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  OUTREACH_DEMO_KUNAL_SALES_THREAD,
  OUTREACH_DEMO_MANU_RECRUITING_THREAD,
  OUTREACH_HITL_CONTEXT_TEMPLATES,
  type OutreachDemoMessage,
} from 'twenty-shared/arx';

export type ChatMessage = {
  sender: 'bot' | 'user';
  text: string;
  time: string;
};

const formatDemoClock = (timestamp: string | undefined): string => {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
};

const toLinkedInChat = (thread: OutreachDemoMessage[]): ChatMessage[] =>
  thread.map((message) => ({
    sender: message.role === 'us' ? 'bot' : 'user',
    text: message.text,
    time: formatDemoClock(message.timestamp),
  }));

const LINKEDIN_SALES_CHAT = toLinkedInChat(OUTREACH_DEMO_KUNAL_SALES_THREAD);
const LINKEDIN_RECRUITING_CHAT = toLinkedInChat(
  OUTREACH_DEMO_MANU_RECRUITING_THREAD,
);

type DemoSegment = 'sales' | 'recruiting';

const DEMO_BY_SEGMENT: Record<
  DemoSegment,
  {
    label: string;
    linkedInHeader: string;
    linkedInCaption: string;
    whatsappCaption: string;
    linkedInChat: ChatMessage[];
    approvalDraft: string;
    approvalRequest: string;
    approvalRecord: string;
  }
> = {
  sales: {
    label: 'Sales',
    linkedInHeader: 'LinkedIn — Sequencer',
    linkedInCaption: 'LinkedIn: sales sequencer opener → reply → follow-up',
    whatsappCaption: 'WhatsApp HITL: Yes / No / Modify before any send',
    linkedInChat: LINKEDIN_SALES_CHAT,
    approvalDraft: LINKEDIN_SALES_CHAT[0]?.text ?? '',
    approvalRequest: OUTREACH_HITL_CONTEXT_TEMPLATES.firstLinkedInMessage,
    approvalRecord: 'Kunal · VP · Matrix Life Science',
  },
  recruiting: {
    label: 'Recruiting',
    linkedInHeader: 'LinkedIn — Sequencer',
    linkedInCaption: 'LinkedIn: recruiting sequencer opener → reply → screen',
    whatsappCaption: 'WhatsApp HITL: Yes / No / Modify before any send',
    linkedInChat: LINKEDIN_RECRUITING_CHAT,
    approvalDraft: LINKEDIN_RECRUITING_CHAT[0]?.text ?? '',
    approvalRequest: OUTREACH_HITL_CONTEXT_TEMPLATES.firstLinkedInMessage,
    approvalRecord: 'Manu · VP Sales · Industrial manufacturer',
  },
};

const MESSAGE_DELAY_MS = 2200;
const LOOP_DELAY_MS = 4000;

const StyledDualChatContainer = styled.div`
  display: flex;
  gap: 32px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 16px 0 24px;
`;

const StyledSegmentToggle = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 0 0 8px;
`;

const StyledSegmentButton = styled.button<{ $active: boolean }>`
  appearance: none;
  border: 1px solid
    ${({ $active }) =>
      $active ? 'rgba(20, 20, 20, 0.9)' : 'rgba(20, 20, 20, 0.15)'};
  background: ${({ $active }) => ($active ? '#141414' : '#fff')};
  color: ${({ $active }) => ($active ? '#fff' : '#141414')};
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: rgba(20, 20, 20, 0.45);
  }
`;

const StyledDemoCaption = styled.p`
  width: 100%;
  max-width: 288px;
  margin: 10px auto 0;
  font-size: 12px;
  line-height: 1.4;
  color: #818181;
  text-align: center;
`;

const StyledPhoneColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledIPhoneOuter = styled.div`
  width: 100%;
  max-width: 288px;
  padding: 6px 7px;
  border-radius: 52px;
  background: linear-gradient(
    165deg,
    #48484a 0%,
    #1c1c1e 38%,
    #2c2c2e 72%,
    #3a3a3c 100%
  );
  box-shadow:
    0 16px 56px rgba(0, 0, 0, 0.38),
    0 4px 12px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
`;

const StyledIPhoneInner = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 274px;
  aspect-ratio: 9 / 19.5;
  border-radius: 42px;
  overflow: hidden;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.65);
`;

const StyledIPhoneStatusBar = styled.div`
  position: relative;
  flex-shrink: 0;
  height: 44px;
  padding: 0 20px;
  background: #000;
`;

const StyledIPhoneStatusTime = styled.span`
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: #fff;
`;

const StyledDynamicIsland = styled.div`
  position: absolute;
  left: 50%;
  top: 11px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 118px;
  height: 32px;
  padding: 0 10px 0 14px;
  border-radius: 20px;
  background: linear-gradient(180deg, #0e0e0f 0%, #050506 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 2px 8px rgba(0, 0, 0, 0.45);
`;

const StyledDynamicIslandLens = styled.span`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    #1a2740 0%,
    #0a1628 45%,
    #05080f 100%
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
`;

const StyledIPhoneStatusTrailing = styled.div`
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 5px;
  color: #fff;
`;

const StyledIPhoneSignalBars = styled.span`
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;

  span {
    display: block;
    width: 3px;
    border-radius: 1px;
    background: #fff;
  }
  span:nth-of-type(1) {
    height: 4px;
  }
  span:nth-of-type(2) {
    height: 6px;
  }
  span:nth-of-type(3) {
    height: 8px;
  }
  span:nth-of-type(4) {
    height: 11px;
  }
`;

const StyledIPhoneBattery = styled.span`
  width: 22px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -3px;
    top: 3px;
    width: 2px;
    height: 5px;
    border-radius: 0 1px 1px 0;
    background: rgba(255, 255, 255, 0.35);
  }

  &::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    bottom: 2px;
    right: 2px;
    border-radius: 1px;
    background: #fff;
  }
`;

const StyledIPhoneHomeIndicator = styled.div`
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 28px;
  padding-bottom: 6px;
  background: #000;

  &::after {
    content: '';
    width: 112px;
    height: 5px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.4);
  }
`;

const StyledChatPanel = styled.div<{
  variant: 'whatsapp' | 'linkedin';
}>`
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${({ variant }) =>
    variant === 'whatsapp' ? '#e5ddd5' : '#f3f6f8'};
`;

const StyledChatHeader = styled.div<{ variant: 'whatsapp' | 'linkedin' }>`
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  background: ${({ variant }) =>
    variant === 'whatsapp' ? '#075e54' : '#0077b5'};
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledChatBody = styled.div`
  padding: 12px;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledMessage = styled.div<{
  isYou: boolean;
  variant: 'whatsapp' | 'linkedin';
}>`
  max-width: 92%;
  padding: 10px 12px;
  border-radius: ${({ isYou, variant }) =>
    variant === 'whatsapp'
      ? isYou
        ? '18px 18px 4px 18px'
        : '18px 18px 18px 4px'
      : '12px 12px 12px 4px'};
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  align-self: ${({ isYou }) => (isYou ? 'flex-end' : 'flex-start')};
  background: ${({ isYou, variant }) =>
    variant === 'whatsapp'
      ? isYou
        ? '#dcf8c6'
        : '#fff'
      : isYou
        ? '#0077b5'
        : '#e9ecef'};
  color: ${({ isYou, variant }) =>
    variant === 'linkedin' && isYou ? '#fff' : '#141414'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const StyledTimestamp = styled.span`
  font-size: 10px;
  color: rgba(20, 20, 20, 0.5);
  margin-top: 4px;
  display: block;
`;

const StyledFormCard = styled.div`
  align-self: stretch;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const StyledFormTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #141414;
`;

const StyledFormCaption = styled.div`
  font-size: 11px;
  color: #818181;
  line-height: 1.4;
`;

const StyledDraftLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #474747;
  margin-bottom: 4px;
`;

const StyledDraftBox = styled.div`
  font-size: 12px;
  line-height: 1.45;
  color: #141414;
  background: #f7f7f7;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 8px;
  padding: 10px;
`;

const StyledDecisionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #474747;
`;

const StyledRadioRow = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #141414;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid
    ${({ $selected }) =>
      $selected ? 'rgba(7, 94, 84, 0.45)' : 'rgba(20, 20, 20, 0.08)'};
  background: ${({ $selected }) =>
    $selected ? 'rgba(7, 94, 84, 0.06)' : '#fff'};
`;

const StyledRadioDot = styled.span<{ $selected?: boolean }>`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid ${({ $selected }) => ($selected ? '#075e54' : '#b3b3b3')};
  box-shadow: ${({ $selected }) =>
    $selected ? 'inset 0 0 0 3px #075e54' : 'none'};
  flex-shrink: 0;
`;

const StyledSubmitButton = styled.div`
  margin-top: 4px;
  height: 36px;
  border-radius: 8px;
  background: #075e54;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledQuickReplies = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
`;

const StyledQuickReply = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #075e54;
  background: #fff;
  border: 1px solid rgba(7, 94, 84, 0.35);
  border-radius: 14px;
  padding: 4px 10px;
`;

function formatClock(isoLikeHourMinute: string) {
  return isoLikeHourMinute;
}

function ChatMessageBubble({
  message,
  variant,
}: {
  message: ChatMessage;
  variant: 'whatsapp' | 'linkedin';
}) {
  const isYou = message.sender === 'bot';

  return (
    <StyledMessage isYou={isYou} variant={variant}>
      {message.text}
      <StyledTimestamp>{formatClock(message.time)}</StyledTimestamp>
    </StyledMessage>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <StyledIPhoneOuter>
      <StyledIPhoneInner>
        <StyledIPhoneStatusBar>
          <StyledIPhoneStatusTime>9:41</StyledIPhoneStatusTime>
          <StyledDynamicIsland>
            <StyledDynamicIslandLens aria-hidden={true} />
          </StyledDynamicIsland>
          <StyledIPhoneStatusTrailing aria-hidden>
            <StyledIPhoneSignalBars>
              <span />
              <span />
              <span />
              <span />
            </StyledIPhoneSignalBars>
            <StyledIPhoneBattery />
          </StyledIPhoneStatusTrailing>
        </StyledIPhoneStatusBar>
        {children}
        <StyledIPhoneHomeIndicator />
      </StyledIPhoneInner>
    </StyledIPhoneOuter>
  );
}

function LinkedInSalesPanel({
  messages,
  header,
}: {
  messages: ChatMessage[];
  header: string;
}) {
  return (
    <PhoneShell>
      <StyledChatPanel variant="linkedin">
        <StyledChatHeader variant="linkedin">{header}</StyledChatHeader>
        <StyledChatBody>
          {messages.map((message, index) => (
            <ChatMessageBubble
              key={`${message.time}-${index}`}
              message={message}
              variant="linkedin"
            />
          ))}
        </StyledChatBody>
      </StyledChatPanel>
    </PhoneShell>
  );
}

function WhatsAppApprovalPanel({
  showForm,
  selectedDecision,
  draft,
  request,
  record,
}: {
  showForm: boolean;
  selectedDecision: 'Yes' | 'No' | 'Modify';
  draft: string;
  request: string;
  record: string;
}) {
  return (
    <PhoneShell>
      <StyledChatPanel variant="whatsapp">
        <StyledChatHeader variant="whatsapp">
          WhatsApp — Human in the Loop
        </StyledChatHeader>
        <StyledChatBody>
          <StyledMessage isYou={false} variant="whatsapp">
            Arxena needs your decision on a pending workflow step.
            {'\n\n'}
            Request: {request}
            {'\n'}
            Record: {record}
            {'\n'}
            Workspace: Acme Outreach
            {'\n'}
            Summary to review: Draft LinkedIn opener ready to send
            {'\n\n'}
            Tap Open form to approve or reject.
            <StyledQuickReplies>
              <StyledQuickReply>Yes</StyledQuickReply>
              <StyledQuickReply>No</StyledQuickReply>
              <StyledQuickReply>Open form</StyledQuickReply>
            </StyledQuickReplies>
            <StyledTimestamp>9:41</StyledTimestamp>
          </StyledMessage>

          {showForm && (
            <StyledFormCard>
              <StyledFormTitle>Workflow form</StyledFormTitle>
              <StyledFormCaption>
                Approve, reject, or edit before the sequencer sends.
              </StyledFormCaption>
              <div>
                <StyledDraftLabel>Draft to send:</StyledDraftLabel>
                <StyledDraftBox>{draft}</StyledDraftBox>
              </div>
              <StyledDecisionLabel>Decision</StyledDecisionLabel>
              {(['Yes', 'No', 'Modify'] as const).map((option) => (
                <StyledRadioRow
                  key={option}
                  $selected={selectedDecision === option}
                >
                  <StyledRadioDot $selected={selectedDecision === option} />
                  {option}
                  {option === 'Yes' ? ' / Approve' : null}
                  {option === 'No' ? ' / Reject' : null}
                </StyledRadioRow>
              ))}
              <StyledSubmitButton>Submit</StyledSubmitButton>
            </StyledFormCard>
          )}
        </StyledChatBody>
      </StyledChatPanel>
    </PhoneShell>
  );
}

export const EngagementChatDemo = () => {
  const [segment, setSegment] = useState<DemoSegment>('sales');
  const [visibleCount, setVisibleCount] = useState(0);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<
    'Yes' | 'No' | 'Modify'
  >('Yes');
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const demo = DEMO_BY_SEGMENT[segment];

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setVisibleCount(0);
    setShowApprovalForm(false);
    setSelectedDecision('Yes');
  }, [segment]);

  useEffect(() => {
    if (!isInView) {
      return;
    }

    if (visibleCount >= demo.linkedInChat.length) {
      const timeoutId = setTimeout(() => {
        setVisibleCount(0);
        setShowApprovalForm(false);
        setSelectedDecision('Yes');
      }, LOOP_DELAY_MS);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setVisibleCount((count) => count + 1);
      if (visibleCount === 0) {
        setShowApprovalForm(true);
      }
      if (visibleCount === 2) {
        setSelectedDecision('Yes');
      }
      if (visibleCount === 4) {
        setSelectedDecision('Modify');
      }
    }, MESSAGE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [isInView, visibleCount, demo.linkedInChat.length]);

  const visibleLinkedInMessages = demo.linkedInChat.slice(0, visibleCount);

  return (
    <div ref={containerRef}>
      <StyledSegmentToggle role="tablist" aria-label="Demo segment">
        {(['sales', 'recruiting'] as const).map((segmentOption) => (
          <StyledSegmentButton
            key={segmentOption}
            type="button"
            role="tab"
            aria-selected={segment === segmentOption}
            $active={segment === segmentOption}
            onClick={() => setSegment(segmentOption)}
          >
            {DEMO_BY_SEGMENT[segmentOption].label}
          </StyledSegmentButton>
        ))}
      </StyledSegmentToggle>
      <StyledDualChatContainer>
        <StyledPhoneColumn>
          <WhatsAppApprovalPanel
            showForm={showApprovalForm}
            selectedDecision={selectedDecision}
            draft={demo.approvalDraft}
            request={demo.approvalRequest}
            record={demo.approvalRecord}
          />
          <StyledDemoCaption>{demo.whatsappCaption}</StyledDemoCaption>
        </StyledPhoneColumn>
        <StyledPhoneColumn>
          <LinkedInSalesPanel
            messages={visibleLinkedInMessages}
            header={demo.linkedInHeader}
          />
          <StyledDemoCaption>{demo.linkedInCaption}</StyledDemoCaption>
        </StyledPhoneColumn>
      </StyledDualChatContainer>
    </div>
  );
};

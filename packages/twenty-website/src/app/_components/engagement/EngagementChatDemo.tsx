'use client';

import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';

export type ChatMessage =
  | { sender: 'bot' | 'user'; text: string; time: string }
  | {
      sender: 'bot' | 'user';
      attachment: { type: 'document'; filename: string; size?: string };
      time: string;
    };

const SAMPLE_CHAT: ChatMessage[] = [
  {
    sender: 'bot',
    text: "Hey Manu, I'm Arnav, Director at Arxena Inc, A Global Recruitment Firm. I'm hiring for a Head of Corporate Strategy and Planning role for Global leader in electrical insulators, based out of Mumbai, Maharashtra and got your application on my job posting. I believe this might be a good fit. Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?",
    time: '20:19',
  },
  {
    sender: 'user',
    text: 'Hi Arnav, I just got time to check your message. Can we connect tomorrow with a fresh start.',
    time: '21:11',
  },
  {
    sender: 'bot',
    attachment: {
      type: 'document',
      filename: 'JD_Head_of_Corporate_Strategy.pdf',
      size: '312 KB',
    },
    time: '20:20',
  },
  {
    sender: 'bot',
    text: 'I have shared the job description with you. Let me know if this role interests you.',
    time: '21:20',
  },
  {
    sender: 'user',
    text: "Hi, good morning we can connect at 11:00 am, hope it's ok with you",
    time: '09:52',
  },
  {
    sender: 'user',
    text: 'If my phone not connecting, you can call me on WhatsApp as well',
    time: '09:53',
  },
  {
    sender: 'bot',
    text: 'I will get back to you shortly to confirm the timing.',
    time: '10:04',
  },
  {
    sender: 'bot',
    text: 'Can you please share a copy of your updated CV',
    time: '10:15',
  },
  {
    sender: 'bot',
    text: 'Also, could you please provide the following details: \n 1. What is your current and expected CTC? \n2. Who do you report to, and which functions report to you? 3. What is your notice period?',
    time: '10:16',
  },
  {
    sender: 'user',
    text: 'I report to JMD, and sales and service function report to me, notice period is one month',
    time: '10:43',
  },
  {
    sender: 'user',
    attachment: {
      type: 'document',
      filename: 'Manu_Resume.pdf',
      size: '245 KB',
    },
    time: '10:45',
  },
  {
    sender: 'bot',
    text: 'Great. Could you also let me know your current and expected CTC?',
    time: '10:52',
  },
  {
    sender: 'user',
    text: 'Current is around 62 L. expectations: We can negotiate on this based on the budget of the organisation.',
    time: '11:11',
  },
  {
    sender: 'bot',
    text: 'Please provide a more specific expected CTC so we can better assess fitment for the role.',
    time: '11:20',
  },
  {
    sender: 'user',
    text: '75 lacs',
    time: '11:35',
  },
  {
    sender: 'bot',
    text: 'Sure, let me get back to you.',
    time: '12:39',
  },
];

const MESSAGE_DELAY_MS = 2500;
const LOOP_DELAY_MS = 4000;

const StyledDualChatContainer = styled.div`
  display: flex;
  gap: 24px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 24px 0;
`;

const StyledChatPanel = styled.div<{ variant: 'whatsapp' | 'linkedin' }>`
  width: 100%;
  max-width: 320px;
  min-height: 420px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.1);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  background: ${({ variant }) =>
    variant === 'whatsapp' ? '#e5ddd5' : '#f3f6f8'};
`;

const StyledChatHeader = styled.div<{ variant: 'whatsapp' | 'linkedin' }>`
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #141414;
  background: ${({ variant }) =>
    variant === 'whatsapp' ? '#075e54' : '#0077b5'};
  color: ${({ variant }) => (variant === 'whatsapp' ? '#fff' : '#fff')};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledChatBody = styled.div`
  padding: 16px;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledMessage = styled.div<{
  isYou: boolean;
  variant: 'whatsapp' | 'linkedin';
}>`
  max-width: 85%;
  padding: 10px 14px;
  border-radius: ${({ isYou, variant }) =>
    variant === 'whatsapp'
      ? isYou
        ? '18px 18px 4px 18px'
        : '18px 18px 18px 4px'
      : '12px 12px 12px 4px'};
  font-size: 14px;
  line-height: 1.5;
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
  font-size: 11px;
  color: rgba(20, 20, 20, 0.5);
  margin-top: 4px;
  display: block;
`;

const StyledAttachment = styled.div`
  font-size: 13px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledAttachmentIcon = styled.span`
  font-size: 18px;
`;

function ChatMessageBubble({
  message,
  variant,
}: {
  message: ChatMessage;
  variant: 'whatsapp' | 'linkedin';
}) {
  const isYou = message.sender === 'bot';

  if ('text' in message) {
    return (
      <StyledMessage isYou={isYou} variant={variant}>
        {message.text}
        <StyledTimestamp>{message.time}</StyledTimestamp>
      </StyledMessage>
    );
  }

  return (
    <StyledMessage isYou={isYou} variant={variant}>
      <StyledAttachment>
        <StyledAttachmentIcon>📄</StyledAttachmentIcon>
        <span>{message.attachment.filename}</span>
        {message.attachment.size && (
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {message.attachment.size}
          </span>
        )}
      </StyledAttachment>
      <StyledTimestamp>{message.time}</StyledTimestamp>
    </StyledMessage>
  );
}

function ChatPanel({
  variant,
  messages,
}: {
  variant: 'whatsapp' | 'linkedin';
  messages: ChatMessage[];
}) {
  const label = variant === 'whatsapp' ? 'WhatsApp' : 'LinkedIn';

  return (
    <StyledChatPanel variant={variant}>
      <StyledChatHeader variant={variant}>
        {label} — Messages from you
      </StyledChatHeader>
      <StyledChatBody>
        {messages.map((msg, i) => (
          <ChatMessageBubble key={i} message={msg} variant={variant} />
        ))}
      </StyledChatBody>
    </StyledChatPanel>
  );
}

export const EngagementChatDemo = () => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    if (visibleCount >= SAMPLE_CHAT.length) {
      const t = setTimeout(() => {
        setVisibleCount(0);
      }, LOOP_DELAY_MS);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, MESSAGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [isInView, visibleCount]);

  const visibleMessages = SAMPLE_CHAT.slice(0, visibleCount);

  return (
    <div ref={containerRef}>
      <StyledDualChatContainer>
        <ChatPanel variant="whatsapp" messages={visibleMessages} />
        <ChatPanel variant="linkedin" messages={visibleMessages} />
      </StyledDualChatContainer>
    </div>
  );
};

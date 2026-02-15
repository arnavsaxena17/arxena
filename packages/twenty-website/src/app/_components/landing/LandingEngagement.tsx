'use client';

import { Theme } from '@/app/_components/ui/theme/theme';
import styled from '@emotion/styled';
import { useState } from 'react';
import { SAMPLE_CHAT } from './sample-chat';
// WhatsApp-inspired colors
const WA_HEADER_BG = '#075E54';
const WA_CHAT_BG = '#ECE5DD';
const WA_BUBBLE_INCOMING = '#ffffff';
const WA_BUBBLE_OUTGOING = '#D9FDD3';
const WA_BUBBLE_OUTGOING_BORDER = '#ccf0c4';



const StyledSection = styled.section`
  padding: ${Theme.spacing(12)} ${Theme.spacing(6)};
  background: ${Theme.color.gray10};
  @media (max-width: 809px) {
    padding: ${Theme.spacing(8)} ${Theme.spacing(4)};
  }
`;

const StyledInner = styled.div`
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
`;

const StyledTitle = styled.h2`
  font-size: ${Theme.font.size.xl};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  margin: 0 0 ${Theme.spacing(4)};
`;

const StyledBody = styled.p`
  font-size: ${Theme.font.size.base};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
  margin: 0 0 ${Theme.spacing(6)};
`;

const StyledCtaButton = styled.button`
  display: inline-block;
  padding: ${Theme.spacing(3)} ${Theme.spacing(6)};
  background-color: ${Theme.color.gray60};
  color: ${Theme.color.white};
  font-weight: ${Theme.font.weight.medium};
  font-size: ${Theme.font.size.base};
  border: none;
  border-radius: ${Theme.border.radius.md};
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  padding: ${Theme.spacing(4)};
  box-sizing: border-box;
`;

const StyledDemoPanel = styled.div`
  background: ${Theme.color.white};
  border-radius: 12px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2);
  @media (min-width: 720px) {
    flex-direction: row;
  }
`;

const StyledCloseButton = styled.button`
  position: absolute;
  top: ${Theme.spacing(2)};
  right: ${Theme.spacing(2)};
  background: rgba(255, 255, 255, 0.15);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  color: ${Theme.color.white};
  font-size: 1.25rem;
  line-height: 1;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }
`;

/* Left: WhatsApp-style chat preview */
const StyledChatColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: ${Theme.color.white};
  @media (min-width: 720px) {
    min-width: 380px;
  }
`;

const StyledWaHeader = styled.div`
  background: ${WA_HEADER_BG};
  color: ${Theme.color.white};
  padding: ${Theme.spacing(3)} ${Theme.spacing(4)} ${Theme.spacing(3)} ${Theme.spacing(4)};
  position: relative;
  flex-shrink: 0;
`;

const StyledWaHeaderTitle = styled.div`
  font-size: ${Theme.font.size.base};
  font-weight: ${Theme.font.weight.medium};
`;

const StyledWaHeaderSub = styled.div`
  font-size: ${Theme.font.size.xs};
  opacity: 0.85;
  margin-top: 2px;
`;

const StyledWaChatArea = styled.div`
  background: ${WA_CHAT_BG};
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cdc4' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  padding: ${Theme.spacing(2)};
  flex: 1;
  overflow-y: auto;
  min-height: 280px;
  max-height: 50vh;
  @media (min-width: 720px) {
    max-height: 70vh;
  }
`;

const StyledWaBubble = styled.div<{ isBot: boolean }>`
  max-width: 85%;
  padding: 6px 8px 4px 10px;
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  ${({ isBot }) =>
    isBot
      ? `
    background: ${WA_BUBBLE_OUTGOING};
    border: 1px solid ${WA_BUBBLE_OUTGOING_BORDER};
    border-top-right-radius: 2px;
    margin-left: auto;
  `
      : `
    background: ${WA_BUBBLE_INCOMING};
    border-top-left-radius: 2px;
    margin-right: auto;
    align-items: flex-start;
  `}
`;

const StyledWaBubbleText = styled.span`
  width: 100%;
  display: block;
  white-space: pre-line;
`;

const StyledWaBubbleTime = styled.span<{ isBot: boolean }>`
  font-size: 11px;
  color: ${({ isBot }) => (isBot ? 'rgba(0,0,0,0.45)' : Theme.color.gray40)};
  margin-top: 2px;
  flex-shrink: 0;
`;

const StyledWaAttachment = styled.div<{ isBot: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: ${({ isBot }) => (isBot ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.02)')};
  border-radius: 4px;
  margin-bottom: 4px;
`;

const StyledWaAttachmentIcon = styled.div<{ isBot: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: ${({ isBot }) => (isBot ? 'rgba(255,255,255,0.3)' : '#E4E6EB')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
`;

const StyledWaAttachmentInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledWaAttachmentFilename = styled.div<{ isBot: boolean }>`
  font-size: 14px;
  font-weight: ${Theme.font.weight.medium};
  color: ${({ isBot }) => (isBot ? Theme.color.white : Theme.text.color.primary)};
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledWaAttachmentSize = styled.div<{ isBot: boolean }>`
  font-size: 12px;
  color: ${({ isBot }) => (isBot ? 'rgba(255,255,255,0.7)' : Theme.color.gray40)};
`;

/* Right: form and copy */
const StyledFormColumn = styled.div`
  flex: 0 0 auto;
  padding: ${Theme.spacing(5)};
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${Theme.spacing(4)};
  @media (min-width: 720px) {
    width: 340px;
    max-height: 90vh;
  }
`;

const StyledFormHeadline = styled.h3`
  font-size: ${Theme.font.size.lg};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  margin: 0;
  line-height: 1.3;
`;

const StyledFormSubtext = styled.p`
  font-size: ${Theme.font.size.sm};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
  margin: 0;
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${Theme.spacing(3)};
  text-align: left;
`;

const StyledLabel = styled.label`
  font-size: ${Theme.font.size.sm};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  display: block;
  margin-bottom: ${Theme.spacing(1)};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${Theme.spacing(2)} ${Theme.spacing(3)};
  font-size: ${Theme.font.size.base};
  border: 1px solid ${Theme.color.gray20};
  border-radius: 8px;
  color: ${Theme.text.color.primary};
  background: ${Theme.color.white};
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: ${Theme.color.gray50};
  }
`;

const StyledHint = styled.span`
  font-size: 12px;
  color: ${Theme.color.gray40};
  display: block;
  margin-top: 2px;
`;

const StyledSubmitButton = styled.button`
  padding: ${Theme.spacing(3)} ${Theme.spacing(4)};
  background: black;
  color: ${Theme.text.color.Inverted};
  font-weight: ${Theme.font.weight.medium};
  font-size: ${Theme.font.size.base};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: ${Theme.spacing(1)};
  &:hover:not(:disabled) {
    opacity: 0.92;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledTips = styled.details`
  font-size: ${Theme.font.size.sm};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
  summary {
    cursor: pointer;
    font-weight: ${Theme.font.weight.medium};
    color: ${Theme.text.color.primary};
    list-style: none;
    &::-webkit-details-marker {
      display: none;
    }
    &::before {
      content: '▸ ';
      font-size: 0.8em;
    }
  }
  &[open] summary::before {
    content: '▾ ';
  }
`;

const StyledTipsList = styled.ul`
  margin: ${Theme.spacing(2)} 0 0;
  padding-left: ${Theme.spacing(4)};
`;

export function LandingEngagement() {
  const [showDemo, setShowDemo] = useState(false);
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setShowDemo(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: send to add-candidate-and-start-chat-with-candidates endpoint
  }

  return (
    <StyledSection>
      <StyledInner>
        <StyledTitle>
          Most tools stop at names. We help you reach them.
        </StyledTitle>
        <StyledBody>
          Our AI engagement bot doesn't send templates. It holds human-like
          conversations on LinkedIn and WhatsApp that have successfully engaged
          CEOs of publicly listed companies — the kind of outreach quality that
          makes passive candidates respond.
        </StyledBody>
        <StyledCtaButton type="button" onClick={() => setShowDemo(true)}>
          Try the job search bot
        </StyledCtaButton>
      </StyledInner>

      <StyledOverlay isOpen={showDemo} onClick={handleOverlayClick}>
        <StyledDemoPanel onClick={(e) => e.stopPropagation()}>
          <StyledChatColumn>
            <StyledWaHeader>
              <StyledCloseButton
                type="button"
                onClick={() => setShowDemo(false)}
                aria-label="Close"
              >
                ×
              </StyledCloseButton>
              <StyledWaHeaderTitle>Manu David</StyledWaHeaderTitle>
              <StyledWaHeaderSub>
                Head of Corporate Strategy, Wonka Industries
              </StyledWaHeaderSub>
            </StyledWaHeader>
            <StyledWaChatArea>
              {SAMPLE_CHAT.map((msg, i) => {
                // Recruiter (bot) = outgoing (green), Candidate (user) = incoming (white)
                const isOutgoing = msg.sender === 'bot';
                const hasAttachment = 'attachment' in msg;
                
                return (
                  <StyledWaBubble key={i} isBot={isOutgoing}>
                    {hasAttachment ? (
                      <>
                        <StyledWaAttachment isBot={isOutgoing}>
                          <StyledWaAttachmentIcon isBot={isOutgoing}>
                            📄
                          </StyledWaAttachmentIcon>
                          <StyledWaAttachmentInfo>
                            <StyledWaAttachmentFilename isBot={isOutgoing}>
                              {msg.attachment.filename}
                            </StyledWaAttachmentFilename>
                            {msg.attachment.size && (
                              <StyledWaAttachmentSize isBot={isOutgoing}>
                                {msg.attachment.size}
                              </StyledWaAttachmentSize>
                            )}
                          </StyledWaAttachmentInfo>
                        </StyledWaAttachment>
                        <StyledWaBubbleTime isBot={isOutgoing}>
                          {msg.time}
                        </StyledWaBubbleTime>
                      </>
                    ) : (
                      <>
                        <StyledWaBubbleText>{msg.text}</StyledWaBubbleText>
                        <StyledWaBubbleTime isBot={isOutgoing}>
                          {msg.time}
                        </StyledWaBubbleTime>
                      </>
                    )}
                  </StyledWaBubble>
                );
              })}
            </StyledWaChatArea>
          </StyledChatColumn>
          <StyledFormColumn>
            <StyledFormHeadline>
              Get this on your WhatsApp
            </StyledFormHeadline>
            <StyledFormSubtext>
              Our AI recruiter will message you as <strong>Arnav Saxena</strong> for the role of <strong>Head of Corporate Strategy at Acme Corporation</strong>. Talk to it like you would a real recruiter.
            </StyledFormSubtext>
            <StyledForm onSubmit={handleSubmit}>
              <div>
                <StyledLabel htmlFor="demo-name">Name</StyledLabel>
                <StyledInput
                  id="demo-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              <div>
                <StyledLabel htmlFor="demo-whatsapp">WhatsApp number</StyledLabel>
                <StyledInput
                  id="demo-whatsapp"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  required
                  placeholder="e.g. +91 98765 43210"
                  autoComplete="tel"
                />
                <StyledHint>Use a number registered on WhatsApp.</StyledHint>
              </div>
              <StyledSubmitButton type="submit">
                Connect on WhatsApp
              </StyledSubmitButton>
            </StyledForm>
            <StyledTips>
              <summary>Tips for the best experience</summary>
              <StyledTipsList>
                <li>Reply like you would to a human recruiter.</li>
                <li>Misdirection or abuse may make the bot unresponsive.</li>
                <li>Replies aren't instant — the bot responds in its own time, like a person.</li>
              </StyledTipsList>
            </StyledTips>
          </StyledFormColumn>
        </StyledDemoPanel>
      </StyledOverlay>
    </StyledSection>
  );
}

'use client';

import styled from '@emotion/styled';
import {
  IconBrandWhatsapp,
  IconMail,
  IconMessageChatbot,
} from '@tabler/icons-react';

const StyledContactSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
`;

const StyledContactTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledContactGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledContactCard = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-decoration: none;
  color: #141414;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.15);
  }
`;

const StyledContactCardButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  width: 100%;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  color: #141414;
  cursor: pointer;
  font-family: inherit;
  font-size: 16px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.15);
  }
`;

const StyledContactIcon = styled.div`
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledContactCardTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  text-align: center;
`;

const StyledContactCardSubtitle = styled.div`
  font-size: 14px;
  color: #818181;
  text-align: center;
`;

const openTawkChat = () => {
  if (typeof window !== 'undefined' && window.Tawk_API?.maximize) {
    window.Tawk_API.maximize();
  }
};

declare global {
  interface Window {
    Tawk_API?: { maximize?: () => void };
  }
}

export const ContactUsSection = () => {
  return (
    <StyledContactSection>
      <StyledContactTitle>Contact Us</StyledContactTitle>
      <StyledContactGrid>
        <StyledContactCard href="mailto:hello@arxena.com">
          <StyledContactIcon>
            <IconMail size={28} stroke={1.5} />
          </StyledContactIcon>
          <StyledContactCardTitle>Email</StyledContactCardTitle>
          <StyledContactCardSubtitle>
            hello@arxena.com
          </StyledContactCardSubtitle>
        </StyledContactCard>
        <StyledContactCard
          href="https://wa.me/918411937769"
          target="_blank"
          rel="noreferrer"
        >
          <StyledContactIcon>
            <IconBrandWhatsapp size={28} stroke={1.5} />
          </StyledContactIcon>
          <StyledContactCardTitle>WhatsApp</StyledContactCardTitle>
          <StyledContactCardSubtitle>Message us</StyledContactCardSubtitle>
        </StyledContactCard>
        <StyledContactCardButton type="button" onClick={openTawkChat}>
          <StyledContactIcon>
            <IconMessageChatbot size={28} stroke={1.5} />
          </StyledContactIcon>
          <StyledContactCardTitle>Chat with us</StyledContactCardTitle>
          <StyledContactCardSubtitle>
            AI support agent
          </StyledContactCardSubtitle>
        </StyledContactCardButton>
      </StyledContactGrid>
    </StyledContactSection>
  );
};

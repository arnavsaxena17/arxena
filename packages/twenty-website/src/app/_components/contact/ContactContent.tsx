'use client';

import styled from '@emotion/styled';

import { openSupportChat } from '@/app/_components/support/openSupportChat';
import { CONTACT_PAGE_SUB } from '@/lib/brand-content';
import { getCalendlyUrl } from '@/lib/calendly-url';
import { COMPANY_INFO } from '@/lib/company-info';

import { CalendlyInline } from './CalendlyInline';

const StyledSection = styled.section`
  max-width: 960px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 600;
  line-height: 1.1;
  margin: 0 0 16px 0;
  text-align: center;
  color: #141414;
`;

const StyledHeadlineSub = styled.p`
  font-size: 18px;
  color: #818181;
  margin: 0 0 48px 0;
  text-align: center;
  line-height: 1.5;
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1.1fr;
    align-items: start;
    gap: 56px;
  }
`;

const StyledDetailsCard = styled.div`
  padding: 32px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledDetailsTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: #141414;
`;

const StyledDetailBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 15px;
  line-height: 1.5;
  color: #474747;
`;

const StyledLabel = styled.span`
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #818181;
  margin-bottom: 4px;
`;

const StyledLink = styled.a`
  color: #141414;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: #616161;
  }
`;

const StyledChatButton = styled.button`
  display: inline-flex;
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: #141414;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;

  &:hover {
    color: #616161;
  }
`;

const StyledAddress = styled.p`
  margin: 0;
  white-space: pre-line;
`;

const StyledAddressesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StyledScheduleIntro = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
`;

export const ContactContent = () => {
  const calendlyUrl = getCalendlyUrl();

  return (
    <StyledSection>
      <StyledHeadline>Contact</StyledHeadline>
      <StyledHeadlineSub>{CONTACT_PAGE_SUB}</StyledHeadlineSub>
      <StyledGrid>
        <StyledDetailsCard>
          <StyledDetailsTitle>Contact details</StyledDetailsTitle>
          <StyledDetailBlock>
            <div>
              <StyledLabel>Email</StyledLabel>
              <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
                {COMPANY_INFO.email}
              </StyledLink>
            </div>
            <div>
              <StyledLabel>WhatsApp</StyledLabel>
              <StyledLink
                href={`https://wa.me/${COMPANY_INFO.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                Message us on WhatsApp
              </StyledLink>
            </div>
            <div>
              <StyledLabel>Live chat</StyledLabel>
              <StyledChatButton type="button" onClick={openSupportChat}>
                Chat with us
              </StyledChatButton>
            </div>
            <div>
              <StyledLabel>Locations</StyledLabel>
              <StyledAddressesList>
                {COMPANY_INFO.addresses.map((line) => (
                  <StyledAddress key={line}>{line}</StyledAddress>
                ))}
              </StyledAddressesList>
            </div>
          </StyledDetailBlock>
        </StyledDetailsCard>
        <div id="schedule">
          <StyledScheduleIntro>Schedule a call</StyledScheduleIntro>
          <CalendlyInline url={calendlyUrl} />
        </div>
      </StyledGrid>
    </StyledSection>
  );
};

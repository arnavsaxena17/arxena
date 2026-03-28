'use client';

import styled from '@emotion/styled';

import { COMPANY_INFO } from '@/lib/company-info';

import { openSupportChat } from '../../../support/openSupportChat';

import {
  DiscordIcon,
  GithubIcon2,
  LinkedInIcon,
  XIcon,
} from '../../icons/SvgIcons';

const StyledFooterMobile = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px 32px;
  color: rgb(129, 129, 129);
  gap: 32px;

  @media (min-width: 810px) {
    display: none;
  }
`;

const StyledLinkSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const StyledSectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #000;
`;

const StyledLink = styled.a`
  color: rgb(129, 129, 129);
  text-decoration: none;
  font-size: 15px;

  &:hover {
    text-decoration: underline;
    color: #000;
  }
`;

const StyledChatButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: rgb(129, 129, 129);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    color: #000;
  }
`;

const StyledAddress = styled.div`
  color: rgb(129, 129, 129);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
`;

const StyledBottomRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  padding-top: 24px;
  border-top: 1px solid rgb(179, 179, 179);
`;

const StyledCopyright = styled.div`
  font-size: 14px;
`;

const StyledSocialLinks = styled.div`
  display: flex;
  flex-direction: row;
  gap: 16px;
`;

type FooterMobileProps = {
  phase2Exposed?: boolean;
};

export const FooterMobile = ({ phase2Exposed = false }: FooterMobileProps) => {
  return (
    <StyledFooterMobile>
      <StyledLinkSection>
        <StyledSectionTitle>Browse</StyledSectionTitle>
        <StyledLink href="/companies">Org charts by company</StyledLink>
        {phase2Exposed && (
          <>
            <StyledLink href="/companies/by-country">
              Org charts by geography
            </StyledLink>
            <StyledLink href="/companies/by-function">
              Org charts by function
            </StyledLink>
          </>
        )}
        <StyledLink href="/sitemap-index.xml">Sitemap</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Product</StyledSectionTitle>
        <StyledLink href="/pricing">Pricing</StyledLink>
        <StyledLink href="/engage">Engage</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Company</StyledSectionTitle>
        <StyledLink href="/story">Story</StyledLink>
        <StyledLink href="/team">Team</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Legal</StyledSectionTitle>
        <StyledLink href="/legal/terms">Terms of Service</StyledLink>
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Contact</StyledSectionTitle>
        <StyledLink href="/contact">Contact & locations</StyledLink>
        <StyledLink href="/contact#schedule">Book a call</StyledLink>
        <StyledLink href={`mailto:${COMPANY_INFO.email}`}>Email</StyledLink>
        <StyledLink
          href={`https://wa.me/${COMPANY_INFO.whatsapp}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </StyledLink>
        <StyledChatButton type="button" onClick={openSupportChat}>
          Chat with us
        </StyledChatButton>
        <StyledAddress>
          {COMPANY_INFO.addresses.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </StyledAddress>
      </StyledLinkSection>
      <StyledBottomRow>
        <StyledCopyright>
          <span style={{ fontFamily: 'Inter, sans-serif' }}>©</span>
          {new Date().getFullYear()} {COMPANY_INFO.name}
        </StyledCopyright>
        <StyledSocialLinks>
          <a href="https://x.com/arxenainc" target="_blank" rel="noreferrer">
            <XIcon size="M" />
          </a>
          <a
            href="https://github.com/arxenainc"
            target="_blank"
            rel="noreferrer"
          >
            <GithubIcon2 size="M" />
          </a>
          <a
            href="https://www.linkedin.com/company/arxena"
            target="_blank"
            rel="noreferrer"
          >
            <LinkedInIcon size="M" />
          </a>
          <a
            href="https://discord.gg/xBmrg5kJ9p"
            target="_blank"
            rel="noreferrer"
          >
            <DiscordIcon size="M" />
          </a>
        </StyledSocialLinks>
      </StyledBottomRow>
    </StyledFooterMobile>
  );
};

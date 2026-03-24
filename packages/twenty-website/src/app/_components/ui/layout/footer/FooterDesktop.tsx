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

const FooterContainer = styled.div`
  padding: 64px 96px 64px 96px;
  display: flex;
  flex-direction: column;
  color: rgb(129, 129, 129);
  gap: 32px;

  @media (max-width: 809px) {
    display: none;
  }
`;

const RightSideFooter = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 48px;
`;

const RightSideFooterColumn = styled.div`
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RightSideFooterLink = styled.a`
  color: rgb(129, 129, 129);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
    color: #000;
  }
`;

const RightSideFooterButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: rgb(129, 129, 129);
  font: inherit;
  cursor: pointer;
  text-align: left;
  &:hover {
    text-decoration: underline;
    color: #000;
  }
`;

const RightSideFooterAddress = styled.div`
  color: rgb(129, 129, 129);
  font-size: 14px;
  line-height: 1.4;
`;

const RightSideFooterColumnTitle = styled.div`
  font-size: 20px;
  font-weight: 500;
  color: #000;
`;

const SocialLinks = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 10px;
`;

type FooterDesktopProps = {
  phase2Exposed?: boolean;
};

export const FooterDesktop = ({ phase2Exposed = false }: FooterDesktopProps) => {
  return (
    <FooterContainer>
      <RightSideFooter>
        <RightSideFooterColumn>
          <RightSideFooterColumnTitle>Browse</RightSideFooterColumnTitle>
          <RightSideFooterLink href="/companies">Org charts by company</RightSideFooterLink>
          {phase2Exposed && (
            <>
              <RightSideFooterLink href="/companies/by-country">Org charts by geography</RightSideFooterLink>
              <RightSideFooterLink href="/companies/by-function">Org charts by function</RightSideFooterLink>
            </>
          )}
          <RightSideFooterLink href="/sitemap-index.xml">Sitemap</RightSideFooterLink>
        </RightSideFooterColumn>
        <RightSideFooterColumn>
          <RightSideFooterColumnTitle>Product</RightSideFooterColumnTitle>
          <RightSideFooterLink href="/pricing">Pricing</RightSideFooterLink>
          <RightSideFooterLink href="/engage">Engage</RightSideFooterLink>
        </RightSideFooterColumn>
        <RightSideFooterColumn>
          <RightSideFooterColumnTitle>Company</RightSideFooterColumnTitle>
          <RightSideFooterLink href="/story">Story</RightSideFooterLink>
          <RightSideFooterLink href="/team">Team</RightSideFooterLink>
        </RightSideFooterColumn>
        <RightSideFooterColumn>
          <RightSideFooterColumnTitle>Legal</RightSideFooterColumnTitle>
          <RightSideFooterLink href="/legal/terms">
            Terms of Service
          </RightSideFooterLink>
          <RightSideFooterLink href="/legal/privacy">
            Privacy Policy
          </RightSideFooterLink>
        </RightSideFooterColumn>
        <RightSideFooterColumn>
          <RightSideFooterColumnTitle>Contact</RightSideFooterColumnTitle>
          <RightSideFooterLink href={`mailto:${COMPANY_INFO.email}`}>
            Email
          </RightSideFooterLink>
          <RightSideFooterLink
            href={`https://wa.me/${COMPANY_INFO.whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </RightSideFooterLink>
          <RightSideFooterButton
            type="button"
            onClick={openSupportChat}
          >
            Chat with us
          </RightSideFooterButton>
          <RightSideFooterAddress>
            {COMPANY_INFO.addresses[0]}
          </RightSideFooterAddress>
        </RightSideFooterColumn>
      </RightSideFooter>
      <div
        style={{
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          borderTop: '1px solid rgb(179, 179, 179)',
          paddingTop: '32px',
        }}
      >
        <div>
          <span style={{ fontFamily: 'Inter, sans-serif' }}>©</span>
          {new Date().getFullYear()} {COMPANY_INFO.name}
        </div>
        <SocialLinks>
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
        </SocialLinks>
      </div>
    </FooterContainer>
  );
};

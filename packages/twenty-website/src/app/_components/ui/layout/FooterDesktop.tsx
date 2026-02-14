'use client';

import { Theme } from '@/app/_components/ui/theme/theme';
import styled from '@emotion/styled';

import {
  DiscordIcon,
  GithubIcon2,
  LinkedInIcon,
  XIcon,
} from '../icons/SvgIcons';

import { Logo } from './Logo';

const FooterContainer = styled.footer`
  padding: ${Theme.spacing(16)} ${Theme.spacing(24)} ${Theme.spacing(16)};
  display: flex;
  flex-direction: column;
  color: ${Theme.color.gray40};
  gap: ${Theme.spacing(8)};
  @media (max-width: 809px) {
    padding: ${Theme.spacing(9)} ${Theme.spacing(6)};
  }
`;

const FooterMain = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const LeftSideFooter = styled.div`
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: ${Theme.spacing(4)};
  @media (max-width: 809px) {
    display: none;
  }
`;

const Tagline = styled.p`
  font-size: ${Theme.font.size.base};
  color: ${Theme.color.gray40};
  margin: 0;
`;

const RightSideFooter = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${Theme.spacing(12)};
  height: 146px;
  @media (max-width: 809px) {
    flex-direction: column;
    height: fit-content;
  }
`;

const RightSideFooterColumn = styled.div`
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: ${Theme.spacing(2)};
`;

const RightSideFooterLink = styled.a`
  color: ${Theme.color.gray40};
  text-decoration: none;
  font-size: ${Theme.font.size.sm};
  &:hover {
    text-decoration: underline;
    color: ${Theme.color.gray60};
  }
`;

const RightSideFooterColumnTitle = styled.div`
  font-size: ${Theme.font.size.lg};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.color.gray60};
`;

const FooterBottom = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid ${Theme.color.gray30};
  padding-top: ${Theme.spacing(8)};
`;

const Copyright = styled.span`
  font-size: ${Theme.font.size.sm};
  color: ${Theme.color.gray40};
`;

const SocialLinks = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${Theme.spacing(3)};
`;

const SocialLink = styled.a`
  color: ${Theme.color.gray40};
  &:hover {
    color: ${Theme.color.gray60};
  }
`;

export const FooterDesktop = () => {
  return (
    <FooterContainer>
      <FooterMain>
        <LeftSideFooter>
          <Logo />
          <Tagline>Full-company org charts in 5 minutes</Tagline>
        </LeftSideFooter>
        <RightSideFooter>
          <RightSideFooterColumn>
            <RightSideFooterColumnTitle>Company</RightSideFooterColumnTitle>
            <RightSideFooterLink href="/pricing">Pricing</RightSideFooterLink>
            <RightSideFooterLink href="/story">About</RightSideFooterLink>
          </RightSideFooterColumn>
          <RightSideFooterColumn>
            <RightSideFooterColumnTitle>Resources</RightSideFooterColumnTitle>
            <RightSideFooterLink href="/user-guide">Docs</RightSideFooterLink>
            <RightSideFooterLink
              href="https://github.com/arxena/arxena"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </RightSideFooterLink>
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
        </RightSideFooter>
      </FooterMain>
      <FooterBottom>
        <Copyright>
          <span style={{ fontFamily: 'Inter, sans-serif' }}>©</span>{' '}
          {new Date().getFullYear()} Arxena Inc
        </Copyright>
        <SocialLinks>
          <SocialLink
            href="https://x.com/arxena"
            target="_blank"
            rel="noreferrer"
            aria-label="X (Twitter)"
          >
            <XIcon size="M" />
          </SocialLink>
          <SocialLink
            href="https://github.com/arxena/arxena"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <GithubIcon2 size="M" />
          </SocialLink>
          <SocialLink
            href="https://www.linkedin.com/company/arxena"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <LinkedInIcon size="M" />
          </SocialLink>
          <SocialLink
            href="https://discord.gg/arxena"
            target="_blank"
            rel="noreferrer"
            aria-label="Discord"
          >
            <DiscordIcon size="M" />
          </SocialLink>
        </SocialLinks>
      </FooterBottom>
    </FooterContainer>
  );
};

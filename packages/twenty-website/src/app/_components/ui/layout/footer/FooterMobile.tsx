'use client';

import styled from '@emotion/styled';

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

export const FooterMobile = () => {
  return (
    <StyledFooterMobile>
      <StyledLinkSection>
        <StyledSectionTitle>Product</StyledSectionTitle>
        <StyledLink href="/pricing">Pricing</StyledLink>
        <StyledLink href="/engage">Engage</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Company</StyledSectionTitle>
        <StyledLink href="/story">Story</StyledLink>
      </StyledLinkSection>
      <StyledLinkSection>
        <StyledSectionTitle>Legal</StyledSectionTitle>
        <StyledLink href="/legal/terms">Terms of Service</StyledLink>
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink>
      </StyledLinkSection>
      <StyledBottomRow>
        <StyledCopyright>
          <span style={{ fontFamily: 'Inter, sans-serif' }}>©</span>
          {new Date().getFullYear()} Arxena Inc
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

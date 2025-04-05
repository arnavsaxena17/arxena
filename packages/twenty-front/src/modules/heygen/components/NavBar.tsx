'use client';

import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { GithubIcon, HeyGenLogo } from './Icons';
import { ThemeSwitch } from './ThemeSwitch';

const StyledNavBar = styled.nav`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledBrandContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledTitle = styled.h1`
  -webkit-background-clip: text;
  background: linear-gradient(135deg, #7dd3fc, #6366f1);
  color: transparent;
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledNavContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledNavLink = styled(Link)`
  color: ${({ theme }) => theme.font.color.primary};
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};

  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

export const NavBar = () => {
  return (
    <StyledNavBar>
      <StyledBrandContainer>
        <StyledNavLink
          to="https://app.heygen.com/"
          target="_blank"
          rel="noopener"
        >
          <HeyGenLogo />
        </StyledNavLink>
        <StyledTitle>HeyGen Interactive Avatar SDK NextJS Demo</StyledTitle>
      </StyledBrandContainer>

      <StyledNavContent>
        <StyledNavLink
          to="https://labs.heygen.com/interactive-avatar"
          target="_blank"
          rel="noopener"
        >
          Avatars
        </StyledNavLink>
        <StyledNavLink
          to="https://docs.heygen.com/reference/list-voices-v2"
          target="_blank"
          rel="noopener"
        >
          Voices
        </StyledNavLink>
        <StyledNavLink
          to="https://docs.heygen.com/reference/new-session-copy"
          target="_blank"
          rel="noopener"
        >
          API Docs
        </StyledNavLink>
        <StyledNavLink
          to="https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide"
          target="_blank"
          rel="noopener"
        >
          Guide
        </StyledNavLink>
        <StyledNavLink
          to="https://github.com/HeyGen-Official/StreamingAvatarSDK"
          target="_blank"
          rel="noopener"
        >
          <GithubIcon />
          SDK
        </StyledNavLink>
        <ThemeSwitch />
      </StyledNavContent>
    </StyledNavBar>
  );
};

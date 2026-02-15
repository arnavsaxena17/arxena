'use client';

import styled from '@emotion/styled';
import { Theme } from '@/app/_components/ui/theme/theme';

const StyledHeroSection = styled.section`
  padding: ${Theme.spacing(12)} ${Theme.spacing(6)} ${Theme.spacing(16)};
  text-align: center;
  max-width: 900px;
  margin: 0 auto;
  @media (max-width: 809px) {
    padding: ${Theme.spacing(8)} ${Theme.spacing(4)} ${Theme.spacing(12)};
  }
`;

const StyledHeadline = styled.h1`
  font-size: clamp(28px, 5vw, 48px);
  font-weight: 700;
  color: ${Theme.text.color.primary};
  line-height: ${Theme.text.lineHeight.lg};
  margin: 0 0 ${Theme.spacing(4)};
`;

const StyledSubheadline = styled.p`
  font-size: ${Theme.font.size.lg};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
  margin: 0 0 ${Theme.spacing(8)};
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
  @media (max-width: 809px) {
    font-size: ${Theme.font.size.base};
  }
`;

const StyledCtaButton = styled.a`
  display: inline-block;
  padding: ${Theme.spacing(3)} ${Theme.spacing(6)};
  background-color: ${Theme.color.gray60};
  color: ${Theme.color.white};
  font-weight: ${Theme.font.weight.medium};
  font-size: ${Theme.font.size.base};
  border-radius: ${Theme.border.radius.md};
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledVisualPlaceholder = styled.div`
  margin-top: ${Theme.spacing(12)};
  padding: ${Theme.spacing(8)};
  background: ${Theme.color.gray10};
  border: 1px solid ${Theme.color.gray20};
  border-radius: ${Theme.border.radius.md};
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${Theme.text.color.tertiary};
  font-size: ${Theme.font.size.sm};
  text-align: center;
  @media (max-width: 809px) {
    margin-top: ${Theme.spacing(8)};
    min-height: 200px;
    padding: ${Theme.spacing(4)};
  }
`;

export function LandingHero() {
  return (
    <StyledHeroSection>
      <StyledHeadline>
        See exactly who built your competitors' teams — in 5 minutes
      </StyledHeadline>
      <StyledSubheadline>
        Full-company org charts for 100,000+ employees at companies like Google,
        Apple, Microsoft. Not just the C-suite — every function, every level,
        every reporting line.
      </StyledSubheadline>
      <StyledCtaButton href="#lead-form">Generate org chart</StyledCtaButton>
      <StyledVisualPlaceholder>
        Org chart preview: CEO → VP Engineering → 50 engineers (placeholder;
        animation can be added later)
      </StyledVisualPlaceholder>
    </StyledHeroSection>
  );
}

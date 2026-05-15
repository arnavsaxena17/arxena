'use client';

import styled from '@emotion/styled';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { STORY_PAGE } from '@/lib/brand-content';
import { TESTIMONIALS } from '@/lib/homepage-content';

function getAvatarUrl(name: string, photo?: string): string {
  if (photo) return photo;
  const encoded = encodeURIComponent(name.replace(/\s+/g, '+'));
  return `https://ui-avatars.com/api/?name=${encoded}&size=112&background=e5e5e5&color=474747`;
}

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 600;
  line-height: 1.1;
  margin: 0 0 24px 0;
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

const StyledParagraph = styled.p`
  font-size: 18px;
  line-height: 1.7;
  color: #474747;
  margin: 0 0 24px 0;
  font-family: var(--font-inter);
`;

const StyledScenarioBlock = styled.div`
  padding: 24px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  margin: 32px 0;
`;

const StyledScenarioText = styled.p`
  font-size: 18px;
  line-height: 1.6;
  color: #141414;
  margin: 0;
  font-style: italic;
`;

const StyledTractionBlock = styled.div`
  padding: 24px;
  text-align: center;
  margin: 32px 0;
`;

const StyledTractionStat = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #141414;
  margin-bottom: 8px;
`;

const StyledTractionLabel = styled.div`
  font-size: 15px;
  color: #818181;
`;

const StyledTestimonialsBlock = styled.div`
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledTestimonialsTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledCarousel = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 32px 48px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  height: 240px;
  box-sizing: border-box;
`;

const StyledCarouselInner = styled.div`
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
`;

const StyledAvatar = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
`;

const StyledQuoteBlock = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const StyledQuote = styled.blockquote`
  font-size: 18px;
  line-height: 1.6;
  color: #141414;
  margin: 0 0 12px 0;
  font-style: italic;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

const StyledAttribution = styled.div`
  font-size: 15px;
  color: #474747;
  flex-shrink: 0;
`;

const StyledAttributionName = styled.strong`
  font-weight: 500;
  color: #141414;
`;

const StyledCarouselNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
`;

const StyledNavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(20, 20, 20, 0.15);
  border-radius: 8px;
  background: #fff;
  color: #141414;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.25);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledDots = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const StyledDot = styled.button<{ isActive: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: ${({ isActive }) =>
    isActive ? '#141414' : 'rgba(20, 20, 20, 0.2)'};
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;

  &:hover {
    background: ${({ isActive }) =>
      isActive ? '#141414' : 'rgba(20, 20, 20, 0.4)'};
  }
`;

const StyledCtaSection = styled.div`
  margin-top: 48px;
  text-align: center;
`;

const StyledCtaLink = styled.a`
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 24px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 16px;
  transition: color 0.15s ease;

  &:hover {
    color: #b3b3b3;
  }
`;

const StyledOrgChartLink = styled(Link)`
  display: inline-block;
  margin-top: 16px;
  color: #2563eb;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledEngageLink = styled(Link)`
  color: #2563eb;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

type Testimonial = {
  quote: string;
  name: string;
  title: string;
  company: string;
  photo?: string;
};

type TestimonialsCarouselProps = {
  testimonials: Testimonial[];
};

const AUTO_ADVANCE_MS = 5000;

const TestimonialsCarousel = ({ testimonials }: TestimonialsCarouselProps) => {
  const [index, setIndex] = useState(0);
  const current = testimonials[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i === testimonials.length - 1 ? 0 : i + 1));
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [testimonials.length]);

  const goPrev = () =>
    setIndex((i) => (i === 0 ? testimonials.length - 1 : i - 1));
  const goNext = () =>
    setIndex((i) => (i === testimonials.length - 1 ? 0 : i + 1));

  return (
    <>
      <StyledCarousel>
        <StyledCarouselInner>
          <StyledAvatar
            src={getAvatarUrl(current.name, current.photo)}
            alt=""
            onError={(e) => {
              e.currentTarget.src = getAvatarUrl(current.name);
            }}
          />
          <StyledQuoteBlock>
            <StyledQuote>&ldquo;{current.quote}&rdquo;</StyledQuote>
            <StyledAttribution>
              <StyledAttributionName>{current.name}</StyledAttributionName> —{' '}
              {current.title} | {current.company}
            </StyledAttribution>
          </StyledQuoteBlock>
        </StyledCarouselInner>
      </StyledCarousel>
      <StyledCarouselNav>
        <StyledNavButton onClick={goPrev} aria-label="Previous testimonial">
          <IconChevronLeft size={20} />
        </StyledNavButton>
        <StyledDots>
          {testimonials.map((_, i) => (
            <StyledDot
              key={i}
              isActive={i === index}
              onClick={() => setIndex(i)}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </StyledDots>
        <StyledNavButton onClick={goNext} aria-label="Next testimonial">
          <IconChevronRight size={20} />
        </StyledNavButton>
      </StyledCarouselNav>
    </>
  );
};

type StoryContentProps = {
  signInUrl: string;
  signUpUrl: string;
};

export const StoryContent = ({ signUpUrl }: StoryContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>{STORY_PAGE.headline}</StyledHeadline>
      <StyledHeadlineSub>{STORY_PAGE.subheadline}</StyledHeadlineSub>

      <StyledParagraph>{STORY_PAGE.paragraph1}</StyledParagraph>

      <StyledParagraph>{STORY_PAGE.paragraph2}</StyledParagraph>

      <StyledOrgChartLink href="/org-chart/google">
        See a live example: Google org chart →
      </StyledOrgChartLink>

      <p style={{ margin: '16px 0 0 0' }}>
        <StyledEngageLink href="/engage">
          Build lists and engage — Learn about Engagement →
        </StyledEngageLink>
      </p>

      <StyledScenarioBlock>
        <StyledScenarioText>{STORY_PAGE.scenarioExample}</StyledScenarioText>
      </StyledScenarioBlock>

      <StyledTractionBlock>
        <StyledTractionStat>1M+ companies mapped</StyledTractionStat>
        <StyledTractionLabel>800M+ professionals indexed</StyledTractionLabel>
      </StyledTractionBlock>

      <StyledTestimonialsBlock>
        <StyledTestimonialsTitle>What users say</StyledTestimonialsTitle>
        <TestimonialsCarousel testimonials={[...TESTIMONIALS]} />
      </StyledTestimonialsBlock>

      <StyledCtaSection>
        <StyledCtaLink href={signUpUrl}>Get started</StyledCtaLink>
      </StyledCtaSection>
    </StyledSection>
  );
};

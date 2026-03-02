'use client';

import styled from '@emotion/styled';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { TESTIMONIALS } from '@/lib/homepage-content';

function getAvatarUrl(name: string, photo?: string): string {
  if (photo) return photo;
  const encoded = encodeURIComponent(name.replace(/\s+/g, '+'));
  return `https://ui-avatars.com/api/?name=${encoded}&size=112&background=e5e5e5&color=474747`;
}

const StyledSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
`;

const StyledTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledCarousel = styled.div`
  display: flex;
  flex-direction: column;
  padding: 32px 24px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  min-height: 180px;
  box-sizing: border-box;
`;

const StyledCarouselInner = styled.div`
  display: flex;
  gap: 24px;
  flex: 1;
  align-items: flex-start;
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
  gap: 12px;
`;

const StyledQuote = styled.blockquote`
  font-size: 16px;
  line-height: 1.6;
  color: #141414;
  margin: 0;
  font-style: italic;
`;

const StyledAttribution = styled.div`
  font-size: 14px;
  color: #474747;
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

const AUTO_ADVANCE_MS = 5000;

export const TestimonialsSection = () => {
  const [index, setIndex] = useState(0);
  const current = TESTIMONIALS[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1));
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, []);

  const goPrev = () =>
    setIndex((i) => (i === 0 ? TESTIMONIALS.length - 1 : i - 1));
  const goNext = () =>
    setIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1));

  return (
    <StyledSection>
      <StyledTitle>What people say</StyledTitle>
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
          {TESTIMONIALS.map((_, i) => (
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
    </StyledSection>
  );
};

'use client';

import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';

import { Logo } from '@/app/_components/ui/layout/Logo';

const SCROLL_THRESHOLD = 400;

const NAV_ITEMS = [
  { label: 'Built for', href: '#built-for' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why us', href: '#why-us' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '#contact' },
] as const;

const StyledNav = styled.nav<{ visible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  opacity: ${({ visible }) => (visible ? 1 : 0)};
  pointer-events: ${({ visible }) => (visible ? 'auto' : 'none')};
  transform: translateY(${({ visible }) => (visible ? 0 : -100)}%);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

  @media (max-width: 640px) {
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

const StyledLogoWrapper = styled.div`
  flex-shrink: 0;
`;

const StyledNavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;

  @media (max-width: 640px) {
    justify-content: flex-start;
    flex: none;
  }
`;

const StyledLink = styled.a`
  color: #474747;
  text-decoration: none;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  white-space: nowrap;

  &:hover {
    background: #f5f5f5;
    color: #141414;
  }
`;

export const HomepageStickyNav = () => {
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (href?.startsWith('#')) {
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  return (
    <StyledNav visible={visible} aria-label="Section navigation">
      <StyledLogoWrapper>
        <Logo variant="header" />
      </StyledLogoWrapper>
      <StyledNavLinks>
        {NAV_ITEMS.map(({ label, href }) => (
          <StyledLink key={href} href={href} onClick={handleClick}>
            {label}
          </StyledLink>
        ))}
      </StyledNavLinks>
    </StyledNav>
  );
};

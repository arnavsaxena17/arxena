'use client';

import styled from '@emotion/styled';
import { IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { MarketingDetailPage } from '@/lib/marketing-site-pages';

/** Plain class for panel — avoids Emotion component selectors (needs babel/swc plugin). */
const NAV_DROPDOWN_PANEL_CLASS = 'nav-dropdown-panel';

const StyledRoot = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  &:hover .nav-dropdown-panel,
  &:focus-within .nav-dropdown-panel {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
  }
`;

const StyledPanel = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 300px;
  max-width: 380px;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  padding: 8px 0;
  margin-top: 0;
  background: #fff;
  border: 1px solid rgba(20, 20, 20, 0.1);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.15s ease,
    visibility 0.15s ease,
    transform 0.15s ease;
  pointer-events: none;
`;

const StyledTrigger = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgb(71, 71, 71);
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 15px;

  &:hover {
    background-color: #f1f1f1;
  }
`;

const StyledChevron = styled(IconChevronDown)`
  flex-shrink: 0;
  opacity: 0.55;
`;

const StyledItem = styled(Link)`
  display: block;
  padding: 10px 16px;
  text-decoration: none;
  color: inherit;
  border-radius: 0;

  &:hover {
    background-color: #f5f5f5;
  }
`;

const StyledItemTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #141414;
  line-height: 1.3;
`;

const StyledItemDesc = styled.div`
  font-size: 13px;
  color: #818181;
  line-height: 1.45;
  margin-top: 4px;
`;

const StyledFooter = styled.div`
  border-top: 1px solid rgba(20, 20, 20, 0.08);
  padding: 8px 0 4px;
  margin-top: 4px;
`;

const StyledFooterLink = styled(Link)`
  display: block;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #141414;
  text-decoration: none;

  &:hover {
    background-color: #f5f5f5;
  }
`;

type HeaderNavDropdownProps = {
  href: string;
  label: string;
  items: MarketingDetailPage[];
};

export const HeaderNavDropdown = ({
  href,
  label,
  items,
}: HeaderNavDropdownProps) => {
  return (
    <StyledRoot>
      <StyledTrigger href={href}>
        {label}
        <StyledChevron size={16} stroke={1.75} aria-hidden />
      </StyledTrigger>
      <StyledPanel
        className={NAV_DROPDOWN_PANEL_CLASS}
        role="menu"
        aria-label={`${label} menu`}
      >
        {items.map((item) => (
          <StyledItem
            key={item.slug}
            href={`${href}/${item.slug}`}
            role="menuitem"
          >
            <StyledItemTitle>{item.title}</StyledItemTitle>
            <StyledItemDesc>{item.headline}</StyledItemDesc>
          </StyledItem>
        ))}
        <StyledFooter>
          <StyledFooterLink href={href}>
            View all {label.toLowerCase()}
          </StyledFooterLink>
        </StyledFooter>
      </StyledPanel>
    </StyledRoot>
  );
};

const StyledMobileSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 360px;
`;

const StyledMobileToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgb(71, 71, 71);
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background-color: #f1f1f1;
  }
`;

const StyledMobileChevron = styled(IconChevronDown, {
  shouldForwardProp: (prop) => prop !== '$open',
})<{ $open: boolean }>`
  flex-shrink: 0;
  opacity: 0.55;
  transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'none')};
  transition: transform 0.2s ease;
`;

const StyledMobileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 8px 0 0;
`;

const StyledMobileItem = styled(Link)`
  display: block;
  padding: 10px 12px 10px 20px;
  text-align: left;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
  border: 1px solid rgba(20, 20, 20, 0.06);
  background: #fafafa;

  &:hover {
    background: #f1f1f1;
  }
`;

const StyledMobileItemTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #141414;
`;

const StyledMobileItemDesc = styled.div`
  font-size: 12px;
  color: #818181;
  line-height: 1.4;
  margin-top: 4px;
`;

const StyledMobileViewAll = styled(Link)`
  display: block;
  padding: 8px 16px;
  margin-top: 4px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #141414;
  text-decoration: none;
  border-radius: 8px;

  &:hover {
    background-color: #f1f1f1;
  }
`;

type HeaderMobileNavDropdownProps = {
  basePath: string;
  label: string;
  items: MarketingDetailPage[];
  onItemNavigate?: () => void;
};

export const HeaderMobileNavDropdown = ({
  basePath,
  label,
  items,
  onItemNavigate,
}: HeaderMobileNavDropdownProps) => {
  const [open, setOpen] = useState(false);

  const handleNavigate = () => {
    setOpen(false);
    onItemNavigate?.();
  };

  return (
    <StyledMobileSection>
      <StyledMobileToggle
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`mobile-nav-${label.replace(/\s+/g, '-')}`}
        id={`mobile-nav-toggle-${label.replace(/\s+/g, '-')}`}
      >
        {label}
        <StyledMobileChevron size={16} stroke={1.75} $open={open} aria-hidden />
      </StyledMobileToggle>
      {open && (
        <StyledMobileList
          id={`mobile-nav-${label.replace(/\s+/g, '-')}`}
          role="region"
          aria-labelledby={`mobile-nav-toggle-${label.replace(/\s+/g, '-')}`}
        >
          {items.map((item) => (
            <StyledMobileItem
              key={item.slug}
              href={`${basePath}/${item.slug}`}
              onClick={handleNavigate}
            >
              <StyledMobileItemTitle>{item.title}</StyledMobileItemTitle>
              <StyledMobileItemDesc>{item.headline}</StyledMobileItemDesc>
            </StyledMobileItem>
          ))}
          <StyledMobileViewAll href={basePath} onClick={handleNavigate}>
            View all {label.toLowerCase()}
          </StyledMobileViewAll>
        </StyledMobileList>
      )}
    </StyledMobileSection>
  );
};

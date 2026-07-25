'use client';

import { CHROME_EXTENSION_PAGE } from '@/lib/brand-content';
import styled from '@emotion/styled';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared/constants';

import { trackGA4Event } from '@/lib/analytics';
import { trackWebsiteEvent } from '@/lib/mixpanel';

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 16px 0;
  text-align: center;
  color: #141414;
`;

const StyledHeadlineSub = styled.p`
  font-size: 18px;
  color: #818181;
  margin: 0 0 40px 0;
  text-align: center;
  line-height: 1.5;
`;

const StyledCtaButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  max-width: 280px;
  margin: 0 auto 56px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 15px;
  transition: color 0.15s ease;

  &:hover {
    color: #b3b3b3;
  }
`;

const StyledBlockTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
`;

const StyledOrderedList = styled.ol`
  margin: 0 0 40px 0;
  padding-left: 1.25rem;
  color: #474747;
  font-size: 16px;
  line-height: 1.6;

  li {
    margin-bottom: 12px;
  }
`;

const StyledBulletList = styled.ul`
  margin: 0;
  padding-left: 1.25rem;
  color: #474747;
  font-size: 16px;
  line-height: 1.6;

  li {
    margin-bottom: 10px;
  }
`;

export const ChromeExtensionContent = () => {
  return (
    <StyledSection>
      <StyledHeadline>{CHROME_EXTENSION_PAGE.headline}</StyledHeadline>
      <StyledHeadlineSub>{CHROME_EXTENSION_PAGE.subheadline}</StyledHeadlineSub>

      <StyledCtaButton
        href={ARXENA_CHROME_WEBSTORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackGA4Event('chrome_extension_download_click', {
            source: 'chrome_extension_page',
          });
          trackWebsiteEvent('chrome_extension_download_click', {
            source: 'chrome_extension_page',
          });
        }}
      >
        Add to Chrome
      </StyledCtaButton>

      <StyledBlockTitle>Install and connect</StyledBlockTitle>
      <StyledOrderedList>
        <li>
          Install the extension from the Chrome Web Store using the button
          above.
        </li>
        <li>
          Open the extension on a LinkedIn profile page and keep it open until
          the status shows <strong>Connected</strong>. Arxena connects your
          LinkedIn session in the background (via Unipile); wait for that step
          to finish before you rely on messaging or enrichment.
        </li>
      </StyledOrderedList>

      <StyledBlockTitle>What you can do</StyledBlockTitle>
      <StyledBulletList>
        <li>
          Browse people on LinkedIn and use Arxena from the profile view you
          already have open.
        </li>
        <li>Fetch phone numbers and other contact details where available.</li>
        <li>
          Start a conversation with someone for a specific job so outreach stays
          tied to the role you are recruiting for.
        </li>
      </StyledBulletList>
    </StyledSection>
  );
};

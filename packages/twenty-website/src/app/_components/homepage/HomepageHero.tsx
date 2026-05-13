'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { ContactUsSection } from '@/app/_components/homepage/ContactUsSection';
import { DifferentiatorsSection } from '@/app/_components/homepage/DifferentiatorsSection';
import { HowItWorksSection } from '@/app/_components/homepage/HowItWorksSection';
import { TestimonialsSection } from '@/app/_components/homepage/TestimonialsSection';
import { TrustBadgesSection } from '@/app/_components/homepage/TrustBadgesSection';
import { UseCasesSection } from '@/app/_components/homepage/UseCasesSection';
import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { Logo } from '@/app/_components/ui/layout/Logo';
import { trackGA4Event } from '@/lib/analytics';
import { trackWebsiteEvent } from '@/lib/mixpanel';

const StyledHero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 48px 24px 64px;
  text-align: center;
`;

const StyledLogoWrapper = styled.div`
  margin-bottom: 24px;
`;

const StyledTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #000;
  line-height: 1.2;
  max-width: 720px;

  @media (max-width: 809px) {
    font-size: 1.75rem;
  }
`;

const StyledHeroLead = styled.p`
  font-size: 17px;
  color: #474747;
  margin: 0 auto 16px;
  max-width: 640px;
  line-height: 1.6;
  text-align: center;
`;

const StyledHeroStats = styled.p`
  font-size: 15px;
  color: #818181;
  margin: 0 auto 28px;
  max-width: 640px;
  line-height: 1.5;
  text-align: center;
`;

const StyledClarifySection = styled.div`
  width: 100%;
  max-width: 720px;
  margin: 0 auto 40px;
  padding: 24px 20px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-align: left;
`;

const StyledClarifyHeading = styled.p`
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #818181;
  margin: 0 0 16px 0;
`;

const StyledClarifyRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const StyledClarifyBlock = styled.div``;

const StyledClarifyLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #141414;
  margin-bottom: 6px;
`;

const StyledClarifyText = styled.p`
  font-size: 14px;
  color: #474747;
  line-height: 1.55;
  margin: 0;
`;

const StyledSearchWrapper = styled.div`
  width: 100%;
  max-width: 560px;
  margin: 0 auto 32px;
`;

const StyledAuthLinks = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
`;

const StyledLink = styled.a`
  color: #000;
  text-decoration: none;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
  transition: background 0.15s ease;

  &:hover {
    background: #f5f5f5;
  }
`;

const StyledEngageLink = styled(Link)`
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledPrimaryCta = styled.a`
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 24px;
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

const StyledExampleSection = styled.section`
  width: 100%;
  margin: 0 auto;
  padding: 48px 0;
`;

const StyledExampleTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledScrollingStrip = styled.div`
  overflow: hidden;
  mask-image: linear-gradient(
    to right,
    transparent,
    black 10%,
    black 90%,
    transparent
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    black 10%,
    black 90%,
    transparent
  );
`;

const StyledScrollingTrack = styled.div<{ isPaused: boolean }>`
  display: flex;
  gap: 16px;
  width: max-content;
  animation: scroll-strip 40s linear infinite;
  animation-play-state: ${({ isPaused }) => (isPaused ? 'paused' : 'running')};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @keyframes scroll-strip {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
`;

const StyledExampleCard = styled(Link, {
  shouldForwardProp: (propName) => propName !== 'isSelected',
})<{ isSelected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 28px;
  min-width: 140px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-decoration: none;
  color: #141414;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.15);
  }

  ${({ isSelected }) =>
    isSelected
      ? `
    background: #fff;
    border-color: rgba(37, 99, 235, 0.45);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
    transform: translateY(-1px);
  `
      : ''}
`;

const StyledExampleLogo = styled.img`
  width: 40px;
  height: 40px;
  object-fit: contain;
  margin-bottom: 8px;
`;

const StyledExampleLogoPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.06);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: rgba(20, 20, 20, 0.3);
`;

const StyledExampleCardTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  text-align: center;
`;

const StyledSectionAnchor = styled.section`
  scroll-margin-top: 60px;
`;

const StyledEngageCrossSell = styled.p`
  font-size: 15px;
  color: #474747;
  margin: 0 auto;
  padding: 0 24px 48px;
  text-align: center;
  max-width: 560px;
`;

function getLogoAbbreviation(website?: string, companyName?: string): string {
  if (website?.trim()) {
    const domain = website.replace(/^https?:\/\//, '').split('.')[0];
    const letter = domain?.[0];
    return letter
      ? letter.toUpperCase()
      : (companyName?.charAt(0)?.toUpperCase() ?? '?');
  }
  return companyName?.charAt(0)?.toUpperCase() ?? '?';
}

const EXAMPLE_COMPANIES = [
  { companyId: 'google', name: 'Google', website: 'google.com' },
  { companyId: 'microsoft', name: 'Microsoft', website: 'microsoft.com' },
  { companyId: 'netflix', name: 'Netflix', website: 'netflix.com' },
  { companyId: 'salesforce', name: 'Salesforce', website: 'salesforce.com' },
  { companyId: 'amazon', name: 'Amazon', website: 'amazon.com' },
  { companyId: 'apple', name: 'Apple', website: 'apple.com' },
  { companyId: 'facebook', name: 'Facebook', website: 'facebook.com' },
  { companyId: 'tesla', name: 'Tesla', website: 'tesla.com' },
  { companyId: 'accenture', name: 'Accenture', website: 'accenture.com' },
  { companyId: 'ibm', name: 'IBM', website: 'ibm.com' },
  { companyId: 'oracle', name: 'Oracle', website: 'oracle.com' },
  { companyId: 'sap', name: 'SAP', website: 'sap.com' },
  { companyId: 'hp', name: 'HP', website: 'hp.com' },
  { companyId: 'dell', name: 'Dell', website: 'dell.com' },
  { companyId: 'cisco', name: 'Cisco', website: 'cisco.com' },
];

type HomepageHeroProps = {
  signInUrl: string;
  signUpUrl: string;
};

export const HomepageHero = ({ signInUrl, signUpUrl }: HomepageHeroProps) => {
  const [failedLogoWebsites, setFailedLogoWebsites] = useState<Set<string>>(
    new Set(),
  );
  const [isExampleStripPaused, setIsExampleStripPaused] = useState(false);
  const [selectedExampleCompanyKey, setSelectedExampleCompanyKey] = useState<
    string | null
  >(null);
  const handleLogoError = useCallback((website: string) => {
    setFailedLogoWebsites((prev) => new Set(prev).add(website));
  }, []);

  return (
    <>
      <StyledHero>
        <StyledLogoWrapper>
          <Logo variant="hero" />
        </StyledLogoWrapper>
        <StyledTitle>Know who actually runs things.</StyledTitle>
        <StyledHeroLead>
          The CFO changed. The economic buyer wasn&apos;t in the room. The
          stakeholders had conflicting briefs. Map any org live — so you never
          walk in blind.
        </StyledHeroLead>
        <StyledHeroStats>
          1M+ companies · 800M+ professionals · Real-time from LinkedIn and
          others
        </StyledHeroStats>
        {/* <StyledClarifySection>
          <StyledClarifyHeading>Worth clarifying</StyledClarifyHeading>
          <StyledClarifyRow>
            <StyledClarifyBlock>
              <StyledClarifyLabel>Not this</StyledClarifyLabel>
              <StyledClarifyText>
                A tool that helps you draw or document your own company&apos;s
                org chart.
              </StyledClarifyText>
            </StyledClarifyBlock>
            <StyledClarifyBlock>
              <StyledClarifyLabel>This</StyledClarifyLabel>
              <StyledClarifyText>
                An intelligence platform that fetches the org chart of any
                company you&apos;re targeting — for sales, recruiting,
                investing, or competitive research.
              </StyledClarifyText>
            </StyledClarifyBlock>
          </StyledClarifyRow>
        </StyledClarifySection> */}
        <StyledSearchWrapper>
          <OrgChartSearch
            placeholder="Search any company"
            startIcon={<IconHierarchy2 size={20} />}
          />
        </StyledSearchWrapper>
        <StyledAuthLinks>
          <StyledPrimaryCta
            href={signUpUrl}
            onClick={() => {
              trackGA4Event('cta_click', { cta: 'Try it free' });
              trackWebsiteEvent('cta_click', { cta: 'Try it free' });
            }}
          >
            Try it free
          </StyledPrimaryCta>
          <StyledLink
            href={signInUrl}
            onClick={() => {
              trackGA4Event('sign_in_click', { source: 'homepage' });
              trackWebsiteEvent('sign_in_click', { source: 'homepage' });
            }}
          >
            Log in
          </StyledLink>
        </StyledAuthLinks>
      </StyledHero>

      <StyledExampleSection>
        <StyledExampleTitle>
          Check out our Real-time Org Charts & Engagement. Click on any Company Below
        </StyledExampleTitle>
        <StyledScrollingStrip>
          <StyledScrollingTrack isPaused={isExampleStripPaused}>
            {[...EXAMPLE_COMPANIES, ...EXAMPLE_COMPANIES].map(
              ({ companyId, name, website }, i) => {
                const logoFailed = failedLogoWebsites.has(website);
                const key = `${companyId}-${i}`;
                return (
                  <StyledExampleCard
                    key={key}
                    href={`/org-chart/${encodeURIComponent(companyId)}`}
                    prefetch={false}
                    isSelected={selectedExampleCompanyKey === key}
                    onPointerDown={() => {
                      setIsExampleStripPaused(true);
                      setSelectedExampleCompanyKey(key);
                    }}
                  >
                    {logoFailed ? (
                      <StyledExampleLogoPlaceholder>
                        {getLogoAbbreviation(website, name)}
                      </StyledExampleLogoPlaceholder>
                    ) : (
                      <StyledExampleLogo
                        src={`/api/org-chart/company-logo?website=${encodeURIComponent(website)}`}
                        alt=""
                        onError={() => handleLogoError(website)}
                      />
                    )}
                    <StyledExampleCardTitle>{name}</StyledExampleCardTitle>
                  </StyledExampleCard>
                );
              },
            )}
          </StyledScrollingTrack>
        </StyledScrollingStrip>
      </StyledExampleSection>

      <StyledSectionAnchor id="built-for">
        <UseCasesSection />
      </StyledSectionAnchor>
      <StyledSectionAnchor id="how-it-works">
        <HowItWorksSection />
      </StyledSectionAnchor>
      <StyledSectionAnchor id="why-us">
        <DifferentiatorsSection />
      </StyledSectionAnchor>
      <StyledSectionAnchor id="testimonials">
        <TestimonialsSection />
      </StyledSectionAnchor>
      <TrustBadgesSection />

      <StyledEngageCrossSell>
        Map → plan → reach → measure —{' '}
        <StyledEngageLink href="/engage">
          How AI outreach and tracking works →
        </StyledEngageLink>
      </StyledEngageCrossSell>

      <StyledSectionAnchor id="contact">
        <ContactUsSection />
      </StyledSectionAnchor>
    </>
  );
};

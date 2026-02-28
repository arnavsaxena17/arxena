'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { ContactUsSection } from '@/app/_components/homepage/ContactUsSection';
import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { Logo } from '@/app/_components/ui/layout/Logo';

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
  margin: 0 0 24px 0;
  color: #000;
  line-height: 1.2;

  @media (max-width: 809px) {
    font-size: 1.75rem;
  }
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

const StyledScrollingTrack = styled.div`
  display: flex;
  gap: 16px;
  width: max-content;
  animation: scroll-strip 40s linear infinite;

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

const StyledExampleCard = styled(Link)`
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
    border-color 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.15);
  }
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

const StyledSocialProof = styled.p`
  font-size: 16px;
  color: #474747;
  margin: 0;
  text-align: center;
  padding: 24px;
`;

const StyledPricingSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
`;

const StyledPricingTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledPricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPricingCard = styled.div`
  padding: 24px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-align: center;
`;

const StyledPricingCardTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #141414;
`;

const StyledPricingCardPrice = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #141414;
  margin-bottom: 4px;
`;

const StyledPricingCardCredits = styled.div`
  font-size: 14px;
  color: #818181;
  margin-bottom: 16px;
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

const PRICING_TIERS = [
  {
    name: '1 org chart',
    price: 799,
    credits: '1 credit (<100 employees)',
    useCase: 'One-off mapping',
  },
  {
    name: '5 org charts',
    price: 2499,
    credits: '5 credits',
    useCase: 'Individual recruiters',
  },
  {
    name: '15 org charts',
    price: 4999,
    credits: '15 credits',
    useCase: 'TA teams, agencies',
  },
];

type HomepageHeroProps = {
  signInUrl: string;
  signUpUrl: string;
};

export const HomepageHero = ({ signInUrl, signUpUrl }: HomepageHeroProps) => {
  const [failedLogoWebsites, setFailedLogoWebsites] = useState<Set<string>>(
    new Set(),
  );
  const handleLogoError = useCallback((website: string) => {
    setFailedLogoWebsites((prev) => new Set(prev).add(website));
  }, []);

  return (
    <>
      <StyledHero>
        <StyledLogoWrapper>
          <Logo variant="hero" />
        </StyledLogoWrapper>
        <StyledTitle>Search any company&apos;s org chart</StyledTitle>
        <StyledSearchWrapper>
          <OrgChartSearch
            placeholder="Search any company's org chart"
            startIcon={<IconHierarchy2 size={20} />}
          />
        </StyledSearchWrapper>
        <StyledAuthLinks>
          <StyledPrimaryCta href={signUpUrl}>Try it free</StyledPrimaryCta>
          <StyledLink href={signInUrl}>Log in</StyledLink>
        </StyledAuthLinks>
      </StyledHero>

      <StyledExampleSection>
        <StyledExampleTitle>Example org charts</StyledExampleTitle>
        <StyledScrollingStrip>
          <StyledScrollingTrack>
            {[...EXAMPLE_COMPANIES, ...EXAMPLE_COMPANIES].map(
              ({ companyId, name, website }, i) => {
                const logoFailed = failedLogoWebsites.has(website);
                return (
                  <StyledExampleCard
                    key={`${companyId}-${i}`}
                    href={`/org-chart/${encodeURIComponent(companyId)}`}
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

      <StyledSocialProof>
        1M+ companies mapped, 55M+ professionals indexed
      </StyledSocialProof>

      <StyledPricingSection>
        <StyledPricingTitle>Simple pricing</StyledPricingTitle>
        <StyledPricingGrid>
          {PRICING_TIERS.map(({ name, price, credits, useCase }) => (
            <StyledPricingCard key={name}>
              <StyledPricingCardTitle>{name}</StyledPricingCardTitle>
              <StyledPricingCardPrice>
                ${price.toLocaleString()}
              </StyledPricingCardPrice>
              <StyledPricingCardCredits>{credits}</StyledPricingCardCredits>
              <div style={{ fontSize: 13, color: '#818181' }}>{useCase}</div>
            </StyledPricingCard>
          ))}
        </StyledPricingGrid>
        <div style={{ textAlign: 'center' }}>
          <StyledPrimaryCta href="/pricing">View full pricing</StyledPrimaryCta>
        </div>
        <p
          style={{
            margin: '24px 0 0 0',
            textAlign: 'center',
            fontSize: 15,
            color: '#474747',
          }}
        >
          Want to reach the right people?{' '}
          <StyledEngageLink href="/engage">
            Learn about Engagement →
          </StyledEngageLink>
        </p>
      </StyledPricingSection>

      <ContactUsSection />
    </>
  );
};

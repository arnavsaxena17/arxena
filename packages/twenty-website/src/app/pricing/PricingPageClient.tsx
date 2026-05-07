'use client';

import { type SupportedPricingCurrency } from '@/lib/pricing-currency-helpers';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';

import { PricingContent } from '@/app/_components/pricing/PricingContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

const STORAGE_KEY = 'arxena:pricing-currency';

const StyledPricingPage = styled.main`
  background: #fff;
  min-height: 100dvh;
  overflow-x: hidden;
  width: 100%;
`;

type PricingPageClientProps = {
  signInUrl: string;
  signUpUrl: string;
  defaultCurrency: SupportedPricingCurrency;
};

export const PricingPageClient = ({
  signInUrl,
  signUpUrl,
  defaultCurrency,
}: PricingPageClientProps) => {
  const [currency, setCurrency] =
    useState<SupportedPricingCurrency>(defaultCurrency);

  useEffect(() => {
    const storedCurrency = localStorage.getItem(STORAGE_KEY);
    if (
      storedCurrency === 'INR' ||
      storedCurrency === 'USD' ||
      storedCurrency === 'GBP' ||
      storedCurrency === 'EUR'
    ) {
      setCurrency(storedCurrency);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency);
  }, [currency]);

  return (
    <StyledPricingPage>
      <Header
        showSearch={false}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={setCurrency}
      />
      <ContentContainer>
        <PricingContent signUpUrl={signUpUrl} currency={currency} />
      </ContentContainer>
    </StyledPricingPage>
  );
};

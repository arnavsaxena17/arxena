'use client';

import {
    SUPPORTED_PRICING_CURRENCIES,
    type SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';
import { resolvePricingCurrencyFromCountryCode, getOrFetchClientGeoSession } from 'twenty-shared';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';

import { PricingContent } from '@/app/_components/pricing/PricingContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

const CURRENCY_STORAGE_KEY = 'arxena:pricing-currency';
const CURRENCY_MANUAL_STORAGE_KEY = 'arxena:pricing-currency-manual';

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
    const hasManualCurrencyPreference =
      localStorage.getItem(CURRENCY_MANUAL_STORAGE_KEY) === 'true';
    if (!hasManualCurrencyPreference) {
      return;
    }

    const storedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (
      storedCurrency !== null &&
      SUPPORTED_PRICING_CURRENCIES.includes(
        storedCurrency as SupportedPricingCurrency,
      )
    ) {
      setCurrency(storedCurrency as SupportedPricingCurrency);
    }
  }, []);

  useEffect(() => {
    const hasManualCurrencyPreference =
      localStorage.getItem(CURRENCY_MANUAL_STORAGE_KEY) === 'true';
    if (hasManualCurrencyPreference) {
      return;
    }

    void getOrFetchClientGeoSession().then((session) => {
      if (!session.country) {
        return;
      }
      const refinedCurrency = resolvePricingCurrencyFromCountryCode(
        session.country,
      );
      if (refinedCurrency !== defaultCurrency && defaultCurrency === 'USD') {
        setCurrency(refinedCurrency);
      }
    });
  }, [defaultCurrency]);

  const handleCurrencyChange = (nextCurrency: SupportedPricingCurrency) => {
    setCurrency(nextCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
    localStorage.setItem(CURRENCY_MANUAL_STORAGE_KEY, 'true');
  };

  return (
    <StyledPricingPage>
      <Header
        showSearch={false}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
      />
      <ContentContainer>
        <PricingContent signUpUrl={signUpUrl} currency={currency} />
      </ContentContainer>
    </StyledPricingPage>
  );
};

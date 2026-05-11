'use client';

import { type SupportedPricingCurrency } from '@/lib/pricing-currency-helpers';
import { HeaderDesktop } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';

type HeaderProps = {
  showSearch?: boolean;
  showCurrencySelector?: boolean;
  signInUrl: string;
  signUpUrl: string;
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (currency: SupportedPricingCurrency) => void;
};

export const Header = ({
  showSearch = true,
  showCurrencySelector = true,
  signInUrl,
  signUpUrl,
  currency = 'USD',
  onCurrencyChange = () => {},
}: HeaderProps) => {
  return (
    <>
      <HeaderDesktop
        showSearch={showSearch}
        showCurrencySelector={showCurrencySelector}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />
      <HeaderMobile
        showSearch={showSearch}
        showCurrencySelector={showCurrencySelector}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />
    </>
  );
};

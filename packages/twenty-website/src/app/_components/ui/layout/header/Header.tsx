'use client';

import { HeaderDesktop } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';
import { type SupportedPricingCurrency } from '@/lib/pricing-currency-helpers';

type HeaderProps = {
  showSearch?: boolean;
  signInUrl: string;
  signUpUrl: string;
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (currency: SupportedPricingCurrency) => void;
};

export const Header = ({
  showSearch = true,
  signInUrl,
  signUpUrl,
  currency = 'USD',
  onCurrencyChange = () => {},
}: HeaderProps) => {
  return (
    <>
      <HeaderDesktop
        showSearch={showSearch}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />
      <HeaderMobile
        showSearch={showSearch}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />
    </>
  );
};

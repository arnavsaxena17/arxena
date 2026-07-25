'use client';

import { SupportedPricingCurrency } from '@/lib/pricing-currency-helpers';
import { HeaderDesktop } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';

type HeaderProps = {
  showSearch?: boolean;
  showCurrencySelector?: boolean;
  signInUrl: string;
  signUpUrl: string;
  currency?: SupportedPricingCurrency;
  onCurrencyChange?: (currency: SupportedPricingCurrency) => void;
  /** Tighter mobile bar (e.g. org chart canvas pages). */
  embeddedToolbar?: boolean;
};

export const Header = ({
  showSearch = true,
  showCurrencySelector = true,
  signInUrl,
  signUpUrl,
  currency = 'USD',
  onCurrencyChange = () => {},
  embeddedToolbar = false,
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
        showSearch={embeddedToolbar ? false : showSearch}
        showCurrencySelector={showCurrencySelector}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        embeddedToolbar={embeddedToolbar}
      />
    </>
  );
};

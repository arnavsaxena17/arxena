'use client';

import { HeaderDesktop } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';

type HeaderProps = {
  showSearch?: boolean;
  signInUrl: string;
  signUpUrl: string;
};

export const Header = ({
  showSearch = true,
  signInUrl,
  signUpUrl,
}: HeaderProps) => {
  return (
    <>
      <HeaderDesktop
        showSearch={showSearch}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
      />
      <HeaderMobile
        showSearch={showSearch}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
      />
    </>
  );
};

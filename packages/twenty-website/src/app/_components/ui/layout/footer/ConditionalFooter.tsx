'use client';

import { usePathname } from 'next/navigation';

import { FooterDesktop } from './FooterDesktop';
import { FooterMobile } from './FooterMobile';

export const ConditionalFooter = () => {
  const pathname = usePathname();
  const isOrgChart = pathname?.startsWith('/org-chart');

  if (isOrgChart) {
    return null;
  }

  return (
    <>
      <FooterDesktop />
      <FooterMobile />
    </>
  );
};

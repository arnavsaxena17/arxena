'use client';

import { usePathname } from 'next/navigation';

import { FooterDesktop } from './FooterDesktop';

export const ConditionalFooter = () => {
  const pathname = usePathname();
  const isOrgChart = pathname?.startsWith('/org-chart');

  if (isOrgChart) {
    return null;
  }

  return <FooterDesktop />;
};

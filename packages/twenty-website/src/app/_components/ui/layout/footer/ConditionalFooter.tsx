'use client';

import { usePathname } from 'next/navigation';

import { FooterDesktop } from './FooterDesktop';
import { FooterMobile } from './FooterMobile';

type ConditionalFooterProps = {
  phase2Exposed?: boolean;
};

export const ConditionalFooter = ({
  phase2Exposed = false,
}: ConditionalFooterProps) => {
  const pathname = usePathname();
  const isOrgChart = pathname?.startsWith('/org-chart');

  if (isOrgChart) {
    return null;
  }

  return (
    <>
      <FooterDesktop phase2Exposed={phase2Exposed} />
      <FooterMobile phase2Exposed={phase2Exposed} />
    </>
  );
};

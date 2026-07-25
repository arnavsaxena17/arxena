'use client';

import { syncWebsiteMixpanelRouteContext } from '@/lib/mixpanel';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Keeps Mixpanel super-property `pathname` aligned with App Router navigations. */
export const MixpanelRouteSync = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      syncWebsiteMixpanelRouteContext(pathname);
    }
  }, [pathname]);

  return null;
};

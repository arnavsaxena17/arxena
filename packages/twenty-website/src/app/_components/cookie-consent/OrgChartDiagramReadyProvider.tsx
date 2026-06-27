'use client';

import { usePathname } from 'next/navigation';
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

const DEFER_COOKIE_BANNER_TIMEOUT_MS = 12_000;

type OrgChartDiagramReadyContextValue = {
  markDiagramReady: () => void;
  markInteractiveOrgChartAbsent: () => void;
  shouldDeferCookieBanner: boolean;
};

const OrgChartDiagramReadyContext =
  createContext<OrgChartDiagramReadyContextValue | null>(null);

const isInteractiveOrgChartPath = (pathname: string | null): boolean => {
  if (!pathname) {
    return false;
  }

  return pathname.startsWith('/org/') || pathname.startsWith('/org-chart/');
};

export const OrgChartDiagramReadyProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const [isDiagramReady, setIsDiagramReady] = useState(false);
  const [skipDefer, setSkipDefer] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const shouldDeferPath = isInteractiveOrgChartPath(pathname);

  useEffect(() => {
    setIsDiagramReady(false);
    setSkipDefer(false);
    setTimedOut(false);
  }, [pathname]);

  useEffect(() => {
    if (!shouldDeferPath || isDiagramReady || skipDefer) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, DEFER_COOKIE_BANNER_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [shouldDeferPath, isDiagramReady, skipDefer]);

  const markDiagramReady = useCallback(() => {
    setIsDiagramReady(true);
  }, []);

  const markInteractiveOrgChartAbsent = useCallback(() => {
    setSkipDefer(true);
  }, []);

  const shouldDeferCookieBanner =
    shouldDeferPath && !isDiagramReady && !skipDefer && !timedOut;

  const value = useMemo(
    () => ({
      markDiagramReady,
      markInteractiveOrgChartAbsent,
      shouldDeferCookieBanner,
    }),
    [
      markDiagramReady,
      markInteractiveOrgChartAbsent,
      shouldDeferCookieBanner,
    ],
  );

  return (
    <OrgChartDiagramReadyContext.Provider value={value}>
      {children}
    </OrgChartDiagramReadyContext.Provider>
  );
};

export const useOrgChartDiagramReady = (): OrgChartDiagramReadyContextValue => {
  const context = useContext(OrgChartDiagramReadyContext);

  if (!context) {
    throw new Error(
      'useOrgChartDiagramReady must be used within OrgChartDiagramReadyProvider',
    );
  }

  return context;
};

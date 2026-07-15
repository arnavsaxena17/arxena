'use client';

import { ThemeProvider } from '@emotion/react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { companySearchLightTheme } from '@/lib/company-search';
import { isFreeTrialLeadFlowEnabled } from '@/lib/free-trial-flow';
import {
  FreeTrialOrgChartContext,
  FreeTrialSource,
} from '@/lib/free-trial-types';

import { FreeTrialModal, type FreeTrialModalIntro } from './FreeTrialModal';

type OpenFreeTrialParams = {
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
  intro?: FreeTrialModalIntro;
};

type FreeTrialFlowContextValue = {
  isFreeTrialFlow: boolean;
  openFreeTrial: (params: OpenFreeTrialParams) => void;
};

const FreeTrialFlowContext = createContext<FreeTrialFlowContextValue | null>(
  null,
);

type FreeTrialFlowProviderProps = {
  children: ReactNode;
};

export const FreeTrialFlowProvider = ({
  children,
}: FreeTrialFlowProviderProps) => {
  const isFreeTrialFlow = isFreeTrialLeadFlowEnabled();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    source: FreeTrialSource;
    orgChartContext?: FreeTrialOrgChartContext;
    intro?: FreeTrialModalIntro;
  }>({
    isOpen: false,
    source: 'homepage_hero',
  });

  const openFreeTrial = useCallback(
    ({ source, orgChartContext, intro }: OpenFreeTrialParams) => {
      setModalState({
        isOpen: true,
        source,
        orgChartContext,
        intro,
      });
    },
    [],
  );

  const closeFreeTrial = useCallback(() => {
    setModalState((current) => ({
      ...current,
      isOpen: false,
    }));
  }, []);

  const value = useMemo(
    () => ({
      isFreeTrialFlow,
      openFreeTrial,
    }),
    [isFreeTrialFlow, openFreeTrial],
  );

  return (
    <FreeTrialFlowContext.Provider value={value}>
      {children}
      {isFreeTrialFlow && (
        <ThemeProvider theme={companySearchLightTheme}>
          <FreeTrialModal
            isOpen={modalState.isOpen}
            source={modalState.source}
            orgChartContext={modalState.orgChartContext}
            intro={modalState.intro}
            onClose={closeFreeTrial}
          />
        </ThemeProvider>
      )}
    </FreeTrialFlowContext.Provider>
  );
};

export const useFreeTrialFlow = (): FreeTrialFlowContextValue => {
  const context = useContext(FreeTrialFlowContext);

  if (!context) {
    throw new Error(
      'useFreeTrialFlow must be used within FreeTrialFlowProvider',
    );
  }

  return context;
};

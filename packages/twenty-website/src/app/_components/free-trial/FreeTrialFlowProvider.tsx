'use client';

import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

import { isFreeTrialLeadFlowEnabled } from '@/lib/free-trial-flow';
import {
    FreeTrialOrgChartContext,
    FreeTrialSource,
} from '@/lib/free-trial-types';

import { FreeTrialModal } from './FreeTrialModal';

type OpenFreeTrialParams = {
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
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
  }>({
    isOpen: false,
    source: 'homepage_hero',
  });

  const openFreeTrial = useCallback(
    ({ source, orgChartContext }: OpenFreeTrialParams) => {
      setModalState({
        isOpen: true,
        source,
        orgChartContext,
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
        <FreeTrialModal
          isOpen={modalState.isOpen}
          source={modalState.source}
          orgChartContext={modalState.orgChartContext}
          onClose={closeFreeTrial}
        />
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

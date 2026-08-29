import { createContext } from 'react';

import { type GtmProjectOption } from '@/gtm-home/types/gtm-home.types';

export type GtmDashboardExperimentVariantFilter = 'ALL' | 'A' | 'B';

export type GtmDashboardScopeContextValue = {
  isActive: true;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  experimentVariant: GtmDashboardExperimentVariantFilter;
  setExperimentVariant: (variant: GtmDashboardExperimentVariantFilter) => void;
  projectOptions: GtmProjectOption[];
  projectsLoading: boolean;
};

export const GtmDashboardScopeContext =
  createContext<GtmDashboardScopeContextValue | null>(null);

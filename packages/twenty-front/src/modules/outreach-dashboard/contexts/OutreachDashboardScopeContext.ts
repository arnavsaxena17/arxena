import { createContext } from 'react';

import { type OutreachProjectOption } from '@/outreach-home/types/outreach-home.types';

export type OutreachDashboardExperimentVariantFilter = 'ALL' | 'A' | 'B';

export type OutreachDashboardScopeContextValue = {
  isActive: true;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  experimentVariant: OutreachDashboardExperimentVariantFilter;
  setExperimentVariant: (variant: OutreachDashboardExperimentVariantFilter) => void;
  projectOptions: OutreachProjectOption[];
  projectsLoading: boolean;
};

export const OutreachDashboardScopeContext =
  createContext<OutreachDashboardScopeContextValue | null>(null);

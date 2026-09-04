import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type OrgChartBrowsingContextValue = {
  companyId: string | null;
  companyName: string | null;
  country: string | null;
  functionRoot: string | null;
  titleQuery: string | null;
  searchTerm: string | null;
};

export const orgChartBrowsingContextState =
  createAtomState<OrgChartBrowsingContextValue | null>({
    key: 'orgChartBrowsingContextState',
    defaultValue: null,
  });

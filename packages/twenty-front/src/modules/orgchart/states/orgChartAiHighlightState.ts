import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { type HighlightOrgChartToolOutput } from 'twenty-shared/ai';

export type OrgChartAiHighlightRequest = HighlightOrgChartToolOutput & {
  requestId: string;
};

export const orgChartAiHighlightState =
  createAtomState<OrgChartAiHighlightRequest | null>({
    key: 'orgChartAiHighlightState',
    defaultValue: null,
  });

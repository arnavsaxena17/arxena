'use client';

import { useEffect } from 'react';

import { useOrgChartDiagramReady } from './OrgChartDiagramReadyProvider';

export const OrgChartStaticPageDiagramReadySignal = () => {
  const { markInteractiveOrgChartAbsent } = useOrgChartDiagramReady();

  useEffect(() => {
    markInteractiveOrgChartAbsent();
  }, [markInteractiveOrgChartAbsent]);

  return null;
};

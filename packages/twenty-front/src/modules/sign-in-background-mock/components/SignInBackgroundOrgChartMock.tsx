import styled from '@emotion/styled';
import { useCallback, useMemo } from 'react';

import { OrgChartDiagram, type OrgChartDiagramHandle } from 'twenty-orgchart';
import {
    processOrgChartToNodeData,
    type OrgChartNodeData,
} from 'twenty-shared';

import { SIGN_IN_BACKGROUND_MOCK_SALESFORCE_ORG_CHART } from '@/sign-in-background-mock/constants/SignInBackgroundMockSalesforceOrgChart';

const StyledDiagramWrap = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  background: ${({ theme }) => theme.background.secondary};
`;

export const SignInBackgroundOrgChartMock = () => {
  const nodeDataArray = useMemo((): OrgChartNodeData[] => {
    return processOrgChartToNodeData(SIGN_IN_BACKGROUND_MOCK_SALESFORCE_ORG_CHART);
  }, []);

  const handleDiagramReady = useCallback((handle: OrgChartDiagramHandle) => {
    handle.zoomToFit();
  }, []);

  if (nodeDataArray.length === 0) {
    return null;
  }

  return (
    <StyledDiagramWrap>
      <OrgChartDiagram
        nodeDataArray={nodeDataArray}
        iconUrls={{
          lock: '/img/lock.png',
          linkedin: '/img/linkedin-icon-png-circle-2.png',
          download: '/img/download-icon.png',
          similarItems: '/img/similar-items.png',
        }}
        onDiagramReady={handleDiagramReady}
      />
    </StyledDiagramWrap>
  );
};

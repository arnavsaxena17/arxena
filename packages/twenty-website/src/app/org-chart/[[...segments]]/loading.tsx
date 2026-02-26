'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';

const StyledLoader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  gap: 24px;
`;

const StyledSpinner = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid #e5e5e5;
  border-top-color: #000;
  animation: org-chart-load-spin 0.8s linear infinite;

  @keyframes org-chart-load-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #737373;
`;

export default function OrgChartLoading() {
  return (
    <StyledLoader>
      <IconHierarchy2 size={48} stroke={1.5} style={{ color: '#737373' }} />
      <StyledSpinner />
      <StyledText>Loading org chart...</StyledText>
    </StyledLoader>
  );
}

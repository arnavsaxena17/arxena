import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledDiagramWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: ${themeCssVariables.background.secondary};
  position: relative;

  & .orgchart-diagram {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
`;

export const StyledOverviewContainer = styled.div`
  position: absolute;
  top: ${themeCssVariables.spacing['2']};
  left: ${themeCssVariables.spacing['2']};
  width: 180px;
  height: 120px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  background-color: ${themeCssVariables.background.primary};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  z-index: 10;
`;

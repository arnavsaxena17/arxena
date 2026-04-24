import styled from '@emotion/styled';

export const StyledDiagramWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.secondary};
  position: relative;

  & .orgchart-diagram {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
`;

export const StyledOverviewContainer = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  width: 180px;
  height: 120px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.primary};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  z-index: 10;
`;


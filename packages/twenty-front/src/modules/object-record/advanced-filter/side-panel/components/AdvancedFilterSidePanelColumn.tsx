import styled from '@emotion/styled';

const StyledColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
`;

export const AdvancedFilterSidePanelColumn = StyledColumn;

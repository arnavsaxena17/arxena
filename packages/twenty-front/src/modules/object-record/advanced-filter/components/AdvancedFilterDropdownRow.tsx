import styled from '@emotion/styled';

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
`;

export const AdvancedFilterDropdownRow = StyledRow;

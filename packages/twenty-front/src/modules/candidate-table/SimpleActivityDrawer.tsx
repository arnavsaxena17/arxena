import styled from '@emotion/styled';
const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const SimpleActivityDrawer = () => {
  return (
    <StyledContainer>
      <StyledTitle>Simple Activity Drawer</StyledTitle>
      <StyledContent>
        This is a simple custom component displayed in the right drawer.
      </StyledContent>
    </StyledContainer>
  );
};
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTitle = styled.h2`
  font-size: ${themeCssVariables.font.size.xl};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledContent = styled.div`
  font-size: ${themeCssVariables.font.size.md};
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
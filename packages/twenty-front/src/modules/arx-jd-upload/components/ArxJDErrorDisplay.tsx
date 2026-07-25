import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledErrorContainer = styled.div`
  color: ${themeCssVariables.color.red};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

type ArxJDErrorDisplayProps = {
  error: string;
};

export const ArxJDErrorDisplay = ({ error }: ArxJDErrorDisplayProps) => {
  return <StyledErrorContainer>Error: {error}</StyledErrorContainer>;
};

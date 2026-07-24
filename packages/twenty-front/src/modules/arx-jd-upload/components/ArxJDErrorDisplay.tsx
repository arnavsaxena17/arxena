import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';

const StyledErrorContainer = styled.div`
  color: ${({ theme }) => theme.color.red};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

type ArxJDErrorDisplayProps = {
  error: string;
};

export const ArxJDErrorDisplay = ({ error }: ArxJDErrorDisplayProps) => {
  const theme = useTheme();

  return <StyledErrorContainer>Error: {error}</StyledErrorContainer>;
};

import styled from '@emotion/styled';
import { CircularProgressBar } from 'twenty-ui';

const StyledContainer = styled.div`
  text-align: center;
`;

const StyledText = styled.div`
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

export const ArxJDUploadingState = () => {
  return (
    <StyledContainer>
      <CircularProgressBar size={32} />
      <StyledText>Uploading & analyzing JD...</StyledText>
    </StyledContainer>
  );
};

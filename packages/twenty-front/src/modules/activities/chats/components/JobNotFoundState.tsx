import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import {
    AnimatedPlaceholder,
    AnimatedPlaceholderEmptyContainer,
    AnimatedPlaceholderEmptySubTitle,
    AnimatedPlaceholderEmptyTextContainer,
    AnimatedPlaceholderEmptyTitle,
    Button,
    EMPTY_PLACEHOLDER_TRANSITION_PROPS,
    IconArrowLeft,
} from 'twenty-ui';

const StyledEmptyContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100%;
`;

export const JobNotFoundState = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/jobs');
  };

  return (
    <StyledEmptyContainer>
      <AnimatedPlaceholderEmptyContainer
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...EMPTY_PLACEHOLDER_TRANSITION_PROPS}
      >
        <AnimatedPlaceholder type="noRecord" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>
            Job not found
          </AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
            The job you are looking for does not exist or has been removed
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
        <Button
          Icon={IconArrowLeft}
          title="Go back to jobs"
          onClick={handleGoBack}
          variant="secondary"
        />
      </AnimatedPlaceholderEmptyContainer>
    </StyledEmptyContainer>
  );
}; 
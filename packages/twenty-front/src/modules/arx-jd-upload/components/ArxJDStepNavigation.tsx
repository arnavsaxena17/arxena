import styled from '@emotion/styled';
import { Button, IconArrowLeft } from 'twenty-ui';

const StyledContainer = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledBackButton = styled.button`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

type ArxJDStepNavigationProps = {
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
  showBackButton?: boolean;
  showNextButton?: boolean;
};

export const ArxJDStepNavigation = ({
  onNext,
  onBack,
  nextLabel = 'Next',
  isNextDisabled = false,
  showBackButton = true,
  showNextButton = true,
}: ArxJDStepNavigationProps) => {
  return (
    <StyledContainer>
      <div>
        {showBackButton && onBack && (
          <StyledBackButton onClick={onBack}>
            <IconArrowLeft size={12} />
            Back
          </StyledBackButton>
        )}
      </div>
      <StyledButtonContainer>
        {showNextButton && onNext && (
          <Button
            title={nextLabel}
            onClick={onNext}
            disabled={isNextDisabled}
            variant="primary"
          />
        )}
      </StyledButtonContainer>
    </StyledContainer>
  );
};

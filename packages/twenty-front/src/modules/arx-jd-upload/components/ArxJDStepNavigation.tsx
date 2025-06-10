import styled from '@emotion/styled';
import { Button, IconArrowLeft } from 'twenty-ui';

const StyledContainer = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  position: sticky;
  bottom: 0;
  background-color: ${({ theme }) => theme.background.tertiary};
  z-index: 1;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  flex: 1;
`;

const StyledValidationMessage = styled.div`
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-right: ${({ theme }) => theme.spacing(2)};
  flex: 1;
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type ArxJDStepNavigationProps = {
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
  showBackButton?: boolean;
  showNextButton?: boolean;
  disableBack?: boolean;
  validationMessage?: string;
};

export const ArxJDStepNavigation = ({
  onNext,
  onBack,
  nextLabel = 'Next',
  isNextDisabled = false,
  showBackButton = true,
  showNextButton = true,
  disableBack = false,
  validationMessage,
}: ArxJDStepNavigationProps) => {
  return (
    <StyledContainer>
      {validationMessage && (
        <StyledValidationMessage>{validationMessage}</StyledValidationMessage>
      )}
      <StyledButtonContainer>
        <StyledButtonGroup>
          {showBackButton && onBack && (
            <Button
              title="Back"
              onClick={onBack}
              variant="secondary"
              Icon={IconArrowLeft}
              size="small"
              disabled={disableBack}
            />
          )}
        </StyledButtonGroup>
        <StyledButtonGroup>
          {showNextButton && onNext && (
            <Button
              title={nextLabel}
              onClick={onNext}
              disabled={isNextDisabled}
              variant="primary"
              size="small"
            />
          )}
        </StyledButtonGroup>
      </StyledButtonContainer>
    </StyledContainer>
  );
};

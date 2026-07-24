import { Button } from 'twenty-ui';
import { IconArrowLeft, IconRefresh } from 'twenty-ui/icons';
import styled from '@emotion/styled';

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

const StyledLeftButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledRightButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type ArxJDStepNavigationProps = {
  onNext?: () => void;
  onBack?: () => void;
  onSearch?: () => void;
  onSkipSearch?: () => void;
  nextLabel?: string;
  searchLabel?: string;
  skipSearchLabel?: string;
  isNextDisabled?: boolean;
  isSearchDisabled?: boolean;
  showBackButton?: boolean;
  showNextButton?: boolean;
  showSearchButton?: boolean;
  showSkipSearchButton?: boolean;
  disableBack?: boolean;
  validationMessage?: string;
};

export const ArxJDStepNavigation = ({
  onNext,
  onBack,
  onSearch,
  onSkipSearch,
  nextLabel = 'Next',
  searchLabel = 'Search',
  skipSearchLabel = 'Skip Search',
  isNextDisabled = false,
  isSearchDisabled = false,
  showBackButton = true,
  showNextButton = true,
  showSearchButton = false,
  showSkipSearchButton = false,
  disableBack = false,
  validationMessage,
}: ArxJDStepNavigationProps) => {
  return (
    <StyledContainer>
      {validationMessage && (
        <StyledValidationMessage>{validationMessage}</StyledValidationMessage>
      )}
      <StyledButtonContainer>
        <StyledLeftButtonGroup>
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
          {showSkipSearchButton && onSkipSearch && (
            <Button
              title={skipSearchLabel}
              onClick={onSkipSearch}
              variant="secondary"
              size="small"
            />
          )}
        </StyledLeftButtonGroup>
        <StyledRightButtonGroup>
          {showSearchButton && onSearch && (
            <Button
              title={searchLabel}
              onClick={onSearch}
              disabled={isSearchDisabled}
              variant="secondary"
              Icon={IconRefresh}
              size="small"
            />
          )}
          {showNextButton && onNext && (
            <Button
              title={nextLabel}
              onClick={onNext}
              disabled={isNextDisabled}
              variant="primary"
              size="small"
            />
          )}
        </StyledRightButtonGroup>
      </StyledButtonContainer>
    </StyledContainer>
  );
};

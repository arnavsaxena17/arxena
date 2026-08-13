import { Button } from 'twenty-ui/input';
import { IconArrowLeft, IconRefresh } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.tertiary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  bottom: 0;
  display: flex;
  margin-top: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  position: sticky;
  z-index: 1;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  flex: 1;
  justify-content: flex-end;
`;

const StyledValidationMessage = styled.div`
  color: ${themeCssVariables.color.red};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  margin-right: ${themeCssVariables.spacing[2]};
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledLeftButtonGroup = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledRightButtonGroup = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
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

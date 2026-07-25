import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useParsedJDStateValue } from '../hooks/useParsedJDState';

const StyledContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[0]};
`;

const StyledTitle = styled.h2`
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin-bottom: ${themeCssVariables.spacing[0]};
`;

const StyledDescription = styled.p`
  font-size: ${themeCssVariables.font.size.md};
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.5;
`;

const StyledStepIndicator = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.regular};
`;

export type ArxJDStepHeadingProps = {
  title: string;
  description?: string;
  currentStep?: number;
  totalSteps?: number;
};

export const ArxJDStepHeading = ({
  title,
  description,
  currentStep,
  totalSteps,
}: ArxJDStepHeadingProps) => {
  const currentParsedJD = useParsedJDStateValue();

  const stepIndicator =
    currentStep && totalSteps && currentStep > 0 && totalSteps > 0
      ? ` (Step ${currentStep} of ${totalSteps})`
      : '';

  const displayTitle = currentParsedJD?.name
    ? `${title} - ${currentParsedJD.name}`
    : title;

  return (
    <StyledContainer>
      <StyledTitle>
        {displayTitle}
        {stepIndicator && (
          <StyledStepIndicator>{stepIndicator}</StyledStepIndicator>
        )}
      </StyledTitle>
      {description && <StyledDescription>{description}</StyledDescription>}
    </StyledContainer>
  );
};

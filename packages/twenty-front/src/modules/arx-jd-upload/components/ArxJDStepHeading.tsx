import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';
import { parsedJDState } from '../states/parsedJDState';
import { ParsedJD } from '../types/ParsedJD';

const StyledContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(0)};
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(0)};
`;

const StyledDescription = styled.p`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.5;
`;

const StyledStepIndicator = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: ${({ theme }) => theme.font.weight.regular};
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
  const currentParsedJD = useRecoilValue<ParsedJD>(parsedJDState);

  // Only show step indicator if both currentStep and totalSteps are provided and valid
  const stepIndicator =
    currentStep && totalSteps && currentStep > 0 && totalSteps > 0
      ? ` (Step ${currentStep} of ${totalSteps})`
      : '';

  // If we have a parsedJD with a name, use it as the title
  const displayTitle = currentParsedJD.name ? `${title} - ${currentParsedJD.name}` : title;

  return (
    <StyledContainer>
      <StyledTitle>
        {displayTitle}
        {stepIndicator && <StyledStepIndicator>{stepIndicator}</StyledStepIndicator>}
      </StyledTitle>
      {description && <StyledDescription>{description}</StyledDescription>}
    </StyledContainer>
  );
};

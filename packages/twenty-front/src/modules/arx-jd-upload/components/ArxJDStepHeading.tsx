import styled from '@emotion/styled';

const StyledContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledDescription = styled.p`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.5;
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
  const stepIndicator =
    currentStep && totalSteps ? ` (Step ${currentStep} of ${totalSteps})` : '';

  return (
    <StyledContainer>
      <StyledTitle>
        {title}
        {stepIndicator}
      </StyledTitle>
      {description && <StyledDescription>{description}</StyledDescription>}
    </StyledContainer>
  );
};

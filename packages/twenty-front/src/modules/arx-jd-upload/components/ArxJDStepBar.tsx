import { styled } from '@linaria/react';
import { themeCssVariables, useTheme } from 'twenty-ui/theme-constants';
import { motion } from 'framer-motion';

import { ArxJDFormStepType } from '../states/arxJDFormStepperState';
import { ParsedJD } from '../types/ParsedJD';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  justify-content: space-between;
  height: 40px;
  align-items: center;
  min-height: 40px;
  margin: 0;
`;

const StyledStepContainer = styled.div<{ isLast: boolean }>`
  align-items: center;
  display: flex;
  flex-grow: ${({ isLast }) => (isLast ? '0' : '1')};
  height: 100%;
`;

const StyledStepCircle = styled(motion.div)`
  align-items: center;
  border-radius: 50%;
  border-style: solid;
  border-width: 1px;
  display: flex;
  flex-basis: auto;
  flex-shrink: 0;
  height: 20px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 20px;

  &[data-next-step='true'] {
    border-color: ${themeCssVariables.border.color.inverted} !important;
  }

  &[data-next-step='false'] {
    border-color: ${themeCssVariables.border.color.medium} !important;
  }
`;

const StyledStepIndex = styled.span<{ isNextStep: boolean }>`
  color: ${({ isNextStep }) =>
    isNextStep
      ? themeCssVariables.font.color.secondary
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledStepLabel = styled.span<{ isActive: boolean; isNextStep: boolean }>`
  color: ${({ isActive, isNextStep }) =>
    isActive || isNextStep
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-left: ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const StyledStepLine = styled(motion.div)`
  height: 2px;
  margin-left: ${themeCssVariables.spacing[2]};
  margin-right: ${themeCssVariables.spacing[2]};
  overflow: hidden;
  width: 100%;
  align-self: center;
  flex-shrink: 1;
`;

const StyledCheckmark = styled.span`
  color: ${themeCssVariables.font.color.inverted};
`;

const STEP_LABELS: Record<ArxJDFormStepType, string> = {
  [ArxJDFormStepType.UploadJD]: 'Upload JD',
  [ArxJDFormStepType.JobDetails]: 'Project Details',
  [ArxJDFormStepType.CandidateSearch]: 'Search Candidates',
  [ArxJDFormStepType.ChatConfiguration]: 'Chat Configuration',
  [ArxJDFormStepType.VideoInterview]: 'Video Interview',
  [ArxJDFormStepType.MeetingScheduling]: 'Scheduling',
};

export type ArxJDStepBarProps = {
  activeStep: number;
  parsedJD: ParsedJD | null;
  isEditMode?: boolean;
  availableSteps?: ArxJDFormStepType[];
};

export const ArxJDStepBar = ({
  activeStep,
  parsedJD,
  isEditMode = false,
  availableSteps: propAvailableSteps,
}: ArxJDStepBarProps) => {
  const theme = useTheme();

  const availableSteps = propAvailableSteps || [];

  const variantsCircle = {
    active: {
      backgroundColor: theme.font.color.primary,
      borderColor: theme.font.color.primary,
      transition: { duration: 0.5 },
    },
    inactive: {
      backgroundColor: theme.background.transparent.lighter,
      borderColor: theme.border.color.medium,
      transition: { duration: 0.5 },
    },
  };

  const variantsLine = {
    active: {
      backgroundColor: theme.font.color.primary,
      transition: { duration: 0.5 },
    },
    inactive: {
      backgroundColor: theme.border.color.medium,
      transition: { duration: 0.5 },
    },
  };

  return (
    <StyledContainer>
      {availableSteps.map((stepType, index) => {
        const isActive = index <= activeStep;
        const isNextStep = activeStep + 1 === index;
        const isLast = index === availableSteps.length - 1;

        return (
          <StyledStepContainer key={stepType} isLast={isLast}>
            <StyledStepCircle
              variants={variantsCircle}
              animate={isActive ? 'active' : 'inactive'}
              data-next-step={isNextStep ? 'true' : 'false'}
            >
              {isActive ? (
                <StyledCheckmark>✓</StyledCheckmark>
              ) : (
                <StyledStepIndex isNextStep={isNextStep}>
                  {index + 1}
                </StyledStepIndex>
              )}
            </StyledStepCircle>
            <StyledStepLabel isNextStep={isNextStep} isActive={isActive}>
              {STEP_LABELS[stepType]}
            </StyledStepLabel>
            {!isLast && (
              <StyledStepLine
                variants={variantsLine}
                animate={isActive ? 'active' : 'inactive'}
              />
            )}
          </StyledStepContainer>
        );
      })}
    </StyledContainer>
  );
};

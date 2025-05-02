import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';

import { ArxJDFormStepType } from '../states/arxJDFormStepperState';
import { ParsedJD } from '../types/ParsedJD';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  justify-content: space-between;
`;

const StyledStepContainer = styled.div<{ isLast: boolean }>`
  align-items: center;
  display: flex;
  flex-grow: ${({ isLast }) => (isLast ? '0' : '1')};
`;

const StyledStepCircle = styled(motion.div)<{ isNextStep: boolean }>`
  align-items: center;
  border-radius: 50%;
  border-style: solid;
  border-width: 1px;
  border-color: ${({ theme, isNextStep }) =>
    isNextStep
      ? theme.border.color.inverted
      : theme.border.color.medium} !important;
  display: flex;
  flex-basis: auto;
  flex-shrink: 0;
  height: 20px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 20px;
`;

const StyledStepIndex = styled.span<{ isNextStep: boolean }>`
  color: ${({ theme, isNextStep }) =>
    isNextStep ? theme.font.color.secondary : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledStepLabel = styled.span<{ isActive: boolean; isNextStep: boolean }>`
  color: ${({ theme, isActive, isNextStep }) =>
    isActive || isNextStep
      ? theme.font.color.primary
      : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-left: ${({ theme }) => theme.spacing(2)};
  white-space: nowrap;
`;

const StyledStepLine = styled(motion.div)`
  height: 2px;
  margin-left: ${({ theme }) => theme.spacing(2)};
  margin-right: ${({ theme }) => theme.spacing(2)};
  overflow: hidden;
  width: 100%;
`;

const STEP_LABELS: Record<ArxJDFormStepType, string> = {
  [ArxJDFormStepType.UploadJD]: 'Upload JD',
  [ArxJDFormStepType.JobDetails]: 'Job Details',
  [ArxJDFormStepType.ChatConfiguration]: 'Chat Configuration',
  [ArxJDFormStepType.VideoInterview]: 'Video Interview',
  [ArxJDFormStepType.MeetingScheduling]: 'Meeting Scheduling',
};

export type ArxJDStepBarProps = {
  activeStep: number;
  parsedJD: ParsedJD | null;
  isEditMode?: boolean;
};

export const ArxJDStepBar = ({ activeStep, parsedJD, isEditMode = false }: ArxJDStepBarProps) => {
  const theme = useTheme();

  // Generate steps based on selected chat flow options
  const getAvailableSteps = () => {
    // Always include Upload JD step, regardless of edit mode
    const steps = [ArxJDFormStepType.UploadJD];

    // Add Job Details and Chat Configuration steps
    steps.push(ArxJDFormStepType.JobDetails);
    steps.push(ArxJDFormStepType.ChatConfiguration);

    // Add conditional steps if configuration allows
    if (parsedJD !== null) {
      // Add VideoInterview step if selected
      if (parsedJD.chatFlow.order.videoInterview) {
        steps.push(ArxJDFormStepType.VideoInterview);
      }

      // Add MeetingScheduling step if selected
      if (parsedJD.chatFlow.order.meetingScheduling) {
        steps.push(ArxJDFormStepType.MeetingScheduling);
      }
    }

    return steps;
  };

  const availableSteps = getAvailableSteps();

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
        // We no longer need special handling for edit mode since we're including the upload step
        const isActive = index <= activeStep;
        const isNextStep = activeStep + 1 === index;
        const isLast = index === availableSteps.length - 1;

        return (
          <StyledStepContainer key={stepType} isLast={isLast}>
            <StyledStepCircle
              variants={variantsCircle}
              animate={isActive ? 'active' : 'inactive'}
              isNextStep={isNextStep}
            >
              {isActive ? (
                <span style={{ color: theme.grayScale.gray0 }}>✓</span>
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

import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconInfoCircle } from 'twenty-ui/icon';
import React, { useEffect } from 'react';
import { MenuItemSelect } from 'twenty-ui/navigation';
import { type FormComponentProps } from '../types/FormComponentProps';
import { type ParsedJD } from '../types/ParsedJD';
import {
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader
} from './ArxJDUploadModal.styled';

const StyledHeaderContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledIconContainer = styled.div`
  align-items: center;
  cursor: help;
  display: inline-flex;
  margin-top: -10px;
  position: relative;

  &:hover::after {
    background-color: ${themeCssVariables.background.primary};
    border-radius: ${themeCssVariables.border.radius.sm};
    box-shadow: ${themeCssVariables.boxShadow.light};
    color: ${themeCssVariables.font.color.primary};
    content: 'This information helps the AI agent understand your preferred recruitment process flow and customize interactions accordingly.';
    font-size: ${themeCssVariables.font.size.sm};
    left: 24px;
    max-width: 250px;
    padding: ${themeCssVariables.spacing[2]};
    position: absolute;
    top: -10px;
    transform: translateY(-100%);
    width: max-content;
    z-index: 1000;
  }
`;

const StyledMenuItemContainer = styled.div`
  position: relative;

  &:hover::after {
    background-color: ${themeCssVariables.background.primary};
    border-radius: ${themeCssVariables.border.radius.sm};
    bottom: 100%;
    box-shadow: ${themeCssVariables.boxShadow.light};
    color: ${themeCssVariables.font.color.primary};
    content: attr(data-tooltip);
    font-size: ${themeCssVariables.font.size.sm};
    left: 50%;
    margin-bottom: ${themeCssVariables.spacing[2]};
    max-width: 300px;
    padding: ${themeCssVariables.spacing[2]};
    position: absolute;
    transform: translateX(-50%);
    width: max-content;
    z-index: 1000;
  }
`;

export const ChatFlowSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  useEffect(() => {
    if (!parsedJD || parsedJD.chatFlow.order.initialChat) {
      return;
    }

    setParsedJD({
      ...parsedJD,
      chatFlow: {
        ...parsedJD.chatFlow,
        order: {
          ...parsedJD.chatFlow.order,
          initialChat: true,
        },
      },
    } as ParsedJD);
  }, [parsedJD, setParsedJD]);

  if (!parsedJD) {
    return null;
  }

  const handleChatFlowOrderChange = (selectedId: string) => {
    // Prevent deselecting initialChat
    if (selectedId === 'initialChat') {
      return;
    }

    const newOrder = {
      ...parsedJD.chatFlow.order,
      [selectedId]:
        !parsedJD.chatFlow.order[
          selectedId as keyof typeof parsedJD.chatFlow.order
        ],
    };

    // If videoInterview is being turned off and meetingScheduling is on,
    // we need to handle the step navigation properly
    if (
      selectedId === 'videoInterview' &&
      !newOrder.videoInterview &&
      newOrder.meetingScheduling
    ) {
      // Ensure we can still navigate to meeting scheduling
      setParsedJD({
        ...parsedJD,
        chatFlow: {
          ...parsedJD.chatFlow,
          order: newOrder,
        },
      } as ParsedJD);
    }
    // If meetingScheduling is being turned off and videoInterview is on,
    // we need to handle the step navigation properly
    else if (
      selectedId === 'meetingScheduling' &&
      !newOrder.meetingScheduling &&
      newOrder.videoInterview
    ) {
      // Ensure we can still navigate to video interview
      setParsedJD({
        ...parsedJD,
        chatFlow: {
          ...parsedJD.chatFlow,
          order: newOrder,
        },
      } as ParsedJD);
    }
    // Normal case
    else {
      setParsedJD({
        ...parsedJD,
        chatFlow: {
          ...parsedJD.chatFlow,
          order: newOrder,
        },
      } as ParsedJD);
    }
  };

  return (
    <StyledSection>
      <StyledHeaderContainer>
        <StyledSectionHeader>Choose your process</StyledSectionHeader>
        <StyledIconContainer>
          <IconInfoCircle size={14} />
        </StyledIconContainer>
      </StyledHeaderContainer>
      <StyledSectionContent>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <StyledMenuItemContainer
            data-tooltip="Initial conversation to understand candidate's background, interest, and basic qualifications"
          >
            <MenuItemSelect
              selected={true}
              onClick={() => {}}
              text="Initial Whatsapp/ Linkedin Chat (Required)"
            />
          </StyledMenuItemContainer>
          <StyledMenuItemContainer
            data-tooltip="One-way video interview where candidates can record their responses to specific questions"
          >
            <MenuItemSelect
              selected={parsedJD.chatFlow.order.videoInterview}
              onClick={() => handleChatFlowOrderChange('videoInterview')}
              text="Video Interview"
            />
          </StyledMenuItemContainer>
          <StyledMenuItemContainer
            data-tooltip="Automated scheduling of interviews or follow-up conversations based on availability"
          >
            <MenuItemSelect
              selected={parsedJD.chatFlow.order.meetingScheduling}
              onClick={() => handleChatFlowOrderChange('meetingScheduling')}
              text="Scheduling"
            />
          </StyledMenuItemContainer>
        </div>
      </StyledSectionContent>
    </StyledSection>
  );
};

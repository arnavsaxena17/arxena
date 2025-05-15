import styled from '@emotion/styled';
import { IconInfoCircle } from '@tabler/icons-react';
import React, { useEffect } from 'react';
import { MenuItemSelect } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader
} from './ArxJDUploadModal.styled';

const StyledHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledIconContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  margin-top: -10px;

  &:hover::after {
    content: 'This information helps the AI agent understand your preferred recruitment process flow and customize interactions accordingly.';
    position: absolute;
    top: -10px;
    left: 24px;
    transform: translateY(-100%);
    background-color: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
    padding: ${({ theme }) => theme.spacing(2)};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    box-shadow: ${({ theme }) => theme.boxShadow.light};
    width: max-content;
    max-width: 250px;
    z-index: 1000;
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

const StyledMenuItemContainer = styled.div`
  position: relative;

  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%);
    background-color: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
    padding: ${({ theme }) => theme.spacing(2)};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    box-shadow: ${({ theme }) => theme.boxShadow.light};
    width: max-content;
    max-width: 300px;
    z-index: 1000;
    margin-bottom: ${({ theme }) => theme.spacing(2)};
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

export const ChatFlowSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  // Ensure initialChat is always selected when component mounts
  useEffect(() => {
    if (!parsedJD.chatFlow.order.initialChat) {
      setParsedJD({
        ...parsedJD,
        chatFlow: {
          ...parsedJD.chatFlow,
          order: {
            ...parsedJD.chatFlow.order,
            initialChat: true,
          },
        },
      });
    }
  }, [parsedJD, setParsedJD]);

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
      });
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
      });
    }
    // Normal case
    else {
      setParsedJD({
        ...parsedJD,
        chatFlow: {
          ...parsedJD.chatFlow,
          order: newOrder,
        },
      });
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

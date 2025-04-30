import React, { useEffect } from 'react';
import { MenuItemSelect } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader
} from './ArxJDUploadModal.styled';

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
      <StyledSectionHeader>Select your candidate engagement process</StyledSectionHeader>
      <StyledSectionContent>
        {/* <StyledLabel>Chat Flow Order</StyledLabel> */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <MenuItemSelect
            selected={true} // Always selected
            onClick={() => {}} // No-op function since we don't allow toggling
            text="Initial Whatsapp/ Linkedin Chat (Required)"
          />
          <MenuItemSelect
            selected={parsedJD.chatFlow.order.videoInterview}
            onClick={() => handleChatFlowOrderChange('videoInterview')}
            text="Video Interview"
          />
          <MenuItemSelect
            selected={parsedJD.chatFlow.order.meetingScheduling}
            onClick={() => handleChatFlowOrderChange('meetingScheduling')}
            text="Meeting Scheduling"
          />
        </div>
      </StyledSectionContent>
    </StyledSection>
  );
};

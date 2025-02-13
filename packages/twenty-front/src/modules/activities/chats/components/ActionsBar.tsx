// src/components/ActionsBar.tsx
import React from 'react';
import styled from '@emotion/styled';
import { IconX, IconUsers, IconMessages, IconFileText, IconList, IconRefresh } from '@tabler/icons-react';

const ActionsBarContainer = styled.div`
  position: fixed;
  bottom: 0;
//   left: 0;
//   width: 100%;
  background-color: white;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #e5e7eb;
  transform: translateY(100%);
  transition: transform 0.2s ease;
  z-index: 1000;

  &[data-visible='true'] {
    transform: translateY(0);
  }
`;

const SelectionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background-color: #f9fafb;
  border-radius: 6px;
  
  > div {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #4b5563;
    font-size: 14px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background-color: #f3f4f6;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  
  ${props => props.$variant === 'primary' ? `
    background-color: #4f46e5;
    color: white;
    
    &:hover {
      background-color: #4338ca;
    }
  ` : `
    background-color: #f3f4f6;
    color: #374151;
    
    &:hover {
      background-color: #e5e7eb;
    }
  `}
`;

interface ActionsBarProps {
  selectedIds: string[];
  clearSelection: () => void;
  handleViewChats: () => void;
  handleViewCVs: () => void;
  createChatBasedShortlistDelivery: () => Promise<void>;
  createUpdateCandidateStatus: () => Promise<void>;
  createCandidateShortlists: () => Promise<void>;
}

const ActionsBar: React.FC<ActionsBarProps> = ({
  selectedIds,
  clearSelection,
  handleViewChats,
  handleViewCVs,
  createChatBasedShortlistDelivery,
  createUpdateCandidateStatus,
  createCandidateShortlists
}) => {
  return (
    <ActionsBarContainer data-visible={selectedIds.length > 0}>
      <SelectionInfo>
        <div>
          <IconUsers size={18} />
          {selectedIds.length} {selectedIds.length === 1 ? 'person' : 'people'} selected
        </div>
        <CloseButton onClick={clearSelection}>
          <IconX size={18} />
        </CloseButton>
      </SelectionInfo>

      <ActionButtons>
        <ActionButton $variant="primary" onClick={handleViewChats}>
          <IconMessages size={18} />
          View Chats
        </ActionButton>
        <ActionButton $variant="primary" onClick={handleViewCVs}>
          <IconFileText size={18} />
          View CVs
        </ActionButton>
        <ActionButton $variant="secondary" onClick={createChatBasedShortlistDelivery}>
          <IconList size={18} />
          Create Chat Based Shortlist
        </ActionButton>
        <ActionButton $variant="secondary" onClick={createUpdateCandidateStatus}>
          <IconRefresh size={18} />
          Update Candidate Status
        </ActionButton>
        <ActionButton $variant="secondary" onClick={createCandidateShortlists}>
          <IconList size={18} />
          Create Candidate Shortlist
        </ActionButton>
      </ActionButtons>
    </ActionsBarContainer>
  );
};

export default ActionsBar;
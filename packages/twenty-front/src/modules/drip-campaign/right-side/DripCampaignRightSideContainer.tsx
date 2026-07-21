import { IconMail, IconMinus, IconSettings, IconX } from 'twenty-ui/icons';
import {
  activeDripCampaignState,
  dripCampaignsState,
  isDripCampaignModalMinimizedState
} from '@/drip-campaign/states/dripCampaignModalOpenState';
import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

import { EmailSequenceManager } from '../components/EmailSequenceManager';

const StyledFormElement = styled.form<{ isMinimized?: boolean }>`
  display: flex;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  flex-grow: 1;
  flex-direction: ${({ isMinimized }) => isMinimized ? 'row' : 'column'};
  overflow-y: ${({ isMinimized }) => isMinimized ? 'hidden' : 'auto'};
  scroll-behavior: smooth;  
  position: relative;
  left: -80px;
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-start'};
  justify-content: ${({ isMinimized }) => isMinimized ? 'space-between' : 'flex-start'};
`;

const StyledAllContainer = styled.div<{ isMinimized?: boolean }>`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  left: -200px;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  padding: ${({ isMinimized }) => isMinimized ? '0 16px' : '44px 32px 44px 32px'};
  width: ${({ isMinimized }) => isMinimized ? '100%' : 'calc(100% * (6 / 6))'};
  min-width: ${({ isMinimized }) => isMinimized ? 'auto' : '264px'};
  flex-shrink: 1;
  height: ${({ isMinimized }) => isMinimized ? '60px' : 'auto'};
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-end'};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 24px;
`;

const StyledTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const StyledEditableTitle = styled.input`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  background: none;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 4px;
  padding: 4px 8px;
  margin: 0;
  outline: none;
  flex: 1;
  min-width: 200px;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue60};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid ${({ theme, variant }) => 
    variant === 'primary' ? theme.color.blue60 : 
    variant === 'danger' ? theme.color.red60 : 
    theme.border.color.medium};
  background-color: ${({ theme, variant }) => 
    variant === 'primary' ? theme.color.blue60 : 
    variant === 'danger' ? theme.color.red60 : 
    theme.background.primary};
  color: ${({ theme, variant }) => 
    variant === 'primary' || variant === 'danger' ? 
    theme.font.color.inverted : 
    theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const StyledMinimizeButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledTabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  margin-bottom: 24px;
`;

const StyledTab = styled.button<{ isActive: boolean }>`
  background: none;
  border: none;
  padding: 12px 24px;
  border-bottom: 2px solid ${({ theme, isActive }) => 
    isActive ? theme.color.blue60 : 'transparent'};
  color: ${({ theme, isActive }) => 
    isActive ? theme.color.blue60 : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    color: ${({ theme }) => theme.color.blue60};
  }
`;

const StyledContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

interface DripCampaignRightSideContainerProps {
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
  onRefresh?: () => void;
}

export const DripCampaignRightSideContainer: React.FC<DripCampaignRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId,
  onRefresh
}) => {
  const [activeCampaign, setActiveCampaign] = useRecoilState(activeDripCampaignState);
  const [campaigns, setCampaigns] = useRecoilState(dripCampaignsState);
  const [isMinimized, setIsMinimized] = useRecoilState(isDripCampaignModalMinimizedState);
  const [activeTab, setActiveTab] = useState<'sequences' | 'metrics'>('sequences');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleDoubleClick = () => {
    if (!activeCampaign) return;
    setEditedTitle(activeCampaign.name || '');
    setIsEditingTitle(true);
  };

  const handleSaveEdit = () => {
    if (!activeCampaign || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }
    
    const updatedCampaign = { ...activeCampaign, name: editedTitle.trim() };
    setActiveCampaign(updatedCampaign);
    setCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === activeCampaign.id ? updatedCampaign : campaign
      )
    );
    setIsEditingTitle(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditedTitle('');
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle click outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditingTitle && titleInputRef.current && !titleInputRef.current.contains(event.target as Node)) {
        handleSaveEdit();
      }
    };

    if (isEditingTitle) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditingTitle, editedTitle, activeCampaign]);

  const handleSaveCampaign = () => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    // TODO: Implement save campaign logic
    setTimeout(() => {
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === activeCampaign.id 
            ? { ...activeCampaign, updatedAt: new Date().toISOString() }
            : campaign
        )
      );
      setIsLoading(false);
    }, 1000);
  };

  const handleStartCampaign = () => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    // TODO: Implement start campaign logic
    setTimeout(() => {
      setActiveCampaign(prev => prev ? { ...prev, isActive: true } : null);
      setIsLoading(false);
    }, 1000);
  };

  const handlePauseCampaign = () => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    // TODO: Implement pause campaign logic
    setTimeout(() => {
      setActiveCampaign(prev => prev ? { ...prev, isActive: false } : null);
      setIsLoading(false);
    }, 1000);
  };

  if (!activeCampaign) {
    return (
      <StyledAllContainer isMinimized={isMinimized}>
        <StyledFormElement isMinimized={isMinimized}>
          <StyledHeader>
            <StyledTitle>No Campaign Selected</StyledTitle>
            <StyledButtonGroup>
              <StyledMinimizeButton onClick={handleToggleMinimize}>
                <IconMinus size={16} />
              </StyledMinimizeButton>
              <StyledCloseButton onClick={closeModal}>
                <IconX size={16} />
              </StyledCloseButton>
            </StyledButtonGroup>
          </StyledHeader>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
            Select a campaign from the left panel or create a new one to get started.
          </div>
        </StyledFormElement>
      </StyledAllContainer>
    );
  }

  return (
    <StyledAllContainer isMinimized={isMinimized}>
      <StyledFormElement isMinimized={isMinimized}>
        <StyledHeader>
          <StyledTitleContainer>
            {isEditingTitle ? (
              <StyledEditableTitle
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Edit campaign"
              />
            ) : (
              <StyledTitle onDoubleClick={handleDoubleClick} style={{ cursor: 'pointer' }}>
                {activeCampaign.name || 'Untitled Campaign'}
              </StyledTitle>
            )}
          </StyledTitleContainer>
          <StyledButtonGroup>
            {activeCampaign.isActive ? (
              <StyledButton variant="secondary" onClick={handlePauseCampaign} disabled={isLoading}>
                ⏸️ Pause
              </StyledButton>
            ) : (
              <StyledButton variant="primary" onClick={handleStartCampaign} disabled={isLoading}>
                ▶️ Start
              </StyledButton>
            )}
            <StyledButton variant="secondary" onClick={handleSaveCampaign} disabled={isLoading}>
              <IconSettings size={16} />
              Save
            </StyledButton>
            <StyledMinimizeButton onClick={handleToggleMinimize}>
              <IconMinus size={16} />
            </StyledMinimizeButton>
            <StyledCloseButton onClick={closeModal}>
              <IconX size={16} />
            </StyledCloseButton>
          </StyledButtonGroup>
        </StyledHeader>

        {!isMinimized && (
          <>
            <StyledTabContainer>
              <StyledTab 
                isActive={activeTab === 'sequences'} 
                onClick={() => setActiveTab('sequences')}
              >
                <IconMail size={16} />
                Email Sequences
              </StyledTab>
              <StyledTab 
                isActive={activeTab === 'metrics'} 
                onClick={() => setActiveTab('metrics')}
              >
                📊 Metrics
              </StyledTab>
            </StyledTabContainer>

            <StyledContent>
              {activeTab === 'sequences' ? (
                <EmailSequenceManager 
                  campaign={activeCampaign}
                  onCampaignUpdate={setActiveCampaign}
                />
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  <h3>Campaign Metrics</h3>
                  <p>Metrics dashboard will be implemented here</p>
                  <p>Track email opens, clicks, replies, and more</p>
                </div>
              )}
            </StyledContent>
          </>
        )}
      </StyledFormElement>
    </StyledAllContainer>
  );
};

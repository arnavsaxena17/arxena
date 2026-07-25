import { Toggle } from 'twenty-ui';
import { IconAlertCircle, IconDotsVertical, IconFile, IconTrash, IconUpload, IconX } from 'twenty-ui/icon';
import type { AssistantThreadSummary } from '@/arx-jd-upload/types/ParsedJD';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useRef, useState } from 'react';
import { LinkedInSearchType } from '@/candidate-search/types/candidate-search.types';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.primary};
`;

const StyledHeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
`;

const StyledCurrentFilterBadge = styled.div`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.strong};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDropdownContainer = styled.div`
  position: relative;
`;

const StyledMenuButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.strong};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledStopButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.color.red};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.color.red};
  color: ${themeCssVariables.font.color.inverted};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${themeCssVariables.color.red5};
    border-color: ${themeCssVariables.color.red5};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledMenuDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${themeCssVariables.spacing[1]});
  right: 0;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 220px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
`;

const StyledMenuSection = styled.div`
  padding: ${themeCssVariables.spacing[1]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  
  &:last-child {
    border-bottom: none;
  }
`;

const StyledMenuSectionTitle = styled.div`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StyledMenuAction = styled.button<{ danger?: boolean; active?: boolean }>`
  width: 100%;
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  border: none;
  background-color: ${({ active }) => active ? themeCssVariables.background.transparent.light : 'transparent'};
  text-align: left;
  color: ${({ danger }) => danger ? themeCssVariables.color.red : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['1.5']};
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: ${themeCssVariables.background.secondary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledStatusItem = styled.div<{ warning?: boolean; maxed?: boolean }>`
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${({ warning, maxed }) => {
    if (maxed) return themeCssVariables.color.red;
    if (warning) return themeCssVariables.color.orange;
    return themeCssVariables.font.color.secondary;
  }};
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledJDBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['1.5']};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  cursor: default;
`;

const StyledJDName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
`;

const StyledJDToggleSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding-left: ${themeCssVariables.spacing['1.5']};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
`;

type ChatHeaderProps = {
  title?: string;
  onClearChat?: () => void;
  assistantThreads?: AssistantThreadSummary[];
  currentAssistantThreadId?: string;
  onAssistantThreadSelect?: (assistantThreadId: string) => void;
  onJDRemove?: () => Promise<void>;
  onJDReplace?: () => void;
  hasJD?: boolean;
  isUploading?: boolean;
  parsedJD?: ParsedJD | null;
  jdFileName?: string;
  includeJD?: boolean;
  onIncludeJDChange?: (include: boolean) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  searchType?: LinkedInSearchType;
  onSearchTypeChange?: (searchType: LinkedInSearchType) => void;
};

export const ChatHeader = ({ 
  title = 'Arx Search Assistant', 
  onClearChat,
  assistantThreads = [] as AssistantThreadSummary[],
  currentAssistantThreadId,
  onAssistantThreadSelect,
  onJDRemove,
  onJDReplace,
  hasJD = false,
  isUploading = false,
  parsedJD,
  jdFileName,
  includeJD = true,
  onIncludeJDChange,
  isStreaming = false,
  onStopStreaming,
  searchType = 'classic',
  onSearchTypeChange,
}: ChatHeaderProps) => {
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [linkedInStatus, setLinkedInStatus] = useState<{
    count: number;
    limit: number;
    remaining: number;
    warningThreshold: number;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const tokenPair = useAtomStateValue(tokenPairState);

  // Fetch LinkedIn request status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoadingStatus(true);
        const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/candidate-search/linkedin-request-status`, {
          headers: { 
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`, 
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setLinkedInStatus({
              count: data.count,
              limit: data.limit,
              remaining: data.remaining,
              warningThreshold: data.warningThreshold,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching LinkedIn request status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchStatus();
  }, [tokenPair]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target as Node)) {
        setIsMenuDropdownOpen(false);
      }
    };

    if (isMenuDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuDropdownOpen]);

  const handleAssistantThreadClick = (assistantThreadId: string) => {
    if (onAssistantThreadSelect) {
      onAssistantThreadSelect(assistantThreadId);
    }
    setIsMenuDropdownOpen(false);
  };

  const handleSearchTypeClick = (newSearchType: LinkedInSearchType) => {
    if (onSearchTypeChange) {
      onSearchTypeChange(newSearchType);
    }
    setIsMenuDropdownOpen(false);
  };

  const handleJDRemoveClick = async () => {
    if (onJDRemove) {
      await onJDRemove();
    }
    setIsMenuDropdownOpen(false);
  };

  const handleJDReplaceClick = () => {
    if (onJDReplace) {
      onJDReplace();
    }
    setIsMenuDropdownOpen(false);
  };

  const handleClearChatClick = () => {
    if (onClearChat) {
      onClearChat();
    }
    setIsMenuDropdownOpen(false);
  };

  // Find the current filter to display its name
  const currentAssistantThread = assistantThreads.find(f => f.id === currentAssistantThreadId);
  const currentAssistantThreadName = currentAssistantThread?.name || 'No assistant thread selected';
  const isLinkedInWarning = linkedInStatus ? linkedInStatus.count >= linkedInStatus.warningThreshold : false;
  const isLinkedInMaxed = linkedInStatus ? linkedInStatus.count >= linkedInStatus.limit : false;

  // Get JD display name
  const getJDDisplayName = () => {
    if (jdFileName) {
      return jdFileName.length > 25 ? `${jdFileName.substring(0, 22)}...` : jdFileName;
    }
    if (parsedJD?.name) {
      const displayName = parsedJD.jobCode 
        ? `${parsedJD.jobCode} - ${parsedJD.name}`
        : parsedJD.name;
      return displayName.length > 25 ? `${displayName.substring(0, 22)}...` : displayName;
    }
    return 'Project Description';
  };

  return (
    <StyledPanelHeader>
      <StyledHeaderContent>
        {/* <StyledPanelTitle>{title}</StyledPanelTitle> */}
        {parsedJD && (
          <StyledJDBadge title={jdFileName || parsedJD.name || 'Project Description'}>
            <IconFile size={14} />
            <StyledJDName>{getJDDisplayName()}</StyledJDName>
            {onIncludeJDChange && (
              <StyledJDToggleSection>
                {/* <span>Include</span> */}
                <Toggle value={includeJD} onChange={onIncludeJDChange} />
              </StyledJDToggleSection>
            )}
          </StyledJDBadge>
        )}
        {/* {currentAssistantThreadId && (
          <StyledCurrentFilterBadge title={currentFilterId}>
            {currentFilterId.slice(0, 10)}...
          </StyledCurrentFilterBadge>
        )} */}
      </StyledHeaderContent>
      <StyledHeaderActions>
        {isStreaming && onStopStreaming && (
          <StyledStopButton
            onClick={onStopStreaming}
            title="Stop streaming"
          >
            <IconX size={16} />
            Stop
          </StyledStopButton>
        )}
        {onClearChat && (
          <StyledClearButton
            onClick={handleClearChatClick}
            title="Clear chat"
          >
            <IconX size={16} />
            Clear
          </StyledClearButton>
        )}
        <StyledDropdownContainer ref={menuDropdownRef}>
          <StyledMenuButton
            onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
            title="More options"
          >
            <IconDotsVertical size={16} />
          </StyledMenuButton>
          {isMenuDropdownOpen && (
            <StyledMenuDropdown>
              {linkedInStatus && (
                <StyledMenuSection>
                  <StyledStatusItem warning={isLinkedInWarning} maxed={isLinkedInMaxed}>
                    <IconAlertCircle size={16} />
                    <span>
                      LinkedIn: {linkedInStatus.count}/{linkedInStatus.limit} today
                      {isLinkedInMaxed && ' (Limit reached)'}
                      {isLinkedInWarning && !isLinkedInMaxed && ' (Warning)'}
                    </span>
                  </StyledStatusItem>
                </StyledMenuSection>
              )}
              {onSearchTypeChange && (
                <StyledMenuSection>
                  <StyledMenuSectionTitle>Search Type</StyledMenuSectionTitle>
                  <StyledMenuAction 
                    onClick={() => handleSearchTypeClick('classic')} 
                    active={searchType === 'classic'}
                  >
                    Classic
                  </StyledMenuAction>
                  <StyledMenuAction 
                    onClick={() => handleSearchTypeClick('sales_navigator')} 
                    active={searchType === 'sales_navigator'}
                  >
                    Sales Navigator
                  </StyledMenuAction>
                  <StyledMenuAction 
                    onClick={() => handleSearchTypeClick('recruiter')} 
                    active={searchType === 'recruiter'}
                  >
                    Recruiter
                  </StyledMenuAction>
                </StyledMenuSection>
              )}
              {assistantThreads.length > 0 && (
                <StyledMenuSection>
                  <StyledMenuSectionTitle>Assistant Threads</StyledMenuSectionTitle>
                  {assistantThreads.map((assistantThread) => (
                    <StyledMenuAction
                      key={assistantThread.id}
                      onClick={() => handleAssistantThreadClick(assistantThread.id)}
                      active={assistantThread.id === currentAssistantThreadId}
                    >
                      {assistantThread.name || `Assistant Thread ${assistantThread.id.slice(0, 8)}`}
                    </StyledMenuAction>
                  ))}
                </StyledMenuSection>
              )}
              {hasJD && (
                <StyledMenuSection>
                  <StyledMenuSectionTitle>Project Description</StyledMenuSectionTitle>
                  <StyledMenuAction onClick={handleJDReplaceClick} disabled={isUploading}>
                    <IconUpload size={16} />
                    Replace JD
                  </StyledMenuAction>
                  <StyledMenuAction onClick={handleJDRemoveClick} disabled={isUploading} danger>
                    <IconTrash size={16} />
                    Remove JD
                  </StyledMenuAction>
                </StyledMenuSection>
              )}
              {onClearChat && (
                <StyledMenuSection>
                  <StyledMenuAction onClick={handleClearChatClick}>
                    <IconX size={16} />
                    Clear Chat
                  </StyledMenuAction>
                </StyledMenuSection>
              )}
            </StyledMenuDropdown>
          )}
        </StyledDropdownContainer>
      </StyledHeaderActions>
    </StyledPanelHeader>
  );
};

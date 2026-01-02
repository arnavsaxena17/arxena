import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconAlertCircle, IconDotsVertical, IconFile, IconHistory, IconTrash, IconUpload, IconX, Toggle } from 'twenty-ui';

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.primary};
`;

const StyledHeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledCurrentFilterBadge = styled.div`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledDropdownContainer = styled.div`
  position: relative;
`;

const StyledHistoryButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
`;

const StyledDropdownItem = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border: none;
  background-color: transparent;
  text-align: left;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  }
`;

const StyledDropdownItemName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledDropdownItemInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledMenuButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledMenuDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 220px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
`;

const StyledMenuSection = styled.div`
  padding: ${({ theme }) => theme.spacing(1)} 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  
  &:last-child {
    border-bottom: none;
  }
`;

const StyledMenuSectionTitle = styled.div`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StyledMenuAction = styled.button<{ danger?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border: none;
  background-color: transparent;
  text-align: left;
  color: ${({ theme, danger }) => danger ? theme.color.red : theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledStatusItem = styled.div<{ warning?: boolean; maxed?: boolean }>`
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme, warning, maxed }) => {
    if (maxed) return theme.color.red;
    if (warning) return theme.color.orange;
    return theme.font.color.secondary;
  }};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledJDBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
`;

const StyledJDToggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.transparent.light};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

type SearchFilter = {
  id: string;
  name: string;
  searchFilterName?: string | null;
};

type ChatHeaderProps = {
  title?: string;
  onClearChat?: () => void;
  searchFilters?: SearchFilter[];
  currentSearchFilterId?: string;
  onSearchFilterSelect?: (searchFilterId: string) => void;
  onJDRemove?: () => Promise<void>;
  onJDReplace?: () => void;
  hasJD?: boolean;
  isUploading?: boolean;
  parsedJD?: ParsedJD | null;
  jdFileName?: string;
  includeJD?: boolean;
  onIncludeJDChange?: (include: boolean) => void;
};

export const ChatHeader = ({ 
  title = 'Arx Search Assistant', 
  onClearChat,
  searchFilters = [],
  currentSearchFilterId,
  onSearchFilterSelect,
  onJDRemove,
  onJDReplace,
  hasJD = false,
  isUploading = false,
  parsedJD,
  jdFileName,
  includeJD = true,
  onIncludeJDChange,
}: ChatHeaderProps) => {
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [linkedInStatus, setLinkedInStatus] = useState<{
    count: number;
    limit: number;
    remaining: number;
    warningThreshold: number;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const tokenPair = useRecoilValue(tokenPairState);

  // Fetch LinkedIn request status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoadingStatus(true);
        const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/linkedin-request-status`, {
          headers: { 
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 
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
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setIsHistoryDropdownOpen(false);
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target as Node)) {
        setIsMenuDropdownOpen(false);
      }
    };

    if (isHistoryDropdownOpen || isMenuDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isHistoryDropdownOpen, isMenuDropdownOpen]);

  const handleSearchFilterClick = (searchFilterId: string) => {
    if (onSearchFilterSelect) {
      onSearchFilterSelect(searchFilterId);
    }
    setIsHistoryDropdownOpen(false);
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
  const currentFilter = searchFilters.find(f => f.id === currentSearchFilterId);
  const currentFilterId = currentFilter?.id || 'No filter selected';
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
    return 'Job Description';
  };

  return (
    <StyledPanelHeader>
      <StyledHeaderContent>
        {/* <StyledPanelTitle>{title}</StyledPanelTitle> */}
        {parsedJD && (
          <>
            <StyledJDBadge title={jdFileName || parsedJD.name || 'Job Description'}>
              <IconFile size={14} />
              <span>{getJDDisplayName()}</span>
            </StyledJDBadge>
            {onIncludeJDChange && (
              <StyledJDToggle>
                <span>Include JD:</span>
                <Toggle value={includeJD} onChange={onIncludeJDChange} />
              </StyledJDToggle>
            )}
          </>
        )}
        {/* {currentSearchFilterId && (
          <StyledCurrentFilterBadge title={currentFilterId}>
            {currentFilterId.slice(0, 10)}...
          </StyledCurrentFilterBadge>
        )} */}
      </StyledHeaderContent>
      <StyledHeaderActions>
        {searchFilters.length > 0 && (
          <StyledDropdownContainer ref={historyDropdownRef}>
            <StyledHistoryButton
              onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
              title="Search filter history"
            >
              <IconHistory size={16} />
              History
            </StyledHistoryButton>
            {isHistoryDropdownOpen && (
              <StyledDropdown>
                {searchFilters.map((filter) => (
                  <StyledDropdownItem
                    key={filter.id}
                    onClick={() => handleSearchFilterClick(filter.id)}
                    style={{
                      backgroundColor: filter.id === currentSearchFilterId 
                        ? 'rgba(0, 0, 0, 0.05)' 
                        : 'transparent'
                    }}
                  >
                    <StyledDropdownItemName>
                      {filter.searchFilterName || filter.name || `Filter ${filter.id.slice(0, 8)}`}
                    </StyledDropdownItemName>
                    <StyledDropdownItemInfo>
                      ID: {filter.id.slice(0, 20)}...
                    </StyledDropdownItemInfo>
                  </StyledDropdownItem>
                ))}
              </StyledDropdown>
            )}
          </StyledDropdownContainer>
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
              {hasJD && (
                <StyledMenuSection>
                  <StyledMenuSectionTitle>Job Description</StyledMenuSectionTitle>
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

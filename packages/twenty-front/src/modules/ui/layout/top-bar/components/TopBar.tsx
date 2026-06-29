import { arxUploadJDModalModeState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { CandidateSearchModal } from '@/candidate-search/components/search-components/CandidateSearchModal';
import { isCandidateSearchModalOpenState } from '@/candidate-search/states/candidateSearchModalState';
import { searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { columnsSelector, jobIdAtom, jobsState, tableStateAtom } from '@/candidate-table/states/states';
import { DripCampaignModal } from '@/drip-campaign/dripCampaignModal';
import { currentJobIdForDripState, isDripCampaignModalOpenState } from '@/drip-campaign/states/dripCampaignModalOpenState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import styled from '@emotion/styled';
import { memo, ReactNode, useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { AppTooltip, Button, IconArrowsVertical, IconBriefcase, IconChartCandle, IconCheck, IconDatabase, IconExternalLink, IconFileImport, IconFilterCog, IconMail, IconMessage, IconRefresh, IconSearch, IconTrash, IconX, TooltipDelay } from 'twenty-ui';

// Debug logging utility
const DEBUG_LOGS = false;
const debugLog = (...args: any[]) => { if (DEBUG_LOGS) console.log(...args); };

type TopBarProps = {
  className?: string;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bottomComponent?: ReactNode;
  displayBottomBorder?: boolean;
  showRefetch?:boolean;
  handleRefresh?: () => void;
  showVideoInterviewEdit?:boolean;
  handleVideoInterviewEdit?: () => void;
  showAddJob?:boolean;
  handleAddJob?: () => void;
  handleEngagement?: () => void;
  showEnrichment?:boolean;
  handleEnrichment?: () => void;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
  handleValidateJobData?: () => void;
  showValidateJobData?: boolean;
  handleImportCandidates?: () => void;
  showImportCandidates?: boolean;
  handleStatistics?: () => void;
  showStatistics?: boolean;
  // Job status toggle props
  isJobActive?: boolean;
  onJobStatusToggle?: () => void;
  showJobStatusToggle?: boolean;
  // Drip campaign props
  handleDripCampaign?: () => void;
  showDripCampaign?: boolean;
  // Candidate search props
  showCandidateSearch?: boolean;
  // Redirect to object page props
  handleRedirectToObject?: () => void;
  showRedirectToObject?: boolean;
  // Filter management props
  onRemoveFilter?: (columnIndex: number) => void;
  onClearAllFilters?: () => void;
  showFilterChips?: boolean;
  // Sorting props
  handleSorting?: () => void;
  showSorting?: boolean;
  // Batch action bar props
  selectedCandidates?: any[];
  onSelectAll?: () => void;
  onSelectTop?: (count: number) => void;
  onSelectFiltered?: () => void;
  onSaveSelected?: (candidates: any[]) => void;
  onDiscardAll?: () => void;
  onLoadMore?: (pages?: number) => Promise<void>;
  showBatchActions?: boolean;
  // Clear all functionality
  onClearAll?: () => void;
  showClearAll?: boolean;
};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  display: flex;
  margin-left: ${({ theme }) => theme.spacing(2)};
  position: relative;
  flex-direction: column;
  /* Above page header (20), below right drawer (30) so tooltips are visible */
  z-index: 25;
`;

const StyledTopBar = styled.div`
  align-items: center;
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: row;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  height: 48px;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(2)};
  min-height: 48px;
  z-index: 1;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledLeftSection = styled.div`
  display: flex;
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

const StyledCenterButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(0.5)};
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const StyledRightButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(0.5)};
  flex-shrink: 0;
`;

const StyledSearchContainer = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  width: 180px;
  flex-shrink: 0;
`;

const StyledSearchInput = styled.input`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  width: 100%;
  height: 28px;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledIconContainer = styled.div`
  position: absolute;
  left: ${({ theme }) => theme.spacing(0.5)};
  color: ${({ theme }) => theme.font.color.light};
  top: 50%;
  transform: translateY(-50%);
`;

const StyledSortContainer = styled.div`
  display: flex;
  align-items: center;
  margin-right: ${({ theme }) => theme.spacing(2)};
  z-index: 1;
  position: relative;
`;

const StyledJobStatusToggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  height: 28px;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    border-color: ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledToggleLabel = styled.span<{ isActive: boolean }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ isActive, theme }) => 
    isActive ? theme.font.color.primary  : theme.font.color.tertiary};
  transition: color 0.2s ease-in-out;
`;

const StyledToggleSwitch = styled.div<{ isActive: boolean }>`
  width: 32px;
  height: 16px;
  background-color: ${({ isActive, theme }) => 
    isActive ? theme.font.color.primary : theme.background.tertiary};
  border-radius: 8px;
  position: relative;
  transition: background-color 0.2s ease-in-out;

  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: ${({ isActive }) => isActive ? '17px' : '1px'};
    width: 14px;
    height: 14px;
    background-color: ${({ theme }) => theme.background.primary};
    border-radius: 50%;
    transition: left 0.2s ease-in-out;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
`;

const StyledCompactButton = styled(Button)`
  min-width: 28px !important;
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  
  & > span {
    display: none !important;
  }
`;

// Inline components for single-row layout
const StyledInlineSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-wrap: wrap;
`;

const StyledInlineFilterChip = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.primary};
  height: 24px;
`;

const StyledInlineBatchInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  height: 24px;
`;

const StyledInlineButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;
  height: 24px;
  
  ${({ variant, theme }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.background.secondary};
          color: ${theme.font.color.primary};
          border-color: ${theme.border.color.medium};
          
          &:hover {
            background-color: ${theme.background.tertiary};
            border-color: ${theme.border.color.strong};
          }
        `;
      case 'danger':
        return `
          background-color: ${theme.background.secondary};
          color: ${theme.font.color.danger};
          border-color: ${theme.border.color.danger};
          
          &:hover {
            background-color: ${theme.background.tertiary};
            border-color: ${theme.border.color.danger};
          }
        `;
      default:
        return `
          background-color: ${theme.background.secondary};
          color: ${theme.font.color.secondary};
          border-color: ${theme.border.color.light};
          
          &:hover {
            background-color: ${theme.background.tertiary};
            border-color: ${theme.border.color.medium};
            color: ${theme.font.color.primary};
          }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: ${({ theme }) => theme.font.color.extraLight};
  }
`;

const StyledTooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

// Tooltip component using AppTooltip
const TooltipButton = ({ 
  children, 
  title, 
  ...props 
}: { 
  children: ReactNode; 
  title: string; 
  [key: string]: any;
}) => {
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <>
      <StyledTooltipContainer
        id={tooltipId}
        {...props}
      >
        {children}
      </StyledTooltipContainer>
      <AppTooltip
        anchorSelect={`#${tooltipId}`}
        content={title}
        place="top"
        delay={TooltipDelay.shortDelay}
        noArrow={false}
        positionStrategy="fixed"
      />
    </>
  );
};

// const showRefetch = true;

export const TopBar = memo(({
  className,
  leftComponent,
  rightComponent,
  bottomComponent,
  handleRefresh,
  handleVideoInterviewEdit,
  showRefetch=true,
  handleAddJob,
  showAddJob=true,
  handleEngagement,
  // handleImportCandidates,
  showEnrichment=true,
  showVideoInterviewEdit=true,
  handleEnrichment,
  onSearch,
  showSearch=false,
  handleValidateJobData,
  showValidateJobData=true,
  handleImportCandidates,
  showImportCandidates=true,
  handleStatistics,
  showStatistics=true,
  // Job status toggle props
  isJobActive=true,
  onJobStatusToggle,
  showJobStatusToggle=false,
  // Drip campaign props
  handleDripCampaign,
  showDripCampaign=true,
  // Candidate search props
  showCandidateSearch=true,
  // Redirect to object page props
  handleRedirectToObject,
  showRedirectToObject=true,
  // Filter management props
  onRemoveFilter,
  onClearAllFilters,
  showFilterChips=true,
  // Sorting props
  handleSorting,
  showSorting=true,
  // Batch action bar props
  selectedCandidates=[],
  onSelectAll,
  onSelectTop,
  onSelectFiltered,
  onSaveSelected,
  onDiscardAll,
  onLoadMore,
  showBatchActions=false,
  // Clear all functionality
  onClearAll,
  showClearAll=true
}: TopBarProps) => {
  const location = useLocation();
  const isJobPage = location.pathname.includes('/job/') || location.pathname.includes('/jobs/');
  const [searchQuery, setSearchQuery] = useRecoilState(chatSearchQueryState);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  const [, setIsDripCampaignModalOpen] = useRecoilState(isDripCampaignModalOpenState);
  const [, setCurrentJobIdForDrip] = useRecoilState(currentJobIdForDripState);
  const [, setIsCandidateSearchModalOpen] = useRecoilState(isCandidateSearchModalOpenState);
  const [, setArxUploadJDModalMode] = useRecoilState(arxUploadJDModalModeState);
  
  // Batch action state
  const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useRecoilState(searchMetadataState);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Get jobId from jobsState
  const currentJobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  const isOrgChartEnabled = useRecoilValue(isOrgChartEnabledState);
  const tableState = useRecoilValue(tableStateAtom);
  const columns = useRecoilValue(columnsSelector);
  
  // Find the current job from jobsState
  const currentJob = useMemo(() => {
    if (!currentJobId || !jobs.length) return null;
    return jobs.find(job => job.id === currentJobId);
  }, [currentJobId, jobs]);

  const { objectMetadataItems } = useObjectMetadataItems();
  const { enqueueSnackBar } = useSnackBar();
  const candidateObjectExists = objectMetadataItems.some(
    item => item.nameSingular === 'candidate' && item.isActive
  );

  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  const handleImportCandidatesClick = useCallback(() => {
    if (handleImportCandidates) {
      handleImportCandidates();
    } else {
      if (!candidateObjectExists) {
        enqueueSnackBar(
          'Candidate object not found. Please contact support to set up the required objects.',
          {
            variant: SnackBarVariant.Error,
          }
        );
        return;
      }
      openObjectRecordsSpreasheetImportDialog();
    }
  }, [handleImportCandidates, candidateObjectExists, enqueueSnackBar, openObjectRecordsSpreasheetImportDialog]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleSearchChange');
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  }, [onSearch, setSearchQuery]);

  const handleDripCampaignClick = useCallback(() => {
    debugLog('handleDripCampaignClick');
    debugLog('currentJobId', currentJobId);
    if (handleDripCampaign) {
      debugLog('handleDripCampaign');
      handleDripCampaign();
    } else if (currentJobId) {
      setCurrentJobIdForDrip(currentJobId);
      setIsDripCampaignModalOpen(true);
    }
  }, [handleDripCampaign, currentJobId, setCurrentJobIdForDrip, setIsDripCampaignModalOpen]);

  const handleCandidateSearchClick = useCallback(() => {
    console.log('handleCandidateSearchClick');
    debugLog('handleCandidateSearchClick');
    setIsCandidateSearchModalOpen(true);
  }, [setIsCandidateSearchModalOpen]);

  // Batch action handlers - using callbacks from parent component

  const handleLoadMore = useCallback(async (pagesToLoad: number = 1) => {
    if (!onLoadMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await onLoadMore(pagesToLoad);
    } catch (error) {
      console.error('Error loading more candidates:', error);
      enqueueSnackBar('Failed to load more candidates. Please try again.', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [onLoadMore, isLoadingMore, enqueueSnackBar]);

  // Check if there are more candidates to load
  const hasMoreCandidates = !!searchMetadata.cursor && searchMetadata.currentPage < searchMetadata.totalPages;

  return (
    <StyledContainer className={className}>
      <StyledTopBar>
        {/* Left Section - Search and Job Status */}
        <StyledInlineSection>
          {isJobPage && showSearch && (
            <StyledSearchContainer>
              <StyledIconContainer>
                <IconSearch size={12} />
              </StyledIconContainer>
              <StyledSearchInput
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </StyledSearchContainer>
          )}
          
          {isJobPage && showJobStatusToggle && onJobStatusToggle && (
            <StyledJobStatusToggle onClick={onJobStatusToggle}>
              <IconBriefcase size={12} />
              <StyledToggleLabel isActive={isJobActive}>
                {isJobActive ? 'Active' : 'Inactive'}
              </StyledToggleLabel>
              <StyledToggleSwitch isActive={isJobActive} />
            </StyledJobStatusToggle>
          )}
        </StyledInlineSection>

        {/* Center Section - Filter Chips and Batch Info */}
        <StyledInlineSection>
          {/* Inline Filter Chips */}
          {isJobPage && showFilterChips && tableState.activeFilters && tableState.activeFilters.length > 0 && (
            <>
              {tableState.activeFilters.map((filter, index) => (
                <StyledInlineFilterChip key={index}>
                  <span>{columns[filter.column]?.title || 'Filter'}: {filter.conditions[0]?.args?.[0] || 'Active'}</span>
                  <IconX 
                    size={10} 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => onRemoveFilter?.(filter.column)}
                  />
                </StyledInlineFilterChip>
              ))}
              <StyledInlineButton onClick={onClearAllFilters}>
                Clear All
              </StyledInlineButton>
            </>
          )}

          {/* Inline Batch Action Info */}
          {showBatchActions && searchResults.length > 0 && (
            <StyledInlineBatchInfo>
              {searchResults.length} fetched • {selectedCandidates.length} selected
            </StyledInlineBatchInfo>
          )}
        </StyledInlineSection>

        {/* Right Section - Action Buttons */}
        <StyledInlineSection>
          {/* Refresh Button */}
          {showRefetch && (
            <TooltipButton title="Refresh">
              <StyledCompactButton
                Icon={IconRefresh}
                variant="secondary"
                accent="default"
                onClick={handleRefresh}
              />
            </TooltipButton>
          )}

          {/* Clear All Button */}
          {showClearAll && onClearAll && (
            <TooltipButton title="Clear All Filters & Sorts">
              <StyledCompactButton
                Icon={IconX}
                variant="secondary"
                accent="default"
                onClick={onClearAll}
              />
            </TooltipButton>
          )}

          {/* Action Buttons */}
          {isJobPage && (
            <>
              {showRedirectToObject && handleRedirectToObject && (
                <TooltipButton title="View Job Object">
                  <StyledCompactButton
                    Icon={IconExternalLink}
                    variant="secondary"
                    accent="default"
                    onClick={handleRedirectToObject}
                  />
                </TooltipButton>
              )}
              {showImportCandidates && (
                <TooltipButton title="Import Candidates">
                  <StyledCompactButton
                    Icon={IconFileImport}
                    variant="secondary"
                    accent="default"
                    onClick={handleImportCandidatesClick}
                  />
                </TooltipButton>
              )}
              {showStatistics && handleStatistics && (
                <TooltipButton title="Job Statistics">
                  <StyledCompactButton
                    Icon={IconChartCandle}
                    variant="secondary"
                    accent="default"
                    onClick={handleStatistics}
                  />
                </TooltipButton>
              )}
              <TooltipButton title="Bulk Messages">
                <StyledCompactButton
                  Icon={IconMessage}
                  variant="secondary"
                  accent="default"
                  onClick={() => setIsBulkMessageModalOpen(true)}
                />
              </TooltipButton>
              {showAddJob && (
                <>
   
                  {/* Modify Job Details button - always opens in edit mode */}
                  {handleEngagement && (
                    <TooltipButton title="Modify Job Details">
                      <StyledCompactButton
                        Icon={IconBriefcase}
                        variant="secondary"
                        accent="default"
                        onClick={() => {
                          setArxUploadJDModalMode('edit');
                          requestAnimationFrame(() => {
                            handleEngagement();
                          });
                        }}
                      />
                    </TooltipButton>
                  )}
                </>
              )}
              {showEnrichment && (
                <TooltipButton title="AI Filtering">
                  <StyledCompactButton
                    Icon={IconFilterCog}
                    variant="secondary"
                    accent="default"
                    onClick={handleEnrichment}
                  />
                </TooltipButton>
              )}
              {showDripCampaign && (
                <TooltipButton title="Drip Campaigns">
                  <StyledCompactButton
                    Icon={IconMail}
                    variant="secondary"
                    accent="default"
                    onClick={handleDripCampaignClick}
                  />
                </TooltipButton>
              )}
              {/* {showCandidateSearch && (
                <TooltipButton title="Search Candidates">
                  <StyledCompactButton
                    Icon={IconSearch}
                    variant="secondary"
                    accent="default"
                    onClick={handleCandidateSearchClick}
                  />
                </TooltipButton>
              )} */}
              {showSorting && handleSorting && (
                <TooltipButton title="Multi-Column Sorting">
                  <StyledCompactButton
                    Icon={IconArrowsVertical}
                    variant="secondary"
                    accent="default"
                    onClick={handleSorting}
                  />
                </TooltipButton>
              )}
              {showValidateJobData && handleValidateJobData && (
                <TooltipButton title="Validate Job Data">
                  <StyledCompactButton
                    Icon={IconCheck}
                    variant="secondary"
                    accent="default"
                    onClick={handleValidateJobData}
                  />
                </TooltipButton>
              )}
            </>
          )}

          {/* Batch Action Buttons */}
          {showBatchActions && searchResults.length > 0 && (
            <>
              {onSelectAll && (
                <StyledInlineButton onClick={onSelectAll}>
                  <IconCheck size={10} />
                  All
                </StyledInlineButton>
              )}
              {onSelectTop && (
                <StyledInlineButton onClick={() => onSelectTop(20)}>
                  Top 20
                </StyledInlineButton>
              )}
              <StyledInlineButton 
                variant="primary" 
                onClick={() => onSaveSelected?.(selectedCandidates)}
                disabled={isSaving || selectedCandidates.length === 0}
              >
                <IconDatabase size={10} />
                {isSaving ? 'Saving...' : 'Save'}
              </StyledInlineButton>
              <StyledInlineButton variant="danger" onClick={onDiscardAll}>
                <IconTrash size={10} />
                Discard
              </StyledInlineButton>
            </>
          )}

          {/* Pagination Controls */}
          {showBatchActions && hasMoreCandidates && (
            <>
              {isLoadingMore ? (
                <StyledInlineBatchInfo>
                  <IconRefresh size={10} />
                  Loading...
                </StyledInlineBatchInfo>
              ) : (
                <>
                  <StyledInlineButton onClick={() => handleLoadMore(1)}>
                    <IconRefresh size={10} />
                    Next
                  </StyledInlineButton>
                  <StyledInlineButton onClick={() => handleLoadMore(3)}>
                    +3
                  </StyledInlineButton>
                  <StyledInlineButton onClick={() => handleLoadMore(5)}>
                    +5
                  </StyledInlineButton>
                </>
              )}
            </>
          )}

          {/* Right Component for non-job pages */}
          {!isJobPage && !showSearch && (!location.pathname.includes('jobs') || location.pathname.includes('objects')) && rightComponent}
        </StyledInlineSection>
      </StyledTopBar>
      
      {bottomComponent}
      {isBulkMessageModalOpen && (
        <BulkMessageModal />
      )}
      {!isOrgChartEnabled && <CandidateSearchModal />}
      {currentJobId && (
        <DripCampaignModal
          objectNameSingular="Job"
          objectRecordId={currentJobId}
          onRefresh={handleRefresh}
        />
      )}
    </StyledContainer>
  );
});
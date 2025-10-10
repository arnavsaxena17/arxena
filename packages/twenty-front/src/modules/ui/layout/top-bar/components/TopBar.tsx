import { CandidateSearchModal } from '@/candidate-search/components/search-components/CandidateSearchModal';
import { isCandidateSearchModalOpenState } from '@/candidate-search/states/candidateSearchModalState';
import { CustomSortDropdown } from '@/candidate-table/components/CustomSortDropdown';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { DripCampaignModal } from '@/drip-campaign/dripCampaignModal';
import { currentJobIdForDripState, isDripCampaignModalOpenState } from '@/drip-campaign/states/dripCampaignModalOpenState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import styled from '@emotion/styled';
import { ReactNode, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Button, IconBriefcase, IconChartCandle, IconCheck, IconFileImport, IconFilterCog, IconMail, IconMessage, IconRefresh, IconSearch } from 'twenty-ui';

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
  showSorting?: boolean;
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
};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  display: flex;
  margin-left: ${({ theme }) => theme.spacing(2)};
  position: relative;
  flex-direction: column;
  z-index: 20;
`;

const StyledTopBar = styled.div`
  align-items: center;
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: row;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  height: 39px;
  justify-content: space-between;
  padding-right: ${({ theme }) => theme.spacing(2)};
  min-height: 39px;
  z-index: 20;
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
  width: 200px;
  margin-right: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
`;

const StyledSearchInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  padding-left: ${({ theme }) => theme.spacing(8)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledIconContainer = styled.div`
  position: absolute;
  left: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.light};
`;

const StyledSortContainer = styled.div`
  display: flex;
  align-items: center;
  margin-right: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
  position: relative;
`;

const StyledJobStatusToggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-right: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    border-color: ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledToggleLabel = styled.span<{ isActive: boolean }>`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ isActive, theme }) => 
    isActive ? theme.font.color.primary  : theme.font.color.tertiary};
  transition: color 0.2s ease-in-out;
`;

const StyledToggleSwitch = styled.div<{ isActive: boolean }>`
  width: 40px;
  height: 20px;
  background-color: ${({ isActive, theme }) => 
    isActive ? theme.font.color.primary : theme.background.tertiary};
  border-radius: 10px;
  position: relative;
  transition: background-color 0.2s ease-in-out;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${({ isActive }) => isActive ? '22px' : '2px'};
    width: 16px;
    height: 16px;
    background-color: ${({ theme }) => theme.background.primary};
    border-radius: 50%;
    transition: left 0.2s ease-in-out;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
`;

const StyledCompactButton = styled(Button)`
  min-width: 32px !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  
  & > span {
    display: none !important;
  }
`;

const StyledTooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledTooltip = styled.div<{ show: boolean }>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: ${({ theme }) => theme.color.gray80};
  color: ${({ theme }) => theme.color.gray10};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  white-space: nowrap;
  z-index: 1000;
  opacity: ${({ show }) => show ? 1 : 0};
  visibility: ${({ show }) => show ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
  pointer-events: none;
  margin-top: ${({ theme }) => theme.spacing(1)};
  
  &::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-bottom-color: ${({ theme }) => theme.color.gray80};
  }
`;

// Tooltip component
const TooltipButton = ({ 
  children, 
  title, 
  ...props 
}: { 
  children: ReactNode; 
  title: string; 
  [key: string]: any;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <StyledTooltipContainer
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      <StyledTooltip show={showTooltip}>
        {title}
      </StyledTooltip>
    </StyledTooltipContainer>
  );
};

// const showRefetch = true;

export const TopBar = ({
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
  showSorting=false,
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
  showCandidateSearch=true
}: TopBarProps) => {
  const location = useLocation();
  const isJobPage = location.pathname.includes('/job/') || location.pathname.includes('/jobs/');
  const [searchQuery, setSearchQuery] = useRecoilState(chatSearchQueryState);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  const [, setIsDripCampaignModalOpen] = useRecoilState(isDripCampaignModalOpenState);
  const [, setCurrentJobIdForDrip] = useRecoilState(currentJobIdForDripState);
  const [, setIsCandidateSearchModalOpen] = useRecoilState(isCandidateSearchModalOpenState);
  
  // Get jobId from jobsState
  const currentJobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  
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

  const handleImportCandidatesClick = () => {
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
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleDripCampaignClick = () => {
    console.log('handleDripCampaignClick');
    console.log('currentJobId', currentJobId);
    if (handleDripCampaign) {
      console.log('handleDripCampaign');
      handleDripCampaign();
    } else if (currentJobId) {
      setCurrentJobIdForDrip(currentJobId);
      setIsDripCampaignModalOpen(true);
    }
  };

  const handleCandidateSearchClick = () => {
    console.log('handleCandidateSearchClick');
      setIsCandidateSearchModalOpen(true);
  };

  return (
    <StyledContainer className={className}>
      <StyledTopBar>
        {!isJobPage && !showSearch && (
            <StyledLeftSection>{leftComponent}</StyledLeftSection>
        )}
        {!isJobPage && !showSearch && (!location.pathname.includes('jobs') || location.pathname.includes('objects')) && (
          <StyledCenterButtonContainer>
            {showRefetch && (
              <TooltipButton title="Refetch">
                <StyledCompactButton
                  Icon={IconRefresh}
                  variant="secondary"
                  accent="default"
                  onClick={handleRefresh}
                />
              </TooltipButton>
            )}
          </StyledCenterButtonContainer>
        )}

        
        {(isJobPage && showSearch) && (
          <>
            <StyledSearchContainer>
              <StyledIconContainer>
                <IconSearch size={15} />
            </StyledIconContainer>
              <StyledSearchInput
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </StyledSearchContainer>
            {showSorting && (
              <StyledSortContainer>
                <CustomSortDropdown />
              </StyledSortContainer>
            )}
            {showJobStatusToggle && onJobStatusToggle && (
              <StyledJobStatusToggle onClick={onJobStatusToggle}>
                <IconBriefcase size={16} />
                <StyledToggleLabel isActive={isJobActive}>
                  {isJobActive ? 'Active' : 'Inactive'}
                </StyledToggleLabel>
                <StyledToggleSwitch isActive={isJobActive} />
              </StyledJobStatusToggle>
            )}
            <StyledCenterButtonContainer>
              {isJobPage && showRefetch && (
                <TooltipButton title="Refresh">
                  <StyledCompactButton
                    Icon={IconRefresh}
                    variant="secondary"
                    accent="default"
                    onClick={handleRefresh}
                  />
                </TooltipButton>
              )}
            </StyledCenterButtonContainer>
            <StyledRightButtonContainer>
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
                <TooltipButton title="Modify Job Details">
                  <StyledCompactButton
                    Icon={IconBriefcase}
                    variant="secondary"
                    accent="default"
                    onClick={handleEngagement || handleAddJob}
                  />
                </TooltipButton>
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
              {showCandidateSearch && (
                <TooltipButton title="Search Candidates">
                  <StyledCompactButton
                    Icon={IconSearch}
                    variant="secondary"
                    accent="default"
                    onClick={handleCandidateSearchClick}
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
            </StyledRightButtonContainer>
          </>
        )}

        {!isJobPage && !showSearch && (!location.pathname.includes('jobs') || location.pathname.includes('objects'))  && <StyledRightSection>{rightComponent}</StyledRightSection>}
      </StyledTopBar>
      {bottomComponent}
      {isBulkMessageModalOpen && (
        <BulkMessageModal />
      )}
      <CandidateSearchModal />
      {currentJobId && (
        <DripCampaignModal
          objectNameSingular="Job"
          objectRecordId={currentJobId}
          onRefresh={handleRefresh}
        />
      )}
    </StyledContainer>
  );
};

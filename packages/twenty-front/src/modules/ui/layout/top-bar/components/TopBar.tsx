import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { CustomSortDropdown } from '@/candidate-table/components/CustomSortDropdown';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { Button, IconChartCandle, IconDatabase, IconFileImport, IconMail, IconMessage, IconRefresh, IconSearch } from 'twenty-ui';

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
  gap: ${({ theme }) => theme.spacing(1)};
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const StyledRightButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
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
  showStatistics=true
}: TopBarProps) => {
  const location = useLocation();
  const isJobPage = location.pathname.includes('/job/') || location.pathname.includes('/jobs/');
  const [searchQuery, setSearchQuery] = useRecoilState(chatSearchQueryState);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);
  const [, setArxUploadJDModalMode] = useRecoilState(arxUploadJDModalModeState);

  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  const handleImportCandidatesClick = () => {
    if (handleImportCandidates) {
      handleImportCandidates();
    } else {
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

  return (
    <StyledContainer className={className}>
      <StyledTopBar>
        {!isJobPage && !showSearch && (
            <StyledLeftSection>{leftComponent}</StyledLeftSection>
        )}
        {!isJobPage && !showSearch && (!location.pathname.includes('jobs') || location.pathname.includes('objects')) && (
          <StyledCenterButtonContainer>
            {showRefetch && (
              <Button
                Icon={IconRefresh}
                title="Refetch"
                variant="secondary"
                accent="default"
                onClick={handleRefresh}
              />
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
            <StyledCenterButtonContainer>
              {isJobPage && showRefetch && (
                <Button
                  Icon={IconRefresh}
                  title="Refresh"
                  variant="secondary"
                  accent="default"
                  onClick={handleRefresh}
                />
              )}
            </StyledCenterButtonContainer>
            <StyledRightButtonContainer>
              {showImportCandidates && (
                <Button
                  Icon={IconFileImport}
                  title="Import Candidates"
                  variant="secondary"
                  accent="default"
                  onClick={handleImportCandidatesClick}
                />
              )}
              {showStatistics && handleStatistics && (
                <Button
                  Icon={IconChartCandle}
                  title="Job Statistics"
                  variant="secondary"
                  accent="default"
                  onClick={handleStatistics}
                />
              )}
              <Button
                Icon={IconMessage}
                title="Bulk Messages"
                variant="secondary"
                accent="default"
                onClick={() => setIsBulkMessageModalOpen(true)}
              />
              {showAddJob && (
                <Button
                  Icon={IconMail}
                  title="Modify Job Details" 
                  variant="secondary"
                  accent="default"
                  onClick={handleEngagement || handleAddJob}
                />
              )}
              {showEnrichment && (
                <Button
                  Icon={IconDatabase}
                  title="AI Filtering" 
                  variant="secondary"
                  accent="default"
                  onClick={handleEnrichment}
                />
              )}
              {showValidateJobData && handleValidateJobData && (
                <Button
                  Icon={IconDatabase}
                  title="Validate Job Data" 
                  variant="secondary"
                  accent="default"
                  onClick={handleValidateJobData}
                />
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
    </StyledContainer>
  );
};

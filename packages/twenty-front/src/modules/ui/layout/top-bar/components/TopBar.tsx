import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { Button, IconDatabase, IconMail, IconRefresh, IconSearch } from 'twenty-ui';

type TopBarProps = {
  className?: string;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bottomComponent?: ReactNode;
  displayBottomBorder?: boolean;
  showRefetch?:boolean;
  handleRefresh?: () => void;
  showVideoInterviewEdit?:boolean;
  handleImportCandidates?: () => void;
  handleVideoInterviewEdit?: () => void;
  showEngagement?:boolean;
  handleEngagement?: () => void;
  showEnrichment?:boolean;
  handleEnrichment?: () => void;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  display: flex;
  margin-left: ${({ theme }) => theme.spacing(2)};
  position: relative;
  flex-direction: column;
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
  z-index: 7;
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
`;

const StyledRightButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-left: auto;
`;

const StyledSearchContainer = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  width: 15%;
  margin-right: ${({ theme }) => theme.spacing(2)};
`;

const StyledSearchInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  padding-left: ${({ theme }) => theme.spacing(8)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  width: 130%;
  
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

// const showRefetch = true;

export const TopBar = ({
  className,
  leftComponent,
  rightComponent,
  bottomComponent,
  handleRefresh,
  handleVideoInterviewEdit,
  showRefetch=true,
  showEngagement=true,
  // handleImportCandidates,
  showEnrichment=true,
  showVideoInterviewEdit=true,
  handleEnrichment,
  handleEngagement,
  onSearch,
  showSearch=false
}: TopBarProps) => {
  const location = useLocation();
  const isJobPage = location.pathname.includes('/job/') || location.pathname.includes('/jobs/');
  const [searchQuery, setSearchQuery] = useRecoilState(chatSearchQueryState);

  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');



  const handleImportCandidates = () => {
    openObjectRecordsSpreasheetImportDialog();
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
              {showEngagement && (
                <Button
                  Icon={IconMail}
                  title="Engagement" 
                  variant="secondary"
                  accent="default"
                  onClick={handleEngagement}
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
            </StyledRightButtonContainer>
          </>
        )}

        {!isJobPage && !showSearch && (!location.pathname.includes('jobs') || location.pathname.includes('objects'))  && <StyledRightSection>{rightComponent}</StyledRightSection>}
      </StyledTopBar>
      {bottomComponent}
    </StyledContainer>
  );
};

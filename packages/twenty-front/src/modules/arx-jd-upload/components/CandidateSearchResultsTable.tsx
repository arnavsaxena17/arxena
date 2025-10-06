import styled from '@emotion/styled';
import { useCallback, useMemo, useState } from 'react';
import { Button, IconChevronLeft, IconChevronRight, IconRefresh } from 'twenty-ui';
import { LinkedInSearchResult } from '../types/CandidateSearch';

type CandidateSearchResultsTableProps = {
  results: LinkedInSearchResult[];
  selectedCandidates: LinkedInSearchResult[];
  onSelectionChange: (candidates: LinkedInSearchResult[]) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onLoadMultiplePages?: (pages: number) => void;
  currentPage?: number;
  totalPages?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
};

const StyledTableContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledTableHeader = styled.thead`
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledTableHeaderCell = styled.th`
  padding: ${({ theme }) => theme.spacing(2)};
  text-align: left;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTableBody = styled.tbody``;

const StyledTableRow = styled.tr<{ isSelected: boolean }>`
  background-color: ${({ isSelected, theme }) => 
    isSelected ? theme.color.blue10 : theme.background.primary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  
  &:hover {
    background-color: ${({ isSelected, theme }) => 
      isSelected ? theme.color.blue20 : theme.background.secondary};
  }
`;

const StyledTableCell = styled.td`
  padding: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCheckbox = styled.input`
  margin: 0;
`;

const StyledProfileImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const StyledProfileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledProfileDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledHeadline = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-top: 2px;
`;

const StyledLocation = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledCompany = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledLoadMoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledPaginationInfo = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: center;
  flex-wrap: wrap;
`;

const StyledPageButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StyledEmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledLoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.secondary};
`;

export const CandidateSearchResultsTable = ({
  results,
  selectedCandidates,
  onSelectionChange,
  isLoading,
  hasMore,
  onLoadMore,
  onLoadMultiplePages,
  currentPage = 0,
  totalPages = 0,
  onPreviousPage,
  onNextPage,
}: CandidateSearchResultsTableProps) => {
  const [selectAll, setSelectAll] = useState(false);
  console.log('onNextPage::', onNextPage);

  // Deduplicate results to prevent duplicate keys
  const uniqueResults = useMemo(() => {
    const seen = new Set<string>();
    return results.filter(candidate => {
      if (seen.has(candidate.id)) {
        return false;
      }
      seen.add(candidate.id);
      return true;
    });
  }, [results]);

  const selectedIds = useMemo(() => 
    new Set(selectedCandidates.map(candidate => candidate.id)),
    [selectedCandidates]
  );

  const handleSelectCandidate = useCallback((candidate: LinkedInSearchResult, isSelected: boolean) => {
    if (isSelected) {
      onSelectionChange([...selectedCandidates, candidate]);
    } else {
      onSelectionChange(selectedCandidates.filter(c => c.id !== candidate.id));
    }
  }, [selectedCandidates, onSelectionChange]);

  const handleSelectAll = useCallback((isSelected: boolean) => {
    setSelectAll(isSelected);
    if (isSelected) {
      onSelectionChange([...selectedCandidates, ...uniqueResults.filter(r => !selectedIds.has(r.id))]);
    } else {
      onSelectionChange(selectedCandidates.filter(c => !uniqueResults.some(r => r.id === c.id)));
    }
  }, [selectedCandidates, uniqueResults, selectedIds, onSelectionChange]);

  const getCurrentPosition = (candidate: LinkedInSearchResult) => {
    if (candidate.current_positions && candidate.current_positions.length > 0) {
      const position = candidate.current_positions[0];
      return {
        company: position.company,
        role: position.role,
      };
    }
    return null;
  };

  if (uniqueResults.length === 0 && !isLoading) {
    return (
      <StyledEmptyState>
        No candidates found. Try adjusting your search parameters.
      </StyledEmptyState>
    );
  }

  return (
    <StyledTableContainer>
      <StyledTable>
        <StyledTableHeader>
          <tr>
            <StyledTableHeaderCell>
              <StyledCheckbox
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </StyledTableHeaderCell>
            <StyledTableHeaderCell>Profile</StyledTableHeaderCell>
            <StyledTableHeaderCell>Location</StyledTableHeaderCell>
            <StyledTableHeaderCell>Current Position</StyledTableHeaderCell>
            <StyledTableHeaderCell>Industry</StyledTableHeaderCell>
          </tr>
        </StyledTableHeader>
        <StyledTableBody>
          {uniqueResults.map((candidate) => {
            const isSelected = selectedIds.has(candidate.id);
            const currentPosition = getCurrentPosition(candidate);
            
            return (
              <StyledTableRow key={candidate.id} isSelected={isSelected}>
                <StyledTableCell>
                  <StyledCheckbox
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSelectCandidate(candidate, e.target.checked)}
                  />
                </StyledTableCell>
                <StyledTableCell>
                  <StyledProfileInfo>
                    {candidate.profile_picture_url && (
                      <StyledProfileImage
                        src={candidate.profile_picture_url}
                        alt={candidate.name || 'Profile'}
                      />
                    )}
                    <StyledProfileDetails>
                      <StyledName>{candidate.name || 'Unknown'}</StyledName>
                      {candidate.headline && (
                        <StyledHeadline>{candidate.headline}</StyledHeadline>
                      )}
                    </StyledProfileDetails>
                  </StyledProfileInfo>
                </StyledTableCell>
                <StyledTableCell>
                  <StyledLocation>{candidate.location || 'Not specified'}</StyledLocation>
                </StyledTableCell>
                <StyledTableCell>
                  {currentPosition ? (
                    <div>
                      <StyledCompany>{currentPosition.company}</StyledCompany>
                      <StyledHeadline>{currentPosition.role}</StyledHeadline>
                    </div>
                  ) : (
                    <StyledLocation>No current position</StyledLocation>
                  )}
                </StyledTableCell>
                <StyledTableCell>
                  <StyledLocation>{candidate.industry || 'Not specified'}</StyledLocation>
                </StyledTableCell>
              </StyledTableRow>
            );
          })}
        </StyledTableBody>
      </StyledTable>
      
      {isLoading && (
        <StyledLoadingState>
          <IconRefresh size={16} />
          <span style={{ marginLeft: '8px' }}>Loading more candidates...</span>
        </StyledLoadingState>
      )}
      
      {hasMore && !isLoading && (
        <StyledLoadMoreContainer>
          <StyledPaginationInfo>
            Showing {uniqueResults.length} candidates (Page {currentPage} of {totalPages})
          </StyledPaginationInfo>
          
          <StyledButtonGroup>
            {onPreviousPage && (
              <Button
                variant="secondary"
                onClick={onPreviousPage}
                Icon={IconChevronLeft}
                disabled={isLoading || currentPage <= 1}
              >
                Previous
              </Button>
            )}
            
            <Button
              variant="secondary"
              onClick={onLoadMore}
              Icon={IconRefresh}
              disabled={isLoading}
            >
              Load Next Page
            </Button>
            
            {onNextPage && (
              <Button
                variant="secondary"
                onClick={onNextPage}
                Icon={IconChevronRight}
                disabled={isLoading || currentPage >= totalPages}
              >
                Next
              </Button>
            )}
            
            {onLoadMultiplePages && (
              <>
                <StyledPageButton
                  onClick={() => onLoadMultiplePages(3)}
                  disabled={isLoading}
                >
                  Load 3 Pages
                </StyledPageButton>
                <StyledPageButton
                  onClick={() => onLoadMultiplePages(5)}
                  disabled={isLoading}
                >
                  Load 5 Pages
                </StyledPageButton>
                <StyledPageButton
                  onClick={() => onLoadMultiplePages(10)}
                  disabled={isLoading}
                >
                  Load 10 Pages
                </StyledPageButton>
              </>
            )}
          </StyledButtonGroup>
        </StyledLoadMoreContainer>
      )}
    </StyledTableContainer>
  );
};

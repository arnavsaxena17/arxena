import styled from '@emotion/styled';
import { useCallback, useMemo, useState } from 'react';
import { Button, IconRefresh } from 'twenty-ui';
import { LinkedInSearchResult } from '../types/CandidateSearch';

type CandidateSearchResultsTableProps = {
  results: LinkedInSearchResult[];
  selectedCandidates: LinkedInSearchResult[];
  onSelectionChange: (candidates: LinkedInSearchResult[]) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
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
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
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
}: CandidateSearchResultsTableProps) => {
  const [selectAll, setSelectAll] = useState(false);

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
      onSelectionChange([...selectedCandidates, ...results.filter(r => !selectedIds.has(r.id))]);
    } else {
      onSelectionChange(selectedCandidates.filter(c => !results.some(r => r.id === c.id)));
    }
  }, [selectedCandidates, results, selectedIds, onSelectionChange]);

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

  if (results.length === 0 && !isLoading) {
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
          {results.map((candidate) => {
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
          <Button
            variant="secondary"
            onClick={onLoadMore}
            Icon={IconRefresh}
          >
            Load More Candidates
          </Button>
        </StyledLoadMoreContainer>
      )}
    </StyledTableContainer>
  );
};

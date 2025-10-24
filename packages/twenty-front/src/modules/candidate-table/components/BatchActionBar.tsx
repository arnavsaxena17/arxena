import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { clearSearchResults, searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { IconCheck, IconDatabase, IconRefresh, IconTrash } from 'twenty-ui';

const StyledBatchActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  animation: slideDown 200ms ease;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const StyledCandidateCount = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSelectionControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPaginationSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: 0 0 ${({ theme }) => theme.border.radius.md} ${({ theme }) => theme.border.radius.md};
`;

const StyledPaginationInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledPaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPaginationButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledLoadMoreButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue80};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.color.blue20};
    border-color: ${({ theme }) => theme.color.blue30};
  }
`;

const StyledLoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

  const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${({ variant, theme }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.color.blue};
          color: white;
          border-color: ${theme.color.blue};
          
          &:hover {
            background-color: ${theme.color.blue60};
            border-color: ${theme.color.blue60};
          }
        `;
      case 'danger':
        return `
          background-color: ${theme.color.red};
          color: white;
          border-color: ${theme.color.red};
          
          &:hover {
            background-color: ${theme.color.red60};
            border-color: ${theme.color.red60};
          }
        `;
      default:
        return `
          background-color: ${theme.background.primary};
          color: ${theme.font.color.primary};
          
          &:hover {
            background-color: ${theme.background.secondary};
            border-color: ${theme.border.color.strong};
          }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

type BatchActionBarProps = {
  selectedCandidates: any[];
  onSelectAll?: () => void;
  onSelectTop?: (count: number) => void;
  onSelectFiltered?: () => void;
  onSaveSelected?: (candidates: any[]) => void;
  onDiscardAll?: () => void;
  onLoadMore?: (pages?: number) => Promise<void>;
  className?: string;
};

export const BatchActionBar = ({
  selectedCandidates,
  onSelectAll,
  onSelectTop,
  onSelectFiltered,
  onSaveSelected,
  onDiscardAll,
  onLoadMore,
  className
}: BatchActionBarProps) => {
  const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useRecoilState(searchMetadataState);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const parsedJD = useRecoilValue(parsedJDSelector);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const handleSaveSelected = useCallback(async () => {
    if (selectedCandidates.length === 0) {
      enqueueSnackBar('No candidates selected', {
        variant: SnackBarVariant.Warning,
      });
      return;
    }

    if (!parsedJD) {
      enqueueSnackBar('No job description available', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    setIsSaving(true);

    try {
      console.log('Saving selected candidates:', selectedCandidates.length);
      
      // Prepare the request body for upload-profiles endpoint
      const uploadRequestBody = {
        linkedin_search_results: selectedCandidates,
        data_source: 'linkedin_search',
        job_id: parsedJD.id || 'standalone_search',
        job_name: parsedJD.name,
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: parsedJD.id || 'standalone_search',
          name: parsedJD.name,
          company: parsedJD.companyName,
          location: parsedJD.jobLocation,
          recruiterId: currentWorkspaceMember?.id,
        },
        parsedJD: parsedJD,
      };

      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify(uploadRequestBody),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();

      if (uploadResult.status === 'ok' || uploadResult.status === 'success') {
        console.log(`Successfully saved ${selectedCandidates.length} candidates`);
        
        // Remove saved candidates from search results
        const savedIds = selectedCandidates.map(c => c.id);
        clearSearchResults(setSearchResults)();
        
        enqueueSnackBar(`Successfully saved ${selectedCandidates.length} candidates`, {
          variant: SnackBarVariant.Success,
        });
        
        // Call the callback if provided
        if (onSaveSelected) {
          onSaveSelected(selectedCandidates);
        }
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error saving candidates:', error);
      enqueueSnackBar('Failed to save candidates. Please try again.', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedCandidates, parsedJD, currentWorkspaceMember, tokenPair, setSearchResults, enqueueSnackBar, onSaveSelected]);

  const handleDiscardAll = useCallback(() => {
    if (searchResults.length === 0) {
      enqueueSnackBar('No candidates to discard', {
        variant: SnackBarVariant.Warning,
      });
      return;
    }

    if (window.confirm(`Are you sure you want to discard all ${searchResults.length} fetched candidates? This action cannot be undone.`)) {
      clearSearchResults(setSearchResults)();
      enqueueSnackBar(`Discarded ${searchResults.length} candidates`, {
        variant: SnackBarVariant.Success,
      });
      
      if (onDiscardAll) {
        onDiscardAll();
      }
    }
  }, [searchResults.length, setSearchResults, enqueueSnackBar, onDiscardAll]);

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

  // Don't render if no fetched candidates
  if (searchResults.length === 0) {
    return null;
  }

  return (
    <>
      <StyledBatchActionBar className={className}>
        <StyledCandidateCount>
          {searchResults.length} candidates fetched • {selectedCandidates.length} selected
        </StyledCandidateCount>

        <StyledSelectionControls>
          {onSelectAll && (
            <StyledButton onClick={onSelectAll}>
              <IconCheck size={14} />
              Select All
            </StyledButton>
          )}
          {onSelectTop && (
            <StyledButton onClick={() => onSelectTop(20)}>
              Select Top 20
            </StyledButton>
          )}
          {onSelectFiltered && (
            <StyledButton onClick={onSelectFiltered}>
              Select Filtered ({searchResults.length})
            </StyledButton>
          )}
        </StyledSelectionControls>

        <StyledActionButtons>
          <StyledButton 
            variant="primary" 
            onClick={handleSaveSelected}
            disabled={isSaving || selectedCandidates.length === 0}
          >
            <IconDatabase size={14} />
            {isSaving ? 'Saving...' : 'Save Selected to Database'}
          </StyledButton>
          <StyledButton variant="danger" onClick={handleDiscardAll}>
            <IconTrash size={14} />
            Discard All
          </StyledButton>
        </StyledActionButtons>
      </StyledBatchActionBar>

      {/* Pagination Section */}
      {hasMoreCandidates && (
        <StyledPaginationSection>
          <StyledPaginationInfo>
            Showing {searchResults.length} candidates • Page {searchMetadata.currentPage} of {searchMetadata.totalPages}
            {searchMetadata.totalCount > 0 && ` • ${searchMetadata.totalCount} total available`}
          </StyledPaginationInfo>
          
          <StyledPaginationControls>
            {isLoadingMore ? (
              <StyledLoadingIndicator>
                <IconRefresh size={14} />
                Loading more candidates...
              </StyledLoadingIndicator>
            ) : (
              <>
                <StyledLoadMoreButton onClick={() => handleLoadMore(1)}>
                  <IconRefresh size={14} />
                  Load Next Page
                </StyledLoadMoreButton>
                
                <StyledPaginationButton onClick={() => handleLoadMore(3)}>
                  Load 3 Pages
                </StyledPaginationButton>
                
                <StyledPaginationButton onClick={() => handleLoadMore(5)}>
                  Load 5 Pages
                </StyledPaginationButton>
                
                <StyledPaginationButton onClick={() => handleLoadMore(10)}>
                  Load 10 Pages
                </StyledPaginationButton>
              </>
            )}
          </StyledPaginationControls>
        </StyledPaginationSection>
      )}
    </>
  );
};

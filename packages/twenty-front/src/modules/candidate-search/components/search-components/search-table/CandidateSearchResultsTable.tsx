import { Button } from 'twenty-ui';
import { IconArrowUp, IconCalendar, IconChevronLeft, IconChevronRight, IconComment, IconExternalLink, IconEye, IconHeart, IconRefresh, IconSquare, IconTrash, IconUsers } from 'twenty-ui/icons';
import { LinkedInSearchResult } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  persistenceKey?: string;
  onResultsPersist?: (results: LinkedInSearchResult[]) => void;
  onClear?: () => void;
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
  padding: ${({ theme }) => theme.spacing(1)};
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
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledNetworkDistance = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
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

const StyledCompanyLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  object-fit: cover;
`;

const StyledJobInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledJobTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledJobCompany = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledJobMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledPostContent = styled.div`
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPostAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPostStats = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledStatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledCompanyInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledCompanyName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCompanyMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledBadge = styled.span<{ variant: 'success' | 'warning' | 'info' | 'default' }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  width: fit-content;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ variant, theme }) => {
    switch (variant) {
      case 'success': return theme.color.green10;
      case 'warning': return theme.color.orange10;
      case 'info': return theme.color.blue10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ variant, theme }) => {
    switch (variant) {
      case 'success': return theme.color.green80;
      case 'warning': return theme.color.orange80;
      case 'info': return theme.color.blue80;
      default: return theme.font.color.primary;
    }
  }};
`;

const StyledLinkButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.color.blue80};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(0.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue10};
  }
`;

const StyledTableHeaderActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTableTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledClearButton = styled(Button)`
  && {
    background-color: ${({ theme }) => theme.color.red10};
    color: ${({ theme }) => theme.color.red80};
    border: 1px solid ${({ theme }) => theme.color.red20};
    
    &:hover {
      background-color: ${({ theme }) => theme.color.red20};
      color: ${({ theme }) => theme.color.red80};
    }
  }
`;

// Column configuration based on result type
type ColumnConfig = {
  key: string;
  label: string;
  width?: string;
  render: (result: LinkedInSearchResult) => React.ReactNode;
};

const getColumnsForType = (type: 'PEOPLE' | 'COMPANY' | 'POST' | 'JOB', results: LinkedInSearchResult[]): ColumnConfig[] => {
  switch (type) {
    case 'PEOPLE':
      const columns: ColumnConfig[] = [
        {
          key: 'profile',
          label: 'Profile',
          width: '40%',
          render: (result) => (
            <StyledProfileInfo>
              <StyledProfileImage
                src={result.profile_picture_url || '/images/profiles/blank_linkedin_profile_photo.png'}
                alt={result.name || 'Profile'}
              />
              <StyledProfileDetails>
                <StyledName>
                  {result.name || 'Unknown'}
                  {result.network_distance && (
                    <StyledNetworkDistance>
                      • {result.network_distance.replace('DISTANCE_', '')}°
                    </StyledNetworkDistance>
                  )}
                </StyledName>
                {result.headline && (
                  <StyledHeadline>{result.headline}</StyledHeadline>
                )}
    
              </StyledProfileDetails>
            </StyledProfileInfo>
          ),
        },
        {
          key: 'location',
          label: 'Location',
          width: '15%',
          render: (result) => (
            <StyledLocation>{result.location || 'Not specified'}</StyledLocation>
          ),
        },
      ];

      // Only add current position column if any result has current position data
      const hasCurrentPosition = results.some(result => {
        const currentPosition = result.current_positions?.[0];
        return currentPosition?.company || currentPosition?.role || result.headline;
      });

      if (hasCurrentPosition) {
        columns.push({
          key: 'currentPosition',
          label: 'Current Position',
          width: '25%',
          render: (result) => {
            const currentPosition = result.current_positions?.[0];
            if (currentPosition) {
              return (
                <div>
                  <StyledCompany>{currentPosition.company}</StyledCompany>
                  <StyledHeadline>{currentPosition.role}</StyledHeadline>
                  {currentPosition.location && (
                    <StyledLocation>{currentPosition.location}</StyledLocation>
                  )}
                </div>
              );
            }
            
            // Parse headline for position info if current_positions is empty
            if (result.headline) {
              const headlineParts = result.headline.split(' at ');
              if (headlineParts.length === 2) {
                const jobTitle = headlineParts[0].trim();
                const companyName = headlineParts[1].trim();
                return (
                  <div>
                    <StyledHeadline>{jobTitle}</StyledHeadline>
                    <StyledCompany>{companyName}</StyledCompany>
                  </div>
                );
              }
              return <StyledHeadline>{result.headline}</StyledHeadline>;
            }
            
            return <StyledLocation>No current position</StyledLocation>;
          },
        });
      }
      const hasIndustry = results.some(result => result.industry);
      if (hasIndustry) {
        columns.push({
          key: 'industry',
          label: 'Industry',
          width: '15%',
          render: (result) => (
            <StyledLocation>{result.industry || 'Not specified'}</StyledLocation>
          ),
        });
      }
      columns.push({
        key: 'actions',
        label: 'Actions',
        width: '15%',
        render: (result) => (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {result.profile_url && (
              <StyledLinkButton
                onClick={() => window.open(result.profile_url, '_blank')}
                title="View Profile"
              >
                <IconExternalLink size={16} />
              </StyledLinkButton>
            )}
            {result.can_send_inmail && (
              <StyledBadge variant="success">InMail Available</StyledBadge>
            )}
          </div>
        ),
      });

      return columns;

    case 'COMPANY':
      const companyColumns: ColumnConfig[] = [
        {
          key: 'company',
          label: 'Company',
          width: '35%',
          render: (result) => (
            <StyledProfileInfo>
              <StyledCompanyLogo
                src={result.profile_picture_url || '/images/profiles/blank_linkedin_profile_photo.png'}
                alt={result.name || 'Company'}
              />
              <StyledCompanyInfo>
                <StyledCompanyName>{result.name || 'Unknown'}</StyledCompanyName>
                {result.summary && (
                  <StyledHeadline>{result.summary}</StyledHeadline>
                )}
              </StyledCompanyInfo>
            </StyledProfileInfo>
          ),
        },
      ];

      // Only add location column if any result has location data
      const hasLocation = results.some(result => result.location);
      if (hasLocation) {
        companyColumns.push({
          key: 'location',
          label: 'Location',
          width: '15%',
          render: (result) => (
            <StyledLocation>{result.location || 'Not specified'}</StyledLocation>
          ),
        });
      }

      // Only add industry column if any result has industry data
      const hasCompanyIndustry = results.some(result => result.industry);
      if (hasCompanyIndustry) {
        companyColumns.push({
          key: 'industry',
          label: 'Industry',
          width: '15%',
          render: (result) => (
            <StyledLocation>{result.industry || 'Not specified'}</StyledLocation>
          ),
        });
      }

      // Only add metrics column if any result has metrics data
      const hasMetrics = results.some(result => 
        result.headcount || result.followers_count || result.job_offers_count
      );
      if (hasMetrics) {
        companyColumns.push({
          key: 'metrics',
          label: 'Metrics',
          width: '20%',
          render: (result) => (
            <StyledCompanyMeta>
              {result.headcount && (
                <div>
                  <IconUsers size={12} />
                  <span>{result.headcount} employees</span>
                </div>
              )}
              {result.followers_count && (
                <div>
                  <IconArrowUp size={12} />
                  <span>{result.followers_count.toLocaleString()} followers</span>
                </div>
              )}
              {result.job_offers_count && (
                <div>
                  <IconCalendar size={12} />
                  <span>{result.job_offers_count} jobs</span>
                </div>
              )}
            </StyledCompanyMeta>
          ),
        });
      }

      companyColumns.push({
        key: 'actions',
        label: 'Actions',
        width: '15%',
        render: (result) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            {result.profile_url && (
              <StyledLinkButton
                onClick={() => window.open(result.profile_url, '_blank')}
                title="View Company"
              >
                <IconExternalLink size={16} />
              </StyledLinkButton>
            )}
          </div>
        ),
      });

      return companyColumns;

    case 'JOB':
      const jobColumns: ColumnConfig[] = [
        {
          key: 'job',
          label: 'Job',
          width: '40%',
          render: (result) => (
            <StyledJobInfo>
              <StyledJobTitle>{result.title || 'Unknown Title'}</StyledJobTitle>
              {result.company && (
                <StyledJobCompany>{result.company.name}</StyledJobCompany>
              )}
              {result.location && (
                <StyledLocation>{result.location}</StyledLocation>
              )}
            </StyledJobInfo>
          ),
        },
      ];

      // Only add company column if any result has company data
      const hasJobCompany = results.some(result => result.company?.name);
      if (hasJobCompany) {
        jobColumns.push({
          key: 'company',
          label: 'Company',
          width: '20%',
          render: (result) => (
            <StyledProfileInfo>
              <StyledCompanyLogo
                src={result.company?.profile_picture_url || '/images/profiles/blank_linkedin_profile_photo.png'}
                alt={result.company?.name || 'Company'}
              />
              <StyledCompanyName>{result.company?.name || 'Unknown'}</StyledCompanyName>
            </StyledProfileInfo>
          ),
        });
      }

      // Only add posted column if any result has posted_at data
      const hasPostedDate = results.some(result => result.posted_at);
      if (hasPostedDate) {
        jobColumns.push({
          key: 'posted',
          label: 'Posted',
          width: '15%',
          render: (result) => (
            <StyledLocation>
              {result.posted_at ? new Date(result.posted_at).toLocaleDateString() : 'Unknown'}
            </StyledLocation>
          ),
        });
      }

      // Only add benefits column if any result has benefits data
      const hasBenefits = results.some(result => 
        result.easy_apply || result.promoted || (result.benefits && result.benefits.length > 0)
      );
      if (hasBenefits) {
        jobColumns.push({
          key: 'benefits',
          label: 'Benefits',
          width: '15%',
          render: (result) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {result.easy_apply && (
                <StyledBadge variant="success">Easy Apply</StyledBadge>
              )}
              {result.promoted && (
                <StyledBadge variant="warning">Promoted</StyledBadge>
              )}
              {result.benefits && result.benefits.length > 0 && (
                <StyledBadge variant="info">{result.benefits.length} benefits</StyledBadge>
              )}
            </div>
          ),
        });
      }

      jobColumns.push({
        key: 'actions',
        label: 'Actions',
        width: '10%',
        render: (result) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            {result.url && (
              <StyledLinkButton
                onClick={() => window.open(result.url, '_blank')}
                title="View Job"
              >
                <IconExternalLink size={16} />
              </StyledLinkButton>
            )}
          </div>
        ),
      });

      return jobColumns;

    case 'POST':
      const postColumns: ColumnConfig[] = [
        {
          key: 'content',
          label: 'Content',
          width: '40%',
          render: (result) => (
            <StyledPostContent>
              {result.text && (
                <div style={{ marginBottom: '8px' }}>
                  {result.text.length > 200 
                    ? `${result.text.substring(0, 200)}...` 
                    : result.text
                  }
                </div>
              )}
              {result.title && (
                <StyledJobTitle>{result.title}</StyledJobTitle>
              )}
            </StyledPostContent>
          ),
        },
      ];

      // Only add author column if any result has author data
      const hasAuthor = results.some(result => result.written_by?.name);
      if (hasAuthor) {
        postColumns.push({
          key: 'author',
          label: 'Author',
          width: '25%',
          render: (result) => (
            <StyledPostAuthor>
              {result.written_by?.name && (
                <div>
                  <StyledName>{result.written_by.name}</StyledName>
                </div>
              )}
            </StyledPostAuthor>
          ),
        });
      }

      // Only add date column if any result has date data
      const hasDate = results.some(result => result.date);
      if (hasDate) {
        postColumns.push({
          key: 'date',
          label: 'Date',
          width: '15%',
          render: (result) => (
            <StyledLocation>
              {result.date ? new Date(result.date).toLocaleDateString() : 'Unknown'}
            </StyledLocation>
          ),
        });
      }

      // Only add engagement column if any result has engagement data
      const hasEngagement = results.some(result => 
        result.reaction_counter || result.comment_counter || result.repost_counter || result.impressions_counter
      );
      if (hasEngagement) {
        postColumns.push({
          key: 'engagement',
          label: 'Engagement',
          width: '20%',
          render: (result) => (
            <StyledPostStats>
              {result.reaction_counter && (
                <StyledStatItem>
                  <IconHeart size={12} />
                  <span>{result.reaction_counter}</span>
                </StyledStatItem>
              )}
              {result.comment_counter && (
                <StyledStatItem>
                  <IconComment size={12} />
                  <span>{result.comment_counter}</span>
                </StyledStatItem>
              )}
              {result.repost_counter && (
                <StyledStatItem>
                  <IconSquare size={12} />
                  <span>{result.repost_counter}</span>
                </StyledStatItem>
              )}
              {result.impressions_counter && (
                <StyledStatItem>
                  <IconEye size={12} />
                  <span>{result.impressions_counter}</span>
                </StyledStatItem>
              )}
            </StyledPostStats>
          ),
        });
      }

      return postColumns;

    default:
      return [];
  }
};

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
  persistenceKey,
  onResultsPersist,
  onClear,
}: CandidateSearchResultsTableProps) => {
  const [selectAll, setSelectAll] = useState(false);

  // Session persistence for table results
  useEffect(() => {
    if (persistenceKey && results.length > 0) {
      try {
        const persistedData = {
          results,
          timestamp: Date.now(),
          currentPage,
          totalPages,
        };
        sessionStorage.setItem(`table-results-${persistenceKey}`, JSON.stringify(persistedData));
        
        // Notify parent component about persisted results
        if (onResultsPersist) {
          onResultsPersist(results);
        }
      } catch (error) {
        console.error('Failed to persist table results:', error);
      }
    }
  }, [results, persistenceKey, currentPage, totalPages, onResultsPersist]);

  // Load persisted results on component mount
  useEffect(() => {
    if (persistenceKey && results.length === 0) {
      try {
        const persistedData = sessionStorage.getItem(`table-results-${persistenceKey}`);
        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          const isRecent = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000; // 24 hours
          
          if (isRecent && parsed.results && parsed.results.length > 0) {
            console.log(`Loading ${parsed.results.length} persisted results from session`);
            if (onResultsPersist) {
              onResultsPersist(parsed.results);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load persisted table results:', error);
      }
    }
  }, [persistenceKey, results.length, onResultsPersist]);

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

  // Determine the primary result type for column configuration
  const primaryResultType = useMemo(() => {
    if (uniqueResults.length === 0) return 'PEOPLE';
    
    const typeCounts = uniqueResults.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(typeCounts).reduce((a, b) => 
      typeCounts[a[0]] > typeCounts[b[0]] ? a : b
    )[0] as 'PEOPLE' | 'COMPANY' | 'POST' | 'JOB';
  }, [uniqueResults]);

  // Get columns for the primary result type
  const columns = useMemo(() => getColumnsForType(primaryResultType, uniqueResults), [primaryResultType, uniqueResults]);

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

  if (uniqueResults.length === 0 && !isLoading) {
    return (
      <StyledEmptyState>
        No {primaryResultType.toLowerCase()} found. Try adjusting your search parameters.
      </StyledEmptyState>
    );
  }

  return (
    <StyledTableContainer>
      {uniqueResults.length > 0 && onClear && (
        <StyledTableHeaderActions>
          <StyledTableTitle>
            {uniqueResults.length} {primaryResultType.toLowerCase()} found
          </StyledTableTitle>
          <StyledClearButton
            variant="secondary"
            onClick={onClear}
            Icon={IconTrash}
            disabled={isLoading}
          >
            Clear Results
          </StyledClearButton>
        </StyledTableHeaderActions>
      )}
      <StyledTable>
        <StyledTableHeader>
          <tr>
            <StyledTableHeaderCell style={{ width: '40px' }}>
              <StyledCheckbox
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </StyledTableHeaderCell>
            {columns.map((column) => (
              <StyledTableHeaderCell key={column.key} style={{ width: column.width }}>
                {column.label}
              </StyledTableHeaderCell>
            ))}
          </tr>
        </StyledTableHeader>
        <StyledTableBody>
          {uniqueResults.map((result) => {
            const isSelected = selectedIds.has(result.id);
            
            return (
              <StyledTableRow key={result.id} isSelected={isSelected}>
                <StyledTableCell style={{ width: '40px' }}>
                  <StyledCheckbox
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSelectCandidate(result, e.target.checked)}
                  />
                </StyledTableCell>
                {columns.map((column) => (
                  <StyledTableCell key={column.key}>
                    {column.render(result)}
                  </StyledTableCell>
                ))}
              </StyledTableRow>
            );
          })}
        </StyledTableBody>
      </StyledTable>
      
      {isLoading && (
        <StyledLoadingState>
          <IconRefresh size={16} />
          <span style={{ marginLeft: '8px' }}>Loading more {primaryResultType.toLowerCase()}...</span>
        </StyledLoadingState>
      )}
      
      {hasMore && !isLoading && (
        <StyledLoadMoreContainer>
          <StyledPaginationInfo>
            Showing {uniqueResults.length} {primaryResultType.toLowerCase()} (Page {currentPage} of {totalPages})
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

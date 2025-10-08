import { CandidateSearchParametersForm } from '@/arx-jd-upload/components/CandidateSearchParametersForm';
import { CandidateSearchResultsTable } from '@/arx-jd-upload/components/CandidateSearchResultsTable';
import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { LinkedInSearchCategory, LinkedInSearchResult, LinkedInSearchType } from '@/arx-jd-upload/types/CandidateSearch';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { AIChatAssistant } from '@/candidate-search/components/AIChatAssistant';
import styled from '@emotion/styled';
import { useState } from 'react';
import { IconFilter, IconTable } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;

`;

const StyledLeftPanel = styled.div`
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledCenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledRightPanel = styled.div`
  flex: 0 0 350px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
`;


type CandidateSearchThreePanelProps = {
  parsedJD: ParsedJD;
  onSearch: (searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory, parameters: any) => void;
  searchResults: LinkedInSearchResult[];
  selectedCandidates: LinkedInSearchResult[];
  onSelectionChange: (candidates: LinkedInSearchResult[]) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onLoadMultiplePages?: (pages: number) => void;
  currentPage?: number;
  totalPages?: number;
  onNextPage?: () => void;
  onSearchRef?: (searchFn: () => void) => void;
  generatedParameters?: any;
  searchFilterId?: string;
  onSearchFilterUpdate?: (
    searchFilterId: string,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
  onGeneratedParametersChange?: (parameters: any) => void;
  onJDUpload?: (file: File) => Promise<void>;
  onEnrichmentCreate?: (enrichments: any[]) => void;
};


export const CandidateSearchThreePanel = ({
  parsedJD,
  onSearch,
  searchResults,
  selectedCandidates,
  onSelectionChange,
  isLoading,
  hasMore,
  onLoadMore,
  onLoadMultiplePages,
  currentPage = 0,
  totalPages = 0,
  onNextPage,
  onSearchRef,
  generatedParameters,
  searchFilterId,
  onSearchFilterUpdate,
  onGeneratedParametersChange,
  onJDUpload,
  onEnrichmentCreate,
}: CandidateSearchThreePanelProps) => {
  const { generateAndResolveSearchParameters } = useSearchParameters();

  const [currentGeneratedParameters, setCurrentGeneratedParameters] = useState<any>(undefined);


  return (
    <StyledContainer>
      {/* Left Panel - Search Parameters */}
      <StyledLeftPanel>
        <StyledPanelHeader>
          <IconFilter size={20} />
          <StyledPanelTitle>Search Filters</StyledPanelTitle>
        </StyledPanelHeader>
        <StyledPanelContent>
          <CandidateSearchParametersForm
            parsedJD={parsedJD}
            onSearch={onSearch}
            isLoading={isLoading}
            onSearchRef={onSearchRef}
            generatedParameters={currentGeneratedParameters}
            searchFilterId={searchFilterId}
            onSearchFilterUpdate={onSearchFilterUpdate}
            onGeneratedParametersChange={setCurrentGeneratedParameters}
          />
        </StyledPanelContent>
      </StyledLeftPanel>

      {/* Center Panel - Search Results */}
      <StyledCenterPanel>
        <StyledPanelHeader>
          <IconTable size={20} />
          <StyledPanelTitle>Search Results</StyledPanelTitle>
        </StyledPanelHeader>
        <StyledPanelContent>
          <CandidateSearchResultsTable
            results={searchResults}
            selectedCandidates={selectedCandidates}
            onSelectionChange={onSelectionChange}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onLoadMultiplePages={onLoadMultiplePages}
            currentPage={currentPage}
            totalPages={totalPages}
            onNextPage={onNextPage}
          />
        </StyledPanelContent>
      </StyledCenterPanel>

      {/* Right Panel - AI Chat Assistant */}
      <StyledRightPanel>
        <AIChatAssistant
          parsedJD={parsedJD}
          onJDUpload={onJDUpload}
          onEnrichmentCreate={onEnrichmentCreate}
        />
      </StyledRightPanel>
    </StyledContainer>
  );
};

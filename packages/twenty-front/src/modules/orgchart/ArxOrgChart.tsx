import styled from '@emotion/styled';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import {
  OrgChartDiagram,
  OrgChartSearchControls,
  useCompanyInfoLookup,
  useOrgChartData,
  useOrgChartFilterOptions,
  type OrgChartDiagramHandle,
} from 'twenty-orgchart';
import {
  extractOrgData,
  processOrgChartToNodeData,
  type OrgChartNodeData,
} from 'twenty-shared';
import { OrgChartAddToJobModal } from './components/OrgChartAddToJobModal';
import { OrgChartHeader } from './components/OrgChartHeader';
import { OrgChartResultModal } from './components/OrgChartResultModal';
import { useOrgChartActions } from './hooks/useOrgChartActions';

export type ArxOrgChartProps = {
  companyId: string;
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  onBack?: () => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  position: relative;
  min-height: 300px;
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

const StyledTopRightActionsOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTopRightActionButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const StyledLoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledTemplateBanner = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  transform: translateX(-50%);
  z-index: 19;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
`;

const StyledTemplateBannerButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1.25)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: none;
  background: ${({ theme }) => theme.accent.quaternary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.accent.tertiary};
  }

  &:active {
    background: ${({ theme }) => theme.accent.secondary};
    color: ${({ theme }) => theme.font.color.inverted};
  }
`;

const PERSON_ROW_HEIGHT = 48;

export const ArxOrgChart = ({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  onBack,
}: ArxOrgChartProps) => {
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);

  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);

  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

  const { refetchJobs } = useJobRefetch();
  const actions = useOrgChartActions({ companyId, companyName, website });

  const { data, isLoading, error, fetchOrgChart } = useOrgChartData(
    {
      companyId,
      companyName,
      website,
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    },
    { baseUrl, accessToken },
  );

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  useEffect(() => {
    refetchJobs();
  }, [refetchJobs]);

  const orgSource = actions.latestOrgChart ?? (data as Record<string, unknown> | null);

  const orgData = useMemo(
    () => extractOrgData(orgSource),
    [orgSource],
  );

  const isBlankTemplate =
    typeof (orgSource as Record<string, unknown> | null)?.is_blank_template ===
    'boolean' &&
    (orgSource as Record<string, unknown>).is_blank_template === true;

  const filterOptions = useOrgChartFilterOptions(orgData);

  const {
    company: fallbackCompanyInfo,
    lookupByName,
  } = useCompanyInfoLookup({ baseUrl, accessToken });

  const hasInitialCompanyInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number' ||
    linkedinUrl;

  useEffect(() => {
    if (hasInitialCompanyInfo) {
      return;
    }

    const lookupKey = companyName?.trim() || companyId;
    if (lookupKey) {
      lookupByName(lookupKey);
    }
  }, [companyId, companyName, hasInitialCompanyInfo, lookupByName]);

  useEffect(() => {
    if (!orgData || !companyId) return;

    setSelectedCountry((current) => {
      if (current) return current;
      const initialCountry =
        typeof orgData.country === 'string' ? orgData.country : undefined;
      return initialCountry;
    });

    setSelectedFunctionRoot((current) => {
      if (current) return current;
      const initialFunctionRoot =
        typeof (orgData as Record<string, unknown>).type === 'string'
          ? ((orgData as Record<string, unknown>).type as string)
          : undefined;
      return initialFunctionRoot;
    });
  }, [orgData, companyId]);

  const nodeDataArray = useMemo(() => {
    if (!orgData) return [];
    const base = processOrgChartToNodeData(orgData);
    if (Object.keys(actions.enrichedNodes).length === 0) return base;

    return base.map((node) => {
      const enriched = actions.enrichedNodes[node.key];
      if (!enriched) return node;

      const merged = { ...node } as OrgChartNodeData;
      const displayedCount = Math.min(enriched.people.length, 4);
      const totalCount = enriched.people.length;

      enriched.people.slice(0, 4).forEach((p, i) => {
        merged[`name_${i}`] = p.fullName;
        merged[`title_${i}`] = p.headline;
        merged[`linkedin_url_${i}`] = p.linkedinUrl ?? '';
        const img = (p.raw as Record<string, unknown>)?.image;
        merged[`image_${i}`] = typeof img === 'string' ? img : '';
      });
      merged.height_0 = displayedCount >= 1 ? PERSON_ROW_HEIGHT : 0;
      merged.height_1 = displayedCount >= 2 ? PERSON_ROW_HEIGHT : 0;
      merged.height_2 = displayedCount >= 3 ? PERSON_ROW_HEIGHT : 0;
      merged.height_3 = displayedCount >= 4 ? PERSON_ROW_HEIGHT : 0;
      merged.nodeState = enriched.nodeState;
      merged.total_people = totalCount;
      return merged;
    });
  }, [orgData, actions.enrichedNodes]);

  const handleSearch = () => {
    const handle = diagramHandleRef.current;
    if (!handle) return;
    const count = handle.search(searchTerm);
    setSearchResultCount(count);
  };

  const handleClearSearch = () => {
    diagramHandleRef.current?.clearSearch();
    setSearchTerm('');
    setSearchResultCount(null);
  };

  const filtersProps = {
    availableCountries: filterOptions.availableCountries,
    countryPercentLabels: filterOptions.countryPercentLabels,
    selectedCountry,
    onCountryChange: (country: string | undefined) => setSelectedCountry(country),
    availableFunctionRoots: filterOptions.availableFunctionRoots,
    functionRootPercentLabels: filterOptions.functionRootPercentLabels,
    selectedFunctionRoot,
    onFunctionRootChange: (fn: string | undefined) =>
      setSelectedFunctionRoot(fn),
  };

  const searchControlsProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    searchResultCount,
    onSearch: handleSearch,
    onClearSearch: handleClearSearch,
    diagramHandleRef,
    onGetAll: () =>
      actions.executeOrgchartSearch({
        mode: 'entire_company',
        origin: 'header',
      }),
    onViewAllCandidates: () =>
      actions.executeOrgchartSearch({
        mode: 'entire_company',
        origin: 'view_all_candidates',
      }),
    onGetLeaders: () =>
      actions.executeOrgchartSearch({
        mode: 'leadership',
        origin: 'header',
      }),
  };

  const headerProps = {
    companyName: companyName ?? fallbackCompanyInfo?.companyName,
    website: website ?? fallbackCompanyInfo?.website,
    locationName: locationName ?? fallbackCompanyInfo?.locationName,
    industry: industry ?? fallbackCompanyInfo?.industry,
    profileCount: profileCount ?? fallbackCompanyInfo?.profileCount,
    linkedinUrl: linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl,
    employeeCount: fallbackCompanyInfo?.employeeCount,
    linkedinDisplayName: fallbackCompanyInfo?.linkedinDisplayName,
    onBack,
    hasFilters: !!orgData,
    filtersProps,
  };

  return (
    <StyledContainer>
      <OrgChartHeader {...headerProps} />

      <StyledDiagramArea>
        {isLoading && (
          <StyledLoadingMessage>Loading org chart...</StyledLoadingMessage>
        )}
        {error && <StyledErrorMessage>{error}</StyledErrorMessage>}

        {!isLoading && !error && nodeDataArray.length > 0 && (
          <>
            {isBlankTemplate && (
              <StyledTemplateBanner>
                This is a template. Click{' '}
                <StyledTemplateBannerButton
                  type="button"
                  onClick={searchControlsProps.onGetAll}
                >
                  All
                </StyledTemplateBannerButton>{' '}
                to generate the full org chart for this company.
              </StyledTemplateBanner>
            )}
            <OrgChartDiagram
              ref={diagramHandleRef}
              nodeDataArray={nodeDataArray}
              iconUrls={{
                lock: '/img/lock.png',
                linkedin: '/img/linkedin-icon-png-circle-2.png',
                download: '/img/download-icon.png',
                similarItems: '/img/similar-items.png',
              }}
              onNodeContextAction={actions.handleNodeContextAction}
              onBackgroundContextAction={actions.handleBackgroundContextAction}
              onNodeDoubleClick={actions.handleNodeDoubleClick}
              onDownloadNode={actions.handleDownloadNode}
              onSimilarPeople={actions.handleSimilarPeople}
            />
            <StyledTopRightActionsOverlay>
              <StyledTopRightActionButton
                type="button"
                onClick={searchControlsProps.onGetAll}
              >
                All
              </StyledTopRightActionButton>
              <StyledTopRightActionButton
                type="button"
                onClick={searchControlsProps.onViewAllCandidates}
              >
                View all candidates
              </StyledTopRightActionButton>
              <StyledTopRightActionButton
                type="button"
                onClick={searchControlsProps.onGetLeaders}
              >
                Leaders
              </StyledTopRightActionButton>
              <StyledTopRightActionButton
                type="button"
                onClick={() => diagramHandleRef.current?.zoomToFit()}
              >
                Zoom to fit
              </StyledTopRightActionButton>
              <StyledTopRightActionButton
                type="button"
                onClick={() => diagramHandleRef.current?.centerContent()}
              >
                Center
              </StyledTopRightActionButton>
            </StyledTopRightActionsOverlay>
            <StyledSearchOverlay>
              <OrgChartSearchControls {...searchControlsProps} />
            </StyledSearchOverlay>
          </>
        )}

        {!isLoading && !error && data && nodeDataArray.length === 0 && (
          <StyledLoadingMessage>
            No org chart data available.
          </StyledLoadingMessage>
        )}

        {actions.isContextModalOpen && (
          <OrgChartResultModal
            title={actions.contextModalTitle}
            isLoading={actions.isContextLoading}
            loadingStartedAt={actions.contextLoadingStartedAt}
            loadingProgressMessage={actions.contextProgressMessage}
            loadingPage={actions.contextProgressPage}
            loadingTotalPages={actions.contextProgressTotalPages}
            loadingTotalCandidates={actions.contextProgressTotalCandidates}
            error={actions.contextError}
            results={actions.contextResults}
            booleanKeywordsString={actions.booleanKeywordsString}
            onClose={actions.closeContextModal}
            onDownloadCsv={
              actions.contextResults.length > 0
                ? actions.downloadContextResultsAsCsv
                : undefined
            }
          />
        )}

        {actions.selectedNodeForDetails && (
          <OrgChartResultModal
            title={actions.selectedNodeForDetails.headline}
            isLoading={actions.isNodeDetailLoading}
            error={actions.nodeDetailError}
            results={actions.nodeDetailResults}
            emptyMessage="No people are attached to this node yet."
            onClose={actions.closeNodeDetailModal}
            onDownloadCsv={actions.downloadNodeDetailsAsCsv}
            onGetSimilarPeople={() =>
              actions.executeOrgchartSearch({
                mode: 'function_grade',
                origin: 'doubleClick',
                node: actions.selectedNodeForDetails!,
              })
            }
          />
        )}

        <OrgChartAddToJobModal
          isOpen={actions.isAddToJobModalOpen}
          onClose={actions.closeAddToJobModal}
          node={actions.addToJobNode}
          companyName={companyName ?? undefined}
          queueStartChatAfter={actions.addToJobQueueStartChat}
          onSuccess={actions.closeAddToJobModal}
        />
      </StyledDiagramArea>
    </StyledContainer>
  );
};

import styled from '@emotion/styled';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
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
  type OrgChartNodeData
} from 'twenty-shared';
import { OrgChartAddToJobModal } from './components/OrgChartAddToJobModal';
import { OrgChartHeader } from './components/OrgChartHeader';
import { OrgChartResultModal } from './components/OrgChartResultModal';
import { OrgChartResultsAddToJobModal } from './components/OrgChartResultsAddToJobModal';
import { useJobOrgChartData } from './hooks/useJobOrgChartData';
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
  jobId?: string;
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

const StyledProgressBanner = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  max-width: 420px;
  text-align: center;
`;

const StyledTemplateBannerButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: none;
  background: ${({ theme }) => theme.accent.primary};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 0.8;
  }
`;

const StyledSpinner = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.color.medium};
  border-top-color: ${({ theme }) => theme.color.blue};
  animation: orgchart-spin 0.8s linear infinite;

  @keyframes orgchart-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
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
  jobId,
}: ArxOrgChartProps) => {
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);
  const [exactEmployeeCount, setExactEmployeeCount] = useState<number | null>(
    null,
  );
  const [unipileCompanyProfile, setUnipileCompanyProfile] = useState<{
    employee_count?: number;
    description?: string;
    tagline?: string;
    logo?: string;
    logo_large?: string;
    website?: string;
    name?: string;
    profile_url?: string;
    locations?: Array<{ city?: string; country?: string; area?: string }>;
    industry?: string[];
  } | null>(null);

  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);
  const skipNextRefetchRef = useRef(false);

  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const { isLinkedinConnected } = useUnipile();

  const {
    company: fallbackCompanyInfo,
    lookupByName,
  } = useCompanyInfoLookup({ baseUrl, accessToken });
console.log("Company name in ArxOrgChart::", companyName);
  const { refetchJobs } = useJobRefetch();
  const effectiveEmployeeCount =
    unipileCompanyProfile?.employee_count ??
    exactEmployeeCount ??
    fallbackCompanyInfo?.employeeCount;
  const effectiveCompanyName =
    companyName ??
    unipileCompanyProfile?.name ??
    fallbackCompanyInfo?.companyName;
  const actions = useOrgChartActions({
    companyId,
    companyName: effectiveCompanyName,
    website,
    employeeCount: effectiveEmployeeCount,
  });

  const jobOrgChartHook = useJobOrgChartData(
    { jobId, jobName: companyName ?? effectiveCompanyName },
    { baseUrl, accessToken },
  );

  const classicOrgChartHook = useOrgChartData(
    {
      companyId,
      companyName: effectiveCompanyName ?? companyName,
      website,
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    },
    { baseUrl, accessToken },
  );

  const isJobMode = !!jobId;

  const data = (isJobMode ? jobOrgChartHook.data : classicOrgChartHook.data) as
    | Record<string, unknown>
    | null;
  const isLoading = isJobMode
    ? jobOrgChartHook.isLoading
    : classicOrgChartHook.isLoading;
  const error = isJobMode
    ? jobOrgChartHook.error
    : classicOrgChartHook.error;
  const fetchOrgChart = isJobMode
    ? jobOrgChartHook.fetchOrgChart
    : classicOrgChartHook.fetchOrgChart;

  useEffect(() => {
    if (skipNextRefetchRef.current) {
      skipNextRefetchRef.current = false;
      return;
    }
    fetchOrgChart();
  }, [fetchOrgChart]);

  useEffect(() => {
    refetchJobs();
  }, [refetchJobs]);

  const orgSource = isJobMode
    ? ((data?.orgChart as Record<string, unknown> | null) ?? null)
    : actions.latestOrgChart ?? ((data as Record<string, unknown> | null) ?? null);

  const orgData = useMemo(
    () => extractOrgData(orgSource),
    [orgSource],
  );

  const isBlankTemplate =
    typeof (orgSource as Record<string, unknown> | null)?.is_blank_template ===
    'boolean' &&
    (orgSource as Record<string, unknown>).is_blank_template === true;

  // const hasPreviewOrLockNodes = useMemo(() => {
  //   return nodeDataArray.some(
  //     (n) => n.nodeState === 'preview' || n.nodeState === 'lock',
  //   );
  // }, [nodeDataArray]);

  // const isPreviewMode = isBlankTemplate || hasPreviewOrLockNodes;
  // const isPreviewMode = isBlankTemplate;

  const filterOptions = useOrgChartFilterOptions(orgData);

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

  const linkedinUrlToUse = linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl;

  useEffect(() => {
    if (!isLinkedinConnected || !linkedinUrlToUse?.trim() || !baseUrl || !accessToken) {
      if (!isLinkedinConnected) {
        setUnipileCompanyProfile(null);
      }
      return;
    }

    let cancelled = false;
    const fetchCompanyProfile = async () => {
      try {
        const params = new URLSearchParams();
        params.set('linkedinUrl', linkedinUrlToUse.trim());
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/org-chart/companies/company-profile?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (cancelled) return;
        const data = (await res.json()) as {
          linkedinConnected?: boolean;
          profile?: {
            employee_count?: number;
            description?: string;
            tagline?: string;
            logo?: string;
            logo_large?: string;
            website?: string;
            name?: string;
            profile_url?: string;
            locations?: Array<{ city?: string; country?: string; area?: string }>;
            industry?: string[];
          } | null;
        };
        if (res.ok && data.linkedinConnected && data.profile) {
          setUnipileCompanyProfile(data.profile);
        } else {
          setUnipileCompanyProfile(null);
        }
      } catch {
        if (!cancelled) setUnipileCompanyProfile(null);
      }
    };
    fetchCompanyProfile();
    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    accessToken,
    isLinkedinConnected,
    linkedinUrlToUse,
  ]);

  useEffect(() => {
    if (isLinkedinConnected) return;
    const identifier = linkedinUrlToUse ?? companyId;
    if (!identifier?.trim() || !baseUrl) return;

    let cancelled = false;
    const fetchEmployeeCount = async () => {
      try {
        const params = new URLSearchParams();
        if (linkedinUrlToUse?.trim()) {
          params.set('linkedinUrl', linkedinUrlToUse.trim());
        } else {
          params.set('companyId', companyId);
        }
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/org-chart/companies/employee-count?${params.toString()}`,
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
          },
        );
        if (cancelled) return;
        const data = (await res.json()) as { employeeCount?: number | null };
        if (res.ok && typeof data.employeeCount === 'number') {
          setExactEmployeeCount(data.employeeCount);
        }
      } catch {
        if (!cancelled) setExactEmployeeCount(null);
      }
    };
    fetchEmployeeCount();
    return () => {
      cancelled = true;
    };
  }, [
    baseUrl,
    accessToken,
    companyId,
    linkedinUrlToUse,
    isLinkedinConnected,
  ]);

  useEffect(() => {
    if (!orgData || !companyId) return;

    setSelectedCountry((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
      const initialCountry =
        typeof orgData.country === 'string' ? orgData.country : undefined;
      return initialCountry;
    });

    setSelectedFunctionRoot((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
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

  const debouncedSetCountry = useDebouncedCallback(
    (country: string | undefined) => setSelectedCountry(country),
    150,
  );
  const debouncedSetFunctionRoot = useDebouncedCallback(
    (fn: string | undefined) => setSelectedFunctionRoot(fn),
    150,
  );

  const filtersProps = {
    availableCountries: filterOptions.availableCountries,
    countryPercentLabels: filterOptions.countryPercentLabels,
    selectedCountry,
    onCountryChange: debouncedSetCountry,
    availableFunctionRoots: filterOptions.availableFunctionRoots,
    functionRootPercentLabels: filterOptions.functionRootPercentLabels,
    selectedFunctionRoot,
    onFunctionRootChange: debouncedSetFunctionRoot,
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

  const unipileLocationName = unipileCompanyProfile?.locations?.[0]
    ? [
        unipileCompanyProfile.locations[0].city,
        unipileCompanyProfile.locations[0].area,
        unipileCompanyProfile.locations[0].country,
      ]
        .filter(Boolean)
        .join(', ')
    : undefined;

  const resolveSafeLogoUrl = (rawLogoUrl?: string): string | undefined => {
    const trimmed = rawLogoUrl?.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.toString();
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const headerProps = {
    companyName: effectiveCompanyName,
    website:
      website ??
      unipileCompanyProfile?.website ??
      fallbackCompanyInfo?.website,
    locationName:
      locationName ??
      unipileLocationName ??
      fallbackCompanyInfo?.locationName,
    industry:
      industry ??
      (Array.isArray(unipileCompanyProfile?.industry)
        ? unipileCompanyProfile?.industry?.join(', ')
        : undefined) ??
      fallbackCompanyInfo?.industry,
    profileCount: profileCount ?? fallbackCompanyInfo?.profileCount,
    hideProfileCountWhenUnipile: !!unipileCompanyProfile,
    linkedinUrl:
      linkedinUrl ??
      unipileCompanyProfile?.profile_url ??
      fallbackCompanyInfo?.linkedinUrl,
    employeeCount:
      unipileCompanyProfile?.employee_count ??
      exactEmployeeCount ??
      fallbackCompanyInfo?.employeeCount,
    linkedinDisplayName: fallbackCompanyInfo?.linkedinDisplayName,
    description: unipileCompanyProfile?.description,
    tagline: unipileCompanyProfile?.tagline,
    logoUrl: resolveSafeLogoUrl(
      unipileCompanyProfile?.logo_large ?? unipileCompanyProfile?.logo,
    ),
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
        {actions.isContextLoading &&
          !actions.isContextModalOpen &&
          actions.contextProgressMessage && (
            <StyledProgressBanner>
              {actions.contextProgressMessage}
            </StyledProgressBanner>
          )}
        {error && <StyledErrorMessage>{error}</StyledErrorMessage>}

        {!isLoading && !error && nodeDataArray.length > 0 && (
          <>
            {isBlankTemplate && (
              actions.isContextLoading ? (
                <StyledTemplateBanner>
                  <StyledSpinner />
                  <span>{actions.contextProgressMessage || 'Processing...'}</span>
                </StyledTemplateBanner>
              ) : (
                <StyledTemplateBanner>
                  <span>
                    This is a preview template. Generate the full org chart to see
                    all employees.
                  </span>
                  <StyledTemplateBannerButton
                    type="button"
                    onClick={searchControlsProps.onGetAll}
                  >
                    {typeof effectiveEmployeeCount === 'number'
                      ? `Generate full org chart (${effectiveEmployeeCount.toLocaleString()} employees)`
                      : 'Generate full org chart'}
                  </StyledTemplateBannerButton>
                </StyledTemplateBanner>
              )
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
                {typeof effectiveEmployeeCount === 'number'
                  ? `Full org chart (${effectiveEmployeeCount.toLocaleString()})`
                  : 'All'}
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
            onAddToJob={
              actions.contextResults.length > 0
                ? () =>
                    actions.openAddResultsToJobModal(actions.contextResults, {
                      companyName: effectiveCompanyName ?? undefined,
                      contextModalMode: actions.contextModalMode ?? undefined,
                      selectedNodeFunction: actions.selectedNodeFunction,
                      selectedNodeGrade: actions.selectedNodeGrade,
                    })
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
            onAddToJob={
              actions.nodeDetailResults.length > 0
                ? () =>
                    actions.openAddResultsToJobModal(
                      actions.nodeDetailResults,
                      {
                        companyName: effectiveCompanyName ?? undefined,
                        contextModalMode: 'current_node',
                        selectedNodeFunction: actions.selectedNodeFunction,
                        selectedNodeGrade: actions.selectedNodeGrade,
                      },
                    )
                : undefined
            }
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
          companyName={effectiveCompanyName ?? undefined}
          queueStartChatAfter={actions.addToJobQueueStartChat}
          onSuccess={actions.closeAddToJobModal}
        />

        <OrgChartResultsAddToJobModal
          isOpen={actions.isAddResultsToJobModalOpen}
          onClose={actions.closeAddResultsToJobModal}
          results={actions.addResultsToJobResults}
          companyName={actions.addResultsToJobContext.companyName}
          contextModalMode={actions.addResultsToJobContext.contextModalMode}
          selectedNodeFunction={actions.addResultsToJobContext.selectedNodeFunction}
          selectedNodeGrade={actions.addResultsToJobContext.selectedNodeGrade}
          queueStartChatAfter={true}
          onSuccess={actions.closeAddResultsToJobModal}
        />
      </StyledDiagramArea>
    </StyledContainer>
  );
};

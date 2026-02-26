'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';

import { OrgChartCompanyInfo } from '@/app/_components/orgchart/OrgChartCompanyInfo';
import { companySearchLightTheme } from '@/lib/company-search';
import type { OrgChartDiagramHandle } from 'twenty-orgchart/orgchart-core';
import {
  OrgChartFilters,
  OrgChartSearchControls,
  OrgChartSignUpModal,
  useCompanyInfoLookup,
  useOrgChartFilterOptions,
} from 'twenty-orgchart/orgchart-core';
import type { OrgChartNodeData } from 'twenty-shared';

const OrgChartDiagram = dynamic(
  () => import('twenty-orgchart').then((mod) => mod.OrgChartDiagram),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          minHeight: 400,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    ),
  },
);

type OrgChartPageClientProps = {
  children?: React.ReactNode;
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  nodeDataArray: OrgChartNodeData[];
  orgData: Record<string, unknown> | null;
  initialCountry?: string;
  initialFunctionRoot?: string;
  signUpUrl: string;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  align-self: stretch;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledStructureWrapper = styled.div<{ $hidden: boolean }>`
  ${({ $hidden }) => $hidden && 'display: none;'}
`;

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
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
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
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

const StyledUnlockBanner = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  text-align: center;
`;

const StyledUnlockTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledUnlockText = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledUnlockButton = styled(Link)`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.font.color.primary};
  color: ${({ theme }) => theme.background.primary};
  text-decoration: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-weight: 500;
  font-size: ${({ theme }) => theme.font.size.sm};
  transition: color 0.15s ease;

  &:hover {
    color: #9e9e9e;
  }
`;

export const OrgChartPageClient = ({
  children,
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  nodeDataArray,
  orgData,
  initialCountry,
  initialFunctionRoot,
  signUpUrl,
}: OrgChartPageClientProps) => {
  const router = useRouter();
  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);

  const handleDiagramReady = useCallback((handle: OrgChartDiagramHandle) => {
    diagramHandleRef.current = handle;
    setIsDiagramVisible(true);
  }, []);

  const [isDiagramVisible, setIsDiagramVisible] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(
    initialCountry,
  );
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >(initialFunctionRoot);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(
    null,
  );
  const [clickedNode, setClickedNode] = useState<OrgChartNodeData | null>(
    null,
  );

  const {
    availableCountries,
    availableFunctionRoots,
    countryPercentLabels,
    functionRootPercentLabels,
  } = useOrgChartFilterOptions(orgData);

  const { company: fallbackCompanyInfo, lookupByName } = useCompanyInfoLookup({
    baseUrl: '/api/org-chart',
    accessToken: undefined,
    autocompletePath: '/autocomplete',
  });

  // Always call PDL autocomplete to enrich with employee count, website, LinkedIn, etc.
  // even when we have partial data from the org chart API (e.g. industry, location).
  useEffect(() => {
    const lookupKey = companyName?.trim() || companyId;
    if (lookupKey) {
      lookupByName(lookupKey);
    }
  }, [lookupByName, companyName, companyId]);

  const displayWebsite = website ?? fallbackCompanyInfo?.website;
  const displayLocationName =
    locationName ?? fallbackCompanyInfo?.locationName;
  const displayIndustry = industry ?? fallbackCompanyInfo?.industry;
  const displayProfileCount = profileCount ?? fallbackCompanyInfo?.profileCount;
  const displayLinkedinUrl = linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl;
  const displayEmployeeCount = fallbackCompanyInfo?.employeeCount;

  const buildPath = useCallback(
    (country?: string, fn?: string) => {
      let path = `/org-chart/${encodeURIComponent(companyId)}`;
      if (country && country !== 'global') {
        path += `/${encodeURIComponent(country)}`;
      }
      if (fn && fn !== 'fullcompany') {
        path += `/${encodeURIComponent(fn)}`;
      }
      return path;
    },
    [companyId],
  );

  const handleCountryChange = useCallback(
    (country: string | undefined) => {
      setSelectedCountry(country);
      router.push(buildPath(country, selectedFunctionRoot));
    },
    [router, buildPath, selectedFunctionRoot],
  );

  const handleFunctionRootChange = useCallback(
    (fn: string | undefined) => {
      setSelectedFunctionRoot(fn);
      router.push(buildPath(selectedCountry, fn));
    },
    [router, buildPath, selectedCountry],
  );

  const handleSearch = useCallback(() => {
    const count = diagramHandleRef.current?.search(searchTerm) ?? 0;
    setSearchResultCount(count);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    diagramHandleRef.current?.clearSearch();
    setSearchResultCount(null);
  }, []);

  const handleNodeClick = useCallback((node: OrgChartNodeData) => {
    setClickedNode(node);
  }, []);

  const handleCloseSignUpModal = useCallback(() => {
    setClickedNode(null);
  }, []);

  const hasFilters = !!orgData;

  const filtersProps = {
    availableCountries,
    countryPercentLabels,
    selectedCountry,
    onCountryChange: handleCountryChange,
    availableFunctionRoots,
    functionRootPercentLabels,
    selectedFunctionRoot,
    onFunctionRootChange: handleFunctionRootChange,
  };

  const searchControlsProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    searchResultCount,
    onSearch: handleSearch,
    onClearSearch: handleClearSearch,
    diagramHandleRef: diagramHandleRef,
    onGetAll: () => {},
    onGetLeaders: () => {},
    onViewAllCandidates: () => {},
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <ThemeProvider theme={companySearchLightTheme}>
        <StyledContainer>
        <StyledHeader>
          <OrgChartCompanyInfo
            companyName={companyName}
            website={displayWebsite}
            locationName={displayLocationName}
            industry={displayIndustry}
            profileCount={displayProfileCount}
            linkedinUrl={displayLinkedinUrl}
            employeeCount={displayEmployeeCount}
            logoBaseUrl="/api/org-chart"
          />
          {hasFilters && <OrgChartFilters {...filtersProps} />}
        </StyledHeader>

        <StyledDiagramArea>
          {nodeDataArray.length > 0 && (
            <>
              <OrgChartDiagram
                onDiagramReady={handleDiagramReady}
                nodeDataArray={nodeDataArray}
                onNodeClick={handleNodeClick}
                iconUrls={{
                  lock: '/img/lock.png',
                  linkedin: '/img/linkedin-icon-png-circle-2.png',
                  download: '/img/download-icon.png',
                  similarItems: '/img/similar-items.png',
                }}
              />
              <StyledTopRightActionsOverlay>
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
          {clickedNode && (
            <OrgChartSignUpModal
              node={clickedNode}
              onClose={handleCloseSignUpModal}
              signUpUrl={signUpUrl}
              companyName={companyName}
              selectedCountry={selectedCountry}
              selectedFunctionRoot={selectedFunctionRoot}
            />
          )}
        </StyledDiagramArea>

        {/* <StyledUnlockBanner>
          <StyledUnlockTitle>Unlock {companyName} Org Chart</StyledUnlockTitle>
          <StyledUnlockText>
            See all names, titles, emails & phone numbers. Your first org chart
            is free. No credit card required.
          </StyledUnlockText>
          <StyledUnlockButton href={signUpUrl}>
            Continue with LinkedIn / Google / Email
          </StyledUnlockButton>
        </StyledUnlockBanner> */}
        {children && (
          <StyledStructureWrapper
            $hidden={isDiagramVisible}
            aria-hidden={isDiagramVisible}
          >
            {children}
          </StyledStructureWrapper>
        )}
      </StyledContainer>
      </ThemeProvider>
    </div>
  );
};

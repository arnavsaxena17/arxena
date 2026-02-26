'use client';

import { IconWorld } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';

import { companySearchLightTheme } from '@/lib/company-search';
import {
  OrgChartDiagram,
  OrgChartDiagramHandle,
  OrgChartFilters,
  OrgChartSearchControls,
  OrgChartSignUpModal,
  useOrgChartFilterOptions,
} from 'twenty-orgchart';
import type { OrgChartNodeData } from 'twenty-shared';

type OrgChartPageClientProps = {
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
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
  // min-height: 80vh;
  width: 100%;
  align-self: stretch;
  background: ${({ theme }) => theme.background.primary};
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

const StyledCompanyInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  min-width: 0;
`;

const StyledCompanyTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  min-width: 0;
`;

const StyledCompanyLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  object-fit: contain;
  background: ${({ theme }) => theme.background.tertiary};
  flex-shrink: 0;
`;

const StyledCompanyTitle = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const StyledCompanyMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};

  &:not(:last-child)::after {
    content: '·';
    margin-left: ${({ theme }) => theme.spacing(1)};
  }
`;

const StyledLinkIcon = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const _StyledLinkedinLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const _StyledLinkedinLogo = styled.img`
  width: 16px;
  height: 16px;
  display: block;
`;

const _StyledLinkedinText = styled.span`
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  position: relative;
  min-height: 500px;
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

function getLogoUrl(website?: string): string | null {
  if (!website?.trim()) return null;
  return `/api/org-chart/company-logo?website=${encodeURIComponent(website)}`;
}

function getDisplayDomain(website?: string): string | null {
  if (!website?.trim()) return null;
  try {
    const withProtocol = website.startsWith('http')
      ? website
      : `https://${website}`;
    const { hostname } = new URL(withProtocol);
    return hostname.replace(/^www\./u, '');
  } catch {
    return website;
  }
}

export const OrgChartPageClient = ({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  nodeDataArray,
  orgData,
  initialCountry,
  initialFunctionRoot,
  signUpUrl,
}: OrgChartPageClientProps) => {
  const router = useRouter();
  const diagramRef = useRef<OrgChartDiagramHandle | null>(null);

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
    const count = diagramRef.current?.search(searchTerm) ?? 0;
    setSearchResultCount(count);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    diagramRef.current?.clearSearch();
    setSearchResultCount(null);
  }, []);

  const handleNodeClick = useCallback((node: OrgChartNodeData) => {
    setClickedNode(node);
  }, []);

  const handleCloseSignUpModal = useCallback(() => {
    setClickedNode(null);
  }, []);

  const logoUrl = getLogoUrl(website);
  const websiteDomain = getDisplayDomain(website);
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
    diagramHandleRef: diagramRef,
    onGetAll: () => {},
    onGetLeaders: () => {},
    onViewAllCandidates: () => {},
  };

  return (
    <ThemeProvider theme={companySearchLightTheme}>
      <StyledContainer>
        <StyledHeader>
          <StyledCompanyInfo>
            {companyName && (
              <StyledCompanyTitleRow>
                {logoUrl && (
                  <StyledCompanyLogo src={logoUrl} alt="" loading="lazy" />
                )}
                <StyledCompanyTitle>{companyName}</StyledCompanyTitle>
                {website ? (
                  <StyledLinkIcon
                    href={
                      website.startsWith('http')
                        ? website
                        : `https://${website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open company website"
                  >
                    <IconWorld size={14} />
                  </StyledLinkIcon>
                ) : null}
              </StyledCompanyTitleRow>
            )}
            {(locationName ||
              industry ||
              websiteDomain ||
              typeof profileCount === 'number') && (
              <StyledCompanyMetaRow>
                {locationName && (
                  <StyledMetaItem>{locationName}</StyledMetaItem>
                )}
                {industry && <StyledMetaItem>{industry}</StyledMetaItem>}
                {websiteDomain && (
                  <StyledMetaItem>{websiteDomain}</StyledMetaItem>
                )}
                {typeof profileCount === 'number' && (
                  <StyledMetaItem>
                    {profileCount.toLocaleString()} profiles
                  </StyledMetaItem>
                )}
              </StyledCompanyMetaRow>
            )}
          </StyledCompanyInfo>
          {hasFilters && <OrgChartFilters {...filtersProps} />}
        </StyledHeader>

        <StyledDiagramArea>
          {nodeDataArray.length > 0 && (
            <>
              <OrgChartDiagram
                ref={diagramRef}
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
                  onClick={() => diagramRef.current?.zoomToFit()}
                >
                  Zoom to fit
                </StyledTopRightActionButton>
                <StyledTopRightActionButton
                  type="button"
                  onClick={() => diagramRef.current?.centerContent()}
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
      </StyledContainer>
    </ThemeProvider>
  );
};

import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { ARXENA_CHROME_WEBSTORE_URL, LinkedInSearchType } from 'twenty-shared';
import {
  Button,
  IconApi,
  IconBrandChrome,
  IconBrandLinkedin,
  IconChevronDown,
  IconCoins,
  IconComment,
  IconDownload,
  IconGitCommit,
  IconPlus,
  MenuItem
} from 'twenty-ui';

const ORG_CHART_LINKEDIN_SEARCH_TYPE_OPTIONS: {
  value: LinkedInSearchType;
  label: string;
}[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'sales_navigator', label: 'Sales Nav' },
  { value: 'recruiter', label: 'Recruiter' },
];

const ORG_CHART_LINKEDIN_SEARCH_TYPE_TITLE: Record<LinkedInSearchType, string> =
  {
    classic: 'LinkedIn Classic',
    sales_navigator: 'Sales Navigator',
    recruiter: 'LinkedIn Recruiter',
  };

const CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID =
  'candidate-table-jobs-page-menu';

const StyledMenuTriggerButton = styled(Button)`
  flex-direction: row-reverse;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledOrgChartSourceBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => `${theme.spacing(0.5)} 0`};
  width: 100%;
`;

const StyledOrgChartSourceLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.03em;
  padding: 0 ${({ theme }) => theme.spacing(1)};
  text-transform: uppercase;
`;

const StyledOrgChartExtensionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: 0 ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 1.3;
`;

const StyledOrgChartExtensionLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledOrgChartExtensionStatus = styled.span<{
  status: 'checking' | 'installed' | 'not_installed';
}>`
  flex-shrink: 0;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme, status }) => {
    if (status === 'installed') {
      return theme.color.green;
    }
    if (status === 'checking') {
      return theme.font.color.tertiary;
    }
    return theme.font.color.secondary;
  }};
`;

const StyledSegmentedTrack = styled.div`
  display: flex;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  padding: ${({ theme }) => theme.spacing(0.5)};
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledSegmentedOption = styled.button<{ isActive: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  min-height: 32px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(0.5)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-family: inherit;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  ${({ theme, isActive }) =>
    isActive
      ? `
    background: ${theme.background.primary};
    color: ${theme.font.color.primary};
    box-shadow: ${theme.boxShadow.light};
  `
      : `
    background: transparent;
    color: ${theme.font.color.secondary};
    &:hover {
      background: ${theme.background.transparent.light};
      color: ${theme.font.color.primary};
    }
  `}

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: 1px;
  }
`;

type CandidateTableJobsPageMenuDropdownProps = {
  onAddJob: () => void;
  onMergeJobs?: () => void;
  isLinkedinConnected: boolean;
  isWhatsappLoggedIn: boolean;
  isMergeMode?: boolean;
  isExtensionInstalled: boolean;
  isExtensionChecking?: boolean;
  onDownloadClick: () => void;
  creditsTotal?: number;
  onCreditsClick?: () => void;
};

export const CandidateTableJobsPageMenuDropdown = ({
  onAddJob,
  onMergeJobs,
  isLinkedinConnected,
  isWhatsappLoggedIn,
  isMergeMode = false,
  isExtensionInstalled,
  isExtensionChecking = false,
  onDownloadClick,
  creditsTotal,
  onCreditsClick,
}: CandidateTableJobsPageMenuDropdownProps) => {
  const theme = useTheme();
  const { closeDropdown } = useDropdown(
    CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
  );
  const [orgChartLinkedinCandidateSource, setOrgChartLinkedinCandidateSource] =
    useRecoilState(orgChartLinkedinCandidateSourceState);
  const [orgChartLinkedInSearchType, setOrgChartLinkedInSearchType] =
    useRecoilState(orgChartLinkedInSearchTypeState);

  const iconSm = theme.icon.size.sm;

  const chromeExtensionStatus = (() => {
    if (isExtensionChecking) {
      return { key: 'checking' as const, text: 'Checking…' };
    }
    if (isExtensionInstalled) {
      return { key: 'installed' as const, text: 'Installed' };
    }
    return { key: 'not_installed' as const, text: 'Not installed' };
  })();

  return (
    <Dropdown
      dropdownId={CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID}
      dropdownPlacement="bottom-end"
      clickableComponent={
        <StyledMenuTriggerButton
          variant="secondary"
          size="small"
          title="Menu"
          Icon={IconChevronDown}
          dataTestId="candidate-table-jobs-menu"
          ariaLabel="Open jobs menu"
        />
      }
      dropdownMenuWidth={300}
      dropdownComponents={
        <DropdownMenuItemsContainer>
          <MenuItem
            testId="add-new-job"
            text="Add New Job"
            LeftIcon={IconPlus}
            onClick={() => {
              onAddJob();
              closeDropdown();
            }}
          />
          {onMergeJobs !== undefined && !isMergeMode && (
            <MenuItem
              testId="merge-jobs"
              text="Merge jobs"
              LeftIcon={IconGitCommit}
              onClick={() => {
                onMergeJobs();
                closeDropdown();
              }}
            />
          )}
          {!isExtensionInstalled && (
            <MenuItem
              testId="download-app"
              text="Download App"
              LeftIcon={IconDownload}
              onClick={() => {
                onDownloadClick();
                closeDropdown();
              }}
            />
          )}
          <MenuItem
            testId="download-chrome-extension"
            text="Download Chrome Extension"
            LeftIcon={IconBrandChrome}
            onClick={() => {
              window.open(
                ARXENA_CHROME_WEBSTORE_URL,
                '_blank',
                'noopener,noreferrer',
              );
              closeDropdown();
            }}
          />

          {creditsTotal !== undefined && onCreditsClick !== undefined && (
            <MenuItem
              testId="credits-button"
              text="Credits"
              LeftIcon={IconCoins}
              contextualText={String(creditsTotal)}
              onClick={() => {
                onCreditsClick();
                closeDropdown();
              }}
            />
          )}
          <DropdownMenuSeparator />
          <StyledOrgChartSourceBlock
            role="radiogroup"
            aria-label="Org chart data source"
          >
            <StyledOrgChartSourceLabel>
              Org chart data source
            </StyledOrgChartSourceLabel>
            <StyledOrgChartExtensionRow>
              <StyledOrgChartExtensionLabel>
                Chrome extension
              </StyledOrgChartExtensionLabel>
              <StyledOrgChartExtensionStatus
                status={chromeExtensionStatus.key}
                data-testid="org-chart-chrome-extension-status"
              >
                {chromeExtensionStatus.text}
              </StyledOrgChartExtensionStatus>
            </StyledOrgChartExtensionRow>
            <StyledSegmentedTrack>
              <StyledSegmentedOption
                type="button"
                data-testid="org-chart-source-linkedin"
                isActive={orgChartLinkedinCandidateSource === 'unipile'}
                role="radio"
                aria-checked={orgChartLinkedinCandidateSource === 'unipile'}
                onClick={() => {
                  setOrgChartLinkedinCandidateSource('unipile');
                }}
              >
                <IconBrandLinkedin size={iconSm} />
                LinkedIn
              </StyledSegmentedOption>
              <StyledSegmentedOption
                type="button"
                data-testid="org-chart-source-harvest"
                isActive={orgChartLinkedinCandidateSource === 'harvest'}
                role="radio"
                aria-checked={orgChartLinkedinCandidateSource === 'harvest'}
                onClick={() => {
                  setOrgChartLinkedinCandidateSource('harvest');
                }}
              >
                <IconApi size={iconSm} />
                Harvest
              </StyledSegmentedOption>
              {/* <StyledSegmentedOption
                type="button"
                data-testid="org-chart-source-apify"
                isActive={orgChartLinkedinCandidateSource === 'apify'}
                role="radio"
                aria-checked={orgChartLinkedinCandidateSource === 'apify'}
                onClick={() => {
                  setOrgChartLinkedinCandidateSource('apify');
                }}
              >
                <IconApi size={iconSm} />
                Apify
              </StyledSegmentedOption> */}
              {/* <StyledSegmentedOption
                type="button"
                data-testid="org-chart-source-linkedin-xray"
                isActive={orgChartLinkedinCandidateSource === 'linkedin_xray'}
                role="radio"
                aria-checked={
                  orgChartLinkedinCandidateSource === 'linkedin_xray'
                }
                title="LinkedIn X-Ray"
                onClick={() => {
                  setOrgChartLinkedinCandidateSource('linkedin_xray');
                }}
              >
                <IconSearch size={iconSm} />
                X-Ray
              </StyledSegmentedOption> */}
              <StyledSegmentedOption
                type="button"
                data-testid="org-chart-source-m7kq"
                isActive={
                  orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ
                }
                role="radio"
                aria-checked={
                  orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ
                }
                title="Company directory (public data)"
                onClick={() => {
                  setOrgChartLinkedinCandidateSource(ORG_CHART_CANDIDATE_SOURCE_M7KQ);
                }}
              >
                <IconApi size={iconSm} />
                Directory
              </StyledSegmentedOption>
            </StyledSegmentedTrack>
            {orgChartLinkedinCandidateSource === 'unipile' && (
              <>
                <StyledOrgChartSourceLabel>
                  LinkedIn search type
                </StyledOrgChartSourceLabel>
                <StyledSegmentedTrack
                  role="radiogroup"
                  aria-label="LinkedIn search type"
                >
                  {ORG_CHART_LINKEDIN_SEARCH_TYPE_OPTIONS.map((opt) => (
                    <StyledSegmentedOption
                      key={opt.value}
                      type="button"
                      data-testid={`org-chart-search-type-${opt.value}`}
                      isActive={orgChartLinkedInSearchType === opt.value}
                      role="radio"
                      aria-checked={orgChartLinkedInSearchType === opt.value}
                      title={ORG_CHART_LINKEDIN_SEARCH_TYPE_TITLE[opt.value]}
                      onClick={() => {
                        setOrgChartLinkedInSearchType(opt.value);
                      }}
                    >
                      {opt.label}
                    </StyledSegmentedOption>
                  ))}
                </StyledSegmentedTrack>
              </>
            )}
          </StyledOrgChartSourceBlock>
          <DropdownMenuSeparator />
          <MenuItem
            text="LinkedIn"
            LeftIcon={IconBrandLinkedin}
            contextualText={isLinkedinConnected ? 'Connected' : 'Disconnected'}
            disabled
          />
          <MenuItem
            text="WhatsApp"
            LeftIcon={IconComment}
            contextualText={isWhatsappLoggedIn ? 'Connected' : 'Disconnected'}
            disabled
          />
        </DropdownMenuItemsContainer>
      }
      dropdownHotkeyScope={{
        scope: CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
      }}
    />
  );
};

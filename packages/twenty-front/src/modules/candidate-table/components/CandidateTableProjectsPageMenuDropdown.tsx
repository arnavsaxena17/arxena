import { type CSSProperties, type MouseEvent, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MenuItem } from 'twenty-ui/navigation';
import { Button } from 'twenty-ui/input';
import {
  IconApi,
  IconBrowserMaximize,
  IconBrandLinkedin,
  IconChevronDown,
  IconCoins,
  IconComment,
  IconDownload,
  IconGitCommit,
  IconPlus,
} from 'twenty-ui/icon';
import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { RootStackingContextZIndices } from '@/ui/layout/constants/RootStackingContextZIndices';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { DropdownComponentInstanceContext } from '@/ui/layout/dropdown/contexts/DropdownComponentInstanceContext';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useToggleDropdown } from '@/ui/layout/dropdown/hooks/useToggleDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { OverlayContainer } from '@/ui/layout/overlay/components/OverlayContainer';
import { useListenClickOutside } from '@/ui/utilities/pointer-event/hooks/useListenClickOutside';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useTheme } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { ARXENA_CHROME_WEBSTORE_URL } from 'twenty-shared/constants';
import type { LinkedInSearchType } from 'twenty-shared/types';

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

// Trigger stays in-header; panel is portaled so it can stack above PageBody (z-index 25)
const StyledMenuDropdownRoot = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  position: relative;
`;

const StyledMenuDropdownPanel = styled.div`
  position: fixed;
  z-index: ${RootStackingContextZIndices.DropdownPortalBelowModal};
`;

const StyledMenuTriggerButton = styled(Button)`
  flex-direction: row-reverse;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledOrgChartSourceBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${`${themeCssVariables.spacing[0.5]} 0`};
  width: 100%;
`;

const StyledOrgChartSourceLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.03em;
  padding: 0 ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

const StyledOrgChartExtensionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[1]};
  padding: 0 ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.3;
`;

const StyledOrgChartExtensionLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledOrgChartExtensionStatus = styled.span<{
  status: 'checking' | 'installed' | 'not_installed';
}>`
  flex-shrink: 0;
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${({ status }) => {
    if (status === 'installed') {
      return themeCssVariables.color.green;
    }
    if (status === 'checking') {
      return themeCssVariables.font.color.tertiary;
    }
    return themeCssVariables.font.color.secondary;
  }};
`;

const StyledSegmentedTrack = styled.div`
  display: flex;
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.tertiary};
  padding: ${themeCssVariables.spacing[0.5]};
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledSegmentedOption = styled.button<{
  isActive: boolean;
  $layout?: 'column' | 'row';
}>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: ${({ $layout }) => $layout ?? 'column'};
  align-items: center;
  justify-content: center;
  gap: ${themeCssVariables.spacing[0.5]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  min-height: ${({ $layout }) => ($layout === 'row' ? '32px' : '40px')};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[0.5]};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: inherit;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  ${({ isActive }) =>
    isActive
      ? `
    background: ${themeCssVariables.background.primary};
    color: ${themeCssVariables.font.color.primary};
    box-shadow: ${themeCssVariables.boxShadow.light};
  `
      : `
    background: transparent;
    color: ${themeCssVariables.font.color.secondary};
    &:hover {
      background: ${themeCssVariables.background.transparent.light};
      color: ${themeCssVariables.font.color.primary};
    }
  `}

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
    outline-offset: 1px;
  }
`;

const StyledSegmentedOptionLabel = styled.span`
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
`;

type CandidateTableProjectsPageMenuDropdownProps = {
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

export const CandidateTableProjectsPageMenuDropdown = ({
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
}: CandidateTableProjectsPageMenuDropdownProps) => {
  const theme = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const { closeDropdown } = useCloseDropdown();
  const { toggleDropdown } = useToggleDropdown();
  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
  );
  const [orgChartLinkedinCandidateSource, setOrgChartLinkedinCandidateSource] =
    useAtomState(orgChartLinkedinCandidateSourceState);
  const [orgChartLinkedInSearchType, setOrgChartLinkedInSearchType] =
    useAtomState(orgChartLinkedInSearchTypeState);

  const iconSm = theme.icon.size.sm;

  useLayoutEffect(() => {
    if (!isDropdownOpen || !rootRef.current) {
      return;
    }

    const updatePanelPosition = () => {
      if (!rootRef.current) {
        return;
      }

      const triggerRect = rootRef.current.getBoundingClientRect();
      setPanelStyle({
        top: triggerRect.bottom + 4,
        right: window.innerWidth - triggerRect.right,
      });
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isDropdownOpen]);

  useListenClickOutside({
    refs: [rootRef, panelRef],
    listenerId: CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
    enabled: isDropdownOpen,
    callback: () => {
      closeDropdown(CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID);
    },
  });

  const chromeExtensionStatus = (() => {
    if (isExtensionChecking) {
      return { key: 'checking' as const, text: 'Checking…' };
    }
    if (isExtensionInstalled) {
      return { key: 'installed' as const, text: 'Installed' };
    }
    return { key: 'not_installed' as const, text: 'Not installed' };
  })();

  const handleToggleMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    toggleDropdown({
      dropdownComponentInstanceIdFromProps:
        CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
    });
  };

  return (
    <DropdownComponentInstanceContext.Provider
      value={{ instanceId: CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID }}
    >
      <StyledMenuDropdownRoot ref={rootRef}>
        <StyledMenuTriggerButton
          variant="secondary"
          size="small"
          title="Menu"
          Icon={IconChevronDown}
          dataTestId="candidate-table-jobs-menu"
          ariaLabel="Open jobs menu"
          onClick={handleToggleMenu}
        />
        {isDropdownOpen &&
          createPortal(
            <StyledMenuDropdownPanel
              ref={panelRef}
              style={panelStyle}
              id={`${CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID}-options`}
              role="listbox"
            >
              <OverlayContainer>
                <DropdownContent
                  widthInPixels={GenericDropdownContentWidth.ExtraLarge}
                >
                  <DropdownMenuItemsContainer>
                    <MenuItem
                      testId="add-new-job"
                      text="Add New Project"
                      LeftIcon={IconPlus}
                      onClick={() => {
                        onAddJob();
                        closeDropdown(
                          CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
                        );
                      }}
                    />
                    {onMergeJobs !== undefined && !isMergeMode && (
                      <MenuItem
                        testId="merge-jobs"
                        text="Merge jobs"
                        LeftIcon={IconGitCommit}
                        onClick={() => {
                          onMergeJobs();
                          closeDropdown(
                            CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
                          );
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
                          closeDropdown(
                            CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
                          );
                        }}
                      />
                    )}
                    <MenuItem
                      testId="download-chrome-extension"
                      text="Download Chrome Extension"
                      LeftIcon={IconBrowserMaximize}
                      onClick={() => {
                        window.open(
                          ARXENA_CHROME_WEBSTORE_URL,
                          '_blank',
                          'noopener,noreferrer',
                        );
                        closeDropdown(
                          CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
                        );
                      }}
                    />

                    {creditsTotal !== undefined &&
                      onCreditsClick !== undefined && (
                        <MenuItem
                          testId="credits-button"
                          text="Credits"
                          LeftIcon={IconCoins}
                          contextualText={String(creditsTotal)}
                          contextualTextPosition="right"
                          onClick={() => {
                            onCreditsClick();
                            closeDropdown(
                              CANDIDATE_TABLE_JOBS_PAGE_MENU_DROPDOWN_ID,
                            );
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
                          isActive={
                            orgChartLinkedinCandidateSource === 'unipile'
                          }
                          role="radio"
                          aria-checked={
                            orgChartLinkedinCandidateSource === 'unipile'
                          }
                          onClick={() => {
                            setOrgChartLinkedinCandidateSource('unipile');
                          }}
                        >
                          <IconBrandLinkedin size={iconSm} />
                          <StyledSegmentedOptionLabel>
                            LinkedIn
                          </StyledSegmentedOptionLabel>
                        </StyledSegmentedOption>
                        <StyledSegmentedOption
                          type="button"
                          data-testid="org-chart-source-harvest"
                          isActive={
                            orgChartLinkedinCandidateSource === 'harvest'
                          }
                          role="radio"
                          aria-checked={
                            orgChartLinkedinCandidateSource === 'harvest'
                          }
                          onClick={() => {
                            setOrgChartLinkedinCandidateSource('harvest');
                          }}
                        >
                          <IconApi size={iconSm} />
                          <StyledSegmentedOptionLabel>
                            Harvest
                          </StyledSegmentedOptionLabel>
                        </StyledSegmentedOption>
                        <StyledSegmentedOption
                          type="button"
                          data-testid="org-chart-source-m7kq"
                          isActive={
                            orgChartLinkedinCandidateSource ===
                            ORG_CHART_CANDIDATE_SOURCE_M7KQ
                          }
                          role="radio"
                          aria-checked={
                            orgChartLinkedinCandidateSource ===
                            ORG_CHART_CANDIDATE_SOURCE_M7KQ
                          }
                          title="Company directory (public data)"
                          onClick={() => {
                            setOrgChartLinkedinCandidateSource(
                              ORG_CHART_CANDIDATE_SOURCE_M7KQ,
                            );
                          }}
                        >
                          <IconApi size={iconSm} />
                          <StyledSegmentedOptionLabel>
                            Directory
                          </StyledSegmentedOptionLabel>
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
                            {ORG_CHART_LINKEDIN_SEARCH_TYPE_OPTIONS.map(
                              (option) => (
                                <StyledSegmentedOption
                                  key={option.value}
                                  type="button"
                                  $layout="row"
                                  data-testid={`org-chart-search-type-${option.value}`}
                                  isActive={
                                    orgChartLinkedInSearchType === option.value
                                  }
                                  role="radio"
                                  aria-checked={
                                    orgChartLinkedInSearchType === option.value
                                  }
                                  title={
                                    ORG_CHART_LINKEDIN_SEARCH_TYPE_TITLE[
                                      option.value
                                    ]
                                  }
                                  onClick={() => {
                                    setOrgChartLinkedInSearchType(option.value);
                                  }}
                                >
                                  <StyledSegmentedOptionLabel>
                                    {option.label}
                                  </StyledSegmentedOptionLabel>
                                </StyledSegmentedOption>
                              ),
                            )}
                          </StyledSegmentedTrack>
                        </>
                      )}
                    </StyledOrgChartSourceBlock>
                    <DropdownMenuSeparator />
                    <MenuItem
                      text="LinkedIn"
                      LeftIcon={IconBrandLinkedin}
                      contextualText={
                        isLinkedinConnected ? 'Connected' : 'Disconnected'
                      }
                      contextualTextPosition="right"
                      disabled
                    />
                    <MenuItem
                      text="WhatsApp"
                      LeftIcon={IconComment}
                      contextualText={
                        isWhatsappLoggedIn ? 'Connected' : 'Disconnected'
                      }
                      contextualTextPosition="right"
                      disabled
                    />
                  </DropdownMenuItemsContainer>
                </DropdownContent>
              </OverlayContainer>
            </StyledMenuDropdownPanel>,
            document.body,
          )}
      </StyledMenuDropdownRoot>
    </DropdownComponentInstanceContext.Provider>
  );
};

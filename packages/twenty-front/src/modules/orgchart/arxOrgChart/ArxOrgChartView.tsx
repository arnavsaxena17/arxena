import type { ReactNode } from 'react';

import type { OrgChartDiagramProps } from 'twenty-orgchart';
import type { OrgChartNodeData } from 'twenty-shared';

import type { OrgChartDiagramHandle } from 'twenty-orgchart';
import { OrgChartDiagram, OrgChartSearchControls } from 'twenty-orgchart';

import { OrgChartAddToJobModal } from '../components/OrgChartAddToJobModal';
import { OrgChartHeader } from '../components/OrgChartHeader';
import { OrgChartOutreachModal } from '../components/OrgChartOutreachModal';
import { OrgChartResultModal } from '../components/OrgChartResultModal';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import {
  ConfirmationModal,
  StyledCenteredButton,
} from '@/ui/layout/modal/components/ConfirmationModal';
import { IconChevronDown, MenuItem } from 'twenty-ui';
import type { OrgChartHeaderProps } from '../components/OrgChartHeader';

import {
  StyledContainer,
  StyledDiagramArea,
  StyledDiagramBody,
  StyledErrorMessage,
  StyledLeadershipBannerLink,
  StyledLeadershipBannerPaidHighlight,
  StyledLeadershipBannerPaidNote,
  StyledLeadershipInfoBanner,
  StyledLeadershipLoadingOverlay,
  StyledLoadingMessage,
  StyledPreviewBannerSignupButton,
  StyledPreviewPersistentBanner,
  StyledProgressBanner,
  StyledSearchOverlay,
  StyledSpinner,
  StyledTemplateBanner,
  StyledTemplateBannerButton,
  StyledTopRightActionButton,
  StyledTopRightActionsOverlay
} from './ArxOrgChart.styles';

export type ArxOrgChartViewProps = {
  headerProps: OrgChartHeaderProps;
  isLoading: boolean;
  error: string | null;
  nodeDataArray: OrgChartNodeData[];
  isBlankTemplate: boolean;
  accessToken?: string;
  onNavigateToSignup?: () => void;
  showPreviewPersistentBanner: boolean;
  isEnrichedLeadershipLoading: boolean;
  contextProgressMessage?: string | null;
  showContextProgressBanner: boolean;
  isContextLoading: boolean;
  diagramHandleRef: React.Ref<OrgChartDiagramHandle>;
  diagramProps: Omit<OrgChartDiagramProps, 'nodeDataArray'>;
  showNodeCapabilitiesHoverHint: boolean;
  effectiveEmployeeCount?: number;
  leadershipLayerPreviewBanner: { leadershipN: number; fullN: number | null } | null;
  m7kqPreviewOrgChartBanner: { fetchedN: number; fullN: number | null } | null;
  searchControlsProps: any;
  onTopRightLeadershipOrgChart: () => void;

  pendingSearchConfirm: { title: string; run: () => void } | null;
  setPendingSearchConfirm: (next: { title: string; run: () => void } | null) => void;
  candidateSearchConfirmSubtitle: ReactNode;
  previewNodeChoiceSubtitle: ReactNode;
  pendingPreviewNodePeopleChoice: OrgChartNodeData | null;
  setPendingPreviewNodePeopleChoice: (node: OrgChartNodeData | null) => void;

  onConfirmPreviewNodeFullOrgChart: () => void;
  onConfirmPreviewNodeViewAllCandidates: () => void;
  onConfirmPreviewNodeLeadership: () => void;

  contextModalProps: {
    isOpen: boolean;
    title: string;
    isLoading: boolean;
    loadingStartedAt?: number | null;
    loadingProgressMessage?: string | null;
    loadingPage?: number | null;
    loadingTotalPages?: number | null;
    loadingTotalCandidates?: number | null;
    error?: string | null;
    results: any[];
    booleanKeywordsString?: string | null;
    companyWebsite?: string;
    companyId: string;
    onClose: () => void;
    onDownloadCsv?: (() => void) | undefined;
    addToJobInlineContext: any;
    onStop?: (() => void) | undefined;
  } | null;

  nodeDetailModalProps: {
    isOpen: boolean;
    title: string;
    isLoading: boolean;
    error?: string | null;
    results: any[];
    emptyMessage?: string;
    companyWebsite?: string;
    companyId: string;
    onClose: () => void;
    onDownloadCsv?: (() => void) | undefined;
    addToJobInlineContext: any;
    onGetSimilarPeople?: (() => void) | undefined;
  } | null;

  addToJobModalProps: {
    isOpen: boolean;
    onClose: () => void;
    node: OrgChartNodeData | null;
    companyName?: string;
    queueStartChatAfter?: boolean;
    onSuccess: () => void;
  };

  outreachModalProps: {
    isOpen: boolean;
    onClose: () => void;
    channel?: any;
    contextItem?: any;
    node?: OrgChartNodeData | null;
    companyName?: string;
  };
};

export const ArxOrgChartView = ({
  headerProps,
  isLoading,
  error,
  nodeDataArray,
  isBlankTemplate,
  accessToken,
  onNavigateToSignup,
  showPreviewPersistentBanner,
  isEnrichedLeadershipLoading,
  contextProgressMessage,
  showContextProgressBanner,
  isContextLoading,
  diagramHandleRef,
  diagramProps,
  showNodeCapabilitiesHoverHint,
  effectiveEmployeeCount,
  leadershipLayerPreviewBanner,
  m7kqPreviewOrgChartBanner,
  searchControlsProps,
  onTopRightLeadershipOrgChart,
  pendingSearchConfirm,
  setPendingSearchConfirm,
  candidateSearchConfirmSubtitle,
  previewNodeChoiceSubtitle,
  pendingPreviewNodePeopleChoice,
  setPendingPreviewNodePeopleChoice,
  onConfirmPreviewNodeFullOrgChart,
  onConfirmPreviewNodeViewAllCandidates,
  onConfirmPreviewNodeLeadership,
  contextModalProps,
  nodeDetailModalProps,
  addToJobModalProps,
  outreachModalProps,
}: ArxOrgChartViewProps) => {
  const multiSourceDropdownId = 'orgchart-multisource-dropdown';
  const { closeDropdown: closeMultiSourceDropdown } = useDropdown(
    multiSourceDropdownId,
  );

  const selectedMultiSources: string[] = Array.isArray(
    searchControlsProps?.multiSourceSelectedSources,
  )
    ? searchControlsProps.multiSourceSelectedSources
    : [];

  return (
    <StyledContainer>
      <OrgChartHeader {...headerProps} />

      <StyledDiagramArea>
        {showPreviewPersistentBanner && (
          <StyledPreviewPersistentBanner>
            <span>
              {accessToken
                ? 'This is a preview of the org chart. Generate the full org chart from the toolbar to see all employees.'
                : 'This is a preview of the org chart. Get the full org chart for free when you sign up.'}
            </span>
            {!accessToken && (
              <StyledPreviewBannerSignupButton
                title="Sign up free"
                variant="primary"
                accent="blue"
                size="small"
                type="button"
                onClick={onNavigateToSignup}
              />
            )}
          </StyledPreviewPersistentBanner>
        )}
        <StyledDiagramBody>
          {isEnrichedLeadershipLoading && (
            <StyledLeadershipLoadingOverlay>
              <StyledSpinner />
              <span>Loading Leadership Org Chart from Public Sources</span>
            </StyledLeadershipLoadingOverlay>
          )}
          {isLoading && (
            <StyledLoadingMessage>Loading org chart...</StyledLoadingMessage>
          )}
          {showContextProgressBanner && contextProgressMessage && (
            <StyledProgressBanner>{contextProgressMessage}</StyledProgressBanner>
          )}
          {error && <StyledErrorMessage>{error}</StyledErrorMessage>}

          {!isLoading && !error && nodeDataArray.length > 0 && (
            <>
              {isBlankTemplate &&
                (isContextLoading ? (
                  <StyledTemplateBanner>
                    <StyledSpinner />
                    <span>{contextProgressMessage || 'Processing...'}</span>
                  </StyledTemplateBanner>
                ) : (
                  <StyledTemplateBanner>
                    <span>
                      This is a preview template. Generate the full org chart to
                      see all employees.
                    </span>
                    <StyledTemplateBannerButton
                      title={
                        typeof effectiveEmployeeCount === 'number'
                          ? `Generate full org chart (${effectiveEmployeeCount.toLocaleString()} employees)`
                          : 'Generate full org chart'
                      }
                      variant="primary"
                      accent="blue"
                      size="medium"
                      type="button"
                      onClick={searchControlsProps.onGetAll}
                    />
                  </StyledTemplateBanner>
                ))}
              <OrgChartDiagram
                ref={diagramHandleRef}
                nodeDataArray={nodeDataArray}
                showNodeCapabilitiesHoverHint={showNodeCapabilitiesHoverHint}
                {...diagramProps}
              />
              {leadershipLayerPreviewBanner && (
                <StyledLeadershipInfoBanner>
                  {leadershipLayerPreviewBanner.fullN !== null ? (
                    <span>
                      This Leadership Org Chart shows only{' '}
                      {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                      leadership profile
                      {leadershipLayerPreviewBanner.leadershipN === 1 ? '' : 's'}
                      . The full company org chart has{' '}
                      {leadershipLayerPreviewBanner.fullN.toLocaleString()}{' '}
                      profiles — click{' '}
                      <StyledLeadershipBannerLink
                        title="Full org chart"
                        variant="tertiary"
                        accent="blue"
                        size="small"
                        type="button"
                        onClick={searchControlsProps.onGetAll}
                      />{' '}
                      above to load it.
                    </span>
                  ) : (
                    <span>
                      This Leadership Org Chart shows only{' '}
                      {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                      leadership profile
                      {leadershipLayerPreviewBanner.leadershipN === 1 ? '' : 's'}
                      . Click{' '}
                      <StyledLeadershipBannerLink
                        title="Full org chart"
                        variant="tertiary"
                        accent="blue"
                        size="small"
                        type="button"
                        onClick={searchControlsProps.onGetAll}
                      />{' '}
                      above to load the full company org chart.
                    </span>
                  )}
                  <StyledLeadershipBannerPaidNote>
                    <StyledLeadershipBannerPaidHighlight>
                      Small preview only:
                    </StyledLeadershipBannerPaidHighlight>{' '}
                    {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                    {leadershipLayerPreviewBanner.leadershipN === 1
                      ? 'person'
                      : 'people'}{' '}
                    fetched from public sources. Full profile details (contact
                    info, tenure &amp; more) are available for{' '}
                    <StyledLeadershipBannerPaidHighlight>
                      paid customers
                    </StyledLeadershipBannerPaidHighlight>
                    .
                  </StyledLeadershipBannerPaidNote>
                </StyledLeadershipInfoBanner>
              )}
              {m7kqPreviewOrgChartBanner && (
                <StyledLeadershipInfoBanner>
                  <span>
                    Org chart loaded with{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN.toLocaleString()}{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN === 1 ? 'person' : 'people'}{' '}
                    fetched
                    {m7kqPreviewOrgChartBanner.fullN !== null
                      ? ` out of ${m7kqPreviewOrgChartBanner.fullN.toLocaleString()} total employees`
                      : ''}
                    .
                    {m7kqPreviewOrgChartBanner.fullN !== null ? (
                      <>
                        {' '}
                        Click{' '}
                        <StyledLeadershipBannerLink
                          title="Full org chart"
                          variant="tertiary"
                          accent="blue"
                          size="small"
                          type="button"
                          onClick={searchControlsProps.onGetAll}
                        />{' '}
                        above to expand the preview.
                      </>
                    ) : null}
                  </span>
                  <StyledLeadershipBannerPaidNote>
                    <StyledLeadershipBannerPaidHighlight>
                      Small preview only:
                    </StyledLeadershipBannerPaidHighlight>{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN.toLocaleString()}{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN === 1 ? 'person' : 'people'}{' '}
                    fetched. Full profile details (verified emails, phone numbers
                    &amp; more) are available for{' '}
                    <StyledLeadershipBannerPaidHighlight>
                      paid customers
                    </StyledLeadershipBannerPaidHighlight>
                    .
                  </StyledLeadershipBannerPaidNote>
                </StyledLeadershipInfoBanner>
              )}
              <StyledTopRightActionsOverlay>
                <StyledTopRightActionButton
                  title={
                    typeof effectiveEmployeeCount === 'number'
                      ? `Full org chart (${effectiveEmployeeCount.toLocaleString()})`
                      : 'All'
                  }
                  variant="secondary"
                  accent="default"
                  size="small"
                  type="button"
                  onClick={searchControlsProps.onGetAll}
                />
                <Dropdown
                  dropdownId={multiSourceDropdownId}
                  dropdownPlacement="bottom-end"
                  clickableComponent={
                    <StyledTopRightActionButton
                      title={`Multi-source${
                        selectedMultiSources.length > 0
                          ? ` (${selectedMultiSources.length})`
                          : ''
                      }`}
                      variant="secondary"
                      accent="default"
                      size="small"
                      type="button"
                      Icon={IconChevronDown}
                      justify="center"
                    />
                  }
                  dropdownMenuWidth={280}
                  dropdownComponents={
                    <DropdownMenuItemsContainer>
                      <MenuItem
                        text="Generate multi-source full org chart"
                        onClick={() => {
                          closeMultiSourceDropdown();
                          searchControlsProps.onGetAllMultiSource?.();
                        }}
                      />
                      <DropdownMenuSeparator />
                      <MenuItem
                        text="LinkedIn (Unipile)"
                        contextualText={
                          selectedMultiSources.includes('unipile') ? 'On' : 'Off'
                        }
                        onClick={() => {
                          searchControlsProps.onToggleMultiSource?.('unipile');
                        }}
                      />
                      <MenuItem
                        text="Public Directory"
                        contextualText={
                          selectedMultiSources.includes('apollo') ? 'On' : 'Off'
                        }
                        onClick={() => {
                          searchControlsProps.onToggleMultiSource?.('apollo');
                        }}
                      />
                      <MenuItem
                        text="Leadership only"
                        contextualText={
                          selectedMultiSources.includes('theorg') ? 'On' : 'Off'
                        }
                        onClick={() => {
                          searchControlsProps.onToggleMultiSource?.('theorg');
                        }}
                      />
                      <MenuItem
                        text="Business Divisions"
                        contextualText={
                          selectedMultiSources.includes('officialboard')
                            ? 'On'
                            : 'Off'
                        }
                        onClick={() => {
                          searchControlsProps.onToggleMultiSource?.(
                            'officialboard',
                          );
                        }}
                      />
                    </DropdownMenuItemsContainer>
                  }
                  dropdownHotkeyScope={{ scope: multiSourceDropdownId }}
                />
                <StyledTopRightActionButton
                  title="View all candidates"
                  variant="secondary"
                  accent="default"
                  size="small"
                  type="button"
                  onClick={searchControlsProps.onViewAllCandidates}
                />
                <StyledTopRightActionButton
                  title={
                    isEnrichedLeadershipLoading
                      ? 'Loading Leadership Org Chart'
                      : 'Leadership Org Chart'
                  }
                  variant="secondary"
                  accent="default"
                  size="small"
                  type="button"
                  disabled={isEnrichedLeadershipLoading}
                  onClick={onTopRightLeadershipOrgChart}
                />
              </StyledTopRightActionsOverlay>
              <StyledSearchOverlay>
                <OrgChartSearchControls {...searchControlsProps} />
              </StyledSearchOverlay>
            </>
          )}

          {!isLoading && !error && nodeDataArray.length === 0 && (
            <StyledLoadingMessage>No org chart data available.</StyledLoadingMessage>
          )}

          {contextModalProps?.isOpen ? (
            <OrgChartResultModal
              title={contextModalProps.title}
              isLoading={contextModalProps.isLoading}
              loadingStartedAt={contextModalProps.loadingStartedAt}
              loadingProgressMessage={contextModalProps.loadingProgressMessage}
              loadingPage={contextModalProps.loadingPage}
              loadingTotalPages={contextModalProps.loadingTotalPages}
              loadingTotalCandidates={contextModalProps.loadingTotalCandidates}
              error={contextModalProps.error ?? null}
              results={contextModalProps.results}
              booleanKeywordsString={contextModalProps.booleanKeywordsString}
              companyWebsite={contextModalProps.companyWebsite}
              companyId={contextModalProps.companyId}
              onClose={contextModalProps.onClose}
              onDownloadCsv={contextModalProps.onDownloadCsv}
              addToJobInlineContext={contextModalProps.addToJobInlineContext}
              onStop={contextModalProps.onStop}
            />
          ) : null}

          {nodeDetailModalProps?.isOpen ? (
            <OrgChartResultModal
              title={nodeDetailModalProps.title}
              isLoading={nodeDetailModalProps.isLoading}
              error={nodeDetailModalProps.error ?? null}
              results={nodeDetailModalProps.results}
              emptyMessage={nodeDetailModalProps.emptyMessage}
              companyWebsite={nodeDetailModalProps.companyWebsite}
              companyId={nodeDetailModalProps.companyId}
              onClose={nodeDetailModalProps.onClose}
              onDownloadCsv={nodeDetailModalProps.onDownloadCsv}
              addToJobInlineContext={nodeDetailModalProps.addToJobInlineContext}
              onGetSimilarPeople={nodeDetailModalProps.onGetSimilarPeople}
            />
          ) : null}

          <OrgChartAddToJobModal
            isOpen={addToJobModalProps.isOpen}
            onClose={addToJobModalProps.onClose}
            node={addToJobModalProps.node}
            companyName={addToJobModalProps.companyName}
            queueStartChatAfter={addToJobModalProps.queueStartChatAfter}
            onSuccess={addToJobModalProps.onSuccess}
          />

          <OrgChartOutreachModal
            isOpen={outreachModalProps.isOpen}
            onClose={outreachModalProps.onClose}
            channel={outreachModalProps.channel}
            contextItem={outreachModalProps.contextItem}
            node={outreachModalProps.node ?? null}
            companyName={outreachModalProps.companyName}
          />
        </StyledDiagramBody>
      </StyledDiagramArea>

      <ConfirmationModal
        isOpen={pendingSearchConfirm !== null}
        setIsOpen={(open) => {
          if (!open) {
            setPendingSearchConfirm(null);
          }
        }}
        title={pendingSearchConfirm?.title ?? ''}
        subtitle={candidateSearchConfirmSubtitle}
        onConfirmClick={() => {
          pendingSearchConfirm?.run();
        }}
        deleteButtonText="Confirm"
        confirmButtonAccent="blue"
      />

      <ConfirmationModal
        isOpen={pendingPreviewNodePeopleChoice !== null}
        setIsOpen={(open) => {
          if (!open) {
            setPendingPreviewNodePeopleChoice(null);
          }
        }}
        title="Preview org chart"
        subtitle={previewNodeChoiceSubtitle}
        onConfirmClick={onConfirmPreviewNodeFullOrgChart}
        deleteButtonText="View full org chart"
        confirmButtonAccent="blue"
        AdditionalButtons={
          <>
            <StyledCenteredButton
              variant="secondary"
              accent="blue"
              title="View all candidates in this function"
              fullWidth
              onClick={onConfirmPreviewNodeViewAllCandidates}
            />
            <StyledCenteredButton
              variant="secondary"
              accent="blue"
              title="Leadership org chart"
              fullWidth
              onClick={onConfirmPreviewNodeLeadership}
            />
          </>
        }
      />
    </StyledContainer>
  );
};


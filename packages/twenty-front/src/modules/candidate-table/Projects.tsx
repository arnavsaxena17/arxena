import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconDatabase } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useHasAccessTokenPair } from '@/auth/hooks/useHasAccessTokenPair';
import { useQuery } from '@apollo/client/react';
import { AppPath } from 'twenty-shared/types';

import { Mixpanel } from '~/mixpanel';

import { ArxEnrichmentModal } from '@/arx-ai-filtering/arxEnrichmentModal';
import { useSelectedRecordForEnrichment } from '@/arx-ai-filtering/hooks/useSelectedRecordForEnrichment';
import { isArxEnrichModalOpenState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { useOpenAddProjectModal } from '@/arx-jd-upload/hooks/useOpenAddProjectModal';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { ArxDownloadModal } from '@/candidate-table/components/ArxDownloadModal';
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { MergeProjectsModal } from '@/candidate-table/components/MergeProjectsModal';
import { ProjectCard } from '@/candidate-table/ProjectCard';
import { projectsState } from '@/candidate-table/states/states';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordTableContextProvider } from '@/object-record/record-table/contexts/RecordTableContext';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { OrgChartWorkspaceReadyEmptyState } from '@/orgchart/components/OrgChartWorkspaceReadyEmptyState';
import { orgChartSelectionSearch } from '@/orgchart/utils/orgChartUtils';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { AnimatedPlaceholder, AnimatedPlaceholderEmptyContainer, AnimatedPlaceholderEmptySubTitle, AnimatedPlaceholderEmptyTextContainer, AnimatedPlaceholderEmptyTitle } from 'twenty-ui/feedback';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';
import { useBaileysConnection } from '../baileys/contexts/BaileysContext';
import { useUnipile } from '../unipile/contexts/UnipileContext';
import { useWebSocket } from '../websocket-context/hooks/useWebSocket';
import { useWebSocketEvent } from '../websocket-context/useWebSocketEvent';
import { useChromeExtensionDetection } from './hooks/useChromeExtensionDetection';
import { useProjectRefetch } from './hooks/useProjectRefetch';
import { useProjectStateReset } from './hooks/useProjectStateReset';
import { processedDataSelector } from './states/states';
const ArxOrgChart = React.lazy(() =>
  import('@/orgchart/ArxOrgChart').then((m) => ({ default: m.ArxOrgChart })),
);

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
    margin: 0;
    height: 100vh;
  }
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  /* Above page header (20), below right drawer (30) */
  z-index: 25;

  @media (max-width: 768px) {
    overflow: auto;
  }
`;

const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;

  @media (max-width: 768px) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: ${themeCssVariables.background.primary};
  }
`;

const StyledTabListContainer = styled.div``;

const StyledProjectCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  padding: ${themeCssVariables.spacing[4]};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: ${themeCssVariables.spacing[2]};
  }
`;

const StyledJobsSection = styled.div`
  padding: ${themeCssVariables.spacing[4]};

  @media (max-width: 768px) {
    padding: ${themeCssVariables.spacing[2]};
  }
`;

const StyledContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledSectionHeader = styled.div`
  align-items: center;
  border-bottom: 2px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledSectionCount = styled.span`
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledSectionDivider = styled.div`
  background-color: ${themeCssVariables.border.color.light};
  height: 1px;
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledAddButtonWrapper = styled.div`
  @media (max-width: 768px) {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;

    button {
      border-radius: 50%;
      width: 56px;
      height: 56px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px ${themeCssVariables.border.color.light};

      span {
        display: none;
      }

      svg {
        width: 24px;
        height: 24px;
      }
    }
  }
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${themeCssVariables.font.weight.regular};
  gap: ${themeCssVariables.betweenSiblingsGap};
`;

export const Projects = () => {
  // const { candidateId } = useParams<{ candidateId: string }>();
  const candidateId = '1'; // Replace with your candidateId
  const filterDropdownId = 'job-filter'; // Define a unique ID for the filter dropdown
  const recordIndexId = 'jobs'; // Define a unique ID for the record index context (adjust if needed)

  // TODO: Get objectMetadataItem and viewType dynamically if needed for ObjectOptionsDropdown
  const mockObjectMetadataItem = { nameSingular: 'project' }; // Placeholder
  const { objectMetadataItems } = useObjectMetadataItems();
  const jobMetadataItem = useMemo(
    () =>
      objectMetadataItems.find((item) => item.nameSingular === 'project'),
    [objectMetadataItems],
  );
  let updatedMetadataStructureLoaded = false;

  updatedMetadataStructureLoaded = !!jobMetadataItem;

  // Jobs populated by useProjectRefetch via REST API
  const projects = useAtomStateValue(projectsState);

  useEffect(() => {
    Mixpanel.track('job_list_view');
  }, []);

  // Placeholder value for RecordIndexContext
  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/projects/${recordId}`,
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'jobs',
    objectNameSingular: 'project',
    objectMetadataItem: mockObjectMetadataItem as any, // Use placeholder, cast as any
    recordIndexId: recordIndexId,
  };

  // Initialize the spreadsheet import hook for candidates only when metadata is loaded
  const { openObjectRecordsSpreadsheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');
  const isArxEnrichModalOpen = useAtomStateValue(isArxEnrichModalOpenState);
  const [, setIsArxEnrichModalOpen] = useAtomState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const isArxUploadJDModalOpen = useAtomStateValue(isArxUploadJDModalOpenState);
  const [, setArxUploadJDModalMode] = useAtomState(arxUploadJDModalModeState);
  const { openAddJobModal } = useOpenAddProjectModal();

  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

  const enqueueVariantSnackBar = useCallback(
    (message: string, variant: SnackBarVariant) => {
      if (variant === SnackBarVariant.Success) {
        enqueueSuccessSnackBar({ message });
        return;
      }
      if (variant === SnackBarVariant.Error) {
        enqueueErrorSnackBar({ message });
        return;
      }
      if (variant === SnackBarVariant.Warning) {
        enqueueWarningSnackBar({ message });
        return;
      }
      enqueueInfoSnackBar({ message });
    },
    [
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
      enqueueInfoSnackBar,
      enqueueWarningSnackBar,
    ],
  );
  const hasToken = useHasAccessTokenPair();
  const navigate = useNavigate();

  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled, isChecking: isExtensionChecking } =
    useChromeExtensionDetection();
  const { resetJobStates } = useProjectStateReset();
  const { refetchJobs } = useProjectRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;

  const { socket } = useWebSocket();
  const { data: creditsData } = useQuery(WORKSPACE_CREDITS);
  const credits = (creditsData as {
    workspaceCredits?: {
      orgChartCredits: number;
      revealCredits: number;
      apiCredits: number;
      revealCreditsAsEmailEquivalent?: number;
      revealCreditsAsPhoneEquivalent?: number;
      emailRevealCost?: number;
      phoneRevealCost?: number;
    };
  } | undefined)?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits ?? undefined;
  const revealCredits = credits?.revealCredits ?? undefined;
  const apiCredits = credits?.apiCredits ?? undefined;
  const revealCreditsAsEmailEquivalent =
    credits?.revealCreditsAsEmailEquivalent ?? undefined;
  const revealCreditsAsPhoneEquivalent =
    credits?.revealCreditsAsPhoneEquivalent ?? undefined;
  const emailRevealCost = credits?.emailRevealCost ?? undefined;
  const phoneRevealCost = credits?.phoneRevealCost ?? undefined;
  const [hasInsufficientCredits, setHasInsufficientCredits] = useState(false);
  const [selectedOrgChartCompany, setSelectedOrgChartCompany] = useState<{
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  } | null>(null);

  const [selectedJobForOrgChart, setSelectedJobForOrgChart] = useState<{
    projectId: string;
    jobName: string;
  } | null>(null);

  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useAtomState(isBulkMessageModalOpenState);

  const handleCompanySelect = useCallback(
    (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
      companyDomain?: string;
    }) => {
      setSelectedOrgChartCompany(company);
      setSelectedJobForOrgChart(null);
      navigate(
        {
          pathname: `/${AppPath.OrgChart}/${company.companyId}`,
          search: orgChartSelectionSearch(company),
        },
        { state: { company } },
      );
    },
    [navigate],
  );

  const handleClearOrgChart = useCallback(() => {
    setSelectedOrgChartCompany(null);
    setSelectedJobForOrgChart(null);
  }, []);

  const handleOpenJobOrgChart = useCallback(
    (projectId: string, jobName: string) => {
      setSelectedOrgChartCompany(null);
      setSelectedJobForOrgChart({ projectId, jobName });
    },
    [],
  );

  // Reset job states when Projects component mounts to ensure clean state
  useEffect(() => {
    resetJobStates();
    // Explicitly reset modal mode to create when Projects component mounts
    setArxUploadJDModalMode('create');
  }, [resetJobStates, setArxUploadJDModalMode]);

  // Fetch jobs from REST API when metadata is loaded
  useEffect(() => {
    if (updatedMetadataStructureLoaded && jobMetadataItem) {
      console.log('Metadata loaded, fetching jobs from REST API...');
      refetchJobsRef.current();
    }
  }, [updatedMetadataStructureLoaded, jobMetadataItem?.id]);

  // Track previous modal state to detect when it closes
  const prevModalOpenRef = useRef(false);

  // Effect to refetch jobs when ArxJDUploadModal closes
  useEffect(() => {
    // Only refetch if modal was open and is now closed
    if (prevModalOpenRef.current && !isArxUploadJDModalOpen) {
      console.log('ArxJDUploadModal closed, refetching jobs...');
      refetchJobsRef.current();
    }

    // Update the previous state
    prevModalOpenRef.current = isArxUploadJDModalOpen;
  }, [isArxUploadJDModalOpen]);

  useWebSocketEvent<{ message: string; timestamp: string }>(
    'send_notification_to_recruiter',
    (data) => {
      console.log('Projects component received WebSocket event:', data);
      try {
        // Send acknowledgment back to server immediately
        if (socket?.connected) {
          const ackData = {
            event: 'send_notification_to_recruiter',
            timestamp: data.timestamp,
            status: 'received',
            message: data.message,
            userId: currentWorkspaceMember?.id // Add userId from context
          };
          console.log('Sending notification acknowledgment:', ackData);
          socket.emit('notification_received', ackData);
        } else {
          console.error('Socket not connected, cannot send acknowledgment');
        }

        // Show notification after sending acknowledgment
        enqueueSuccessSnackBar({ message: data.message });
      } catch (error) {
        console.error('Error handling notification:', error);
      }
    },
    [socket, currentWorkspaceMember?.id] // Add currentWorkspaceMember.id to dependencies
  );

  // Add new test-snackbar event listener
  useWebSocketEvent<{ variant: string; message: string }>(
    'test-snackbar',
    (data: { variant: string; message: string }) => {
      console.log('Projects component received test snackbar event:', data);
      if (data?.message) {
        const variant = data.variant === 'success'
          ? SnackBarVariant.Success
          : data.variant === 'error'
          ? SnackBarVariant.Error
          : SnackBarVariant.Info;

        enqueueVariantSnackBar(data.message, variant);
      }
    },
    []
  );

  // Add socket event listener for insufficient credits
  useWebSocketEvent<{ hasInsufficientCredits: boolean }>(
    'openai_credits_status',
    (data) => {
      console.log('Received OpenAI credits status:', data);
      setHasInsufficientCredits(data.hasInsufficientCredits);
    },
    []
  );

  const handleAddCredits = () => {
    window.open('https://platform.openai.com/account/billing/overview', '_blank');
  };

  const handleEnrichment = () => {
    if (!candidateId) {
      alert('Please select a chat to enrich');
      return;
    }
    setIsArxEnrichModalOpen(true);
  };

  const handleImportCandidates = () => {
    if (!updatedMetadataStructureLoaded) {
      alert('System is still loading. Please try again in a moment.');
      return;
    }
    openObjectRecordsSpreadsheetImportDialog();
  };

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const processedData = useAtomStateValue(processedDataSelector);

  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isMergeProjectsModalOpen, setIsMergeProjectsModalOpen] = useState(false);

  const handleMergeJobs = useCallback(() => setIsMergeMode(true), []);
  const handleMergeModeCancel = useCallback(() => {
    setIsMergeMode(false);
    setSelectedProjectIds(new Set());
  }, []);
  const handleToggleJobSelect = useCallback((projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);
  const handleMergeSelected = useCallback(() => {
    if (selectedProjectIds.size >= 2) {
      setIsMergeProjectsModalOpen(true);
    }
  }, [selectedProjectIds.size]);
  const handleMergeProjectsModalClose = useCallback(() => {
    setIsMergeProjectsModalOpen(false);
    handleMergeModeCancel();
  }, [handleMergeModeCancel]);

  const handleDownloadClick = () => {
    console.log("Downloading app");
    setIsDownloadModalOpen(true);
  };

  const hasJobs = projects && projects.length > 0;

  const showSearch = hasJobs && updatedMetadataStructureLoaded && !!jobMetadataItem;

  const sortedJobs = projects ? [...projects].sort((a, b) => {
    // First sort by active status (active jobs first)
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    // Then sort by creation date (newest first) within each status group
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  }) : [];

  // If metadata isn't loaded yet, show a loading state
  if (!updatedMetadataStructureLoaded || !jobMetadataItem) {
    return (
      <SpreadsheetImportProvider>
        <StyledPageContainer>
          <CandidateTablePageHeader
            title="Projects"
            Icon={IconDatabase}
            onAddJob={openAddJobModal}
            onOrgCharts={() => navigate(`/${AppPath.OrgChart}`)}
            onCompanySelect={hasJobs ? handleCompanySelect : undefined}
            hasToken={!!hasToken}
            isExtensionInstalled={isExtensionInstalled}
            isExtensionChecking={isExtensionChecking}
            onDownloadClick={handleDownloadClick}
            hasInsufficientCredits={hasInsufficientCredits}
            onAddCredits={handleAddCredits}
            isLinkedinConnected={isLinkedinConnected}
            isWhatsappLoggedIn={isWhatsappLoggedIn}
            orgChartCredits={orgChartCredits}
            revealCredits={revealCredits}
            apiCredits={apiCredits}
            revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
            revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
            emailRevealCost={emailRevealCost}
            phoneRevealCost={phoneRevealCost}
          />
          <StyledPageBody>
            <AnimatedPlaceholderEmptyContainer>
              <AnimatedPlaceholder type="noRecord" />
              <AnimatedPlaceholderEmptyTextContainer>
                <AnimatedPlaceholderEmptyTitle>
                  Loading your Recruiter AI Models
                </AnimatedPlaceholderEmptyTitle>
                <AnimatedPlaceholderEmptySubTitle>
                  Your AI powered models will be ready in about 10 minutes.
                  <br />
                  We will notify you when they are ready.
                </AnimatedPlaceholderEmptySubTitle>
              </AnimatedPlaceholderEmptyTextContainer>
            </AnimatedPlaceholderEmptyContainer>
          </StyledPageBody>
        </StyledPageContainer>
      </SpreadsheetImportProvider>
    );
  }
  return (
    <SpreadsheetImportProvider>
      <RecordTableContextProvider value={{
        recordTableId: 'jobs',
        viewBarId: 'jobs',
        objectNameSingular: 'project',
        objectMetadataItem: jobMetadataItem as any,
        visibleTableColumns: [],
      }}>
        <StyledPageContainer>
          <CandidateTablePageHeader
            title="Projects"
            Icon={IconDatabase}
            onAddJob={openAddJobModal}
            onOrgCharts={() => navigate(`/${AppPath.OrgChart}`)}
            onCompanySelect={hasJobs ? handleCompanySelect : undefined}
            hasToken={!!hasToken}
            isExtensionInstalled={isExtensionInstalled}
            isExtensionChecking={isExtensionChecking}
            onDownloadClick={handleDownloadClick}
            hasInsufficientCredits={hasInsufficientCredits}
            onAddCredits={handleAddCredits}
            isLinkedinConnected={isLinkedinConnected}
            isWhatsappLoggedIn={isWhatsappLoggedIn}
            orgChartCredits={orgChartCredits}
            revealCredits={revealCredits}
            apiCredits={apiCredits}
            revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
            revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
            emailRevealCost={emailRevealCost}
            phoneRevealCost={phoneRevealCost}
            onMergeJobs={hasJobs && !selectedOrgChartCompany ? handleMergeJobs : undefined}
            isMergeMode={isMergeMode}
            onMergeModeCancel={handleMergeModeCancel}
            mergeSelectedCount={selectedProjectIds.size}
            onMergeSelected={handleMergeSelected}
          />
          <StyledPageBody>
              {selectedOrgChartCompany ? (
                <React.Suspense fallback={null}>
                  <ArxOrgChart
                    key={selectedOrgChartCompany.companyId}
                    companyId={selectedOrgChartCompany.companyId}
                    companyName={selectedOrgChartCompany.companyName}
                    website={selectedOrgChartCompany.website}
                    locationName={selectedOrgChartCompany.locationName}
                    industry={selectedOrgChartCompany.industry}
                    profileCount={selectedOrgChartCompany.profileCount}
                    linkedinUrl={selectedOrgChartCompany.linkedinUrl}
                    companyDomain={selectedOrgChartCompany.companyDomain}
                    onBack={handleClearOrgChart}
                  />
                </React.Suspense>
              ) : selectedJobForOrgChart ? (
                <React.Suspense fallback={null}>
                  <ArxOrgChart
                    key={selectedJobForOrgChart.projectId}
                    companyId={selectedJobForOrgChart.projectId}
                    companyName={selectedJobForOrgChart.jobName}
                    onBack={handleClearOrgChart}
                    projectId={selectedJobForOrgChart.projectId}
                  />
                </React.Suspense>
              ) : (
              <RecordIndexContextProvider value={recordIndexContextValue}>
                <ViewComponentInstanceContext.Provider value={{ instanceId: recordIndexId }} >
                  {/* <StyledTopBar
                    leftComponent={ <StyledTabListContainer> </StyledTabListContainer> }
                    handleEnrichment={handleEnrichment}
                    handleAddJob={openAddJobModal}
                    handleImportCandidates={handleImportCandidates}
                    showEnrichment={true}
                    showAddJob={true}
                    showSearch={showSearch}
                    showSorting={showSearch}
                    rightComponent={
                      <StyledRightSection>
                        <ObjectFilterDropdownComponentInstanceContext.Provider value={{ instanceId: filterDropdownId }} >
                          <ObjectFilterDropdownButton filterDropdownId={filterDropdownId} hotkeyScope={{ scope: FiltersHotkeyScope.ObjectFilterDropdownButton, }} />
                        </ObjectFilterDropdownComponentInstanceContext.Provider>
                        <ObjectSortDropdownComponentInstanceContext.Provider value={{ instanceId: recordIndexId }} >
                          <ObjectSortDropdownButton hotkeyScope={{ scope: FiltersHotkeyScope.ObjectSortDropdownButton, }} />
                        </ObjectSortDropdownComponentInstanceContext.Provider>
                        <ChatOptionsDropdownButton />
                      </StyledRightSection>
                    }
                  /> */}

                  <StyledContentContainer>
                    {hasJobs ? (
                      <>
                        <StyledJobsSection>
                          <StyledSectionHeader>
                            <StyledSectionTitle>Active Projects</StyledSectionTitle>
                            <StyledSectionCount>
                              {sortedJobs.filter(job => job.isActive).length} jobs
                            </StyledSectionCount>
                          </StyledSectionHeader>
                          <StyledProjectCardsGrid>
                            {sortedJobs
                              .filter(job => job.isActive)
                              .map((job) => (
                                <ProjectCard
                                  key={job.id}
                                  id={job.id}
                                  name={job.name}
                                  createdAt={job.createdAt || new Date().toISOString()}
                                  createdBy={job.createdBy}
                                  isActive={job.isActive}
                                  jobLocation={job.jobLocation}
                                  searchName={job.searchName}
                                  isMergeMode={isMergeMode}
                                  isSelected={selectedProjectIds.has(job.id)}
                                  onToggleSelect={handleToggleJobSelect}
                                  onOpenOrgChart={handleOpenJobOrgChart}
                                />
                              ))}
                          </StyledProjectCardsGrid>
                        </StyledJobsSection>

                        {sortedJobs.some(job => !job.isActive) && (
                          <>
                            <StyledSectionDivider />
                            <StyledJobsSection>
                              <StyledSectionHeader>
                                <StyledSectionTitle>Inactive Projects</StyledSectionTitle>
                                <StyledSectionCount>
                                  {sortedJobs.filter(job => !job.isActive).length} jobs
                                </StyledSectionCount>
                              </StyledSectionHeader>
                              <StyledProjectCardsGrid>
                                {sortedJobs
                                  .filter(job => !job.isActive)
                                  .map((job) => (
                                    <ProjectCard
                                      key={job.id}
                                      id={job.id}
                                      name={job.name}
                                      createdAt={job.createdAt || new Date().toISOString()}
                                      createdBy={job.createdBy}
                                      isActive={job.isActive}
                                      jobLocation={job.jobLocation}
                                      searchName={job.searchName}
                                      isMergeMode={isMergeMode}
                                      isSelected={selectedProjectIds.has(job.id)}
                                      onToggleSelect={handleToggleJobSelect}
                                      onOpenOrgChart={handleOpenJobOrgChart}
                                    />
                                  ))}
                              </StyledProjectCardsGrid>
                            </StyledJobsSection>
                          </>
                        )}
                      </>
                    ) : (
                      <OrgChartWorkspaceReadyEmptyState
                        onCompanySelect={handleCompanySelect}
                        hasToken={hasToken}
                        orgChartCredits={orgChartCredits}
                      />
                    )}
                  </StyledContentContainer>
                </ViewComponentInstanceContext.Provider>
              </RecordIndexContextProvider>
              )}

              {isArxEnrichModalOpen ? (
                <ArxEnrichmentModal
                  objectNameSingular="project"
                  objectRecordId={candidateId}
                />
              ) : (
                <></>
              )}


              <ArxDownloadModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
              />

              {isMergeProjectsModalOpen && (
                <MergeProjectsModal
                  isOpen={isMergeProjectsModalOpen}
                  onClose={handleMergeProjectsModalClose}
                  sourceProjectIds={Array.from(selectedProjectIds)}
                  sourceJobs={sortedJobs.filter((j) => selectedProjectIds.has(j.id)).map((j) => ({ id: j.id, name: j.name }))}
                  onSuccess={() => refetchJobs()}
                />
              )}

              {isBulkMessageModalOpen && (
                <BulkMessageModal />
              )}
            </StyledPageBody>
        </StyledPageContainer>
      </RecordTableContextProvider>
    </SpreadsheetImportProvider>
  );
};

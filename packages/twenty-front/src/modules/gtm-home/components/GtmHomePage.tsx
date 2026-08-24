import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CreditHistoryModal } from '@/billing/components/CreditHistoryModal';
import { WORKSPACE_CREDITS } from '@/billing/graphql/workspaceCredits';
import { ArxDownloadModal } from '@/candidate-table/components/ArxDownloadModal';
import { CandidateTableProjectsPageMenuDropdown } from '@/candidate-table/components/CandidateTableProjectsPageMenuDropdown';
import { useChromeExtensionDetection } from '@/candidate-table/hooks/useChromeExtensionDetection';
import { GtmCompaniesPanel } from '@/gtm-home/components/GtmCompaniesPanel';
import { GtmMainTabs } from '@/gtm-home/components/GtmMainTabs';
import { GtmNeedsConnectionBanner } from '@/gtm-home/components/GtmNeedsConnectionBanner';
import { GtmPeoplePanel } from '@/gtm-home/components/GtmPeoplePanel';
import { GtmRunProgressHeader } from '@/gtm-home/components/GtmRunProgressHeader';
import { GtmSetupPanel } from '@/gtm-home/components/GtmSetupPanel';
import { GtmWorkflowPanel } from '@/gtm-home/components/GtmWorkflowPanel';
import { GtmWorkflowToolbar } from '@/gtm-home/components/GtmWorkflowToolbar';
import { GTM_PROJECT_ID_QUERY_PARAM } from '@/gtm-home/constants/gtm-command.constants';
import { useGtmLiveWorkingSet } from '@/gtm-home/hooks/useGtmLiveWorkingSet';
import {
  type GtmWorkflowEmbedMode,
  useGtmWorkflowEmbed,
} from '@/gtm-home/hooks/useGtmWorkflowEmbed';
import {
  buildGtmCommandContextPrompt,
  gtmCommandContextState,
} from '@/gtm-home/states/gtmCommandContextState';
import {
  buildGtmFindCompaniesSendPrompt,
  buildGtmFindPeopleSendPrompt,
} from '@/gtm-home/types/gtm-home.types';
import {
  parseGtmIcpSpec,
  stringifyGtmIcpSpec,
} from '@/gtm-home/utils/gtm-effective-icp.util';
import { regenerateGtmWorkspaceProfile } from '@/gtm-home/utils/gtm-workspace-profile-regenerate';
import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useGetResourceCreditUsage } from '@/settings/billing/hooks/useGetResourceCreditUsage';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { WorkflowRunRateLimitSnackBarEffect } from '@/workflow/components/WorkflowRunRateLimitSnackBarEffect';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledMain = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledSetupWrap = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledWorkflowContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledLoading = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  padding: ${themeCssVariables.spacing[6]};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[6]};
`;

type GtmSetupPersistTarget = 'workspaceProfile' | 'project';

export const GtmHomePage = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get(GTM_PROJECT_ID_QUERY_PARAM) ?? 'resolving';

  return <GtmHomePageContent key={projectId} />;
};

const GtmHomePageContent = () => {
  const {
    loading,
    workspaceCompany,
    workspaceProfile,
    refetchWorkspaceProfiles,
    companies,
    people,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    createGtmProject,
    isIcpRunOverride,
    linkedinConnected,
    gmailConnected,
    whatsappConnected,
    activeTab,
    setActiveTab,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedPersonId,
    setSelectedPersonId,
    peopleTableInstanceId,
  } = useGtmLiveWorkingSet();
  const isWorkflowTab = activeTab === 'workflow';
  const isSetupTab = activeTab === 'setup';
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const { updateOneRecord } = useUpdateOneRecord();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const setGtmCommandContext = useSetAtomState(gtmCommandContextState);
  const gtmCommandContext = useAtomStateValue(gtmCommandContextState);
  const currentUser = useAtomStateValue(currentUserState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isSavingIcp, setIsSavingIcp] = useState(false);
  const [isRegeneratingIcp, setIsRegeneratingIcp] = useState(false);
  const [workflowMode, setWorkflowMode] =
    useState<GtmWorkflowEmbedMode>('definition');
  const {
    workflowId,
    workflowRunId,
    hasWorkflow,
    hasWorkflowRun,
    workflowsLoading,
    runsLoading,
    workflowOptions,
    selectOutreachWorkflow,
    isSelectingWorkflow,
  } = useGtmWorkflowEmbed({
    enabled: isDefined(activeProjectId),
  });
  const { isExtensionInstalled, isChecking: isExtensionChecking } =
    useChromeExtensionDetection();
  const { data: creditsData } = useQuery(WORKSPACE_CREDITS);
  const credits = (
    creditsData as
      | {
          workspaceCredits?: {
            orgChartCredits: number;
            revealCredits: number;
            apiCredits: number;
            revealCreditsAsEmailEquivalent?: number;
            revealCreditsAsPhoneEquivalent?: number;
            emailRevealCost?: number;
            phoneRevealCost?: number;
          };
        }
      | undefined
  )?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits ?? undefined;
  const revealCredits = credits?.revealCredits ?? undefined;
  const apiCredits = credits?.apiCredits ?? undefined;
  const {
    isGetResourceCreditUsageQueryLoaded,
    hasResourceCreditUsage,
    getResourceCreditUsage,
  } = useGetResourceCreditUsage();
  let aiCreditsDisplay: number | undefined;
  if (isGetResourceCreditUsageQueryLoaded && hasResourceCreditUsage) {
    try {
      const usage = getResourceCreditUsage();
      const available =
        (usage.totalGrantedCredits ?? 0) - (usage.usedCredits ?? 0);
      aiCreditsDisplay = Math.max(0, Math.round(available / 1_000_000));
    } catch {
      aiCreditsDisplay = undefined;
    }
  }

  useEffect(() => {
    if (workflowMode === 'run' && !hasWorkflowRun && hasWorkflow) {
      setWorkflowMode('definition');
    }
  }, [hasWorkflow, hasWorkflowRun, workflowMode]);

  // Show Ask AI on GTM Command entry (URL / reload), not only nav click.
  // Guard: opening the panel must not recreate this effect (max update depth).
  const hasOpenedAskAiOnEntryRef = useRef(false);
  useEffect(() => {
    if (hasOpenedAskAiOnEntryRef.current) {
      return;
    }
    hasOpenedAskAiOnEntryRef.current = true;
    openAskAiPage({ resetNavigationStack: true });
  }, [openAskAiPage]);

  useEffect(() => {
    const selectedPerson = people.find(
      (person) => person.id === selectedPersonId,
    );

    setGtmCommandContext({
      projectId: projectSettings.projectId,
      projectName: projectSettings.projectName,
      gtmRunKey: projectSettings.gtmRunKey,
      outreachWorkflowId: projectSettings.outreachWorkflowId,
      outreachSendMode: projectSettings.outreachSendMode,
      selectedCompanyId,
      selectedPersonId,
      selectedCandidateStage: selectedPerson?.stage ?? null,
      icpName: projectSettings.icpSpec,
      icpSpecSummary: projectSettings.icpSpec,
      linkedinConnected,
      gmailConnected,
      whatsappConnected,
      phase: 'live',
    });
  }, [
    gmailConnected,
    linkedinConnected,
    people,
    projectSettings,
    selectedCompanyId,
    selectedPersonId,
    setGtmCommandContext,
    whatsappConnected,
  ]);

  const resolvePersistTarget = (
    isRunOverride: boolean,
  ): GtmSetupPersistTarget | null => {
    if (isRunOverride && isDefined(activeProjectId)) {
      return 'project';
    }

    if (isDefined(workspaceProfile?.id)) {
      return 'workspaceProfile';
    }

    if (isDefined(activeProjectId)) {
      return 'project';
    }

    return null;
  };

  const persistSetupField = async ({
    isRunOverride,
    updateOneRecordInput,
    successMessage,
  }: {
    isRunOverride: boolean;
    updateOneRecordInput: Record<string, string>;
    successMessage: string;
  }) => {
    const persistTarget = resolvePersistTarget(isRunOverride);

    if (
      persistTarget === 'workspaceProfile' &&
      isDefined(workspaceProfile?.id)
    ) {
      await updateOneRecord({
        objectNameSingular: 'workspaceProfile',
        idToUpdate: workspaceProfile.id,
        updateOneRecordInput,
      });
      enqueueSuccessSnackBar({ message: successMessage });
      return;
    }

    if (persistTarget === 'project' && isDefined(activeProjectId)) {
      await updateOneRecord({
        objectNameSingular: 'project',
        idToUpdate: activeProjectId,
        updateOneRecordInput,
      });
      enqueueSuccessSnackBar({
        message: `${successMessage} (this run)`,
      });
      return;
    }

    throw new Error('No workspace profile or GTM run to save to.');
  };

  const handleCreateProject = async () => {
    setIsCreatingProject(true);

    try {
      await createGtmProject();
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleRegenerateIcp = async () => {
    setIsRegeneratingIcp(true);

    try {
      await regenerateGtmWorkspaceProfile({
        accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
        userEmail: currentUser?.email,
        workspaceDisplayName: currentWorkspace?.displayName,
        userFirstName: currentUser?.firstName,
        userLastName: currentUser?.lastName,
      });
      await refetchWorkspaceProfiles();
      enqueueSuccessSnackBar({
        message: 'Seller company and workspace ICP regenerated from enrichment.',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to regenerate workspace ICP.',
      });
    } finally {
      setIsRegeneratingIcp(false);
    }
  };

  const handleSaveIcp = async (input: { icpSpec: string }) => {
    const parsedIcp = parseGtmIcpSpec(input.icpSpec.trim());
    const normalizedIcpSpec = parsedIcp
      ? stringifyGtmIcpSpec(parsedIcp)
      : input.icpSpec.trim();

    if (!isNonEmptyString(normalizedIcpSpec)) {
      enqueueErrorSnackBar({ message: 'ICP JSON cannot be empty.' });
      return;
    }

    if (parsedIcp === null) {
      enqueueErrorSnackBar({ message: 'ICP must be valid JSON.' });
      return;
    }

    setIsSavingIcp(true);

    try {
      await persistSetupField({
        isRunOverride: projectSettings.isIcpRunOverride,
        updateOneRecordInput: {
          icpSpec: normalizedIcpSpec,
        },
        successMessage: 'ICP saved',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to save ICP.',
      });
    } finally {
      setIsSavingIcp(false);
    }
  };

  const handleFindCompanies = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmFindCompaniesSendPrompt({
        projectId: projectSettings.projectId,
        icpSpecSummary: projectSettings.icpSpec,
      }),
    });
    setActiveTab('companies');
  };

  const handleFindPeople = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmFindPeopleSendPrompt({
        projectId: projectSettings.projectId,
        icpSpecSummary: projectSettings.icpSpec,
      }),
    });
    setActiveTab('people');
  };

  const handleSelectOutreachWorkflow = async (nextWorkflowId: string) => {
    await selectOutreachWorkflow(nextWorkflowId);
    openAskAiPageWithPreprompt({
      mode: 'PREFILL',
      text: buildGtmCommandContextPrompt({
        ...gtmCommandContext,
        outreachWorkflowId: nextWorkflowId,
      }),
    });
  };

  return (
    <PageContainer>
      <PageHeader title="GTM Command">
        <GtmRunProgressHeader
          projectId={projectSettings.projectId}
          projectOptions={projectOptions}
          onSelectProjectId={setActiveProjectId}
          onCreateProject={handleCreateProject}
          isCreatingProject={isCreatingProject}
        />
        <CandidateTableProjectsPageMenuDropdown
          onAddJob={handleCreateProject}
          isLinkedinConnected={linkedinConnected}
          isWhatsappLoggedIn={whatsappConnected}
          isExtensionInstalled={isExtensionInstalled}
          isExtensionChecking={isExtensionChecking}
          onDownloadClick={() => setIsDownloadModalOpen(true)}
          mapCredits={orgChartCredits}
          revealCredits={revealCredits}
          apiCredits={apiCredits}
          aiCredits={aiCreditsDisplay}
          onCreditsClick={
            orgChartCredits !== undefined
              ? () => setIsCreditModalOpen(true)
              : undefined
          }
        />
      </PageHeader>
      <InformationBannerChromeExtensionNotInstalled
        isExtensionInstalled={isExtensionInstalled}
        isChecking={isExtensionChecking}
      />
      <GtmNeedsConnectionBanner
        linkedinConnected={linkedinConnected}
        gmailConnected={gmailConnected}
        whatsappConnected={whatsappConnected}
      />
      {isDefined(workflowRunId) && (
        <WorkflowRunRateLimitSnackBarEffect workflowRunId={workflowRunId} />
      )}
      <PageBody>
        <StyledMain>
          <GtmMainTabs
            activeTab={activeTab}
            companyCount={companies.length}
            peopleCount={people.length}
            onChange={setActiveTab}
            trailing={
              isWorkflowTab ? (
                <GtmWorkflowToolbar
                  mode={workflowMode}
                  onModeChange={setWorkflowMode}
                  hasWorkflowRun={hasWorkflowRun}
                  workflowId={workflowId}
                  workflowOptions={workflowOptions}
                  isSelectingWorkflow={isSelectingWorkflow}
                  onSelectWorkflow={(nextWorkflowId) => {
                    void handleSelectOutreachWorkflow(nextWorkflowId);
                  }}
                />
              ) : undefined
            }
          />
          {loading ? (
            <StyledLoading>
              <Loader /> Loading GTM run…
            </StyledLoading>
          ) : !activeProjectId ? (
            <StyledEmpty>
              Preparing a GTM run… If this persists, click{' '}
              <strong>New run</strong>.
            </StyledEmpty>
          ) : isWorkflowTab ? (
            <StyledWorkflowContent>
              <GtmWorkflowPanel
                isActive={true}
                mode={workflowMode}
                workflowId={workflowId}
                workflowRunId={workflowRunId}
                hasWorkflow={hasWorkflow}
                hasWorkflowRun={hasWorkflowRun}
                workflowsLoading={workflowsLoading}
                runsLoading={runsLoading}
              />
            </StyledWorkflowContent>
          ) : (
            <StyledContent>
              {isSetupTab && (
                <StyledSetupWrap>
                  <GtmSetupPanel
                    workspaceCompany={workspaceCompany}
                    icpSpec={projectSettings.icpSpec}
                    isIcpRunOverride={isIcpRunOverride}
                    hasWorkspaceProfile={isDefined(workspaceProfile?.id)}
                    hasProject={isDefined(activeProjectId)}
                    isSavingIcp={isSavingIcp}
                    onRegenerateIcp={() => {
                      void handleRegenerateIcp();
                    }}
                    isRegeneratingIcp={isRegeneratingIcp}
                    onSaveIcp={handleSaveIcp}
                    onFindCompanies={handleFindCompanies}
                    onFindPeople={handleFindPeople}
                  />
                </StyledSetupWrap>
              )}
              {activeTab === 'companies' && (
                <GtmCompaniesPanel
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onSelectCompanyId={setSelectedCompanyId}
                />
              )}
              {activeTab === 'people' && (
                <GtmPeoplePanel
                  people={people}
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  selectedPersonId={selectedPersonId}
                  onSelectPersonId={setSelectedPersonId}
                  tableInstanceId={peopleTableInstanceId}
                />
              )}
            </StyledContent>
          )}
        </StyledMain>
      </PageBody>
      <ArxDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
      {orgChartCredits !== undefined && (
        <CreditHistoryModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
          orgChartCredits={orgChartCredits}
          revealCredits={revealCredits}
          apiCredits={apiCredits}
          revealCreditsAsEmailEquivalent={
            credits?.revealCreditsAsEmailEquivalent
          }
          revealCreditsAsPhoneEquivalent={
            credits?.revealCreditsAsPhoneEquivalent
          }
          emailRevealCost={credits?.emailRevealCost}
          phoneRevealCost={credits?.phoneRevealCost}
          aiCredits={aiCreditsDisplay}
        />
      )}
    </PageContainer>
  );
};

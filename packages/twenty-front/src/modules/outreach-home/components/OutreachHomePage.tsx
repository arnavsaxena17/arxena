import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useStore } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { OutreachCompaniesPanel } from '@/outreach-home/components/OutreachCompaniesPanel';
import { OutreachMainTabs } from '@/outreach-home/components/OutreachMainTabs';
import { OutreachNeedsConnectionBanner } from '@/outreach-home/components/OutreachNeedsConnectionBanner';
import { OutreachPeoplePanel } from '@/outreach-home/components/OutreachPeoplePanel';
import { OutreachRunProgressHeader } from '@/outreach-home/components/OutreachRunProgressHeader';
import { OutreachSetupPanel } from '@/outreach-home/components/OutreachSetupPanel';
import { OutreachWorkflowPanel } from '@/outreach-home/components/OutreachWorkflowPanel';
import { OutreachWorkflowToolbar } from '@/outreach-home/components/OutreachWorkflowToolbar';
import { OUTREACH_PROJECT_ID_QUERY_PARAM } from '@/outreach-home/constants/outreach-command.constants';
import { useOutreachLiveWorkingSet } from '@/outreach-home/hooks/useOutreachLiveWorkingSet';
import {
    type OutreachWorkflowEmbedMode,
    useOutreachWorkflowEmbed,
} from '@/outreach-home/hooks/useOutreachWorkflowEmbed';
import {
    buildOutreachContextPrompt,
    isSameOutreachContext,
    outreachContextState,
} from '@/outreach-home/states/outreachContextState';
import {
    buildFindCompaniesSendPrompt,
    buildFindPeopleSendPrompt,
    type OutreachSendMode,
} from '@/outreach-home/types/outreach-home.types';
import {
    parseIcpSpec,
    stringifyIcpSpec,
} from '@/outreach-home/utils/outreach-effective-icp.util';
import { regenerateOutreachWorkspaceProfile } from '@/outreach-home/utils/outreach-workspace-profile-regenerate';
import { useGetResourceCreditUsage } from '@/settings/billing/hooks/useGetResourceCreditUsage';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { WorkflowRunRateLimitSnackBarEffect } from '@/workflow/components/WorkflowRunRateLimitSnackBarEffect';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

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

type OutreachSetupPersistTarget = 'workspaceProfile' | 'project';

export const OutreachHomePage = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get(OUTREACH_PROJECT_ID_QUERY_PARAM) ?? 'resolving';

  return <OutreachHomePageContent key={projectId} />;
};

const OutreachHomePageContent = () => {
  const {
    loading,
    peopleLoading,
    workspaceCompany,
    workspaceProfile,
    refetchWorkspaceProfiles,
    companies,
    people,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    refetchProjects,
    createOutreachProject,
    isIcpProjectOverride,
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
  } = useOutreachLiveWorkingSet();
  const isWorkflowTab = activeTab === 'workflow';
  const isSetupTab = activeTab === 'setup';
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();
  const { updateOneRecord } = useUpdateOneRecord();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const setOutreachContext = useSetAtomState(outreachContextState);
  const outreachContextStore = useStore();
  const currentUser = useAtomStateValue(currentUserState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isSavingIcp, setIsSavingIcp] = useState(false);
  const [isSavingSendSchedule, setIsSavingSendSchedule] = useState(false);
  const [isSavingOutreachPolicy, setIsSavingOutreachPolicy] = useState(false);
  const [isUpdatingOutreachStatus, setIsUpdatingOutreachStatus] =
    useState(false);
  const [isRegeneratingIcp, setIsRegeneratingIcp] = useState(false);
  const [workflowMode, setWorkflowMode] =
    useState<OutreachWorkflowEmbedMode>('definition');
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
  } = useOutreachWorkflowEmbed({
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

  // Show Ask AI on Outreach entry (URL / reload), not only nav click.
  // Guard: opening the panel must not recreate this effect (max update depth).
  const hasOpenedAskAiOnEntryRef = useRef(false);
  useEffect(() => {
    if (hasOpenedAskAiOnEntryRef.current) {
      return;
    }
    hasOpenedAskAiOnEntryRef.current = true;
    openAskAiPage({ resetNavigationStack: true });
  }, [openAskAiPage]);

  const selectedCandidateStage =
    people.find((person) => person.id === selectedPersonId)?.stage ?? null;

  useEffect(() => {
    const next = {
      projectId: projectSettings.projectId,
      projectName: projectSettings.projectName,
      outreachWorkflowId: projectSettings.outreachWorkflowId,
      outreachSendMode: projectSettings.outreachSendMode,
      selectedCompanyId,
      selectedPersonId,
      selectedCandidateStage,
      icpName: projectSettings.icpSpec,
      icpSpecSummary: projectSettings.icpSpec,
      linkedinConnected,
      gmailConnected,
      whatsappConnected,
      phase: 'live' as const,
    };

    const previous = outreachContextStore.get(outreachContextState.atom);

    if (isSameOutreachContext(previous, next)) {
      return;
    }

    setOutreachContext(next);
  }, [
    gmailConnected,
    linkedinConnected,
    outreachContextStore,
    projectSettings.icpSpec,
    projectSettings.outreachSendMode,
    projectSettings.outreachWorkflowId,
    projectSettings.projectId,
    projectSettings.projectName,
    selectedCandidateStage,
    selectedCompanyId,
    selectedPersonId,
    setOutreachContext,
    whatsappConnected,
  ]);

  const resolvePersistTarget = (
    isProjectOverride: boolean,
  ): OutreachSetupPersistTarget | null => {
    if (isProjectOverride && isDefined(activeProjectId)) {
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
    isProjectOverride,
    updateOneRecordInput,
    successMessage,
  }: {
    isProjectOverride: boolean;
    updateOneRecordInput: Record<string, string>;
    successMessage: string;
  }) => {
    const persistTarget = resolvePersistTarget(isProjectOverride);

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
        message: `${successMessage} (this project)`,
      });
      return;
    }

    throw new Error('No workspace profile or GTM project to save to.');
  };

  const handleCreateProject = async () => {
    await createOutreachProject();
  };

  const handleRegenerateIcp = async () => {
    setIsRegeneratingIcp(true);

    try {
      await regenerateOutreachWorkspaceProfile({
        accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
        userEmail: currentUser?.email,
        workspaceDisplayName: currentWorkspace?.displayName,
        userFirstName: currentUser?.firstName,
        userLastName: currentUser?.lastName,
      });
      await refetchWorkspaceProfiles();
      enqueueSuccessSnackBar({
        message: 'Your company and workspace ICP regenerated from enrichment.',
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
    const parsedIcp = parseIcpSpec(input.icpSpec.trim());
    const normalizedIcpSpec = parsedIcp
      ? stringifyIcpSpec(parsedIcp)
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
        isProjectOverride: projectSettings.isIcpProjectOverride,
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

  const handleSaveSendSchedule = async (input: {
    sendTimezone: string;
    sendWindowStart: string;
    sendWindowEnd: string;
    sendWindowDays: string;
  }) => {
    if (!isDefined(activeProjectId)) {
      enqueueErrorSnackBar({
        message: 'Create or select a GTM project before saving send schedule.',
      });
      return;
    }

    setIsSavingSendSchedule(true);

    try {
      await updateOneRecord({
        objectNameSingular: 'project',
        idToUpdate: activeProjectId,
        updateOneRecordInput: {
          sendTimezone: input.sendTimezone,
          sendWindowStart: input.sendWindowStart,
          sendWindowEnd: input.sendWindowEnd,
          sendWindowDays: input.sendWindowDays,
        },
      });
      enqueueSuccessSnackBar({ message: 'Send schedule saved' });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save send schedule.',
      });
    } finally {
      setIsSavingSendSchedule(false);
    }
  };

  const handleSaveOutreachPolicy = async (input: {
    outreachSendMode: OutreachSendMode;
    maxPersonasPerCompany: number;
  }) => {
    if (!isDefined(activeProjectId)) {
      enqueueErrorSnackBar({
        message:
          'Create or select a GTM project before saving outreach policy.',
      });
      return;
    }

    setIsSavingOutreachPolicy(true);

    try {
      await updateOneRecord({
        objectNameSingular: 'project',
        idToUpdate: activeProjectId,
        updateOneRecordInput: {
          outreachSendMode: input.outreachSendMode,
          maxPersonasPerCompany: input.maxPersonasPerCompany,
        },
      });
      enqueueSuccessSnackBar({ message: 'Outreach policy saved' });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save outreach policy.',
      });
    } finally {
      setIsSavingOutreachPolicy(false);
    }
  };

  const updateOutreachStatus = useCallback(
    async (action: 'pause' | 'resume') => {
      if (!isDefined(activeProjectId)) {
        enqueueErrorSnackBar({
          message: 'Select a GTM project before updating outreach.',
        });
        return;
      }

      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!accessToken) {
        enqueueErrorSnackBar({
          message: 'Sign in again to update outreach status.',
        });
        return;
      }

      setIsUpdatingOutreachStatus(true);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${activeProjectId}/${action}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            message?: string;
            error?: string;
          } | null;

          throw new Error(
            result?.message ??
              result?.error ??
              `Failed to ${action} outreach (${response.status})`,
          );
        }

        await refetchProjects();
        enqueueSuccessSnackBar({
          message:
            action === 'pause' ? 'Outreach paused' : 'Outreach resumed',
        });
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : `Failed to ${action} outreach.`,
        });
      } finally {
        setIsUpdatingOutreachStatus(false);
      }
    },
    [
      activeProjectId,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      refetchProjects,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  const handlePauseOutreach = () => {
    void updateOutreachStatus('pause');
  };

  const handleResumeOutreach = () => {
    void updateOutreachStatus('resume');
  };

  const handleFindCompanies = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildFindCompaniesSendPrompt({
        projectId: projectSettings.projectId,
        icpSpecSummary: projectSettings.icpSpec,
      }),
    });
    setActiveTab('companies');
  };

  const handleFindPeople = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildFindPeopleSendPrompt({
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
      text: buildOutreachContextPrompt({
        projectId: projectSettings.projectId,
        projectName: projectSettings.projectName,
        outreachWorkflowId: nextWorkflowId,
        outreachSendMode: projectSettings.outreachSendMode,
        selectedCompanyId,
        selectedPersonId,
        selectedCandidateStage:
          people.find((person) => person.id === selectedPersonId)?.stage ??
          null,
        icpName: projectSettings.icpSpec,
        icpSpecSummary: projectSettings.icpSpec,
        linkedinConnected,
        gmailConnected,
        whatsappConnected,
        phase: 'live',
      }),
    });
  };

  return (
    <PageContainer>
      <PageHeader title="Outreach">
        <OutreachRunProgressHeader
          projectId={projectSettings.projectId}
          projectOptions={projectOptions}
          onSelectProjectId={setActiveProjectId}
          outreachStatus={projectSettings.outreachStatus}
          linkedinConnected={linkedinConnected}
          onPauseOutreach={handlePauseOutreach}
          onResumeOutreach={handleResumeOutreach}
          isUpdatingOutreachStatus={isUpdatingOutreachStatus}
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
      <OutreachNeedsConnectionBanner
        linkedinConnected={linkedinConnected}
        gmailConnected={gmailConnected}
        whatsappConnected={whatsappConnected}
      />
      {isDefined(workflowRunId) && (
        <WorkflowRunRateLimitSnackBarEffect workflowRunId={workflowRunId} />
      )}
      <PageBody>
        <StyledMain>
          <OutreachMainTabs
            activeTab={activeTab}
            companyCount={companies.length}
            peopleCount={people.length}
            onChange={setActiveTab}
            trailing={
              isWorkflowTab ? (
                <OutreachWorkflowToolbar
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
              <Loader /> Loading GTM project…
            </StyledLoading>
          ) : !activeProjectId ? (
            <StyledEmpty>
              Preparing a GTM project… If this persists, use Menu → Add New
              Project.
            </StyledEmpty>
          ) : isWorkflowTab ? (
            <StyledWorkflowContent>
              <OutreachWorkflowPanel
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
                  <OutreachSetupPanel
                    workspaceCompany={workspaceCompany}
                    icpSpec={projectSettings.icpSpec}
                    isIcpProjectOverride={isIcpProjectOverride}
                    hasWorkspaceProfile={isDefined(workspaceProfile?.id)}
                    hasProject={isDefined(activeProjectId)}
                    isSavingIcp={isSavingIcp}
                    onRegenerateIcp={() => {
                      void handleRegenerateIcp();
                    }}
                    isRegeneratingIcp={isRegeneratingIcp}
                    onSaveIcp={handleSaveIcp}
                    sendTimezone={projectSettings.sendTimezone}
                    sendWindowStart={projectSettings.sendWindowStart}
                    sendWindowEnd={projectSettings.sendWindowEnd}
                    sendWindowDays={projectSettings.sendWindowDays}
                    isSavingSendSchedule={isSavingSendSchedule}
                    onSaveSendSchedule={handleSaveSendSchedule}
                    outreachSendMode={projectSettings.outreachSendMode}
                    maxPersonasPerCompany={projectSettings.maxPersonasPerCompany}
                    isSavingOutreachPolicy={isSavingOutreachPolicy}
                    onSaveOutreachPolicy={handleSaveOutreachPolicy}
                    onFindCompanies={handleFindCompanies}
                    onFindPeople={handleFindPeople}
                  />
                </StyledSetupWrap>
              )}
              {activeTab === 'companies' && (
                <OutreachCompaniesPanel
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onSelectCompanyId={setSelectedCompanyId}
                />
              )}
              {activeTab === 'people' && (
                <OutreachPeoplePanel
                  people={people}
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  selectedPersonId={selectedPersonId}
                  onSelectPersonId={setSelectedPersonId}
                  tableInstanceId={peopleTableInstanceId}
                  isLoading={peopleLoading}
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

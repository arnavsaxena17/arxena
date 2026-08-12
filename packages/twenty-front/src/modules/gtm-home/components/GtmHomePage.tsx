import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
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
  buildGtmRegenerateIcpSendPrompt,
  buildGtmRegenerateSearchBlurbSendPrompt,
} from '@/gtm-home/types/gtm-home.types';
import {
  parseGtmIcpSpec,
  stripBlurbFromIcpSpec,
} from '@/gtm-home/utils/gtm-effective-icp.util';
import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useGetResourceCreditUsage } from '@/settings/billing/hooks/useGetResourceCreditUsage';
import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledMain = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledWorkflowContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
`;

const StyledLoading = styled.div`
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledEmpty = styled.div`
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
`;

type GtmSetupPersistTarget = 'workspaceProfile' | 'project';

export const GtmHomePage = () => {
  const {
    loading,
    workspaceCompany,
    workspaceProfile,
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
  const setCommandContext = useSetAtomState(gtmCommandContextState);
  const commandContext = useAtomStateValue(gtmCommandContextState);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isSavingIcp, setIsSavingIcp] = useState(false);
  const [isSavingCompanySearchBlurb, setIsSavingCompanySearchBlurb] =
    useState(false);
  const [isSavingPeopleSearchBlurb, setIsSavingPeopleSearchBlurb] =
    useState(false);
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
    enabled: isWorkflowTab && isDefined(activeProjectId),
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

  // Show Ask AI on GTM Command entry (URL / reload), not only nav click
  useEffect(() => {
    openAskAiPage({ resetNavigationStack: true });
  }, [openAskAiPage]);

  useEffect(() => {
    const selectedPerson = people.find(
      (person) => person.id === selectedPersonId,
    );

    setCommandContext({
      projectId: projectSettings.projectId,
      projectName: projectSettings.projectName,
      gtmRunKey: projectSettings.gtmRunKey,
      outreachWorkflowId: projectSettings.outreachWorkflowId,
      outreachSendMode: projectSettings.outreachSendMode,
      selectedCompanyId,
      selectedPersonId,
      selectedCandidateStage: selectedPerson?.stage ?? null,
      icpName: projectSettings.icpSegment,
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
    setCommandContext,
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
        objectNameSingular: 'gtmWorkspaceProfile',
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

  const handleRegenerateIcp = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmRegenerateIcpSendPrompt({
        workspaceCompany,
        currentIcpSpec: projectSettings.icpSpec,
        currentIcpBlurb: projectSettings.icpBlurb,
      }),
    });
  };

  const handleRegenerateCompanySearchBlurb = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmRegenerateSearchBlurbSendPrompt({
        kind: 'company',
        workspaceCompany,
        icpBlurb: projectSettings.icpBlurb,
        icpSpecSummary: projectSettings.icpSpec,
        currentBlurb: projectSettings.companySearchBlurb,
      }),
    });
  };

  const handleRegeneratePeopleSearchBlurb = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmRegenerateSearchBlurbSendPrompt({
        kind: 'people',
        workspaceCompany,
        icpBlurb: projectSettings.icpBlurb,
        icpSpecSummary: projectSettings.icpSpec,
        currentBlurb: projectSettings.peopleSearchBlurb,
      }),
    });
  };

  const handleSaveIcp = async (input: {
    icpSpec: string;
    icpBlurb: string;
  }) => {
    const trimmedIcpSpec = input.icpSpec.trim();
    const trimmedIcpBlurb = input.icpBlurb.trim();
    const normalizedIcpSpec =
      stripBlurbFromIcpSpec(trimmedIcpSpec) ?? trimmedIcpSpec;

    if (!isNonEmptyString(normalizedIcpSpec)) {
      enqueueErrorSnackBar({ message: 'ICP JSON cannot be empty.' });
      return;
    }

    const parsedIcp = parseGtmIcpSpec(normalizedIcpSpec);

    if (parsedIcp === null) {
      enqueueErrorSnackBar({ message: 'ICP must be valid JSON.' });
      return;
    }

    const icpSegment = isNonEmptyString(parsedIcp.name)
      ? parsedIcp.name
      : (projectSettings.icpSegment ?? 'ICP');

    setIsSavingIcp(true);

    try {
      await persistSetupField({
        isRunOverride:
          projectSettings.isIcpRunOverride ||
          projectSettings.isIcpBlurbRunOverride,
        updateOneRecordInput: {
          icpSpec: normalizedIcpSpec,
          icpSegment,
          icpBlurb: trimmedIcpBlurb,
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

  const handleSaveCompanySearchBlurb = async (value: string) => {
    setIsSavingCompanySearchBlurb(true);

    try {
      await persistSetupField({
        isRunOverride: projectSettings.isCompanySearchBlurbRunOverride,
        updateOneRecordInput: {
          companySearchBlurb: value.trim(),
        },
        successMessage: 'Company search blurb saved',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save company search blurb.',
      });
    } finally {
      setIsSavingCompanySearchBlurb(false);
    }
  };

  const handleSavePeopleSearchBlurb = async (value: string) => {
    setIsSavingPeopleSearchBlurb(true);

    try {
      await persistSetupField({
        isRunOverride: projectSettings.isPeopleSearchBlurbRunOverride,
        updateOneRecordInput: {
          peopleSearchBlurb: value.trim(),
        },
        successMessage: 'People search blurb saved',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save people search blurb.',
      });
    } finally {
      setIsSavingPeopleSearchBlurb(false);
    }
  };

  const handleFindCompanies = () => {
    openAskAiPageWithPreprompt({
      mode: 'SEND',
      text: buildGtmFindCompaniesSendPrompt({
        projectId: projectSettings.projectId,
        companySearchBlurb: projectSettings.companySearchBlurb,
        icpBlurb: projectSettings.icpBlurb,
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
        peopleSearchBlurb: projectSettings.peopleSearchBlurb,
        icpBlurb: projectSettings.icpBlurb,
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
        ...commandContext,
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
      <PageBody>
        <StyledMain>
          {(!linkedinConnected || !gmailConnected) && (
            <GtmNeedsConnectionBanner
              linkedinConnected={linkedinConnected}
              gmailConnected={gmailConnected}
              whatsappConnected={whatsappConnected}
            />
          )}
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
                <GtmSetupPanel
                  workspaceCompany={workspaceCompany}
                  icpSpec={projectSettings.icpSpec}
                  icpBlurb={projectSettings.icpBlurb}
                  companySearchBlurb={projectSettings.companySearchBlurb}
                  peopleSearchBlurb={projectSettings.peopleSearchBlurb}
                  isIcpRunOverride={isIcpRunOverride}
                  hasWorkspaceProfile={isDefined(workspaceProfile?.id)}
                  hasProject={isDefined(activeProjectId)}
                  isSavingIcp={isSavingIcp}
                  isSavingCompanySearchBlurb={isSavingCompanySearchBlurb}
                  isSavingPeopleSearchBlurb={isSavingPeopleSearchBlurb}
                  onRegenerateIcp={handleRegenerateIcp}
                  onRegenerateCompanySearchBlurb={
                    handleRegenerateCompanySearchBlurb
                  }
                  onRegeneratePeopleSearchBlurb={
                    handleRegeneratePeopleSearchBlurb
                  }
                  onSaveIcp={handleSaveIcp}
                  onSaveCompanySearchBlurb={handleSaveCompanySearchBlurb}
                  onSavePeopleSearchBlurb={handleSavePeopleSearchBlurb}
                  onFindCompanies={handleFindCompanies}
                  onFindPeople={handleFindPeople}
                />
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

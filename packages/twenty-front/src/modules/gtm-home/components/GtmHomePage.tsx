import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
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
  buildGtmIcpOnboardingKickoffPrompt,
  type GtmIcpSet,
} from '@/gtm-home/types/gtm-home.types';
import { useGetResourceCreditUsage } from '@/settings/billing/hooks/useGetResourceCreditUsage';
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

export const GtmHomePage = () => {
  const {
    loading,
    workspaceCompany,
    companies,
    people,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    createGtmProject,
    parsedIcp,
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
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();
  const setCommandContext = useSetAtomState(gtmCommandContextState);
  const commandContext = useAtomStateValue(gtmCommandContextState);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
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

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const proposedIcp: GtmIcpSet | null = parsedIcp
      ? {
          name: parsedIcp.name ?? projectSettings.icpSegment ?? 'ICP',
          industries: parsedIcp.industries ?? [],
          employeeRange: parsedIcp.employeeRange ?? '',
          geos: parsedIcp.geos ?? [],
          buyerTitles: parsedIcp.buyerTitles ?? [],
          painSignals: parsedIcp.painSignals ?? [],
          stdFunctions: parsedIcp.stdFunctions ?? [],
          stdGrades: parsedIcp.stdGrades ?? [],
        }
      : null;

    // Prefill only — user hits Enter to send the ICP onboarding kickoff.
    openAskAiPageWithPreprompt({
      mode: 'PREFILL',
      text: buildGtmIcpOnboardingKickoffPrompt({
        workspaceCompany,
        projectId: projectSettings.projectId,
        projectName: projectSettings.projectName,
        proposedIcp,
      }),
    });
    // Re-kick when switching projects so Ask AI is run-aware.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

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

  const handleCreateProject = async () => {
    setIsCreatingProject(true);

    try {
      await createGtmProject();
    } finally {
      setIsCreatingProject(false);
    }
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
              No GTM Project yet. Click <strong>New run</strong> to create one —
              Companies, People, and Workflows are scoped to that Project id (
              <code>?projectId=</code>).
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

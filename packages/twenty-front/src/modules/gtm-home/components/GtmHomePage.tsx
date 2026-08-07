import { useEffect, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Loader } from 'twenty-ui/feedback';

import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
import { GtmCompaniesPanel } from '@/gtm-home/components/GtmCompaniesPanel';
import { GtmMainTabs } from '@/gtm-home/components/GtmMainTabs';
import { GtmMarketMapPanel } from '@/gtm-home/components/GtmMarketMapPanel';
import { GtmNeedsConnectionBanner } from '@/gtm-home/components/GtmNeedsConnectionBanner';
import { GtmPeoplePanel } from '@/gtm-home/components/GtmPeoplePanel';
import { GtmRunProgressHeader } from '@/gtm-home/components/GtmRunProgressHeader';
import { GtmWorkflowPanel } from '@/gtm-home/components/GtmWorkflowPanel';
import { useGtmLiveWorkingSet } from '@/gtm-home/hooks/useGtmLiveWorkingSet';
import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import {
  buildGtmIcpOnboardingKickoffPrompt,
  type GtmIcpSet,
} from '@/gtm-home/types/gtm-home.types';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
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
    segments,
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
    selectedSegmentId,
    setSelectedSegmentId,
    peopleTableInstanceId,
  } = useGtmLiveWorkingSet();
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();
  const setCommandContext = useSetAtomState(gtmCommandContextState);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const isWorkflowTab = activeTab === 'workflow';

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

    openAskAiPageWithPreprompt({
      mode: 'SEND',
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

  return (
    <PageContainer>
      <PageHeader title="GTM Command" />
      <PageBody>
        <StyledMain>
          <GtmRunProgressHeader
            workspaceName={workspaceCompany.name}
            domain={workspaceCompany.domain}
            projectId={projectSettings.projectId}
            projectName={projectSettings.projectName}
            icpSegment={projectSettings.icpSegment}
            projectOptions={projectOptions}
            onSelectProjectId={setActiveProjectId}
            onCreateProject={handleCreateProject}
            isCreatingProject={isCreatingProject}
          />
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
          />
          {loading ? (
            <StyledLoading>
              <Loader /> Loading GTM run…
            </StyledLoading>
          ) : !activeProjectId ? (
            <StyledEmpty>
              No GTM Project yet. Click <strong>New GTM run</strong> to create
              one — Companies, People, and Workflows are scoped to that Project
              id (<code>?projectId=</code>).
            </StyledEmpty>
          ) : isWorkflowTab ? (
            <StyledWorkflowContent>
              <GtmWorkflowPanel isActive={true} />
            </StyledWorkflowContent>
          ) : (
            <StyledContent>
              {activeTab === 'companies' && (
                <GtmCompaniesPanel
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  selectedSegmentId={selectedSegmentId}
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
              {activeTab === 'market_map' && (
                <GtmMarketMapPanel
                  segments={segments}
                  selectedSegmentId={selectedSegmentId}
                  hasCompanies={companies.length > 0}
                  onSelectSegmentId={(segmentId) => {
                    setSelectedSegmentId(segmentId);
                    setActiveTab('companies');
                  }}
                />
              )}
            </StyledContent>
          )}
        </StyledMain>
      </PageBody>
    </PageContainer>
  );
};

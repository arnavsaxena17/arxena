import { useApolloAdminClient } from '@/settings/admin-panel/apollo/hooks/useApolloAdminClient';
import { ADMIN_GRANT_ORG_CHART_TO_WORKSPACE } from '@/settings/admin-panel/graphql/mutations/adminGrantOrgChartToWorkspace';
import { GET_ADMIN_ORG_CHART_ARTIFACT } from '@/settings/admin-panel/graphql/queries/getAdminOrgChartArtifact';
import { GET_ADMIN_WORKSPACES_WITH_CREDITS } from '@/settings/admin-panel/graphql/queries/getAdminWorkspacesWithCredits';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Button, Checkbox } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

type WorkspaceCreditsRow = {
  workspaceId: string;
  workspaceName: string;
  workspaceCreatorEmail?: string | null;
};

type WorkspacesWithCreditsData = {
  adminListWorkspacesWithCredits: WorkspaceCreditsRow[];
};

type OrgChartArtifact = {
  companyId: string;
  orgChartS3RelativePath: string;
  hasOrgChartInS3: boolean;
  companyName?: string | null;
  itemCount?: number | null;
};

type OrgChartArtifactData = {
  adminOrgChartArtifact: OrgChartArtifact;
};

type GrantOrgChartResult = {
  workspaceId: string;
  companyId: string;
  orgChartS3RelativePath: string;
  alreadyHadAccess: boolean;
  accessGranted: boolean;
  chargedCredits: boolean;
  orgChartRecordId?: string | null;
  projectName?: string | null;
  projectCreated?: boolean | null;
  itemCount?: number | null;
  companyName?: string | null;
};

type GrantOrgChartData = {
  adminGrantOrgChartToWorkspace: GrantOrgChartResult;
};

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledFormRow = styled.div`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  max-width: 420px;
  min-width: 280px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 220px;
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledToggles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledToggleRow = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledError = styled.p`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledArtifactBox = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledMono = styled.span`
  font-family: monospace;
  font-size: ${themeCssVariables.font.size.sm};
  overflow-wrap: anywhere;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

export const SettingsAdminGrantOrgCharts = () => {
  const apolloAdminClient = useApolloAdminClient();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [workspaceId, setWorkspaceId] = useState('');
  const [companyId, setCompanyId] = useState('british-airways');
  const [companyName, setCompanyName] = useState('');
  const [createCrmRow, setCreateCrmRow] = useState(true);
  const [createProject, setCreateProject] = useState(false);
  const [chargeCredits, setChargeCredits] = useState(false);
  const [artifact, setArtifact] = useState<OrgChartArtifact | null>(null);
  const [lastGrant, setLastGrant] = useState<GrantOrgChartResult | null>(null);

  const {
    data: workspacesData,
    loading: workspacesLoading,
    error: workspacesError,
  } = useQuery<WorkspacesWithCreditsData>(GET_ADMIN_WORKSPACES_WITH_CREDITS, {
    client: apolloAdminClient,
    fetchPolicy: 'network-only',
  });

  const workspaceOptions = useMemo(() => {
    const rows = workspacesData?.adminListWorkspacesWithCredits ?? [];

    return [...rows].sort((left, right) =>
      left.workspaceName.localeCompare(right.workspaceName),
    );
  }, [workspacesData]);

  const [lookupArtifact, { loading: lookupLoading }] = useLazyQuery<
    OrgChartArtifactData,
    { companyId: string }
  >(GET_ADMIN_ORG_CHART_ARTIFACT, {
    client: apolloAdminClient,
    fetchPolicy: 'network-only',
  });

  const [grantOrgChart, { loading: grantLoading }] = useMutation<
    GrantOrgChartData,
    {
      input: {
        workspaceId: string;
        companyId: string;
        companyName?: string;
        createCrmRow: boolean;
        createProject: boolean;
        chargeCredits: boolean;
      };
    }
  >(ADMIN_GRANT_ORG_CHART_TO_WORKSPACE, {
    client: apolloAdminClient,
  });

  const handleLookup = async () => {
    const trimmedCompanyId = companyId.trim();

    if (!trimmedCompanyId) {
      enqueueErrorSnackBar({
        message: 'Company id is required',
      });

      return;
    }

    try {
      const result = await lookupArtifact({
        variables: { companyId: trimmedCompanyId },
      });
      const nextArtifact = result.data?.adminOrgChartArtifact;

      if (!isDefined(nextArtifact)) {
        enqueueErrorSnackBar({
          message: 'No artifact response from server',
        });

        return;
      }

      setArtifact(nextArtifact);

      if (
        !companyName.trim() &&
        typeof nextArtifact.companyName === 'string' &&
        nextArtifact.companyName.trim()
      ) {
        setCompanyName(nextArtifact.companyName);
      }

      if (nextArtifact.hasOrgChartInS3) {
        enqueueSuccessSnackBar({
          message: `Found S3 org chart at ${nextArtifact.orgChartS3RelativePath}`,
        });
      } else {
        enqueueErrorSnackBar({
          message: `No orgchart.json at ${nextArtifact.orgChartS3RelativePath}`,
        });
      }
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to look up org chart artifact',
      });
    }
  };

  const handleGrant = async () => {
    const trimmedWorkspaceId = workspaceId.trim();
    const trimmedCompanyId = companyId.trim();

    if (!trimmedWorkspaceId) {
      enqueueErrorSnackBar({
        message: 'Select a target workspace',
      });

      return;
    }

    if (!trimmedCompanyId) {
      enqueueErrorSnackBar({
        message: 'Company id is required',
      });

      return;
    }

    try {
      const result = await grantOrgChart({
        variables: {
          input: {
            workspaceId: trimmedWorkspaceId,
            companyId: trimmedCompanyId,
            companyName: companyName.trim() || undefined,
            createCrmRow,
            createProject,
            chargeCredits,
          },
        },
      });
      const grantResult = result.data?.adminGrantOrgChartToWorkspace;

      if (!isDefined(grantResult)) {
        enqueueErrorSnackBar({
          message: 'Grant mutation returned no data',
        });

        return;
      }

      setLastGrant(grantResult);
      enqueueSuccessSnackBar({
        message: grantResult.alreadyHadAccess
          ? `Workspace already had access to ${grantResult.orgChartS3RelativePath}`
          : `Granted ${grantResult.orgChartS3RelativePath} to workspace`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to grant org chart to workspace',
      });
    }
  };

  return (
    <StyledSection>
      <H2Title
        title="Grant org chart"
        description="Allow an existing shared S3 org chart (e.g. british-airways) on another workspace. Redis/S3 stay company-keyed; this writes a credit access grant plus optional CRM orgChart and Project."
      />
      <StyledHint>
        Does not copy S3 or Redis. Target workspace opens the same
        /org-chart/&#123;companyId&#125; route after the grant.
      </StyledHint>
      {workspacesError && (
        <StyledError>
          Failed to load workspaces: {workspacesError.message}
        </StyledError>
      )}
      <StyledFormRow>
        <StyledField>
          <StyledLabel htmlFor="grant-org-chart-workspace">
            Target workspace
          </StyledLabel>
          <StyledSelect
            id="grant-org-chart-workspace"
            value={workspaceId}
            disabled={workspacesLoading}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            <option value="">Select workspace…</option>
            {workspaceOptions.map((workspace) => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>
                {workspace.workspaceName}
                {workspace.workspaceCreatorEmail
                  ? ` (${workspace.workspaceCreatorEmail})`
                  : ''}{' '}
                — {workspace.workspaceId.slice(0, 8)}
              </option>
            ))}
          </StyledSelect>
        </StyledField>
        <StyledField>
          <StyledLabel htmlFor="grant-org-chart-company-id">
            Company id
          </StyledLabel>
          <TextInput
            id="grant-org-chart-company-id"
            value={companyId}
            onChange={setCompanyId}
            placeholder="british-airways"
            fullWidth
          />
        </StyledField>
        <StyledField>
          <StyledLabel htmlFor="grant-org-chart-company-name">
            Company name (optional)
          </StyledLabel>
          <TextInput
            id="grant-org-chart-company-name"
            value={companyName}
            onChange={setCompanyName}
            placeholder="British Airways"
            fullWidth
          />
        </StyledField>
      </StyledFormRow>
      <StyledToggles>
        <StyledToggleRow>
          <Checkbox checked={createCrmRow} onCheckedChange={setCreateCrmRow} />
          Create CRM orgChart row in target workspace
        </StyledToggleRow>
        <StyledToggleRow>
          <Checkbox
            checked={createProject}
            onCheckedChange={setCreateProject}
          />
          Create Project (orgchart-&#123;Company&#125;-entire)
        </StyledToggleRow>
        <StyledToggleRow>
          <Checkbox
            checked={chargeCredits}
            onCheckedChange={setChargeCredits}
          />
          Charge org-chart credit (otherwise free access grant)
        </StyledToggleRow>
      </StyledToggles>
      <StyledActions>
        <Button
          title="Check S3 artifact"
          onClick={handleLookup}
          disabled={lookupLoading || !companyId.trim()}
          isLoading={lookupLoading}
        />
        <Button
          title="Grant to workspace"
          variant="primary"
          onClick={handleGrant}
          disabled={grantLoading || !workspaceId.trim() || !companyId.trim()}
          isLoading={grantLoading}
        />
      </StyledActions>
      {isDefined(artifact) && (
        <StyledArtifactBox>
          <div>
            S3 path: <StyledMono>{artifact.orgChartS3RelativePath}</StyledMono>
          </div>
          <div>
            Present: {artifact.hasOrgChartInS3 ? 'yes' : 'no'}
            {isDefined(artifact.itemCount)
              ? ` · ${artifact.itemCount} people`
              : ''}
            {artifact.companyName ? ` · ${artifact.companyName}` : ''}
          </div>
        </StyledArtifactBox>
      )}
      {isDefined(lastGrant) && (
        <StyledArtifactBox>
          <div>
            Last grant:{' '}
            <StyledMono>{lastGrant.orgChartS3RelativePath}</StyledMono>
          </div>
          <div>
            Access:{' '}
            {lastGrant.alreadyHadAccess
              ? 'already had access'
              : lastGrant.accessGranted
                ? 'granted'
                : 'unchanged'}
            {lastGrant.chargedCredits ? ' (charged credit)' : ''}
          </div>
          {lastGrant.orgChartRecordId && (
            <div>
              CRM orgChart id:{' '}
              <StyledMono>{lastGrant.orgChartRecordId}</StyledMono>
            </div>
          )}
          {lastGrant.projectName && (
            <div>
              Project: {lastGrant.projectName}
              {lastGrant.projectCreated === true
                ? ' (created)'
                : lastGrant.projectCreated === false
                  ? ' (create failed)'
                  : ''}
            </div>
          )}
        </StyledArtifactBox>
      )}
    </StyledSection>
  );
};

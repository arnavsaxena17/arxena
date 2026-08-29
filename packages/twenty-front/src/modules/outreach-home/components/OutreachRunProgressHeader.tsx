import { useNavigate } from 'react-router-dom';
import { Button } from 'twenty-ui/input';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { isDefined } from 'twenty-shared/utils';

import {
  buildOutreachCommandDashboardPath,
  getOutreachDashboardFallbackPath,
  useCanQueryDashboardRecords,
  useOutreachCommandDashboardPath,
} from '@/outreach-home/hooks/useOutreachCommandDashboardPath';
import {
  type OutreachStatus,
  type OutreachProjectOption,
} from '@/outreach-home/types/outreach-home.types';

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSelect = styled.select`
  appearance: none;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  max-width: 280px;
  min-width: 180px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledStatusChip = styled.span<{
  $tone: 'live' | 'paused' | 'needs-connection';
}>`
  border: 1px solid
    ${({ $tone }) =>
      $tone === 'live'
        ? themeCssVariables.color.green
        : $tone === 'paused'
          ? themeCssVariables.color.orange
          : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ $tone }) =>
    $tone === 'live'
      ? themeCssVariables.color.green
      : $tone === 'paused'
        ? themeCssVariables.color.orange
        : themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 2px ${themeCssVariables.spacing[1]};
`;

type OutreachRunProgressHeaderProps = {
  projectId: string | null;
  projectOptions: OutreachProjectOption[];
  onSelectProjectId: (projectId: string) => void;
  onCreateProject: () => void;
  isCreatingProject?: boolean;
  outreachStatus: OutreachStatus | null;
  linkedinConnected?: boolean;
  onPauseOutreach?: () => void;
  onResumeOutreach?: () => void;
  isUpdatingOutreachStatus?: boolean;
};

// Compact project switcher for the page header — identity lives in the select, not a second title.
export const OutreachRunProgressHeader = (props: OutreachRunProgressHeaderProps) => {
  const canQueryDashboard = useCanQueryDashboardRecords();

  if (!canQueryDashboard) {
    return (
      <OutreachRunProgressHeaderView
        {...props}
        dashboardPath={getOutreachDashboardFallbackPath()}
      />
    );
  }

  return <OutreachRunProgressHeaderWithDashboardQuery {...props} />;
};

const OutreachRunProgressHeaderWithDashboardQuery = (
  props: OutreachRunProgressHeaderProps,
) => {
  const { dashboard, dashboardPath } = useOutreachCommandDashboardPath();

  return (
    <OutreachRunProgressHeaderView
      {...props}
      dashboardPath={dashboardPath}
      dashboardId={dashboard?.id}
    />
  );
};

type OutreachRunProgressHeaderViewProps = OutreachRunProgressHeaderProps & {
  dashboardPath: string;
  dashboardId?: string;
};

const resolveStatusChip = ({
  outreachStatus,
  linkedinConnected,
}: {
  outreachStatus: OutreachStatus | null;
  linkedinConnected?: boolean;
}): { label: string; tone: 'live' | 'paused' | 'needs-connection' } | null => {
  if (linkedinConnected === false) {
    return { label: 'Needs connection', tone: 'needs-connection' };
  }

  if (outreachStatus === 'PAUSED') {
    return { label: 'Paused', tone: 'paused' };
  }

  if (outreachStatus === 'LIVE') {
    return { label: 'Live', tone: 'live' };
  }

  return null;
};

const OutreachRunProgressHeaderView = ({
  projectId,
  projectOptions,
  onSelectProjectId,
  onCreateProject,
  isCreatingProject = false,
  outreachStatus,
  linkedinConnected,
  onPauseOutreach,
  onResumeOutreach,
  isUpdatingOutreachStatus = false,
  dashboardPath,
  dashboardId,
}: OutreachRunProgressHeaderViewProps) => {
  const navigate = useNavigate();

  const crmDashboardPath =
    isDefined(dashboardId) && isDefined(projectId)
      ? buildOutreachCommandDashboardPath({
          dashboardId,
          projectId,
        })
      : dashboardPath;

  const statusChip = resolveStatusChip({
    outreachStatus,
    linkedinConnected,
  });

  return (
    <StyledActions>
      <StyledSelect
        aria-label="Project"
        value={projectId ?? ''}
        disabled={projectOptions.length === 0}
        onChange={(event) => {
          if (event.target.value) {
            onSelectProjectId(event.target.value);
          }
        }}
      >
        {projectOptions.length === 0 ? (
          <option value="">No projects yet</option>
        ) : (
          projectOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.icpSegment ? ` (${option.icpSegment})` : ''}
            </option>
          ))
        )}
      </StyledSelect>
      {isDefined(statusChip) && (
        <StyledStatusChip $tone={statusChip.tone}>
          {statusChip.label}
        </StyledStatusChip>
      )}
      {outreachStatus === 'LIVE' && isDefined(onPauseOutreach) && (
        <Button
          title="Pause outreach"
          variant="secondary"
          size="small"
          disabled={isUpdatingOutreachStatus || !isDefined(projectId)}
          onClick={onPauseOutreach}
        />
      )}
      {outreachStatus === 'PAUSED' && isDefined(onResumeOutreach) && (
        <Button
          title="Resume outreach"
          variant="secondary"
          size="small"
          disabled={isUpdatingOutreachStatus || !isDefined(projectId)}
          onClick={onResumeOutreach}
        />
      )}
      <Button
        title="New project"
        variant="secondary"
        size="small"
        disabled={isCreatingProject}
        onClick={onCreateProject}
      />
      <Button
        title="CRM"
        variant="secondary"
        size="small"
        onClick={() => navigate(crmDashboardPath)}
      />
    </StyledActions>
  );
};

import { Button } from 'twenty-ui/input';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { isDefined } from 'twenty-shared/utils';

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
  outreachStatus: OutreachStatus | null;
  linkedinConnected?: boolean;
  onPauseOutreach?: () => void;
  onResumeOutreach?: () => void;
  isUpdatingOutreachStatus?: boolean;
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

// Compact project switcher for the page header — identity lives in the select, not a second title.
export const OutreachRunProgressHeader = ({
  projectId,
  projectOptions,
  onSelectProjectId,
  outreachStatus,
  linkedinConnected,
  onPauseOutreach,
  onResumeOutreach,
  isUpdatingOutreachStatus = false,
}: OutreachRunProgressHeaderProps) => {
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
    </StyledActions>
  );
};

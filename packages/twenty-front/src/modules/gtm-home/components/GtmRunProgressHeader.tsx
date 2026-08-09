import { useNavigate } from 'react-router-dom';
import { Button } from 'twenty-ui/input';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useGtmCommandDashboardPath } from '@/gtm-home/hooks/useGtmCommandDashboardPath';
import { type GtmProjectOption } from '@/gtm-home/types/gtm-home.types';

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
  align-items: center;
`;

const StyledSelect = styled.select`
  appearance: none;
  min-width: 180px;
  max-width: 280px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type GtmRunProgressHeaderProps = {
  projectId: string | null;
  projectOptions: GtmProjectOption[];
  onSelectProjectId: (projectId: string) => void;
  onCreateProject: () => void;
  isCreatingProject?: boolean;
};

// Compact run switcher for the page header — identity lives in the select, not a second title.
export const GtmRunProgressHeader = ({
  projectId,
  projectOptions,
  onSelectProjectId,
  onCreateProject,
  isCreatingProject = false,
}: GtmRunProgressHeaderProps) => {
  const navigate = useNavigate();
  const { dashboardPath } = useGtmCommandDashboardPath();

  return (
    <StyledActions>
      <StyledSelect
        aria-label="GTM Project"
        value={projectId ?? ''}
        disabled={projectOptions.length === 0}
        onChange={(event) => {
          if (event.target.value) {
            onSelectProjectId(event.target.value);
          }
        }}
      >
        {projectOptions.length === 0 ? (
          <option value="">No GTM projects yet</option>
        ) : (
          projectOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.icpSegment ? ` (${option.icpSegment})` : ''}
            </option>
          ))
        )}
      </StyledSelect>
      <Button
        title="New run"
        variant="secondary"
        size="small"
        disabled={isCreatingProject}
        onClick={onCreateProject}
      />
      <Button
        title="CRM"
        variant="secondary"
        size="small"
        onClick={() => navigate(dashboardPath)}
      />
    </StyledActions>
  );
};

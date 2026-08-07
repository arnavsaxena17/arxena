import { useNavigate } from 'react-router-dom';
import { Button } from 'twenty-ui/input';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useGtmCommandDashboardPath } from '@/gtm-home/hooks/useGtmCommandDashboardPath';
import { type GtmProjectOption } from '@/gtm-home/types/gtm-home.types';

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
`;

const StyledTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[3]};
  flex-wrap: wrap;
`;

const StyledTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledHeading = styled.h1`
  margin: 0;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledSubheading = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
  align-items: center;
`;

const StyledSelect = styled.select`
  appearance: none;
  min-width: 220px;
  max-width: 320px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type GtmRunProgressHeaderProps = {
  workspaceName: string;
  domain: string;
  projectId: string | null;
  projectName: string | null;
  icpSegment: string | null;
  projectOptions: GtmProjectOption[];
  onSelectProjectId: (projectId: string) => void;
  onCreateProject: () => void;
  isCreatingProject?: boolean;
};

export const GtmRunProgressHeader = ({
  workspaceName,
  domain,
  projectId,
  projectName,
  icpSegment,
  projectOptions,
  onSelectProjectId,
  onCreateProject,
  isCreatingProject = false,
}: GtmRunProgressHeaderProps) => {
  const navigate = useNavigate();
  const { dashboardPath } = useGtmCommandDashboardPath();

  return (
    <StyledHeader>
      <StyledTitleRow>
        <StyledTitle>
          <StyledHeading>GTM Command · {workspaceName}</StyledHeading>
          <StyledSubheading>
            {projectName ?? 'No GTM Project selected'}
            {domain ? ` · ${domain}` : ''}
            {icpSegment ? ` · ICP: ${icpSegment}` : ' · Define ICP in Ask AI'}
            {projectId ? ` · projectId ${projectId.slice(0, 8)}…` : ''}
          </StyledSubheading>
        </StyledTitle>
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
            title="New GTM run"
            variant="secondary"
            size="small"
            disabled={isCreatingProject}
            onClick={onCreateProject}
          />
          <Button
            title="Open CRM dashboard"
            variant="secondary"
            size="small"
            onClick={() => navigate(dashboardPath)}
          />
        </StyledActions>
      </StyledTitleRow>
    </StyledHeader>
  );
};

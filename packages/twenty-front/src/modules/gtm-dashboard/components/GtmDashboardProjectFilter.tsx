import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';

import { GTM_DASHBOARD_ALL_PROJECTS_VALUE } from '@/gtm-dashboard/constants/gtm-dashboard.constants';
import { useGtmDashboardScopeContextOptional } from '@/gtm-dashboard/hooks/useGtmDashboardScope';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

export const GtmDashboardProjectFilter = () => {
  const scope = useGtmDashboardScopeContextOptional();

  if (!scope?.isActive) {
    return null;
  }

  const { selectedProjectId, setSelectedProjectId, projectOptions, projectsLoading } =
    scope;

  return (
    <StyledSelect
      aria-label={t`GTM Project`}
      value={selectedProjectId ?? GTM_DASHBOARD_ALL_PROJECTS_VALUE}
      disabled={projectsLoading && projectOptions.length === 0}
      onChange={(event) => {
        const nextValue = event.target.value;

        setSelectedProjectId(
          nextValue === GTM_DASHBOARD_ALL_PROJECTS_VALUE ? null : nextValue,
        );
      }}
    >
      <option value={GTM_DASHBOARD_ALL_PROJECTS_VALUE}>{t`All projects`}</option>
      {projectOptions.length === 0 ? (
        <option value="" disabled>
          {projectsLoading ? t`Loading projects...` : t`No GTM projects yet`}
        </option>
      ) : (
        projectOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.icpSegment ? ` (${option.icpSegment})` : ''}
          </option>
        ))
      )}
    </StyledSelect>
  );
};

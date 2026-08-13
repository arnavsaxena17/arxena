import { Trans } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { orgChartQueryGeneratorPreferenceState } from '@/orgchart/states/orgChartQueryGeneratorPreferenceState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

const StyledLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  min-width: ${themeCssVariables.spacing[28]};
`;

const StyledCaption = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

export const OrgChartQueryGeneratorControl = () => {
  const [orgChartQueryGeneratorPreference, setOrgChartQueryGeneratorPreference] = useAtomState(orgChartQueryGeneratorPreferenceState);

  return (
    <StyledLabel>
      <StyledCaption>
        <Trans>LinkedIn query generator</Trans>
      </StyledCaption>
      <StyledSelect
        value={orgChartQueryGeneratorPreference}
        onChange={(e) =>
          setOrgChartQueryGeneratorPreference(
            e.target.value as typeof orgChartQueryGeneratorPreference,
          )
        }
        aria-label="LinkedIn query generator"
      >
        <option value="python">Python (deterministic)</option>
        <option value="multi_agent">Multi-agent (LLM)</option>
      </StyledSelect>
    </StyledLabel>
  );
};

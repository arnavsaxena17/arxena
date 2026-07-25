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
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledSelect = styled.select`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.primary};
`;

export const OrgChartQueryGeneratorControl = () => {
  const [value, setValue] = useAtomState(orgChartQueryGeneratorPreferenceState);

  return (
    <StyledLabel>
      <StyledCaption>
        <Trans>LinkedIn query generator</Trans>
      </StyledCaption>
      <StyledSelect
        value={value}
        onChange={(e) =>
          setValue(e.target.value as typeof value)
        }
        aria-label="LinkedIn query generator"
      >
        <option value="python">Python (deterministic)</option>
        <option value="multi_agent">Multi-agent (LLM)</option>
      </StyledSelect>
    </StyledLabel>
  );
};

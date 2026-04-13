import styled from '@emotion/styled';
import { Trans } from '@lingui/react/macro';
import { useRecoilState } from 'recoil';

import { orgChartQueryGeneratorPreferenceState } from '@/orgchart/states/orgChartQueryGeneratorPreferenceState';

const StyledLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  min-width: ${({ theme }) => theme.spacing(28)};
`;

const StyledCaption = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
`;

export const OrgChartQueryGeneratorControl = () => {
  const [value, setValue] = useRecoilState(orgChartQueryGeneratorPreferenceState);

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

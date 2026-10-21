import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type ToolProgressData } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin: ${themeCssVariables.spacing[1]} 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledMessage = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTrack = styled.div`
  background: ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  height: 4px;
  overflow: hidden;
`;

const StyledBar = styled.div<{ percent: number; isError: boolean }>`
  background: ${({ isError }) =>
    isError ? themeCssVariables.color.red : themeCssVariables.color.blue};
  height: 100%;
  transition: width 0.3s ease;
  width: ${({ percent }) => `${percent}%`};
`;

const StyledLogs = styled.pre`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: monospace;
  font-size: ${themeCssVariables.font.size.xs};
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

type ToolProgressDisplayProps = {
  data: ToolProgressData;
};

export const ToolProgressDisplay = ({ data }: ToolProgressDisplayProps) => {
  const { t } = useLingui();
  const hasTotal = isDefined(data.total) && data.total > 0;
  const percent =
    data.state === 'completed'
      ? 100
      : hasTotal
        ? Math.min(100, Math.round(((data.current ?? 0) / data.total!) * 100))
        : 0;

  return (
    <StyledContainer>
      <StyledMessage>
        {data.state === 'error' ? t`Failed: ${data.message}` : data.message}
      </StyledMessage>
      {isDefined(data.logs) && data.logs.length > 0 && (
        <StyledLogs>{data.logs.join('\n')}</StyledLogs>
      )}
      {(hasTotal || data.state === 'completed') && (
        <StyledTrack>
          <StyledBar percent={percent} isError={data.state === 'error'} />
        </StyledTrack>
      )}
    </StyledContainer>
  );
};

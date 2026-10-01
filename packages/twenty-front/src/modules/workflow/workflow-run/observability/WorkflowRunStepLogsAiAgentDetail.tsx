import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Fragment } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { type AiAgentStepLogDetails } from 'twenty-shared/workflow';
import {
  IconBrain,
  IconClock,
  IconCoins,
  IconCpu,
  IconTool,
  IconWorld,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { formatDuration } from '@/workflow/workflow-run/observability/workflowRunStepLogsFormatters';
import {
  StyledBadgeGroup,
  StyledEmptyHint,
  StyledHeaderLeft,
  StyledMetric,
  StyledMetricLabel,
  StyledMetricsRow,
  StyledMetricValue,
  StyledSection,
  StyledSectionTitle,
  StyledSummaryCard,
  StyledSummaryHeader,
  StyledTitle,
} from '@/workflow/workflow-run/observability/workflowRunStepLogsStyles';
import { WorkflowRunStepLogsToolCallRow } from '@/workflow/workflow-run/observability/WorkflowRunStepLogsToolCallRow';
import { formatNumber } from '~/utils/format/formatNumber';

const StyledModelBadge = styled.span`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.xs};
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  white-space: nowrap;
`;

const StyledUsageGrid = styled.div`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: grid;
  gap: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[4]};
  grid-template-columns: max-content 1fr;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledUsageLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledUsageValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-variant-numeric: tabular-nums;
  text-align: right;
`;

const StyledToolList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const formatCost = (dollars: number): string => {
  if (dollars === 0) {
    return '$0';
  }

  if (Math.abs(dollars) < 0.01) {
    return `$${dollars.toFixed(4)}`;
  }

  return `$${formatNumber(dollars, { decimals: 2 })}`;
};

const formatTokenCount = (tokens: number): string =>
  formatNumber(tokens, { abbreviate: true, decimals: 1 });

type OutputValidationField = NonNullable<
  AiAgentStepLogDetails['outputValidation']
>['fields'][number];

const formatOutputValidationField = (field: OutputValidationField): string => {
  if (field.skipped) {
    return 'empty, skipped';
  }

  const checkDetails = isDefined(field.checkResults)
    ? field.checkResults.map((checkResult) => {
        const score = isDefined(checkResult.noul)
          ? checkResult.noul.toFixed(2)
          : 'n/a';

        return `${checkResult.label} ${score}`;
      })
    : [
        isDefined(field.operatorNote)
          ? `operator note ${field.operatorNote.toFixed(2)}`
          : undefined,
        isDefined(field.unresolvedPlaceholder)
          ? `placeholder ${field.unresolvedPlaceholder.toFixed(2)}`
          : undefined,
      ].filter(isDefined);
  const details = [
    ...checkDetails,
    field.codeFailure ? `token ${field.codeFailure}` : undefined,
  ].filter(isDefined);

  const verdict = field.cleared ? 'cleared' : 'not cleared';
  const detailText = details.length > 0 ? ` (${details.join(', ')})` : '';

  return `${verdict}${detailText}`;
};

export const WorkflowRunStepLogsAiAgentDetail = ({
  details,
}: {
  details: AiAgentStepLogDetails;
}) => {
  const { t } = useLingui();

  const {
    usage,
    cost,
    modelId,
    toolCalls,
    nativeWebSearchCallCount,
    durationMs,
    outputValidation,
  } = details;

  const usageRows = [
    { label: t`Input`, value: usage.inputTokens, show: true },
    { label: t`Output`, value: usage.outputTokens, show: true },
    {
      label: t`Reasoning`,
      value: usage.reasoningTokens,
      show: isDefined(usage.reasoningTokens) && usage.reasoningTokens > 0,
    },
    {
      label: t`Cached read`,
      value: usage.cacheReadTokens,
      show: isDefined(usage.cacheReadTokens) && usage.cacheReadTokens > 0,
    },
    {
      label: t`Cached creation`,
      value: usage.cacheCreationTokens,
      show:
        isDefined(usage.cacheCreationTokens) && usage.cacheCreationTokens > 0,
    },
  ].filter((row) => row.show);

  return (
    <>
      <StyledSummaryCard>
        <StyledSummaryHeader>
          <StyledHeaderLeft>
            <IconBrain size={16} />
            <StyledTitle>{t`AI agent run`}</StyledTitle>
          </StyledHeaderLeft>
          <StyledBadgeGroup>
            <StyledModelBadge>{modelId}</StyledModelBadge>
          </StyledBadgeGroup>
        </StyledSummaryHeader>

        <StyledMetricsRow>
          <StyledMetric>
            <StyledMetricLabel>
              <IconCpu size={12} />
              {t`Tokens`}
            </StyledMetricLabel>
            <StyledMetricValue>
              {formatTokenCount(usage.totalTokens)}
            </StyledMetricValue>
          </StyledMetric>
          <StyledMetric>
            <StyledMetricLabel>
              <IconCoins size={12} />
              {t`Cost`}
            </StyledMetricLabel>
            <StyledMetricValue>
              {formatCost(cost.totalCostInDollars)}
            </StyledMetricValue>
          </StyledMetric>
          <StyledMetric>
            <StyledMetricLabel>
              <IconTool size={12} />
              {t`Tool calls`}
            </StyledMetricLabel>
            <StyledMetricValue>{toolCalls.length}</StyledMetricValue>
          </StyledMetric>
          {nativeWebSearchCallCount > 0 && (
            <StyledMetric>
              <StyledMetricLabel>
                <IconWorld size={12} />
                {t`Web searches`}
              </StyledMetricLabel>
              <StyledMetricValue>{nativeWebSearchCallCount}</StyledMetricValue>
            </StyledMetric>
          )}
          <StyledMetric>
            <StyledMetricLabel>
              <IconClock size={12} />
              {t`Duration`}
            </StyledMetricLabel>
            <StyledMetricValue>{formatDuration(durationMs)}</StyledMetricValue>
          </StyledMetric>
        </StyledMetricsRow>
      </StyledSummaryCard>

      {isDefined(outputValidation) && (
        <StyledSection>
          <StyledSectionTitle>
            {outputValidation.cleared
              ? t`Jev cleared this draft`
              : t`Jev did not clear this draft`}
          </StyledSectionTitle>
          <StyledUsageGrid>
            <StyledUsageLabel>{t`Drafts`}</StyledUsageLabel>
            <StyledUsageValue>{outputValidation.attempts}</StyledUsageValue>
            {outputValidation.fields.map((field) => (
              <Fragment key={field.fieldKey}>
                <StyledUsageLabel>{field.fieldKey}</StyledUsageLabel>
                <StyledUsageValue>
                  {formatOutputValidationField(field)}
                </StyledUsageValue>
              </Fragment>
            ))}
          </StyledUsageGrid>
        </StyledSection>
      )}

      {usageRows.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>{t`Token usage`}</StyledSectionTitle>
          <StyledUsageGrid>
            {usageRows.map((row) => (
              <Fragment key={row.label}>
                <StyledUsageLabel>{row.label}</StyledUsageLabel>
                <StyledUsageValue>
                  {formatNumber(row.value ?? 0)}
                </StyledUsageValue>
              </Fragment>
            ))}
          </StyledUsageGrid>
        </StyledSection>
      )}

      <StyledSection>
        <StyledSectionTitle>
          {toolCalls.length > 0
            ? t`Tool calls (${toolCalls.length})`
            : t`Tool calls`}
        </StyledSectionTitle>
        {toolCalls.length === 0 ? (
          <StyledEmptyHint>{t`No tools were called`}</StyledEmptyHint>
        ) : (
          <StyledToolList>
            {toolCalls.map((toolCall) => (
              <WorkflowRunStepLogsToolCallRow
                key={toolCall.toolCallId}
                toolCall={toolCall}
              />
            ))}
          </StyledToolList>
        )}
      </StyledSection>
    </>
  );
};

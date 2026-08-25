import { type ChangeEvent } from 'react';
import { styled } from '@linaria/react';
import { Pill } from 'twenty-ui/data-display';
import { IconEraser, IconInfoCircle } from 'twenty-ui/icon';
import { LightIconButton, Slider } from 'twenty-ui/input';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

const Row = styled.div`
  align-items: center;
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(140px, 1.2fr) 92px minmax(120px, 1.4fr) 72px max-content auto;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const LabelBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const LabelRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const Label = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const WindowLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const InfoAnchor = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  flex-shrink: 0;
  outline: none;
`;

const UsageBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const UsageCounts = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-variant-numeric: tabular-nums;
  font-weight: ${themeCssVariables.font.weight.medium};
  white-space: nowrap;
`;

const UsageCaption = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  white-space: nowrap;
`;

const RecommendedSlot = styled.div`
  justify-self: start;
  min-height: ${themeCssVariables.spacing[4]};
`;

export type AccountRateLimitSliderRowProps = {
  instanceId: string;
  label: string;
  windowLabel: string;
  value: number;
  used: number;
  min: number;
  max: number;
  recommended: number;
  onChange: (value: number) => void;
  onClearUsage?: () => void;
  clearing?: boolean;
  disabled?: boolean;
};

export const AccountRateLimitSliderRow = ({
  instanceId,
  label,
  windowLabel,
  value,
  used,
  min,
  max,
  recommended,
  onChange,
  onClearUsage,
  clearing = false,
  disabled = false,
}: AccountRateLimitSliderRowProps) => {
  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };
  const tooltipId = `rate-limit-recommended-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const atCap = used >= value;

  return (
    <Row>
      <LabelBlock>
        <LabelRow>
          <Label>{label}</Label>
          <InfoAnchor id={tooltipId} tabIndex={0} aria-label="Recommended limit">
            <IconInfoCircle size={14} />
          </InfoAnchor>
          <AppTooltip
            anchorSelect={`#${tooltipId}`}
            content={`Recommended: ${recommended} ${windowLabel}`}
            noArrow
            place="top"
            positionStrategy="fixed"
            delay={TooltipDelay.shortDelay}
          />
        </LabelRow>
        <WindowLabel>{windowLabel}</WindowLabel>
      </LabelBlock>
      <UsageBlock
        aria-label={`${used} used of ${value} maximum ${windowLabel}`}
        title={`${used} used of ${value} maximum ${windowLabel}`}
      >
        <UsageCounts
          style={{
            color: atCap
              ? themeCssVariables.font.color.danger
              : themeCssVariables.font.color.primary,
          }}
        >
          {used} / {value}
        </UsageCounts>
        <UsageCaption>used / max</UsageCaption>
      </UsageBlock>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={handleSliderChange}
      />
      <SettingsTextInput
        instanceId={instanceId}
        type="number"
        value={String(value)}
        onChange={(next) => {
          const parsed = Number.parseInt(next, 10);
          if (Number.isFinite(parsed)) {
            onChange(Math.min(max, Math.max(min, parsed)));
          }
        }}
      />
      <RecommendedSlot
        aria-hidden={value !== recommended}
        style={{
          visibility: value === recommended ? 'visible' : 'hidden',
        }}
      >
        <Pill label="Recommended" />
      </RecommendedSlot>
      {onClearUsage && (
        <LightIconButton
          Icon={IconEraser}
          aria-label={`Clear used requests for ${label} ${windowLabel}`}
          title={`Clear used requests for ${label} ${windowLabel}`}
          disabled={disabled || clearing}
          onClick={onClearUsage}
        />
      )}
    </Row>
  );
};

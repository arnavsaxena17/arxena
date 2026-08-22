import { type ChangeEvent } from 'react';
import { styled } from '@linaria/react';
import { Pill } from 'twenty-ui/data-display';
import { IconReload } from 'twenty-ui/icon';
import { LightIconButton, Slider } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

const Row = styled.div`
  align-items: center;
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(140px, 1.2fr) minmax(120px, 1.4fr) 72px max-content auto;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const LabelBlock = styled.div`
  display: flex;
  flex-direction: column;
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

const RecommendedSlot = styled.div`
  justify-self: start;
  min-height: ${themeCssVariables.spacing[4]};
`;

export type AccountRateLimitSliderRowProps = {
  instanceId: string;
  label: string;
  windowLabel: string;
  value: number;
  min: number;
  max: number;
  recommended: number;
  onChange: (value: number) => void;
};

export const AccountRateLimitSliderRow = ({
  instanceId,
  label,
  windowLabel,
  value,
  min,
  max,
  recommended,
  onChange,
}: AccountRateLimitSliderRowProps) => {
  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <Row>
      <LabelBlock>
        <Label>{label}</Label>
        <WindowLabel>{windowLabel}</WindowLabel>
      </LabelBlock>
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
      <LightIconButton
        Icon={IconReload}
        aria-label="Reset to recommended"
        onClick={() => onChange(recommended)}
      />
    </Row>
  );
};

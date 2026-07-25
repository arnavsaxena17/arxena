import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconMinus, IconPlus } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledStepper = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: ${themeCssVariables.spacing[4]};
  text-align: center;
`;

type LicenceQuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  'aria-label'?: string;
};

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 999;

export const LicenceQuantityStepper = ({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  disabled = false,
  'aria-label': ariaLabel,
}: LicenceQuantityStepperProps) => {
  const { t } = useLingui();
  const clamped = Math.max(min, Math.min(max, value));
  const atMin = clamped <= min;
  const atMax = clamped >= max;

  const handleDecrease = () => {
    if (!atMin) {
      onChange(clamped - 1);
    }
  };

  const handleIncrease = () => {
    if (!atMax) {
      onChange(clamped + 1);
    }
  };

  return (
    <StyledStepper
      role="group"
      aria-label={ariaLabel ?? t`Number of licences`}
    >
      <IconButton
        Icon={IconMinus}
        variant="secondary"
        size="small"
        onClick={handleDecrease}
        disabled={disabled || atMin}
        ariaLabel={t`Decrease licences`}
      />
      <StyledValue>{clamped}</StyledValue>
      <IconButton
        Icon={IconPlus}
        variant="secondary"
        size="small"
        onClick={handleIncrease}
        disabled={disabled || atMax}
        ariaLabel={t`Increase licences`}
      />
    </StyledStepper>
  );
};

import { styled } from '@linaria/react';
import {
  formatSendWindowDaysSummary,
  SEND_WINDOW_WEEKDAY_OPTIONS,
  type SendWindowWeekday,
} from 'twenty-shared/arx';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledDayPicker = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDayRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledDayButton = styled.button<{ $isSelected: boolean }>`
  appearance: none;
  background: ${({ $isSelected }) =>
    $isSelected
      ? themeCssVariables.background.transparent.light
      : themeCssVariables.background.primary};
  border: 1px solid
    ${({ $isSelected }) =>
      $isSelected
        ? themeCssVariables.border.color.strong
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ $isSelected }) =>
    $isSelected
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${({ $isSelected }) =>
    $isSelected
      ? themeCssVariables.font.weight.medium
      : themeCssVariables.font.weight.regular};
  min-width: 44px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:not(:disabled):hover {
    border-color: ${themeCssVariables.border.color.strong};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledPresetRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSummary = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
`;

const WEEKDAY_PRESET: SendWindowWeekday[] = [1, 2, 3, 4, 5];
const TUE_THU_PRESET: SendWindowWeekday[] = [2, 3, 4];

type OutreachSendWindowDayPickerProps = {
  selectedDays: SendWindowWeekday[];
  disabled?: boolean;
  onChange: (days: SendWindowWeekday[]) => void;
};

export const OutreachSendWindowDayPicker = ({
  selectedDays,
  disabled = false,
  onChange,
}: OutreachSendWindowDayPickerProps) => {
  const toggleDay = (day: SendWindowWeekday) => {
    if (disabled) {
      return;
    }

    const isSelected = selectedDays.includes(day);

    if (isSelected) {
      if (selectedDays.length === 1) {
        return;
      }

      onChange(selectedDays.filter((selectedDay) => selectedDay !== day));

      return;
    }

    onChange([...selectedDays, day].sort((left, right) => left - right));
  };

  return (
    <StyledDayPicker>
      <StyledDayRow role="group" aria-label="Allowed send days">
        {SEND_WINDOW_WEEKDAY_OPTIONS.map((option) => {
          const isSelected = selectedDays.includes(option.value);

          return (
            <StyledDayButton
              key={option.value}
              type="button"
              $isSelected={isSelected}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={option.label}
              onClick={() => toggleDay(option.value)}
            >
              {option.shortLabel}
            </StyledDayButton>
          );
        })}
      </StyledDayRow>
      <StyledPresetRow>
        <Button
          title="Weekdays"
          variant="secondary"
          size="small"
          disabled={disabled}
          onClick={() => onChange([...WEEKDAY_PRESET])}
        />
        {/* <Button
          title="Tue–Thu"
          variant="secondary"
          size="small"
          disabled={disabled}
          onClick={() => onChange([...TUE_THU_PRESET])}
        /> */}
        <StyledSummary>
          {formatSendWindowDaysSummary(selectedDays)} selected
        </StyledSummary>
      </StyledPresetRow>
    </StyledDayPicker>
  );
};

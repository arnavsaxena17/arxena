export type SendWindowWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Mon–Sat (exclude Sunday) — default outreach send days
export const DEFAULT_SEND_WINDOW_DAYS: SendWindowWeekday[] = [
  1, 2, 3, 4, 5, 6,
];

export const SEND_WINDOW_WEEKDAY_OPTIONS: {
  value: SendWindowWeekday;
  label: string;
  shortLabel: string;
}[] = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 0, label: 'Sunday', shortLabel: 'Sun' },
];

export const parseSendWindowDays = (
  value: string | null | undefined,
): SendWindowWeekday[] => {
  if (!value?.trim()) {
    return [...DEFAULT_SEND_WINDOW_DAYS];
  }

  const parsedDays = value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter(
      (day): day is SendWindowWeekday =>
        Number.isInteger(day) && day >= 0 && day <= 6,
    );

  const uniqueDays = [...new Set(parsedDays)].sort(
    (left, right) => left - right,
  );

  return uniqueDays.length > 0 ? uniqueDays : [...DEFAULT_SEND_WINDOW_DAYS];
};

export const formatSendWindowDays = (days: SendWindowWeekday[]): string =>
  [...new Set(days)]
    .sort((left, right) => left - right)
    .join(',');

export const formatSendWindowDaysSummary = (
  days: SendWindowWeekday[],
): string => {
  const labelByDay = new Map(
    SEND_WINDOW_WEEKDAY_OPTIONS.map((option) => [
      option.value,
      option.shortLabel,
    ]),
  );

  const labels = [...new Set(days)]
    .sort((left, right) => left - right)
    .map((day) => labelByDay.get(day))
    .filter((label): label is string => label !== undefined);

  if (labels.length === 0) {
    return 'No days selected';
  }

  if (labels.length === 7) {
    return 'Every day';
  }

  if (
    labels.length === 5 &&
    [1, 2, 3, 4, 5].every((weekday) => days.includes(weekday as SendWindowWeekday))
  ) {
    return 'Weekdays';
  }

  if (
    labels.length === 6 &&
    [1, 2, 3, 4, 5, 6].every((weekday) =>
      days.includes(weekday as SendWindowWeekday),
    )
  ) {
    return 'Mon–Sat';
  }

  return labels.join(', ');
};

export const areSendWindowDaysEqual = (
  left: SendWindowWeekday[],
  right: SendWindowWeekday[],
): boolean => formatSendWindowDays(left) === formatSendWindowDays(right);

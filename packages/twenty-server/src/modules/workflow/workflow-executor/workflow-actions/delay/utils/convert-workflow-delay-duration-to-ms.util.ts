import { type WorkflowDelayDuration } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/workflow-delay-action-input.type';

const toNonNegativeNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === '') {
    return 0;
  }

  const parsedNumber = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
    return 0;
  }

  return parsedNumber;
};

export const convertWorkflowDelayDurationToMs = (
  duration: WorkflowDelayDuration,
): number => {
  const days = toNonNegativeNumber(duration.days);
  const hours = toNonNegativeNumber(duration.hours);
  const minutes = toNonNegativeNumber(duration.minutes);
  const seconds = toNonNegativeNumber(duration.seconds);

  return (
    days * 24 * 60 * 60 * 1000 +
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000
  );
};

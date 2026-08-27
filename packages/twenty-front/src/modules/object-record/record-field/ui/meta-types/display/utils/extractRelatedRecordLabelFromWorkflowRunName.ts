const WORKFLOW_RUN_NAME_RECORD_LABEL_REGEX =
  /^#\d+\s+-\s+(.+?)\s+·\s+.+$/;

export const extractRelatedRecordLabelFromWorkflowRunName = (
  name: unknown,
): string | undefined => {
  if (typeof name !== 'string') {
    return undefined;
  }

  const match = name.match(WORKFLOW_RUN_NAME_RECORD_LABEL_REGEX);

  if (match === null) {
    return undefined;
  }

  const recordLabel = match[1]?.trim();

  return recordLabel !== undefined && recordLabel.length > 0
    ? recordLabel
    : undefined;
};

// Reply-branch forms set this so No skips that send and the run continues.
export const workflowFormRejectContinues = (step: {
  settings?: unknown;
}): boolean => {
  const settings = step.settings;

  if (typeof settings !== 'object' || settings === null) {
    return false;
  }

  return (settings as { rejectContinues?: boolean }).rejectContinues === true;
};

export const splitWorkflowTriggerEventName = (
  eventName: string | null | undefined,
) => {
  if (typeof eventName !== 'string' || eventName.length === 0) {
    return {
      objectType: '',
      event: '',
    };
  }

  const [objectType, event] = eventName.split('.');

  return {
    objectType: objectType ?? '',
    event: event ?? '',
  };
};

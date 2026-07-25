export type JobIdValidationResult = {
  isValid: boolean;
  jobId?: string;
  error?: string;
};

// Validates and extracts job ID from string or object payloads
export const validateAndExtractJobId = (
  input: unknown,
): JobIdValidationResult => {
  if (!input) {
    return {
      isValid: false,
      error: 'Missing required field: jobId',
    };
  }

  let actualJobId: string;
  let resolvedInput = input;

  // Handle URL-encoded strings that might be [object%20Object]
  if (typeof resolvedInput === 'string' && resolvedInput.includes('%20')) {
    const decoded = decodeURIComponent(resolvedInput);
    if (decoded === '[object Object]') {
      console.error(
        'Received URL-encoded [object Object] for jobId:',
        resolvedInput,
      );
      return {
        isValid: false,
        error:
          'Invalid jobId format - received URL-encoded object instead of UUID',
      };
    }
    resolvedInput = decoded;
  }

  if (typeof resolvedInput === 'object' && resolvedInput !== null) {
    const jobIdObject = resolvedInput as Record<string, unknown>;
    const extractedJobId =
      jobIdObject.id || jobIdObject.jobId || jobIdObject.job_id;

    if (typeof extractedJobId !== 'string' || !extractedJobId) {
      console.error('Invalid jobId object structure:', resolvedInput);
      return {
        isValid: false,
        error:
          'Invalid jobId format - expected string or object with id property',
      };
    }
    actualJobId = extractedJobId;
  } else if (typeof resolvedInput === 'string') {
    actualJobId = resolvedInput;
  } else {
    console.error('Invalid jobId type:', typeof resolvedInput, resolvedInput);
    return {
      isValid: false,
      error: 'Invalid jobId type - expected string or object',
    };
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(actualJobId)) {
    console.error('Invalid UUID format for jobId:', actualJobId);
    return {
      isValid: false,
      error: 'Invalid jobId format - expected valid UUID',
    };
  }

  return {
    isValid: true,
    jobId: actualJobId,
  };
};

export const createJobIdErrorResponse = (error: string) => {
  return {
    status: 'Failed',
    message: error,
  };
};

/**
 * Utility functions for handling job ID validation and extraction
 */

export interface ProjectIdValidationResult {
  isValid: boolean;
  projectId?: string;
  error?: string;
}

/**
 * Validates and extracts job ID from various input formats
 * @param input - The input that should contain a job ID (string, object, etc.)
 * @returns ProjectIdValidationResult with validation status and extracted job ID
 */
export function validateAndExtractProjectId(input: any): ProjectIdValidationResult {

  if (!input) {
    return {
      isValid: false,
      error: 'Missing required field: projectId',
    };
  }

  let actualProjectId: string;

  // Handle URL-encoded strings that might be [object%20Object]
  if (typeof input === 'string' && input.includes('%20')) {
    const decoded = decodeURIComponent(input);
    if (decoded === '[object Object]') {
      console.error('Received URL-encoded [object Object] for projectId:', input);
      return {
        isValid: false,
        error: 'Invalid projectId format - received URL-encoded object instead of UUID',
      };
    }
    input = decoded;
  }

  // Handle case where projectId might be an object instead of string
  if (typeof input === 'object' && input !== null) {
    // If it's an object, try to extract the id property
    actualProjectId =
      input.id || input.projectId || input.jobId || input.job_id;
    if (!actualProjectId) {
      console.error('Invalid projectId object structure:', input);
      return {
        isValid: false,
        error: 'Invalid projectId format - expected string or object with id property',
      };
    }
  } else if (typeof input === 'string') {
    actualProjectId = input;
  } else {
    console.error('Invalid projectId type:', typeof input, input);
    return {
      isValid: false,
      error: 'Invalid projectId type - expected string or object',
    };
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(actualProjectId)) {
    console.error('Invalid UUID format for projectId:', actualProjectId);
    return {
      isValid: false,
      error: 'Invalid projectId format - expected valid UUID',
    };
  }

  return {
    isValid: true,
    projectId: actualProjectId,
  };
}

/**
 * Creates a standardized error response for invalid job ID
 * @param error - The error message
 * @returns Standardized error response object
 */
export function createProjectIdErrorResponse(error: string) {
  return {
    status: 'Failed',
    message: error,
  };
}

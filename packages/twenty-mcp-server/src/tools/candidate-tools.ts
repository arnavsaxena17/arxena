import type { CandidateNode, Candidates, People } from 'twenty-shared';
import {
  graphqlQueryToFindManyPeople,
  graphqlToAddNewCandidate,
  graphqlToAddNewPerson,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  mutationToUpdateOnePerson,
} from 'twenty-shared';

import { executeGraphQL } from '../api/graphql-client';
import { callCandidateSourcingRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

function extractCandidates(data: unknown): CandidateNode[] {
  const result = data as { candidates: Candidates };
  return result?.candidates?.edges?.map((e) => e.node) ?? [];
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export const candidateTools: McpTool[] = [
  {
    definition: {
      name: 'list_candidates_for_job',
      description:
        'List candidates for a specific job. Optionally filter by status. Returns names, contact info, and current status of each candidate.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The job ID to list candidates for',
          },
          status: {
            type: 'string',
            description:
              'Optional status filter (e.g. SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of candidates to return (default: 50)',
          },
        },
        required: ['jobId'],
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string;
      const status = args.status as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;

      const filter: Record<string, unknown> = { jobsId: { eq: jobId } };
      if (status) {
        filter.status = { eq: status };
      }

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFetchAllCandidateData,
        { filter, limit },
      );

      const candidates = extractCandidates(data);
      return {
        count: candidates.length,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          engagementStatus: c.engagementStatus,
          remarks: c.remarks,
          peopleId: c.peopleId,
          phone: c.people?.phones?.primaryPhoneNumber,
          email: c.people?.emails?.primaryEmail,
          jobTitle: c.people?.jobTitle,
          city: c.people?.city,
          updatedAt: c.updatedAt,
        })),
      };
    },
  },

  {
    definition: {
      name: 'find_candidate',
      description:
        'Search for a candidate by name, email, or phone number across all jobs. Returns matching candidates with their job associations. At least one search parameter is required. Use this before updating a candidate.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Partial or full name to search for',
          },
          email: {
            type: 'string',
            description: 'Email address to search for (exact match)',
          },
          phone: {
            type: 'string',
            description: 'Phone number to search for (partial match)',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 20)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const name = args.name as string | undefined;
      const email = args.email as string | undefined;
      const phone = args.phone as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 20;

      if (!name && !email && !phone) {
        throw new Error('At least one of name, email, or phone must be provided.');
      }

      const orConditions: unknown[] = [];

      if (name) {
        const { firstName, lastName } = parseName(name);
        if (firstName) {
          orConditions.push({ name: { firstName: { like: `%${firstName}%` } } });
        }
        if (lastName) {
          orConditions.push({ name: { lastName: { like: `%${lastName}%` } } });
        }
      }
      if (email) {
        orConditions.push({ emails: { primaryEmail: { eq: email } } });
      }
      if (phone) {
        orConditions.push({ phones: { primaryPhoneNumber: { like: `%${phone}%` } } });
      }

      const filter = orConditions.length > 1 ? { or: orConditions } : orConditions[0];

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlQueryToFindManyPeople,
        { filter, limit },
      );

      const result = data as { people: People };
      const people = result?.people?.edges?.map((e) => e.node) ?? [];

      return {
        count: people.length,
        results: people.map((p) => ({
          personId: p.id,
          firstName: p.name?.firstName,
          lastName: p.name?.lastName,
          phone: p.phones?.primaryPhoneNumber,
          email: p.emails?.primaryEmail,
          city: p.city,
          jobTitle: p.jobTitle,
          linkedinUrl: p.linkedinLink?.primaryLinkUrl,
          candidates:
            p.candidates?.edges?.map((ce) => ({
              candidateId: ce.node.id,
              candidateName: ce.node.name,
              status: ce.node.status,
              jobId: ce.node.jobs?.id,
              jobName: ce.node.jobs?.name,
            })) ?? [],
        })),
      };
    },
  },

  {
    definition: {
      name: 'get_candidate_details',
      description: 'Get full details for a specific candidate by their candidate ID.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: {
            type: 'string',
            description: 'The candidate ID to fetch details for',
          },
        },
        required: ['candidateId'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFetchAllCandidateData,
        { filter: { id: { eq: candidateId } }, limit: 1 },
      );

      const candidates = extractCandidates(data);
      if (candidates.length === 0) {
        return { error: `No candidate found with ID: ${candidateId}` };
      }

      const c = candidates[0];
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        engagementStatus: c.engagementStatus,
        remarks: c.remarks,
        peopleId: c.peopleId,
        jobId: c.jobsId,
        jobName: c.jobs?.name,
        phone: c.people?.phones?.primaryPhoneNumber,
        email: c.people?.emails?.primaryEmail,
        city: c.people?.city,
        jobTitle: c.people?.jobTitle,
        salary: c.people?.salary,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
    },
  },

  {
    definition: {
      name: 'create_candidate',
      description:
        'Create a new candidate and link them to a job. Uses the post-candidates flow which creates both the person record and candidate node. Use list_active_jobs first to get the correct jobId.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The job ID to link this candidate to',
          },
          name: {
            type: 'string',
            description: 'Full name of the candidate (e.g. "John Smith")',
          },
          phoneNumber: {
            type: 'string',
            description: 'Phone number with country code (e.g. "+919876543210")',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          status: {
            type: 'string',
            description:
              'Initial status (default: SCREENING). Options: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION',
          },
          source: {
            type: 'string',
            description: 'Source of the candidate (e.g. "LinkedIn", "Referral", "Portal")',
          },
          remarks: {
            type: 'string',
            description: 'Initial notes about the candidate',
          },
        },
        required: ['jobId', 'name'],
      },
    },
    handler: async (args, config) => {
      const jobId = args.jobId as string;
      const fullName = args.name as string;
      const phoneNumber = args.phoneNumber as string | undefined;
      const email = args.email as string | undefined;
      const status = (args.status as string | undefined) ?? 'SCREENING';
      const source = args.source as string | undefined;
      const remarks = args.remarks as string | undefined;

      const { firstName, lastName } = parseName(fullName);

      // Step 1: Create person record
      const personInput: Record<string, unknown> = {
        name: { firstName, lastName },
      };
      if (phoneNumber) {
        personInput.phones = {
          primaryPhoneNumber: phoneNumber,
          primaryPhoneCountryCode: '+91',
          additionalPhones: null,
        };
      }
      if (email) {
        personInput.emails = { primaryEmail: email, additionalEmails: null };
      }

      const personData = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToAddNewPerson,
        { input: personInput },
      );

      const personResult = personData as { createPerson: { id: string } };
      const peopleId = personResult?.createPerson?.id;

      if (!peopleId) {
        throw new Error('Failed to create person record');
      }

      // Step 2: Create candidate linked to person and job
      const candidateInput: Record<string, unknown> = {
        name: fullName,
        jobsId: jobId,
        status,
        peopleId,
      };
      if (source) candidateInput.source = source;
      if (remarks) candidateInput.remarks = remarks;

      const candidateData = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToAddNewCandidate,
        { input: candidateInput },
      );

      const candidateResult = candidateData as {
        createCandidate: { id: string; name: string; status: string };
      };

      return {
        success: true,
        candidate: candidateResult?.createCandidate,
        peopleId,
        message: `Successfully created candidate "${fullName}" linked to job ${jobId}`,
      };
    },
  },

  {
    definition: {
      name: 'update_candidate_status',
      description:
        'Update the recruitment pipeline status of a candidate. Valid statuses: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: {
            type: 'string',
            description: 'The candidate ID to update',
          },
          status: {
            type: 'string',
            description:
              'New status value. One of: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION',
          },
        },
        required: ['candidateId', 'status'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const status = args.status as string;

      const result = await callCandidateSourcingRestAPI(
        config.baseUrl,
        config.apiToken,
        'update-candidate-status',
        { candidate_id: candidateId, candidate_status: status },
      );

      return result;
    },
  },

  {
    definition: {
      name: 'update_candidate_phone',
      description:
        "Update the phone number for a candidate. Finds the associated person record and updates it. Use find_candidate first to get the candidate ID if you don't have it.",
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: {
            type: 'string',
            description: 'The candidate ID whose phone number to update',
          },
          phoneNumber: {
            type: 'string',
            description: 'New phone number with country code (e.g. "+919876543210")',
          },
          countryCode: {
            type: 'string',
            description: 'Country code (default: "+91")',
          },
        },
        required: ['candidateId', 'phoneNumber'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const phoneNumber = args.phoneNumber as string;
      const countryCode = (args.countryCode as string | undefined) ?? '+91';

      // Step 1: Get the candidate's peopleId
      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFetchAllCandidateData,
        { filter: { id: { eq: candidateId } }, limit: 1 },
      );

      const candidates = extractCandidates(data);
      if (candidates.length === 0) {
        throw new Error(`No candidate found with ID: ${candidateId}`);
      }

      const peopleId = candidates[0].peopleId;
      if (!peopleId) {
        throw new Error(`Candidate ${candidateId} has no associated person record`);
      }

      // Step 2: Update the person's phone number
      const personData = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        mutationToUpdateOnePerson,
        {
          idToUpdate: peopleId,
          input: {
            phones: {
              primaryPhoneNumber: phoneNumber,
              primaryPhoneCountryCode: countryCode,
              additionalPhones: null,
            },
          },
        },
      );

      const result = personData as { updatePerson: { id: string; city?: string } };
      return {
        success: true,
        personId: peopleId,
        updatedPerson: result?.updatePerson,
        message: `Phone number updated to ${phoneNumber} for candidate ${candidateId}`,
      };
    },
  },

  {
    definition: {
      name: 'update_candidate_salary',
      description:
        'Update the salary or salary expectation for a candidate using custom field values. Use get_candidate_fields_for_job first to see available field names for the job.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: {
            type: 'string',
            description: 'The candidate ID to update',
          },
          fieldName: {
            type: 'string',
            description:
              'The custom field name (e.g. "currentSalary", "expectedSalary", "ctc")',
          },
          value: {
            type: 'string',
            description: 'The new value for the field',
          },
        },
        required: ['candidateId', 'fieldName', 'value'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const fieldName = args.fieldName as string;
      const value = args.value as string;

      const result = await callCandidateSourcingRestAPI(
        config.baseUrl,
        config.apiToken,
        'update-candidate-field-value',
        { candidateId, fieldName, value },
      );

      return result;
    },
  },

  {
    definition: {
      name: 'update_candidate_remarks',
      description: 'Update the remarks/notes field on a candidate record.',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: {
            type: 'string',
            description: 'The candidate ID to update',
          },
          remarks: {
            type: 'string',
            description: 'New remarks or notes for the candidate',
          },
        },
        required: ['candidateId', 'remarks'],
      },
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const remarks = args.remarks as string;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphQltoUpdateOneCandidate,
        { idToUpdate: candidateId, input: { remarks } },
      );

      return {
        success: true,
        result: (data as { updateCandidate: unknown })?.updateCandidate,
        message: `Remarks updated for candidate ${candidateId}`,
      };
    },
  },

  {
    definition: {
      name: 'upload_profiles',
      description:
        'Upload candidate profiles to a job (e.g. from Naukri, LinkedIn search, or JSON). Pass candidates array, jobId, jobName, and data_source. Progress is reported via SSE; table updates when processing completes.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID to attach candidates to' },
          jobName: { type: 'string', description: 'Job name' },
          data_source: { type: 'string', description: 'Source e.g. profile_data_naukri, linkedin_search, linkedin_premium' },
          candidates: {
            type: 'array',
            description: 'Array of candidate profile objects (structure depends on data_source)',
          },
          recruiterId: { type: 'string', description: 'Recruiter workspace member ID (optional)' },
          json_data: { type: 'object', description: 'Alternative: raw JSON data with users/candidates' },
        },
        required: ['jobId', 'jobName'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callCandidateSourcingRestAPI(config.baseUrl, config.apiToken, 'upload-profiles', body);
    },
  },

  {
    definition: {
      name: 'post_candidates',
      description:
        'Post a batch of candidate profiles for processing and saving to a job. Use after fetching from a source; processing is queued and table updates when done.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job ID' },
          job_name: { type: 'string', description: 'Job name' },
          data: {
            type: 'array',
            description: 'Array of candidate profile objects (UserProfile shape)',
          },
          data_source: { type: 'string', description: 'Source identifier (optional)' },
          recruiterId: { type: 'string', description: 'Recruiter workspace member ID (optional)' },
          timestamp: { type: 'string', description: 'ISO timestamp (optional)' },
        },
        required: ['job_id', 'job_name', 'data'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callCandidateSourcingRestAPI(config.baseUrl, config.apiToken, 'post-candidates', body);
    },
  },

  {
    definition: {
      name: 'refresh_table_data',
      description: 'Request a refresh of table data for the recruiter. Kept for backward compatibility; other mechanisms may handle sync.',
      inputSchema: {
        type: 'object',
        properties: {
          recruiterId: { type: 'string', description: 'Recruiter workspace member ID (optional)' },
        },
      },
    },
    handler: async (args, config) => {
      const body = (args?.recruiterId != null ? { recruiterId: args.recruiterId } : {}) as Record<string, unknown>;
      return callCandidateSourcingRestAPI(config.baseUrl, config.apiToken, 'refresh-table-data', body);
    },
  },

  {
    definition: {
      name: 'process_ai_filters',
      description:
        'Queue AI filter processing for candidates in a job. Pass jobId and aiFilters (or enrichments). Selected record IDs and object metadata are optional.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
          aiFilters: {
            type: 'array',
            description: 'Array of AI filter configs (or use enrichments)',
          },
          enrichments: {
            type: 'array',
            description: 'Alternative to aiFilters',
          },
          selectedRecordIds: { type: 'array', description: 'Candidate/record IDs to apply filters to (optional)' },
          objectNameSingular: { type: 'string', description: 'Object name (optional)' },
          availableSortDefinitions: { type: 'array', description: 'Sort definitions (optional)' },
          availableFilterDefinitions: { type: 'array', description: 'Filter definitions (optional)' },
          objectRecordId: { type: 'string', description: 'Object record ID (optional)' },
        },
        required: ['jobId'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callCandidateSourcingRestAPI(config.baseUrl, config.apiToken, 'process-ai-filters', body);
    },
  },

  {
    definition: {
      name: 'process_filter_description',
      description:
        'Convert a natural-language filter description into a filter config (selected metadata fields and conditions). Use before applying filters to table data.',
      inputSchema: {
        type: 'object',
        properties: {
          filterDescription: { type: 'string', description: 'Natural language filter (e.g. salary > 40L, reporting to GM)' },
          candidateFields: { type: 'array', description: 'Available candidate fields for validation (optional)' },
        },
        required: ['filterDescription'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callCandidateSourcingRestAPI(config.baseUrl, config.apiToken, 'process-filter-description', body);
    },
  },
];

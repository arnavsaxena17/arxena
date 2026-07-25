import type { CandidateNode, Candidates, People } from 'twenty-shared/arx';
import {
  graphqlQueryToFindManyPeople,
  graphqlToAddNewCandidate,
  graphqlToAddNewPerson,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  mutationToUpdateOnePerson,
} from 'twenty-shared/graphql';

import { executeGraphQL } from '../api/graphql-client';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
import {
  CREATE_CANDIDATE_INPUT_DESCRIPTOR,
  FIND_CANDIDATE_INPUT_DESCRIPTOR,
  GET_CANDIDATE_DETAILS_INPUT_DESCRIPTOR,
  GET_CANDIDATES_BY_JOB_ID_INPUT_DESCRIPTOR,
  LIST_CANDIDATES_FOR_JOB_INPUT_DESCRIPTOR,
  POST_CANDIDATES_INPUT_DESCRIPTOR,
  PROCESS_AI_FILTERS_INPUT_DESCRIPTOR,
  PROCESS_FILTER_DESCRIPTION_INPUT_DESCRIPTOR,
  REFRESH_TABLE_DATA_INPUT_DESCRIPTOR,
  UPDATE_CANDIDATE_PHONE_INPUT_DESCRIPTOR,
  UPDATE_CANDIDATE_REMARKS_INPUT_DESCRIPTOR,
  UPDATE_CANDIDATE_SALARY_INPUT_DESCRIPTOR,
  UPDATE_CANDIDATE_STATUS_INPUT_DESCRIPTOR,
  UPLOAD_PROFILES_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

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
      name: 'list_candidates_for_project',
      description:
        'List candidates for a specific job. Optionally filter by status. Returns names, contact info, and current status of each candidate.',
      inputSchema: descriptorToInputSchema(LIST_CANDIDATES_FOR_JOB_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string;
      const status = args.status as string | undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;

      const filter: Record<string, unknown> = { projectsId: { eq: projectId } };
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
      name: 'find_candidate_in_arxena_internal',
      description:
        'Search for a candidate in the Arxena Internal Database by name, email, or phone number across all jobs. Returns matching candidates with their job associations. At least one search parameter is required. Use this before updating a candidate.',
      inputSchema: descriptorToInputSchema(FIND_CANDIDATE_INPUT_DESCRIPTOR),
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
              projectId: ce.node.projects?.id,
              jobName: ce.node.projects?.name,
            })) ?? [],
        })),
      };
    },
  },

  {
    definition: {
      name: 'get_candidate_details_in_arxena_internal',
      description: 'Get full details for a specific candidate by their candidate ID.',
      inputSchema: descriptorToInputSchema(GET_CANDIDATE_DETAILS_INPUT_DESCRIPTOR),
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
        projectId: c.projectsId,
        jobName: c.projects?.name,
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
        'Create a new candidate in the Arxena Internal Database and link them to a job. Uses the post-candidates flow which creates both the person record and candidate node. Use list_active_projects first to get the correct projectId.',
      inputSchema: descriptorToInputSchema(CREATE_CANDIDATE_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const projectId = args.projectId as string;
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
        projectsId: projectId,
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
        message: `Successfully created candidate "${fullName}" linked to job ${projectId}`,
      };
    },
  },

  {
    definition: {
      name: 'update_candidate_status',
      description:
        'Update the recruitment pipeline status of a candidate. Valid statuses: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION.',
      inputSchema: descriptorToInputSchema(UPDATE_CANDIDATE_STATUS_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const status = args.status as string;

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
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
      inputSchema: descriptorToInputSchema(UPDATE_CANDIDATE_PHONE_INPUT_DESCRIPTOR),
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
        'Update the salary or salary expectation for a candidate using custom field values. Use get_candidate_fields_for_project first to see available field names for the job.',
      inputSchema: descriptorToInputSchema(UPDATE_CANDIDATE_SALARY_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const candidateId = args.candidateId as string;
      const fieldName = args.fieldName as string;
      const value = args.value as string;

      const result = await callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
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
      inputSchema: descriptorToInputSchema(UPDATE_CANDIDATE_REMARKS_INPUT_DESCRIPTOR),
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
      name: 'get_candidates_by_project_id',
      description: 'Get candidates linked to a job.',
      inputSchema: descriptorToInputSchema(GET_CANDIDATES_BY_JOB_ID_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-sourcing',
        'get-candidates-by-project-id',
        body,
      );
    },
  },

  {
    definition: {
      name: 'upload_profiles',
      description:
        'Upload candidate profiles to a project(e.g. from Naukri, LinkedIn search, or JSON). Pass candidates array, projectId, jobName, and data_source. Progress is reported via SSE; table updates when processing completes.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(UPLOAD_PROFILES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            candidates: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of candidate profile objects (structure depends on data_source)',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'upload-profiles', body);
    },
  },

  {
    definition: {
      name: 'post_candidates',
      description:
        'Upload a batch of candidate profiles for processing and saving to a job. Use after fetching from a source; processing is queued and table updates when done.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(POST_CANDIDATES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            data: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of candidate profile objects (UserProfile shape)',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'post-candidates', body);
    },
  },

  {
    definition: {
      name: 'refresh_table_data',
      description: 'Request a refresh of table data for the recruiter. Kept for backward compatibility; other mechanisms may handle sync.',
      inputSchema: descriptorToInputSchema(REFRESH_TABLE_DATA_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = (args?.recruiterId != null ? { recruiterId: args.recruiterId } : {}) as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'refresh-table-data', body);
    },
  },

  {
    definition: {
      name: 'process_ai_filters',
      description:
        'Queue AI filter processing for candidates in a job. Pass projectId and aiFilters (or enrichments). Selected record IDs and object metadata are optional.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(PROCESS_AI_FILTERS_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            aiFilters: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of AI filter configs (or use enrichments)',
            },
            enrichments: {
              type: 'array',
              items: { type: 'object' },
              description: 'Alternative to aiFilters',
            },
            selectedRecordIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Candidate/record IDs to apply filters to (optional)',
            },
            availableSortDefinitions: {
              type: 'array',
              items: { type: 'object' },
              description: 'Sort definitions (optional)',
            },
            availableFilterDefinitions: {
              type: 'array',
              items: { type: 'object' },
              description: 'Filter definitions (optional)',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'process-ai-filters', body);
    },
  },

  {
    definition: {
      name: 'process_filter_description',
      description:
        'Convert a natural-language filter description into a filter config (selected metadata fields and conditions). Use before applying filters to table data.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(PROCESS_FILTER_DESCRIPTION_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            otherFieldKeys: {
              type: 'array',
              items: { type: 'object' },
              description: 'Available candidate otherFields keys for validation (optional)',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(config.baseUrl, config.apiToken, 'candidate-sourcing', 'process-filter-description', body);
    },
  },
];

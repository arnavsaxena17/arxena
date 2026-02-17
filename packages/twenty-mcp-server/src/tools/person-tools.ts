import type {
  CandidateFieldValueNode,
  CandidateFieldValues,
  EnrichContactFromDataInput,
  FindPersonInput,
  GetCandidateFieldsForJobInput,
  GetCandidateFieldValuesInput,
  People,
  PersonNode,
  UpdateContactInfoInput,
  UpdatedPersonSchema
} from 'twenty-shared';
import {
  ENRICH_CONTACT_FROM_DATA_INPUT_DESCRIPTOR,
  FIND_PERSON_INPUT_DESCRIPTOR,
  GET_CANDIDATE_FIELD_VALUES_INPUT_DESCRIPTOR,
  GET_CANDIDATE_FIELDS_FOR_JOB_INPUT_DESCRIPTOR,
  graphqlQueryToFindManyPeople,
  graphqlToFindManyCandidateFieldValues,
  mutationToUpdateOnePerson,
  UPDATE_CONTACT_INFO_INPUT_DESCRIPTOR,
} from 'twenty-shared';

import { executeGraphQL } from '../api/graphql-client';
import { callCandidateSourcingRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

export const personTools: McpTool[] = [
  {
    definition: {
      name: 'find_person',
      description:
        'Find a person record by name, email, or phone number. Returns their contact info and linked candidate applications. At least one search parameter required.',
      inputSchema: descriptorToInputSchema(FIND_PERSON_INPUT_DESCRIPTOR),
    },
    handler: async (args, config): Promise<{count: number, people: PersonNode[]}> => {
      const { name, email, phone, limit = 20 } = args as FindPersonInput;

      if (!name && !email && !phone) {
        throw new Error('At least one of name, email, or phone must be provided.');
      }

      const orConditions: unknown[] = [];

      if (name) {
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
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

      const graphqlResult = data as { people: People };
      const people = graphqlResult?.people?.edges?.map((e) => e.node) ?? [];

      const result =  {
        count: people.length,
        people: people ?? [] as PersonNode[],   
      };
      return result;
    },
  },

  {
    definition: {
      name: 'update_contact_info',
      description:
        "Update contact information (phone, email, city, name) for a person record by their person ID. Use find_person or find_candidate first to get the person ID if you don't have it.",
      inputSchema: descriptorToInputSchema(UPDATE_CONTACT_INFO_INPUT_DESCRIPTOR),
    },
    handler: async (
      args,
      config,
    ): Promise<{
      success: boolean;
      updatedPerson: UpdatedPersonSchema;
      message: string;
    }> => {
      const { personId, phoneNumber, email, city, firstName, lastName, jobTitle, salary } =
        args as UpdateContactInfoInput;

      const input: Record<string, unknown> = {};

      if (phoneNumber !== undefined) {
        input.phones = {
          primaryPhoneNumber: phoneNumber,
          primaryPhoneCountryCode: '+91',
          additionalPhones: null,
        };
      }
      if (email !== undefined) {
        input.emails = { primaryEmail: email, additionalEmails: null };
      }
      if (city !== undefined) {
        input.city = city;
      }
      if (firstName !== undefined || lastName !== undefined) {
        input.name = { firstName: firstName ?? '', lastName: lastName ?? '' };
      }
      if (jobTitle !== undefined) {
        input.jobTitle = jobTitle;
      }
      if (salary !== undefined) {
        input.salary = salary;
      }

      if (Object.keys(input).length === 0) {
        throw new Error(
          'At least one field to update must be provided (phoneNumber, email, city, firstName, lastName, jobTitle, salary).',
        );
      }

      const data = await executeGraphQL<{ updatePerson: UpdatedPersonSchema }>(
        config.baseUrl,
        config.apiToken,
        mutationToUpdateOnePerson,
        { idToUpdate: personId, input },
      );


      return {
        success: true,
        updatedPerson: data?.updatePerson ?? {},
        message: `Contact info updated for person ${personId}`,
      };
    },
  },

  {
    definition: {
      name: 'get_candidate_fields_for_job',
      description:
        'Get the list of custom fields configured for candidates in a specific job. Use this to see what fields are available before calling update_candidate_salary or update_candidate_field_value.',
      inputSchema: descriptorToInputSchema(GET_CANDIDATE_FIELDS_FOR_JOB_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { jobId } = args as GetCandidateFieldsForJobInput;

      const result = await callCandidateSourcingRestAPI(
        config.baseUrl,
        config.apiToken,
        'get-candidate-fields-by-job',
        { jobId },
      );

      return result;
    },
  },

  {
    definition: {
      name: 'get_candidate_field_values',
      description:
        'Get the current values of all custom fields for a specific candidate (e.g. current salary, expected salary, notice period, skills score).',
      inputSchema: descriptorToInputSchema(GET_CANDIDATE_FIELD_VALUES_INPUT_DESCRIPTOR),
    },
    handler: async (args, config): Promise<{count: number, fieldValues: CandidateFieldValueNode[]}> => {
      const { candidateId } = args as GetCandidateFieldValuesInput;

      const data = await executeGraphQL(
        config.baseUrl,
        config.apiToken,
        graphqlToFindManyCandidateFieldValues,
        { filter: { candidateId: { eq: candidateId } }, limit: 50 },
      );

      const result = data as { candidateFieldValues: CandidateFieldValues };
      const fieldValues = result?.candidateFieldValues?.edges?.map((e) => e.node) ?? [];

      return {
        count: fieldValues.length,
        fieldValues: fieldValues ?? [],
      };
    },
  },

  {
    definition: {
      name: 'enrich_contact_from_data',
      description:
        'Update a contact with enriched data from an external source (LinkedIn, Naukri, etc.). Pass the enrichment data object to update contact info, work history, and other details.',
      inputSchema: descriptorToInputSchema(ENRICH_CONTACT_FROM_DATA_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { contactData } = args as EnrichContactFromDataInput;

      const result = await callCandidateSourcingRestAPI(
        config.baseUrl,
        config.apiToken,
        'update-contact-from-enrichment',
        contactData,
      );

      return result;
    },
  },
];

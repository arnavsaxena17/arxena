import { v5 as uuidv5 } from 'uuid';

import { type WorkflowActionTriggerSettings } from 'twenty-shared/application';

import {
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import {
  GTM_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  GTM_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  GTM_SEARCH_JOBS_SAMPLE_OUTPUT,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-sample-output.const';
import { type PrefilledWorkflowCodeStepLogicFunctionDefinition } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';

const GTM_LOGIC_FUNCTION_ID_NAMESPACE = '7c3e1a90-4b2d-4f11-9c6a-2e8f0d1b5a44';

const NATIVE_HANDLER = `export const main = async (params) => {
  return params ?? {};
};`;

export type PrefilledGtmLogicFunctionDefinition =
  PrefilledWorkflowCodeStepLogicFunctionDefinition & {
    workflowActionTriggerSettings: WorkflowActionTriggerSettings;
  };

export const getGtmOutreachLogicFunctionIds = (workspaceId: string) => ({
  searchPeopleForCompanyId: uuidv5(
    `${workspaceId}:search-people-for-company`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchLinkedinProfileId: uuidv5(
    `${workspaceId}:fetch-linkedin-profile`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchPeopleId: uuidv5(
    `${workspaceId}:search-people`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchCompaniesId: uuidv5(
    `${workspaceId}:search-companies`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchJobsId: uuidv5(
    `${workspaceId}:search-jobs`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
});

export const getGtmOutreachLogicFunctionDefinitions = (
  workspaceId: string,
): PrefilledGtmLogicFunctionDefinition[] => {
  const ids = getGtmOutreachLogicFunctionIds(workspaceId);

  return [
    {
      id: ids.searchPeopleForCompanyId,
      name: GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
      description:
        'Search ICP people for a company via People API and enroll them as Person + Candidate (QUEUED). Pass companyId (required) and optional projectId/limit. Loads Project icpSpec (std function/grade) itself — do not pass icpSpec.',
      sourceHandlerCode: NATIVE_HANDLER,
      workflowActionTriggerSettings: {
        label: 'Search people for company',
        icon: 'IconUsers',
        inputSchema: [
          {
            type: 'object',
            properties: {
              companyId: { type: 'string', label: 'Company ID' },
              projectId: { type: 'string', label: 'Project ID' },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              enrolledCount: { type: 'number', label: 'Enrolled count' },
              projectId: { type: 'string', label: 'Project ID' },
              error: { type: 'string', label: 'Error' },
              people: {
                type: 'array',
                label: 'People',
                items: {
                  type: 'object',
                  properties: {
                    linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                    linkedinProfileId: {
                      type: 'string',
                      label: 'LinkedIn profile ID',
                    },
                    name: { type: 'string', label: 'Name' },
                    title: { type: 'string', label: 'Title' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchLinkedinProfileId,
      name: GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      description:
        'Fetch a LinkedIn profile via Unipile for AI_AGENT drafting. Pass linkedinUrl or linkedinProfileId plus workspaceMemberId.',
      sourceHandlerCode: NATIVE_HANDLER,
      workflowActionTriggerSettings: {
        label: 'Fetch LinkedIn profile',
        icon: 'IconBrandLinkedin',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: { type: 'string', label: 'Workspace member ID' },
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: { type: 'string', label: 'LinkedIn profile ID' },
              candidateId: { type: 'string', label: 'Candidate ID' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              headline: { type: 'string', label: 'Headline' },
              about: { type: 'string', label: 'About' },
              experience: { type: 'array', label: 'Experience' },
              snapshot: { type: 'string', label: 'Snapshot' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: GTM_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchPeopleId,
      name: GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
      description:
        'Search people via People API (search only, does not enroll). Pass naturalLanguage and optional company/location/dataSource/limit. Default dataSource is auto.',
      sourceHandlerCode: NATIVE_HANDLER,
      workflowActionTriggerSettings: {
        label: 'Search people',
        icon: 'IconUsers',
        inputSchema: [
          {
            type: 'object',
            properties: {
              naturalLanguage: { type: 'string', label: 'Natural language' },
              companyName: { type: 'string', label: 'Company name' },
              website: { type: 'string', label: 'Website' },
              companyId: { type: 'string', label: 'Company ID' },
              jobTitle: { type: 'string', label: 'Job title' },
              location: { type: 'string', label: 'Location' },
              country: { type: 'string', label: 'Country' },
              dataSource: { type: 'string', label: 'Data source' },
              accountId: { type: 'string', label: 'Account ID' },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              dataSource: { type: 'string', label: 'Data source' },
              error: { type: 'string', label: 'Error' },
              people: {
                type: 'array',
                label: 'People',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', label: 'Name' },
                    title: { type: 'string', label: 'Title' },
                    linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                    companyName: { type: 'string', label: 'Company name' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchCompaniesId,
      name: GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
      description:
        'Search companies via Company API. dataSource auto prefers Unipile Sales Navigator, then Recruiter/classic, Harvest, then index.',
      sourceHandlerCode: NATIVE_HANDLER,
      workflowActionTriggerSettings: {
        label: 'Search companies',
        icon: 'IconBuildingSkyscraper',
        inputSchema: [
          {
            type: 'object',
            properties: {
              query: { type: 'string', label: 'Query' },
              keywords: { type: 'string', label: 'Keywords' },
              companyName: { type: 'string', label: 'Company name' },
              website: { type: 'string', label: 'Website' },
              industry: { type: 'string', label: 'Industry' },
              location: { type: 'string', label: 'Location' },
              dataSource: { type: 'string', label: 'Data source' },
              accountId: { type: 'string', label: 'Account ID' },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              dataSource: { type: 'string', label: 'Data source' },
              error: { type: 'string', label: 'Error' },
              companies: {
                type: 'array',
                label: 'Companies',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', label: 'ID' },
                    name: { type: 'string', label: 'Name' },
                    website: { type: 'string', label: 'Website' },
                    linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                    industry: { type: 'string', label: 'Industry' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_SEARCH_COMPANIES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchJobsId,
      name: GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
      description:
        'Search jobs via Jobs API. dataSource auto uses Unipile Sales Navigator account resolution then Harvest.',
      sourceHandlerCode: NATIVE_HANDLER,
      workflowActionTriggerSettings: {
        label: 'Search jobs',
        icon: 'IconBriefcase',
        inputSchema: [
          {
            type: 'object',
            properties: {
              keywords: { type: 'string', label: 'Keywords' },
              location: { type: 'string', label: 'Location' },
              company: { type: 'string', label: 'Company' },
              datePosted: { type: 'number', label: 'Date posted' },
              dataSource: { type: 'string', label: 'Data source' },
              accountId: { type: 'string', label: 'Account ID' },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              dataSource: { type: 'string', label: 'Data source' },
              error: { type: 'string', label: 'Error' },
              jobs: {
                type: 'array',
                label: 'Jobs',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', label: 'ID' },
                    title: { type: 'string', label: 'Title' },
                    location: { type: 'string', label: 'Location' },
                    url: { type: 'string', label: 'URL' },
                    companyName: { type: 'string', label: 'Company name' },
                    postedAt: { type: 'string', label: 'Posted at' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_SEARCH_JOBS_SAMPLE_OUTPUT,
      },
    },
  ];
};

import { v5 as uuidv5 } from 'uuid';

import { type WorkflowActionTriggerSettings } from 'twenty-shared/application';

import { getGtmNativeLogicFunctionHandler } from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-native-handlers.const';
import {
  GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
  GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import {
  GTM_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
  GTM_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
  GTM_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  GTM_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  GTM_SEARCH_JOBS_SAMPLE_OUTPUT,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT,
  GTM_SEARCH_POSTS_SAMPLE_OUTPUT,
  GTM_UPLOAD_PROFILES_SAMPLE_OUTPUT,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-sample-output.const';
import { type PrefilledWorkflowCodeStepLogicFunctionDefinition } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';

const GTM_LOGIC_FUNCTION_ID_NAMESPACE = '7c3e1a90-4b2d-4f11-9c6a-2e8f0d1b5a44';

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
  searchPostsId: uuidv5(
    `${workspaceId}:search-posts`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchLinkedinMessagesId: uuidv5(
    `${workspaceId}:fetch-linkedin-messages`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchCompanyDetailsId: uuidv5(
    `${workspaceId}:fetch-company-details`,
    GTM_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  uploadProfilesId: uuidv5(
    `${workspaceId}:upload-profiles`,
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
        'Search ICP people for a company via People API and return transformer-standardized hits (no CRM enroll). Pass companyId (required) and optional projectId/limit. Loads Project icpSpec itself — do not pass icpSpec.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
      ),
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
              total: { type: 'number', label: 'Total' },
              dataSource: { type: 'string', label: 'Data source' },
              projectId: { type: 'string', label: 'Project ID' },
              error: { type: 'string', label: 'Error' },
              people: {
                type: 'array',
                label: 'People',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', label: 'Name' },
                    firstName: { type: 'string', label: 'First name' },
                    lastName: { type: 'string', label: 'Last name' },
                    title: { type: 'string', label: 'Title' },
                    headline: { type: 'string', label: 'Headline' },
                    company: { type: 'string', label: 'Company' },
                    location: { type: 'string', label: 'Location' },
                    linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                    linkedinProfileId: {
                      type: 'string',
                      label: 'LinkedIn profile ID',
                    },
                    peopleId: { type: 'string', label: 'People ID' },
                    profilePictureUrl: {
                      type: 'string',
                      label: 'Profile picture URL',
                    },
                    source: { type: 'string', label: 'Source' },
                    stdFunction: { type: 'string', label: 'Std function' },
                    stdFunctionRoot: {
                      type: 'string',
                      label: 'Std function root',
                    },
                    stdGrade: { type: 'string', label: 'Std grade' },
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
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      ),
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
              firstName: { type: 'string', label: 'First name' },
              lastName: { type: 'string', label: 'Last name' },
              headline: { type: 'string', label: 'Headline' },
              about: { type: 'string', label: 'About' },
              location: { type: 'string', label: 'Location' },
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              profilePictureUrl: {
                type: 'string',
                label: 'Profile picture URL',
              },
              experience: {
                type: 'array',
                label: 'Experience',
                items: {
                  type: 'object',
                  properties: {
                    company: { type: 'string', label: 'Company' },
                    position: { type: 'string', label: 'Position' },
                    location: { type: 'string', label: 'Location' },
                    description: { type: 'string', label: 'Description' },
                    start: { type: 'string', label: 'Start' },
                    end: { type: 'string', label: 'End' },
                  },
                },
              },
              skills: {
                type: 'array',
                label: 'Skills',
                items: { type: 'string', label: 'Skill' },
              },
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
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
      ),
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
                    firstName: { type: 'string', label: 'First name' },
                    lastName: { type: 'string', label: 'Last name' },
                    title: { type: 'string', label: 'Title' },
                    headline: { type: 'string', label: 'Headline' },
                    companyName: { type: 'string', label: 'Company name' },
                    location: { type: 'string', label: 'Location' },
                    linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                    linkedinProfileId: {
                      type: 'string',
                      label: 'LinkedIn profile ID',
                    },
                    peopleId: { type: 'string', label: 'People ID' },
                    profilePictureUrl: {
                      type: 'string',
                      label: 'Profile picture URL',
                    },
                    source: { type: 'string', label: 'Source' },
                    stdFunction: { type: 'string', label: 'Std function' },
                    stdFunctionRoot: {
                      type: 'string',
                      label: 'Std function root',
                    },
                    stdGrade: { type: 'string', label: 'Std grade' },
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
        'Search companies via Company API. Pass url for a Sales Nav account list or LinkedIn search URL. dataSource auto prefers Unipile Sales Navigator, then Recruiter/classic, Harvest, then index.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
      ),
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
              url: {
                type: 'string',
                label: 'LinkedIn URL',
              },
              useV2: {
                type: 'boolean',
                label: 'Use Unipile v2 account list',
              },
              sortBy: { type: 'string', label: 'Sort by' },
              sortOrder: { type: 'string', label: 'Sort order' },
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
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
      ),
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
    {
      id: ids.searchPostsId,
      name: GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
      description:
        'Search LinkedIn posts via Posts API. dataSource auto uses Unipile Sales Navigator account resolution then Harvest.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Search posts',
        icon: 'IconNews',
        inputSchema: [
          {
            type: 'object',
            properties: {
              keywords: { type: 'string', label: 'Keywords' },
              sortBy: { type: 'string', label: 'Sort by' },
              datePosted: { type: 'string', label: 'Date posted' },
              contentType: { type: 'string', label: 'Content type' },
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
              posts: {
                type: 'array',
                label: 'Posts',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', label: 'ID' },
                    socialId: { type: 'string', label: 'Social ID' },
                    shareUrl: { type: 'string', label: 'Share URL' },
                    title: { type: 'string', label: 'Title' },
                    text: { type: 'string', label: 'Text' },
                    postedAt: { type: 'string', label: 'Posted at' },
                    authorName: { type: 'string', label: 'Author name' },
                    authorUrl: { type: 'string', label: 'Author URL' },
                    reactionCount: { type: 'number', label: 'Reaction count' },
                    commentCount: { type: 'number', label: 'Comment count' },
                    isRepost: { type: 'boolean', label: 'Is repost' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_SEARCH_POSTS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchLinkedinMessagesId,
      name: GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
      description:
        'Fetch LinkedIn chat messages for a person via Unipile ChatAttendees. Pass linkedinUrl or linkedinProfileId plus optional workspaceMemberId/candidateId/limit.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch LinkedIn messages',
        icon: 'IconBrandLinkedin',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: {
                type: 'string',
                label: 'Workspace member ID',
              },
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              candidateId: { type: 'string', label: 'Candidate ID' },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              chatId: { type: 'string', label: 'Chat ID' },
              attendeeId: { type: 'string', label: 'Attendee ID' },
              total: { type: 'number', label: 'Total' },
              error: { type: 'string', label: 'Error' },
              messages: {
                type: 'array',
                label: 'Messages',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', label: 'ID' },
                    text: { type: 'string', label: 'Text' },
                    timestamp: { type: 'string', label: 'Timestamp' },
                    senderId: { type: 'string', label: 'Sender ID' },
                    isSender: { type: 'boolean', label: 'Is sender' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchCompanyDetailsId,
      name: GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
      description:
        'Fetch a single company by LinkedIn URL, domain, or name. LinkedIn URL uses Unipile company profile; otherwise searches Company API and enriches when possible.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch company details',
        icon: 'IconBuildingSkyscraper',
        inputSchema: [
          {
            type: 'object',
            properties: {
              companyName: { type: 'string', label: 'Company name' },
              website: { type: 'string', label: 'Website / domain' },
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              workspaceMemberId: {
                type: 'string',
                label: 'Workspace member ID',
              },
              accountId: { type: 'string', label: 'Account ID' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              dataSource: { type: 'string', label: 'Data source' },
              error: { type: 'string', label: 'Error' },
              company: {
                type: 'object',
                label: 'Company',
                properties: {
                  id: { type: 'string', label: 'ID' },
                  name: { type: 'string', label: 'Name' },
                  website: { type: 'string', label: 'Website' },
                  linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
                  industry: { type: 'string', label: 'Industry' },
                  description: { type: 'string', label: 'Description' },
                  tagline: { type: 'string', label: 'Tagline' },
                  employeeCount: { type: 'number', label: 'Employee count' },
                  followersCount: { type: 'number', label: 'Followers count' },
                  publicIdentifier: {
                    type: 'string',
                    label: 'Public identifier',
                  },
                },
              },
            },
          },
        ],
        sampleOutput: GTM_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.uploadProfilesId,
      name: GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
      description:
        'Enroll people as Person + Candidate on a Project via the upload-profiles pipeline (GTM projects get QUEUED + linkedinProfileId). Pass projectId and people[] from search-people-for-company. Hits-only search stays separate.',
      sourceHandlerCode: getGtmNativeLogicFunctionHandler(
        GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Upload profiles',
        icon: 'IconUsersPlus',
        inputSchema: [
          {
            type: 'object',
            properties: {
              projectId: { type: 'string', label: 'Project ID' },
              people: { type: 'array', label: 'People' },
              candidates: { type: 'array', label: 'Candidates' },
              recruiterId: { type: 'string', label: 'Recruiter ID' },
              workspaceMemberId: {
                type: 'string',
                label: 'Workspace member ID',
              },
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              queued: { type: 'number', label: 'Queued' },
              projectId: { type: 'string', label: 'Project ID' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: GTM_UPLOAD_PROFILES_SAMPLE_OUTPUT,
      },
    },
  ];
};

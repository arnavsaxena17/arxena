import { v5 as uuidv5 } from 'uuid';

import { type WorkflowActionTriggerSettings } from 'twenty-shared/application';

import { getOutreachNativeLogicFunctionHandler } from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-native-handlers.const';
import {
  OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
  OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
  OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME,
  OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME,
  OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
  OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
  OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-names.const';
import {
  OUTREACH_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
  OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  OUTREACH_VISIT_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  OUTREACH_FETCH_USER_COMMENTS_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_JOBS_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_POSTS_SAMPLE_OUTPUT,
  OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
  OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT,
  OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT,
  OUTREACH_FETCH_EMAIL_SAMPLE_OUTPUT,
  OUTREACH_FETCH_PHONE_SAMPLE_OUTPUT,
  OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
  OUTREACH_DETECT_FAKE_PROFILES_SAMPLE_OUTPUT,
  OUTREACH_FILTER_PROFILES_SAMPLE_OUTPUT,
  OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-sample-output.const';
import { type PrefilledWorkflowCodeStepLogicFunctionDefinition } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';

const OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE =
  '7c3e1a90-4b2d-4f11-9c6a-2e8f0d1b5a44';

const OUTREACH_PROJECT_RECORD_INPUT = {
  type: 'record' as const,
  label: 'Project',
  objectNameSingular: 'project',
};

const OUTREACH_COMPANY_RECORD_INPUT = {
  type: 'record' as const,
  label: 'Company',
  objectNameSingular: 'company',
};

const OUTREACH_CANDIDATE_RECORD_INPUT = {
  type: 'record' as const,
  label: 'Candidate',
  objectNameSingular: 'candidate',
};

const OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT = {
  type: 'record' as const,
  label: 'Workspace member',
  objectNameSingular: 'workspaceMember',
};

const OUTREACH_PERSON_EXPERIENCE_OUTPUT = {
  type: 'array' as const,
  label: 'Employment history',
  items: {
    type: 'object' as const,
    properties: {
      company: { type: 'string' as const, label: 'Company' },
      position: { type: 'string' as const, label: 'Position' },
      location: { type: 'string' as const, label: 'Location' },
      description: { type: 'string' as const, label: 'Description' },
      start: { type: 'string' as const, label: 'Start' },
      end: { type: 'string' as const, label: 'End' },
      isCurrent: { type: 'boolean' as const, label: 'Is current' },
      companyId: { type: 'string' as const, label: 'Company ID' },
    },
  },
};

const OUTREACH_PERSON_EDUCATION_OUTPUT = {
  type: 'array' as const,
  label: 'Education',
  items: {
    type: 'object' as const,
    properties: {
      school: { type: 'string' as const, label: 'School' },
      degree: { type: 'string' as const, label: 'Degree' },
      fieldOfStudy: { type: 'string' as const, label: 'Field of study' },
      start: { type: 'string' as const, label: 'Start' },
      end: { type: 'string' as const, label: 'End' },
    },
  },
};

const OUTREACH_PERSON_CURRENT_POSITIONS_OUTPUT = {
  type: 'array' as const,
  label: 'Current positions',
  items: {
    type: 'object' as const,
    properties: {
      role: { type: 'string' as const, label: 'Role' },
      company: { type: 'string' as const, label: 'Company' },
      company_id: { type: 'string' as const, label: 'Company ID' },
    },
  },
};

export type PrefilledOutreachLogicFunctionDefinition =
  PrefilledWorkflowCodeStepLogicFunctionDefinition & {
    workflowActionTriggerSettings: WorkflowActionTriggerSettings;
  };

export const getOutreachLogicFunctionIds = (workspaceId: string) => ({
  searchPeopleForCompanyId: uuidv5(
    `${workspaceId}:search-people-for-company`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchLinkedinProfileId: uuidv5(
    `${workspaceId}:fetch-linkedin-profile`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  visitLinkedinProfileId: uuidv5(
    `${workspaceId}:visit-linkedin-profile`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchPeopleId: uuidv5(
    `${workspaceId}:search-people`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchCompaniesId: uuidv5(
    `${workspaceId}:search-companies`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchCrunchbaseCompaniesId: uuidv5(
    `${workspaceId}:search-crunchbase-companies`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchJobsId: uuidv5(
    `${workspaceId}:search-jobs`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  searchPostsId: uuidv5(
    `${workspaceId}:search-posts`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchUserCommentsId: uuidv5(
    `${workspaceId}:fetch-user-comments`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchLinkedinMessagesId: uuidv5(
    `${workspaceId}:fetch-linkedin-messages`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchCompanyDetailsId: uuidv5(
    `${workspaceId}:fetch-company-details`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  uploadProfilesId: uuidv5(
    `${workspaceId}:upload-profiles`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  upsertCompaniesId: uuidv5(
    `${workspaceId}:upsert-companies`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  enrichContactId: uuidv5(
    `${workspaceId}:enrich-contact`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchEmailId: uuidv5(
    `${workspaceId}:fetch-email`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  fetchPhoneId: uuidv5(
    `${workspaceId}:fetch-phone`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  getCalendarAvailabilityId: uuidv5(
    `${workspaceId}:get-calendar-availability`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  detectFakeProfilesId: uuidv5(
    `${workspaceId}:detect-fake-profiles`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  filterProfilesId: uuidv5(
    `${workspaceId}:filter-profiles`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
  validateInboundSignalsId: uuidv5(
    `${workspaceId}:validate-inbound-signals`,
    OUTREACH_LOGIC_FUNCTION_ID_NAMESPACE,
  ),
});

export const getOutreachLogicFunctionDefinitions = (
  workspaceId: string,
): PrefilledOutreachLogicFunctionDefinition[] => {
  const ids = getOutreachLogicFunctionIds(workspaceId);

  return [
    {
      id: ids.searchPeopleForCompanyId,
      name: OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
      description:
        'Search ICP people for a company via People API and return transformer-standardized hits (no CRM enroll). Pass companyId (required) and optional projectId/jobTitle/limit. Loads Project icpSpec itself — do not pass icpSpec. Optional jobTitle takes precedence over Project icpSpec targetTitles[0] and is classified into std function/grade for the LinkedIn role query.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Search people for company',
        icon: 'IconUsers',
        inputSchema: [
          {
            type: 'object',
            properties: {
              companyId: OUTREACH_COMPANY_RECORD_INPUT,
              projectId: OUTREACH_PROJECT_RECORD_INPUT,
              jobTitle: { type: 'string', label: 'Job title' },
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
              companyId: { type: 'string', label: 'Company ID' },
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
                    companyName: { type: 'string', label: 'Company name' },
                    companyId: { type: 'string', label: 'Company ID' },
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
                    experience: OUTREACH_PERSON_EXPERIENCE_OUTPUT,
                    education: OUTREACH_PERSON_EDUCATION_OUTPUT,
                    current_positions: OUTREACH_PERSON_CURRENT_POSITIONS_OUTPUT,
                  },
                },
              },
            },
          },
        ],
        sampleOutput: OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchLinkedinProfileId,
      name: OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      description:
        'Fetch a LinkedIn profile via Unipile for AI_AGENT drafting. Pass linkedinUrl or linkedinProfileId plus workspaceMemberId.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch LinkedIn profile',
        icon: 'IconBrandLinkedin',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
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
              connectionsCount: {
                type: 'number',
                label: 'Connections count',
              },
              followersCount: {
                type: 'number',
                label: 'Followers count',
              },
              sharedConnectionsCount: {
                type: 'number',
                label: 'Shared connections count',
              },
              networkDistance: {
                type: 'string',
                label: 'Network distance',
              },
              recruitingActivity: {
                type: 'array',
                label: 'Recruiting activity',
                items: { type: 'object', label: 'Activity event' },
              },
              snapshot: { type: 'string', label: 'Snapshot' },
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
                    location: { type: 'string', label: 'Location' },
                    connectionsCount: {
                      type: 'number',
                      label: 'Connections count',
                    },
                    followersCount: {
                      type: 'number',
                      label: 'Followers count',
                    },
                    sharedConnectionsCount: {
                      type: 'number',
                      label: 'Shared connections count',
                    },
                    networkDistance: {
                      type: 'string',
                      label: 'Network distance',
                    },
                  },
                },
              },
              error: { type: 'string', label: 'Error' },
              text: {
                type: 'string',
                label: 'Formatted text (for AI agent)',
              },
            },
          },
        ],
        sampleOutput: OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.visitLinkedinProfileId,
      name: OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      description:
        'Visit a LinkedIn profile via Unipile so the viewee is notified (notify=true). Pass linkedinUrl or linkedinProfileId plus workspaceMemberId. Lightweight — does not return full profile sections; use fetch-linkedin-profile for enrichment.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_VISIT_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Visit LinkedIn profile',
        icon: 'IconEye',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              visited: { type: 'boolean', label: 'Visited' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              firstName: { type: 'string', label: 'First name' },
              lastName: { type: 'string', label: 'Last name' },
              headline: { type: 'string', label: 'Headline' },
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: OUTREACH_VISIT_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchPeopleId,
      name: OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
      description:
        'Search people via People API (search only, does not enroll). Pass naturalLanguage, a pasted LinkedIn search URL (searchUrl), and optional company/location/limit. Uses Unipile when the workspace member has a LinkedIn Unipile account, otherwise Harvest.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Search people',
        icon: 'IconUsers',
        inputSchema: [
          {
            type: 'object',
            properties: {
              naturalLanguage: { type: 'string', label: 'Natural language' },
              searchUrl: {
                type: 'string',
                label: 'LinkedIn search URL',
              },
              companyName: { type: 'string', label: 'Company name' },
              website: { type: 'string', label: 'Website' },
              companyId: OUTREACH_COMPANY_RECORD_INPUT,
              jobTitle: { type: 'string', label: 'Job title' },
              locations: {
                type: 'array',
                label: 'Locations',
                items: { type: 'string', label: 'Location' },
              },
              country: { type: 'string', label: 'Country' },
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
                    experience: OUTREACH_PERSON_EXPERIENCE_OUTPUT,
                    education: OUTREACH_PERSON_EDUCATION_OUTPUT,
                    current_positions: OUTREACH_PERSON_CURRENT_POSITIONS_OUTPUT,
                  },
                },
              },
            },
          },
        ],
        sampleOutput: OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchCompaniesId,
      name: OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
      description:
        'Search companies via Company API. Pass url for a Sales Nav account list or LinkedIn search URL. dataSource auto prefers Unipile Sales Navigator, then Recruiter/classic, Harvest, then index.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Search companies',
        icon: 'IconBuildingSkyscraper',
        inputSchema: [
          {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                label: 'LinkedIn URL',
              },
              companyName: {
                type: 'string',
                label: 'Company name',
                linkedinParameterType: 'COMPANY',
              },
              location: {
                type: 'string',
                label: 'Location',
                linkedinParameterType: 'LOCATION',
              },
              industry: {
                type: 'string',
                label: 'Industry',
                linkedinParameterType: 'INDUSTRY',
              },
              keywords: { type: 'string', label: 'Keywords' },
              website: { type: 'string', label: 'Website' },
              query: { type: 'string', label: 'Query' },
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
        sampleOutput: OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchCrunchbaseCompaniesId,
      name: OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME,
      description:
        'Search companies via Apify Crunchbase scraper. Pass searchUrl (Crunchbase discover URL). Cookies from paste or workspaceMember.crunchbaseCookies. Pipe companies[] into upsert-companies with projectId.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Search Crunchbase companies',
        icon: 'IconBrandCrunchbase',
        inputSchema: [
          {
            type: 'object',
            properties: {
              searchUrl: {
                type: 'string',
                label: 'Crunchbase search URL',
              },
              cookie: {
                type: 'string',
                label: 'Cookies (JSON array, optional)',
              },
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              cursor: { type: 'string', label: 'Cursor' },
              minDelay: { type: 'number', label: 'Min delay (seconds)' },
              maxDelay: { type: 'number', label: 'Max delay (seconds)' },
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
        sampleOutput: OUTREACH_SEARCH_CRUNCHBASE_COMPANIES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchJobsId,
      name: OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
      description:
        'Search jobs via Jobs API. dataSource auto uses Unipile Sales Navigator account resolution then Harvest.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
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
        sampleOutput: OUTREACH_SEARCH_JOBS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.searchPostsId,
      name: OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
      description:
        'Search LinkedIn posts via Posts API. dataSource auto uses Unipile Sales Navigator account resolution then Harvest.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
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
              text: {
                type: 'string',
                label: 'Formatted text (for AI agent)',
              },
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
        sampleOutput: OUTREACH_SEARCH_POSTS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchUserCommentsId,
      name: OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
      description:
        'Fetch comments made by a LinkedIn user via Unipile List User Comments. Pass linkedinUrl, linkedinProfileId, candidateId, or userId (`me` for the connected account). Paginates until limit (default 50, max 200).',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_USER_COMMENTS_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch user comments',
        icon: 'IconMessageCircle',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
              userId: { type: 'string', label: 'User ID' },
              accountId: { type: 'string', label: 'Account ID' },
              limit: { type: 'number', label: 'Limit' },
              cursor: { type: 'string', label: 'Cursor' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              nextCursor: { type: 'string', label: 'Next cursor' },
              error: { type: 'string', label: 'Error' },
              text: {
                type: 'string',
                label: 'Formatted text (for AI agent)',
              },
              comments: {
                type: 'array',
                label: 'Comments',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', label: 'ID' },
                    text: { type: 'string', label: 'Text' },
                    createdAt: { type: 'string', label: 'Created at' },
                    threadId: { type: 'string', label: 'Thread ID' },
                    replyCounter: { type: 'number', label: 'Reply counter' },
                    authorName: { type: 'string', label: 'Author name' },
                    authorUrl: { type: 'string', label: 'Author URL' },
                    parentPostId: { type: 'string', label: 'Parent post ID' },
                    parentPostUrl: { type: 'string', label: 'Parent post URL' },
                    parentPostText: {
                      type: 'string',
                      label: 'Parent post text',
                    },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: OUTREACH_FETCH_USER_COMMENTS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchLinkedinMessagesId,
      name: OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
      description:
        'Fetch LinkedIn chat messages for a person. Uses local chatMessage transcript when present; otherwise Unipile ChatAttendees. Pass linkedinUrl or linkedinProfileId plus optional workspaceMemberId/candidateId/limit. Set forceRefresh to bypass the local cache.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch LinkedIn messages',
        icon: 'IconBrandLinkedin',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              linkedinProfileId: {
                type: 'string',
                label: 'LinkedIn profile ID',
              },
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
              limit: { type: 'number', label: 'Limit' },
              forceRefresh: {
                type: 'boolean',
                label: 'Force refresh (skip local cache)',
              },
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
              text: {
                type: 'string',
                label: 'Formatted text (for AI agent)',
              },
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
        sampleOutput: OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchCompanyDetailsId,
      name: OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
      description:
        'Fetch a single company by LinkedIn URL, domain, or name. LinkedIn URL uses Unipile company profile; otherwise searches Company API and enriches when possible.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
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
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
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
        sampleOutput: OUTREACH_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.uploadProfilesId,
      name: OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
      description:
        'Enroll people or candidates as Person + Candidate on a Project via the upload-profiles pipeline (GTM projects get QUEUED + linkedinProfileId). Pass projectId, optional companyId, and people[] from search/fetch — or a candidate/linkedinUrl (URL-only rows are hydrated via fetch-linkedin-profile). Recruiter is taken from the Project. Optional limit truncates the batch; when omitted, all people are enrolled.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Upload profiles',
        icon: 'IconUsersPlus',
        inputSchema: [
          {
            type: 'object',
            properties: {
              projectId: OUTREACH_PROJECT_RECORD_INPUT,
              companyId: OUTREACH_COMPANY_RECORD_INPUT,
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
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
                    companyId: { type: 'string', label: 'Company ID' },
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
                  },
                },
              },
              limit: {
                type: 'number',
                label: 'Limit (optional — default all)',
              },
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
        sampleOutput: OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.upsertCompaniesId,
      name: OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
      description:
        'Upsert Company search hits into CRM and append projectId onto projectIds[]. Pass projectId and companies[] from search-companies. Skips rows already tagged to this project.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Upsert companies',
        icon: 'IconBuildingSkyscraper',
        inputSchema: [
          {
            type: 'object',
            properties: {
              projectId: OUTREACH_PROJECT_RECORD_INPUT,
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
              limit: { type: 'number', label: 'Limit' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              created: { type: 'number', label: 'Created' },
              updated: { type: 'number', label: 'Updated' },
              skipped: { type: 'number', label: 'Skipped' },
              projectId: { type: 'string', label: 'Project ID' },
              companyIds: { type: 'array', label: 'Company IDs' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.enrichContactId,
      name: OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
      description:
        'Fetch email and phone for a candidate via contact enrichment waterfall. Pass candidateId and/or linkedinUrl. Optional wantEmail/wantPhone (both default on). Stamps enrichStatus.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch contacts',
        icon: 'IconAddressBook',
        inputSchema: [
          {
            type: 'object',
            properties: {
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
              wantEmail: { type: 'boolean', label: 'Want email' },
              wantPhone: { type: 'boolean', label: 'Want phone' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              email: { type: 'string', label: 'Email' },
              emails: { type: 'array', label: 'Emails' },
              phones: { type: 'array', label: 'Phones' },
              source: { type: 'string', label: 'Source' },
              enrichStatus: { type: 'string', label: 'Enrich status' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchEmailId,
      name: OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME,
      description:
        'Fetch email only for a candidate via contact enrichment waterfall. Pass candidateId and/or linkedinUrl.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_EMAIL_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch email',
        icon: 'IconMail',
        inputSchema: [
          {
            type: 'object',
            properties: {
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              email: { type: 'string', label: 'Email' },
              emails: { type: 'array', label: 'Emails' },
              phones: { type: 'array', label: 'Phones' },
              source: { type: 'string', label: 'Source' },
              enrichStatus: { type: 'string', label: 'Enrich status' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: OUTREACH_FETCH_EMAIL_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.fetchPhoneId,
      name: OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME,
      description:
        'Fetch phone only for a candidate via contact enrichment waterfall. Pass candidateId and/or linkedinUrl.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FETCH_PHONE_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Fetch phone',
        icon: 'IconPhone',
        inputSchema: [
          {
            type: 'object',
            properties: {
              candidateId: OUTREACH_CANDIDATE_RECORD_INPUT,
              linkedinUrl: { type: 'string', label: 'LinkedIn URL' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              email: { type: 'string', label: 'Email' },
              emails: { type: 'array', label: 'Emails' },
              phones: { type: 'array', label: 'Phones' },
              source: { type: 'string', label: 'Source' },
              enrichStatus: { type: 'string', label: 'Enrich status' },
              error: { type: 'string', label: 'Error' },
            },
          },
        ],
        sampleOutput: OUTREACH_FETCH_PHONE_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.getCalendarAvailabilityId,
      name: OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
      description:
        'Return free seller calendar slots from Google Calendar busy times. Pass optional workspaceMemberId, days, slotMinutes. Inject slots into AI_AGENT — do not invent times.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Get calendar availability',
        icon: 'IconCalendarTime',
        inputSchema: [
          {
            type: 'object',
            properties: {
              workspaceMemberId: OUTREACH_WORKSPACE_MEMBER_RECORD_INPUT,
              days: { type: 'number', label: 'Days ahead' },
              slotMinutes: { type: 'number', label: 'Slot minutes' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              error: { type: 'string', label: 'Error' },
              slots: {
                type: 'array',
                label: 'Slots',
                items: {
                  type: 'object',
                  properties: {
                    startsAt: { type: 'string', label: 'Starts at' },
                    endsAt: { type: 'string', label: 'Ends at' },
                  },
                },
              },
            },
          },
        ],
        sampleOutput: OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.detectFakeProfilesId,
      name: OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
      description:
        'Investigative LLM screen of LinkedIn people. Pass Profiles (search hits), Full profile (Fetch LinkedIn profile), or Snapshot (snapshot JSON / search payload). Returns assessments plus fakeProfiles and genuineProfiles. Uses Nous HY3 (hy3:free) by default.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Detect fake profiles',
        icon: 'IconUserSearch',
        inputSchema: [
          {
            type: 'object',
            properties: {
              profiles: { type: 'array', label: 'Profiles' },
              profile: { type: 'array', label: 'Full profile' },
              snapshot: { type: 'string', label: 'Snapshot' },
              modelId: { type: 'string', label: 'Model' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              fakeCount: { type: 'number', label: 'Fake count' },
              genuineCount: { type: 'number', label: 'Genuine count' },
              uncertainCount: { type: 'number', label: 'Uncertain count' },
              error: { type: 'string', label: 'Error' },
              fakeProfiles: { type: 'array', label: 'Fake profiles' },
              genuineProfiles: { type: 'array', label: 'Genuine profiles' },
              assessments: { type: 'array', label: 'Assessments' },
            },
          },
        ],
        sampleOutput: OUTREACH_DETECT_FAKE_PROFILES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.filterProfilesId,
      name: OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
      description:
        'LLM filter of LinkedIn people against a prompt. Pass profiles and a criteria prompt. Optionally keep only the most senior person per company. Each profile is assessed independently against the full profile JSON. Returns matching people. Uses Nous HY3 (hy3:free) by default.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Filter profiles',
        icon: 'IconFilter',
        inputSchema: [
          {
            type: 'object',
            properties: {
              profiles: { type: 'array', label: 'Profiles', multiline: false },
              onlyOnePersonPerCompany: {
                type: 'boolean',
                label: 'Only one person per company',
              },
              prompt: { type: 'string', label: 'Prompt', multiline: true },
              modelId: { type: 'string', label: 'Model' },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              total: { type: 'number', label: 'Total' },
              matchedCount: { type: 'number', label: 'Matched count' },
              rejectedCount: { type: 'number', label: 'Rejected count' },
              error: { type: 'string', label: 'Error' },
              people: { type: 'array', label: 'People' },
              rejected: { type: 'array', label: 'Rejected' },
              assessments: { type: 'array', label: 'Assessments' },
            },
          },
        ],
        sampleOutput: OUTREACH_FILTER_PROFILES_SAMPLE_OUTPUT,
      },
    },
    {
      id: ids.validateInboundSignalsId,
      name: OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME,
      description:
        'Ground the inbound signal extraction agent before the graph acts on it. Resolves acceptedSlotIndex against the injected calendar slots, blanks any referral or prospect contact that does not appear in the transcript, and normalises replyChannel as explicit switch → sticky preferredChannel → last inbound → LINKEDIN. No LLM call.',
      sourceHandlerCode: getOutreachNativeLogicFunctionHandler(
        OUTREACH_VALIDATE_INBOUND_SIGNALS_LOGIC_FUNCTION_NAME,
      ),
      workflowActionTriggerSettings: {
        label: 'Validate inbound signals',
        icon: 'IconShieldCheck',
        inputSchema: [
          {
            type: 'object',
            properties: {
              transcript: { type: 'string', label: 'Transcript' },
              slots: {
                type: 'array',
                label: 'Slots',
                items: {
                  type: 'object',
                  properties: {
                    startsAt: { type: 'string', label: 'Starts at' },
                    endsAt: { type: 'string', label: 'Ends at' },
                  },
                },
              },
              lastInboundChannel: {
                type: 'string',
                label: 'Last inbound channel',
              },
              preferredChannel: {
                type: 'string',
                label: 'Sticky preferred channel',
              },
              acceptedSlotIndex: {
                type: 'number',
                label: 'Accepted slot index',
              },
              requestedChannelSwitch: {
                type: 'string',
                label: 'Requested channel switch',
              },
              prospectEmail: { type: 'string', label: 'Prospect email' },
              referralName: { type: 'string', label: 'Referral name' },
              referralEmail: { type: 'string', label: 'Referral email' },
              referralPhone: { type: 'string', label: 'Referral phone' },
              shouldNotRespond: {
                type: 'boolean',
                label: 'Should not respond',
              },
            },
          },
        ],
        outputSchema: [
          {
            type: 'object',
            properties: {
              success: { type: 'boolean', label: 'Success' },
              startsAt: { type: 'string', label: 'Starts at' },
              endsAt: { type: 'string', label: 'Ends at' },
              replyChannel: { type: 'string', label: 'Reply channel' },
              preferredChannelToStamp: {
                type: 'string',
                label: 'Preferred channel to stamp',
              },
              prospectEmail: { type: 'string', label: 'Prospect email' },
              referralName: { type: 'string', label: 'Referral name' },
              referralEmail: { type: 'string', label: 'Referral email' },
              referralPhone: { type: 'string', label: 'Referral phone' },
              hasReferral: { type: 'boolean', label: 'Has referral' },
              shouldNotRespond: {
                type: 'boolean',
                label: 'Should not respond',
              },
            },
          },
        ],
        sampleOutput: OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT,
      },
    },
  ];
};

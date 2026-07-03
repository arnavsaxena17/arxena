import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

import axios from 'axios';
import {
  CandidateEdge,
  CandidateEnrichmentEdge,
  CandidateWithCustomFields,
  CreateOneVideoInterviewTemplate,
  findWorkspaceMemberProfiles,
  getGraphqlToFindManyJobs,
  graphqlMutationToDeleteManyCandidates,
  graphqlMutationToDeleteManyPeople,
  graphqlQueryToFindManyPeople,
  graphqlToAddNewJob,
  graphqlToCreateOnePrompt,
  graphqlToFetchAllCandidateData,
  graphqlToFetchAllCandidateDataWithFieldValues,
  graphQlTofindManyCandidateEnrichments,
  graphqlToFindManyJobs,
  graphQltoUpdateOneCandidate,
  graphQLToUpdateOneWorkspaceMemberProfile,
  Job,
  JobEdge,
  mergeChatQuestionsPreservingOrder,
  mutations,
  PageInfo,
  parseRowOtherFields,
  PersonEdge,
  PersonNode,
  queries,
  resolveIsOrgChartEnabledFromWorkspace,
  UpdateOneJob,
  UserProfile
} from 'twenty-shared';
import { v4 } from 'uuid';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import {
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { DeleteFieldValuesService } from 'src/engine/core-modules/candidate-sourcing/jobs/delete-field-values.service';
import { ProcessAiFiltersService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-ai-filters.service';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { AiFilteringService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filtering.service';
import { CandidateWorkspaceGraphQLService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-workspace-graphql.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { FilterDescriptionProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import { JDParserService } from 'src/engine/core-modules/candidate-sourcing/services/jd-parser.service';
import { OtherFieldsService } from 'src/engine/core-modules/candidate-sourcing/services/other-fields.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
import { createJobIdErrorResponse, validateAndExtractJobId } from 'src/engine/core-modules/candidate-sourcing/utils/job-id.utils';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { prompts } from 'src/engine/core-modules/workspace-modifications/object-apis/data/prompts';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

/**
 * `graphqlToFetchAllCandidateData` returns nested `jobs { id }`, not top-level `jobsId`.
 * Some code paths still expose `jobsId` / `jobId` on the node — support both.
 */
const getCandidateJobIdForByLinkedInUrls = (
  candidate: Record<string, unknown>,
): string | undefined => {
  const jobsId = candidate['jobsId'];
  if (typeof jobsId === 'string' && jobsId.trim()) {
    return jobsId.trim();
  }
  const jobId = candidate['jobId'];
  if (typeof jobId === 'string' && jobId.trim()) {
    return jobId.trim();
  }
  const jobs = candidate['jobs'];
  if (jobs && typeof jobs === 'object' && jobs !== null && 'id' in jobs) {
    const id = (jobs as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }
  return undefined;
};

@Controller('candidate-sourcing')
export class CandidateSourcingController {
  constructor(
    private readonly sheetsService: GoogleSheetsService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly candidateService: CandidateService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly processAiFiltersService: ProcessAiFiltersService,
    private readonly personService: PersonService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly aiFilteringService: AiFilteringService,
    private readonly filterDescriptionProcessorService: FilterDescriptionProcessorService,
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
    private readonly deleteFieldValuesService: DeleteFieldValuesService,
    private readonly jdParserService: JDParserService,
    private readonly candidateWorkspaceGraphQLService: CandidateWorkspaceGraphQLService,
    private readonly otherFieldsService: OtherFieldsService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Post('update-candidate')
  @UseGuards(JwtAuthGuard)
  async updateCandidateSpreadsheet(@Req() request: any): Promise<object> {
    console.log('Updating candidate spreadsheet', 'CandidateSourcingController');
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { candidate, jobId, jobName } = request.body;
      const jobObject = await this.findJob(jobName, apiToken);

      if (!jobObject?.googleSheetId) {
        throw new Error('No Google Sheet ID found for job');
      }
      const auth =
        await this.sheetsService.loadSavedCredentialsIfExist(apiToken);

      if (!auth) {
        throw new Error('Failed to authenticate with Google');
      }

      // Update the sheet
      await this.sheetsService.updateCandidateInSheet(
        auth,
        jobObject.googleSheetId,
        candidate,
        apiToken,
      );

      return {
        status: 'Success',
        message: 'Candidate updated in spreadsheet',
      };
    } catch (err) {
      console.error('Error updating candidate spreadsheet:', err);

      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }


  @Post('find-many-ai-filters')
  @UseGuards(JwtAuthGuard)
  async findManyAiFilters(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphQlTofindManyCandidateEnrichments, {}, apiToken);
      const candidateEnrichments = response?.data?.data?.candidateEnrichments as {
        edges: CandidateEnrichmentEdge[];
        pageInfo: PageInfo;
      } | undefined;

      return {
        status: 'Success',
        data: candidateEnrichments?.edges?.map(
          (edge: any) => edge.node,
        ),
      };
    } catch (err) {
      console.error('Error in findManyAiFilters:', err);
      return { status: 'Failed', error: err };
    }
  }


  @Post('update-snapshot-profiles')
  @UseGuards(JwtAuthGuard)
  async updateProfiles(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const { candidateIds, uniqueStringKeys, personIds, objectNameSingular } =
      request.body as {
        candidateIds: string[];
        uniqueStringKeys: string[];
        personIds: string[];
        objectNameSingular: string;
      };

    console.log('jobCandidateIds::', candidateIds);
    console.log('objectNameSingular::', objectNameSingular);
    console.log('uniqueStringKeys::', uniqueStringKeys);
    console.log('personIds::', personIds);

    try {
      for (let i = 0; i < candidateIds.length; i++) {
        const candidateId = candidateIds[i] || '';
        const personId = personIds[i] || '';
        const uniqueStringKey = uniqueStringKeys[i] || '';

        await this.personService.purchaseAndUpdateApnaProfile(
          'update-snapshot-profiles',
          'update-snapshot-profiles',
          candidateId, // Pass individual ID instead of array
          personId, // Pass individual ID instead of array
          uniqueStringKey, // Pass individual key instead of array
          apiToken,
          '',
        );
      }

      return { status: 'Success' };
    } catch (error) {
      console.log('Error in updateProfiles:', error);

      return { status: 'Failed', error: error.message };
    }
  }

  @Post('process-ai-filters')
  @UseGuards(JwtAuthGuard)
  async processAiFilters(@Req() request: any): Promise<object> {
    try {
      console.log('Processing AI filters via controller - queueing job');
      const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, '');
      const origin = request.headers.origin;

      const jobIdValidation = validateAndExtractJobId(request.body.jobId);
      if (!jobIdValidation.isValid) {
        return createJobIdErrorResponse(jobIdValidation.error!);
      }

      const aiFiltersRequest = {
        aiFilters: request?.body?.aiFilters ?? request?.body?.enrichments,
        objectNameSingular: request?.body?.objectNameSingular,
        availableSortDefinitions: request?.body?.availableSortDefinitions || [],
        availableFilterDefinitions: request?.body?.availableFilterDefinitions || [],
        objectRecordId: request?.body?.objectRecordId,
        selectedRecordIds: request?.body?.selectedRecordIds,
        jobId: jobIdValidation.jobId!,
      };

      await this.processAiFiltersService.send(
        aiFiltersRequest,
        apiToken,
        origin,
      );

      return {
        status: 'success',
        message: 'AI filter processing queued successfully',
        jobId: aiFiltersRequest.jobId,
      };
    } catch (err) {
      console.error('Error in process AI filters controller:', err);
      return {
        status: 'error',
        error: err.message,
        details: err.response?.data || err.stack,
      };
    }
  }


  
  async findJob(path_position: string, apiToken: string): Promise<any> {
    console.log('Going to find job by path_position id:', path_position);
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const workspaceKeys =
      await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
    const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
      workspaceKeys?.is_org_chart_enabled,
    );
    const query = getGraphqlToFindManyJobs(isOrgChartEnabled);
    const variables = {
      filter: { pathPosition: { in: [path_position] } },
      limit: 30,
      orderBy: [{ position: 'AscNullsFirst' }],
    };
    const response = await this.staticGraphQLService.executeGraphQL(
      query,
      variables,
      apiToken,
    );
    const jobs = response?.data?.data?.jobs as {
      edges: JobEdge[];
      pageInfo: PageInfo;
    } | undefined;
    const job = jobs?.edges[0]?.node;
    console.log('This is the job:', job);
    return job;
  }

  @Post('process-job-candidate-refresh-data')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token

    try {
      // const { candidateIds } = body;
      const objectNameSingular = request.body.objectNameSingular;

      console.log('thisi s objectNameSingular:', objectNameSingular);
      const url =
        process.env.ENV_NODE === 'production'
          ? 'https://arxena.com/sync_job_candidate'
          : 'http://localhost:5050/sync_job_candidate';

      console.log('url:', url);
      const response = await axios.post(
        url,
        { objectNameSingular: objectNameSingular },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('transcribe-call')
  @UseGuards(JwtAuthGuard)
  async transcribeCall(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ; // Assuming Bearer token

    try {
      // const { candidateIds } = body;
      const phoneCallIds = request.body.phoneCallIds;
      const url =
        process.env.ENV_NODE === 'production'
          ? 'https://arxena.com/transcribe_call'
          : 'http://localhost:5050/transcribe_call';

      console.log('url:', url);
      const response = await axios.post(
        url,
        { phoneCallIds: phoneCallIds },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`, }, },
      );
      console.log('Received this response:', response.data);
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  getJobCandidatePathPosition(jobName: string): string {
    return this.toCamelCase(jobName)
      .replace('-', '')
      .replace(' ', '')
      .replace('#', '')
      .replace('/', '')
      .replace('+', '')
      .replace('(', '')
      .replace(')', '')
      .replace(',', '')
      .replace('.', '');
  }

  toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  }

  @Post('create-job-in-arxena-and-sheets')
  @UseGuards(JwtAuthGuard)
  async createJobInArxena(@Req() req: any): Promise<any> {
    console.log('going to create job in arxena');
    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const origin = req.headers['x-origin-domain'] || req.headers.origin;
    try {
      if (!req?.body?.job_name || !req?.body?.new_job_id) {
        throw new Error('Missing required fields: job_name or new_job_id');
      }
      const jobId = req?.body?.id_to_update;

      console.log('this is the job name:', req.body.job_name);
      console.log('this is the job id:', req.body.new_job_id);
      await new Promise((resolve) => setTimeout(resolve, 500));

      let googleSheetUrl = '';
      let googleSheetId = '';

      await this.createVideoInterviewTemplate(
        req.body.job_name,
        jobId,
        apiToken,
      );

      // disabling sheets for now
      // const { googleSheetId: googleSheetIdFromRequest, googleSheetUrl: googleSheetUrlFromRequest } = req.body;
      // const { googleSheetId, googleSheetUrl } = await this.createSpreadsheet(
      //   req.body.job_name,
      //   apiToken,
      // );

      await this.updateTwentyJob(
        req.body.job_name,
        req.body.new_job_id,
        googleSheetUrl ?? '',
        googleSheetId ?? '',
        apiToken,
        req.body.id_to_update,
        origin,
      );

      const response = await this.callCreateNewJobInArxena(
        req.body.job_name,
        req.body.new_job_id,
        googleSheetId,
        googleSheetUrl,
        apiToken,
      );

      return {
        ...response?.data?.data?.createJob,
        // googleSheetId,
        // googleSheetUrl,
      };
    } catch (error) {
      console.log('Error in createJobInArxena:', error);

      return { error: error.message };
    }
  }

  async createVideoInterviewTemplate(
    jobName: string,
    jobId: string,
    apiToken: string,
  ) {
    try {
      console.log('Going to create video interview templates');
      console.log(
        'Going to create video interview templates for ob ide:',
        jobId,
      );
      const videoInterviewModels =
        await this.candidateWorkspaceGraphQLService.getVideoInterviewModels(apiToken);

      console.log('videoInterviewModels:', videoInterviewModels);
      const videoInterviewModelId = videoInterviewModels[0]?.node?.id;

      console.log('videoInterviewModelId:', videoInterviewModelId);
      const variables = {
        input: {
          name: jobName + ' Interview Template',
          jobId: jobId,
          introduction: `Hi, I am Arnav Saxena. I am a Director at Arxena, a US based recruitment firm. 
          Thanks so much for your application for the role of a ${jobName}. 
          We are excited to get to know you a little better!
          So we have 3 questions in the steps ahead!
          You'll need about 10 to 15 minutes and a strong signal to complete this.
          When you click the I'm ready lets go button, you'll be taken to the first question, you'll have 4 minutes to record your answer. 
          If this is your first time doing this interview this way, please don't stress about getting the perfect video. We are more interested in getting to know you and not getting the perfect video. 
          So relax, take a breath and get started!`,
          instructions: `Before you begin the interview:
          1. Find a quiet place with good internet connectivity
          2. Ensure you are in a well-lit area where your face is clearly visible
          3. Dress professionally for the interview
          4. Look directly at the camera while speaking
          5. Speak clearly at a moderate pace
          You will have 4 minutes to answer each question. Good luck!`,
          videoInterviewModelId: videoInterviewModelId,
        },
      };

      console.log('Thesea are the variables:', variables);
      const query = CreateOneVideoInterviewTemplate;
      const data = { query, variables };
      const response = await this.staticGraphQLService.executeGraphQL(CreateOneVideoInterviewTemplate, variables, apiToken);

      console.log('response:', response.data);
    } catch {
      console.log('Error in creating video interview template ');
    }
  }

  async updateTwentyJob(
    jobName: string,
    newJobId: string,
    googleSheetUrl: string,
    googleSheetId: string | null,
    apiToken: string,
    idToUpdate: string,
    origin: string,

  ) {
    try {
      const jobCode = `${String.fromCharCode(65 + Math.floor(Math.random() * 10))}${String.fromCharCode(65 + Math.floor(Math.random() * 10))} ${Math.floor( Math.random() * 100 ).toString().padStart(2, '0')}`;
      console.log('Going to get current user in updateTwentyJob');
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService). getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;
      console.log( 'This is the currentUser?.workspaces:', JSON.stringify(currentUser?.workspaces) );
      console.log('This is the current user:', currentUser);
      console.log('This is the recruiter id:', recruiterId);



      const responseToUpdateJob = await this.staticGraphQLService.executeGraphQL(
        UpdateOneJob,
        {
          idToUpdate: idToUpdate,
          input: {
            pathPosition: this.getJobCandidatePathPosition(jobName),
            recruiterId: recruiterId,
            arxenaSiteId: newJobId,
            jobCode: jobCode,
            isActive: true,
            jobLocation: 'India',
            googleSheetUrl: {
              primaryLinkLabel: googleSheetUrl,
              primaryLinkUrl: googleSheetUrl,
            },
            ...(googleSheetId && { googleSheetId: googleSheetId }),
          },
        },
        apiToken,
      );

      console.log(
        'Response from update job in create Job IN Arxena:',
        responseToUpdateJob.data.data,
      );
    } catch (error) {
      console.error('Error updating Twenty job:', error);
    }
  }

  private async createSpreadsheet(
    jobName: string,
    apiToken: string,
  ): Promise<{ googleSheetId: string | null; googleSheetUrl: string | null }> {
    let googleSheetId: string | null = null;
    let googleSheetUrl: string | null = null;

    try {
      console.log('Going to create spreadsheet for job:', jobName);
      const auth =
        await this.sheetsService.loadSavedCredentialsIfExist(apiToken);

      if (auth) {
        const spreadsheetTitle = `${jobName}`;

        console.log('Creating spreadsheet with title:', spreadsheetTitle);
        const spreadsheet = await this.sheetsService.createSpreadsheetForJob(
          spreadsheetTitle,
          apiToken,
        );

        console.log('this is spreadsheet:', spreadsheet);
        googleSheetId = spreadsheet?.googleSheetId ?? null;
        googleSheetUrl = spreadsheet?.googleSheetUrl;
      }
    } catch (spreadsheetError) {
      console.log(
        'Warning: Failed to create spreadsheet error:',
        spreadsheetError,
      );
      console.log(
        'Warning: Failed to create spreadsheet:',
        spreadsheetError.message,
      );
    }

    return { googleSheetId, googleSheetUrl };
  }

  private async callCreateNewJobInArxena(
    jobName: string,
    newJobId: string,
    googleSheetId: string | null,
    googleSheetUrl: string | null,
    apiToken: string,
  ): Promise<any> {
    console.log("Creating new job in Arxena::", jobName, newJobId, apiToken);
    console.log("ENV NODE::", process.env.ENV_NODE);
    try {
      const url =
        process.env.ENV_NODE === 'production'
          ? 'https://arxena.com/create_new_job'
          : 'http://localhost:5050/create_new_job';
      const response = await axios.post(
        url,
        {
          job_name: jobName,
          new_job_id: newJobId,
          googleSheetId,
          googleSheetUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );
      console.log("Response from create new job in Arxena::", response.data);

      return response.data;
    } catch (error) {
      console.error('Error calling create new job in Arxena:', error);
      return { data: error.message };
    }
  }

  @Post('refresh-table-data')
  @UseGuards(JwtAuthGuard)
  async refreshTableData(@Req() req) {
    console.log('Called refresh table data API');
    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const recruiterId = req.body?.recruiterId;
    console.log("recruiterId::", recruiterId);

    // Note: Table refresh is now handled via other mechanisms
    // This endpoint is kept for backward compatibility
    return {
      status: 'Success',
      message: 'Table refresh request received'
    };
  }



  @Post('upload-profiles')
  @UseGuards(JwtAuthGuard)
  async uploadProfiles(@Req() req) {
    console.log('Called upload profiles API');
    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const origin = req.headers['x-origin-domain'] || req.headers.origin;
    
    try {
      const data = req.body;
      
      if (!data) {
        return {
          status: 'fail',
          message: 'No data provided'
        };
      }

      console.log('Received upload profiles request data keys:', Object.keys(data));
      console.log('Data source:', data.data_source);
      console.log('Popup data:', data.popup_data);
      console.log('Job data:', data.job);
      console.log('JSON data type:', typeof data.json_data);
      
      // Handle different data source formats similar to Python implementation
      let candidates: any[] = [];
      let dataSource = '';
      let jobId = '';
      let jobName = '';
      let recruiterId = '';

      if (data.csv_excel_data) {
        // Handle CSV/Excel data upload
        console.log('Processing CSV/Excel data upload');
        return {
          status: 'fail',
          message: 'CSV/Excel upload not yet implemented in NestJS'
        };
      } else if (data.popup_data?.job_data_source === 'spreadsheet_import') {
        // Handle spreadsheet import
        candidates = data.candidates || [];
        dataSource = data.popup_data.job_data_source;
        // Try multiple sources for job information - prioritize twenty_job_id over job_id
        jobId = data.popup_data.twenty_job_id || data.job?.id || data.popup_data.job_id || data.job?.job_id || '';
        jobName = data.popup_data.job_name || data.job?.job_name || data.job?.name || '';
        recruiterId = data.popup_data.recruiterId || data.job?.recruiterId || data.recruiterId || '';
      } else if (data.candidates) {
        // Handle general candidates upload
        candidates = data.candidates;
        dataSource = data.data_source || '';
        // Try multiple sources for job information
        jobId = data.popup_data?.job_id || data.job?.job_id || data.job?.id || data.job_id || '';
        jobName = data.popup_data?.job_name || data.job?.job_name || data.job?.name || data.job_name || '';
        recruiterId = data.popup_data?.recruiterId || data.job?.recruiterId || data.recruiterId || '';
      } else if (data.resdex_profile_data) {
        // Handle Resdex profile data
        candidates = JSON.parse(data.resdex_profile_data);
        dataSource = 'profile_data_naukri';
        jobId = data.job_id || data.job?.job_id || data.job?.id || '';
        jobName = data.job_name || data.job?.job_name || data.job?.name || '';
        recruiterId = data.recruiterId || data.job?.recruiterId || '';
      } else if (data.linkedin_premium_profile_data) {
        // Handle LinkedIn Premium profile data
        candidates = [data.linkedin_premium_profile_data];
        dataSource = 'linkedin_premium';
        jobId = data.job_id || data.job?.job_id || data.job?.id || '';
        jobName = data.job_name || data.job?.job_name || data.job?.name || '';
        recruiterId = data.recruiterId || data.job?.recruiterId || '';
      } else if (data.linkedin_search_results) {
        // Handle LinkedIn search results
        candidates = data.linkedin_search_results;
        dataSource = 'linkedin_search';
        jobId = data.job_id || data.job?.job_id || data.job?.id || '';
        jobName = data.job_name || data.job?.job_name || data.job?.name || '';
        recruiterId = data.recruiterId || data.job?.recruiterId || '';
        console.log(`Processing ${candidates.length} LinkedIn search results`);
      } else if (data.json_data) {
        // Handle generic JSON data with nested structure
        try {
          const jsonData = typeof data.json_data === 'string' ? JSON.parse(data.json_data) : data.json_data;
          console.log('Parsed JSON data structure:', Array.isArray(jsonData) ? 'Array' : typeof jsonData);
          console.log('JSON data sample:', JSON.stringify(jsonData).substring(0, 200) + '...');
          if (jsonData.data?.users) {
            candidates = jsonData.data.users;
            console.log('Using jsonData.data.users, count:', candidates.length);
          } else if (Array.isArray(jsonData)) {
            candidates = jsonData;
            console.log('Using jsonData array, count:', candidates.length);
          } else {
            candidates = [jsonData];
            console.log('Using single jsonData wrapped in array');
          }
        } catch (parseError) {
          console.error('Error parsing JSON data:', parseError);
          return {
            status: 'fail',
            message: 'Invalid JSON data format',
            error: parseError.message
          };
        }
        
        dataSource = data.data_source || '';
        // Try multiple sources for job information
        jobId = data.popup_data?.job_id || data.job?.job_id || data.job?.id || data.job_id || '';
        jobName = data.popup_data?.job_name || data.job?.job_name || data.job?.name || data.job_name || '';
        recruiterId = data.popup_data?.recruiterId || data.job?.recruiterId || data.recruiterId || '';
      } else {
        return {
          status: 'fail',
          message: 'No valid data format found in request'
        };
      }

      console.log(`Processing ${candidates.length} candidates from data source: ${dataSource}`);
      console.log(`Job ID: ${jobId}, Job Name: ${jobName}, Recruiter ID: ${recruiterId}`);
      
      // Additional debugging for job information extraction
      console.log('Job information extraction debug:');
      console.log('- data.popup_data:', data.popup_data);
      console.log('- Selected jobId:', jobId);
      console.log('- Selected jobName:', jobName);

      if (!candidates || candidates.length === 0) {
        return {
          status: 'fail',
          message: 'No candidates found in request data'
        };
      }

      if (!dataSource) {
        return {
          status: 'fail',
          message: 'Data source not specified'
        };
      }

      if (!jobId || !jobName) {
        return {
          status: 'fail',
          message: 'Job ID and Job Name are required'
        };
      }

      const timestamp = new Date().toISOString();
      // Generate a unique upload session ID for this request to ensure each upload gets processed
      // even if multiple requests come in simultaneously for the same job
      const uploadSessionId = v4();

      // Get recruiter ID for progress reporting
      let actualRecruiterId = recruiterId;
      if (!actualRecruiterId) {
        try {
          const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
          actualRecruiterId = currentUser?.workspaceMember?.id;
          console.log('🔍 [UploadProfiles] Extracted recruiter ID from current user:', actualRecruiterId);
          console.log('🔍 [UploadProfiles] Current user workspace member:', currentUser?.workspaceMember?.userEmail);
          console.log('🔍 [UploadProfiles] Current user id:', currentUser?.id);
        } catch (userError) {
          console.warn('Could not get current user for progress reporting:', userError.message);
        }
      } else {
        console.log('🔍 [UploadProfiles] Using provided recruiter ID:', actualRecruiterId);
      }

      // Calculate total batches for progress tracking
      const batchSize = 30;
      const totalBatches = Math.ceil(candidates.length / batchSize);

      // Publish upload started notification
      if (actualRecruiterId) {
        try {
          console.log('Publishing upload started notification...');
          await this.uploadProgressPubSubService.publishUploadStarted(
            actualRecruiterId,
            candidates.length,
            totalBatches
          );
          console.log('Successfully published upload started notification');
        } catch (pubSubError) {
          console.warn('Pub-sub notification failed:', pubSubError.message);
        }
      } else {
        console.warn('No recruiterId available, skipping upload started notification');
      }

      // Check if we support this data source with new transformation pipeline
      if (this.processCandidatesService.isDataSourceSupported(dataSource)) {
        console.log(`Using new transformation pipeline for data source: ${dataSource}`);
        const queueStartChatAfter = data.queue_start_chat_after === true;
        const options =
          dataSource === 'linkedin_premium' && queueStartChatAfter
            ? { queueStartChatAfter: true }
            : undefined;
        await this.processCandidatesService.queueRawDataForProcessing(
          candidates,
          dataSource,
          jobId,
          jobName,
          actualRecruiterId || '',
          timestamp,
          origin,
          apiToken,
          uploadSessionId,
          options,
        );
      } else {
        console.log(`Data source ${dataSource} not supported by new pipeline, using legacy processing`);
        
        // For backward compatibility, fall back to legacy processing
        await this.processCandidatesService.send(
          candidates,
          jobId,
          jobName,
          timestamp,
          apiToken,
          actualRecruiterId || '',
          origin
        );
      }

      return {
        status: 'ok',
        data: { isMultiprocess: true },
        message: 'Profiles upload processing queued successfully',
        jobId: jobId
      };

    } catch (error) {
      console.error('Error in uploadProfiles:', error);
      
      // Publish upload error notification
      try {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        const recruiterId = currentUser?.workspaceMember?.id;
        if (recruiterId) {
          await this.uploadProgressPubSubService.publishUploadError(
            recruiterId,
            error.message || 'Unknown error occurred'
          );
        }
      } catch (pubSubError) {
        console.warn('Pub-sub error notification failed:', pubSubError.message);
      }
      
      return {
        status: 'fail',
        message: 'Failed to perform operation',
        error: error.message
      };
    }
  }

  @Post('post-candidates')
  @UseGuards(JwtAuthGuard)
  async sourceCandidates(@Req() req) {
    console.log('Called post candidates API');
    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
    const jobId = req.body?.job_id;
    const jobName = req.body?.job_name;
    const recruiterId = req.body?.recruiterId;
    const dataSource = req.body?.data_source || req.body?.dataSource;

    console.log('arxenaSiteId:', jobId);
    console.log('dataSource:', dataSource);
    const data: UserProfile[] = req.body?.data;

    console.log('Data len of candidates received in post candidates API:', data.length);
    console.log('First candidats:', data[0]);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
    const timestamp = req.body?.timestamp || new Date().toISOString();
    try {
      // Process profiles and get all the necessary data
      const jobIdProcesed = await this.processCandidatesService.send(
        data,
        jobId,
        jobName,
        timestamp,
        apiToken,
        recruiterId || '',
        origin
      );
      console.log("recruiterId::", recruiterId);
      // const gateway = this.webSocketGateway.sendToUser.getInstance();

      // Note: Progress notifications are now handled via Redis pub-sub
      console.log('Candidates processing started for job:', jobId);
  
      return {
        status: 'success',
        message: 'Candidate processing queued successfully',
        jobId: jobId,
      };
    } catch (error) {
      console.error('Error in sourceCandidates:', error);

      return {
        status: 'error',
        error: error.message,
        details: error.response?.data || error.stack,
      };
    }
  }

  @Post('get-job-by-id')
  @UseGuards(JwtAuthGuard)
  async getJobById(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { jobId } = request.body;

      if (!jobId) {
        return {
          status: 'Failed',
          message: 'Missing required field: jobId',
        };
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
        workspaceKeys?.is_org_chart_enabled,
      );
      const query = getGraphqlToFindManyJobs(isOrgChartEnabled);

      // Use the same GraphQL query as get-all-jobs but with a filter
      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        {
          filter: { id: { eq: jobId } },
          limit: 1,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
        apiToken,
      );

      const jobs = response?.data?.data?.jobs?.edges || [];
      const job = jobs.length > 0 ? jobs[0].node : null;

      if (!job) {
        return {
          status: 'Failed',
          message: 'Job not found',
        };
      }

      return {
        status: 'Success',
        job: job,
      };
    } catch (err) {
      console.error('Error fetching job by ID:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('get-all-jobs')
  @UseGuards(JwtAuthGuard)
  async getJobs(@Req() request: any) {
    const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, '')  ; 
    const hasApiToken = !!apiToken;
    // const workspaceId =
    //   await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    let jobs = [];
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
        workspaceKeys?.is_org_chart_enabled,
      );
      const query = getGraphqlToFindManyJobs(isOrgChartEnabled);

      const responseFromGetAllJobs =
        await this.staticGraphQLService.executeGraphQL(
          query,
          { limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
          apiToken,
        );
      jobs = responseFromGetAllJobs?.data?.data?.jobs?.edges || [];
      console.log('Number of jobs in get all jobs:', jobs.length);
    } catch (error) {
      console.error('Error fetching jobs in get all jobs:', error);
      jobs = [];
    }
    return { jobs: jobs };
  }

  @Post('post-job')
  @UseGuards(JwtAuthGuard)
  async postJob(@Req() request: any) {
    let uuid;

    try {
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const data = request.body;

      const graphqlVariables = {
        input: {
          name: data?.job_name,
          arxenaSiteId: data?.job_id,
          isActive: true,
          jobLocation: data?.jobLocation,
          jobCode: data?.jobCode,
          recruiterId: data?.recruiterId,
          companyId: data?.companyId,
        },
      };

      const responseNew = await this.staticGraphQLService.executeGraphQL(graphqlToAddNewJob, graphqlVariables, apiToken);
      console.log('responseNew:', responseNew);
      await this.markOldJobsInactive(apiToken);

      const createJob = responseNew?.data?.data?.createJob as {
        id: string;
      } | undefined;
      console.log('Response from create job', responseNew.data);
      uuid = createJob?.id;

      return { status: 'success', job_uuid: uuid };
    } catch (error) {
      console.log('Error in postJob', error);

      return { error: error.message };
    }
  }


  @Post('mark-old-jobs-inactive')
  @UseGuards(JwtAuthGuard)
  async markOldJobsInactive(@Req() req: any) {
    console.log('markOldJobsInactive');

    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
    console.log('Marking old jobs inactive in this function');
    const responseForAllJobs = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, {}, apiToken);
    console.log('responseForAllJobs:', responseForAllJobs);
    const jobs = responseForAllJobs?.data?.data?.jobs?.edges || [];

    const sortedJobs = jobs.sort((a, b) => {
      const dateA = new Date(a.node.createdAt);
      const dateB = new Date(b.node.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    // console.log('sortedJobs:', sortedJobs);
    for (let i = 0; i < sortedJobs.length; i++) {
      const jobId = sortedJobs[i].node.id;
      const isActive = sortedJobs[i].node.isActive;
      if (isActive && i >= 5) {
        console.log('Marking job inactive:', jobId);
        await this.staticGraphQLService.executeGraphQL(UpdateOneJob,
          {
            idToUpdate: jobId,
            input: {
              id: jobId,
              isActive: false
            }
          },
          apiToken
        );
      }
    }
  } 




  @Post('add-questions')
  @UseGuards(JwtAuthGuard)
  async addQuestions(@Req() request: any) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const data = request.body;
      const arxenaSiteId = data?.job_id;
      const jobName = data?.job_name;
      const jobObject: Job = await this.candidateWorkspaceGraphQLService.getJobDetails(
        arxenaSiteId,
        jobName,
        apiToken,
      );

      if (!jobObject?.id) {
        return {
          status: 'Failed',
          message: 'Job not found',
        };
      }

      const questions = Array.isArray(data?.questions) ? data.questions : [];
      const existingQuestions = await this.otherFieldsService.fetchJobChatQuestions(
        jobObject.id,
        apiToken,
      );

      console.log('Number Questions:', questions?.length);
      const mergedQuestions = mergeChatQuestionsPreservingOrder(
        existingQuestions,
        questions,
      );

      await this.otherFieldsService.updateJobChatQuestions(
        jobObject.id,
        mergedQuestions,
        apiToken,
      );

      return { status: 'success' };
    } catch (error) {
      console.log('Error in add questions', error);

      return { error: (error as Error).message };
    }
  }

  @Post('update-chat-questions')
  @UseGuards(JwtAuthGuard)
  async updateChatQuestions(@Req() request: any) {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { jobId, chatQuestions, previousQuestions } = request.body;

      if (!jobId || !Array.isArray(chatQuestions)) {
        return {
          status: 'Failed',
          message: 'jobId and chatQuestions are required',
        };
      }

      await this.otherFieldsService.updateJobChatQuestions(
        jobId,
        chatQuestions,
        apiToken,
        Array.isArray(previousQuestions) ? previousQuestions : [],
      );

      return { status: 'success' };
    } catch (error) {
      console.log('Error in update chat questions', error);

      return { error: (error as Error).message };
    }
  }

  @Post('update-candidate-field-value')
  @UseGuards(JwtAuthGuard)
  async updateCandidateFieldValue(@Req() request: any): Promise<object> {
    try {
      console.log("Going to update candidate field value::");
      console.log("request.body::", request.body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const { candidateId, fieldName, value } = request.body;

      if (!candidateId || !fieldName) {
        return {
          status: 'Failed',
          message: 'Missing required fields: candidateId or fieldName',
        };
      }

      const result = await this.candidateService.updateCandidateFieldValue(
        candidateId,
        fieldName,
        value,
        apiToken,
      );

      return {
        status: 'Success',
        message: 'Candidate field value updated successfully',
        result,
      };
    } catch (err) {
      console.error('Error updating candidate field value:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('update-candidate-field')
  @UseGuards(JwtAuthGuard)
  async updateCandidateField(@Req() request: any): Promise<object> {
    try {
      const origin = request.headers['x-origin-domain'] || request.headers.origin;
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const { candidateId, fieldName, value, personId } = request.body;
      

      if (!candidateId || !fieldName) {
        return {
          status: 'Failed',
          message: 'Missing required fields: candidateId or fieldName',
        };
      }

      const result = await this.candidateService.updateCandidateField(
        personId,
        candidateId,
        fieldName,
        value,
        apiToken,
        origin,
      );

      return {
        status: 'Success',
        message: 'Candidate field updated successfully',
        result,
      };

    } catch (err) {
      console.error('Error updating candidate field:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('get-candidate-fields-by-job')
  @UseGuards(JwtAuthGuard)
  async getCandidateFieldsByJob(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { jobId } = request.body;

      console.log('Fetching candidate fields for jobId:', jobId);

      const jobIdValidation = validateAndExtractJobId(jobId);
      if (!jobIdValidation.isValid) {
        return createJobIdErrorResponse(jobIdValidation.error!);
      }

      const actualJobId = jobIdValidation.jobId!;
      console.log('Using actual jobId:', actualJobId);

      const candidateFields = await this.candidateService.getCandidateFieldsByJobId(
        actualJobId,
        apiToken,
      );

      console.log(`Found ${candidateFields?.length || 0} candidate fields for job ${actualJobId}`);

      const formattedFields = candidateFields.map(field => ({
        name: field || '',
        label: field || '',
      }));

      formattedFields.push({
        name: 'jobTitle',
        label: 'jobTitle',
      });

      return {
        status: 'Success',
        candidateFields: formattedFields,
      };
    } catch (err) {
      console.error('Error fetching candidate fields by job:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('find-job')
  @UseGuards(JwtAuthGuard)
  async findJobByPathPosition(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const { path_position } = request.body;

    try {
      if (!path_position) {
        return {
          status: 'Failed',
          message: 'Missing required field: path_position',
        };
      }

      const job = await this.findJob(path_position, apiToken);

      return {
        status: 'Success',
        job: job,
      };
    } catch (err) {
      console.error('Error finding job by path position:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('update-job-in-arxena-and-sheets')
  @UseGuards(JwtAuthGuard)
  async updateJobInArxena(@Req() req: any): Promise<any> {
    console.log('going to update job in arxena');
    const apiToken = req.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    try {
      if (!req?.body?.job_name || !req?.body?.arxena_site_id) {
        throw new Error('Missing required fields: job_name or arxena_site_id');
      }

      console.log('this is the job name:', req.body.job_name);
      console.log('this is the arxena site id:', req.body.arxena_site_id);
      
      const response = await this.callUpdateJobInArxena(
        req.body.job_name,
        req.body.arxena_site_id,
        apiToken,
      );

      return {
        ...response?.data,
      };
    } catch (error) {
      console.log('Error in updateJobInArxena:', error);

      return { error: error.message };
    }
  }

  private async callUpdateJobInArxena(
    jobName: string,
    arxenaSiteId: string,
    apiToken: string,
  ): Promise<any> {
    try {
      console.log('going to update job in arxena');

      const url =
        process.env.ENV_NODE === 'production'
          ? 'https://arxena.com/update_one_job'
          : 'http://localhost:5050/update_one_job';
      
      console.log('url:', url);
      const response = await axios.post(
        url,
        { job_name: jobName, arxena_site_id: arxenaSiteId, },
        { headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`}},
      );
      console.log('response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error calling update job in Arxena:', error);
      return { data: error.message };
    }
  }

  // Helper function for exponential backoff retry
  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000,
  ): Promise<T> {
    let retryCount = 0;
    let delay = initialDelayMs;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error; // If we've hit max retries, throw the last error
        }

        // Calculate delay with exponential backoff (2^retryCount * initialDelay)
        delay = Math.min(initialDelayMs * Math.pow(2, retryCount), 10000); // Cap at 10 seconds
        console.log(`Retry ${retryCount} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  @Post('process-filter-description')
  @UseGuards(JwtAuthGuard)
  async processAiFilter(@Req() request: any): Promise<object> {
    try {
      const { filterDescription, candidateFields } = request.body;

      if (!filterDescription) {
        return {
          status: 'Failed',
          message: 'Missing required field: filterDescription',
        };
      }

      console.log(`Processing filter description: ${filterDescription}`);

      const filterConfig = await this.filterDescriptionProcessorService.generateSingleFilter(filterDescription);

      // Validate that the selected metadata fields are valid
      const validatedFields = this.filterDescriptionProcessorService.validateSelectedFields(
        filterConfig.selectedMetadataFields
      );

      if (validatedFields.length !== filterConfig.selectedMetadataFields.length) {
        console.warn('Some selected metadata fields were invalid and filtered out');
        filterConfig.selectedMetadataFields = validatedFields;
      }

      return {
        status: 'success',
        data: filterConfig,
      };
    } catch (err) {
      console.error('Error in process AI filter:', err);
      return {
        status: 'failed',
        error: err.message,
      };
    }
  }

  @Post('compute-tokens')
  @UseGuards(JwtAuthGuard)
  async computeTokens(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const aiFilters = request.body.aiFilters ?? request.body.enrichments;
      const selectedRecordIds = request.body.selectedRecordIds;
      const jobId = request.body.jobId;

      if (!aiFilters) {
        return {
          status: 'Failed',
          message: 'Missing required field: aiFilters',
        };
      }

      const jobIdValidation = validateAndExtractJobId(jobId);
      if (!jobIdValidation.isValid) {
        return createJobIdErrorResponse(jobIdValidation.error!);
      }

      const aiFiltersRequest = {
        aiFilters,
        selectedRecordIds,
        jobId: jobIdValidation.jobId!,
        objectNameSingular: '',
        availableSortDefinitions: [],
        availableFilterDefinitions: [],
        objectRecordId: '',
      };

      const tokenAnalysis = await this.aiFilteringService.computeTokens(
        aiFiltersRequest,
        apiToken
      );

      return {
        status: 'success',
        data: tokenAnalysis,
      };
    } catch (err) {
      console.error('Error computing tokens:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('test-snackbar')
  @UseGuards(JwtAuthGuard)
  async testSnackbar(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { recruiterId, message, variant } = request.body;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Missing required field: recruiterId',
        };
      }

      // Note: Test snackbar functionality is now handled via Redis pub-sub
      console.log('Test snackbar request received:', { recruiterId, message, variant });

      return {
        status: 'Success',
        message: 'Test snackbar event received (handled via pub-sub)',
      };
    } catch (err) {
      console.error('Error processing test snackbar:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('test-whatsapp-failure-notification')
  @UseGuards(JwtAuthGuard)
  async testWhatsAppFailureNotification(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { recruiterId, phoneNumber, message, error } = request.body;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Missing required field: recruiterId',
        };
      }

      // Note: WhatsApp failure notifications are now handled via Redis pub-sub
      const testData = {
        phoneNumber: phoneNumber || '918976372055',
        message: message || 'Test WhatsApp message',
        error: error || 'Connection timeout',
        timestamp: new Date().toISOString(),
        jid: `${phoneNumber || '918976372055'}@s.whatsapp.net`
      };

      console.log('Test WhatsApp failure notification received:', testData);

      return {
        status: 'Success',
        message: 'Test WhatsApp failure notification received (handled via pub-sub)',
        data: testData
      };
    } catch (err) {
      console.error('Error processing test WhatsApp failure notification:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('send-ai-filtering-progress')
  @UseGuards(JwtAuthGuard)
  async sendAiFilteringProgress(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { recruiterId, step, message, progress_percentage, total_records,
              processed_records, current_enrichment, total_enrichments, timestamp } = request.body;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Missing required field: recruiterId',
        };
      }

      console.log('AI filtering progress update received:', {
        recruiterId,
        step,
        message,
        progress_percentage,
        total_records,
        processed_records,
        current_enrichment,
        total_enrichments,
        timestamp
      });

      return {
        status: 'Success',
        message: 'AI filtering progress update received (handled via pub-sub)'
      };
    } catch (err) {
      console.error('Error processing AI filtering progress:', err);
      return {
        status: 'Failed',
        error: err.message
      };
    }
  }


  @Post('update-table-data')
  @UseGuards(JwtAuthGuard)
  async updateDataTable(@Req() request: any): Promise<object> {
    try {
      console.log("Going to update table data");
      console.log("request.body::", request.body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { recruiterId } = request.body;

      if (!recruiterId) {
        return {
          status: 'Failed', 
          message: 'Missing required field: recruiterId'
        };
      }

      // Note: Table data updates are now handled via Redis pub-sub
      console.log('Table data update request received for recruiter:', recruiterId);

      return {
        status: 'Success',
        message: 'Data table refresh request received (handled via pub-sub)'
      };

    } catch (err) {
      console.error('Error processing table data update:', err);
      return {
        status: 'Failed',
        error: err.message
      };
    }
  }




  @Post('send-notification-to-recruiter')
  @UseGuards(JwtAuthGuard)
  async sendNotificationToRecruiter(@Req() request: any): Promise<object> {
    try {
      console.log("Going to send notification to recruiter");
      console.log("request.body::", request.body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { message } = request.body;
      const origin = request.headers.origin;

      console.log('Origin in sendNotificationToRecruiter:', origin);

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Missing required field: recruiterId'
        };
      }
      
      console.log("recruiterId::", recruiterId);
      
      // Note: Notifications are now handled via Redis pub-sub
      console.log('Notification request received:', {
        recruiterId,
        message: message || 'Sending notification to recruiter',
        timestamp: new Date().toISOString()
      });

      return {
        status: 'Success',
        message: 'Notification request received (handled via pub-sub)'
      };
    } catch (err) {
      console.error('Error processing notification:', err);
      return {
        status: 'Failed',
        error: err.message
      };
    }
  }

  @Post('get-phone-number-status')
  @UseGuards(JwtAuthGuard)
  async getPhoneNumberStatus(@Req() request: any): Promise<object> {
    try {
      console.log('Getting phone number status');
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { phoneNumber, candidateId } = request.body;

      if (!phoneNumber) {
        return {
          status: 'Failed',
          message: 'Missing required field: phoneNumber',
        };
      }

      console.log(`Getting status for phone number: ${phoneNumber}, candidate ID: ${candidateId}`);

      // For now, return a basic status response
      // You can implement actual phone number status checking logic here
      const status = {
        phoneNumber: phoneNumber,
        candidateId: candidateId,
        status: 'active', // or whatever status logic you need
        lastSeen: new Date().toISOString(),
        isOnline: true, // or implement actual online status checking
      };

      return {
        status: 'Success',
        data: status,
      };
    } catch (err) {
      console.error('Error getting phone number status:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  @Post('update-candidate-status')
  @UseGuards(JwtAuthGuard)
  async updateCandidateStatus(@Req() request: any): Promise<object> {
    try {
      console.log("Going to update candidate status");
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { phone_number, candidate_status, candidate_id } = request.body;
      
      console.log(`Got phone number: ${phone_number}, status: ${candidate_status}, candidate_id: ${candidate_id}`);
      
      // Status mapping from labels to values (matching the STATUS_LABELS_REVERSE)
      const STATUS_LABELS_REVERSE = {
        'Not Interested': 'NOT_INTERESTED',
        'Interested': 'INTERESTED',
        'CV Received': 'CV_RECEIVED',
        'Not Fit': 'NOT_FIT',
        'Screening': 'SCREENING',
        'Recruiter Interview': 'RECRUITER_INTERVIEW',
        'CV Sent': 'CV_SENT',
        'Client Interview': 'CLIENT_INTERVIEW',
        'Negotiation': 'NEGOTIATION'
      };
      
      // Map status from label to value
      const status_value = STATUS_LABELS_REVERSE[candidate_status] || candidate_status;
      console.log(`Mapped status from '${candidate_status}' to '${status_value}'`);
      
      if (!candidate_id) {
        console.error("No candidate_id provided for status update");
        return {
          status: 'Failed',
          message: 'Missing required field: candidate_id'
        };
      }
      
      // Use the imported GraphQL mutation
      
      // Prepare the GraphQL variables
      const variables = {
        idToUpdate: candidate_id,
        input: {
          status: status_value
        }
      };
      
      console.log("Making GraphQL request to update candidate status:", { variables });
      
      // Make the GraphQL request
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate, 
        variables, 
        apiToken
      );
      
      if (response?.data?.data?.updateCandidate) {
        console.log("Successfully updated candidate status in Twenty:", response.data);
        
        return {
          status: 'Success',
          candidate_id: candidate_id,
          candidate_status: status_value,
          message: 'Candidate status updated successfully in Twenty'
        };
      } else {
        console.error("Failed to update candidate status in Twenty:", response);
        return {
          status: 'Failed',
          message: 'Failed to update candidate status',
          error: response?.data?.errors || 'Unknown error'
        };
      }
      
    } catch (err) {
      console.error('Error updating candidate status:', err);
      return {
        status: 'Failed',
        error: err.message
      };
    }
  }

  @Post('get_user_obj')
  @UseGuards(JwtAuthGuard)
  async getUserObj(@Req() request: any): Promise<object> {
    try {

      console.log("Going to get user object", 'CandidateSourcingController');
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const origin = request.headers['x-origin-domain'] || request.headers.origin;


      let chromeExtensionId = 'najjmciobphkllanmfgffjjjcbejnbci'; // default
      
      // Extract extension ID from origin if it's a chrome extension
      if (origin && origin.startsWith('chrome-extension://')) {
        chromeExtensionId = origin.replace('chrome-extension://', '');
      }
      console.log(`chromeExtensionId in getUserObj: ${chromeExtensionId}`, 'CandidateSourcingController');
      // Get current user data using the same approach as RecruiterProfileService
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      // Get all jobs for the user using staticGraphQLService
      const responseFromGetAllJobs = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyJobs,
        { filter: { isActive: { eq: true } }, limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
        apiToken,
      );
      const jobs = responseFromGetAllJobs?.data?.data?.jobs?.edges || [];

      // Use the workspace member data from currentUser instead of separate query
      const workspaceMember = currentUser?.workspaceMember;

      // Create a mock recruiter profile from the workspace member data
      const recruiterProfile = workspaceMember ? {
        id: workspaceMember.id,
        phoneNumber: '+1234567890', // Default phone number since it's not in workspaceMember
        name: `${workspaceMember.name?.firstName || ''} ${workspaceMember.name?.lastName || ''}`.trim(),
        email: workspaceMember.userEmail,
        jobTitle: 'Recruiter', // Default job title
        companyName: currentUser?.currentWorkspace?.displayName || 'Arxena',
        companyDescription: 'Recruitment Company',
        linkedinUrl: '',
        firstName: workspaceMember.name?.firstName || '',
        lastName: workspaceMember.name?.lastName || '',
        typeWorkspaceMember: 'MEMBER'
      } : null;

      // Map jobs to the expected format
      const mappedJobs = jobs.map((jobEdge: any) => {
        const job = jobEdge.node;
        return {
          user_id: currentUser?.id || 'dummy_user_id',
          job_id: job.id,
          job_name: job.name,
          jobCode: job.jobCode || '',
          job_company_name: job.name, // Using job name as company name for now
          job_company_id: job.pathPosition || 'dummy_company_id',
          sublists: [{
            sublist_name: job.name,
            sublist_id: job.id,
            created_date: job.createdAt
          }],
          start_date: job.createdAt,
          status: job.isActive ? 'active' : 'inactive',
          hot_columns: this.getDefaultHotColumns(),
          statuses: this.getDefaultStatuses()
        };
      });

      // Create the user object matching the expected structure
      const userObj = {
        _id: currentUser?.id || 'dummy_user_id',
        full_name: recruiterProfile?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Dummy User',
        email: currentUser?.email || 'dummy@example.com',
        phone: recruiterProfile?.phoneNumber || '+1234567890',
        token: 'some',
        origin: currentUser?.currentWorkspace?.subdomain || 'colorful-panther',
        currentWorkspaceMemberId: currentUser?.workspaceMember?.id || 'dummy_workspace_member_id',
        twentyId: currentUser?.id || 'dummy_twenty_id',
        currentWorkspaceId: currentUser?.currentWorkspace?.id || 'dummy_workspace_id',
        plan: {
          credits: 0,
          queries: 10,
          customer_status: 'plan_0',
          plan: 'plan_0'
        },
        grouped_users: [],
        registration_ip_address: '127.0.0.1',
        reg_timestamp: currentUser?.createdAt || new Date().toISOString(),
        ipinfo_resp: {},
        stripe_customer_id: 'cus_dummy_customer_id',
        twenty_api_key: apiToken,
        jobs: mappedJobs,
        chrome_extension_id: chromeExtensionId,
        all_jobs: mappedJobs.map(job => ({
          user_id: job.user_id,
          job_id: job.job_id,
          job_name: job.job_name,
          start_date: job.start_date,
          status: job.status
        }))
      };


      return {
        status: 'successful_fid',
        user_obj: userObj
      };
    } catch (err) {
      console.error('Error in getUserObj:', err);
      return {
        status: 'Failed',
        error: err.message
      };
    }
  }

  /**
   * Persists the Chrome extension ID on the current user's workspaceMemberProfile
   * (candidate engagement / extension flows). Body key: chromeextensionId (also accepts chromeExtensionId, extension_id).
   */
  @Post('set-chrome-extension-id')
  @UseGuards(JwtAuthGuard)
  async setChromeExtensionId(@Req() request: any): Promise<object> {
    console.log("Going to set chrome extension id", 'CandidateSourcingController');
    try {
      const apiToken = request.headers.authorization
        .split(' ')[1]
        .replace(/[\r\n]+/g, '');
      const rawBody = request.body ?? {};
      let chromeExtensionId = '';
      if (typeof rawBody.chromeextensionId === 'string') {
        chromeExtensionId = rawBody.chromeextensionId.trim();
      }
      if (!chromeExtensionId && typeof rawBody.chromeExtensionId === 'string') {
        chromeExtensionId = rawBody.chromeExtensionId.trim();
      }
      if (!chromeExtensionId && typeof rawBody.extension_id === 'string') {
        chromeExtensionId = rawBody.extension_id.trim();
      }

      if (!chromeExtensionId) {
        return {
          status: 'Failed',
          message:
            'Missing chromeextensionId (or chromeExtensionId / extension_id)',
        };
      }

      const origin =
        request.headers['x-origin-domain'] || request.headers.origin || '';

      const currentUser = await new RecruiterProfileService(
        this.staticGraphQLService,
      ).getCurrentUser(apiToken, origin);
      const workspaceMemberId = currentUser?.workspaceMember?.id;
      if (!workspaceMemberId) {
        return {
          status: 'Failed',
          message: 'No workspace member on current user',
        };
      }

      const profilesResponse = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: workspaceMemberId } } },
        apiToken,
      );
      const profileId =
        profilesResponse?.data?.data?.workspaceMemberProfiles?.edges?.[0]?.node
          ?.id;

      if (!profileId) {
        return {
          status: 'Failed',
          message: 'Workspace member profile not found for current user',
        };
      }

      const updateResponse = await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profileId,
          input: { chromeExtensionId },
        },
        apiToken,
      );

      const updated =
        updateResponse?.data?.data?.updateWorkspaceMemberProfile?.id;
      const gqlErrors = updateResponse?.data?.errors;

      if (!updated || gqlErrors?.length) {
        console.error(
          'setChromeExtensionId GraphQL error:',
          gqlErrors ?? updateResponse?.data,
        );
        return {
          status: 'Failed',
          message: 'Failed to update workspace member profile',
          error: gqlErrors ?? updateResponse?.data,
        };
      }

      return {
        status: 'Success',
        workspaceMemberProfileId: updated,
        chromeExtensionId,
      };
    } catch (err) {
      console.error('Error in setChromeExtensionId:', err);
      return {
        status: 'Failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private getDefaultHotColumns() {
    return [
      // { type: 'text', data: 'Remarks', width: 110, title: 'Remarks', id: 1 },
      // { type: 'text', data: 'full_name', width: 110, title: 'Name', id: 2 },
      // { type: 'text', data: 'job_company_name', width: 110, title: 'Company', id: 3 },
      // { type: 'text', data: 'job_title', width: 180, title: 'Job Title', id: 4 },
      // { type: 'text', data: 'std_function', width: 90, title: 'Function', id: 5, className: 'htCenter' },
      // { type: 'text', data: 'std_grade', width: 75, title: 'Grade', id: 6, className: 'htCenter' },
      // { type: 'text', data: 'profile_url', width: 80, title: 'Profile URL', id: 7, renderer: 'html', className: 'htCenter' },
      // { type: 'dropdown', data: 'current_status', title: 'Status', source: ['Sourced', 'Enriched', 'Contacted', 'Disinterested', 'Interested', 'On Hold', 'CV Sent', 'Client Interview', 'Joined'], width: 120, id: 8, className: 'htCenter' },
      // { type: 'text', data: 'std_function_root', width: 100, title: 'Func Root', id: 9, className: 'htCenter' },
      // { type: 'text', data: 'profile_title', width: 200, title: 'Profile Intro', id: 10 },
      // { type: 'text', data: 'skills', width: 250, title: 'Skills', id: 11 },
      // { type: 'text', title: 'Education Institute Ug', data: 'education_institute_ug', width: 110, id: 12 },
      // { type: 'text', title: 'Education Institute Pg', data: 'education_institute_pg', width: 110, id: 13 },
      // { type: 'text', data: 'phone_numbers', width: 110, title: 'Mobile Phone', id: 14 },
      // { type: 'text', data: 'email_address', width: 100, title: 'E-mail Address', id: 15 },
      // { type: 'numeric', data: 'inferred_salary', width: 70, title: 'Salary', id: 16, className: 'htCenter' },
      // { type: 'numeric', data: 'inferred_years_experience', width: 70, title: 'Experience', id: 17, className: 'htCenter' },
      // { type: 'numeric', data: 'priority', width: 50, title: 'Priority', id: 18, className: 'htCenter' },
      // { type: 'text', data: 'location_name', width: 90, title: 'Location', id: 19 },
      // { type: 'text', data: 'std_location', width: 100, title: 'Std. Location', id: 20 },
      // { type: 'text', data: 'notice_period', width: 90, title: 'Notice Period', id: 21 },
      // { type: 'text', data: 'resume_link', width: 80, title: 'Resume URL', id: 22, renderer: 'html', className: 'htCenter' },
      // { type: 'text', data: 'naukri_search_url', width: 80, title: 'Naukri Search URL', id: 23, renderer: 'html', className: 'htCenter' },
      // { type: 'numeric', data: 'distance_from_location', width: 60, title: 'Distance from Location', id: 24 },
      // { type: 'numeric', data: 'distance_from_job', width: 60, title: 'Distance from Job', id: 25 },
      // { type: 'text', data: 'job_company_id', width: 60, title: 'Org Chart', id: 26 },
      // { type: 'text', data: 'std_company_name', width: 60, title: 'Company Name', id: 27 },
      // { type: 'numeric', data: 'current_role_tenure', width: 60, title: 'Current Role Tenure', id: 28 },
      // { type: 'numeric', data: 'total_tenure', width: 60, title: 'Total Tenure', id: 29 },
      // { type: 'numeric', data: 'total_job_changes', width: 60, title: 'Total Job Changes', id: 30 },
      // { type: 'numeric', data: 'average_tenure', width: 60, title: 'Average Tenure', id: 31 },
      // { type: 'numeric', data: 'count_promotions', width: 60, title: 'Count Promotions', id: 32 },
      // { type: 'numeric', data: 'job_company_linkedin_url', width: 60, title: 'Employees in Function', id: 33, renderer: 'html' },
      // { type: 'numeric', data: 'count_org', width: 60, title: 'Employees in Company', id: 34 },
      // { type: 'numeric', data: 'employees_at_location', width: 60, title: 'Employees at Location', id: 35 },
      // { type: 'numeric', data: 'current_salary', width: 60, title: 'Salary', id: 36, className: 'htCenter' },
      // { type: 'numeric', data: 'years_of_experience', width: 60, title: 'Experience', id: 37, className: 'htCenter' },
      // { type: 'text', data: 'industry', width: 60, title: 'Industry', id: 38 },
      // { type: 'text', data: 'nationality', width: 60, title: 'Nationality', id: 39 },
      // { type: 'text', data: 'year_of_passing', width: 60, title: 'Year Of Passing', id: 40 },
      // { type: 'text', data: 'blank_3', width: 60, title: 'Blank_3', id: 41 },
      // { type: 'numeric', data: 'data_source', width: 60, title: 'Source', id: 42 },
      // { type: 'numeric', data: 'upload_count', width: 50, title: 'Pull ID', id: 43, className: 'htCenter' },
      // { type: 'text', data: 'last_updated', width: 115, title: 'Last Updated', readOnly: 1, editor: 0, id: 44 },
      // { type: 'text', data: 'first_name', width: 60, title: 'First Name', id: 45 },
      // { type: 'text', data: 'last_name', width: 60, title: 'Last Name', id: 46 },
      // { type: 'text', data: 'job_name', width: 80, title: 'Job', id: 47, readOnly: 1, editor: 0, className: 'htCenter' },
      // { type: 'text', data: '_id', width: 60, title: 'ID', readOnly: 1, editor: 0, id: 48 },
      // { type: 'text', data: 'uniqueStringKey', width: 60, title: 'uniqueStringKey', readOnly: 1, editor: 0, id: 49 }
    ];
  }

  private getDefaultStatuses() {
    return [
      { status_name: 'Sourced', status_value: 'sourced', progress_value: 1 },
      { status_name: 'Enriched', status_value: 'enriched', progress_value: 2 },
      { status_name: 'Contacted', status_value: 'contacted', progress_value: 3 },
      { status_name: 'Disinterested', status_value: 'disinterested', progress_value: 4 },
      { status_name: 'Interested', status_value: 'interested', progress_value: 5 },
      { status_name: 'On Hold', status_value: 'on_hold_by_recruiter', progress_value: 6 },
      { status_name: 'CV Sent', status_value: 'on_hold_by_recruiter', progress_value: 7 },
      { status_name: 'Client Interview', status_value: 'client_interview', progress_value: 8 },
      { status_name: 'Joined', status_value: 'joined', progress_value: 9 }
    ];
  }

  @Post('update-contact')
  @UseGuards(JwtAuthGuard)
  async updateContact(@Req() request: any): Promise<object> {
    try {
      console.log('This is the request in update contact:', request.body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const contactData = request.body || {};
      const origin = request.headers['x-origin-domain'] || request.headers.origin;
      console.log('This is the data in update contact:', contactData);
      
      // Check if this is a direct download (skip processing if true)
      const directDownload = contactData.direct_download || false;
      console.log('This is the direct_download in update contact:', directDownload);
      
      if (!directDownload) {
        // Process the contact data using candidateService
        // This is similar to the Flask implementation's update_contact_with_contact_data
        await this.candidateService.processContactData(contactData, origin, apiToken);
      } else {
        console.log('Ignoring the update of contact as direct_download is true');
      }
      
      const responseObj = {
        status: 'success'
      };
      
      console.log('This is the response_obj from update_contact:', responseObj);
      return responseObj;
      
    } catch (error) {
      console.error('Error in update-contact:', error);
      return {
        status: 'fail',
        message: 'Failed to update contact',
        error: error.message
      };
    }
  }

  @Post('test-cv-upload')
  @UseGuards(JwtAuthGuard)
  async testCvUpload(@Req() request: any): Promise<object> {
    console.log('Test CV upload endpoint reached');
    console.log('Request body:', request.body);
    console.log('Authorization header:', request.headers.authorization);
    return { status: 'success', message: 'Test endpoint reached' };
  }

  @Post('test-cv-upload-no-auth')
  async testCvUploadNoAuth(@Req() request: any): Promise<object> {
    console.log('Test CV upload endpoint reached (no auth)');
    console.log('Request body:', request.body);
    return { status: 'success', message: 'Test endpoint reached (no auth)' };
  }

  @Post('test-file-upload-no-auth')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    storage: multer.memoryStorage(), // Store in memory temporarily
    fileFilter: (req, file, callback) => {
      console.log('Multer file filter called (no auth):', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
      callback(null, true);
    }
  }))
  async testFileUploadNoAuth(
    @Req() request: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<object> {
    console.log('Test file upload endpoint reached (no auth)');
    console.log('Request body:', request.body);
    console.log('File:', file);
    return { status: 'success', message: 'Test file upload reached (no auth)', file: file?.originalname };
  }

  @Post('update-contact-with-cv-no-auth')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    storage: multer.memoryStorage(), // Store in memory temporarily
    fileFilter: (req, file, callback) => {
      console.log('Multer file filter called (no auth):', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
      callback(null, true);
    }
  }))
  async updateContactWithCvNoAuth(
    @Req() request: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<object> {
    try {
      console.log('Received direct CV upload from extension hit update-contact-with-cv-no-auth');
      
      if (!file) {
        console.error('No file provided in request');
        return {
          status: 'error',
          message: 'No file provided'
        };
      }

      console.log('Request body:', request.body);
      console.log('File details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });
      
      return {
        status: 'success',
        message: 'CV upload test successful (no auth)',
        file: file.originalname,
        candidateData: request.body.candidate_data,
        uniqueStringKey: request.body.uniqueStringKey
      };
      
    } catch (error) {
      console.error('Error processing CV upload test:', error);
      return {
        status: 'error',
        message: error.message || 'Failed to process CV upload test',
        details: error.stack
      };
    }
  }

  @Post('update-contact-with-cv')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    storage: multer.memoryStorage(), // Store in memory temporarily
    fileFilter: (req, file, callback) => {
      console.log('Multer file filter called:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
      callback(null, true);
    }
  }))
  async updateContactWithCv(
    @Req() request: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<object> {
    try {
      console.log('Received direct CV upload from extension hit update-contact-with-cv');
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      console.log('Request headers:', request.headers);
      console.log('Request body:', request.body);
      console.log('Request body x-origin-domain:', request.body['x-origin-domain']);
      if (!request.headers['x-origin-domain']) {
      // Check if 'x-origin-domain' is present in the form fields in addition to headers
      if (!request.headers['x-origin-domain'] && request.body['x-origin-domain']) {
        request.headers['x-origin-domain'] = request.body['x-origin-domain'];
      }
      }
      const origin = request.headers['x-origin-domain'] || request.headers.origin || '';
      console.log('Origin in updateContactWithCv:', origin);
      if (!file) {
        console.error('No file provided in request');
        return {
          status: 'error',
          message: 'No file provided'
        };
      }

      let candidateData: any = {};
      let uniqueStringKey = '';
      let profileDataStr = '';
      // Optional Resdex identity fields (used to avoid attaching wrong contact to CV)
      let resdex_key: string | undefined;
      let resdex_encryptedResId: string | undefined;
      let resdex_doubleEncryptedUserName: string | undefined;
      let resdex_download_resId: string | undefined;
      let resdex_download_uname: string | undefined;
      
      try {
        const candidateDataStr = request.body.candidate_data || '{}';
        candidateData = JSON.parse(candidateDataStr);
        uniqueStringKey = request.body.uniqueStringKey || '';
        profileDataStr = request.body.profile_data;

        // Extract Resdex identity fields when present
        resdex_key = candidateData.resdex_key;
        resdex_encryptedResId = candidateData.resdex_encryptedResId;
        resdex_doubleEncryptedUserName = candidateData.resdex_doubleEncryptedUserName;
        resdex_download_resId = candidateData.resdex_download_resId;
        resdex_download_uname = candidateData.resdex_download_uname;
      } catch (parseError) {
        console.error('Error parsing form data:', parseError);
        return {
          status: 'error',
          message: 'Invalid form data format',
          error: parseError.message
        };
      }
      
      let jobName = 'default_job';
      let jobProcess = {};
      
      // Process profile data if provided
      if (profileDataStr) {
        try {
          const profileData = JSON.parse(profileDataStr);
          const directDownload = profileData.direct_download || false;
          console.log('This is the profileData:', profileData);
          console.log('This is the direct_download in updateContactWithCv:', directDownload);
          // Extract job name from popup_data
          if (profileData.popup_data?.job_name) {
            jobName = profileData.popup_data.job_name;
          }
          
          if (!directDownload) {
            console.log('This is the direct_download in updateContactWithCv if condition:', directDownload);
            const contactData = {
              json_data: profileData.json_data || '{}',
              popup_data: profileData.popup_data || {},
              data_source: profileData.data_source || ''
            };
            await this.candidateService.processContactData(contactData, origin, apiToken);
          } else {
            // Even for direct downloads, ensure candidate exists in the specified job
            // This ensures CV uploads are associated with the correct job
            console.log('Direct download detected, but ensuring candidate exists in specified job');
            const contactData = {
              json_data: profileData.json_data || '{}',
              popup_data: profileData.popup_data || {},
              data_source: profileData.data_source || '',
              direct_download: true,
            };
            // Process contact data to ensure candidate is created/updated in the job
            // This is important for CV uploads to be associated with the correct job
            await this.candidateService.processContactData(contactData, origin,   apiToken);
            // Add a small delay to allow candidate creation/update to complete
            // This ensures the candidate exists in the job before CV upload
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Extract job info from profile data
          const jsonDataStr = profileData.json_data || '{}';
          const jsonData = JSON.parse(jsonDataStr);
          // If profileData contains more accurate Resdex identity, prefer it
          if (!resdex_key && jsonData.resdex_key) {
            resdex_key = jsonData.resdex_key;
          }
          if (!resdex_encryptedResId && jsonData.resdex_encryptedResId) {
            resdex_encryptedResId = jsonData.resdex_encryptedResId;
          }
          if (!resdex_doubleEncryptedUserName && jsonData.resdex_doubleEncryptedUserName) {
            resdex_doubleEncryptedUserName = jsonData.resdex_doubleEncryptedUserName;
          }
          const profileUrl = jsonData.profile_url || jsonData.window_url;
          if (profileUrl) {
            console.log('Profile URL found:', profileUrl);
          }
          
        } catch (error) {
          console.error('Error extracting job info from profile data:', error);
          // Continue processing even if profile data parsing fails
        }
      }
      
      // Use job name from candidate data if not found in profile
      if (!jobName || jobName === 'default_job') {
        jobName = candidateData.job_name || 'default_job';
      }
      
      // Generate unique string key if not provided
      
      // Get workspace information
      let workspaceId;
      try {
        workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        if (!workspaceId) {
          throw new Error('Could not get workspace ID from token');
        }
      } catch (error) {
        console.error('Error getting workspace ID:', error);
        return {
          status: 'error',
          message: 'Failed to get workspace information',
          error: error.message
        };
      }
      
      const fileName = file.originalname || request.body.file_name || `cv_${uniqueStringKey}.pdf`;
      const filePath = `workspace-${workspaceId}/client_uploads/client_cv_uploads/${jobName}/${fileName}`;
      
      try {
        // Ensure the file buffer is valid
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error('File buffer is empty or invalid');
        }

        await this.fileStorageService.write({
          file: file.buffer as Uint8Array,
          name: fileName,
          mimeType: file.mimetype,
          folder: `workspace-${workspaceId}/client_uploads/client_cv_uploads/${jobName}`,
        });
        console.log(
          `Saved CV file to storage: workspace-${workspaceId}/client_uploads/client_cv_uploads/${jobName}/${fileName}`,
        );
      } catch (fileError) {
        console.error('Error saving file:', fileError);
        return {
          status: 'error',
          message: 'Failed to save file',
          error: fileError.message
        };
      }
      
      // Process the contact data - use profileData if available, otherwise fallback to candidateData
      let contactData: any;
      let profileUrl = '';
      
      // Prepare popup_data with job information
      let popupData: any = {};
      if (profileDataStr) {
        try {
          const profileData = JSON.parse(profileDataStr);
          popupData = profileData.popup_data || {};
        } catch (error) {
          console.warn('Error parsing profileData for popup_data:', error);
        }
      }
      
      // Add job information to popup_data if not already present
      if (!popupData.job_name && jobName && jobName !== 'default_job') {
        popupData.job_name = jobName;
      }
      if (!popupData.twenty_job_id && !popupData.job_id && candidateData.job_id) {
        popupData.twenty_job_id = candidateData.job_id;
      }
      if (!popupData.recruiterId) {
        try {
          const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService)
            .getRecruiterProfileFromCurrentUser(apiToken, origin);
          if (recruiterProfile?.workspaceMemberId) {
            popupData.recruiterId = recruiterProfile.workspaceMemberId;
          }
        } catch (error) {
          console.warn('Could not get recruiter ID for popup_data:', error);
        }
      }
      
      if (profileDataStr) {
        try {
          const profileData = JSON.parse(profileDataStr);
          const jsonDataStr = profileData.json_data || '{}';
          const jsonData = JSON.parse(jsonDataStr);
          profileUrl = jsonData.profile_url || jsonData.candidate_profile || '';
          
          contactData = {
            profile_url: profileUrl,
            json_data: jsonDataStr,
            popup_data: popupData // Include popup_data with job information
          };
        } catch (error) {
          console.error('Error parsing profileData for contact processing:', error);
          // Fallback to candidateData
          profileUrl = candidateData.profile_url || '';
          contactData = {
            profile_url: profileUrl,
            json_data: JSON.stringify(candidateData),
            popup_data: popupData // Include popup_data with job information
          };
        }
      } else {
        // Fallback to candidateData if no profileData
        profileUrl = candidateData.profile_url || '';
        console.log('Using candidateData for contact processing, profile_url:', profileUrl);
        
        contactData = {
          profile_url: profileUrl,
          json_data: JSON.stringify(candidateData),
          popup_data: popupData // Include popup_data with job information
        };
      }

      // If Resdex identity says this CV/contact pairing is unsafe, strip phone/email from json_data
      if (resdex_encryptedResId && resdex_download_resId && resdex_encryptedResId !== resdex_download_resId) {
        try {
          const parsed = JSON.parse(contactData.json_data || '{}');
          if (parsed.phone_number || parsed.email_address) {
            console.warn(
              '[updateContactWithCv] Resdex encryptedResId mismatch for CV upload. ' +
              'Removing phone_number and email_address from contact data to avoid wrong merge.'
            );
            delete parsed.phone_number;
            delete parsed.email_address;
            contactData.json_data = JSON.stringify(parsed);
          }
        } catch (stripError) {
          console.warn('[updateContactWithCv] Failed to strip phone/email on identifier mismatch:', stripError);
        }
      }
      
      
      // Process the CV upload with error handling
      try {
        await this.candidateService.processCvUploadToTwenty(
          contactData,
          filePath,
          uniqueStringKey,
          apiToken,
          origin
        );
        console.log('CV processing completed successfully');
      } catch (cvError) {
        console.error('Error processing CV:', cvError);
        return {
          status: 'error',
          message: 'CV saved to storage but failed to attach to candidate',
          error: cvError instanceof Error ? cvError.message : String(cvError),
          file_path: filePath,
          uniqueStringKey,
        };
      }
      
      // Update table data with error handling
      try {
        const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService)
            .getRecruiterProfileFromCurrentUser(apiToken, origin);
        
        await this.candidateService.updateTableData(recruiterProfile?.workspaceMemberId || workspaceId, apiToken);
        console.log('[CV-Upload] Update table data completed');
      } catch (error) {
        console.error('[CV-Upload] Error updating table data:', error);
        // Don't fail the whole request if table update fails
      }
      
      // Return response similar to original update_contact
      const responseObj = {
        status: 'success',
        message: 'CV uploaded and processed successfully',
        file_path: filePath,
        uniqueStringKey: uniqueStringKey
      };
      
      // Add job info to response if available
      if (jobName && jobName !== 'default_job') {
        responseObj['job_name'] = jobName;
      }
      if (Object.keys(jobProcess).length > 0) {
        responseObj['job_process'] = jobProcess;
      }
      
      console.log('CV upload completed successfully:', responseObj);
      return responseObj;
      
    } catch (error) {
      console.error('Error processing CV upload:', error);
      return {
        status: 'error',
        message: error.message || 'Failed to process CV upload',
        details: error.stack
      };
    }
  }

  @Post('chatkit-session')
  @UseGuards(JwtAuthGuard)
  async createChatKitSession(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { workflowId, userId } = request.body;

      if (!workflowId) {
        return {
          status: 'Failed',
          message: 'Missing required field: workflowId',
        };
      }

      // Use OpenAI API to create a ChatKit session
      const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
      
      if (!openaiApiKey) {
        return {
          status: 'Failed',
          message: 'OpenAI API key not configured',
        };
      }

      // Generate a device/user ID if not provided
      const deviceId = userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chatkit/sessions',
          {
            workflow: { id: workflowId },
            user: deviceId,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'chatkit_beta=v1',
              Authorization: `Bearer ${openaiApiKey}`,
            },
          }
        );

        return {
          status: 'Success',
          client_secret: response.data.client_secret,
        };
      } catch (openaiError: any) {
        console.error('Error creating ChatKit session:', openaiError.response?.data || openaiError.message);
        return {
          status: 'Failed',
          message: 'Failed to create ChatKit session',
          error: openaiError.response?.data?.error?.message || openaiError.message,
        };
      }
    } catch (err) {
      console.error('Error in createChatKitSession:', err);
      return {
        status: 'Failed',
        error: err.message,
      };
    }
  }

  /**
   * Update contact information from enrichment results.
   * POST /candidate-sourcing/update-contact-from-enrichment
   */
  @Post('update-contact-from-enrichment')
  @UseGuards(JwtAuthGuard)
  async updateContactFromEnrichment(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { linkedinUrl, emails, phones, jobId, jobName, candidateId } = request.body;

      if (!linkedinUrl) {
        return {
          status: 'error',
          message: 'linkedinUrl is required',
        };
      }

      // Note: jobId/jobName is optional - required for org chart, optional for DataTable/Chrome Extension

      // Find candidates by profile URL, scoped to jobId if provided
      let candidates: any[] = [];
      if (candidateId) {
        // If candidateId is provided directly, use it
        // Note: getCandidateDetails may not exist, so we'll use findCandidatesByProfileUrl
        const foundCandidates = await this.candidateService.findCandidatesByProfileUrl(linkedinUrl, apiToken);
        if (foundCandidates.length > 0) {
          const foundCandidate = foundCandidates.find((c: any) => c.id === candidateId);
          candidates = foundCandidate ? [foundCandidate] : [];
        }
      } else {
        // Find by profile URL within the job
        candidates = await this.candidateService.findCandidatesByProfileUrl(linkedinUrl, apiToken);
        
        // Filter by jobId if provided
        if (jobId && candidates.length > 0) {
          // Get job details to verify candidates belong to this job
          const job = await this.candidateWorkspaceGraphQLService.getJobDetails(jobId, '', apiToken);
          if (job) {
            // Filter candidates that belong to this job
            // Note: This assumes candidates have a jobsId field or similar
            // You may need to adjust this based on your data model
            candidates = candidates.filter((c: any) => {
              // Check if candidate belongs to the job
              // This is a simplified check - adjust based on your schema
              return true; // For now, accept all candidates found
            });
          }
        }
      }

      if (!candidates || candidates.length === 0) {
        return {
          status: 'error',
          message: 'Candidate not found. Please save the candidate to a job first using upload-profiles.',
        };
      }

      // Update email and phone for each candidate
      for (const candidate of candidates) {
        const personId = candidate.peopleId || null;

        // Update email if provided
        if (emails && Array.isArray(emails) && emails.length > 0) {
          const primaryEmail = emails[0];
          const additionalEmails = emails.slice(1);
          
          await this.candidateService.handleEmailUpdateWithStructure(
            candidate.id,
            personId,
            {
              primaryEmail,
              additionalEmails,
            },
            apiToken,
          );
        }

        // Update phone if provided
        if (phones && Array.isArray(phones) && phones.length > 0) {
          const phoneNumber = phones[0];
          await this.candidateService.updateCandidateField(
            personId || '',
            candidate.id,
            'phoneNumber',
            phoneNumber,
            apiToken,
            'contact_enrichment',
          );
        }
      }

      return {
        status: 'success',
        message: 'Contact information updated successfully',
        updatedCandidates: candidates.length,
      };
    } catch (error) {
      console.error('Error updating contact from enrichment:', error);
      return {
        status: 'error',
        message: error.message || 'Failed to update contact information',
      };
    }
  }

  /**
   * Check which LinkedIn URLs have saved candidates.
   * GET /candidate-sourcing/candidates/by-linkedin-urls?linkedinUrls=...&jobId=...
   */
  @Get('candidates/by-linkedin-urls')
  @UseGuards(JwtAuthGuard)
  async getCandidatesByLinkedInUrls(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const linkedinUrls = request.query.linkedinUrls
        ? (Array.isArray(request.query.linkedinUrls)
            ? request.query.linkedinUrls
            : request.query.linkedinUrls.split(','))
        : [];
      const jobId = request.query.jobId;

      if (!linkedinUrls || linkedinUrls.length === 0) {
        return {
          status: 'error',
          message: 'linkedinUrls query parameter is required',
        };
      }

      const results: Record<string, { saved: boolean; candidateIds?: string[]; jobIds?: string[] }> = {};
      const isNonEmptyString = (value: unknown): value is string =>
        typeof value === 'string' && value.length > 0;

      for (const linkedinUrl of linkedinUrls) {
        try {
          const candidates = await this.candidateService.findCandidatesByProfileUrl(
            linkedinUrl,
            apiToken,
          );

          if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map((c: any) => c.id);
            // Extract job IDs from candidates if available
            const jobIds = candidates
              .map((c: any) => getCandidateJobIdForByLinkedInUrls(c as Record<string, unknown>))
              .filter(isNonEmptyString);

            // Filter by jobId if provided
            if (jobId) {
              const filteredCandidates = candidates.filter(
                (c: any) =>
                  getCandidateJobIdForByLinkedInUrls(c as Record<string, unknown>) === jobId,
              );
              results[linkedinUrl] = {
                saved: filteredCandidates.length > 0,
                candidateIds:
                  filteredCandidates.length > 0
                    ? filteredCandidates.map((c: any) => c.id)
                    : undefined,
                jobIds:
                  filteredCandidates.length > 0
                    ? filteredCandidates
                        .map((c: any) =>
                          getCandidateJobIdForByLinkedInUrls(c as Record<string, unknown>),
                        )
                        .filter(isNonEmptyString)
                    : undefined,
              };
            } else {
              results[linkedinUrl] = {
                saved: true,
                candidateIds,
                jobIds: jobIds.length > 0 ? jobIds : undefined,
              };
            }
          } else {
            results[linkedinUrl] = {
              saved: false,
            };
          }
        } catch (error) {
          console.error(`Error checking candidates for ${linkedinUrl}:`, error);
          results[linkedinUrl] = {
            saved: false,
          };
        }
      }

      return {
        status: 'success',
        results,
      };
    } catch (error) {
      console.error('Error getting candidates by LinkedIn URLs:', error);
      return {
        status: 'error',
        message: error.message || 'Failed to check candidates',
      };
    }
  }

  @Post('get-queries-and-mutations')
  async getQueriesAndMutations(): Promise<object> {
    const allQueries = {
      queries: queries,
      mutations: mutations,
    };
    return allQueries;
  }

  @Post('search-candidates-sql')
  @UseGuards(JwtAuthGuard)
  async searchCandidates(@Req() request: any) {
    try {
      const startTime = performance.now();
      let lastStepTime = startTime;
      const timings: Record<string, number> = {};
      const body = request.body;
      const token = request.headers.authorization.split(' ')[1].replace(/\r|\n/g, '');
      const payload = await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      timings['extract_and_token'] = performance.now() - lastStepTime;
      lastStepTime = performance.now();

      if (!body.filter?.jobsId?.in || !Array.isArray(body.filter.jobsId.in)) {
        throw new HttpException('Invalid jobsId filter', HttpStatus.BAD_REQUEST);
      }
      if (!body.limit || typeof body.limit !== 'number') {
        throw new HttpException('Invalid limit parameter', HttpStatus.BAD_REQUEST);
      }

      const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(payload);
      const sql = `
        SELECT 
          c.id, c.name, c."updatedAt", c."createdAt", c."status", c."jobTitle", c."whatsappProvider",
          c."candConversationStatus", c."peopleId", c."startVideoInterviewChat", c.source, c.campaign,
          c."jobsId", c.remarks, c."messagingChannel", c."engagementStatus", c."lastEngagementChatControl",
          c."startVideoInterviewChat", c."startMeetingSchedulingChat", c."stopChat", c."uniqueStringKey",
          c."startChat", c."chatCount", c."startChatCompleted", c."startMeetingSchedulingChatCompleted", c."startVideoInterviewChatCompleted",
          c."otherFields",
          COALESCE(JSON_AGG(CASE WHEN cfv.id IS NOT NULL THEN JSON_BUILD_OBJECT('id', cfv.id, 'name', cfv.name, 'candidateFields', JSON_BUILD_OBJECT('name', cf.name, 'id', cf.id)) ELSE NULL END) FILTER (WHERE cfv.id IS NOT NULL), '[]'::json) as candidate_field_values,
          COALESCE(JSON_AGG(CASE WHEN wm.id IS NOT NULL THEN JSON_BUILD_OBJECT('updatedAt', wm."updatedAt", 'messageObj', wm."messageObj", 'createdAt', wm."createdAt", 'whatsappDeliveryStatus', wm."whatsappDeliveryStatus", 'id', wm.id, 'name', wm.name, 'recruiterId', wm."recruiterId", 'message', wm.message, 'candidateId', wm."candidateId", 'jobsId', wm."jobsId", 'position', wm.position, 'phoneTo', wm."phoneTo", 'phoneFrom', wm."phoneFrom") ELSE NULL END) FILTER (WHERE wm.id IS NOT NULL), '[]'::json) as whatsappMessages
        FROM ${dataSourceSchema}."_candidate" c
        LEFT JOIN ${dataSourceSchema}."_candidateFieldValue" cfv ON c.id = cfv."candidateId"
        LEFT JOIN ${dataSourceSchema}."_candidateField" cf ON cfv."candidateFieldsId" = cf.id
        LEFT JOIN ${dataSourceSchema}."_whatsappMessage" wm ON c.id = wm."candidateId"
        WHERE c."deletedAt" IS NULL AND c."stopChat" = false AND c."startChat" = true AND c."startVideoInterviewChatCompleted" IS NULL AND c."jobsId" = ANY($1) ${body.lastCursor ? 'AND c."updatedAt" < $3' : ''}
        GROUP BY c.id
        ORDER BY c."updatedAt" DESC
        LIMIT $2
      `;

      const shouldFetchAllPages = body.fetchAllPages === true;
      let allResults: any[] = [];
      let currentCursor = body.lastCursor;
      let hasMorePages = true;
      let pageCount = 0;
      let lastBatchLength = 0;
      const maxPages = body.maxPages || 100;

      while (hasMorePages && pageCount < maxPages) {
        const params = [body.filter.jobsId.in, body.limit, ...(currentCursor ? [new Date(currentCursor)] : [])];
        const batch = await this.workspaceQueryService.executeRawQuery(sql, params, payload);
        lastBatchLength = batch.length;
        allResults = allResults.concat(batch);
        hasMorePages = batch.length === body.limit;
        if (hasMorePages && batch.length > 0) {
          currentCursor = batch[batch.length - 1].updatedAt.toISOString();
        }
        pageCount++;
      }

      const result = allResults;
      const totalTime = performance.now() - startTime;
      const edges = result.map((row: any) => ({
        cursor: row.updatedAt.toISOString(),
        node: {
          id: row.id,
          name: row.name,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          status: row.status,
          jobTitle: row.jobTitle,
          whatsappProvider: row.whatsappProvider,
          phoneNumber: row.phone_number || { primaryPhoneNumber: '' },
          email: row.email || { primaryEmail: '' },
          candConversationStatus: row.candConversationStatus,
          peopleId: row.peopleId,
          source: row.source,
          campaign: row.campaign,
          jobsId: row.jobsId,
          remarks: row.remarks,
          messagingChannel: row.messagingChannel,
          engagementStatus: row.engagementStatus,
          lastEngagementChatControl: row.lastEngagementChatControl,
          startVideoInterviewChat: row.startVideoInterviewChat,
          startMeetingSchedulingChat: row.startMeetingSchedulingChat,
          stopChat: row.stopChat,
          uniqueStringKey: row.uniqueStringKey,
          hiringNaukriUrl: row.hiring_naukri_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          resdexNaukriUrl: row.resdex_naukri_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          linkedinUrl: row.linkedin_url || { primaryLinkUrl: '', primaryLinkLabel: '' },
          otherFields: parseRowOtherFields(row),
          candidateFieldValues: { edges: (row.candidate_field_values || []).map((cfv: any) => ({ node: cfv })) },
          whatsappMessages: { edges: (row.whatsappMessages || row.whatsapp_messages || []).map((wm: any) => ({ node: wm })) },
          startChat: row.startChat,
          chatCount: row.chatCount,
          startChatCompleted: row.startChatCompleted,
          startMeetingSchedulingChatCompleted: row.startMeetingSchedulingChatCompleted,
          startVideoInterviewChatCompleted: row.startVideoInterviewChatCompleted,
        },
      }));
      const pageInfo = {
        hasNextPage: shouldFetchAllPages ? false : lastBatchLength === body.limit,
        endCursor: result.length > 0 ? result[result.length - 1].updatedAt.toISOString() : null,
      };
      return {
        data: { candidates: { edges, pageInfo } },
        executionTime: totalTime,
      };
    } catch (error) {
      console.error('Error in search Candidates:', error);
      throw new HttpException(
        error.message || 'Failed to search candidates',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-candidates-graphql-queries-execution-service')
  async getCandidatesGraphQLQueriesExecutionService(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '');
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateDataWithFieldValues, {}, apiToken);
    return response;
  }

  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const hiringNaukriUrl = request.body.hiringNaukriUrl;
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } },
      }, apiToken);
      const candidates = response?.data?.data?.candidates as { edges: CandidateEdge[]; pageInfo: PageInfo } | undefined;
      const candidateId = candidates?.edges[0]?.node?.id;
      return { candidateId };
    } catch (err) {
      return { candidateId: null };
    }
  }

  @Post('get-candidate-id-by-resdex-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByResdexNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { resdexNaukriUrl: { url: { eq: resdexNaukriUrl } } },
      }, apiToken);
      const candidates = response?.data?.data?.candidates as { edges: CandidateEdge[]; pageInfo: PageInfo } | undefined;
      const candidateId = candidates?.edges[0]?.node?.id;
      return { candidateId };
    } catch (err) {
      return { candidateId: null };
    }
  }

  @Post('get-ids-by-unique-string-key')
  @UseGuards(JwtAuthGuard)
  async getIdsByUniqueStringKey(@Req() request: any): Promise<{ candidateIds: string[]; personId: string | undefined }> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
        filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
      }, apiToken);
      const people = response?.data?.data?.people as { edges: PersonEdge[]; pageInfo: PageInfo } | undefined;
      const candidateIds = people?.edges[0]?.node?.candidates?.edges?.map((edge: any) => edge.node?.id).filter((id: string) => id) || [];
      return { candidateIds, personId: people?.edges[0]?.node?.id };
    } catch (err) {
      return { candidateIds: [], personId: undefined };
    }
  }

  @Post('get-id-by-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdByNaukriURL(@Req() request: any): Promise<{ candidateId: string | null }> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    try {
      const url = request.body[request.body.resdexNaukriUrl ? 'resdexNaukriUrl' : 'hiringNaukriUrl'];
      const type = request.body.resdexNaukriUrl ? 'resdex' : 'hiring';
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { [`${type}NaukriUrl`]: { url: { eq: url } } },
      }, apiToken);
      const candidates = response?.data?.data?.candidates as { edges: CandidateEdge[]; pageInfo: PageInfo } | undefined;
      const candidateId = candidates?.edges[0]?.node?.id || null;
      return { candidateId };
    } catch (err) {
      return { candidateId: null };
    }
  }

  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    const candidateObjresponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
      filter: { id: { eq: candidateId } },
    }, apiToken);
    const candidateObj = candidateObjresponse?.data?.data?.candidates as { edges: CandidateEdge[]; pageInfo: PageInfo } | undefined;
    const candidateNode = candidateObj?.edges[0]?.node;

    if (!candidateNode) {
      return { status: 'Failed', message: 'Candidate not found' };
    }
    const personId = candidateNode?.people?.id;
    if (!personId) {
      return { status: 'Failed', message: 'Person ID not found' };
    }

    try {
      await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
        filter: { id: { in: [candidateId] } },
      }, apiToken);
    } catch (err) {
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    try {
      await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
        filter: { id: { in: [personId] } },
      }, apiToken);
      return { status: 'Success' };
    } catch (err) {
      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-from-person-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromPersonIds(@Req() request: any): Promise<object> {
    const personId = request.body.personId;
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    const personresponse = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
      filter: { id: { eq: personId } },
    }, apiToken);
    const personObj = personresponse?.data?.data?.people as { edges: PersonEdge[]; pageInfo: PageInfo } | undefined;
    const personNode = personObj?.edges[0]?.node;

    if (!personNode) {
      return { status: 'Failed', message: 'Candidate not found' };
    }
    const candidateId = personNode?.candidates?.edges[0]?.node?.id;
    if (!candidateId) {
      return { status: 'Failed', message: 'candidateId ID not found' };
    }

    try {
      await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
        filter: { id: { in: [candidateId] } },
      }, apiToken);
    } catch (err) {
      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    try {
      await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
        filter: { id: { in: [personId] } },
      }, apiToken);
      return { status: 'Success' };
    } catch (err) {
      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-bulk')
  @UseGuards(JwtAuthGuard)
  async deletePeopleAndCandidatesBulk(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const { candidateIds, personIds } = request.body;
    const BATCH_SIZE = 100;
    const results: { succeeded: string[]; failed: string[] } = { succeeded: [], failed: [] };

    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

    const processBatch = async <T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<void>): Promise<void> => {
      for (let i = 0; i < items.length; i += batchSize) {
        await processor(items.slice(i, i + batchSize));
      }
    };

    if (candidateIds?.length) {
      await processBatch<string>(candidateIds as string[], BATCH_SIZE, async (batchCandidateIds) => {
        try {
          const candidatesResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
            filter: { id: { in: batchCandidateIds } },
          }, apiToken);
          const candidates = candidatesResponse?.data?.data?.candidates as { edges: CandidateEdge[]; pageInfo: PageInfo } | undefined;
          const candidateNodes = candidates?.edges || [];
          const personIdsFromCandidates = candidateNodes.map((edge: any) => edge.node?.people?.id).filter((id: any) => id);

          await this.deleteFieldValuesService.queueDeleteFieldValues(batchCandidateIds, dataSourceSchema, workspaceId);
          await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
            filter: { id: { in: batchCandidateIds } },
          }, apiToken);
          if (personIdsFromCandidates.length > 0) {
            await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
              filter: { id: { in: personIdsFromCandidates } },
            }, apiToken);
          }
          results.succeeded.push(...batchCandidateIds);
        } catch (err) {
          results.failed.push(...batchCandidateIds);
        }
      });
    }

    if (personIds?.length) {
      await processBatch<string>(personIds as string[], BATCH_SIZE, async (batchPersonIds) => {
        try {
          const peopleResponse = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, {
            filter: { id: { in: batchPersonIds } },
          }, apiToken);
          const people = peopleResponse?.data?.data?.people as { edges: PersonEdge[]; pageInfo: PageInfo } | undefined;
          const peopleNodes = people?.edges || [];
          const candidateIdsFromPeople = peopleNodes.flatMap((edge: any) => edge.node?.candidates?.edges || []).map((edge: any) => edge?.node?.id).filter((id: any) => id);

          if (candidateIdsFromPeople.length > 0) {
            await this.deleteFieldValuesService.queueDeleteFieldValues(candidateIdsFromPeople, dataSourceSchema, workspaceId);
            await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyCandidates, {
              filter: { id: { in: candidateIdsFromPeople } },
            }, apiToken);
          }
          await this.staticGraphQLService.executeGraphQL(graphqlMutationToDeleteManyPeople, {
            filter: { id: { in: batchPersonIds } },
          }, apiToken);
          results.succeeded.push(...batchPersonIds);
        } catch (err) {
          results.failed.push(...batchPersonIds);
        }
      });
    }

    if (results.failed.length > 0) {
      return { status: 'Partial', message: `Successfully deleted ${results.succeeded.length} items, failed to delete ${results.failed.length} items`, results };
    }
    return { status: 'Success', message: `Successfully deleted ${results.succeeded.length} items`, results };
  }

  @Post('upload-jd')
  @UseGuards(JwtAuthGuard)
  async uploadJD(@Req() request: any) {
    try {
      const { jobId, attachmentUrl } = request.body;
      if (!jobId || !attachmentUrl) {
        throw new HttpException('Missing jobId or attachmentUrl', HttpStatus.BAD_REQUEST);
      }
      const authToken = request.headers.authorization.split(' ')[1];
      const result = await this.jdParserService.processJDFromAttachmentUrl(jobId, attachmentUrl, authToken);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to process JD',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Parse job description (text or file path/URL) and return structured ParsedJobDescription.
   * Merged from candidate-search; use this endpoint for JD parsing.
   */
  @Post('parse-job-description')
  @UseGuards(JwtAuthGuard)
  async parseJobDescription(
    @Body() request: JobDescriptionParseRequest,
    @Req() req: any,
  ): Promise<ParsedJobDescription> {
    try {
      const hasJobDescription = (request.jobDescription?.trim().length ?? 0) > 0;
      const hasFilePath = (request.filePath?.trim().length ?? 0) > 0;

      if (!hasJobDescription && !hasFilePath) {
        throw new HttpException(
          'Either job description or file path is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const apiToken = req.headers.authorization?.replace('Bearer ', '').replace(/[\r\n]+/g, '');
      if (!apiToken) {
        throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
      }

      return await this.jdParserService.parseToParsedJobDescription(request, apiToken);
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to parse job description',
        error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-prompts')
  @UseGuards(JwtAuthGuard)
  async createPrompts(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const jobId = request.body.jobId;
      const jobIdValidation = validateAndExtractJobId(jobId);
      if (!jobIdValidation.isValid) {
        return createJobIdErrorResponse(jobIdValidation.error!);
      }
      const actualJobId = jobIdValidation.jobId!;
      for (const prompt of prompts) {
        await this.staticGraphQLService.executeGraphQL(graphqlToCreateOnePrompt, {
          input: { name: prompt.name, prompt: prompt.prompt, position: 'first', jobId: actualJobId },
        }, apiToken);
      }
      return { status: 'Success' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create prompts',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateStatus = personObj?.candidates?.edges[0]?.node?.status || 'Unknown';
    return { status: candidateStatus };
  }

  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId: string | undefined = personObj?.candidates?.edges[0]?.node?.id;
    return { candidateId: candidateId as string };
  }

  @Post('get-candidates-by-job-id')
  @UseGuards(JwtAuthGuard)
  async getCandidatesByJobId(@Req() request: any): Promise<object> {
    const { jobId } = request.body;
    const jobIdValidation = validateAndExtractJobId(jobId);
    if (!jobIdValidation.isValid) {
      return createJobIdErrorResponse(jobIdValidation.error!);
    }
    const actualJobId = jobIdValidation.jobId!;
    const authHeader = request?.headers?.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return createJobIdErrorResponse('Missing authorization token');
    }

    const apiToken = authHeader.split(' ')[1].replace(/[\r\n]+/g, '');

    const allCandidates: any[] = [];
    let lastCursor: string | null = null;
    let hasNextPage = true;
    const timestampedFilter = { jobsId: { eq: actualJobId } };

    while (hasNextPage) {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateDataWithFieldValues,
        { lastCursor, limit: 400, filter: timestampedFilter, orderBy: [{ createdAt: 'DESC' }] },
        apiToken,
      );
      const candidates = response?.data?.data?.candidates as {
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;
      if (!candidates?.edges?.length) {
        break;
      }
      hasNextPage = candidates.pageInfo?.hasNextPage || false;
      const pageCandidates = candidates.edges.map((edge) => edge.node);
      const migratedCandidates = await this.otherFieldsService.lazyMigrateCandidates(
        pageCandidates as CandidateWithCustomFields[],
        apiToken,
      );
      allCandidates.push(...migratedCandidates);
      if (!hasNextPage) break;
      lastCursor = candidates.pageInfo?.endCursor;
    }
    return allCandidates;
  }
}

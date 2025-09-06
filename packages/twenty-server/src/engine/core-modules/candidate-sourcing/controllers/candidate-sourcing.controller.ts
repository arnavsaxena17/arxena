import { Controller, Post, Req, UseGuards } from '@nestjs/common';

import axios from 'axios';
import {
  CandidateEnrichmentEdge,
  createOneCandidateField,
  CreateOneVideoInterviewTemplate,
  Enrichment,
  graphqlToAddNewJob,
  graphQlTofindManyCandidateEnrichments,
  graphqlToFindManyJobs,
  Job,
  JobEdge,
  mutationToCreateOneCandidateEnrichment,
  PageInfo,
  UpdateOneJob,
  UserProfile
} from 'twenty-shared';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';

@Controller('candidate-sourcing')
export class CandidateSourcingController {
  constructor(
    private readonly sheetsService: GoogleSheetsService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly candidateService: CandidateService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly personService: PersonService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Post('update-candidate')
  @UseGuards(JwtAuthGuard)
  async updateCandidateSpreadsheet(@Req() request: any): Promise<object> {
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








  


  @Post('find-many-enrichments')
  @UseGuards(JwtAuthGuard)
  async findManyEnrichments(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    console.log('going to find many enrichments:', apiToken);
    try {
      const graphqlQueryObj = JSON.stringify({
        query: graphQlTofindManyCandidateEnrichments,
        variables: {},
      });

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
      console.error('Error in findManyEnrichments:', err);
      return { status: 'Failed', error: err };
    }
  }

  async createOneEnrichment(
    enrichment: Enrichment,
    jobObject: any,
    apiToken: string,
  ): Promise<any> {
    const graphqlVariables = {
      input: {
        name: enrichment.modelName,
        modelName: enrichment.modelName,
        prompt: enrichment.prompt,
        selectedModel: enrichment.selectedModel,
        fields: enrichment.fields,
        selectedMetadataFields: enrichment.selectedMetadataFields,
        jobId: jobObject?.id,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: mutationToCreateOneCandidateEnrichment,
      variables: graphqlVariables,
    });

    const response = await this.staticGraphQLService.executeGraphQL(mutationToCreateOneCandidateEnrichment, graphqlVariables, apiToken);

    return response.data;
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

  @Post('process-enrichments')
  @UseGuards(JwtAuthGuard)
  async processEnrichments(@Req() request: any): Promise<object> {
    try {
      console.log('jhave reached create enrichments,');
      const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token

      const enrichments = request?.body?.enrichments;
      const objectNameSingular = request?.body?.objectNameSingular;
      const availableSortDefinitions = request?.body?.availableSortDefinitions || [];
      const availableFilterDefinitions = request?.body?.availableFilterDefinitions || [];
      const objectRecordId = request?.body?.objectRecordId;
      const selectedRecordIds = request?.body?.selectedRecordIds;

      console.log('objectNameSingular:', objectNameSingular);
      console.log('availableSortDefinitions:', availableSortDefinitions);
      console.log('enrichments:', enrichments);
      console.log('availableFilterDefinitions:', availableFilterDefinitions);
      console.log('objectRecordId:', objectRecordId);
      console.log('selectedRecordIds:', selectedRecordIds);

      const path_position = objectNameSingular.replace('JobCandidate', '');
      const jobId = request.body.jobId
      const jobObject = await this.findJobById(jobId, apiToken);
      // const jobId = jobObject.id

      console.log('Found job:', jobObject);

      for (const enrichment of enrichments) {
        if (enrichment.modelName !== '') {
          const response = await this.createOneEnrichment(
            enrichment,
            jobObject,
            apiToken,
          );
        console.log('Response from create enrichment:', response);
        }
        const response = await this.createOneEnrichment(
          enrichment,
          jobObject,
          apiToken,
        );
        console.log('Response from create enrichment:', response);
      }
      console.log('process.env.ENV_NODE::', process.env.ENV_NODE);
      const url =
        process.env.ENV_NODE === 'production'
          ? 'https://arxena.com/process_enrichments'
          : 'http://localhost:5050/process_enrichments';
      const response = await axios.post(
        url,
        {
          enrichments,
          jobId,
          objectNameSingular,
          availableSortDefinitions,
          availableFilterDefinitions,
          objectRecordId,
          selectedRecordIds,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      console.log('Response from process enrichments:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);

      return { status: 'Failed', error: err };
    }
  }


  
  async findJob(path_position: string, apiToken: string): Promise<any> {
    console.log('Going to find job by path_position id:', path_position);
    const variables = {
      filter: { pathPosition: { in: [path_position] } },
      limit: 30,
      orderBy: [{ position: 'AscNullsFirst' }],
    };
    const query = graphqlToFindManyJobs;
    const data = { query, variables };
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, variables, apiToken);
    const jobs = response?.data?.data?.jobs as {
      edges: JobEdge[];
      pageInfo: PageInfo;
    } | undefined;
    const job = jobs?.edges[0]?.node;
    console.log('This is the job:', job);
    return job;
  }
  async findJobById(id: string, apiToken: string): Promise<any> {
    console.log('Going to find job by path_position id:', id);
    const variables = {
      filter: { id: { in: [id] } },
      limit: 30,
      orderBy: [{ position: 'AscNullsFirst' }],
    };
    const query = graphqlToFindManyJobs;
    const data = { query, variables };
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, variables, apiToken);
    const jobs = response?.data?.data?.jobs as {
      edges: JobEdge[];
      pageInfo: PageInfo;
    } | undefined;
    const job = jobs?.edges[0]?.node;

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
    const origin = req.headers.origin;
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
        await this.candidateService.getVideoInterviewModels(apiToken);

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
    // const gateway = this.webSocketGateway.sendToUser.getInstance();

    if (this.webSocketGateway) {
      this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'refresh_table_data', {
        message: 'Refreshing table data',
      });
    } else {
      console.error('WebSocket gateway instance not available');
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

    console.log('arxenaSiteId:', jobId);
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
      );
      console.log("recruiterId::", recruiterId);
      // const gateway = this.webSocketGateway.sendToUser.getInstance();

      if (this.webSocketGateway) {
        this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'candidates_processing_progress', {
          jobId: jobId,
          message: 'Candidates processing started',
        });
      } else {
        console.error('WebSocket gateway instance not available');
      }
  
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

  @Post('get-all-jobs')
  @UseGuards(JwtAuthGuard)
  async getJobs(@Req() request: any) {
    console.log('Going to get all jobs');

    const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, '')  ; // Assuming Bearer token

    // first create companies
    console.log('Getting all jobs');
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    const responseFromGetAllJobs = await this.staticGraphQLService.executeGraphQL(
      graphqlToFindManyJobs,
      { limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
      apiToken,
    );
    const jobs = responseFromGetAllJobs?.data?.data?.jobs?.edges;

    console.log('This is the number of jobsObjects:', jobs.length);
    return { jobs: jobs };
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any) {
    console.log('Going to test arxena connections');

    const apiToken = request?.headers?.authorization?.split(' ')[1].replace(/[\r\n]+/g, '')  ; // Assuming Bearer token

    // first create companies
    try {
      let arxenaSiteBaseUrl = '';

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'process.env.ARXENA_SITE_BASE_URL',
          process.env.ARXENA_SITE_BASE_URL,
        );
        arxenaSiteBaseUrl =
          process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl =
          process.env.ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      console.log('arxenaSiteBaseUrl:', arxenaSiteBaseUrl);
      arxenaSiteBaseUrl = 'http://localhost:5050';
      const response = await axios.post(
        arxenaSiteBaseUrl + '/test-connection-from-arx-twenty',
        { jobId: 'some-id' },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );
      console.log('Response from localhost:5050', response.data);
      return { jobs: response.data };
    } catch (error) {
      console.log('Error in testArxenaConnection', error);
    }
  }

  @Post('post-job')
  @UseGuards(JwtAuthGuard)
  async postJob(@Req() request: any) {
    let uuid;

    try {
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const data = request.body;

      console.log(request.body);
      
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
    console.log('sortedJobs:', sortedJobs);
    for (let i = 0; i < sortedJobs.length; i++) {
      const jobId = sortedJobs[i].node.id;
      const isActive = sortedJobs[i].node.isActive;
      console.log('jobId:', jobId, 'isActive:', isActive, 'i:', i);   
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
      // console.log(body);
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const data = request.body;
      const arxenaSiteId = data?.job_id;
      const jobName = data?.job_name;
      const jobObject: Job = await this.candidateService.getJobDetails(
        arxenaSiteId,
        jobName,
        apiToken,
      );
      const questions = data?.questions || [];

      console.log('Number Questions:', questions?.length);
      for (const question of questions) {
        const graphqlVariables = {
          input: { name: question, jobsId: jobObject?.id },
        };

        const response = await this.staticGraphQLService.executeGraphQL(createOneCandidateField, graphqlVariables, apiToken);
      }

      return { status: 'success' };
    } catch (error) {
      console.log('Error in add questions', error);

      return { error: error.message };
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
      const origin = request.headers.origin;
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '')  ;
      const { candidateId, fieldName, value, personId } = request.body;
      
      console.log('Going to update candidate field:::', fieldName, candidateId, personId, value);

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

      if (!jobId) {
        return {
          status: 'Failed',
          message: 'Missing required field: jobId',
        };
      }

      const candidateFields = await this.candidateService.getCandidateFieldsByJobId(
        jobId,
        apiToken,
      );

      console.log(`Found ${candidateFields?.length || 0} candidate fields for job ${jobId}`);

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
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { filterDescription, candidateFields } = request.body;

      if (!filterDescription) {
        return {
          status: 'Failed',
          message: 'Missing required field: filterDescription',
        };
      }

      const url = process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/process_filter_description'
        : 'http://localhost:5050/process_filter_description';

      const response = await this.retryWithExponentialBackoff(
        async () => {
          const result = await axios.post(
            url,
            { filter_description: filterDescription, candidate_fields: candidateFields },
            { 
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`,
              },
            }
          );
          return result;
        },
        3, // Max 3 retries
        1000 // Initial delay of 1 second
      );

      return {
        status: 'success',
        data: response.data
      };
    } catch (err) {
      console.error('Error in process AI filter after all retries:', err);
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
      const enrichments = request.body.enrichments;
      const selectedRecordIds = request.body.selectedRecordIds;
      const jobId = request.body.jobId;

      if (!enrichments) {
        return {
          status: 'Failed',
          message: 'Missing required field: enrichments',
        };
      }

      const url = process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/compute-tokens'
        : 'http://localhost:5050/compute-tokens';

      const response = await axios.post(
        url,
        {
          enrichments,
          selectedRecordIds,
          jobId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );
      console.log("Response data is this::", response.data);
      return {
        status: 'success',
        data: response.data,
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

      if (this.webSocketGateway) {
        this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'test-snackbar', {
          variant: variant || 'info',
          message: message || 'This is a test snackbar message',
        });
      } else {
        console.error('WebSocket gateway instance not available');
      }

      return {
        status: 'Success',
        message: 'Test snackbar event sent successfully',
      };
    } catch (err) {
      console.error('Error sending test snackbar:', err);
      return {
        status: 'Failed',
        error: err.message,
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

      if (this.workspaceQueryService.webSocketService) {
        this.workspaceQueryService.webSocketService.sendToUser(recruiterId, 'refresh_table_data', {
          message: 'Refreshing table data',
        });
      } else {
        console.error('WebSocket service instance not available');
        return {
          status: 'Failed',
          message: 'WebSocket service unavailable'
        };
      }

      return {
        status: 'Success',
        message: 'Data table refresh triggered successfully'
      };

    } catch (err) {
      console.error('Error updating data table:', err);
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

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!this.webSocketGateway?.webSocketService) {
        console.error('WebSocket service instance not available');
        return {
          status: 'Failed',
          message: 'WebSocket service unavailable'
        };
      }
      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Missing required field: recruiterId'
        };
      }
      console.log("recruiterId::", recruiterId);
      this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'send_notification_to_recruiter', {
        message: message || 'Sending notification to recruiter',
        timestamp: new Date().toISOString()
      });

      try {
        await this.webSocketGateway.webSocketService.waitForAcknowledgment(recruiterId, 5000);
        return {
          status: 'Success',
          message: 'Notification delivered and acknowledged by recruiter'
        };
      } catch (error) {
        return {
          status: 'Failed',
          message: 'Notification delivery timeout or error',
          error: error.message
        };
      }
    } catch (err) {
      console.error('Error sending notification:', err);
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
      console.log("Going to get user object");
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const origin = request.headers.origin;

      // Get current user data using the same approach as RecruiterProfileService
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      console.log('currentUser in getUserObj:', currentUser);

      // Get all jobs for the user using staticGraphQLService
      const responseFromGetAllJobs = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyJobs,
        { filter: { isActive: { eq: true } }, limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
        apiToken,
      );
      const jobs = responseFromGetAllJobs?.data?.data?.jobs?.edges || [];
      console.log('jobs in getUserObj:', jobs.length);

      // Use the workspace member data from currentUser instead of separate query
      const workspaceMember = currentUser?.workspaceMember;
      console.log('workspaceMember in getUserObj:', workspaceMember);

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
      console.log('recruiterProfile in getUserObj:', recruiterProfile);

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
        chrome_extension_id: 'najjmciobphkllanmfgffjjjcbejnbci',
        all_jobs: mappedJobs.map(job => ({
          user_id: job.user_id,
          job_id: job.job_id,
          job_name: job.job_name,
          start_date: job.start_date,
          status: job.status
        }))
      };

      console.log('Response obj in get_user_obj::', { status: 'successful_fid', user_obj: userObj });

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
      // { type: 'text', data: 'unique_key_string', width: 60, title: 'unique_key_string', readOnly: 1, editor: 0, id: 49 }
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
}

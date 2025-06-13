import { Controller, Post, Req, UseGuards } from '@nestjs/common';

import axios from 'axios';
import {
  createOneCandidateField,
  CreateOneJob,
  CreateOneVideoInterviewTemplate,
  Enrichment,
  graphQlTofindManyCandidateEnrichments,
  graphqlToFindManyJobs,
  Jobs,
  mutationToCreateOneCandidateEnrichment,
  UpdateOneJob,
  UserProfile,
} from 'twenty-shared';

import { getCurrentUser } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { axiosRequest } from 'src/engine/core-modules/candidate-sourcing/utils/utils';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
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

  ) {}

  @Post('update-candidate')
  @UseGuards(JwtAuthGuard)
  async updateCandidateSpreadsheet(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
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
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    console.log('going to find many enrichments:', apiToken);
    try {
      const graphqlQueryObj = JSON.stringify({
        query: graphQlTofindManyCandidateEnrichments,
        variables: {},
      });

      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('response from find many enrichments:', response.data.data.candidateEnrichments.edges.map(
        (edge: any) => edge.node,
      ));
      return {
        status: 'Success',
        data: response.data.data.candidateEnrichments.edges.map(
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

    const response = await axiosRequest(graphqlQueryObj, apiToken);

    return response.data;
  }

  @Post('update-snapshot-profiles')
  @UseGuards(JwtAuthGuard)
  async updateProfiles(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1];
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
      console.log('jhave reached create enrichments,', request);
      const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

      const enrichments = request?.body?.enrichments;
      const objectNameSingular = request?.body?.objectNameSingular;
      const availableSortDefinitions =
        request?.body?.availableSortDefinitions || [];
      const availableFilterDefinitions =
        request?.body?.availableFilterDefinitions || [];
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
    const response = await axiosRequest(JSON.stringify(data), apiToken);
    const job = response.data?.data?.jobs?.edges[0]?.node;
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
    const response = await axiosRequest(JSON.stringify(data), apiToken);
    const job = response.data?.data?.jobs?.edges[0]?.node;

    return job;
  }

  @Post('process-job-candidate-refresh-data')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

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
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

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
    const apiToken = req.headers.authorization.split(' ')[1];
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
      const response = await axiosRequest(JSON.stringify(data), apiToken);

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
      const jobCode = `${String.fromCharCode(65 + Math.floor(Math.random() * 10))}${String.fromCharCode(65 + Math.floor(Math.random() * 10))} ${Math.floor(
        Math.random() * 100,
      )
        .toString()
        .padStart(2, '0')}`;
      console.log('Going to get current user in updateTwentyJob');
      const currentUser = await getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;
      console.log( 'This is the currentUser?.workspaces:', JSON.stringify(currentUser?.workspaces) );
      console.log('This is the current user:', currentUser);
      console.log('This is the recruiter id:', recruiterId);

      const graphqlToUpdateJob = JSON.stringify({
        query: UpdateOneJob,
        variables: {
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
      });

      const responseToUpdateJob = await axiosRequest(
        graphqlToUpdateJob,
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
    const apiToken = req.headers.authorization.split(' ')[1];
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
    const apiToken = req.headers.authorization.split(' ')[1];
    const jobId = req.body?.job_id;
    const jobName = req.body?.job_name;
    const recruiterId = req.body?.recruiterId;

    console.log('arxenaSiteId:', jobId);
    const data: UserProfile[] = req.body?.data;

    console.log('Data len:', data.length);
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

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

    // first create companies
    console.log('Getting all jobs');
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    const responseFromGetAllJobs = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobs,
        variables: { limit: 30, orderBy: [{ position: 'AscNullsFirst' }] },
      }),
      apiToken,
    );
    const jobsObject: Jobs[] = responseFromGetAllJobs.data?.data?.jobs?.edges;
    console.log('This is the number of jobsObjects:', jobsObject.length);
    return { jobs: jobsObject };
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any) {
    console.log('Going to test arxena connections');

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

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
      const apiToken = request.headers.authorization.split(' ')[1];
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
      const graphqlQueryObj = JSON.stringify({
        query: CreateOneJob,
        variables: graphqlVariables,
      });
      const responseNew = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Response from create job', responseNew.data);
      uuid = responseNew?.data?.data?.createJob?.id;

      return { status: 'success', job_uuid: uuid };
    } catch (error) {
      console.log('Error in postJob', error);

      return { error: error.message };
    }
  }

  @Post('add-questions')
  @UseGuards(JwtAuthGuard)
  async addQuestions(@Req() request: any) {
    try {
      // console.log(body);
      const apiToken = request.headers.authorization.split(' ')[1];
      const data = request.body;
      const arxenaSiteId = data?.job_id;
      const jobName = data?.job_name;
      const jobObject: Jobs = await this.candidateService.getJobDetails(
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
        const graphqlQueryObj = JSON.stringify({
          query: createOneCandidateField,
          variables: graphqlVariables,
        });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
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
      const apiToken = request.headers.authorization.split(' ')[1];
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
      const apiToken = request.headers.authorization.split(' ')[1];
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
      const apiToken = request.headers.authorization.split(' ')[1];
      const { jobId } = request.body;

      console.log('Fetching candidate fields for jobId:', jobId);

      if (!jobId) {
        return {
          status: 'Failed',
          message: 'Missing required field: jobId',
        };
      }

      // Also fetch some candidate field values for this job
      const candidateFields = await this.candidateService.getCandidateFieldsByJobId(
        jobId,
        apiToken,
      );

      console.log(`Found ${candidateFields?.length || 0} candidate fields for job ${jobId}`);

      // Transform fields to have a consistent format if needed
      const formattedFields = candidateFields.map(field => ({
        name: field || '',
        label: field || '',
      }));

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
    const apiToken = request.headers.authorization.split(' ')[1];
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
    const apiToken = req.headers.authorization.split(' ')[1];

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

  @Post('process-filter-description')
  @UseGuards(JwtAuthGuard)
  async processAiFilter(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
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

      const response = await axios.post(
        url,
        { 
          filter_description: filterDescription,
          candidate_fields: candidateFields 
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      return {
        status: 'success',
        data: response.data
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
      const apiToken = request.headers.authorization.split(' ')[1];
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
}

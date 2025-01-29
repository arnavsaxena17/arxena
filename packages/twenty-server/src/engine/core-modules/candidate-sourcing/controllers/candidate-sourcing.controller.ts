import moment from 'moment-timezone';
import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import {UpdateOneJob , CreateOneJob, createOneQuestion, graphqlToFindManyJobByArxenaSiteId, graphQltoUpdateOneCandidate, graphqlToFindManyJobByArxenaSiteIdOlderSchema, workspacesWithOlderSchema } from '../graphql-queries';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../arx-chat/services/candidate-engagement/update-chat';
import { axiosRequest , axiosRequestForMetadata} from '../utils/utils';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';
import axios from 'axios';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { PersonService } from '../services/person.service';
import { CandidateService } from '../services/candidate.service';
import { ChatService } from '../services/chat.service';
import { Enrichment } from '../../workspace-modifications/object-apis/types/types';
import { ProcessCandidatesService } from '../jobs/process-candidates.service';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In } from 'typeorm';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { graphqlToFetchActiveJob, graphqlToFetchAllCandidateData } from '../../arx-chat/graphql-queries/graphql-queries-chatbot';


@Controller('candidate-sourcing')
export class CandidateSourcingController {
  constructor(
    private readonly sheetsService: GoogleSheetsService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,
    private readonly processCandidatesService : ProcessCandidatesService,
    private readonly chatService: ChatService
  ) {}



  @Post('update-candidate')
@UseGuards(JwtAuthGuard)
async updateCandidateSpreadsheet(@Req() request: any): Promise<object> {
  try {
    const apiToken = request.headers.authorization.split(' ')[1];
    const { candidate, jobId, jobName } = request.body;

    // Get job details to find spreadsheet ID
    const jobObject = await this.findJob(jobName, apiToken);
    
    if (!jobObject?.googleSheetId) {
      throw new Error('No Google Sheet ID found for job');
    }

    // Load Google auth
    const auth = await this.sheetsService.loadSavedCredentialsIfExist(apiToken);
    if (!auth) {
      throw new Error('Failed to authenticate with Google');
    }

    // Update the sheet
    await this.sheetsService.updateCandidateInSheet(
      auth,
      jobObject.googleSheetId,
      candidate,
      apiToken
    );

    return { 
      status: 'Success',
      message: 'Candidate updated in spreadsheet'
    };
  } catch (err) {
    console.error('Error updating candidate spreadsheet:', err);
    return { 
      status: 'Failed', 
      error: err.message 
    };
  }
}


  @Post('process-candidate-chats')
  @UseGuards(JwtAuthGuard)

  async processCandidateChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      const candidateIds= request.body.candidateIds;
      const currentWorkspaceMemberId = request.body.currentWorkspaceMemberId;

      const jobIds = await this.candidateService.getJobIdsFromCandidateIds(candidateIds, apiToken);

      console.log("going to process chats")
      // await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses( apiToken);
      const results = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken, candidateIds,jobIds, currentWorkspaceMemberId);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChatStatus(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const { candidateIds, currentWorkspaceMemberId } = request.body;
    return this.chatService.refreshChats(candidateIds, currentWorkspaceMemberId, apiToken);
  }



  @Post('find-many-enrichments')
  @UseGuards(JwtAuthGuard)
  async findManyEnrichments(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    try {
      const graphqlQueryObj = JSON.stringify({
        query: `query FindManyCandidateEnrichments($filter: CandidateEnrichmentFilterInput, $orderBy: [CandidateEnrichmentOrderByInput], $lastCursor: String, $limit: Int) {
          candidateEnrichments(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                prompt
                modelName
                createdAt
                fields
                id
                name
                selectedModel
                selectedMetadataFields
              }
              cursor
              __typename
            }
            pageInfo {
              hasNextPage
              startCursor
              endCursor
              __typename
            }
            totalCount
            __typename
          }
        }`,
        variables: {},
      });
      
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("response.data.data:",response.data)
      return { status: 'Success', data: response.data.data.candidateEnrichments.edges.map((edge: any) => edge.node) };
    } catch (err) {
      console.error('Error in findManyEnrichments:', err);
      return { status: 'Failed', error: err };
    }
  }
  async createOneEnrichment(enrichment: Enrichment, jobObject: any, apiToken: string): Promise<any> {
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
      query: `mutation CreateOneCandidateEnrichment($input: CandidateEnrichmentCreateInput!) {
        createCandidateEnrichment(data: $input) {
          id
          name
          position
          createdAt
          updatedAt
        }
      }`,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    return response.data;
  }

  @Post('create-enrichments')
  @UseGuards(JwtAuthGuard)
  async createEnrichments(@Req() request: any): Promise<object> {
    try {
      console.log("jhave reached create enrichments,", request)
      const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token

      const enrichments = request?.body?.enrichments;
      const objectNameSingular = request?.body?.objectNameSingular;
      const availableSortDefinitions = request?.body?.availableSortDefinitions;
      const availableFilterDefinitions = request?.body?.availableFilterDefinitions;
      const objectRecordId = request?.body?.objectRecordId;
      const selectedRecordIds = request?.body?.selectedRecordIds;

      console.log("objectNameSingular:", objectNameSingular);
      console.log("availableSortDefinitions:", availableSortDefinitions);
      console.log("enrichments:", enrichments);
      console.log("availableFilterDefinitions:", availableFilterDefinitions);
      console.log("objectRecordId:", objectRecordId);
      console.log("selectedRecordIds:", selectedRecordIds);
      
      const path_position = objectNameSingular.replace("JobCandidate", "");
      const jobObject = await this.findJob(path_position, apiToken);
      console.log("Found job:", jobObject);

      for (const enrichment of enrichments) {
        if (enrichment.modelName !== '') {
          const response = await this.createOneEnrichment(enrichment, jobObject, apiToken);
          console.log('Response from create enrichment:', response);
        }
        const response = await this.createOneEnrichment(enrichment, jobObject, apiToken);
        console.log('Response from create enrichment:', response);
      }

      console.log("process.env.ENV_NODE::", process.env.ENV_NODE);
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/process_enrichments' : 'http://127.0.0.1:5050/process_enrichments';
      const response = await axios.post(
        url,
        {
          enrichments,
          objectNameSingular,
          availableSortDefinitions,
          availableFilterDefinitions,
          objectRecordId,
          selectedRecordIds
        },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } }
      );
      console.log('Response from process enrichments:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in process:', err);
      return { status: 'Failed', error: err };
    }
  }

  async findJob(path_position: string, apiToken: string): Promise<any> {
    console.log("Going to find job by path_position id:", path_position);
    const variables = {
      filter: { pathPosition: { in: [path_position] } },
      limit: 30,
      orderBy: [{ position: "AscNullsFirst" }],
    };
    const query = graphqlToFindManyJobByArxenaSiteId;
    const data = { query, variables };
    const response = await axiosRequest(JSON.stringify(data), apiToken);
    const job = response.data?.data?.jobs?.edges[0]?.node;
    return job;
  }

  @Post('process-job-candidate-refresh-data')
  @UseGuards(JwtAuthGuard)


  async refreshChats(@Req() request: any): Promise<object>  {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    try {
      // const { candidateIds } = body;
      const objectNameSingular= request.body.objectNameSingular;
      console.log("thisi s objectNameSingular:",objectNameSingular)
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/sync_job_candidate' : 'http://127.0.0.1:5050/sync_job_candidate';

      console.log('url:', url);
      const response = await axios.post(
        url,
        { objectNameSingular: objectNameSingular},
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } },
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }
  
  
  @Post('transcribe-call')
  @UseGuards(JwtAuthGuard)
  async transcribeCall(@Req() request: any): Promise<object>  {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    try {
      // const { candidateIds } = body;
      const phoneCallIds= request.body.phoneCallIds;
      const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/transcribe_call' : 'http://127.0.0.1:5050/transcribe_call';

      console.log('url:', url);
      const response = await axios.post(
        url,
        { phoneCallIds: phoneCallIds},
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } },
      );
      console.log("Received this response:", response.data)

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh chats:', err);
      return { status: 'Failed', error: err };
    }
  }
  
  

   getJobCandidatePathPosition(jobName: string): string {
    return this.toCamelCase(jobName)
      .replace("-","")
      .replace(" ","")
      .replace("#","")
      .replace("/","")
      .replace("+","")
      .replace("(","")
      .replace(")","")
      .replace(",","")
      .replace(".","");
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
    try {
      if (!req?.body?.job_name || !req?.body?.new_job_id) {
        throw new Error('Missing required fields: job_name or new_job_id');
      }

      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // let googleSheetUrl = '';
      // let googleSheetId = '';
      let { googleSheetId, googleSheetUrl } = await this.createSpreadsheet(req.body.job_name, apiToken);
      // const { googleSheetId: googleSheetIdFromRequest, googleSheetUrl: googleSheetUrlFromRequest } = req.body;
      await this.updateTwentyJob(req.body.job_name, req.body.new_job_id, googleSheetUrl ?? '', googleSheetId ?? '', apiToken, req.body.id_to_update);
      const response = await this.callCreateNewJobInArxena(req.body.job_name, req.body.new_job_id, googleSheetId, googleSheetUrl, apiToken);

      return {
        ...response.data.data.createJob,
        googleSheetId,
        googleSheetUrl
      };
    } catch (error) {
      console.log('Error in createJobInArxena:', error);
      return { error: error.message };
    }
  }

  async updateTwentyJob(jobName: string, newJobId: string, googleSheetUrl: string, googleSheetId: string | null, apiToken: string, idToUpdate: string){
    const graphqlToUpdateJob = JSON.stringify({
      query: UpdateOneJob,
      variables: {
        idToUpdate: idToUpdate,
        input: {
          pathPosition: this.getJobCandidatePathPosition(jobName),
          arxenaSiteId: newJobId,
          isActive: true,
          googleSheetUrl: { "label": googleSheetUrl, "url": googleSheetUrl },
          ...(googleSheetId && { googleSheetId: googleSheetId }),
        },
      },
    });

    const responseToUpdateJob = await axiosRequest(graphqlToUpdateJob, apiToken);
    console.log('Response from update job in create Job IN Arxena:', responseToUpdateJob.data.data);
  }


  private async createSpreadsheet(jobName: string, apiToken: string): Promise<{ googleSheetId: string | null, googleSheetUrl: string | null }> {
    let googleSheetId: string | null = null;
    let googleSheetUrl: string | null = null;
    try {
      const auth = await this.sheetsService.loadSavedCredentialsIfExist(apiToken);
      if (auth) {
        const spreadsheetTitle = `${jobName}`;
        console.log('Creating spreadsheet with title:', spreadsheetTitle);
        const spreadsheet = await this.sheetsService.createSpreadsheetForJob(spreadsheetTitle, apiToken);
        console.log("this is spreadsheet:", spreadsheet);
        googleSheetId = spreadsheet?.googleSheetId ?? null;
        googleSheetUrl = spreadsheet?.googleSheetUrl;
      }
    } catch (spreadsheetError) {
      console.log('Warning: Failed to create spreadsheet error:', spreadsheetError);
      console.log('Warning: Failed to create spreadsheet:', spreadsheetError.message);
    }
    return { googleSheetId, googleSheetUrl };
  }

  private async callCreateNewJobInArxena(jobName: string, newJobId: string, googleSheetId: string | null, googleSheetUrl: string | null, apiToken: string): Promise<any> {
    const url = process.env.ENV_NODE === 'production' ? 'https://arxena.com/create_new_job' : 'http://127.0.0.1:5050/create_new_job';
    const response = await axios.post(
      url,
      {
        job_name: jobName,
        new_job_id: newJobId,
        googleSheetId,
        googleSheetUrl
      },
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` } },
    );
    return response;
  }

  @Post('post-candidates')
  @UseGuards(JwtAuthGuard)
  async sourceCandidates(@Req() req) {
    console.log('Called post candidates API');
    const apiToken = req.headers.authorization.split(' ')[1];
    const jobId = req.body?.job_id;
    const jobName = req.body?.job_name;
    console.log('arxenaJobId:', jobId);
    const data: CandidateSourcingTypes.UserProfile[] = req.body?.data;
    console.log("Data len:",data.length)
    console.log("First candidats:",data[0])
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    const timestamp = req.body?.timestamp || new Date().toISOString();

    try {
      // Process profiles and get all the necessary data
      const jobIdProcesed = await this.processCandidatesService.send( data, jobId, jobName, timestamp, apiToken );
  
      return {
        status: 'success',
        message: 'Candidate processing queued successfully',
        jobId: jobId
      }
    } catch (error) {
      console.error('Error in sourceCandidates:', error);
      return { 
        status: 'error',
        error: error.message,
        details: error.response?.data || error.stack
      };
    }
  }
  
  @Post('get-all-jobs')
  @UseGuards(JwtAuthGuard)

  async getJobs(@Req() request: any) {
    console.log("Going to get all jobs")

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token
    // first create companies
    console.log('Getting all jobs');
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    let graphqlQueryObjToFetchAllCandidatesForChats = '';
    if (workspacesWithOlderSchema.includes(workspaceId)) {
      graphqlQueryObjToFetchAllCandidatesForChats = graphqlToFindManyJobByArxenaSiteIdOlderSchema;
    }
    else{
      graphqlQueryObjToFetchAllCandidatesForChats = graphqlToFindManyJobByArxenaSiteId;
    }
    const responseFromGetAllJobs = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        }
      }),apiToken
    );
    const jobsObject: CandidateSourcingTypes.Jobs = responseFromGetAllJobs.data?.data?.jobs?.edges;
    return { jobs: jobsObject };
  }



  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any) {

    console.log("Going to test arxena connections")

    const apiToken = request?.headers?.authorization?.split(' ')[1]; // Assuming Bearer token
    // first create companies
    try{
      let arxenaSiteBaseUrl: string = '';
      if (process.env.NODE_ENV === 'development') {
        console.log("process.env.ARXENA_SITE_BASE_URL", process.env.ARXENA_SITE_BASE_URL)
        arxenaSiteBaseUrl = process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';
      } else {
        arxenaSiteBaseUrl = process.env.ARXENA_SITE_BASE_URL || 'https://arxena.com';
      }
      console.log("arxenaSiteBaseUrl:",arxenaSiteBaseUrl)
      arxenaSiteBaseUrl = 'http://127.0.0.1:5050'
      const response = await axios.post(arxenaSiteBaseUrl+'/test-connection-from-arx-twenty',  { jobId: 'some-id' },  {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      });
      console.log('Response from localhost:5050', response.data);
      return { jobs: response.data };
    }
    catch(error){
      console.log("Error in testArxenaConnection",error)
    }
  }





  @Post('post-job')
  @UseGuards(JwtAuthGuard)
  async postJob(@Req() request: any) {
    let uuid;
    try {
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      const data = request.body;
      console.log(request.body);
      const graphqlVariables = { input: { name: data?.job_name, arxenaSiteId: data?.job_id, isActive: true, jobLocation: data?.jobLocation, jobCode: data?.jobCode, recruiterId: data?.recruiterId, companyId: data?.companyId } };
      const graphqlQueryObj = JSON.stringify({ query: CreateOneJob, variables: graphqlVariables });
      const responseNew = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Response from create job', responseNew.data);
      uuid = responseNew.data.data.createJob.id;
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
      const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
      const data = request.body;
      const arxenaJobId = data?.job_id;
      const jobName = data?.job_name;
      const jobObject:CandidateSourcingTypes.Jobs = await this.candidateService.getJobDetails(arxenaJobId,jobName, apiToken, );
      // console.log("getJobDetails:", jobObject);
      const questions = data?.questions || [];
      console.log('Number Questions:', questions?.length);
      for (const question of questions) {
        const graphqlVariables = { input: { name: question, jobsId: jobObject?.id } };
        const graphqlQueryObj = JSON.stringify({ query: createOneQuestion, variables: graphqlVariables });
        // console.log("graphqlQueryObj:", graphqlQueryObj);
        const response = await axiosRequest(graphqlQueryObj,apiToken);
        // console.log('Response from adding question:', response.data);
      }
      return { status: 'success' };
    } catch (error) {
      console.log('Error in add questions', error);
      return { error: error.message };
    }
  }
}


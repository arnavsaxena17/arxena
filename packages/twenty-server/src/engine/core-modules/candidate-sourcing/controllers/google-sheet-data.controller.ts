import moment from 'moment-timezone';
import { Body, Controller, Get, InternalServerErrorException, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import {UpdateOneJob , CreateOneJob, createOneQuestion, graphqlToFindManyJobByArxenaSiteId, graphQltoStartChat } from '../graphql-queries';
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
import { graphqlToFetchActiveJob, graphqlToFetchAllCandidateData, graphQlToUpdateCandidate, mutationToUpdateOnePerson } from '../../arx-chat/graphql-queries/graphql-queries-chatbot';
import { CandidateSourcingController } from './candidate-sourcing.controller';

const workspacesToIgnore = ["20202020-1c25-4d02-bf25-6aeccf7ea419","3b8e6458-5fc1-4e63-8563-008ccddaa6db"];


@Controller('fetch-google-apps-data')
export class GoogleSheetsDataController {
  private googleSheetToJobMap: Map<string, string> = new Map();
  // private readonly dataSourceRepository: DataSourceService;

  private isProcessing = false;
  
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly chatService: ChatService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly sheetsService: GoogleSheetsService,
    private readonly personService: PersonService,
    private readonly candidateService: CandidateService,

  ) {
    this.initializeGoogleSheetJobMap();
  }

  private async initializeGoogleSheetJobMap() {
    try {
      await this.updateGoogleSheetJobMap();
    } catch (error) {
      console.error('Error initializing Google Sheet to Job map:', error);
    }
  }


  @Cron(CronExpression.EVERY_5_MINUTES)
  private async updateGoogleSheetJobMap() {
    if (this.isProcessing) {
      console.log('Previous mapping update still running, skipping this run');
      return;
    }

    try {
      this.isProcessing = true;
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: {
          workspaceId: In(workspaceIds),
        },
      });

      const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
      const filteredWorkspaceIds = Array.from(workspaceIdsWithDataSources).filter(workspaceId => !workspacesToIgnore.includes(workspaceId));
      for (const workspaceId of filteredWorkspaceIds) {
        if (!workspaceId) {
          throw new Error('Workspace ID not found');
        }
        const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
        const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema);

        if (apiKeys.length > 0) {
          const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
            workspaceId, 
            apiKeys[0].id, 
            apiKeys[0].expiresAt
          );

          if (apiKeyToken) {
            // Fetch all jobs for this workspace
            const response = await this.candidateService.getJobDetails('', '', apiKeyToken.token);
            if (response?.googleSheetId) {
              this.googleSheetToJobMap.set(response.googleSheetId, response.id);
            }
          }
        }
      }
    } catch (error) {
      console.log('Error updating Google Sheet to Job map:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  @Get('get-data')
  getData() {
    console.log("Get ata has been called lets see what we get");
    sheetToJobMap: Object.fromEntries(this.googleSheetToJobMap);
    return { };
  }
  @Post('enrichment-data')
  async enrichmentData(@Body() body: any) {
    console.log('Called Enrichmetn Data with Request Body:', body);
    console.log('Request Body:', body);

    const enrichmentPayload = {
      enrichments: body,
      objectNameSingular: body[0]?.objectNameSingular || '',
      availableSortDefinitions: body[0]?.availableSortDefinitions || [],
      availableFilterDefinitions: body[0]?.availableFilterDefinitions || [],
      objectRecordId: body[0]?.objectRecordId || '',
      selectedRecordIds: body[0]?.selectedRows?.map(row => row[0]) || [] // Transform selectedRows to selectedRecordIds
    };

    
    const spreadsheetId = body[0]?.googleSheetId; // Adjust this based on your actual payload structure
    console.log("got spreadsheet Id:", spreadsheetId);
    // Get workspace token
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(spreadsheetId);
    if (!tokenData || !tokenData.token) {
      throw new Error('Unable to get valid workspace token');
    }

    console.log("got Token Data:", tokenData);


    const candidateSourcingController = new CandidateSourcingController(
      this.sheetsService,
      this.workspaceQueryService,
      this.personService, 
      this.candidateService,
      this.processCandidatesService,
      this.chatService
    );
    console.log("candidateSourcingController:", candidateSourcingController);

    const result = await candidateSourcingController.createEnrichments({
      body: enrichmentPayload,
      headers: {
        authorization: `Bearer ${tokenData.token}`
      }
    });
    console.log("Respult reaceieved:", result);
    return result;
    }

  private async getWorkspaceTokenForGoogleSheet(spreadsheetId: string) {
    console.log("gpong to get workspace token for google sheet with id :", spreadsheetId);
    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema, transactionManager) => {
        // Query to find the Google Sheet integration record
        console.log("workspaceId:", workspaceId);
        const sheetIntegration = await this.workspaceQueryService.executeRawQuery(
          `SELECT * FROM ${dataSourceSchema}."_job" 
           WHERE "googleSheetId" = $1`,
          [spreadsheetId],
          workspaceId,
          transactionManager
        );
        console.log("sheetIntegration:::[]", sheetIntegration);
        if (sheetIntegration.length > 0) {
          // Get API keys for the workspace
          const apiKeys = await this.workspaceQueryService.getApiKeys(
            workspaceId, 
            dataSourceSchema, 
            transactionManager
          );
          if (apiKeys.length > 0) {
            // Generate token using the first available API key
            const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
              workspaceId,
              apiKeys[0].id,
              apiKeys[0].expiresAt
            );
            return apiKeyToken ? {
              token: apiKeyToken.token,
              workspaceId,
              integrationId: sheetIntegration[0].id
            } : null;
          }
        }
        return null;
      }
    );
  
    // Return first non-null result
    return results.find(result => result !== null);
  }
  

  @Post('post-batch-data')
  async postBatchData(@Body() data: { 
      spreadsheetId: string, 
      updates: Array<{
          candidateId: string,
          personId: string,
          field: string,
          value: any
      }>
  }) {
      console.log("Batch data received:", data);
      
      const tokenData = await this.getWorkspaceTokenForGoogleSheet(data.spreadsheetId);
      if (!tokenData) {
          throw new Error('No valid workspace found for this spreadsheet');
      }


  
      // Group updates by both candidateId and personId
      const updates = data.updates.reduce((acc, update) => {
          if (!acc[update.candidateId]) {
              acc[update.candidateId] = {
                  candidateUpdates: {},
                  personUpdates: {},
                  personId: update.personId
              };
          }
          console.log("update.field:", update.field);
          
          // Determine if the field belongs to person or candidate
          if (this.isPersonField(update.field)) {
            
              acc[update.candidateId].personUpdates[update.field] = update.value;
          } else {
              acc[update.candidateId].candidateUpdates[update.field] = update.value;
          }
          console.log("Acc:", acc);
          return acc;
      }, {} as Record<string, {
          candidateUpdates: Record<string, any>,
          personUpdates: Record<string, any>,
          personId: string
      }>);
      
      console.log("updates:", updates);
      const results: Array<{
          candidateId: string;
          personId: string;
          success: boolean;
          timestamp?: string;
          error?: any
      }> = [];
  
      const candidateIds = Object.keys(updates);
      const batchSize = 10;
  
      for (let i = 0; i < candidateIds.length; i += batchSize) {
          const batch = candidateIds.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (candidateId) => {
              try {
                  const updateData = updates[candidateId];
                  
                  // Update candidate if there are candidate fields
                  if (Object.keys(updateData.candidateUpdates).length > 0) {
                      const candidateUpdateMutation = {
                          query: graphQlToUpdateCandidate,
                          variables: {
                              idToUpdate: candidateId,
                              input: updateData.candidateUpdates
                          }
                      };
  
                      await axiosRequest(
                          JSON.stringify(candidateUpdateMutation),
                          tokenData.token
                      );
                  }
  
                  // Update person if there are person fields
                  if (Object.keys(updateData.personUpdates).length > 0 && updateData.personId) {
                      const personUpdateMutation = {
                          query: mutationToUpdateOnePerson, // You'll need to define this
                          variables: {
                              idToUpdate: updateData.personId,
                              input: updateData.personUpdates
                          }
                      };
  
                      await axiosRequest(
                          JSON.stringify(personUpdateMutation),
                          tokenData.token
                      );
                  }
  
                  return {
                      candidateId,
                      personId: updateData.personId,
                      success: true,
                      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
                  };
  
              } catch (error) {
                  console.error(`Error processing update for candidateId ${candidateId}:`, error);
                  return {
                      candidateId,
                      personId: updates[candidateId].personId,
                      success: false,
                      error: error.message
                  };
              }
          });
  
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
      }
  
      return {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results: results
      };
  }
  
  // Helper method to determine if a field belongs to person
  private isPersonField(field: string): boolean {
      const personFields = [
          'phone_numbers',
      ];
      return personFields.includes(field);
  }
  
  
  private transformData(data: { [key: string]: any }): Partial<CandidateSourcingTypes.ArxenaCandidateNode> {
    const transformedData: Partial<CandidateSourcingTypes.ArxenaCandidateNode> = {};
    
    // Only transform fields that exist in the input data
    if (data.full_name) transformedData.name = data.full_name.trim();
    if (data.unique_key_string) transformedData.uniqueStringKey = data.unique_key_string;
    if (data.profile_url) {
      transformedData.hiringNaukriUrl = {
        label: data.profile_url,
        url: data.profile_url
      };
    }
    if (data.startChat) {
      transformedData.startChat = data.startChat === 'TRUE';
    }
    if (data.startVideoInterviewChat) {
      transformedData.startVideoInterviewChat = data.startVideoInterviewChat === 'TRUE';
    }
    if (data.startMeetingSchedulingChat) {
      transformedData.startMeetingSchedulingChat = data.startMeetingSchedulingChat === 'TRUE';
    }
    if (data.stopChat) {
      transformedData.stopChat = data.stopChat === 'TRUE';
    }
    if (data.display_picture) {
      transformedData.displayPicture = {
        label: 'Display Picture',
        url: data.display_picture
      };
    }
  
    return transformedData;
  }
  
  @Post('post-data')
  async postData(@Body() data: { spreadsheetId: string, full_name: string, UniqueKey: string }) {
    console.log("data:::::", data);
    const tokenData = await this.getWorkspaceTokenForGoogleSheet(data.spreadsheetId);
    console.log("tokenData:::::", tokenData);
    if (!tokenData) {
      throw new Error('No valid workspace found for this spreadsheet');
    }
    const candidateQuery = { query: graphqlToFetchAllCandidateData, variables: { filter: { uniqueStringKey: { eq: data.UniqueKey }, }, limit: 1 } };
    
    const candidateResponse = await axiosRequest(
      JSON.stringify(candidateQuery),
      tokenData?.token || ''
    );
    
    const candidate = candidateResponse.data?.data?.candidates?.edges[0]?.node;
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
    
    const updateMutation = {
      query: graphQlToUpdateCandidate,
      variables: {
      idToUpdate: candidate.id,
      input: data
      }
    };
    
      // Execute update mutation
      const updateResponse = await axiosRequest(
        JSON.stringify(updateMutation),
        tokenData?.token || ''
      );
    
      if (updateResponse.data?.errors) {
        throw new InternalServerErrorException('Failed to update candidate');
      }
    
      return {
        success: true,
        candidateId: candidate.id,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
  
    } 
  


  private async transformCandidateData(data: any) {
    const transformed = {};
    
    for (const def of CandidateSourcingTypes.columnDefinitions) {
      if (data[def.key]) {
        if (def.format) {
          transformed[def.key] = def.format(data[def.key]);
        } else {
          transformed[def.key] = data[def.key];
        }
      }
    }
  
    return transformed;
  }
  
  
  private async updateCandidateData(candidateId: string, data: any, apiToken: string) {
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        ...data,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    if (response.data.errors) {
      throw new Error(`Error updating candidate: ${JSON.stringify(response.data.errors)}`);
    }     
    return response.data;
  }
}
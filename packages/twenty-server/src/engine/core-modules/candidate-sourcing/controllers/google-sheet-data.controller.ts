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
import { graphqlToFetchActiveJob, graphqlToFetchAllCandidatesByStartChat, graphQlToUpdateCandidate } from '../../arx-chat/services/candidate-engagement/graphql-queries-chatbot';



@Controller('fetch-google-apps-data')
export class GoogleSheetsDataController {
  private googleSheetToJobMap: Map<string, string> = new Map();
  // private readonly dataSourceRepository: DataSourceService;

  private isProcessing = false;
  
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
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
      
      for (const workspaceId of workspaceIdsWithDataSources) {
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
      console.error('Error updating Google Sheet to Job map:', error);
    } finally {
      this.isProcessing = false;
    }
  }



  @Post('get-data')
  getData() {


    sheetToJobMap: Object.fromEntries(this.googleSheetToJobMap)


    return {
    
    };
  }

  private async getWorkspaceTokenForGoogleSheet(spreadsheetId: string) {
    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema, transactionManager) => {
        // Query to find the Google Sheet integration record
        const sheetIntegration = await this.workspaceQueryService.executeRawQuery(
          `SELECT * FROM ${dataSourceSchema}."_job" 
           WHERE "googleSheetId" = $1`,
          [spreadsheetId],
          workspaceId,
          transactionManager
        );
        console.log("sheetIntegration", sheetIntegration);
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
  

  private transformData(data: { [key: string]: any }): { [key: string]: any } {
    const transformedData: { [key: string]: any } = {};
  
    for (const [key, value] of Object.entries(data)) {
      // Convert snake_case to camelCase
      const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      
      // Find corresponding column definition
      const columnDef = CandidateSourcingTypes.columnDefinitions.find(def => def.key === key);
  
      if (columnDef?.format) {
        // Apply format function if it exists
        transformedData[camelCaseKey] = columnDef.format(value);
      } else {
        // If no format function, just convert the key and pass the value
        transformedData[camelCaseKey] = value;
      }
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

    const { spreadsheetId, ...dataToTransform } = data;

    const transformedData = this.transformData(dataToTransform);
  
    const candidateQuery = {
      query: graphqlToFetchAllCandidatesByStartChat,
      variables: {
        filter: {
          uniqueStringKey: { equals: data.UniqueKey },
        },
        limit: 1
      }
    };
  
    const candidateResponse = await axiosRequest(
      JSON.stringify(candidateQuery),
      tokenData?.token || ''
    );
  
    const candidate = candidateResponse.data?.data?.candidates?.edges[0]?.node;
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }
  
  
      // Find candidate using GraphQL query
      const updateMutation = {
        query: graphQlToUpdateCandidate,
        variables: {
          idToUpdate: candidate.id,
          input: transformedData
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



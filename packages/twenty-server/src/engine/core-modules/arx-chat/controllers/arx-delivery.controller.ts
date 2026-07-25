import {
  Controller,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
  
  import {
  createManyShortlistsMutation,
  createShortlistMutation,
  findManyShortlistsquery,
  graphqlToFetchAllCandidateData,
  graphqlToFindManyProjects,

  queries,

  updateOneShortlistMutation
} from 'twenty-shared';
  
  import { CandidateDataProcessorService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-data-processor.service';
import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { DocumentTemplateService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/document-template.service';
import { EngagedCandidateQueueService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-queue.service';
import { GmailDraftShortlistQueueService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/gmail-draft-shortlist-queue.service';
import { ShortlistDocumentService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/shortlist-document.service';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { createProjectIdErrorResponse, validateAndExtractProjectId } from 'src/engine/core-modules/candidate-sourcing/utils/project-id.utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
  
  @Controller('arx-delivery')
  export class ArxDeliveryEndpoint {
    constructor(
      private readonly candidateService: CandidateService,
      private readonly workspaceQueryService: WorkspaceQueryService,
      private readonly candidateEngagementArx: CandidateEngagementArx,
      private readonly staticGraphQLService: StaticGraphQLService,
      private readonly engagedCandidateQueueService: EngagedCandidateQueueService,
      private readonly gmailDraftShortlistQueueService: GmailDraftShortlistQueueService,

      private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
      private readonly updateChat: UpdateChat,
    ) {}
  


  
    @Post('create-shortlist-document')
    @UseGuards(JwtAuthGuard)
    async createShortlistDocument(@Req() request: any): Promise<object> {
      try {
        const { candidateIds } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        console.log(
          'going to refresh chat counts by candidate Ids',
          candidateIds,
        );
        await this.updateChat.createShortlistDocument(
          candidateIds,
          apiToken,
        );
        console.log(
          'This is the response in create createShortlistDocument shortlist',
        );
  
        return { status: 'Success' };
      } catch (err) {
        console.error('Error in create_gmail_draft_shortlist chats:', err);
  
        return { status: 'Failed', error: err };
      }
    }

    @Post('chat-based-shortlist-delivery')
    @UseGuards(JwtAuthGuard)
    async chatBasedShortlistDelivery(@Req() request: any): Promise<object> {
      try {
        const { candidateIds } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
        const origin = request.body.origin;
        console.log(
          'going to refresh chat counts by candidate Ids',
          candidateIds,
        );
        await this.updateChat.createChatBasedShortlistDelivery(candidateIds, origin, apiToken);
        console.log(
          'This is the response in create chatBasedShortlistDelivery shortlist',
        );
  
        return { status: 'Success' };
      } catch (err) {
        console.error('Error in create_gmail_draft_shortlist chats:', err);
  
        return { status: 'Failed', error: err };
      }
    }
  
    @Post('create-gmail-draft-shortlist')
    @UseGuards(JwtAuthGuard)
    async chatGmailDraftShortlist(@Req() request: any): Promise<object> {
      try {
        console.log("create-gmail-draft-shortlist called");
        const { candidateIds } = request.body;
        const origin = request.body.origin;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
        
        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
          return { success: false, error: 'Invalid candidate IDs provided' };
        }
  
        console.log('Creating Gmail draft shortlist for candidates:', candidateIds);
        console.log('Number of candidate IDs:', candidateIds.length);
        
        // Queue the Gmail draft creation
        await this.gmailDraftShortlistQueueService.send(candidateIds, origin, apiToken);
        
        console.log('Successfully queued Gmail draft shortlist creation');
        return { 
          success: true, 
          message: 'Gmail draft shortlist creation queued successfully',
          status: 'queued'
        };
      } catch (err) {
        console.error('Error in create gmail draft shortlist:', err);
        return { 
          success: false, 
          error: err.message || 'Failed to create Gmail draft shortlist' 
        };
      }
    }
  
    @Post('create-shortlist-candidates')
    @UseGuards(JwtAuthGuard)
    async createShortlistCandidates(@Req() request: any): Promise<object> {
      try {
        console.log('Create shortlist candidates called');
        const { candidateIds, projectId } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
          return { success: false, error: 'Invalid candidate IDs provided' };
        }
  
        if (!projectId) {
          return { success: false, error: 'Project ID is required' };
        }
  
        console.log('Processing candidates for shortlist:', candidateIds);
        console.log('Project ID:', projectId);
  
        // Get job data
        const jobResponse = await this.staticGraphQLService.executeGraphQL(
          graphqlToFindManyProjects,
          { filter: { id: { eq: projectId } } },
          apiToken,
        );
  
        const job = jobResponse?.data?.data?.projects?.edges?.[0]?.node;
        if (!job) {
          return { success: false, error: 'Project not found' };
        }
  
        // Fetch candidate details
        const candidatesResponse = await this.staticGraphQLService.executeGraphQL(
          graphqlToFetchAllCandidateData,
          { filter: { id: { in: candidateIds } } },
          apiToken,
        );
  
        const candidates = candidatesResponse?.data?.data?.candidates?.edges?.map((edge: any) => edge.node) || [];
        if (candidates.length === 0) {
          return { success: false, error: 'No candidates found' };
        }
  
        // Process candidates with LLM using CandidateDataProcessorService
        const candidateDataProcessor = new CandidateDataProcessorService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          this.resumeReadParseUploadService,
        );
  
        const processedCandidates = await candidateDataProcessor.processCandidates(
          candidates,
          job,
          apiToken,
        );
  
        if (processedCandidates.length === 0) {
          return { success: false, error: 'No candidates processed successfully' };
        }
  
        // Create shortlist entries using ShortlistDocumentService
        const documentTemplateService = new DocumentTemplateService();
        const shortlistDocumentService = new ShortlistDocumentService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          candidateDataProcessor,
          documentTemplateService,
        );
  
        // Create shortlist document (this will also create shortlist entries)
        const result = await shortlistDocumentService.createShortlistDocument(
          job,
          candidateIds,
          apiToken,
          request.headers.origin || 'localhost',
          false, // Don't create Excel file for this endpoint
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        // Update existing shortlist entries with processed data
        await this.updateShortlistEntriesWithProcessedData(
          processedCandidates,
          job.id,
          apiToken,
        );
  
        console.log('Successfully created shortlist candidates:', processedCandidates.length);
  
        return {
          success: true,
          message: `Successfully processed ${processedCandidates.length} candidates`,
          processedCount: processedCandidates.length,
        };
      } catch (error) {
        console.error('Error creating shortlist candidates:', error);
        return {
          success: false,
          error: error.message || 'Failed to create shortlist candidates',
        };
      }
    }
  
    @Post('create-shortlist')
    @UseGuards(JwtAuthGuard)
    async createShortlist(@Req() request: any): Promise<object> {
      try {
        console.log('Create shortlist called');
        const { candidateIds } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        await this.updateChat.createShortlist(
          candidateIds,
          apiToken,
        );
  
        return { status: 'Success' };
      } catch (err) {
        console.error('Error creating shortlist:', err);
  
        return { status: 'Failed', error: err };
      }
    }
  
    @Post('create-interview-videos')
    @UseGuards(JwtAuthGuard)
    async createInterviewVideos(@Req() request: any): Promise<object> {
      try {
        console.log('Create video interview called');
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
        const projectId = request.body.projectId;
  
        const projectIdValidation = validateAndExtractProjectId(projectId);
        if (!projectIdValidation.isValid) {
          return createProjectIdErrorResponse(projectIdValidation.error!);
        }
  
        const actualProjectId = projectIdValidation.projectId!;
  
        await this.updateChat.createInterviewVideos(
          actualProjectId,
          apiToken,
        );
  
        return { status: 'Success' };
      } catch (err) {
        console.log('Error creating interview videos:', err);
  
        return { status: 'Failed', error: err };
      }
    }
  
 
  
    @Post('get-shortlists-by-candidate-ids')
    @UseGuards(JwtAuthGuard)
    async getShortlistsByCandidateIds(@Req() request: any): Promise<object> {
      try {
        const { candidateIds, projectId } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
          return { success: false, error: 'Invalid candidate IDs provided' };
        }
        console.log('Fetching shortlists for candidates:', candidateIds);
        console.log('Fetching shortlists for projectId :', projectId);
        // Fetch existing shortlists for the candidates
        const response = await this.staticGraphQLService.executeGraphQL(
          findManyShortlistsquery,
          {
            filter: { 
              candidateId: { in: candidateIds },
              projectId: { eq: projectId }
            },
            orderBy: [{ createdAt: 'DescNullsFirst' }],
          },
          apiToken,
        );
        console.log('Shortlists response from server:', response.data);
        const shortlists = response?.data?.data?.shortlists?.edges?.map((edge: any) => edge.node) || [];
        
        // Get candidate IDs that already have shortlists
        const existingCandidateIds = shortlists.map((shortlist: any) => shortlist.candidateId);
        console.log('Existing candidate IDs:', existingCandidateIds);
        // Find candidate IDs that don't have shortlists
        const candidatesWithoutShortlists = candidateIds.filter((candidateId: string) => 
          !existingCandidateIds.includes(candidateId)
        );
        console.log('Candidates without shortlists:', candidatesWithoutShortlists);
        // If some candidates don't have shortlists, create them
        if (candidatesWithoutShortlists.length > 0) {
          console.log('Creating shortlists for candidates without existing ones:', candidatesWithoutShortlists);
          console.log('Project ID:', projectId);
          // Get candidate data for candidates without shortlists
          const candidates = await this.candidateEngagementArx.fetchAllCandidatesWithAllChatControlsByProjectId(projectId, apiToken);
          const filteredCandidates = candidates.filter((candidate: any) => 
            candidatesWithoutShortlists.includes(candidate.id)
          );
          console.log('Filtered candidates:', filteredCandidates);
          if (filteredCandidates.length === 0) {
            console.log('No candidate data found for IDs:', candidatesWithoutShortlists);
          } else {
            // Create shortlist data for candidates without shortlists
            const shortlistData = filteredCandidates.map((candidate: any) => ({
              candidateId: candidate.id,
              projectId: projectId,
              name: candidate.name || candidate.fullName || '',
              age: '',
              yearsOfExperience: '',
              educationalQualifications: '',
              universityCollege: '',
              currentJobTitle: '',
              currentCompany: '',
              currentLocation: '',
              currentRoleDescription: '',
              reportsTo: '',
              functionsReportingTo: '',
              reasonForLeaving: '',
              currentSalary: '',
              expectedSalary: '',
              noticePeriod: '',
            }));
            console.log('Shortlist data:', shortlistData);
            // Create shortlists using bulk mutation
            const createResponse = await this.staticGraphQLService.executeGraphQL(
              createManyShortlistsMutation,
              {
                data: shortlistData,
              },
              apiToken,
            );
            console.log('Created shortlists:', createResponse.data);
            const createdShortlists = createResponse?.data?.data?.createShortlists || [];
            console.log('Created shortlists for candidates:', createdShortlists.length);
            
            // Add newly created shortlists to the existing ones
            shortlists.push(...createdShortlists);
          }
        }
        console.log('Shortlists:', shortlists);
        
        return {
          success: true,
          shortlists,
        };
      } catch (error) {
        console.error('Error fetching shortlists by candidate IDs:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch shortlists',
        };
      }
    }
  
    @Post('save-shortlist-data')
    @UseGuards(JwtAuthGuard)
    async saveShortlistData(@Req() request: any): Promise<object> {
      try {
        const { shortlistData, projectId } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        if (!shortlistData || !Array.isArray(shortlistData)) {
          return { success: false, error: 'Invalid shortlist data provided' };
        }
        console.log('Shortlist data:', shortlistData);
  
        // Process each shortlist entry
        for (const shortlist of shortlistData) {
          if (shortlist.id) {
            console.log('Shortlist to update:', shortlist.id);
            // Update existing shortlist
            await this.staticGraphQLService.executeGraphQL(
              updateOneShortlistMutation,
              {
                idToUpdate: shortlist.id,
                input: {
                  name: shortlist.name,
                  age: shortlist.age,
                  yearsOfExperience: shortlist.yearsOfExperience,
                  educationalQualifications: shortlist.educationalQualifications,
                  universityCollege: shortlist.universityCollege,
                  currentJobTitle: shortlist.currentJobTitle,
                  currentCompany: shortlist.currentCompany,
                  currentLocation: shortlist.currentLocation,
                  currentRoleDescription: shortlist.currentRoleDescription,
                  reportsTo: shortlist.reportsTo,
                  functionsReportingTo: shortlist.functionsReportingTo,
                  reasonForLeaving: shortlist.reasonForLeaving,
                  currentSalary: shortlist.currentSalary,
                  expectedSalary: shortlist.expectedSalary,
                  noticePeriod: shortlist.noticePeriod,
                },
              },
              apiToken,
            );
          } else {
            console.log('Shortlist to create:', shortlist.candidateId);
            // Create new shortlist
            await this.staticGraphQLService.executeGraphQL(
              createShortlistMutation,
              {
                input: {
                  candidateId: shortlist.candidateId,
                  projectId: projectId,
                  name: shortlist.name,
                  age: shortlist.age,
                  yearsOfExperience: shortlist.yearsOfExperience,
                  educationalQualifications: shortlist.educationalQualifications,
                  universityCollege: shortlist.universityCollege,
                  currentJobTitle: shortlist.currentJobTitle,
                  currentCompany: shortlist.currentCompany,
                  currentLocation: shortlist.currentLocation,
                  currentRoleDescription: shortlist.currentRoleDescription,
                  reportsTo: shortlist.reportsTo,
                  functionsReportingTo: shortlist.functionsReportingTo,
                  reasonForLeaving: shortlist.reasonForLeaving,
                  currentSalary: shortlist.currentSalary,
                  expectedSalary: shortlist.expectedSalary,
                  noticePeriod: shortlist.noticePeriod,
                },
              },
              apiToken,
            );
          }
        }
  
        return {
          success: true,
          message: 'Shortlist data saved successfully',
        };
      } catch (error) {
        console.error('Error saving shortlist data:', error);
        return {
          success: false,
          error: error.message || 'Failed to save shortlist data',
        };
      }
    }
  
    @Post('download-shortlist-excel')
    @UseGuards(JwtAuthGuard)
    async downloadShortlistExcel(@Req() request: any): Promise<object> {
      try {
        const { shortlistData, projectId } = request.body;
        const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
  
        if (!shortlistData || !Array.isArray(shortlistData)) {
          return { success: false, error: 'Invalid shortlist data provided' };
        }
  
        // Create Excel file using the shortlist document service
        const shortlistDocumentService = new ShortlistDocumentService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          new CandidateDataProcessorService(this.workspaceQueryService, this.staticGraphQLService, this.resumeReadParseUploadService ),
          new DocumentTemplateService(),
        );
  
        // Get job data
        const jobResponse = await this.staticGraphQLService.executeGraphQL(
          queries.graphqlToFindManyProjects,
          { filter: { id: { eq: projectId } } },
          apiToken,
        );
  
        const job = jobResponse?.data?.data?.projects?.edges?.[0]?.node;
        if (!job) {
          return { success: false, error: 'Project not found' };
        }
  
        // Create Excel file using the public method
        const result = await shortlistDocumentService.createShortlistDocument(
          job,
          shortlistData.map(data => data.candidateId),
          apiToken,
          request.headers.origin || 'localhost',
          true, // Create Excel file
        );
  
        if (!result.success || !result.excel_path) {
          return { success: false, error: 'Failed to create Excel file' };
        }
  
        const excelPath = result.excel_path;
  
        // Read and return the file
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(excelPath);
  
        return {
          success: true,
          fileBuffer: fileBuffer.toString('base64'),
          fileName: `shortlist-${Date.now()}.xlsx`,
        };
      } catch (error) {
        console.error('Error downloading shortlist Excel:', error);
        return {
          success: false,
          error: error.message || 'Failed to download Excel file',
        };
      }
    }
  
  @Post('download-shortlist-document')
  @UseGuards(JwtAuthGuard)
  async downloadShortlistDocument(@Req() request: any): Promise<object> {
    try {
      const { candidateIds, projectId } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return { success: false, error: 'Invalid candidate IDs provided' };
      }

      // Get job data
      const jobResponse = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyProjects,
        { filter: { id: { eq: projectId } } },
        apiToken,
      );

      const job = jobResponse?.data?.data?.projects?.edges?.[0]?.node;
      if (!job) {
        return { success: false, error: 'Project not found' };
      }

      // Create shortlist document
      const shortlistDocumentService = new ShortlistDocumentService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        new CandidateDataProcessorService(this.workspaceQueryService, this.staticGraphQLService, this.resumeReadParseUploadService),
        new DocumentTemplateService(),
      );

      const result = await shortlistDocumentService.createShortlistDocument(
        job,
        candidateIds,
        apiToken,
        request.headers.origin || 'localhost',
        false, // Don't create Excel file
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Read and return the file
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(result.shortlist_path);

      return {
        success: true,
        fileBuffer: fileBuffer.toString('base64'),
        fileName: `shortlist-document-${Date.now()}.docx`,
      };
    } catch (error) {
      console.error('Error downloading shortlist document:', error);
      return {
        success: false,
        error: error.message || 'Failed to download shortlist document',
      };
    }
  }

  @Post('download-shortlist-document-quick')
  @UseGuards(JwtAuthGuard)
  async downloadShortlistDocumentQuick(@Req() request: any): Promise<object> {
    try {
      const { candidateIds, projectId } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return { success: false, error: 'Invalid candidate IDs provided' };
      }

      if (!projectId) {
        return { success: false, error: 'Project ID is required' };
      }

      // Create shortlist document service (no need for CandidateDataProcessorService for this endpoint)
      const shortlistDocumentService = new ShortlistDocumentService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        new CandidateDataProcessorService(this.workspaceQueryService, this.staticGraphQLService, this.resumeReadParseUploadService),
        new DocumentTemplateService(),
      );

      // Create document from existing shortlist data (no processing)
      const result = await shortlistDocumentService.createWordDocumentFromExistingShortlist(
        candidateIds,
        projectId,
        apiToken,
        request.headers.origin || 'localhost',
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Read and return the file
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(result.shortlist_path);

      return {
        success: true,
        fileBuffer: fileBuffer.toString('base64'),
        fileName: `shortlist-document-${Date.now()}.docx`,
      };
    } catch (error) {
      console.error('Error downloading shortlist document (quick):', error);
      return {
        success: false,
        error: error.message || 'Failed to download shortlist document',
      };
    }
  }

  private async updateShortlistEntriesWithProcessedData(
    processedCandidates: any[],
    projectId: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log('Updating shortlist entries with processed data for job:', projectId);
      
      for (const processedCandidate of processedCandidates) {
        try {
          // Find existing shortlist entry for this candidate and job
          const existingShortlistResponse = await this.staticGraphQLService.executeGraphQL(
            findManyShortlistsquery,
            { 
              filter: { 
                candidateId: { eq: processedCandidate.candidate_id },
                projectId: { eq: projectId }
              } 
            },
            apiToken,
          );

          const existingShortlist = existingShortlistResponse?.data?.data?.shortlists?.edges?.[0]?.node;
          
          if (existingShortlist && processedCandidate.candidate_obj) {
            console.log(`Updating shortlist entry for candidate ${processedCandidate.candidate_id}: ${existingShortlist.id}`);
            
            // Extract data from processed candidate object
            const candidateData = processedCandidate.candidate_obj;
            console.log(`Candidate data from LLM for ${processedCandidate.candidate_id}:`, candidateData);
            
            // Update the shortlist entry with processed data
            // Field names now match between LLM response and shortlist schema
            const updateInput = {
              name: candidateData.name || existingShortlist.name,
              age: candidateData.age !== undefined ? String(candidateData.age) : existingShortlist.age,
              yearsOfExperience: candidateData.yearsOfExperience !== undefined ? String(candidateData.yearsOfExperience) : existingShortlist.yearsOfExperience,
              educationalQualifications: candidateData.educationalQualifications || existingShortlist.educationalQualifications,
              universityCollege: candidateData.universityCollege || existingShortlist.universityCollege,
              currentJobTitle: candidateData.currentJobTitle || existingShortlist.currentJobTitle,
              currentCompany: candidateData.currentCompany || existingShortlist.currentCompany,
              currentLocation: candidateData.currentLocation || existingShortlist.currentLocation,
              currentRoleDescription: candidateData.currentRoleDescription || existingShortlist.currentRoleDescription,
              reportsTo: candidateData.reportsTo || existingShortlist.reportsTo,
              functionsReportingTo: candidateData.functionsReportingTo || existingShortlist.functionsReportingTo,
              reasonForLeaving: candidateData.reasonForLeaving || existingShortlist.reasonForLeaving,
              currentSalary: candidateData.currentSalary || existingShortlist.currentSalary,
              expectedSalary: candidateData.expectedSalary || existingShortlist.expectedSalary,
              noticePeriod: candidateData.noticePeriod || existingShortlist.noticePeriod,
            };
            
            console.log(`Update input for candidate ${processedCandidate.candidate_id}:`, updateInput);
            
            await this.staticGraphQLService.executeGraphQL(
              updateOneShortlistMutation,
              {
                idToUpdate: existingShortlist.id,
                input: updateInput,
              },
              apiToken,
            );
            
            console.log(`Successfully updated shortlist entry for candidate ${processedCandidate.candidate_id}`);
          } else {
            console.log(`No existing shortlist entry found for candidate ${processedCandidate.candidate_id}`);
          }
        } catch (error) {
          console.error(`Error updating shortlist entry for candidate ${processedCandidate.candidate_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error updating shortlist entries with processed data:', error);
    }
  }

}
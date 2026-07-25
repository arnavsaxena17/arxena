import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  createCvsentMutation,
  createShortlistMutation,
  graphqlQueryToFindCvsent,
  graphqlQueryToFindShortlists,
  graphqlToFetchAllCandidateData,
  graphqlToFindManyProjects,
} from 'twenty-shared';
import * as XLSX from 'xlsx';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CandidateDataProcessorService, ProcessedCandidate } from './candidate-data-processor.service';
import { CandidateData, DocumentTemplateService, PositionInfo } from './document-template.service';

export interface ShortlistDocumentResult {
  shortlist_path: string;
  excel_path?: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class ShortlistDocumentService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly candidateDataProcessor: CandidateDataProcessorService,
    private readonly documentTemplateService: DocumentTemplateService,
  ) {}

  async createShortlistDocument(
    job: any,
    candidateIds: string[],
    apiToken: string,
    origin: string,
    createExcelFile: boolean = false,
  ): Promise<ShortlistDocumentResult> {
    try {
      console.log('Creating shortlist document for job:', job.name);
      console.log('Candidate IDs:', candidateIds);

      // Step 1: Create CV sent record
      const cvSentId = await this.createCvSent(job, apiToken);
      if (!cvSentId) {
        return {
          shortlist_path: '',
          success: false,
          error: 'Failed to create CV sent record',
        };
      }

      // Step 2: Fetch candidate details
      const candidates = await this.fetchCandidatesWithIds(candidateIds, apiToken);
      if (candidates.length === 0) {
        return {
          shortlist_path: '',
          success: false,
          error: 'No candidates found',
        };
      }

      // Step 3: Process candidates with LLM
      const processedCandidates = await this.candidateDataProcessor.processCandidates(
        candidates,
        job,
        apiToken,
      );

      if (processedCandidates.length === 0) {
        return {
          shortlist_path: '',
          success: false,
          error: 'No candidates processed successfully',
        };
      }

      // Step 4: Create shortlist entries in Twenty
      await this.createShortlistEntries(
        cvSentId,
        processedCandidates,
        candidates,
        apiToken,
        job.id,
      );

      // Step 5: Fetch shortlist data from database
      const shortlistData = await this.fetchShortlistData(job.id, apiToken);
      if (shortlistData.length === 0) {
        return {
          shortlist_path: '',
          success: false,
          error: 'No shortlist data found after creation',
        };
      }

      // Step 6: Create Excel file (only if requested)
      let excelPath: string | undefined;
      if (createExcelFile) {
        excelPath = await this.createExcelFile(
          shortlistData,
          job,
          cvSentId,
        );
      }
      console.log('shortlistData created:', shortlistData);

      // Step 7: Create Word document using shortlist data
      const shortlistPath = await this.createWordDocument(
        shortlistData,
        job,
        origin,
        apiToken,
      );

      return {
        shortlist_path: shortlistPath,
        excel_path: excelPath,
        success: true,
      };
    } catch (error) {
      console.error('Error creating shortlist document:', error);
      return {
        shortlist_path: '',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  private async createCvSent(job: any, apiToken: string): Promise<string | null> {
    try {
      // First, check if CV sent record already exists for this job
      const existingCvSentResponse = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindCvsent,
        { filter: { projectId: { eq: job.id } } },
        apiToken,
      );

      const existingCvSent = existingCvSentResponse?.data?.data?.cvsent?.edges?.[0]?.node;
      
      if (existingCvSent) {
        console.log(`Found existing CV sent record: ${existingCvSent.id}`);
        return existingCvSent.id;
      }

      // Create new CV sent record if none exists
      const cvSentData = {
        input: {
          projectId: job.id,
          name: `CV Sent - ${job.name}`,
          position: "first",
        },
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        createCvsentMutation,
        cvSentData,
        apiToken,
      );

      return response?.data?.data?.createCvSent?.id || null;
    } catch (error) {
      console.error('Error creating CV sent:', error);
      return null;
    }
  }

  private async fetchCandidatesWithIds(
    candidateIds: string[],
    apiToken: string,
  ): Promise<any[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        { filter: { id: { in: candidateIds } } },
        apiToken,
      );

      return response?.data?.data?.candidates?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }
  }

  private async fetchShortlistData(
    projectId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindShortlists,
        { filter: { projectId: { eq: projectId } } },
        apiToken,
      );

      return response?.data?.data?.shortlists?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error('Error fetching shortlist data:', error);
      return [];
    }
  }

  private async fetchShortlistDataByCandidateIds(
    candidateIds: string[],
    projectId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindShortlists,
        { 
          filter: { 
            candidateId: { in: candidateIds },
            projectId: { eq: projectId }
          } 
        },
        apiToken,
      );

      return response?.data?.data?.shortlists?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error('Error fetching shortlist data by candidate IDs:', error);
      return [];
    }
  }

  private async createShortlistEntries(
    cvSentId: string,
    processedCandidates: ProcessedCandidate[],
    originalCandidates: any[],
    apiToken: string,
    projectId: string,
  ): Promise<void> {
    try {
      const candidateDetails: Record<string, any> = {};
      originalCandidates.forEach(candidate => {
        if (candidate.id) {
          candidateDetails[candidate.id] = candidate;
        }
      });

      for (const processedCandidate of processedCandidates) {
        try {
          // First, check if shortlist entry already exists for this candidate and job
          const existingShortlistResponse = await this.staticGraphQLService.executeGraphQL(
            graphqlQueryToFindShortlists,
            { 
              filter: { 
                candidateId: { eq: processedCandidate.candidate_id },
                projectId: { eq: projectId }
              } 
            },
            apiToken,
          );

          const existingShortlist = existingShortlistResponse?.data?.data?.shortlists?.edges?.[0]?.node;
          
          if (existingShortlist) {
            console.log(`Found existing shortlist entry for candidate ${processedCandidate.candidate_id}: ${existingShortlist.id}`);
            continue; // Skip creating duplicate entry
          }

          // Get candidate data for shortlist creation
          const candidateData = candidateDetails[processedCandidate.candidate_id];
          const candidateObj = processedCandidate.candidate_obj || candidateData;

          // Create shortlist entry with proper GraphQL mutation
          const shortlistData = {
            input: {
              candidateId: processedCandidate.candidate_id,
              projectId: projectId,
              cvSentsId: cvSentId,
              name: candidateObj.name || 'Unknown Candidate',
              age: candidateObj.age || 0,
              yearsOfExperience: candidateObj.yearsOfExperience || 0,
              educationalQualifications: candidateObj.educationalQualifications || '',
              universityCollege: candidateObj.universityCollege || '',
              currentJobTitle: candidateObj.currentJobTitle || '',
              currentCompany: candidateObj.currentCompany || '',
              currentLocation: candidateObj.currentLocation || '',
              currentRoleDescription: candidateObj.currentRoleDescription || '',
              reportsTo: candidateObj.reportsTo || '',
              functionsReportingTo: candidateObj.functionsReportingTo || '',
              reasonForLeaving: candidateObj.reasonForLeaving || '',
              currentSalary: candidateObj.currentSalary || '',
              expectedSalary: candidateObj.expectedSalary || '',
              noticePeriod: candidateObj.noticePeriod || '',
            },
          };

          const response = await this.staticGraphQLService.executeGraphQL(
            createShortlistMutation,
            shortlistData,
            apiToken,
          );

          if (response?.data?.data?.createShortlist?.id) {
            console.log(`Created shortlist entry for candidate ${processedCandidate.candidate_id}: ${response.data.data.createShortlist.id}`);
          } else {
            console.error(`Failed to create shortlist entry for candidate ${processedCandidate.candidate_id}`);
          }
        } catch (error) {
          console.error(`Error creating shortlist entry for candidate ${processedCandidate.candidate_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error creating shortlist entries:', error);
    }
  }

  private async createExcelFile(
    shortlistData: any[],
    job: any,
    cvSentId: string,
  ): Promise<string> {
    try {
      // Create output directory
      const outputDir = path.join(process.cwd(), 'working_naukri_candidates', job.pathPosition || 'default', 'results', 'shortlist_document');
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Prepare data for Excel from shortlist data
      const excelData = shortlistData.map(shortlist => ({
        id: shortlist.candidateId,
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
        shortlist_id: shortlist.id,
        created_at: shortlist.createdAt,
        updated_at: shortlist.updatedAt,
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Shortlist');

      // Write Excel file
      const excelPath = path.join(outputDir, 'shortlist.xlsx');
      XLSX.writeFile(workbook, excelPath);

      console.log(`Excel file created: ${excelPath}`);
      return excelPath;
    } catch (error) {
      console.error('Error creating Excel file:', error);
      throw error;
    }
  }

  async createWordDocumentFromExistingShortlist(
    candidateIds: string[],
    projectId: string,
    apiToken: string,
    origin: string,
  ): Promise<ShortlistDocumentResult> {
    try {
      console.log('Creating shortlist document from existing data for job:', projectId);
      console.log('Candidate IDs:', candidateIds);

      // Step 1: Get job data
      const jobResponse = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyProjects,
        { filter: { id: { eq: projectId } } },
        apiToken,
      );

      const job = jobResponse?.data?.data?.projects?.edges?.[0]?.node;
      if (!job) {
        return {
          shortlist_path: '',
          success: false,
          error: 'Project not found',
        };
      }

      // Step 2: Fetch existing shortlist data for these candidates
      const shortlistData = await this.fetchShortlistDataByCandidateIds(
        candidateIds,
        projectId,
        apiToken,
      );

      if (shortlistData.length === 0) {
        return {
          shortlist_path: '',
          success: false,
          error: 'No shortlist data found for the specified candidates',
        };
      }

      // Step 3: Create Word document using existing shortlist data
      const shortlistPath = await this.createWordDocument(
        shortlistData,
        job,
        origin,
        apiToken,
      );

      return {
        shortlist_path: shortlistPath,
        success: true,
      };
    } catch (error) {
      console.error('Error creating shortlist document from existing data:', error);
      return {
        shortlist_path: '',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  private async createWordDocument(
    shortlistData: any[],
    job: any,
    origin: string,
    apiToken: string,
  ): Promise<string> {
    try {
      const outputDir = path.join(process.cwd(), 'working_naukri_candidates', job.pathPosition || 'default', 'results', 'shortlist_document');
      const shortlistPath = path.join(outputDir, 'Executive Shortlist.docx');

      // Convert shortlist data to CandidateData format
      const candidates: CandidateData[] = shortlistData.map(shortlist => {
        return this.convertShortlistToCandidateData(shortlist);
      });

      // Create position info from job
      const positionInfo: PositionInfo = {
        name: job.name || 'Unknown Position',
        company: job.company ? {
          name: job.company.name,
          domainName: job.company.domainName,
        } : undefined,
        company_name: job.company?.name || job.companyName,
        jobLocation: job.jobLocation,
        search_name: job.name,
      };

      // Create the document using DocumentTemplateService
      const result = await this.documentTemplateService.createDocument(
        candidates,
        shortlistPath,
        positionInfo,
        apiToken,
        origin,
      );

      console.log(`Shortlist document created: ${result}`);
      return result;
    } catch (error) {
      console.error('Error creating Word document:', error);
      throw error;
    }
  }

  private convertShortlistToCandidateData(shortlist: any): CandidateData {
    // Convert shortlist data from database to CandidateData format
    console.log('shortlist data converted to CandidateData:', shortlist);
    return {
      name: shortlist.name || '',
      age: shortlist.age || 0,
      yearsOfExperience: shortlist.yearsOfExperience || 0,
      educationalQualifications: shortlist.educationalQualifications || '',
      universityCollege: shortlist.universityCollege || '',
      currentJobTitle: shortlist.currentJobTitle || '',
      currentCompany: shortlist.currentCompany || '',
      currentLocation: shortlist.currentLocation || '',
      currentRoleDescription: shortlist.currentRoleDescription || '',
      reportsTo: shortlist.reportsTo || '',
      functionsReportingTo: shortlist.functionsReportingTo || '',
      reasonForLeaving: shortlist.reasonForLeaving || '',
      currentSalary: shortlist.currentSalary || '',
      expectedSalary: shortlist.expectedSalary || '',
      noticePeriod: shortlist.noticePeriod || '',
      imageUrl: '', // Shortlist data doesn't include imageUrl
    };
  }


  private generateShortlistContent(
    shortlistData: any[],
    job: any,
  ): string {
    let content = `Executive Shortlist\n`;
    content += `Project: ${job.name}\n`;
    content += `Company: ${job.company?.name || 'N/A'}\n`;
    content += `Location: ${job.jobLocation || 'N/A'}\n`;
    content += `Generated on: ${new Date().toISOString()}\n\n`;

    shortlistData.forEach((shortlist, index) => {
      content += `Candidate ${index + 1}: ${shortlist.name}\n`;
      content += `Age: ${shortlist.age || 'N/A'}\n`;
      content += `Current Project: ${shortlist.currentJobTitle || 'N/A'} at ${shortlist.currentCompany || 'N/A'}\n`;
      content += `Experience: ${shortlist.yearsOfExperience || 0} years\n`;
      content += `Education: ${shortlist.educationalQualifications || 'N/A'}\n`;
      content += `University: ${shortlist.universityCollege || 'N/A'}\n`;
      content += `Location: ${shortlist.currentLocation || 'N/A'}\n`;
      content += `Current Salary: ${shortlist.currentSalary || 'N/A'}\n`;
      content += `Expected Salary: ${shortlist.expectedSalary || 'N/A'}\n`;
      content += `Notice Period: ${shortlist.noticePeriod || 'N/A'}\n`;
      content += `Reason for Leaving: ${shortlist.reasonForLeaving || 'N/A'}\n`;
      content += `Reports To: ${shortlist.reportsTo || 'N/A'}\n`;
      content += `Functions Reporting To: ${shortlist.functionsReportingTo || 'N/A'}\n\n`;
    });

    return content;
  }
}

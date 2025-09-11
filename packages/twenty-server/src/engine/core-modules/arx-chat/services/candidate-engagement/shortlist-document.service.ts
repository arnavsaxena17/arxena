import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  createCvsentMutation,
  graphqlToFetchAllCandidateData,
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
      );

      // Step 5: Create Excel file (only if requested)
      let excelPath: string | undefined;
      if (createExcelFile) {
        excelPath = await this.createExcelFile(
          processedCandidates,
          job,
          cvSentId,
        );
      }

      // Step 6: Create Word document (this would need to be implemented)
      const shortlistPath = await this.createWordDocument(
        processedCandidates,
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
      const cvSentData = {
        input: {
          jobId: job.id,
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

  private async createShortlistEntries(
    cvSentId: string,
    processedCandidates: ProcessedCandidate[],
    originalCandidates: any[],
    apiToken: string,
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
          // Create shortlist entry - this would need to be implemented with proper GraphQL mutation
          console.log(`Creating shortlist entry for candidate ${processedCandidate.candidate_id}`);
        } catch (error) {
          console.error(`Error creating shortlist entry for candidate ${processedCandidate.candidate_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error creating shortlist entries:', error);
    }
  }

  private async createExcelFile(
    processedCandidates: ProcessedCandidate[],
    job: any,
    cvSentId: string,
  ): Promise<string> {
    try {
      // Create output directory
      const outputDir = path.join(process.cwd(), 'working_naukri_candidates', job.pathPosition || 'default', 'results', 'shortlist_document');
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Prepare data for Excel
      const successfulCandidates = processedCandidates.map(candidate => ({
        ...candidate.candidate_obj,
        id: candidate.candidate_id,
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(successfulCandidates);
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

  private async createWordDocument(
    processedCandidates: ProcessedCandidate[],
    job: any,
    origin: string,
    apiToken: string,
  ): Promise<string> {
    try {
      const outputDir = path.join(process.cwd(), 'working_naukri_candidates', job.pathPosition || 'default', 'results', 'shortlist_document');
      const shortlistPath = path.join(outputDir, 'Executive Shortlist.docx');

      // Convert processed candidates to CandidateData format
      const candidates: CandidateData[] = processedCandidates.map(candidate => {
        const candidateObj = candidate.candidate_obj || candidate;
        return this.convertRowToCandidateData(candidateObj);
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

  private convertRowToCandidateData(row: any): CandidateData {
    // Convert a row from Excel/DataFrame to CandidateData format
    return {
      name: row.name || '',
      age: row.age || 0,
      years_of_experience: row.years_of_experience || 0,
      educational_qualifications: row.educational_qualifications || '',
      university_college: row.university_college || '',
      current_job_title: row.current_job_title || '',
      current_company: row.current_company || '',
      current_location: row.current_location || '',
      current_role_description: row.current_role_description || '',
      reports_to: row.reports_to || '',
      functions_reporting_to: row.functions_reporting_to || '',
      reason_for_leaving: row.reason_for_leaving || '',
      current_salary: row.current_salary || '',
      expected_salary: row.expected_salary || '',
      notice_period: row.notice_period || '',
      image_url: row.image_url || '',
    };
  }

  private generateShortlistContent(
    processedCandidates: ProcessedCandidate[],
    job: any,
  ): string {
    let content = `Executive Shortlist\n`;
    content += `Job: ${job.name}\n`;
    content += `Company: ${job.company?.name || 'N/A'}\n`;
    content += `Location: ${job.jobLocation || 'N/A'}\n`;
    content += `Generated on: ${new Date().toISOString()}\n\n`;

    processedCandidates.forEach((candidate, index) => {
      const data = candidate.candidate_obj;
      content += `Candidate ${index + 1}: ${data.name}\n`;
      content += `Email: ${data.email || 'N/A'}\n`;
      content += `Phone: ${data.phone_number || 'N/A'}\n`;
      content += `Current Job: ${data.current_job_title || 'N/A'} at ${data.current_company || 'N/A'}\n`;
      content += `Experience: ${data.years_of_experience || 0} years\n`;
      content += `Education: ${data.educational_qualifications || 'N/A'}\n`;
      content += `Current Salary: ${data.current_salary || 'N/A'}\n`;
      content += `Expected Salary: ${data.expected_salary || 'N/A'}\n`;
      content += `Notice Period: ${data.notice_period || 'N/A'}\n`;
      content += `Reason for Leaving: ${data.reason_for_leaving || 'N/A'}\n\n`;
    });

    return content;
  }
}

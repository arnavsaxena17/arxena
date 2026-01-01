import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as path from 'path';
import { findManyAttachmentsQuery } from 'twenty-shared';
import { JDParserService } from '../../candidate-sourcing/services/jd-parser.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { parsedJobDescriptionSchema } from '../schemas/job-description.schema';
import {
    JobDescriptionParseRequest,
    ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { FileUtils, replaceTemplateVariables } from '../utils';
import { CandidateSearchPromptService } from './candidate-search-prompt.service';

@Injectable()
export class JobDescriptionService {
  private readonly logger = new Logger(JobDescriptionService.name);

  constructor(
    private readonly jdParserService: JDParserService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly promptService: CandidateSearchPromptService,
    private readonly fileUtils: FileUtils,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly resumeReaderService: ResumeReaderService,
  ) {}

  /**
   * Parse job description using LLM
   */
  async parseJobDescription(
    request: JobDescriptionParseRequest,
    apiToken: string,
  ): Promise<ParsedJobDescription> {
    try {
      // First try to parse using JD parser service if we have a file path
      // Skip file parsing for standalone searches
      if (request.filePath && request.filePath !== 'standalone_search') {
        return await this.parseJobDescriptionFromFile(request.filePath, apiToken);
      }

      // For text-based job descriptions, use the new jd-parser service
      if (request.jobDescription) {
        return await this.jdParserService.processJDFromTextToParsedJobDescription(request.jobDescription);
      }

      // Fallback to LLM parsing for text-based job descriptions
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const prompt = this.promptService.getJobDescriptionParsingPrompt();

      // Replace template variables
      const systemPrompt = replaceTemplateVariables(prompt.system, request);
      const userPrompt = replaceTemplateVariables(prompt.user, request);

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(
          parsedJobDescriptionSchema,
          'parsedJobDescription',
        ),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const parsedData = JSON.parse(content) as ParsedJobDescription;
      this.logger.log(`Parsed job description from text: ${JSON.stringify(parsedData, null, 2)}`);
      
      return parsedData;
    } catch (error) {
      this.logger.error(`Failed to parse job description in parseJobDescription: ${error}`);
      throw error;
    }
  }

  /**
   * Parse job description from file using JD parser service
   */
  async parseJobDescriptionFromFile(
    filePath: string,
    apiToken: string,
  ): Promise<ParsedJobDescription> {
    let tempFilePath: string | null = null;
    
    try {
      this.logger.log(`Parsing job description from file: ${filePath} with JD parser service`);
      
      // Check if filePath is a URL
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        this.logger.log('File path is a URL, downloading file first');
        tempFilePath = await this.fileUtils.downloadFileFromUrl(filePath, apiToken);
        filePath = tempFilePath;
      }
      
      // Use the new JD parser service method that returns ParsedJobDescription directly
      const parsedJobDescription = await this.jdParserService.processJDFromFileToParsedJobDescription(filePath);

      this.logger.log(`Parsed job description from file: ${JSON.stringify(parsedJobDescription, null, 2)}`);
      return parsedJobDescription;
    } catch (error) {
      this.logger.error('Failed to parse job description from file', error);
      throw error;
    } finally {
      // Clean up temporary file if it was downloaded
      if (tempFilePath) {
        this.fileUtils.cleanupTempFile(tempFilePath);
      }
    }
  }

  /**
   * Fetch and extract raw JD text from job attachments
   */
  async getJDContentFromJobAttachments(
    jobId: string,
    apiToken: string,
  ): Promise<string> {
    try {
      this.logger.log(`Fetching JD content from job attachments for jobId: ${jobId}`);

      // Fetch job attachments
      const response = await this.staticGraphQLService.executeGraphQL(
        findManyAttachmentsQuery,
        {
          filter: { jobId: { eq: jobId } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        },
        apiToken,
      );

      const attachments = response?.data?.data?.attachments?.edges || [];
      
      if (attachments.length === 0) {
        this.logger.log(`No attachments found for jobId: ${jobId}`);
        return '';
      }

      // Get the first attachment (assuming it's the JD file)
      const attachment = attachments[0].node;
      if (!attachment.fullPath) {
        this.logger.log(`No valid attachment path for jobId: ${jobId}`);
        return '';
      }

      // Download and process the JD file
      const jdContent = await this.downloadAndProcessJD(
        attachment.fullPath,
        attachment.name,
        jobId,
        apiToken,
      );

      return jdContent;
    } catch (error) {
      this.logger.error(`Error fetching JD content for jobId ${jobId}:`, error);
      return '';
    }
  }

  /**
   * Download and process JD file from fullPath
   */
  async downloadAndProcessJD(
    fullPath: string,
    fileName: string,
    jobId: string,
    apiToken: string,
  ): Promise<string> {
    try {
      // Download the JD file
      const response = await fetch(fullPath, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch JD: ${fileName}`);
      }

      const fileBuffer = await response.arrayBuffer();
      
      // Create a temporary file to store the downloaded JD
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `${jobId}_${fileName}`);
      fs.writeFileSync(tempFilePath, new Uint8Array(fileBuffer));
      
      this.logger.log(`Downloaded JD file: ${fileName} for jobId: ${jobId}`);
      
      // Check if the file format is supported
      if (!this.resumeReaderService.isSupportedResumeFormat(fileName)) {
        this.logger.log(`Unsupported JD format: ${fileName} for jobId: ${jobId}`);
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        return `[Unsupported JD format: ${fileName}]`;
      }
      
      // Use ResumeReaderService to extract text content
      const jdContent = await this.resumeReaderService.readResumeFile(tempFilePath);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      this.logger.log(`Successfully processed JD: ${fileName} for jobId: ${jobId}`);
      return jdContent.text;
    } catch (error) {
      this.logger.error(`Error downloading and processing JD for jobId ${jobId}:`, error);
      
      // Clean up temp file if it exists
      try {
        const tempFilePath = path.join(process.cwd(), 'temp', `${jobId}_${fileName}`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        this.logger.error('Error cleaning up temp file:', cleanupError);
      }
      
      return '';
    }
  }
}


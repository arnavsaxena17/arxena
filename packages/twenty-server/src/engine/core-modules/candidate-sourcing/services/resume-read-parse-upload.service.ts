import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as mammoth from 'mammoth';
import { OpenAI } from 'openai';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';

import { ProcessCandidatesService } from '../jobs/process-candidates.service';
import { DataProcessingUtils } from '../utils/data-processing.utils';
import { CandidateService } from './candidate.service';
import { ParsedCVData, ParsedCVTransformerService } from './data-sources/parsed-cv-transformer.service';

export type ResumeContent = {
  text: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

@Injectable()
export class ResumeReadParseUploadService {
  private readonly logger = new Logger(ResumeReadParseUploadService.name);
  private openaiClient: OpenAI;

  constructor(
    private readonly parsedCVTransformer: ParsedCVTransformerService,
    private readonly processCandidatesService: ProcessCandidatesService,
    private readonly dataProcessingUtils: DataProcessingUtils,
    private readonly configService: ConfigService,
    private readonly candidateService: CandidateService,
  ) {
    this.initializeOpenAI();
  }

  // --- Resume/Document reading (merged from ResumeReaderService) ---

  async readResumeFile(filePath: string): Promise<ResumeContent> {
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    const stats = fs.statSync(filePath);

    this.logger.log(`Reading resume file: ${fileName} (${fileExtension})`);

    try {
      let text = '';

      switch (fileExtension) {
        case '.pdf':
          text = await this.readPdfFile(filePath);
          break;
        case '.docx':
          text = await this.readDocxFile(filePath);
          break;
        case '.doc':
          text = await this.readDocFile(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      const cleanedText = this.cleanText(text);

      return {
        text: cleanedText,
        fileName,
        fileType: fileExtension,
        fileSize: stats.size,
      };
    } catch (error) {
      this.logger.error(`Error reading resume file ${fileName}:`, error);
      throw new Error(`Failed to read resume file: ${error.message}`);
    }
  }

  private async readPdfFile(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer);
      return data.text;
    } catch (error) {
      this.logger.error(`Error reading PDF file ${filePath}:`, error);
      throw new Error(`Failed to read PDF file: ${error.message}`);
    }
  }

  private async readDocxFile(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      this.logger.error(`Error reading DOCX file ${filePath}:`, error);
      throw new Error(`Failed to read DOCX file: ${error.message}`);
    }
  }

  private async readDocFile(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      this.logger.warn(`Failed to read DOC file with mammoth: ${error.message}`);
      throw new Error('DOC file reading not fully supported. Please convert to DOCX or PDF format.');
    }
  }

  private cleanText(text: string): string {
    if (!text) return '';
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return cleaned;
  }

  async readMultipleResumeFiles(filePaths: string[]): Promise<ResumeContent[]> {
    const results: ResumeContent[] = [];
    for (const filePath of filePaths) {
      try {
        const content = await this.readResumeFile(filePath);
        results.push(content);
      } catch (error) {
        this.logger.error(`Failed to read file ${filePath}:`, error);
      }
    }
    return results;
  }

  isSupportedResumeFormat(fileName: string): boolean {
    const supportedExtensions = ['.pdf', '.docx', '.doc'];
    const extension = path.extname(fileName).toLowerCase();
    return supportedExtensions.includes(extension);
  }

  getFileType(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  private initializeOpenAI() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found. Resume parsing will not work.');
      return;
    }

    this.openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Process uploaded resume files: read, parse, and upload to candidate system
   */
  async processResumeFiles(
    filePaths: string[],
    jobId: string,
    jobName: string,
    userId: string,
    origin: string,
    apiToken: string,
  ): Promise<{
    success: boolean;
    processedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const timestamp = new Date().toISOString();
    const errors: string[] = [];
    let processedCount = 0;
    let errorCount = 0;

    this.logger.log(`Processing ${filePaths.length} resume files for job ${jobId}`);

    try {
      // Step 1: Read all resume files
      const resumeContents = await this.readMultipleResumeFiles(filePaths);
      this.logger.log(`Successfully read ${resumeContents.length} resume files`);

      if (resumeContents.length === 0) {
        throw new Error('No resume files could be read successfully');
      }

      const parseResults = await this.parseResumesInBatches(resumeContents);
      
      // Process results
      const parsedCVs: ParsedCVData[] = [];
      for (const result of parseResults) {
        if (result.success && result.data) {
          parsedCVs.push(result.data);
          processedCount++;
        } else {
          errors.push(`Failed to parse ${result.fileName}: ${result.error}`);
          errorCount++;
        }
      }

      if (parsedCVs.length === 0) {
        throw new Error('No resumes could be parsed successfully');
      }

      this.logger.log(`Successfully parsed ${parsedCVs.length} resumes`);

      // Step 3: Transform parsed CVs to UserProfile format
      const userProfiles = await this.transformParsedCVsToUserProfiles(
        parsedCVs,
        jobId,
        jobName,
        userId,
        timestamp,
      );

      this.logger.log(`Successfully transformed ${userProfiles.length} resumes to user profiles`);

      // Step 4: Queue for processing
      await this.processCandidatesService.queueRawDataForProcessing(
        userProfiles,
        'parsed_cv',
        jobId,
        jobName,
        userId,
        timestamp,
        origin,
        apiToken,
      );

      this.logger.log(`Successfully queued ${userProfiles.length} parsed resumes for processing`);

      // Step 5: Upload CV files and create attachments for candidates
      await this.uploadCVsAndCreateAttachments(filePaths, userProfiles, origin, apiToken);

      return {
        success: true,
        processedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error('Error processing resume files:', error);
      return {
        success: false,
        processedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Parse resumes in batches to control concurrency and prevent API rate limiting
   */
  private async parseResumesInBatches(resumeContents: Array<{ text: string; fileName: string }>): Promise<Array<{ success: boolean; data?: ParsedCVData | null; error?: string; fileName: string }>> {
    const BATCH_SIZE = 5; // Process 5 resumes at a time
    const results: Array<{ success: boolean; data?: ParsedCVData | null; error?: string; fileName: string }> = [];

    for (let i = 0; i < resumeContents.length; i += BATCH_SIZE) {
      const batch = resumeContents.slice(i, i + BATCH_SIZE);
      this.logger.log(`Processing resume files in batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(resumeContents.length / BATCH_SIZE)} (${batch.length} resumes)`);

      const batchPromises = batch.map(async (content) => {
        try {
          const parsedCV = await this.parseResumeWithOpenAI(content.text);
          if (parsedCV) {
            return { success: true, data: parsedCV, fileName: content.fileName };
          } else {
            return { success: false, error: 'Failed to parse resume - no data returned', fileName: content.fileName };
          }
        } catch (error) {
          this.logger.error(`Failed to parse resume ${content.fileName}:`, error);
          return { success: false, error: error.message, fileName: content.fileName };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a small delay between batches to be respectful to the API
      if (i + BATCH_SIZE < resumeContents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Parse resume text using OpenAI
   */
  private async parseResumeWithOpenAI(resumeText: string): Promise<ParsedCVData | null> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = `Summarize the text below into a JSON with exactly the following structure {
      "name": "string",
      "fullName": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phoneNumber": "string",
      "location": "string",
      "profileUrl": "string",
      "linkedinUrl": "string",
      "githubMainPageUrl": "string",
      "portfolioWebsiteUrl": "string",
      "university": "string",
      "educationLevel": "BS, MS, or PhD",
      "graduationYear": "string",
      "graduationMonth": "string",
      "majors": "string",
      "gpa": "string",
      "skills": "string",
      "keySkills": "string",
      "workExperience": [
        {
          "jobTitle": "string",
          "company": "string",
          "location": "string",
          "duration": "string",
          "jobSummary": "string"
        }
      ],
      "projectExperience": [
        {
          "projectName": "string",
          "projectDescription": "string"
        }
      ]
    }

    Resume text:
    ${resumeText}`;

    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at parsing resume data. Extract information accurately and return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedData = JSON.parse(responseText);
      
      // Validate the parsed data structure
      if (!parsedData.workExperience) {
        parsedData.workExperience = [];
      }
      if (!parsedData.projectExperience) {
        parsedData.projectExperience = [];
      }

      return parsedData as ParsedCVData;

    } catch (error) {
      this.logger.error('Error parsing resume with OpenAI:', error);
      throw new Error(`Failed to parse resume: ${error.message}`);
    }
  }

  /**
   * Transform parsed CVs to UserProfile format
   */
  private async transformParsedCVsToUserProfiles(
    parsedCVs: ParsedCVData[],
    jobId: string,
    jobName: string,
    userId: string,
    timestamp: string,
  ): Promise<any[]> {
    const userProfiles: any[] = [];

    for (const parsedCV of parsedCVs) {
      try {
        const transformationContext = {
          jobId,
          jobName,
          userId,
          dataSource: 'parsed_cv',
          timestamp,
        };

        const userProfile = this.parsedCVTransformer.transformToUserProfile(
          parsedCV,
          transformationContext,
        );

        // Add unique string key if not present
        if (!userProfile.uniqueStringKey) {
          userProfile.uniqueStringKey = this.dataProcessingUtils.generateUniqueStringKey(
            userProfile,
            'parsed_cv',
          );
        }

        userProfiles.push(userProfile);

      } catch (error) {
        this.logger.error('Error transforming parsed CV to user profile:', error);
        // Continue with other CVs even if one fails
      }
    }

    return userProfiles;
  }

  /**
   * Save uploaded files to temporary directory
   */
  async saveUploadedFiles(
    files: Express.Multer.File[],
    jobId: string,
  ): Promise<string[]> {
    const uploadDir = path.join(process.cwd(), 'temp', 'resumes', jobId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedPaths: string[] = [];

    for (const file of files) {
      const fileName = `${crypto.randomUUID()}_${file.originalname}`;
      const filePath = path.join(uploadDir, fileName);
      
      fs.writeFileSync(filePath, file.buffer as any);
      savedPaths.push(filePath);
      
      this.logger.log(`Saved uploaded file: ${filePath}`);
    }

    return savedPaths;
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Cleaned up temp file: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
      }
    }
  }

  /**
   * Upload CV files and create attachments for candidates
   */
  private async uploadCVsAndCreateAttachments(
    filePaths: string[],
    userProfiles: any[],
    origin: string,
    apiToken: string,
  ): Promise<void> {
    this.logger.log(`Starting CV upload and attachment creation for ${filePaths.length} files`);

    try {
      // Create a mapping of file paths to user profiles
      const fileToProfileMap = new Map<string, any>();
      
      // Match files to profiles based on filename patterns
      for (let i = 0; i < filePaths.length && i < userProfiles.length; i++) {
        const filePath = filePaths[i];
        const profile = userProfiles[i];
        fileToProfileMap.set(filePath, profile);
      }

      // Process each file
      for (const [filePath, profile] of fileToProfileMap) {
        try {
          if (!profile?.uniqueStringKey) {
            this.logger.warn(`No uniqueStringKey found for profile, skipping CV upload for file: ${filePath}`);
            continue;
          }

          this.logger.log(`Uploading CV for candidate: ${profile.uniqueStringKey}`);
          
          // Use the candidate service's uploadCVToTwentyWithFallback method
          await this.candidateService.uploadCVToTwentyWithFallback(
            filePath,
            profile.uniqueStringKey,
            profile, // Pass the profile as contactData
            origin,
            apiToken,
          );

          this.logger.log(`Successfully uploaded CV for candidate: ${profile.uniqueStringKey}`);

        } catch (error) {
          this.logger.error(`Error uploading CV for file ${filePath}:`, error);
          // Continue with other files even if one fails
        }
      }

      this.logger.log('CV upload and attachment creation completed');

    } catch (error) {
      this.logger.error('Error in uploadCVsAnd CreateAttachments:', error);
      // Don't throw - this is not critical for the main flow
    }
  }
}

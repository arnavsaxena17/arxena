import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
    findManyAttachmentsQuery,
    graphQltoUpdateOneCandidate,
    graphqlToFetchAllCandidateDataWithFieldValues,
} from 'twenty-shared';
import { z } from 'zod';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export interface CandidateData {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  people?: {
    email?: string;
    uniqueStringKey?: string;
  };
  jobs?: {
    id: string;
    name: string;
    recruiterId?: string;
  };
}

export interface ProcessedCandidateData {
  prompt: string;
  candidate_id: string;
  candidate_name: string;
}

export interface CandidateAttachment {
  id: string;
  name: string;
  fullPath: string;
  type: string;
}

export interface CandidateMessage {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

export interface CandidateQnA {
  question: string;
  answer: string;
}

export interface ProcessedCandidate {
  candidate_obj: any;
  candidate_id: string;
}

// Zod schema for candidate data extraction
const candidateExtractionSchema = z.object({
  name: z.string().describe('The full name of the candidate'),
  date_of_birth: z.string().optional().describe('The date of birth of the candidate'),
  age: z.number().optional().describe('The age of the candidate'),
  email: z.string().optional().describe('The email address of the candidate'),
  phone_number: z.string().optional().describe('The phone number of the candidate'),
  aadhaar_number: z.number().optional().describe('The aadhaar number of the candidate'),
  years_of_experience: z.number().optional().describe('The number of years of experience'),
  graduation_year: z.number().optional().describe('The graduation year of the candidate'),
  educational_qualifications: z.string().optional().describe('The graduation and post-graduation qualifications'),
  university_college: z.string().optional().describe('The university or college the candidate graduated from'),
  current_job_title: z.string().optional().describe('The current job title of the candidate'),
  current_company: z.string().optional().describe('The current company the candidate is working at'),
  current_location: z.string().optional().describe('The current location of the candidate'),
  current_role_description: z.string().optional().describe('The role description with scale and scope'),
  reports_to: z.string().optional().describe('Who the candidate reports to'),
  functions_reporting_to: z.string().optional().describe('Which functions report to the candidate'),
  reason_for_leaving: z.string().optional().describe('The reason for leaving the current job'),
  current_salary: z.string().optional().describe('The current salary of the candidate'),
  expected_salary: z.string().optional().describe('The expected salary of the candidate'),
  notice_period: z.string().optional().describe('The notice period of the candidate'),
});

@Injectable()
export class CandidateDataProcessorService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async processCandidates(
    candidates: CandidateData[],
    job: any,
    apiToken: string,
  ): Promise<ProcessedCandidate[]> {
    console.log(`Processing ${candidates.length} candidates with LLM`);
    
    const openaiClient = await this.getOpenAIClient(apiToken);
    const processedCandidates: ProcessedCandidate[] = [];

    for (const candidate of candidates) {
      try {
        const processedData = await this.processCandidateData(
          candidate,
          job,
          apiToken,
        );

        console.log("Processed data::%s", processedData);
        if (!processedData) {
          console.log(`Failed to process candidate: ${candidate.name}`);
          continue;
        }
        // Use OpenAI to extract structured data
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant that extracts structured information from resumes and candidate data.',
            },
            { role: 'user', content: processedData.prompt },
          ],
          response_format: zodResponseFormat(
            candidateExtractionSchema,
            'candidateExtraction',
          ),
        });

        const candidateData = completion.choices[0].message.content;
        
        // Update candidate shortlist object in Twenty
        await this.updateCandidateShortlistObj(
          processedData.candidate_id,
          candidateData,
          apiToken,
        );

        processedCandidates.push({
          candidate_obj: candidateData,
          candidate_id: processedData.candidate_id,
        });

        console.log(`Successfully processed candidate: ${candidate.name}`);
      } catch (error) {
        console.error(`Error processing candidate ${candidate.name}:`, error);
      }
    }

    return processedCandidates;
  }

  private async processCandidateData(
    candidate: CandidateData,
    job: any,
    apiToken: string,
  ): Promise<ProcessedCandidateData | null> {
    try {
      const candidateId = candidate.id;
      const candidateName = candidate.name;
      const candidateEmail = candidate.people?.email;
      const candidateUniqueStringKey = candidate.people?.uniqueStringKey || '';

      // Fetch all related data for the candidate
      const [
        attachments,
        messages,
        candidateQna,
        meetingTranscript,
        allTranscripts,
        analysisVideoInterview,
        qnaVideosTranscript,
        dfAll,
      ] = await Promise.all([
        this.fetchAttachments(candidateId, apiToken),
        this.fetchCandidateMessages(candidateId, apiToken),
        this.getCandidateQna(candidateId, apiToken),
        this.getMeetingTranscriptByEmail(candidateEmail, candidateName),
        this.fetchAudioCallsTranscript(candidateId, apiToken),
        this.getVideoInterviewQnaFromAudioFiles(candidateId, apiToken),
        this.getVideoInterviewQuestionsAndTranscripts(candidateId, apiToken),
        this.getAllCandidateDataFromDatabases(job, apiToken),
      ]);

      // Get user input for candidate
      const userInput = await this.getUserInputForCandidate(
        candidateEmail,
        candidateUniqueStringKey,
        candidateName,
        dfAll,
        apiToken,
      );

      // Create chat history
      const chatHistory = messages.length > 0
        ? messages.map(msg => `${msg.name}: ${msg.message}`).join('\n')
        : 'No chat history found for candidate.';

      // Extract resume content from attachments
      const resumeContent = await this.getResumeContentFromAttachments(
        attachments,
        candidateId,
        candidateName,
        apiToken,
      );

      // Create prompt
      const prompt = this.getPromptForCandidateObj(
        candidateName,
        resumeContent,
        userInput,
        meetingTranscript,
        chatHistory,
        allTranscripts,
        candidateQna,
        analysisVideoInterview,
        qnaVideosTranscript,
      );

      return {
        prompt,
        candidate_id: candidateId,
        candidate_name: candidateName,
      };
    } catch (error) {
      console.error(`Error processing candidate data for ${candidate.name}:`, error);
      return null;
    }
  }

  private async fetchAttachments(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateAttachment[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        findManyAttachmentsQuery,
        {
          filter: { candidateId: { eq: candidateId } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        },
        apiToken,
      );

      return response?.data?.data?.attachments?.edges?.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        fullPath: edge.node.fullPath,
        type: edge.node.type,
      })) || [];
    } catch (error) {
      console.error(`Error fetching attachments for candidate ${candidateId}:`, error);
      return [];
    }
  }

  private async fetchCandidateMessages(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateMessage[]> {
    try {
      const url = `${process.env.SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`;
      const payload = { candidateId };
      const headers = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Error fetching messages for candidate ${candidateId}: ${response.status}`);
        return [];
      }

      const messages = await response.json();
      const sortedMessages = messages.sort((a: any, b: any) => 
        new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime()
      );

      return sortedMessages.map((msg: any) => ({
        id: msg.id,
        name: msg.name,
        message: msg.message,
        createdAt: msg.createdAt,
      }));
    } catch (error) {
      console.error(`Error fetching candidate messages for ${candidateId}:`, error);
      return [];
    }
  }

  private async getCandidateQna(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateQnA[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateDataWithFieldValues,
        {
          filter: { id: { eq: candidateId } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        },
        apiToken,
      );

      const qaPairs = this.extractQaPairs(response);
      return qaPairs;
    } catch (error) {
      console.error(`Error fetching candidate QnA for ${candidateId}:`, error);
      return [];
    }
  }

  private extractQaPairs(data: any): CandidateQnA[] {
    try {
      const qaArray: CandidateQnA[] = [];
      const candidates = data?.data?.candidates?.edges || [];

      for (const candidate of candidates) {
        const candidateName = candidate.node.name;
        const answers = candidate.node.candidateFieldValues?.edges || [];

        for (const answer of answers) {
          const answerNode = answer.node;
          if (
            answerNode &&
            answerNode.candidateFields &&
            answerNode.name &&
            typeof answerNode.name === 'string' &&
            !answerNode.name.startsWith('[') &&
            !answerNode.name.startsWith('{')
          ) {
            qaArray.push({
              question: answerNode.candidateFields.name || '',
              answer: answerNode.name || '',
            });
          }
        }
      }

      return qaArray;
    } catch (error) {
      console.error('Error extracting QA pairs:', error);
      return [];
    }
  }

  private async getMeetingTranscriptByEmail(
    email: string | undefined,
    candidateName: string,
  ): Promise<string> {
    try {
      if (!email) {
        console.log(`No email provided for candidate: ${candidateName}`);
        return '';
      }

      // This would need to be implemented to fetch meetings from Fireflies
      // For now, returning empty string as it requires external service integration
      console.log(`Fetching meeting transcript for candidate: ${candidateName} with email: ${email}`);
      return '';
    } catch (error) {
      console.error(`Error fetching meeting transcript for ${candidateName}:`, error);
      return '';
    }
  }

  private async fetchAudioCallsTranscript(
    candidateId: string,
    apiToken: string,
  ): Promise<string[]> {
    try {
      // First fetch attachments to find audio files
      const attachments = await this.fetchAttachments(candidateId, apiToken);
      const audioFiles = attachments.filter(attachment => {
        const extension = attachment.fullPath.split('?')[0].split('.').pop()?.toLowerCase();
        return ['mp3', 'wav', 'mp4', 'm4a'].includes(extension || '');
      });

      if (audioFiles.length === 0) {
        console.log(`No audio files found for candidate: ${candidateId}`);
        return [];
      }

      // For now, returning empty array as audio transcription requires external service
      // This would need to be implemented with audio transcription service
      console.log(`Found ${audioFiles.length} audio files for candidate: ${candidateId}`);
      return [];
    } catch (error) {
      console.error(`Error fetching audio calls transcript for ${candidateId}:`, error);
      return [];
    }
  }

  private async getVideoInterviewQnaFromAudioFiles(
    candidateId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      // This would need to be implemented with video interview analysis service
      // For now, returning empty array
      console.log(`Fetching video interview QnA for candidate: ${candidateId}`);
      return [];
    } catch (error) {
      console.error(`Error fetching video interview QnA for ${candidateId}:`, error);
      return [];
    }
  }

  private async getVideoInterviewQuestionsAndTranscripts(
    candidateId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      // This would need to be implemented with video interview analysis service
      // For now, returning empty array
      console.log(`Fetching video interview questions and transcripts for candidate: ${candidateId}`);
      return [];
    } catch (error) {
      console.error(`Error fetching video interview questions and transcripts for ${candidateId}:`, error);
      return [];
    }
  }

  private async getAllCandidateDataFromDatabases(
    job: any,
    apiToken: string,
  ): Promise<any[]> {
    try {
      console.log(`Fetching all candidate data from databases for job: ${job.name}`);
      
      let dfAll: any[] = [];

      // Try to read from input file first
      if (job.input_file) {
        try {
          // This would need to be implemented to read Excel files
          console.log(`Reading from input file: ${job.input_file}`);
          // dfAll = await this.readExcelFile(job.input_file);
        } catch (error) {
          console.log(`Error reading input file: ${error}`);
        }
      }

      // Try to get data from Google Sheets
      if (job.spreadsheet_id) {
        try {
          console.log(`Fetching data from Google Sheets: ${job.spreadsheet_id}`);
          dfAll = await this.getDataFromGoogleSheets(job.spreadsheet_id, apiToken);
        } catch (error) {
          console.log(`Error reading Google Sheets data: ${error}`);
        }
      }

      console.log(`Retrieved ${dfAll.length} records from databases`);
      return dfAll;
    } catch (error) {
      console.error(`Error fetching all candidate data from databases:`, error);
      return [];
    }
  }

  private async getDataFromGoogleSheets(
    spreadsheetId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      // This would need to be implemented with Google Sheets API
      // For now, returning empty array as it requires Google Sheets service integration
      console.log(`Fetching data from Google Sheets: ${spreadsheetId}`);
      return [];
    } catch (error) {
      console.error(`Error fetching data from Google Sheets:`, error);
      return [];
    }
  }

  private async getUserInputForCandidate(
    candidateEmail: string | undefined,
    candidateUniqueStringKey: string,
    candidateName: string,
    dfAll: any[],
    apiToken: string,
  ): Promise<string> {
    try {
      if (!dfAll || dfAll.length === 0) {
        console.log(`No data found for candidate in databases: ${candidateName}`);
        return '';
      }

      console.log(`Processing user input for candidate: ${candidateName}`);
      console.log(`Data length: ${dfAll.length}`);

      // Define column sets for different data sources
      const resdexColumns = [
        'jsUserName',
        'jobTitle',
        'keySkills',
        'focusedSkills',
        'currentLocation',
        'preferredLocations',
        'noticePeriod',
        'modifyDateLabel',
        'experience_years',
        'experience_months',
        'current_designation',
        'current_organization',
        'previous_designation',
        'previous_organization',
        'ug_institute',
        'ug_course',
        'ug_specialization',
        'ug_year',
        'pg_institute',
        'pg_course',
        'pg_specialization',
        'pg_year',
        'ctc_lacs',
        'ctc_thousands',
        'ctc_currency',
      ];

      const hiringColumns = [
        'name',
        'profileSummary',
        'currentCity',
        'preferredLocations',
        'noticePeriod',
        'keySkills',
        'summary',
        'workExp',
        'education',
        'Annual Salary',
        'Home Town/City',
        'Marital Status',
        'Notice period/ Availability to join',
      ];

      const googleSheetsColumns = [
        'Candidate Name',
        'Email',
        'Phone',
        'Current Title',
        'Current Company',
        'Location',
        'Date of Birth',
        'Age',
        'Gender',
        'Marital Status',
        'Inferred Salary (LPA)',
        'Years of Experience',
        'Total Job Changes',
        'Average Tenure',
        'Total Tenure',
        'Total Experience',
        'Profile URL',
      ];

      // Determine which columns to process based on available data
      const availableColumns = Object.keys(dfAll[0] || {});
      console.log(`Available columns: ${availableColumns.join(', ')}`);

      let allColumnsToProcess: string[] = [];

      if (this.hasColumns(availableColumns, resdexColumns.slice(0, 5))) {
        allColumnsToProcess = resdexColumns;
        console.log('Using Resdex columns');
      } else if (this.hasColumns(availableColumns, googleSheetsColumns.slice(0, 5))) {
        allColumnsToProcess = googleSheetsColumns;
        console.log('Using Google Sheets columns');
      } else {
        allColumnsToProcess = [
          ...hiringColumns,
          ...availableColumns.filter(col => col.includes('Ans(')),
        ];
        console.log('Using Hiring columns + custom columns');
      }

      // Find the candidate's row
      let candidateRow: any = null;

      try {
        if (candidateEmail) {
          // Try to find by Email ID first
          candidateRow = dfAll.find(row => 
            row['Email ID'] && row['Email ID'].includes(candidateEmail)
          );

          if (!candidateRow) {
            // Try to find by Email
            candidateRow = dfAll.find(row => 
              row['Email'] && row['Email'].includes(candidateEmail)
            );
          }

          if (!candidateRow) {
            console.log(`No row found for email: ${candidateEmail}, trying unique string key`);
            candidateRow = dfAll.find(row => 
              row['unique_key_string'] && 
              row['unique_key_string'].includes(candidateUniqueStringKey)
            );
          }
        } else if (candidateUniqueStringKey) {
          // Try different unique key column names
          if (availableColumns.includes('UniqueKey')) {
            candidateRow = dfAll.find(row => 
              row['UniqueKey'] && 
              row['UniqueKey'].includes(candidateUniqueStringKey)
            );
          } else if (availableColumns.includes('unique_key_string')) {
            candidateRow = dfAll.find(row => 
              row['unique_key_string'] && 
              row['unique_key_string'].includes(candidateUniqueStringKey)
            );
          }
        }

        if (!candidateRow) {
          console.log(`No matching row found for candidate: ${candidateName}`);
          return '';
        }

        // Extract user input from the candidate's row
        const userInput = this.extractUserInputFromRow(candidateRow, allColumnsToProcess);
        
        console.log(`Received user input for candidate: ${candidateName}, length: ${userInput.length}`);
        return userInput;

      } catch (error) {
        console.error(`Error finding candidate row: ${error}`);
        return '';
      }

    } catch (error) {
      console.error(`Error getting user input for candidate ${candidateName}:`, error);
      return '';
    }
  }

  private hasColumns(availableColumns: string[], requiredColumns: string[]): boolean {
    return requiredColumns.every(col => availableColumns.includes(col));
  }

  private extractUserInputFromRow(row: any, columnsToProcess: string[]): string {
    try {
      const userInputParts: string[] = [];

      for (const column of columnsToProcess) {
        if (row[column] && row[column] !== '' && row[column] !== null) {
          const value = this.formatValue(row[column]);
          if (value) {
            userInputParts.push(`${column}: ${value}`);
          }
        }
      }

      return userInputParts.join('\n');
    } catch (error) {
      console.error('Error extracting user input from row:', error);
      return '';
    }
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value.trim();
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  private async getResumeContentFromAttachments(
    attachments: CandidateAttachment[],
    candidateId: string,
    candidateName: string,
    apiToken: string,
  ): Promise<string> {
    try {
      if (!attachments || attachments.length === 0) {
        console.log(`No attachments found for candidate: ${candidateName}`);
        return '';
      }

      // Find the first attachment (assuming it's the resume)
      const attachment = attachments[0];
      if (!attachment.fullPath) {
        console.log(`No valid attachment path for candidate: ${candidateName}`);
        return '';
      }

      // Download and process the resume file
      const resumeContent = await this.downloadAndProcessResume(
        attachment.fullPath,
        attachment.name,
        candidateId,
        candidateName,
        apiToken,
      );

      return resumeContent;
    } catch (error) {
      console.error(`Error getting resume content for candidate ${candidateName}:`, error);
      return '';
    }
  }

  private async downloadAndProcessResume(
    fullPath: string,
    fileName: string,
    candidateId: string,
    candidateName: string,
    apiToken: string,
  ): Promise<string> {
    try {
      // Download the resume file
      const response = await fetch(fullPath, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch resume: ${fileName}`);
      }

      const fileBuffer = await response.arrayBuffer();
      
      // For now, returning a placeholder as PDF/DOCX processing requires external libraries
      // This would need to be implemented with a PDF/DOCX reader library
      console.log(`Downloaded resume file: ${fileName} for candidate: ${candidateName}`);
      return `[Resume content from ${fileName} - processing not implemented yet]`;
    } catch (error) {
      console.error(`Error downloading and processing resume for ${candidateName}:`, error);
      return '';
    }
  }

  private getPromptForCandidateObj(
    candidateName: string,
    resumeContent: string,
    userInput: string,
    meetingTranscript: string,
    chatHistory: string,
    allTranscripts: string[],
    candidateQna: CandidateQnA[],
    analysisVideoInterview: any[],
    qnaVideosTranscript: any[],
  ): string {
    const allTranscriptsText = allTranscripts.length > 0
      ? allTranscripts.join('\n\n New Call Transcript: \n\n')
      : '';

    return `
      Based on the following resume content for ${candidateName}, extract information to fill the Candidate model:
      ${resumeContent}
      Candidate Form Input (if any):
      ${userInput}
      Meeting Transcript:
      ${meetingTranscript}
      Chat History (Prioritize this over the candidate form input):
      ${chatHistory}
      Audio Call Transcripts:
      ${allTranscriptsText}
      Provide the information in a structured format matching the Candidate model.
    `;
  }


  private async updateCandidateShortlistObj(
    candidateId: string,
    candidateData: any,
    apiToken: string,
  ): Promise<void> {
    try {
      await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        {
          idToUpdate: candidateId,
          input: { shortlistObj: candidateData },
        },
        apiToken,
      );
    } catch (error) {
      console.error(`Error updating candidate shortlist obj for ${candidateId}:`, error);
    }
  }

  private async getOpenAIClient(apiToken: string): Promise<OpenAI> {
    try {
      // Fetch API keys from Twenty
      const response = await fetch(`${process.env.SERVER_BASE_URL}/workspace-modifications/api-keys`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch API keys: ${response.status}`);
      }

      const apiKeys = await response.json();
      const openaiKey = apiKeys.openaikey;

      if (!openaiKey) {
        throw new Error('OpenAI API key not found in workspace API keys');
      }

      return new OpenAI({
        apiKey: openaiKey,
      });
    } catch (error) {
      console.error('Error getting OpenAI client:', error);
      throw new Error('Failed to initialize OpenAI client');
    }
  }
}

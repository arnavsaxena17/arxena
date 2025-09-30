import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { JobDetails } from '../types/job-details.interface';
import { ResumeReaderService } from './resume-reader.service';

// Zod schema for job details parsing
const jobDetailsSchema = z.object({
  job_name: z.string().describe('The title or name of the job position properly cased, spelled'),
  job_code: z.string().describe('The unique identifier or reference code for the job'),
  location: z.string().describe('The geographical location of the job'),
  salary: z.string().describe('The compensation offered for the position'),
  company_name: z.string().describe('The name of the company offering the position'),
  company_one_line_pitch: z.string().describe('A very short pitch or tagline about the company, within 6-7 words (eg: one of the world\'s largest e-commerce platforms)'),
  company_industry: z.string().describe('The industry to which the company belongs'),
  company_website_url: z.string().describe('The website URL of the company'),
});

@Injectable()
export class JDParserService {
  private readonly logger = new Logger(JDParserService.name);
  private readonly openai: OpenAI;

  constructor(private readonly resumeReaderService: ResumeReaderService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  /**
   * Process JD file and extract job details using OpenAI
   */
  async processJDFromFile(filePath: string): Promise<JobDetails> {
    try {
      this.logger.log(`Processing JD file: ${filePath}`);

      // Read file content using ResumeReaderService
      const resumeContent = await this.resumeReaderService.readResumeFile(filePath);
      const jdText = resumeContent.text;

      this.logger.log(`JD content extracted, length: ${jdText.length} characters`);

      // Extract job details using OpenAI
      return await this.extractJobDetails(jdText);
    } catch (error) {
      this.logger.error(`Error processing JD file ${filePath}:`, error);
      throw new Error(`Failed to process JD file: ${error.message}`);
    }
  }

  /**
   * Process JD text directly and extract details
   */
  async processJDFromText(jdText: string): Promise<JobDetails> {
    try {
      this.logger.log(`Processing JD text, length: ${jdText.length} characters`);
      return await this.extractJobDetails(jdText);
    } catch (error) {
      this.logger.error('Error processing JD text:', error);
      throw new Error(`Failed to process JD text: ${error.message}`);
    }
  }

  /**
   * Extract job details using OpenAI API with structured output
   */
  private async extractJobDetails(jdText: string): Promise<JobDetails> {
    const systemPrompt = `
Extract the following details from the job description:
- Job Name/Title
- Job Code (if present)
- Location
- Salary information (if present)
- Company Name
- Company Description
- Company Very Short Pitch (6-7 words)
- Company Industry
- Company One Line Pitch (1-2 sentences)
- Company Website URL

Return the information in the specified JSON format.
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: jdText },
        ],
        response_format: zodResponseFormat(
          jobDetailsSchema,
          'jobDetails',
        ),
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI');
      }

      const parsedResponse = JSON.parse(responseContent) as JobDetails;

      this.logger.log('Successfully extracted job details:', parsedResponse);
      return parsedResponse;
    } catch (error) {
      this.logger.error('Error extracting job details with OpenAI:', error);
      throw new Error(`Failed to extract job details: ${error.message}`);
    }
  }

  /**
   * Validate if file is a supported JD format
   */
  isSupportedJDFormat(fileName: string): boolean {
    return this.resumeReaderService.isSupportedResumeFormat(fileName);
  }
}

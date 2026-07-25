import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from '../../candidate-search/types/candidate-search-request.type';
import { JobDetails } from '../types/job-details.interface';
import { ResumeReadParseUploadService } from './resume-read-parse-upload.service';

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

  constructor(private readonly resumeReadParseUploadService: ResumeReadParseUploadService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  /**
   * Process JD from attachment URL (download, parse, return job data for API)
   */
  async processJDFromAttachmentUrl(
    projectId: string,
    attachmentUrl: string,
    authToken: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log(`Processing JD for job ${projectId} from URL: ${attachmentUrl}`);

      const tempFilePath = await this.downloadAttachmentFile(
        attachmentUrl,
        authToken,
        projectId,
      );

      try {
        const jobDetails = await this.processJDFromFile(tempFilePath);
        const jobCode = this.generateJobCode(jobDetails.job_name);

        const responseData = {
          name: jobDetails.job_name || '',
          description: jobDetails.company_one_line_pitch || '',
          jobCode: jobDetails.job_code || jobCode,
          jobLocation: jobDetails.location || '',
          salaryBracket: jobDetails.salary || '',
          isActive: true,
          position: jobDetails.job_name || '',
          companyName: jobDetails.company_name || '',
          companyDetails: jobDetails.company_one_line_pitch || '',
          companyWebsiteUrl: jobDetails.company_website_url || '',
          pathPosition: (jobDetails.company_industry || '').replace(/[\s\-_]/g, ''),
        };

        this.logger.log('Successfully processed JD:', responseData);

        return {
          success: true,
          data: responseData,
        };
      } finally {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            this.logger.log(`Cleaned up temporary file: ${tempFilePath}`);
          }
        } catch (cleanupError) {
          this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing JD for job ${projectId}:`, error);
      return {
        success: false,
        data: { error: error.message },
      };
    }
  }

  private async downloadAttachmentFile(
    attachmentUrl: string,
    authToken: string,
    projectId: string,
  ): Promise<string> {
    try {
      const response = await axios.get(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: '*/*',
        },
        timeout: 30000,
        responseType: 'stream',
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download attachment: ${response.status}`);
      }

      const headersRecord: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (v !== undefined && v !== null) {
          headersRecord[k] = Array.isArray(v) ? v[0] : String(v);
        }
      }
      let originalFilename = this.extractFilenameFromResponse({ headers: headersRecord }, attachmentUrl);
      if (!originalFilename || !originalFilename.includes('.')) {
        originalFilename = `temp_jd_${projectId}.pdf`;
      }
      originalFilename = this.sanitizeFilename(originalFilename);

      const tempDir = path.join(os.tmpdir(), 'jd_uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, originalFilename);
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          this.logger.log(`Successfully downloaded attachment to: ${tempFilePath}`);
          resolve(tempFilePath);
        });
        writer.on('error', (error) => {
          this.logger.error('Error writing file:', error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Error downloading attachment file:', error);
      throw new Error(`Failed to download attachment: ${error.message}`);
    }
  }

  private extractFilenameFromResponse(response: { headers: Record<string, string> }, attachmentUrl: string): string {
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition?.includes('filename=')) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        return filenameMatch[1];
      }
    }
    const urlPath = attachmentUrl.split('?')[0];
    return path.basename(urlPath) || '';
  }

  private sanitizeFilename(filename: string): string {
    let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      sanitized = nameWithoutExt.substring(0, 100 - ext.length) + ext;
      sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    }
    return sanitized;
  }

  private generateJobCode(jobName: string): string {
    if (!jobName) return 'JD-001';
    return jobName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 10);
  }

  /**
   * Process JD file and extract job details using OpenAI
   */
  async processJDFromFile(filePath: string): Promise<JobDetails> {
    try {
      this.logger.log(`Processing JD file: ${filePath}`);

      // Read file content using ResumeReadParseUploadService
      const resumeContent = await this.resumeReadParseUploadService.readResumeFile(filePath);
      const jdText = resumeContent.text;

      this.logger.log(`JD content extracted, length: ${jdText.length} characters`);

      // Extract job details using OpenAI
      const fileName = path.basename(filePath);
      return await this.extractJobDetails(jdText, fileName);
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
  private async extractJobDetails(jdText: string, fileName?: string): Promise<JobDetails> {
    const systemPrompt = `
        Extract the following details from the job description:
        - Project Name/Title
        - Project Code (if present)
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

    // Include file name in the jdText if provided
    const enrichedJdText = fileName 
      ? `File Name: ${fileName}\n\n${jdText}`
      : jdText;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enrichedJdText },
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
   * Convert JobDetails to ParsedJobDescription format
   */
  convertToParsedJobDescription(jobDetails: JobDetails, jdText?: string): ParsedJobDescription {
    // Extract keywords from job details and text
    const keywords = this.extractKeywordsFromJobDetails(jobDetails, jdText);
    
    // Parse salary range from salary string
    const salaryRange = this.parseSalaryRange(jobDetails.salary);
    
    // Determine experience level based on job title and description
    const experienceLevel = this.determineExperienceLevel(jobDetails.job_name, jdText);
    
    // Determine employment type
    const employmentType = this.determineEmploymentType(jdText);
    
    // Check for remote work
    const remoteWork = this.checkForRemoteWork(jdText);
    
    return {
      jobTitle: jobDetails.job_name || '',
      company: jobDetails.company_name || '',
      location: jobDetails.location || '',
      industry: jobDetails.company_industry || '',
      requiredSkills: this.extractSkills(jdText, 'required'),
      preferredSkills: this.extractSkills(jdText, 'preferred'),
      experienceLevel,
      education: this.extractEducation(jdText),
      keywords,
      responsibilities: this.extractResponsibilities(jdText),
      qualifications: this.extractQualifications(jdText),
      benefits: this.extractBenefits(jdText),
      employmentType,
      remoteWork,
      salaryRange,
    };
  }

  /**
   * Process JD file and return ParsedJobDescription
   */
  async processJDFromFileToParsedJobDescription(filePath: string): Promise<ParsedJobDescription> {
    try {
      this.logger.log(`Processing JD file to ParsedJobDescription: ${filePath}`);

      // Read file content using ResumeReadParseUploadService
      const resumeContent = await this.resumeReadParseUploadService.readResumeFile(filePath);
      const jdText = resumeContent.text;

      this.logger.log(`JD content extracted, length: ${jdText.length} characters`);

      // Extract job details using OpenAI
      const fileName = path.basename(filePath);
      const jobDetails = await this.extractJobDetails(jdText, fileName);
      
      // Convert to ParsedJobDescription
      const parsedJobDescription = this.convertToParsedJobDescription(jobDetails, jdText);

      this.logger.log('Successfully converted to ParsedJobDescription');
      return parsedJobDescription;
    } catch (error) {
      this.logger.error(`Error processing JD file to ParsedJobDescription ${filePath}:`, error);
      throw new Error(`Failed to process JD file to ParsedJobDescription: ${error.message}`);
    }
  }

  /**
   * Process JD text and return ParsedJobDescription
   */
  async processJDFromTextToParsedJobDescription(jdText: string): Promise<ParsedJobDescription> {
    try {
      this.logger.log(`Processing JD text to ParsedJobDescription, length: ${jdText.length} characters`);
      
      // Extract job details using OpenAI
      const jobDetails = await this.extractJobDetails(jdText);
      
      // Convert to ParsedJobDescription
      const parsedJobDescription = this.convertToParsedJobDescription(jobDetails, jdText);

      this.logger.log('Successfully converted to ParsedJobDescription');
      return parsedJobDescription;
    } catch (error) {
      this.logger.error('Error processing JD text to ParsedJobDescription:', error);
      throw new Error(`Failed to process JD text to ParsedJobDescription: ${error.message}`);
    }
  }

  /**
   * Parse job description from request (text, local file path, or file URL).
   * Single entry point for the parse-job-description API.
   */
  async parseToParsedJobDescription(
    request: JobDescriptionParseRequest,
    apiToken?: string,
  ): Promise<ParsedJobDescription> {
    const hasJobDescription =
      request.jobDescription != null && request.jobDescription.trim().length > 0;
    const hasFilePath = request.filePath != null && request.filePath.trim().length > 0;

    if (!hasJobDescription && !hasFilePath) {
      throw new Error('Either job description or file path is required');
    }

    if (hasFilePath && (request.filePath!.startsWith('http://') || request.filePath!.startsWith('https://'))) {
      const tempFilePath = await this.downloadAttachmentFile(
        request.filePath!,
        apiToken ?? '',
        'parse-jd',
      );
      try {
        return await this.processJDFromFileToParsedJobDescription(tempFilePath);
      } finally {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            this.logger.log(`Cleaned up temporary file: ${tempFilePath}`);
          }
        } catch (cleanupError) {
          this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
        }
      }
    }

    if (hasFilePath) {
      return this.processJDFromFileToParsedJobDescription(request.filePath!);
    }

    return this.processJDFromTextToParsedJobDescription(request.jobDescription!);
  }

  /**
   * Extract keywords from job details and text
   */
  private extractKeywordsFromJobDetails(jobDetails: JobDetails, jdText?: string): string[] {
    const keywords: string[] = [];
    
    // Add job title words
    if (jobDetails.job_name) {
      keywords.push(...jobDetails.job_name.toLowerCase().split(' ').filter(word => word.length > 2));
    }
    
    // Add company industry
    if (jobDetails.company_industry) {
      keywords.push(jobDetails.company_industry.toLowerCase());
    }
    
    // Extract additional keywords from text if available
    if (jdText) {
      const words = jdText.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isCommonWord(word));
      
      // Get most frequent words
      const wordCount = words.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const sortedWords = Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);
      
      keywords.push(...sortedWords);
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Check if word is common (should be filtered out)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'for', 'with', 'this', 'that', 'will', 'can', 'are', 'you',
      'have', 'has', 'had', 'was', 'were', 'been', 'being', 'from', 'they',
      'them', 'their', 'there', 'these', 'those', 'what', 'when', 'where',
      'which', 'who', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than',
      'too', 'very', 'just', 'now', 'also', 'well', 'work', 'job', 'company'
    ];
    return commonWords.includes(word);
  }

  /**
   * Parse salary range from salary string
   */
  private parseSalaryRange(salary: string): { min: number; max: number; currency: string } | null {
    if (!salary || salary.toLowerCase().includes('negotiable')) {
      return null;
    }

    // Extract numbers and currency from salary string
    const numbers = salary.match(/\d+/g);
    const currency = salary.match(/[$€£¥₹]/)?.[0] || '$';
    
    if (numbers && numbers.length >= 2) {
      return {
        min: parseInt(numbers[0]),
        max: parseInt(numbers[1]),
        currency
      };
    } else if (numbers && numbers.length === 1) {
      const amount = parseInt(numbers[0]);
      return {
        min: amount,
        max: amount,
        currency
      };
    }
    
    return null;
  }

  /**
   * Determine experience level from job title and description
   */
  private determineExperienceLevel(jobTitle: string, jdText?: string): 'entry_level' | 'mid_level' | 'senior_level' | 'executive' {
    const title = jobTitle.toLowerCase();
    const text = jdText?.toLowerCase() || '';
    
    if (title.includes('senior') || title.includes('lead') || title.includes('principal') || 
        title.includes('director') || title.includes('manager') || title.includes('head')) {
      return 'senior_level';
    }
    
    if (title.includes('executive') || title.includes('vp') || title.includes('ceo') || 
        title.includes('cto') || title.includes('cfo') || title.includes('president')) {
      return 'executive';
    }
    
    if (title.includes('junior') || title.includes('entry') || title.includes('associate') || 
        title.includes('intern') || text.includes('0-2 years') || text.includes('fresh graduate')) {
      return 'entry_level';
    }
    
    return 'mid_level';
  }

  /**
   * Determine employment type from text
   */
  private determineEmploymentType(jdText?: string): 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship' {
    if (!jdText) return 'full_time';
    
    const text = jdText.toLowerCase();
    
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('freelance')) return 'contract';
    if (text.includes('temporary') || text.includes('temp')) return 'temporary';
    if (text.includes('intern') || text.includes('internship')) return 'internship';
    
    return 'full_time';
  }

  /**
   * Check for remote work in text
   */
  private checkForRemoteWork(jdText?: string): boolean {
    if (!jdText) return false;
    
    const text = jdText.toLowerCase();
    return text.includes('remote') || text.includes('work from home') || 
           text.includes('wfh') || text.includes('virtual');
  }

  /**
   * Extract skills from text
   */
  private extractSkills(jdText: string | undefined, type: 'required' | 'preferred'): string[] {
    if (!jdText) return [];
    
    const text = jdText.toLowerCase();
    const skills: string[] = [];
    
    // Common technical skills
    const technicalSkills = [
      'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'typescript',
      'sql', 'mongodb', 'postgresql', 'aws', 'azure', 'docker', 'kubernetes',
      'machine learning', 'ai', 'data science', 'analytics', 'git', 'agile', 'scrum'
    ];
    
    for (const skill of technicalSkills) {
      if (text.includes(skill)) {
        skills.push(skill);
      }
    }
    
    return skills;
  }

  /**
   * Extract education requirements
   */
  private extractEducation(jdText: string | undefined): string[] {
    if (!jdText) return [];
    
    const text = jdText.toLowerCase();
    const education: string[] = [];
    
    if (text.includes('bachelor') || text.includes('bachelor\'s')) education.push('Bachelor\'s Degree');
    if (text.includes('master') || text.includes('master\'s')) education.push('Master\'s Degree');
    if (text.includes('phd') || text.includes('doctorate')) education.push('PhD');
    if (text.includes('certification') || text.includes('certificate')) education.push('Certification');
    
    return education;
  }

  /**
   * Extract responsibilities
   */
  private extractResponsibilities(jdText: string | undefined): string[] {
    if (!jdText) return [];
    
    // This is a simplified extraction - in a real implementation, you'd use more sophisticated NLP
    const lines = jdText.split('\n');
    const responsibilities: string[] = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes('responsible') || line.toLowerCase().includes('duties') ||
          line.toLowerCase().includes('will') || line.toLowerCase().includes('must')) {
        responsibilities.push(line.trim());
      }
    }
    
    return responsibilities.slice(0, 5); // Limit to 5 responsibilities
  }

  /**
   * Extract qualifications
   */
  private extractQualifications(jdText: string | undefined): string[] {
    if (!jdText) return [];
    
    const lines = jdText.split('\n');
    const qualifications: string[] = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes('qualification') || line.toLowerCase().includes('requirement') ||
          line.toLowerCase().includes('experience') || line.toLowerCase().includes('skill')) {
        qualifications.push(line.trim());
      }
    }
    
    return qualifications.slice(0, 5); // Limit to 5 qualifications
  }

  /**
   * Extract benefits
   */
  private extractBenefits(jdText: string | undefined): string[] {
    if (!jdText) return [];
    
    const text = jdText.toLowerCase();
    const benefits: string[] = [];
    
    const benefitKeywords = [
      'health insurance', 'dental', 'vision', '401k', 'retirement', 'vacation',
      'pto', 'paid time off', 'flexible', 'bonus', 'stock options', 'equity',
      'gym', 'fitness', 'lunch', 'snacks', 'transportation', 'parking'
    ];
    
    for (const benefit of benefitKeywords) {
      if (text.includes(benefit)) {
        benefits.push(benefit);
      }
    }
    
    return benefits;
  }

  /**
   * Validate if file is a supported JD format
   */
  isSupportedJDFormat(fileName: string): boolean {
    return this.resumeReadParseUploadService.isSupportedResumeFormat(fileName);
  }
}

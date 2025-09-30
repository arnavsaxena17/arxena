import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JDParserService } from './jd-parser.service';

@Injectable()
export class JDUploadService {
  private readonly logger = new Logger(JDUploadService.name);

  constructor(private readonly jdParserService: JDParserService) {}

  /**
   * Process JD from attachment URL
   */
  async processJDFromAttachmentUrl(
    jobId: string,
    attachmentUrl: string,
    authToken: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log(`Processing JD for job ${jobId} from URL: ${attachmentUrl}`);

      // Download the file from the attachment URL
      const tempFilePath = await this.downloadAttachmentFile(
        attachmentUrl,
        authToken,
        jobId,
      );

      try {
        // Process the JD using the local service
        const jobDetails = await this.jdParserService.processJDFromFile(tempFilePath);
        
        // Generate job code from filename if not present
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
          pathPosition: (jobDetails.company_industry || '')
            .replace(/[\s\-_]/g, ''),
        };

        this.logger.log('Successfully processed JD:', responseData);

        return {
          success: true,
          data: responseData,
        };
      } finally {
        // Clean up temporary file
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
      this.logger.error(`Error processing JD for job ${jobId}:`, error);
      return {
        success: false,
        data: { error: error.message },
      };
    }
  }

  /**
   * Download attachment file to temporary location
   */
  private async downloadAttachmentFile(
    attachmentUrl: string,
    authToken: string,
    jobId: string,
  ): Promise<string> {
    try {
      const response = await axios.get(attachmentUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: '*/*',
        },
        timeout: 30000, // 30 seconds timeout
        responseType: 'stream',
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download attachment: ${response.status}`);
      }

      // Get original filename from URL or Content-Disposition header
      let originalFilename = this.extractFilenameFromResponse(response, attachmentUrl);
      
      if (!originalFilename || !originalFilename.includes('.')) {
        originalFilename = `temp_jd_${jobId}.pdf`;
      }

      // Ensure filename is safe
      originalFilename = this.sanitizeFilename(originalFilename);

      // Create temp directory
      const tempDir = path.join(os.tmpdir(), 'jd_uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, originalFilename);

      // Write file to disk
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

  /**
   * Extract filename from response headers or URL
   */
  private extractFilenameFromResponse(response: any, attachmentUrl: string): string {
    // Try to get from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        return filenameMatch[1];
      }
    }

    // Try to get from URL, removing query parameters
    const urlPath = attachmentUrl.split('?')[0];
    const filename = path.basename(urlPath);
    
    return filename || '';
  }

  /**
   * Sanitize filename to be safe for filesystem
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // Limit length
    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      sanitized = nameWithoutExt.substring(0, 100 - ext.length) + ext;
      sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    }

    return sanitized;
  }

  /**
   * Generate job code from job name
   */
  private generateJobCode(jobName: string): string {
    if (!jobName) return 'JD-001';
    
    return jobName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 10);
  }
}

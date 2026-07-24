import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class FileUtils {
  private readonly logger = new Logger(FileUtils.name);

  /**
   * Download file from URL to temporary location
   */
  async downloadFileFromUrl(url: string, apiToken: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: '*/*',
        },
        timeout: 30000, // 30 seconds timeout
        responseType: 'stream',
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      // Get original filename from URL or Content-Disposition header
      let originalFilename = this.extractFilenameFromResponse(response, url);
      
      if (!originalFilename || !originalFilename.includes('.')) {
        originalFilename = `temp_jd_${Date.now()}.pdf`;
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
          this.logger.log(`Successfully downloaded file to: ${tempFilePath}`);
          resolve(tempFilePath);
        });
        writer.on('error', (error) => {
          this.logger.error('Error writing file:', error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Error downloading file from URL:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Extract filename from response headers or URL
   */
  private extractFilenameFromResponse(response: any, url: string): string {
    // Try to get from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        return filenameMatch[1];
      }
    }

    // Try to get from URL, removing query parameters
    const urlPath = url.split('?')[0];
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
   * Clean up temporary file
   */
  cleanupTempFile(filePath: string): void {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        this.logger.log(`Cleaned up temporary file: ${filePath}`);
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
      }
    }
  }
}

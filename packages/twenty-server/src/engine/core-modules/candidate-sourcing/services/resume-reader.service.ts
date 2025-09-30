import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as mammoth from 'mammoth';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';

export interface ResumeContent {
  text: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

@Injectable()
export class ResumeReaderService {
  private readonly logger = new Logger(ResumeReaderService.name);

  /**
   * Read resume content from various file types (PDF, DOCX, DOC)
   */
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

      // Clean the extracted text
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

  /**
   * Read PDF file content
   */
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

  /**
   * Read DOCX file content
   */
  private async readDocxFile(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      this.logger.error(`Error reading DOCX file ${filePath}:`, error);
      throw new Error(`Failed to read DOCX file: ${error.message}`);
    }
  }

  /**
   * Read DOC file content (using mammoth as fallback)
   */
  private async readDocFile(filePath: string): Promise<string> {
    try {
      // Try to read as DOCX first (mammoth can sometimes handle .doc files)
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      this.logger.warn(`Failed to read DOC file with mammoth, trying alternative method: ${error.message}`);
      
      // For .doc files, we might need additional processing
      // This is a simplified approach - in production, you might want to use a more robust solution
      throw new Error(`DOC file reading not fully supported. Please convert to DOCX or PDF format.`);
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string): string {
    if (!text) return '';

    // Remove excessive whitespace and normalize line breaks
    let cleaned = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')   // Handle old Mac line endings
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .trim();

    // Remove special characters that might interfere with parsing
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return cleaned;
  }

  /**
   * Read multiple resume files
   */
  async readMultipleResumeFiles(filePaths: string[]): Promise<ResumeContent[]> {
    const results: ResumeContent[] = [];
    
    for (const filePath of filePaths) {
      try {
        const content = await this.readResumeFile(filePath);
        results.push(content);
      } catch (error) {
        this.logger.error(`Failed to read file ${filePath}:`, error);
        // Continue with other files even if one fails
      }
    }

    return results;
  }

  /**
   * Validate if file is a supported resume format
   */
  isSupportedResumeFormat(fileName: string): boolean {
    const supportedExtensions = ['.pdf', '.docx', '.doc'];
    const extension = path.extname(fileName).toLowerCase();
    return supportedExtensions.includes(extension);
  }

  /**
   * Get file type from filename
   */
  getFileType(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }
}

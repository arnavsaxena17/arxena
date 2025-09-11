import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
// import * as libre from 'libreoffice-convert';

export interface PositionInfo {
  name: string;
  company?: {
    name: string;
    domainName?: {
      primaryLinkUrl: string;
    };
  };
  company_name?: string;
  jobLocation?: string;
  search_name?: string;
}

export interface CandidateData {
  name: string;
  age?: number;
  years_of_experience?: number;
  educational_qualifications?: string;
  university_college?: string;
  current_job_title?: string;
  current_company?: string;
  current_location?: string;
  current_role_description?: string;
  reports_to?: string;
  functions_reporting_to?: string;
  reason_for_leaving?: string;
  current_salary?: string;
  expected_salary?: string;
  notice_period?: string;
  image_url?: string;
}

@Injectable()
export class DocumentTemplateService {
  private readonly defaultFont = 'Calibri';
  private readonly defaultFontSize = 11;
  private readonly primaryColor = '0070C0'; // RGB(0, 112, 192)
  private readonly secondaryColor = '595959'; // RGB(89, 89, 89)
  private readonly lightGrayColor = '808080'; // RGB(128, 128, 128)
  private readonly borderColor = '808080'; // RGB(128, 128, 128)
  // private readonly libreConvert = promisify(libre.convert);

  private async downloadImage(url: string, filename: string): Promise<string> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      const dir = path.join(process.cwd(), 'working_naukri_candidates', 'results', 'images');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, buffer);
      return filepath;
    } catch (error) {
      console.error('Error downloading image:', error);
      return this.getPlaceholderImagePath();
    }
  }

  private getPlaceholderImagePath(): string {
    // Try to find placeholder image in different possible locations
    const possiblePaths = [
      // First try the arxena-site static directory (where place_holder_photo.png exists)
      '/Users/arnavsaxena/MEGA/arx/arxena-site/static/img/place_holder_photo.png',
      '/Users/arnavsaxena/MEGA/arx/arxena-site/static/img/blank-image.png',
      // Then try local paths relative to twenty-server
      path.join(process.cwd(), 'static', 'img', 'place_holder_photo.png'),
      path.join(process.cwd(), 'static', 'img', 'placeholder.png'),
      path.join(process.cwd(), 'static', 'img', 'blank-image.png')
    ];

    for (const imagePath of possiblePaths) {
      if (fs.existsSync(imagePath)) {
        console.log(`Using placeholder image: ${imagePath}`);
        return imagePath;
      }
    }

    // If no placeholder found, return the first path from arxena-site
    console.warn('No placeholder image found, using default path');
    return possiblePaths[0];
  }





  async getCompanyLogo(positionInfo: PositionInfo): Promise<Buffer | null> {
    if (!positionInfo.company?.domainName?.primaryLinkUrl) {
      return null;
    }

    try {
      const companyWebsiteUrl = positionInfo.company.domainName.primaryLinkUrl;
      const cleanUrl = companyWebsiteUrl
        .replace('https://', '')
        .replace('http://', '')
        .replace('www.', '')
        .replace('/', '');

      const logoUrl = `https://logo.clearbit.com/${cleanUrl}`;
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      
      if (response.status === 200) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error downloading company logo:', error);
    }

    return null;
  }

  async getWorkspaceLogo(origin: string, twentyToken: string): Promise<Buffer | null> {
    try {
      const response = await axios.post(
        `${origin}/graphql`,
        {
          query: `
            query GetCurrentUser {
              currentUser {
                workspaces {
                  workspace {
                    logo
                  }
                }
              }
            }
          `
        },
        {
          headers: {
            'Authorization': `Bearer ${twentyToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const logoPath = response.data.data.currentUser.workspaces[0].workspace.logo;
      if (!logoPath) return null;

      const logoUrl = `${origin}/files/${logoPath}`;
      const logoResponse = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      
      return Buffer.from(logoResponse.data);
    } catch (error) {
      console.error('Error getting workspace logo:', error);
      return null;
    }
  }

  private createFooter(workspaceLogo?: Buffer, companyLogo?: Buffer): Footer {
    const children: (TextRun | ImageRun)[] = [];

    if (companyLogo) {
      children.push(
        new ImageRun({
          data: companyLogo,
          transformation: {
            width: 57.6, // 0.4 inches in points
            height: 57.6
          },
          type: 'png'
        })
      );
    }

    children.push(new TextRun({ text: '\tPage ', size: 18, color: '808080' }));
    
    // Add proper page number using TextRun with page number formatting
    children.push(new TextRun({ 
      text: '',
      size: 18, 
      color: '808080',
      children: [PageNumber.CURRENT]
    }));

    if (workspaceLogo) {
      children.push(new TextRun({ text: '\t' }));
      children.push(
        new ImageRun({
          data: workspaceLogo,
          transformation: {
            width: 57.6,
            height: 57.6
          },
          type: 'png'
        })
      );
    }

    return new Footer({
      children: [
        new Paragraph({
          children,
          alignment: AlignmentType.LEFT
        })
      ]
    });
  }

  private createCoverPage(positionInfo: PositionInfo, workspaceLogo?: Buffer, companyLogo?: Buffer): (Paragraph | Table)[] {
    const children: (Paragraph | Table)[] = [];

    // Workspace logo
    if (workspaceLogo) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: workspaceLogo,
              transformation: {
                width: 216, // 3 inches
                height: 216
              },
              type: 'png'
            })
          ],
          alignment: AlignmentType.CENTER
        })
      );
    }

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Prospective Candidate Info",
            size: 56, // 28pt
            font: "Calibri Light",
            color: "0070C0"
          })
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER
      })
    );

    // Add line break after title for better spacing
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "", size: 20 })],
        spacing: { after: 400 } // Add space after paragraph
      })
    );

    // Position details
    const searchName = positionInfo.company 
      ? `${positionInfo.name}, ${positionInfo.company.name}`
      : positionInfo.name;

    const details = [
      { label: "Search Name", value: searchName },
      { label: "Job Location", value: positionInfo.jobLocation },
      { label: "Company Name", value: positionInfo.company_name }
    ];

    details.forEach(detail => {
      if (detail.value) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${detail.label}: ${detail.value}`,
                size: 28, // 14pt
                color: "595959"
              })
            ],
            alignment: AlignmentType.CENTER
          })
        );
      }
    });

    // Date
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Presented on: ${new Date().toISOString().split('T')[0]}`,
            size: 20, // 10pt
            italics: true,
            color: "808080"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 } // Add space after date
      })
    );

    // Company logo
    if (companyLogo) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: companyLogo,
              transformation: {
                width: 144, // 2 inches
                height: 144
              },
              type: 'png'
            })
          ],
          alignment: AlignmentType.CENTER
        })
      );
    }

    return children;
  }

  private async createCandidatePages(candidates: CandidateData[], workspaceLogo?: Buffer, companyLogo?: Buffer): Promise<(Paragraph | Table)[]> {
    const pages: (Paragraph | Table)[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      
      // Candidate name heading - add page break to first element for each candidate
      pages.push(
        new Paragraph({
          children: [
            new TextRun({
              text: candidate.name,
              size: 48, // 24pt
              font: "Calibri Light",
              color: "0070C0"
            })
          ],
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: true // This ensures each candidate starts on a new page
        })
      );

      // Candidate photo - always display either candidate photo or placeholder
      let photoPath: string;
      
      if (candidate.image_url) {
        try {
          photoPath = await this.downloadImage(
            candidate.image_url,
            `${candidate.name.toLowerCase().replace(/[.\s]/g, '')}.jpeg`
          );
        } catch (error) {
          console.error('Error downloading candidate photo:', error);
          photoPath = this.getPlaceholderImagePath();
        }
      } else {
        // No image URL provided, use placeholder
        photoPath = this.getPlaceholderImagePath();
      }

      // Always add photo (either candidate photo or placeholder)
      try {
        let imageBuffer: Buffer;
        
        if (fs.existsSync(photoPath)) {
          imageBuffer = fs.readFileSync(photoPath);
        } else {
          // If the file doesn't exist, try to create a minimal placeholder
          console.warn(`Photo not found at ${photoPath}, using fallback`);
          photoPath = this.getPlaceholderImagePath();
          if (fs.existsSync(photoPath)) {
            imageBuffer = fs.readFileSync(photoPath);
          } else {
            // Skip image if no placeholder available
            console.error('No placeholder image available');
            throw new Error('No image available');
          }
        }

        pages.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: 144, // 2 inches
                  height: 144
                },
                type: 'png' // Changed to png for better placeholder compatibility
              })
            ],
            spacing: { after: 400 } // Add space after image
          })
        );
      } catch (error) {
        console.error('Error adding photo to document:', error);
        // Add a text placeholder if image fails completely
        pages.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Photo Not Available]',
                italics: true,
                color: '808080'
              })
            ],
            spacing: { after: 400 } // Add space after placeholder text
          })
        );
      }

      // Candidate information table
      const tableRows = [
        ["Name", candidate.name],
        ["Age", candidate.age?.toString() || ""],
        ["Years of Experience", candidate.years_of_experience?.toString() || ""],
        ["Educational Qualifications", candidate.educational_qualifications || ""],
        ["University/College", candidate.university_college || ""],
        ["Current Job", `${candidate.current_job_title || ""} at ${candidate.current_company || ""}`],
        ["Current Role", candidate.current_role_description || ""],
        ["Reporting To", candidate.reports_to || ""],
        ["Functions Reporting", candidate.functions_reporting_to || ""],
        ["Location", candidate.current_location || ""],
        ["Reason for Leaving", candidate.reason_for_leaving || ""],
        ["Current Salary", candidate.current_salary || ""],
        ["Expected Salary", candidate.expected_salary || ""],
        ["Joining Period", candidate.notice_period || ""]
      ].filter(([_, value]) => value && value !== "0");

      const table = new Table({
        columnWidths: [2500, 4000], // Column widths in twentieths of a point
        rows: tableRows.map(([field, value]) => 
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: field,
                        bold: true,
                        color: "0070C0"
                      })
                    ]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: value })]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                }
              })
            ]
          })
        )
      });

      pages.push(table);
    }

    return pages;
  }

  async createDocument(
    candidates: CandidateData[],
    outputFile: string,
    positionInfo: PositionInfo,
    twentyToken: string,
    origin: string,
  ): Promise<string> {
    console.log('Creating shortlist document:', outputFile);

    try {
      // Get logos
      const companyLogo = await this.getCompanyLogo(positionInfo);
      const workspaceLogo = await this.getWorkspaceLogo(origin, twentyToken);

      // Create cover page
      const coverPageElements = this.createCoverPage(positionInfo, workspaceLogo || undefined, companyLogo || undefined);

      // Create candidate pages
      const candidateElements = await this.createCandidatePages(candidates, workspaceLogo || undefined, companyLogo || undefined);

      // Create document
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch in twentieths of a point
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          headers: {
            default: new Header({
              children: []
            })
          },
          footers: {
            default: this.createFooter(workspaceLogo || undefined, companyLogo || undefined)
          },
          children: [
            ...coverPageElements,
            ...candidateElements
          ]
        }]
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputFile);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Generate and save document
      const buffer = await Packer.toBuffer(doc);
      await fs.promises.writeFile(outputFile, buffer);

      // Convert to PDF if needed
      // try {
      //   const pdfPath = outputFile.replace('.docx', '.pdf');
      //   const pdfBuffer = await this.libreConvert(buffer, '.pdf', undefined);
      //   await fs.promises.writeFile(pdfPath, pdfBuffer);
      //   console.log(`PDF created: ${pdfPath}`);
      // } catch (pdfError) {
      //   console.error('PDF conversion failed:', pdfError);
      // }

      console.log('Document created successfully:', outputFile);
      return outputFile;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }
}

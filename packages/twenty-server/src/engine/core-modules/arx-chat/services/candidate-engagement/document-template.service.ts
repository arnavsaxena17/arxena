import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HeightRule,
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
  yearsOfExperience?: number;
  educationalQualifications?: string;
  universityCollege?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  currentLocation?: string;
  currentRoleDescription?: string;
  reportsTo?: string;
  functionsReportingTo?: string;
  reasonForLeaving?: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  imageUrl?: string;
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
      if (!url || !url.startsWith('http')) {
        console.warn('Invalid image URL:', url);
        return this.getPlaceholderImagePath();
      }

      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout for image downloads
      });
      const buffer = Buffer.from(response.data);
      
      const dir = path.join(process.cwd(), 'working_naukri_candidates', 'results', 'images');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, buffer as Uint8Array);
      return filepath;
    } catch (error) {
      console.error('Error downloading image:', error.message || error);
      return this.getPlaceholderImagePath();
    }
  }

  private getPlaceholderImagePath(): string {
    // Use __dirname to resolve path relative to compiled output (dist/src/.../arx-chat/static/)
    const placeholderPath = path.join(__dirname, '..', '..', 'static', 'place_holder_photo.png');
    if (fs.existsSync(placeholderPath)) {
      return placeholderPath;
    }
    // Fallback for development when running from src
    const devPath = path.join(process.cwd(), 'src', 'engine', 'core-modules', 'arx-chat', 'static', 'place_holder_photo.png');
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    console.warn('No placeholder image found at arx-chat/static/place_holder_photo.png');
    return placeholderPath;
  }

  private getInlinePlaceholderImage(): Buffer {
    // 1x1 px light gray PNG
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P2wQGQAAAABJRU5ErkJggg==';
    return Buffer.from(base64, 'base64');
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

      if (!cleanUrl || cleanUrl.length === 0) {
        console.warn('Invalid company URL for logo:', companyWebsiteUrl);
        return null;
      }

      const logoUrl = `https://logo.clearbit.com/${cleanUrl}`;
      const response = await axios.get(logoUrl, { 
        responseType: 'arraybuffer',
        timeout: 5000 // Add timeout
      });
      
      if (response.status === 200) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      console.error('Error downloading company logo:', error.message || error);
    }

    return null;
  }

  async getWorkspaceLogo(origin: string, twentyToken: string): Promise<Buffer | null> {
    try {
      // Validate origin URL
      if (!origin || !origin.startsWith('http')) {
        console.warn('Invalid origin URL for workspace logo:', origin);
        return null;
      }

      // Check if the hostname is resolvable
      const url = new URL(origin);
      if (url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
        console.warn('Localhost hostname may not be resolvable:', url.hostname);
        return null;
      }

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
          },
          timeout: 5000 // Add timeout to prevent hanging
        }
      );

      const logoPath = response.data.data.currentUser.workspaces[0].workspace.logo;
      if (!logoPath) return null;

      const logoUrl = `${origin}/files/${logoPath}`;
      const logoResponse = await axios.get(logoUrl, { 
        responseType: 'arraybuffer',
        timeout: 5000 // Add timeout
      });
      
      return Buffer.from(logoResponse.data);
    } catch (error) {
      console.error('Error getting workspace logo:', error.message || error);
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

    // Add empty lines to center content when no logos are present
    if (!workspaceLogo && !companyLogo) {
      // Add multiple empty paragraphs to push content toward center
      for (let i = 0; i < 8; i++) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "", size: 20 })],
            spacing: { after: 400 }
          })
        );
      }
    }

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
      { label: "Project Location", value: positionInfo.jobLocation },
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

    // Add empty lines at the end to center content when no logos are present
    if (!workspaceLogo && !companyLogo) {
      for (let i = 0; i < 6; i++) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "", size: 20 })],
            spacing: { after: 400 }
          })
        );
      }
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
      
      if (candidate.imageUrl) {
        try {
          photoPath = await this.downloadImage(
            candidate.imageUrl,
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
      let imageBuffer: Buffer | undefined;
      
      if (fs.existsSync(photoPath)) {
        imageBuffer = fs.readFileSync(photoPath);
      } else {
        console.warn(`Photo not found at ${photoPath}, using fallback`);
        photoPath = this.getPlaceholderImagePath();
        if (fs.existsSync(photoPath)) {
          imageBuffer = fs.readFileSync(photoPath);
        } else {
          console.warn('No placeholder image available on disk, using inline placeholder');
          imageBuffer = this.getInlinePlaceholderImage();
        }
      }

      if (imageBuffer) {
        pages.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: 300, // Increased profile image size
                  height: 300
                },
                type: 'png' // Changed to png for better placeholder compatibility
              })
            ],
            spacing: { after: 400 } // Add space after image
          })
        );
      } else {
        pages.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[Photo Not Available]',
                italics: true,
                color: this.lightGrayColor
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
        ["Years of Experience", candidate.yearsOfExperience?.toString() || ""],
        ["Educational Qualifications", candidate.educationalQualifications || ""],
        ["University/College", candidate.universityCollege || ""],
        ["Current Project", `${candidate.currentJobTitle || ""} at ${candidate.currentCompany || ""}`],
        ["Current Role", candidate.currentRoleDescription || ""],
        ["Reporting To", candidate.reportsTo || ""],
        ["Functions Reporting", candidate.functionsReportingTo || ""],
        ["Location", candidate.currentLocation || ""],
        ["Reason for Leaving", candidate.reasonForLeaving || ""],
        ["Current Salary", candidate.currentSalary || ""],
        ["Expected Salary", candidate.expectedSalary || ""],
        ["Joining Period", candidate.noticePeriod || ""]
      ].filter(([field, value]) => {
        // Always include "Current Role" if it has any value
        if (field === "Current Role") {
          return value && typeof value === 'string' && value.trim().length > 0;
        }
        // For "Current Project", filter out if it's just " at " (both fields empty)
        if (field === "Current Project") {
          return value && typeof value === 'string' && value.trim() !== "at" && value.trim().length > 0;
        }
        // For other fields, filter out empty values and "0"
        return value && value !== "0";
      });

      console.log('Table rows for candidate:', candidate, tableRows);

      const table = new Table({
        rows: tableRows.map(([field, value]) =>
          new TableRow({
            height: {
              rule: HeightRule.ATLEAST,
              value: 300
            },
            children: [
              new TableCell({
                width: {
                  size: 2000,
                  type: 'dxa' // twentieths of a point
                },
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
                width: {
                  size: 7360,
                  type: 'dxa' // twentieths of a point
                },
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
      await fs.promises.writeFile(outputFile, buffer as Uint8Array);

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

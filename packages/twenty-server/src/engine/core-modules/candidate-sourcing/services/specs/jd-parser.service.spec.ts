import { Test, TestingModule } from '@nestjs/testing';
import { JDParserService } from '../jd-parser.service';
import { ResumeReadParseUploadService } from '../resume-read-parse-upload.service';

describe('JDParserService', () => {
  let service: JDParserService;
  let resumeReadParseUploadService: ResumeReadParseUploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JDParserService,
        {
          provide: ResumeReadParseUploadService,
          useValue: {
            readResumeFile: jest.fn(),
            isSupportedResumeFormat: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JDParserService>(JDParserService);
    resumeReadParseUploadService = module.get<ResumeReadParseUploadService>(ResumeReadParseUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate supported JD formats', () => {
    const mockIsSupported = jest.spyOn(resumeReadParseUploadService, 'isSupportedResumeFormat');
    mockIsSupported.mockReturnValue(true);

    const result = service.isSupportedJDFormat('test.pdf');
    expect(result).toBe(true);
    expect(mockIsSupported).toHaveBeenCalledWith('test.pdf');
  });

  it('should handle unsupported JD formats', () => {
    const mockIsSupported = jest.spyOn(resumeReadParseUploadService, 'isSupportedResumeFormat');
    mockIsSupported.mockReturnValue(false);

    const result = service.isSupportedJDFormat('test.txt');
    expect(result).toBe(false);
    expect(mockIsSupported).toHaveBeenCalledWith('test.txt');
  });

  it('should process JD from text', async () => {
    const mockJdText = `
      Job Title: Senior Software Engineer
      Company: Tech Corp
      Location: San Francisco, CA
      Salary: $120,000 - $150,000
      Description: We are looking for a senior software engineer...
    `;

    // Mock the OpenAI response
    const mockJobDetails = {
      job_name: 'Senior Software Engineer',
      job_code: 'SSE-001',
      location: 'San Francisco, CA',
      salary: '$120,000 - $150,000',
      company_name: 'Tech Corp',
      company_one_line_pitch: 'Leading technology company',
      company_industry: 'Technology',
      company_website_url: 'https://techcorp.com',
    };

    // Mock the OpenAI client
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify(mockJobDetails),
              },
            }],
          }),
        },
      },
    };

    // Replace the OpenAI instance
    (service as any).openai = mockOpenAI;

    const result = await service.processJDFromText(mockJdText);

    expect(result).toEqual(mockJobDetails);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: expect.stringContaining('Extract the following details') },
          { role: 'user', content: mockJdText },
        ],
      }),
    );
  });

  it('should handle OpenAI API errors', async () => {
    const mockJdText = 'Invalid JD text';

    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      },
    };

    (service as any).openai = mockOpenAI;

    await expect(service.processJDFromText(mockJdText)).rejects.toThrow('Failed to process JD text: Failed to extract job details: API Error');
  });

  it('should handle file processing errors', async () => {
    const mockFilePath = '/path/to/nonexistent/file.pdf';
    const mockError = new Error('File not found');

    jest.spyOn(resumeReadParseUploadService, 'readResumeFile').mockRejectedValue(mockError);

    await expect(service.processJDFromFile(mockFilePath)).rejects.toThrow('Failed to process JD file: File not found');
  });

  it('should handle invalid JSON response from OpenAI', async () => {
    const mockJdText = 'Some JD text';

    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'invalid json',
              },
            }],
          }),
        },
      },
    };

    (service as any).openai = mockOpenAI;

    await expect(service.processJDFromText(mockJdText)).rejects.toThrow('Failed to process JD text');
  });
});

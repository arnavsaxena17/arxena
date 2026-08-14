import { HttpStatus } from '@nestjs/common';

import { PeopleNaturalLanguageParserService } from '../people-natural-language-parser.service';

const mockCompletionCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCompletionCreate,
      },
    },
  })),
);

const buildCompletionResponse = (payload: unknown) => ({
  choices: [
    {
      message: {
        content: JSON.stringify(payload),
      },
    },
  ],
});

describe('PeopleNaturalLanguageParserService', () => {
  const originalOpenAiKey = process.env.OPENAI_KEY;
  let service: PeopleNaturalLanguageParserService;

  beforeEach(() => {
    process.env.OPENAI_KEY = 'test-key';
    mockCompletionCreate.mockReset();
    service = new PeopleNaturalLanguageParserService();
  });

  afterEach(() => {
    process.env.OPENAI_KEY = originalOpenAiKey;
  });

  it('should extract job title, company, website, and location', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: 'CEO',
        companyName: 'StayVista',
        website: null,
        location: 'India',
      }),
    );

    const result = await service.parse('CEO at StayVista in India');

    expect(mockCompletionCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      jobTitle: 'CEO',
      companyName: 'StayVista',
      location: 'India',
    });
  });

  it('should treat a domain after at as website', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: 'Head of Engineering',
        companyName: null,
        website: 'stripe.com/',
        location: null,
      }),
    );

    const result = await service.parse('Head of Engineering at stripe.com');

    expect(result).toEqual({
      jobTitle: 'Head of Engineering',
      website: 'stripe.com',
    });
  });

  it('should throw when the model returns no job title', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: '',
        companyName: 'Apple',
        website: null,
        location: null,
      }),
    );

    await expect(service.parse('at Apple')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('should throw when OPENAI_KEY is missing', async () => {
    delete process.env.OPENAI_KEY;

    await expect(service.parse('CEO at StayVista')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});

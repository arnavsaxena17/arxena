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

  it('should extract job title, company, website, and locations', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: 'CEO',
        companyName: 'StayVista',
        website: null,
        locations: ['India'],
      }),
    );

    const result = await service.parse('CEO at StayVista in India');

    expect(mockCompletionCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      jobTitle: 'CEO',
      companyName: 'StayVista',
      locations: ['India'],
    });
  });

  it('should split multiple locations and drop blanks', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: 'CEO',
        companyName: 'Acme',
        website: null,
        locations: ['UAE', ' Saudi Arabia ', 'uae', ''],
      }),
    );

    const result = await service.parse(
      'CEO at Acme in UAE and Saudi Arabia',
    );

    expect(result).toEqual({
      jobTitle: 'CEO',
      companyName: 'Acme',
      locations: ['UAE', 'Saudi Arabia'],
    });
  });

  it('should treat a domain after at as website', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: 'Head of Engineering',
        companyName: null,
        website: 'stripe.com/',
        locations: [],
      }),
    );

    const result = await service.parse('Head of Engineering at stripe.com');

    expect(result).toEqual({
      jobTitle: 'Head of Engineering',
      website: 'stripe.com',
      locations: [],
    });
  });

  it('should throw when the model returns no job title', async () => {
    mockCompletionCreate.mockResolvedValueOnce(
      buildCompletionResponse({
        jobTitle: '',
        companyName: 'Apple',
        website: null,
        locations: [],
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

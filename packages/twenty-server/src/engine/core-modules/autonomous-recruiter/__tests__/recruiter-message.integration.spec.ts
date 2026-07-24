import { Test } from '@nestjs/testing';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type {
  AssistantThreadMessage,
  AssistantThreadRecord,
} from 'src/engine/core-modules/assistant/assistant.types';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JobContextService } from '../job-context.service';
import { RecruiterMessageService } from '../recruiter-message.service';

describe('RecruiterMessageService (integration-style, mocked LLM + GraphQL)', () => {
  let service: RecruiterMessageService;
  let staticGraphQLService: jest.Mocked<StaticGraphQLService>;
  let assistantThreadService: jest.Mocked<AssistantThreadService>;
  let workspaceQueryService: jest.Mocked<WorkspaceQueryService>;

  const workspaceId = 'ws-1';
  const schema = 'public';
  const apiToken = 'token-from-api-key';
  const threadId = 'mock-thread-1';

  const mockMessages: AssistantThreadMessage[] = [
    {
      role: 'assistant',
      content:
        'What would you like to search for? I can help you find candidates by role, location, experience, and more.',
    },
    {
      role: 'user',
      content: 'Senior React developers in Bangalore, 5+ years experience.',
    },
    {
      role: 'assistant',
      content:
        'To refine the search: do you want only product companies or are agencies okay too?',
    },
  ];

  const mockThread: AssistantThreadRecord = {
    id: threadId,
    name: 'Senior React search – Bangalore',
    workspaceId,
    messages: mockMessages,
    lastTableData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    jobId: 'job-1',
    agentNotes: [
      {
        summary:
          'Client persona: prefers hands-on tech lead, product companies; fintech/SaaS experience a plus.',
      },
    ],
    agentEvents: [],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecruiterMessageService,
        JobContextService,
        {
          provide: StaticGraphQLService,
          useValue: {
            executeGraphQL: jest.fn(),
          },
        },
        {
          provide: WorkspaceQueryService,
          useValue: {
            getApiKeys: jest.fn(),
            apiKeyService: { generateApiKeyToken: jest.fn() },
          },
        },
        {
          provide: AssistantThreadService,
          useValue: {
            getThread: jest.fn(),
            appendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RecruiterMessageService);
    staticGraphQLService = moduleRef.get(
      StaticGraphQLService,
    ) as jest.Mocked<StaticGraphQLService>;
    workspaceQueryService = moduleRef.get(
      WorkspaceQueryService,
    ) as jest.Mocked<WorkspaceQueryService>;
    assistantThreadService = moduleRef.get(
      AssistantThreadService,
    ) as jest.Mocked<AssistantThreadService>;
  });

  it('runs end-to-end with mocked workspace token and job context, appending an instruction', async () => {
    // Workspace → API token
    workspaceQueryService.getApiKeys.mockResolvedValue([{ id: 'key-1' } as never]);
    (workspaceQueryService.apiKeyService.generateApiKeyToken as jest.Mock).mockResolvedValue(
      {
        token: apiToken,
      } as never,
    );

    // Thread + job context
    assistantThreadService.getThread.mockResolvedValue(mockThread);
    staticGraphQLService.executeGraphQL.mockResolvedValue({
      job: {
        id: 'job-1',
        name: 'Senior React Developer',
        companyName: 'Mock Product Co',
        jobLocation: 'Bangalore',
        searchName: 'Senior React – Bangalore',
      },
    } as never);

    const result = await service.generateRecruiterMessageWithWorkspace(
      workspaceId,
      schema,
      threadId,
      'What should I do next for this search?',
    );

    expect(result.text).toContain('What should I do next for this search?');
    expect(result.metadata?.jobContextSummary).toContain('Senior React Developer');

    // Append instruction into thread as a user message
    expect(assistantThreadService.appendMessage).toHaveBeenCalledWith(
      apiToken,
      threadId,
      'user',
      expect.stringContaining('What should I do next for this search?'),
    );
  });
});


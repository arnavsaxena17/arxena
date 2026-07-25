import { Test } from '@nestjs/testing';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type { AssistantThreadMessage, AssistantThreadRecord } from 'src/engine/core-modules/assistant/assistant.types';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ProjectContextService, type RecruiterProjectContext } from '../project-context.service';
import { RecruiterMessageService } from '../recruiter-message.service';

describe('RecruiterMessageService', () => {
  let service: RecruiterMessageService;
  let workspaceQueryService: jest.Mocked<WorkspaceQueryService>;
  let assistantThreadService: jest.Mocked<AssistantThreadService>;
  let jobContextService: jest.Mocked<ProjectContextService>;

  const apiToken = 'test-token';
  const threadId = 'thread-1';

  const buildThread = (overrides?: Partial<AssistantThreadRecord>): AssistantThreadRecord => ({
    id: threadId,
    name: 'Senior React search – Bangalore',
    workspaceId: 'ws-1',
    messages: [
      { role: 'assistant', content: 'How can I help with this search?' },
      { role: 'user', content: 'Find Senior React developers in Bangalore.' },
    ] as AssistantThreadMessage[],
    lastTableData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'job-1',
    agentNotes: [
      {
        summary: 'Client prefers hands-on React leads from product companies.',
        createdAt: new Date().toISOString(),
      },
    ],
    agentEvents: [],
    ...overrides,
  });

  const baseJobContext: RecruiterProjectContext = {
    projectId: 'job-1',
    jobTitle: 'Senior React Developer',
    companyName: 'Mock Product Co',
    jobLocation: 'Bangalore',
    searchName: 'Senior React – Bangalore',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecruiterMessageService,
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
        {
          provide: ProjectContextService,
          useValue: {
            fetchProjectContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RecruiterMessageService);
    workspaceQueryService = moduleRef.get(
      WorkspaceQueryService,
    ) as jest.Mocked<WorkspaceQueryService>;
    assistantThreadService = moduleRef.get(
      AssistantThreadService,
    ) as jest.Mocked<AssistantThreadService>;
    jobContextService = moduleRef.get(ProjectContextService) as jest.Mocked<ProjectContextService>;
  });

  it('appends a recruiter instruction with job context to the thread', async () => {
    const thread = buildThread();
    assistantThreadService.getThread.mockResolvedValue(thread);
    jobContextService.fetchProjectContext.mockResolvedValue(baseJobContext);
    const result = await service.generateRecruiterMessageWithToken(
      apiToken,
      threadId,
      'Draft a client update.',
    );

    // Appends a new user instruction message (for the autonomous recruiter) to the thread
    expect(assistantThreadService.appendMessage).toHaveBeenCalledWith(
      apiToken,
      threadId,
      'user',
      expect.stringContaining('Draft a client update.'),
    );

    // Metadata summary includes job + company
    expect(result.metadata?.jobContextSummary).toContain('Senior React Developer');
    expect(result.metadata?.jobContextSummary).toContain('Mock Product Co');
  });

  it('works when no job context is available', async () => {
    const thread = buildThread({ projectId: undefined });
    assistantThreadService.getThread.mockResolvedValue(thread);
    jobContextService.fetchProjectContext.mockResolvedValue(null);
    const result = await service.generateRecruiterMessageWithToken(
      apiToken,
      threadId,
      'How should I prioritize follow-ups?',
      { includeJobContext: false },
    );

    expect(result.text).toContain('How should I prioritize follow-ups?');
    expect(result.metadata?.jobContextSummary).toBeUndefined();
  });
});


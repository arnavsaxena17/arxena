import { Test, TestingModule } from '@nestjs/testing';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type { AssistantThreadRecord } from 'src/engine/core-modules/assistant/assistant.types';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from 'src/engine/core-modules/assistant/recruitment-agent-rules.service';
import { AutonomousRecruiterController } from 'src/engine/core-modules/autonomous-recruiter/autonomous-recruiter.controller';
import { RecruiterMessageService } from 'src/engine/core-modules/autonomous-recruiter/recruiter-message.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

jest.mock('src/engine/core-modules/assistant/mcp-assistant.service', () => {
  class MockMcpAssistantService {
    // Will be overridden per-test via useValue
    // but this avoids loading the real implementation (and its OpenAI dependency).
  }
  return { McpAssistantService: MockMcpAssistantService };
});

describe('AutonomousRecruiterController', () => {
  let controller: AutonomousRecruiterController;
  let assistantThreadService: {
    createThread: jest.Mock;
    getThread: jest.Mock;
    appendMessage: jest.Mock;
  };
  let recruiterMessageService: {
    generateRecruiterMessageWithToken: jest.Mock;
    generateRecruiterMessageFromThread: jest.Mock;
  };
  let mcpAssistantService: {
    processQueryStream: jest.Mock;
  };
  let autonomousRecruitmentAgentRulesService: {
    getSystemPrompt: jest.Mock;
  };

  const apiToken = 'demo-token';
  const threadId = 'demo-thread-1';
  const workspaceThread: AssistantThreadRecord = {
    id: threadId,
    name: 'Autonomous recruiter demo',
    workspaceId: 'ws-1',
    messages: [],
    lastTableData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'job-1',
    agentNotes: [],
    agentEvents: [],
  };

  beforeEach(async () => {
    assistantThreadService = {
      createThread: jest.fn().mockResolvedValue({ id: threadId, name: workspaceThread.name }),
      getThread: jest.fn().mockResolvedValue(workspaceThread),
      appendMessage: jest.fn().mockResolvedValue(undefined),
    };
    recruiterMessageService = {
      generateRecruiterMessageWithToken: jest.fn().mockResolvedValue({
        text: 'You are a senior recruiter... "Find senior React engineers in Bangalore"',
        metadata: {
          jobContextSummary: 'Senior React Developer @ Mock Product Co',
        },
      }),
      generateRecruiterMessageFromThread: jest.fn().mockResolvedValue({
        text: 'Continue the recruiter workflow with the next best action.',
        metadata: {
          jobContextSummary: 'Senior React Developer @ Mock Product Co',
        },
      }),
    };
    autonomousRecruitmentAgentRulesService = {
      getSystemPrompt: jest.fn().mockResolvedValue('You are an autonomous recruiter.'),
    };
    mcpAssistantService = {
      processQueryStream: jest.fn().mockImplementation(
        async (
          _query: string,
          _apiToken: string,
          _history: unknown[],
          onEvent: (event: string, data: unknown) => boolean,
        ) => {
          // Simulate a short streaming sequence for each turn.
          onEvent('text', { delta: 'I found 3 strong candidates for this requirement' });
          onEvent('text', { delta: ' and prepared outreach messages for the top 2.' });
          onEvent('done', {
            text:
              'I found 3 strong candidates for this requirement and prepared outreach messages for the top 2.',
            toolCalls: [
              { name: 'filter_candidates_for_job', args: { projectId: 'job-1' } },
              {
                name: 'fetch_contacts_for_candidates',
                args: { candidateIds: ['mock-cand-1', 'mock-cand-2'] },
              },
              {
                name: 'fetch_org_charts_for_companies',
                args: { companyIds: ['company-1', 'company-2'] },
              },
              {
                name: 'send_chat_to_candidates',
                args: {
                  candidateIds: ['mock-cand-1', 'mock-cand-2'],
                  channel: 'whatsapp',
                },
              },
            ],
          });
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutonomousRecruiterController],
      providers: [
        { provide: AssistantThreadService, useValue: assistantThreadService },
        { provide: RecruiterMessageService, useValue: recruiterMessageService },
        { provide: McpAssistantService, useValue: mcpAssistantService },
        {
          provide: AutonomousRecruitmentAgentRulesService,
          useValue: autonomousRecruitmentAgentRulesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AutonomousRecruiterController);
  });

  it('starts a demo thread and runs an autonomous recruiter conversation end-to-end', async () => {
    const requirement =
      'We need senior React developers in Bangalore with 5+ years experience at product companies.';

    const req = {
      headers: {
        authorization: `Bearer ${apiToken}`,
      },
      socket: { destroyed: false },
      on: jest.fn(),
    } as unknown as {
      headers: { authorization?: string };
      socket: { destroyed: boolean };
      on: jest.Mock;
    };

    const writtenChunks: string[] = [];
    const res = {
      closed: false,
      destroyed: false,
      socket: { destroyed: false },
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn((chunk: string) => {
        writtenChunks.push(chunk);
        return true;
      }),
      end: jest.fn(),
    } as unknown as {
      closed: boolean;
      destroyed: boolean;
      socket: { destroyed: boolean };
      on: jest.Mock;
      setHeader: jest.Mock;
      write: jest.Mock;
      end: jest.Mock;
    };

    await controller.startDemoConversationStream(
      { requirement, maxTurns: 3 },
      req as never,
      res as never,
    );

    expect(assistantThreadService.createThread).toHaveBeenCalledWith(
      apiToken,
      'Autonomous recruiter demo',
    );
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenCalledTimes(1);
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenCalledWith(
      apiToken,
      threadId,
      expect.stringContaining('I found 3 strong candidates'),
      {
        includeJobContext: true,
        appendUserMessageToThread: false,
      },
    );
    expect(recruiterMessageService.generateRecruiterMessageFromThread).toHaveBeenCalledTimes(2);
    expect(autonomousRecruitmentAgentRulesService.getSystemPrompt).toHaveBeenCalledTimes(3);
    expect(autonomousRecruitmentAgentRulesService.getSystemPrompt).toHaveBeenCalledWith(apiToken);
    expect(mcpAssistantService.processQueryStream).toHaveBeenCalledTimes(3);

    // One append for the initial user requirement, plus one per autonomous turn.
    expect(assistantThreadService.appendMessage).toHaveBeenCalledTimes(4);
    expect(
      assistantThreadService.appendMessage.mock.calls.filter(
        (call) => call[2] === 'assistant',
      ),
    ).toHaveLength(3);

    // We should have emitted 3 "step" events and one final "done" event.
    const stepEvents = writtenChunks.filter((chunk) => chunk.startsWith('event: step'));
    const doneEvents = writtenChunks.filter((chunk) => chunk.startsWith('event: done'));
    expect(stepEvents).toHaveLength(3);
    expect(doneEvents).toHaveLength(1);
  });

  it('runs exactly 5 recruiter/autonomous turns when maxTurns is 5', async () => {
    const requirement =
      'We need senior React developers in Bangalore with 5+ years experience at product companies.';

    const req = {
      headers: {
        authorization: `Bearer ${apiToken}`,
      },
      socket: { destroyed: false },
      on: jest.fn(),
    } as unknown as {
      headers: { authorization?: string };
      socket: { destroyed: boolean };
      on: jest.Mock;
    };

    const writtenChunks: string[] = [];
    const res = {
      closed: false,
      destroyed: false,
      socket: { destroyed: false },
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn((chunk: string) => {
        writtenChunks.push(chunk);
        return true;
      }),
      end: jest.fn(),
    } as unknown as {
      closed: boolean;
      destroyed: boolean;
      socket: { destroyed: boolean };
      on: jest.Mock;
      setHeader: jest.Mock;
      write: jest.Mock;
      end: jest.Mock;
    };

    await controller.startDemoConversationStream(
      { requirement, maxTurns: 5 },
      req as never,
      res as never,
    );

    expect(assistantThreadService.createThread).toHaveBeenCalledWith(
      apiToken,
      'Autonomous recruiter demo',
    );

    // Recruiter ↔ autonomous recruiter should exchange exactly 5 turns.
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenCalledTimes(1);
    expect(recruiterMessageService.generateRecruiterMessageFromThread).toHaveBeenCalledTimes(4);
    expect(mcpAssistantService.processQueryStream).toHaveBeenCalledTimes(5);

    // One append for the initial user requirement, plus one per autonomous turn.
    expect(assistantThreadService.appendMessage).toHaveBeenCalledTimes(6);
    expect(
      assistantThreadService.appendMessage.mock.calls.filter(
        (call) => call[2] === 'assistant',
      ),
    ).toHaveLength(5);

    const stepEvents = writtenChunks.filter((chunk) => chunk.startsWith('event: step'));
    const doneEvents = writtenChunks.filter((chunk) => chunk.startsWith('event: done'));
    expect(stepEvents).toHaveLength(5);
    expect(doneEvents).toHaveLength(1);
  });
});

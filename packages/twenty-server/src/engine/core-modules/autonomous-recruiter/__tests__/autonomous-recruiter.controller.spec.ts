import { Test, TestingModule } from '@nestjs/testing';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type { AssistantThreadRecord } from 'src/engine/core-modules/assistant/assistant.types';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { RecruitmentAgentRulesService } from 'src/engine/core-modules/assistant/recruitment-agent-rules.service';
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
  };
  let mcpAssistantService: {
    processQuery: jest.Mock;
  };
  let recruitmentAgentRulesService: {
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
    jobId: 'job-1',
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
    };
    recruitmentAgentRulesService = {
      getSystemPrompt: jest.fn().mockResolvedValue('You are an autonomous recruiter.'),
    };
    mcpAssistantService = {
      processQuery: jest.fn().mockResolvedValue({
        text:
          'I found 3 strong candidates for this requirement and prepared outreach messages for the top 2.',
        toolCalls: [
          { name: 'filter_candidates_for_job', args: { jobId: 'job-1' } },
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
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutonomousRecruiterController],
      providers: [
        { provide: AssistantThreadService, useValue: assistantThreadService },
        { provide: RecruiterMessageService, useValue: recruiterMessageService },
        { provide: McpAssistantService, useValue: mcpAssistantService },
        {
          provide: RecruitmentAgentRulesService,
          useValue: recruitmentAgentRulesService,
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

    const request = {
      headers: {
        authorization: `Bearer ${apiToken}`,
      },
      body: {
        requirement,
        maxTurns: 3,
      },
    } as unknown as {
      headers: { authorization?: string };
      body: { requirement: string; maxTurns: number };
    };

    const result = await controller.startDemoConversation(request, request.body);

    expect(assistantThreadService.createThread).toHaveBeenCalledWith(
      apiToken,
      'Autonomous recruiter demo',
    );
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenCalledTimes(3);
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenNthCalledWith(
      1,
      apiToken,
      threadId,
      requirement,
      { includeJobContext: true },
    );
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenNthCalledWith(
      2,
      apiToken,
      threadId,
      expect.stringContaining('Continue the recruiter workflow'),
      { includeJobContext: true },
    );
    expect(recruitmentAgentRulesService.getSystemPrompt).toHaveBeenCalledTimes(3);
    expect(recruitmentAgentRulesService.getSystemPrompt).toHaveBeenCalledWith(apiToken);
    expect(mcpAssistantService.processQuery).toHaveBeenCalledTimes(3);
    expect(assistantThreadService.appendMessage).toHaveBeenCalledTimes(3);
    expect(assistantThreadService.appendMessage).toHaveBeenCalledWith(
      apiToken,
      threadId,
      'assistant',
      expect.stringContaining('I found 3 strong candidates'),
      expect.any(Array),
    );

    expect(result.threadId).toBe(threadId);
    expect(result.requirement).toBe(requirement);
    expect(result.recruiterInstruction).toContain('You are a senior recruiter');
    const recruiterMetadata = result.recruiterMetadata as { jobContextSummary?: string } | null;
    expect(recruiterMetadata?.jobContextSummary).toContain('Senior React Developer');
    expect(result.autonomousResponse).toContain('I found 3 strong candidates');
    expect(result.toolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'filter_candidates_for_job' }),
        expect.objectContaining({ name: 'fetch_contacts_for_candidates' }),
        expect.objectContaining({ name: 'fetch_org_charts_for_companies' }),
        expect.objectContaining({ name: 'send_chat_to_candidates' }),
      ]),
    );

    expect(result.steps).toBeDefined();
    expect(result.steps).toHaveLength(3);
    expect(result.steps?.[0].recruiterInstruction).toContain('You are a senior recruiter');
    expect(result.steps?.[0].autonomousResponse).toContain('I found 3 strong candidates');
  });

  it('runs exactly 5 recruiter/autonomous turns when maxTurns is 5', async () => {
    const requirement =
      'We need senior React developers in Bangalore with 5+ years experience at product companies.';

    const request = {
      headers: {
        authorization: `Bearer ${apiToken}`,
      },
      body: {
        requirement,
        maxTurns: 5,
      },
    } as unknown as {
      headers: { authorization?: string };
      body: { requirement: string; maxTurns: number };
    };

    const result = await controller.startDemoConversation(request, request.body);

    expect(assistantThreadService.createThread).toHaveBeenCalledWith(
      apiToken,
      'Autonomous recruiter demo',
    );

    // Recruiter ↔ autonomous recruiter should exchange exactly 5 turns.
    expect(recruiterMessageService.generateRecruiterMessageWithToken).toHaveBeenCalledTimes(5);
    expect(mcpAssistantService.processQuery).toHaveBeenCalledTimes(5);
    expect(assistantThreadService.appendMessage).toHaveBeenCalledTimes(5);
    expect(result.steps).toHaveLength(5);

    // Log the recruiter and autonomous recruiter messages for visibility in test output.
    // eslint-disable-next-line no-console
    console.log(
      'Autonomous recruiter demo 5-turn conversation:',
      result.steps?.map((step) => ({
        step: step.step,
        recruiterInstruction: step.recruiterInstruction,
        autonomousResponse: step.autonomousResponse,
      })),
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { AssistantThreadService } from '../assistant/assistant-thread.service';
import { McpAssistantService } from '../assistant/mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from '../assistant/recruitment-agent-rules.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import {
  AutonomousRecruiterJobData,
  AutonomousRecruiterProcessor,
} from './autonomous-recruiter.processor';

describe('AutonomousRecruiterProcessor', () => {
  let processor: AutonomousRecruiterProcessor;
  let webSocketService: { sendToRoom: jest.Mock };
  let assistantThreadService: {
    listThreads: jest.Mock;
    createThread: jest.Mock;
    getThread: jest.Mock;
    appendMessage: jest.Mock;
  };
  let mcpAssistantService: { processQuery: jest.Mock };
  let workspaceQueryService: {
    getApiKeys: jest.Mock;
    apiKeyService: { generateApiKeyToken: jest.Mock };
  };
  let autonomousRecruitmentAgentRulesService: { getSystemPrompt: jest.Mock };

  const validJobData: AutonomousRecruiterJobData = {
    workspaceId: 'workspace-1',
    schema: 'workspace_1',
    runId: 'run-1',
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    webSocketService = { sendToRoom: jest.fn() };
    const autonomousThread = { id: 'thread-1', name: 'Autonomous' };
    assistantThreadService = {
      listThreads: jest.fn().mockResolvedValue([]),
      createThread: jest.fn().mockResolvedValue(autonomousThread),
      getThread: jest.fn().mockResolvedValue({ messages: [] }),
      appendMessage: jest.fn().mockResolvedValue(undefined),
    };
    mcpAssistantService = {
      processQuery: jest.fn().mockResolvedValue({ text: 'Done.', toolCalls: [] }),
    };
    autonomousRecruitmentAgentRulesService = {
      getSystemPrompt: jest.fn().mockResolvedValue('You are a recruiter.'),
    };
    workspaceQueryService = {
      getApiKeys: jest.fn().mockResolvedValue([{ id: 'key-1' }]),
      apiKeyService: {
        generateApiKeyToken: jest.fn().mockResolvedValue({ token: 'test-token' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutonomousRecruiterProcessor,
        { provide: WorkspaceQueryService, useValue: workspaceQueryService },
        { provide: AssistantThreadService, useValue: assistantThreadService },
        { provide: McpAssistantService, useValue: mcpAssistantService },
        { provide: AutonomousRecruitmentAgentRulesService, useValue: autonomousRecruitmentAgentRulesService },
        { provide: WebSocketService, useValue: webSocketService },
      ],
    }).compile();

    processor = module.get(AutonomousRecruiterProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should return early when workspaceId or schema is missing', async () => {
    await processor.handle({
      ...validJobData,
      workspaceId: '',
      schema: 'x',
    });
    expect(assistantThreadService.listThreads).not.toHaveBeenCalled();
    expect(webSocketService.sendToRoom).not.toHaveBeenCalled();
  });

  it('should get or create autonomous thread, run processQuery, and emit agent events', async () => {
    await processor.handle(validJobData);

    expect(workspaceQueryService.getApiKeys).toHaveBeenCalledWith(
      validJobData.workspaceId,
      validJobData.schema,
    );
    expect(assistantThreadService.listThreads).toHaveBeenCalledWith('test-token');
    expect(assistantThreadService.createThread).toHaveBeenCalledWith(
      'test-token',
      'Autonomous',
    );
    expect(mcpAssistantService.processQuery).toHaveBeenCalled();
    expect(assistantThreadService.appendMessage).toHaveBeenCalledTimes(2);
    expect(webSocketService.sendToRoom).toHaveBeenCalledWith(
      `workspace-${validJobData.workspaceId}`,
      'assistant.agent_event',
      expect.objectContaining({
        status: 'started',
        threadId: 'thread-1',
        runId: validJobData.runId,
        timestamp: expect.any(Number),
      }),
    );
    expect(webSocketService.sendToRoom).toHaveBeenCalledWith(
      `workspace-${validJobData.workspaceId}`,
      'assistant.agent_event',
      expect.objectContaining({
        status: 'completed',
        threadId: 'thread-1',
        runId: validJobData.runId,
        summary: expect.any(String),
        timestamp: expect.any(Number),
      }),
    );
  });
});

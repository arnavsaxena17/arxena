import { generateObject } from 'ai';

import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { AiSdkExecutionService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
}));

const generateObjectMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

describe('AiSdkExecutionService', () => {
  let service: AiSdkExecutionService;
  let aiBillingService: {
    billWorkflowAiSdkUsage: jest.Mock;
    calculateAndBillUsage: jest.Mock;
  };

  beforeEach(() => {
    aiBillingService = {
      billWorkflowAiSdkUsage: jest.fn().mockResolvedValue(undefined),
      calculateAndBillUsage: jest.fn().mockResolvedValue(undefined),
    };

    service = new AiSdkExecutionService(
      aiBillingService as unknown as AiBillingService,
    );
    generateObjectMock.mockReset();
  });

  it('bills workflow usage after generateObject succeeds', async () => {
    generateObjectMock.mockResolvedValue({
      object: { matches: true },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.generateObject({
      workspaceId: 'workspace-1',
      modelId: 'openrouter/deepseek/deepseek-v4-flash-0731',
      options: {
        model: { provider: 'mock' },
        schema: {},
        prompt: 'test',
      },
    });

    expect(aiBillingService.billWorkflowAiSdkUsage).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      modelId: 'openrouter/deepseek/deepseek-v4-flash-0731',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      userWorkspaceId: undefined,
      steps: undefined,
    });
  });

  it('skips billing when workspaceId is missing', async () => {
    generateObjectMock.mockResolvedValue({
      object: { matches: true },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.generateObject({
      workspaceId: undefined,
      modelId: 'gpt-4o',
      options: {
        model: { provider: 'mock' },
        schema: {},
        prompt: 'test',
      },
    });

    expect(aiBillingService.billWorkflowAiSdkUsage).not.toHaveBeenCalled();
  });

  it('uses calculateAndBillUsage for non-workflow operation types', async () => {
    generateObjectMock.mockResolvedValue({
      object: { title: 'Hello' },
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    } as Awaited<ReturnType<typeof generateObject>>);

    await service.generateObject({
      workspaceId: 'workspace-1',
      modelId: 'gpt-4o',
      operationType: UsageOperationType.AI_CHAT_TOKEN,
      options: {
        model: { provider: 'mock' },
        schema: {},
        prompt: 'test',
      },
    });

    expect(aiBillingService.calculateAndBillUsage).toHaveBeenCalled();
    expect(aiBillingService.billWorkflowAiSdkUsage).not.toHaveBeenCalled();
  });
});

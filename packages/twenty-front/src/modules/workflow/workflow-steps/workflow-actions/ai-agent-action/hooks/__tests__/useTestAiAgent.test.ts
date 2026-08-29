import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useTestAiAgent } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/hooks/useTestAiAgent';
import { useMutation } from '@apollo/client/react';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn(),
}));

jest.mock('@/object-metadata/hooks/useApolloCoreClient', () => ({
  useApolloCoreClient: jest.fn(),
}));

jest.mock('twenty-shared/utils', () => ({
  ...jest.requireActual('twenty-shared/utils'),
  resolveInput: jest.fn((input, context) => {
    if (typeof input === 'string') {
      return input.replace(/{{([^}]+)}}/g, (_match, path) => {
        const parts = path.split('.');
        let current = context;
        for (const part of parts) {
          if (
            current !== null &&
            current !== undefined &&
            typeof current === 'object' &&
            part in current
          ) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return 'undefined';
          }
        }
        return current;
      });
    }
    return input;
  }),
}));

describe('useTestAiAgent', () => {
  const actionId = 'test-action-id';
  const agentId = 'agent-1';
  const mockApolloClient = {};
  const mockMutate = jest.fn();

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  beforeEach(() => {
    jest.clearAllMocks();
    (useApolloCoreClient as jest.Mock).mockReturnValue(mockApolloClient);
    (useMutation as unknown as jest.Mock).mockReturnValue([mockMutate]);
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useTestAiAgent(actionId), {
      wrapper,
    });

    expect(result.current.isTesting).toBe(false);
    expect(result.current.testAiAgent).toBeInstanceOf(Function);
    expect(result.current.aiAgentTestData).toBeDefined();
  });

  it('substitutes prompt variables and stores a JSON result', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        testAiAgent: {
          success: true,
          message: 'AI agent test completed successfully',
          result: { summary: 'Jane is a candidate' },
          error: null,
          durationMs: 120,
        },
      },
    });

    const { result } = renderHook(() => useTestAiAgent(actionId), {
      wrapper,
    });

    await act(async () => {
      await result.current.testAiAgent({
        agentId,
        prompt: 'Summarize {{trigger.record.name}}',
        variableValues: { 'trigger.record.name': 'Jane' },
      });
    });

    expect(mockMutate).toHaveBeenCalledWith({
      variables: {
        input: {
          agentId,
          prompt: 'Summarize Jane',
        },
      },
    });
    expect(result.current.isTesting).toBe(false);
    expect(result.current.aiAgentTestData.language).toBe('json');
    expect(result.current.aiAgentTestData.output.data).toBe(
      '{\n  "summary": "Jane is a candidate"\n}',
    );
    expect(result.current.aiAgentTestData.output.error).toBeUndefined();
    expect(result.current.aiAgentTestData.output.duration).toBe(120);
  });

  it('stores an error when the mutation fails', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        testAiAgent: {
          success: false,
          message: 'Agent with id agent-1 not found',
          result: null,
          error: 'Agent with id agent-1 not found',
          durationMs: 12,
        },
      },
    });

    const { result } = renderHook(() => useTestAiAgent(actionId), {
      wrapper,
    });

    await act(async () => {
      await result.current.testAiAgent({
        agentId,
        prompt: 'Hello',
        variableValues: {},
      });
    });

    expect(result.current.aiAgentTestData.output.error).toBe(
      'Agent with id agent-1 not found',
    );
    expect(result.current.aiAgentTestData.output.data).toBeUndefined();
  });
});

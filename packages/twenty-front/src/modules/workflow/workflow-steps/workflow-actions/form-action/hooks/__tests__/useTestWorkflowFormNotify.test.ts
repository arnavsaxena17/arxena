import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useTestWorkflowFormNotify } from '@/workflow/workflow-steps/workflow-actions/form-action/hooks/useTestWorkflowFormNotify';
import { useMutation } from '@apollo/client/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn(),
}));

jest.mock('@/object-metadata/hooks/useApolloCoreClient', () => ({
  useApolloCoreClient: jest.fn(),
}));

describe('useTestWorkflowFormNotify', () => {
  const actionId = 'approve-first-message';
  const mockApolloClient = {};
  const mockMutate = jest.fn();

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  beforeEach(() => {
    jest.clearAllMocks();
    (useApolloCoreClient as jest.Mock).mockReturnValue(mockApolloClient);
    (useMutation as unknown as jest.Mock).mockReturnValue([mockMutate]);
  });

  it('should initialize without throwing after the jotai rename', () => {
    const { result } = renderHook(() => useTestWorkflowFormNotify(actionId), {
      wrapper,
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.isWaiting).toBe(false);
    expect(result.current.testWorkflowFormNotify).toBeInstanceOf(Function);
    expect(result.current.testData.variableValues).toEqual({});
  });
});

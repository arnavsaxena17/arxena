export interface NativeLogicFunctionHandler {
  isNative(name: string): boolean;
  execute(params: {
    name: string;
    workspaceId: string;
    payload: object;
    workflowRunId?: string;
    stepId?: string;
  }): Promise<object>;
}

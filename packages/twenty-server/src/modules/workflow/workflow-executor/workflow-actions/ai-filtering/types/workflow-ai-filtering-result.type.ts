export type WorkflowAiFilteringResult = {
  success: boolean;
  total: number;
  candidates: Array<
    Record<string, unknown> & { aiFilter: Record<string, unknown> }
  >;
  error?: string;
};

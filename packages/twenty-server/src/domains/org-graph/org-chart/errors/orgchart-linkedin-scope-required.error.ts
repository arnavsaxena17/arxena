export class OrgChartLinkedInScopeRequiredError extends Error {
  readonly code = 'ORGCHART_LINKEDIN_SCOPE_REQUIRED' as const;

  constructor(
    message: string,
    readonly details: {
      totalCount: number;
      threshold: number;
      estimatedApiRequests: number;
    },
  ) {
    super(message);
    this.name = 'OrgChartLinkedInScopeRequiredError';
  }
}

/**
 * Contract for POST /org-chart/search body + ?account_id= (mirrors org-chart.controller merge).
 */
function mergeOrgChartSearchBody(
  body: { linkedinUnipileAccountId?: string },
  accountIdQuery?: string,
): { linkedinUnipileAccountId?: string } {
  return {
    ...body,
    linkedinUnipileAccountId:
      accountIdQuery?.trim() || body.linkedinUnipileAccountId?.trim(),
  };
}

describe('org-chart search request (controller contract)', () => {
  it('uses query account_id when both query and body provide an id (query wins)', () => {
    const merged = mergeOrgChartSearchBody(
      { linkedinUnipileAccountId: 'from-body' },
      'kn5idzvKTdGgKehaMbtTjA',
    );
    expect(merged.linkedinUnipileAccountId).toBe('kn5idzvKTdGgKehaMbtTjA');
  });

  it('falls back to body linkedinUnipileAccountId when query is absent', () => {
    const merged = mergeOrgChartSearchBody({
      linkedinUnipileAccountId: 'body-only',
    });
    expect(merged.linkedinUnipileAccountId).toBe('body-only');
  });

  it('omits account id when neither query nor body set', () => {
    const merged = mergeOrgChartSearchBody({});
    expect(merged.linkedinUnipileAccountId).toBeUndefined();
  });
});

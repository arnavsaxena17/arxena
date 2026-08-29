import {
  buildOutreachDashboardPageLayout,
  OUTREACH_DASHBOARD_TITLE,
  getOutreachDashboardPageLayoutUniversalIdentifier,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';

describe('buildOutreachDashboardPageLayout', () => {
  it('builds a deterministic Outreach dashboard layout', () => {
    const first = buildOutreachDashboardPageLayout();
    const second = buildOutreachDashboardPageLayout();

    expect(first).toEqual(second);
    expect(first.name).toBe(OUTREACH_DASHBOARD_TITLE);
    expect(first.type).toBe('DASHBOARD');
    expect(first.universalIdentifier).toBe(
      getOutreachDashboardPageLayoutUniversalIdentifier(),
    );
  });

  it('includes overview KPIs for companies, people, connection requests, and stages', () => {
    const layout = buildOutreachDashboardPageLayout();
    const overview = layout.tabs?.find((tab) => tab.title === 'Overview');

    expect(overview).toBeDefined();

    const titles = (overview?.widgets ?? []).map((widget) => widget.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        'Target companies',
        'People enrolled',
        'Connection requests sent',
        'Meetings booked',
        'Funnel: Added → Opportunity',
        'Candidates by outreach sequence stage',
        'Companies added (weekly)',
        'First contacts (weekly)',
      ]),
    );

    const connectionRequests = overview?.widgets?.find(
      (widget) => widget.title === 'Connection requests sent',
    );
    const companiesAdded = overview?.widgets?.find(
      (widget) => widget.title === 'Companies added (weekly)',
    );
    const firstContacts = overview?.widgets?.find(
      (widget) => widget.title === 'First contacts (weekly)',
    );

    expect(connectionRequests?.configuration).toMatchObject({
      configurationType: 'AGGREGATE_CHART',
      aggregateOperation: 'COUNT_NOT_EMPTY',
    });
    expect(companiesAdded?.configuration).toMatchObject({
      configurationType: 'LINE_CHART',
      aggregateOperation: 'COUNT_NOT_EMPTY',
      displayDataLabel: true,
    });
    expect(firstContacts?.configuration).toMatchObject({
      configurationType: 'LINE_CHART',
      aggregateOperation: 'COUNT_NOT_EMPTY',
      displayDataLabel: true,
    });
  });

  it('keeps widget titles unique within each tab', () => {
    const layout = buildOutreachDashboardPageLayout();

    for (const tab of layout.tabs ?? []) {
      const titles = (tab.widgets ?? []).map((widget) => widget.title);

      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

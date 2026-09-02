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
      aggregateSubFieldName: 'firstOutboundAt',
    });
    expect(companiesAdded?.configuration).toMatchObject({
      configurationType: 'LINE_CHART',
      aggregateOperation: 'COUNT_NOT_EMPTY',
      displayDataLabel: true,
    });
    expect(firstContacts?.configuration).toMatchObject({
      configurationType: 'LINE_CHART',
      aggregateOperation: 'COUNT_NOT_EMPTY',
      aggregateSubFieldName: 'firstContactAt',
      primaryAxisGroupBySubFieldName: 'firstContactAt',
      displayDataLabel: true,
    });
  });

  it('uses outreachAnalytics JSON paths on Speed tab widgets', () => {
    const layout = buildOutreachDashboardPageLayout();
    const speed = layout.tabs?.find((tab) => tab.title === 'Speed');

    expect(speed).toBeDefined();

    const timeToFirstContact = speed?.widgets?.find(
      (widget) => widget.title === 'Time to first contact',
    );
    const avgDaysToFirstContact = speed?.widgets?.find(
      (widget) => widget.title === 'Avg days → first contact',
    );

    expect(timeToFirstContact?.configuration).toMatchObject({
      configurationType: 'BAR_CHART',
      primaryAxisGroupBySubFieldName: 'timeToFirstContactBucket',
    });
    expect(avgDaysToFirstContact?.configuration).toMatchObject({
      configurationType: 'AGGREGATE_CHART',
      aggregateOperation: 'AVG',
      aggregateSubFieldName: 'daysToFirstContact',
    });
  });

  it('keeps widget titles unique within each tab', () => {
    const layout = buildOutreachDashboardPageLayout();

    for (const tab of layout.tabs ?? []) {
      const titles = (tab.widgets ?? []).map((widget) => widget.title);

      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('includes workflow control tab with run KPIs and record tables', () => {
    const layout = buildOutreachDashboardPageLayout();
    const workflowControl = layout.tabs?.find(
      (tab) => tab.title === 'Workflow control',
    );

    expect(workflowControl).toBeDefined();

    const titles = (workflowControl?.widgets ?? []).map((widget) => widget.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        'Active runs',
        'Awaiting approval',
        'In delay',
        'Failed runs',
        'Enrich failed',
        'Stage C candidates by branch',
        'Active runs by step kind',
        'Active runs by current step',
        'HITL approval queue',
        'Active candidate workflow runs',
        'Failed workflow runs',
        'Stage C candidates',
      ]),
    );

    const hitlTable = workflowControl?.widgets?.find(
      (widget) => widget.title === 'HITL approval queue',
    );

    expect(hitlTable).toMatchObject({
      type: 'RECORD_TABLE',
      configuration: {
        configurationType: 'RECORD_TABLE',
        recordLimit: 50,
      },
    });
  });
});

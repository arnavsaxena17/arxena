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

  it('has a single Overview tab with the eight result widgets in order', () => {
    const layout = buildOutreachDashboardPageLayout();

    expect(layout.tabs?.map((tab) => tab.title)).toEqual(['Overview']);

    const titles = (layout.tabs?.[0]?.widgets ?? []).map(
      (widget) => widget.title,
    );

    expect(titles).toEqual([
      'People contacted',
      'Connections accepted',
      'Replies',
      'Meetings booked',
      'People contacted per week',
      'Replies per week',
      'Where people are now',
      'What got replies',
    ]);
  });

  it('counts funnel milestones from candidate outreachAnalytics timestamps', () => {
    const widgets = buildOutreachDashboardPageLayout().tabs?.[0]?.widgets ?? [];
    const milestoneByTitle = Object.fromEntries(
      widgets
        .filter(
          (widget) =>
            widget.configuration.configurationType === 'AGGREGATE_CHART',
        )
        .map((widget) => [
          widget.title,
          (widget.configuration as { aggregateSubFieldName?: string })
            .aggregateSubFieldName,
        ]),
    );

    expect(milestoneByTitle).toEqual({
      'People contacted': 'firstOutboundAt',
      'Connections accepted': 'connectionAcceptedAt',
      Replies: 'firstReplyAt',
      'Meetings booked': 'meetingBookedAt',
    });

    for (const widget of widgets) {
      expect(widget.configuration).toMatchObject(
        widget.configuration.configurationType === 'AGGREGATE_CHART'
          ? { aggregateOperation: 'COUNT_NOT_EMPTY' }
          : { omitNullValues: true },
      );
    }
  });

  it('puts every widget on Candidate so the project and variant filters apply', () => {
    const widgets = buildOutreachDashboardPageLayout().tabs?.[0]?.widgets ?? [];
    const objectIds = new Set(
      widgets.map((widget) => widget.objectUniversalIdentifier),
    );

    expect(objectIds.size).toBe(1);
  });

  it('keeps widget titles unique', () => {
    const widgets = buildOutreachDashboardPageLayout().tabs?.[0]?.widgets ?? [];
    const titles = widgets.map((widget) => widget.title);

    expect(new Set(titles).size).toBe(titles.length);
  });
});

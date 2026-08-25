import {
  buildGtmCommandDashboardPageLayout,
  GTM_COMMAND_DASHBOARD_TITLE,
  getGtmCommandDashboardPageLayoutUniversalIdentifier,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-gtm-command-dashboard-page-layout.util';

describe('buildGtmCommandDashboardPageLayout', () => {
  it('builds a deterministic GTM Command dashboard layout', () => {
    const first = buildGtmCommandDashboardPageLayout();
    const second = buildGtmCommandDashboardPageLayout();

    expect(first).toEqual(second);
    expect(first.name).toBe(GTM_COMMAND_DASHBOARD_TITLE);
    expect(first.type).toBe('DASHBOARD');
    expect(first.universalIdentifier).toBe(
      getGtmCommandDashboardPageLayoutUniversalIdentifier(),
    );
  });

  it('includes overview KPIs for companies, people, connection requests, and stages', () => {
    const layout = buildGtmCommandDashboardPageLayout();
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
      ]),
    );
  });

  it('keeps widget titles unique within each tab', () => {
    const layout = buildGtmCommandDashboardPageLayout();

    for (const tab of layout.tabs ?? []) {
      const titles = (tab.widgets ?? []).map((widget) => widget.title);

      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

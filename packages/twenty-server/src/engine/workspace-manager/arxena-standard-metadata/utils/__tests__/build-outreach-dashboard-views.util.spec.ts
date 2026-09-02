import { ViewType, ViewVisibility } from 'twenty-shared/types';

import { buildOutreachDashboardViews } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-views.util';
import {
  OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-workflow-control.constants';

describe('buildOutreachDashboardViews', () => {
  it('builds deterministic workflow control backing views', () => {
    const first = buildOutreachDashboardViews();
    const second = buildOutreachDashboardViews();

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
  });

  it('creates TABLE_WIDGET views for workflow run and candidate queues', () => {
    const views = buildOutreachDashboardViews();
    const viewNames = views.map((view) => view.name);

    expect(viewNames).toEqual(
      expect.arrayContaining([
        OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.hitlApprovalQueue,
        OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.activeCandidateWorkflowRuns,
        OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.failedWorkflowRuns,
        OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES.stageCCandidates,
      ]),
    );

    for (const view of views) {
      expect(view.type).toBe(ViewType.TABLE_WIDGET);
      expect(view.visibility).toBe(ViewVisibility.WORKSPACE);
      expect((view.fields ?? []).length).toBeGreaterThan(0);
      expect((view.filters ?? []).length).toBeGreaterThan(0);
    }
  });
});

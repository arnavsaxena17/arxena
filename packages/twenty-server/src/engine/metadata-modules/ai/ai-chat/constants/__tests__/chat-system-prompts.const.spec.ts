import { CHAT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const';

describe('CHAT_SYSTEM_PROMPTS.CORE', () => {
  it('should route shared skills and keep the Ask AI-only routing lines', () => {
    const core = CHAT_SYSTEM_PROMPTS.CORE;

    expect(core).toContain('load_skills(["setup"])');
    expect(core).toContain('load_skills(["search"])');
    expect(core).toContain('load_skills(["resolve-company-name"])');
    expect(core).toContain(
      'load_skills(["org-structure-insights"])`. Then call `highlight_org_chart` when a chart is open. Keep LinkedIn sourcing on `search`.',
    );
    expect(core).toContain(
      'load_skills(["outreach", "workflow-building"])`. Finish with `list_workflow_runs`.',
    );
    expect(core).toContain('load_skills(["dashboard-building"])');
    expect(core).toContain('### Destination verbs (choose before tools)');
    expect(core).toContain('## Complete multi-part requests');
  });
});

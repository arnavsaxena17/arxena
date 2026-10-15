import { CHAT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const';

describe('CHAT_SYSTEM_PROMPTS.CORE', () => {
  it('should route every skill from front matter, including workflow, dashboard, and CRM', () => {
    const core = CHAT_SYSTEM_PROMPTS.CORE;

    expect(core).toContain('load_skills(["setup"])');
    expect(core).toContain('load_skills(["search"])');
    expect(core).toContain('sections: ["companies"]');
    expect(core).not.toContain('load_skills(["resolve-company-name"])');
    expect(core).not.toContain('local-business-search');
    expect(core).toContain('**Start outreach**');
    expect(core).toContain(
      'load_skills(["org-structure-insights"])`. Then call `highlight_org_chart` when a chart is open. Keep LinkedIn sourcing on `search`.',
    );
    expect(core).toContain(
      'load_skills(["outreach", "workflow-building"])`. Finish with `list_workflow_runs`.',
    );
    expect(core).toContain('load_skills(["workflow-building"])');
    expect(core).toContain(
      'load_skills(["dashboard-building"])`. Informational questions are not build requests',
    );
    expect(core).toContain('load_skills(["data-manipulation"])` when needed');
    expect(core).toContain('load_skills(["view-building"])');
    expect(core).toContain(
      'load_skills(["view-filters-and-sorts"])`. This is the view\'s saved filter',
    );
    expect(core).toContain(
      'load_skills(["metadata-building"])`. Objects and fields, not record data.',
    );
    expect(core).toContain('### Destination verbs (choose before tools)');
    expect(core).toContain('## Complete multi-part requests');
  });
});

describe('CHAT_SYSTEM_PROMPTS chat-only sections', () => {
  it('should keep record-link format off the MCP transport prompt', () => {
    expect(CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT).not.toContain(
      '<browsing_context>',
    );
    expect(CHAT_SYSTEM_PROMPTS.RESPONSE_FORMAT).toContain('recordReferences');
    expect(CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT).toContain(
      'Skilled task: `load_skills`',
    );
    expect(CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT).not.toContain('recordReferences');
  });
});

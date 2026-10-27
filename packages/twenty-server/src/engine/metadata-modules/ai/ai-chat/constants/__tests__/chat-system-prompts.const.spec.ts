import { CHAT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const';

describe('CHAT_SYSTEM_PROMPTS.CORE', () => {
  it('should route every skill from front matter, including workflow, dashboard, and CRM', () => {
    const core = CHAT_SYSTEM_PROMPTS.CORE;

    expect(core).toContain('load_skills(["setup"])');
    expect(core).toContain('load_skills(["sourcing"])');
    expect(core).toContain('`["places"]` for places on a map');
    expect(core).not.toContain('sections: ["companies"]');
    expect(core).not.toContain('load_skills(["resolve-company-name"])');
    expect(core).not.toContain('local-business-search');
    expect(core).toContain('**Start outreach**');
    expect(core).toContain(
      'load_skills(["org-structure-insights"])`. Then call `highlight_org_chart` when a chart is open. Keep LinkedIn sourcing on `sourcing`.',
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
      'Construct CRUD names from grammar',
    );
    expect(CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT).not.toContain('recordReferences');
  });

  it('should require ask_questions when Outreach projectId is missing', () => {
    expect(CHAT_SYSTEM_PROMPTS.CHAT_UI).toContain(
      'Exception — Outreach `projectId`',
    );
    expect(CHAT_SYSTEM_PROMPTS.CHAT_UI).toContain(
      "Never pick a project from `find_many_projects` without the user's answer",
    );
  });

  it('should tell the agent to ask when in doubt instead of guessing', () => {
    expect(CHAT_SYSTEM_PROMPTS.CHAT_UI).toContain('When in doubt, ask.');
    expect(CHAT_SYSTEM_PROMPTS.CHAT_UI).toContain(
      'Instructions conflict (e.g. "show me the drafts" and "run immediately")',
    );
  });
});

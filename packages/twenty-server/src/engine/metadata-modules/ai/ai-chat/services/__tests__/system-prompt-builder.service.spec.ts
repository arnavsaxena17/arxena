import { ToolCategory } from 'twenty-shared/ai';

import { CHAT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const';
import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

describe('SystemPromptBuilderService', () => {
  const buildService = (overrides?: {
    toolRegistry?: { buildToolIndex: jest.Mock };
    skillService?: { findAllFlatSkills: jest.Mock };
  }) =>
    new SystemPromptBuilderService(
      (overrides?.toolRegistry ?? {}) as never,
      (overrides?.skillService ?? {}) as never,
      {} as never,
      {} as never,
      {} as never,
    );

  const crudCompany: ToolIndexEntry = {
    name: 'find_many_companies',
    label: 'Find companies',
    description: 'Find companies',
    category: ToolCategory.DATABASE_CRUD,
    executionRef: {} as never,
    objectName: 'companies',
    operation: 'find_many',
  };

  const arxenaSearch: ToolIndexEntry = {
    name: 'search_people_api',
    label: 'Search people',
    description: 'Search people',
    category: ToolCategory.ARXENA,
    executionRef: {} as never,
  };

  const codeInterpreter: ToolIndexEntry = {
    name: 'code_interpreter',
    label: 'Code interpreter',
    description: 'Run python',
    category: ToolCategory.ACTION,
    executionRef: {} as never,
  };

  describe('buildContextSection', () => {
    it('omits the timezone line when timezone is the "system" sentinel', () => {
      const service = buildService();

      const result = service.buildContextSection({
        userContext: {
          firstName: 'John',
          lastName: 'Doe',
          locale: 'en',
          timezone: 'system',
        },
      });

      expect(result).toContain('## Context');
      expect(result).not.toContain('Timezone:');
      expect(result).toContain('Current date:');
    });

    it('includes the timezone line for a valid IANA timezone', () => {
      const service = buildService();

      const result = service.buildContextSection({
        userContext: {
          firstName: 'John',
          lastName: 'Doe',
          locale: 'en',
          timezone: 'America/New_York',
        },
      });

      expect(result).toContain('Timezone: America/New_York');
      expect(result).toContain('Current date:');
    });

    it('puts workspace instructions, the user, and the browsing rule in one section', () => {
      const service = buildService();

      const result = service.buildContextSection({
        userContext: {
          firstName: 'John',
          lastName: 'Doe',
          locale: 'en',
          timezone: 'America/New_York',
        },
        workspaceInstructions: 'Always reply in French',
        includeBrowsingContext: true,
      });

      expect(result).toContain('## Context');
      expect(result).not.toContain('## User Context');
      expect(result).not.toContain('## Workspace Instructions');
      expect(result).toContain('Always reply in French');
      expect(result).toContain('User: John Doe');
      expect(result).toContain('<browsing_context>');
      expect(result).not.toContain('LinkedIn (Unipile)');
    });
  });

  describe('formatLinkedinConnectionStatus', () => {
    it('lists available Unipile search types when connected', () => {
      const service = buildService();

      const result = service.formatLinkedinConnectionStatus({
        connected: true,
        accountId: 'acc-123',
        inferredSearchType: 'sales_navigator',
        salesNavigatorAvailable: true,
        recruiterAvailable: false,
      });

      expect(result).toContain('connected (account_id=acc-123)');
      expect(result).toContain('Preferred searchType: sales_navigator');
      expect(result).toContain(
        'Search types available: classic, sales_navigator',
      );
      expect(result).toContain('Recruiter: not available');
      expect(result).not.toContain('linkedin_unipile_get_own_profile');
    });

    it('reports no Unipile search types when disconnected', () => {
      const service = buildService();

      const result = service.formatLinkedinConnectionStatus({
        connected: false,
        accountId: null,
        inferredSearchType: null,
        salesNavigatorAvailable: false,
        recruiterAvailable: false,
      });

      expect(result).toContain('LinkedIn (Unipile): not connected');
      expect(result).toContain('Search types available: none via Unipile');
    });
  });

  describe('buildFullPrompt', () => {
    it('includes CORE plus chat-only UI and omits MCP transport rules', () => {
      const service = buildService();
      const prompt = service.buildFullPrompt([], [], ['search_help_center']);

      expect(prompt).toContain('Plan → Skill → Learn → Execute');
      expect(prompt).toContain('load_skills(["sourcing"])');
      expect(prompt).toContain('load_skills(["setup"])');
      expect(prompt).toContain('load_skills(["org-structure-insights"])');
      expect(prompt).toContain('highlight_org_chart');
      expect(prompt).toContain('Destination verbs');
      expect(prompt).not.toContain('Category `ARXENA`');
      expect(prompt).not.toContain('Category `EXTERNAL_MCP`');
      expect(prompt).toContain('ask_questions');
      expect(prompt).toContain('[[record:');
      expect(prompt).not.toContain(CHAT_SYSTEM_PROMPTS.MCP_TRANSPORT);
    });

    it('points Arxena tools at skills instead of listing every tool', () => {
      const service = buildService();
      const prompt = service.buildFullPrompt(
        [crudCompany, arxenaSearch, codeInterpreter],
        [],
        ['search_help_center'],
      );

      expect(prompt).toContain('People and company search');
      expect(prompt).toContain('Names come from the loaded skill');
      expect(prompt).not.toContain('`search_people_api`');
      expect(prompt).not.toContain('prospecting');
    });
  });

  describe('buildMcpCompactToolCatalogSection', () => {
    it('omits excluded tools and uses CRUD grammar instead of schemas', () => {
      const service = buildService();
      const section = service.buildMcpCompactToolCatalogSection(
        [crudCompany, arxenaSearch, codeInterpreter],
        ['search_help_center', 'code_interpreter'],
        new Set(['code_interpreter']),
      );

      expect(section).toContain('find_many');
      expect(section).toContain('companies');
      expect(section).toContain('Names come from the loaded skill');
      expect(section).not.toContain('prospecting');
      expect(section).not.toContain('`code_interpreter`');
      expect(section).not.toContain('inputSchema');
    });
  });

  describe('large category summaries', () => {
    const buildExternalTool = (
      slug: string,
      index: number,
    ): ToolIndexEntry => ({
      name: `${slug}__tool_${index}`,
      label: `${slug} ${index}`,
      description: 'external tool',
      category: ToolCategory.EXTERNAL_MCP,
      executionRef: { kind: 'static', toolId: `${slug}__tool_${index}` },
    });

    it('should summarize connected servers instead of listing every external tool', () => {
      const service = buildService();
      const externalTools = [
        ...Array.from({ length: 20 }, (_, index) =>
          buildExternalTool('postman', index),
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          buildExternalTool('unipile', index),
        ),
      ];

      const section = service.buildMcpCompactToolCatalogSection(
        externalTools,
        [],
      );

      expect(section).toContain('`postman` (20 tools)');
      expect(section).toContain('get_tool_catalog({server: "unipile"})');
      expect(section).not.toContain('`postman__tool_0`');
    });

    it('should keep listing tool names for small categories', () => {
      const service = buildService();
      const section = service.buildMcpCompactToolCatalogSection(
        [buildExternalTool('unipile', 0)],
        [],
      );

      expect(section).toContain('`unipile__tool_0`');
    });
  });

  describe('buildMcpInstructions', () => {
    it('includes CORE, MCP transport, skills, and omits chat-only UI', async () => {
      const service = buildService({
        toolRegistry: {
          buildToolIndex: jest
            .fn()
            .mockResolvedValue([crudCompany, arxenaSearch, codeInterpreter]),
        },
        skillService: {
          findAllFlatSkills: jest.fn().mockResolvedValue([
            {
              name: 'search',
              label: 'Search',
              description: 'Source companies and people',
            },
            {
              name: 'setup',
              label: 'Setup',
              description: 'Campaign setup',
            },
          ]),
        },
      });

      const instructions = await service.buildMcpInstructions({
        workspaceId: 'workspace-1',
        roleId: 'role-1',
        excludeTools: new Set(['code_interpreter', 'http_request']),
      });

      expect(instructions).toContain('Plan → Skill → Learn → Execute');
      expect(instructions).toContain('load_skills');
      expect(instructions).toContain('search');
      expect(instructions).toContain('setup');
      expect(instructions).toContain('People and company search');
      expect(instructions).not.toContain('Category `ARXENA`');
      expect(instructions).toContain('Anti-bloat');
      expect(instructions).toContain('not in-app Ask AI');
      expect(instructions).not.toContain('## Asking the user questions');
      expect(instructions).not.toContain('## In-app Ask AI');
      expect(instructions).not.toContain('[[record:');
      expect(instructions).not.toContain('<browsing_context>');
    });
  });
});

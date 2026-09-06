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

  describe('buildUserContextSection', () => {
    it('omits the timezone line when timezone is the "system" sentinel', () => {
      const service = buildService();

      const result = service.buildUserContextSection({
        firstName: 'John',
        lastName: 'Doe',
        locale: 'en',
        timezone: 'system',
      });

      expect(result).not.toContain('Timezone:');
      expect(result).toContain('Current date:');
    });

    it('includes the timezone line for a valid IANA timezone', () => {
      const service = buildService();

      const result = service.buildUserContextSection({
        firstName: 'John',
        lastName: 'Doe',
        locale: 'en',
        timezone: 'America/New_York',
      });

      expect(result).toContain('Timezone: America/New_York');
      expect(result).toContain('Current date:');
    });
  });

  describe('buildConnectedAccountsSection', () => {
    it('lists available Unipile search types when connected', () => {
      const service = buildService();

      const result = service.buildConnectedAccountsSection({
        connected: true,
        accountId: 'acc-123',
        inferredSearchType: 'sales_navigator',
        salesNavigatorAvailable: true,
        recruiterAvailable: false,
      });

      expect(result).toContain('## Connected Accounts');
      expect(result).toContain('connected (account_id=acc-123)');
      expect(result).toContain('Preferred searchType: sales_navigator');
      expect(result).toContain(
        'Search types available: classic, sales_navigator',
      );
      expect(result).toContain('Recruiter: not available');
    });

    it('instructs the model not to call Unipile search when disconnected', () => {
      const service = buildService();

      const result = service.buildConnectedAccountsSection({
        connected: false,
        accountId: null,
        inferredSearchType: null,
        salesNavigatorAvailable: false,
        recruiterAvailable: false,
      });

      expect(result).toContain('LinkedIn (Unipile): not connected');
      expect(result).toContain('Do not call search_linkedin_*');
      expect(result).toContain('dataSource: "harvest"');
    });
  });

  describe('buildFullPrompt', () => {
    it('includes CORE plus chat-only UI and omits MCP transport rules', () => {
      const service = buildService();
      const prompt = service.buildFullPrompt([], [], ['search_help_center']);

      expect(prompt).toContain('Plan → Skill → Learn → Execute');
      expect(prompt).toContain('load_skills(["search"])');
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

    it('uses pack-first prospecting catalog instead of listing every ARXENA tool', () => {
      const service = buildService();
      const prompt = service.buildFullPrompt(
        [crudCompany, arxenaSearch, codeInterpreter],
        [],
        ['search_help_center'],
      );

      expect(prompt).toContain('Prospecting & enrichment');
      expect(prompt).toContain('prospecting');
      expect(prompt).toContain('list_org_chart_positions');
      expect(prompt).not.toContain('`search_people_api`');
    });
  });

  describe('buildMcpCompactToolCatalogSection', () => {
    it('omits excluded tools, uses CRUD grammar, and ARXENA packs instead of schemas', () => {
      const service = buildService();
      const section = service.buildMcpCompactToolCatalogSection(
        [crudCompany, arxenaSearch, codeInterpreter],
        ['search_help_center', 'code_interpreter'],
        new Set(['code_interpreter']),
      );

      expect(section).toContain('find_many');
      expect(section).toContain('companies');
      expect(section).toContain('prospecting');
      expect(section).toContain('list_org_chart_positions');
      expect(section).toContain('check_contact_availability');
      expect(section).not.toContain('`code_interpreter`');
      expect(section).not.toContain('inputSchema');
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
      expect(instructions).toContain('Prospecting & enrichment');
      expect(instructions).not.toContain('Category `ARXENA`');
      expect(instructions).toContain('Anti-bloat');
      expect(instructions).toContain('not in-app Ask AI');
      expect(instructions).not.toContain('## Asking the user questions');
      expect(instructions).not.toContain('## In-app Ask AI');
      expect(instructions).not.toContain('[[record:');
    });
  });
});

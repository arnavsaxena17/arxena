import { ToolCategory } from 'twenty-shared/ai';

import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

const entry = (
  name: string,
  category: ToolCategory,
  extra?: Partial<ToolIndexEntry>,
): ToolIndexEntry => ({
  name,
  label: name,
  description: name,
  category,
  executionRef: {} as never,
  ...extra,
});

describe('parity', () => {
  it('dumps sections', () => {
    const service = new SystemPromptBuilderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const catalog: ToolIndexEntry[] = [
      ...Array.from({ length: 10 }, (_, index) =>
        entry(`standalone_crud_${index}`, ToolCategory.DATABASE_CRUD),
      ),
      entry('find_many_people', ToolCategory.DATABASE_CRUD, {
        objectName: 'people',
        operation: 'find_many',
      }),
      entry('find_one_person', ToolCategory.DATABASE_CRUD, {
        objectName: 'person',
        operation: 'find_one',
      }),
      entry('find_many_companies', ToolCategory.DATABASE_CRUD, {
        objectName: 'companies',
        operation: 'find_many',
      }),
      entry('find_one_company', ToolCategory.DATABASE_CRUD, {
        objectName: 'company',
        operation: 'find_one',
      }),
      entry('delete_many_company', ToolCategory.DATABASE_CRUD, {
        objectName: 'company',
        operation: 'delete_many',
      }),
      entry('search_people_api', ToolCategory.ARXENA),
      entry('code_interpreter', ToolCategory.ACTION),
      entry('learn_tools', ToolCategory.ACTION),
      ...Array.from({ length: 16 }, (_, index) =>
        entry(`postman__tool_${index}`, ToolCategory.EXTERNAL_MCP),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        entry(`unipile__tool_${index}`, ToolCategory.EXTERNAL_MCP),
      ),
      entry('list_dashboards', ToolCategory.DASHBOARD),
      entry('create_webhook', ToolCategory.WEBHOOK),
      entry('run_logic', ToolCategory.LOGIC_FUNCTION),
      entry('create_nav', ToolCategory.NAVIGATION_MENU_ITEM),
    ];

    const chat = service.buildToolCatalogSection(catalog, [
      'search_help_center',
      'code_interpreter',
    ]);
    const mcp = service.buildMcpCompactToolCatalogSection(
      catalog,
      ['search_help_center', 'code_interpreter'],
      new Set(['code_interpreter']),
    );

    const { writeFileSync } = require('fs');

    writeFileSync('/tmp/parity-out.txt', `<<<CHAT>>>${chat}\n<<<MCP>>>${mcp}`);
    expect(true).toBe(true);
  });
});

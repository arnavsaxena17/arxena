import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { buildToolCatalogResponse } from 'src/engine/core-modules/tool-provider/utils/build-tool-catalog-response.util';

const buildEntry = (
  name: string,
  category: ToolCategory,
  description = name,
): ToolIndexEntry => ({
  name,
  label: name,
  description,
  category,
  executionRef: { kind: 'static', toolId: name },
});

const entries: ToolIndexEntry[] = [
  buildEntry('find_many_people', ToolCategory.DATABASE_CRUD),
  buildEntry('unipile__list-endpoints', ToolCategory.EXTERNAL_MCP),
  buildEntry('unipile__execute-request', ToolCategory.EXTERNAL_MCP),
  buildEntry('postman__create_pet', ToolCategory.EXTERNAL_MCP, 'Create a pet'),
  buildEntry('send_email', ToolCategory.ACTION),
];

describe('buildToolCatalogResponse', () => {
  it('should return a compact index with servers when no filter is given', () => {
    const result = buildToolCatalogResponse({ entries });

    expect(result.catalog).toBeUndefined();
    expect(result.index).toEqual(
      expect.arrayContaining([
        { category: ToolCategory.DATABASE_CRUD, count: 1 },
        {
          category: ToolCategory.EXTERNAL_MCP,
          count: 3,
          servers: [
            { slug: 'unipile', count: 2 },
            { slug: 'postman', count: 1 },
          ],
        },
      ]),
    );
  });

  it('should list only the requested server tools', () => {
    const result = buildToolCatalogResponse({ entries, server: 'unipile' });

    expect(result.catalog?.[ToolCategory.EXTERNAL_MCP]).toHaveLength(2);
    expect(Object.keys(result.catalog ?? {})).toEqual([
      ToolCategory.EXTERNAL_MCP,
    ]);
  });

  it('should match query terms against names and descriptions', () => {
    const result = buildToolCatalogResponse({ entries, query: 'create pet' });

    expect(result.catalog?.[ToolCategory.EXTERNAL_MCP]).toEqual([
      { name: 'postman__create_pet', description: 'Create a pet' },
    ]);
  });

  it('should paginate and report remaining tools', () => {
    const result = buildToolCatalogResponse({
      entries,
      categories: [ToolCategory.EXTERNAL_MCP],
      limit: 2,
    });

    expect(result.catalog?.[ToolCategory.EXTERNAL_MCP]).toHaveLength(2);
    expect(result.message).toContain('1 more not shown');
    expect(result.message).toContain('offset=2');
  });
});

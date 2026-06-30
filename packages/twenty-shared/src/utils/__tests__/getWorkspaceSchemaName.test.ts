import { getWorkspaceSchemaName } from '../getWorkspaceSchemaName';

describe('getWorkspaceSchemaName', () => {
  it('converts a workspace UUID to the PostgreSQL schema name', () => {
    expect(
      getWorkspaceSchemaName('00000000-0000-0000-0000-000000000001'),
    ).toBe('workspace_1');
  });

  it('handles dev workspace IDs with the twenty- prefix', () => {
    expect(
      getWorkspaceSchemaName('twenty-00000000-0000-0000-0000-000000000001'),
    ).toBe('workspace_twenty_1');
  });
});

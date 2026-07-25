import { DownstreamMcpConnectionManager } from 'src/engine/core-modules/mcp-federation/services/downstream-mcp-connection.manager';

describe('DownstreamMcpConnectionManager', () => {
  it('hashes catalog stably by name and description', () => {
    const manager = new DownstreamMcpConnectionManager();
    const tools = [
      { name: 'a', description: 'one' },
      { name: 'b', description: 'two' },
    ];

    expect(manager.hashCatalog(tools)).toEqual(manager.hashCatalog(tools));
    expect(manager.hashCatalog(tools)).not.toEqual(
      manager.hashCatalog([{ name: 'a', description: 'changed' }]),
    );
  });
});

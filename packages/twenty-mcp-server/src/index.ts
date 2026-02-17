#!/usr/bin/env node
import { createMcpServer } from './server';

createMcpServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error starting Arxena MCP server: ${message}\n`);
  process.exit(1);
});

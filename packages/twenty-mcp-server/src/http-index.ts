#!/usr/bin/env node
import { startHttpMcpServer } from './http-server';

startHttpMcpServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error starting Arxena MCP HTTP server: ${message}\n`);
  process.exit(1);
});

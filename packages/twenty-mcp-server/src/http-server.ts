import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
    getOAuthProtectedResourceMetadataUrl,
    mcpAuthMetadataRouter,
    mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';

import {
    buildArxenaConfigFromToken,
    extractApiTokenFromHeaders,
    validateApiToken,
} from './auth';
import { ArxenaConfig, HttpServerConfig, loadHttpServerConfig } from './config';
import { ArxenaOAuthProvider } from './oauth/arxena-oauth-provider';
import { buildMcpServer } from './server';
import { allTools, publicTools } from './tools/index';
import { McpTool } from './types/tool-types';

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  config: ArxenaConfig;
};

const sessions = new Map<string, SessionEntry>();

const isInitializeRequest = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') {
    return false;
  }

  return (body as { method?: string }).method === 'initialize';
};

const renderConsentPage = (params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  error?: string;
}): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authorize Arxena MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 48px auto; padding: 0 16px; }
    label { display: block; margin-top: 16px; font-weight: 600; }
    input, button { width: 100%; margin-top: 8px; padding: 10px; font-size: 16px; }
    .error { color: #b00020; margin-top: 12px; }
    p { color: #444; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Connect Arxena to your AI client</h1>
  <p>Paste an API key JWT from Arxena Settings → Developers → API Keys. This authorizes read/write access to your workspace recruitment data.</p>
  ${params.error ? `<div class="error">${params.error}</div>` : ''}
  <form method="post" action="/oauth/consent">
    <input type="hidden" name="client_id" value="${params.clientId}" />
    <input type="hidden" name="redirect_uri" value="${params.redirectUri}" />
    <input type="hidden" name="state" value="${params.state}" />
    <input type="hidden" name="code_challenge" value="${params.codeChallenge}" />
    <input type="hidden" name="resource" value="${params.resource}" />
    <label for="api_token">Arxena API key token</label>
    <input id="api_token" name="api_token" type="password" required autocomplete="off" />
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;

const resolveTools = (config: HttpServerConfig): McpTool[] =>
  config.mcpPublicToolsOnly ? publicTools : allTools;

const getResourceMetadataUrl = (config: HttpServerConfig): string =>
  getOAuthProtectedResourceMetadataUrl(new URL(config.mcpPublicUrl));

export const createHttpApp = (config: HttpServerConfig = loadHttpServerConfig()) => {
  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: ['mcp.arxena.com', 'localhost', '127.0.0.1'],
  });

  const oauthProvider = new ArxenaOAuthProvider(config);
  const tools = resolveTools(config);
  const resourceMetadataUrl = getResourceMetadataUrl(config);

  if (config.oauthEnabled) {
    app.use(
      mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl: new URL(config.oauthIssuerUrl),
        serviceDocumentationUrl: new URL(config.documentationUrl),
        resourceServerUrl: new URL(config.mcpPublicUrl),
        resourceName: 'Arxena MCP',
        scopesSupported: ['mcp'],
      }),
    );

    app.use(
      mcpAuthMetadataRouter({
        oauthMetadata: {
          issuer: config.oauthIssuerUrl,
          authorization_endpoint: `${config.oauthIssuerUrl}/authorize`,
          token_endpoint: `${config.oauthIssuerUrl}/token`,
          registration_endpoint: `${config.oauthIssuerUrl}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
          scopes_supported: ['mcp'],
          service_documentation: config.documentationUrl,
        },
        resourceServerUrl: new URL(config.mcpPublicUrl),
        serviceDocumentationUrl: new URL(config.documentationUrl),
        scopesSupported: ['mcp'],
        resourceName: 'Arxena MCP',
      }),
    );

    app.get('/oauth/consent', (req: Request, res: Response) => {
      res.type('html').send(
        renderConsentPage({
          clientId: String(req.query.client_id ?? ''),
          redirectUri: String(req.query.redirect_uri ?? ''),
          state: String(req.query.state ?? ''),
          codeChallenge: String(req.query.code_challenge ?? ''),
          resource: String(req.query.resource ?? config.mcpPublicUrl),
          error: typeof req.query.error === 'string' ? req.query.error : undefined,
        }),
      );
    });

    app.post('/oauth/consent', async (req: Request, res: Response) => {
      const clientId = String(req.body.client_id ?? '');
      const redirectUri = String(req.body.redirect_uri ?? '');
      const state = String(req.body.state ?? '');
      const codeChallenge = String(req.body.code_challenge ?? '');
      const apiToken = String(req.body.api_token ?? '').trim();

      if (!clientId || !redirectUri || !codeChallenge || !apiToken) {
        res.status(400).type('html').send(
          renderConsentPage({
            clientId,
            redirectUri,
            state,
            codeChallenge,
            resource: String(req.body.resource ?? config.mcpPublicUrl),
            error: 'All fields are required.',
          }),
        );
        return;
      }

      const isValid = await validateApiToken(config.arxenaBaseUrl, apiToken);
      if (!isValid) {
        res.status(401).type('html').send(
          renderConsentPage({
            clientId,
            redirectUri,
            state,
            codeChallenge,
            resource: String(req.body.resource ?? config.mcpPublicUrl),
            error: 'Invalid API key token. Generate one in Arxena Settings → Developers → API Keys.',
          }),
        );
        return;
      }

      const code = oauthProvider.createAuthorizationCode({
        apiToken,
        clientId,
        redirectUri,
        codeChallenge,
      });

      const redirect = new URL(redirectUri);
      redirect.searchParams.set('code', code);
      if (state) {
        redirect.searchParams.set('state', state);
      }

      res.redirect(302, redirect.toString());
    });
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'arxena-mcp-http' });
  });

  app.get('/docs/mcp', (_req: Request, res: Response) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Arxena MCP Docs</title></head>
<body>
<h1>Arxena MCP Server</h1>
<p>Remote MCP endpoint: <code>${config.mcpPublicUrl}</code></p>
<p>Setup guide: <a href="https://arxena.com/solutions/mcp-server">arxena.com/solutions/mcp-server</a></p>
<p>Privacy policy: <a href="${config.privacyPolicyUrl}">${config.privacyPolicyUrl}</a></p>
<h2>Cursor</h2>
<pre>{
  "mcpServers": {
    "arxena": {
      "url": "${config.mcpPublicUrl}",
      "headers": { "X-API-KEY": "&lt;workspace-api-key-jwt&gt;" }
    }
  }
}</pre>
<h2>Claude Desktop (claude_desktop_config.json)</h2>
<p>Use <code>mcp-remote</code> — Claude Desktop JSON config does not support a <code>url</code> field.</p>
<pre>{
  "mcpServers": {
    "arxena": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${config.mcpPublicUrl}",
        "--header",
        "X-API-KEY: \${ARXENA_API_KEY}"
      ],
      "env": {
        "ARXENA_API_KEY": "&lt;workspace-api-key-jwt&gt;"
      }
    }
  }
}</pre>
<h2>Claude / ChatGPT Connectors (OAuth)</h2>
<p>Use OAuth 2.1 against <code>${config.oauthIssuerUrl}</code> with redirect URI <code>https://claude.ai/api/mcp/auth_callback</code>.</p>
</body></html>`);
  });

  const authenticateRequest = async (
    req: Request,
  ): Promise<ArxenaConfig | undefined> => {
    const headerToken = extractApiTokenFromHeaders(
      req.headers as Record<string, string | string[] | undefined>,
    );

    if (headerToken) {
      const isValid = await validateApiToken(config.arxenaBaseUrl, headerToken);
      if (!isValid) {
        return undefined;
      }
      return buildArxenaConfigFromToken(headerToken, config.arxenaBaseUrl);
    }

    if (req.auth?.token) {
      return buildArxenaConfigFromToken(req.auth.token, config.arxenaBaseUrl);
    }

    return undefined;
  };

  const bearerAuthMiddleware = config.oauthEnabled
    ? requireBearerAuth({
        verifier: oauthProvider,
        resourceMetadataUrl,
      })
    : async (_req: Request, _res: Response, next: () => void) => {
        next();
      };

  const mcpAuthMiddleware = async (
    req: Request,
    res: Response,
    next: () => void,
  ) => {
    const headerToken = extractApiTokenFromHeaders(
      req.headers as Record<string, string | string[] | undefined>,
    );

    if (headerToken) {
      const isValid = await validateApiToken(config.arxenaBaseUrl, headerToken);
      if (isValid) {
        req.auth = {
          token: headerToken,
          clientId: 'arxena-api-key',
          scopes: ['mcp'],
        };
        next();
        return;
      }
    }

    if (config.oauthEnabled && typeof req.headers.authorization === 'string') {
      bearerAuthMiddleware(req, res, () => {
        if (req.auth?.token) {
          next();
          return;
        }
        res.status(401).setHeader(
          'WWW-Authenticate',
          `Bearer resource_metadata="${resourceMetadataUrl}"`,
        );
        res.status(401).json({ error: 'Unauthorized' });
      });
      return;
    }

    if (config.oauthEnabled) {
      res.status(401).setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${resourceMetadataUrl}"`,
      );
    }
    res.status(401).json({ error: 'Unauthorized' });
  };

  const handleMcp = async (req: Request, res: Response) => {
    const arxenaConfig = await authenticateRequest(req);
    if (!arxenaConfig) {
      if (config.oauthEnabled) {
        res.status(401).setHeader(
          'WWW-Authenticate',
          `Bearer resource_metadata="${resourceMetadataUrl}"`,
        );
        res.status(401).json({ error: 'Unauthorized' });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
      return;
    }

    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId =
      typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;

    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { transport, config: arxenaConfig });
        },
        onsessionclosed: (closedSessionId) => {
          sessions.delete(closedSessionId);
        },
      });

      const server = buildMcpServer(arxenaConfig, tools);
      await server.connect(transport);
      session = { transport, config: arxenaConfig };
    }

    if (!session) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid MCP session. Send initialize first.',
        },
        id: null,
      });
      return;
    }

    await session.transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );
  };

  app.post(config.mcpHttpPath, mcpAuthMiddleware, handleMcp);
  app.get(config.mcpHttpPath, mcpAuthMiddleware, handleMcp);
  app.delete(config.mcpHttpPath, mcpAuthMiddleware, handleMcp);

  return app;
};

export const startHttpMcpServer = async (
  config: HttpServerConfig = loadHttpServerConfig(),
): Promise<void> => {
  const app = createHttpApp(config);

  await new Promise<void>((resolve) => {
    app.listen(config.mcpHttpPort, '0.0.0.0', () => {
      console.error(
        JSON.stringify({
          source: 'arxena-mcp-http',
          message: 'Arxena MCP HTTP server listening',
          port: config.mcpHttpPort,
          path: config.mcpHttpPath,
          mcpPublicUrl: config.mcpPublicUrl,
          oauthEnabled: config.oauthEnabled,
        }),
      );
      resolve();
    });
  });
};

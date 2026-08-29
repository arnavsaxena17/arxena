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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderConsentPage = (params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  error?: string;
}): string => {
  const clientId = escapeHtml(params.clientId);
  const redirectUri = escapeHtml(params.redirectUri);
  const state = escapeHtml(params.state);
  const codeChallenge = escapeHtml(params.codeChallenge);
  const resource = escapeHtml(params.resource);
  const error = params.error ? escapeHtml(params.error) : undefined;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize Arxena MCP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      color: #333;
      background: #fbfbfb;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .page {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }
    .card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border: 1px solid #ebebeb;
      border-radius: 8px;
      box-shadow:
        2px 4px 16px rgba(0, 0, 0, 0.06),
        0px 2px 4px rgba(0, 0, 0, 0.04);
      padding: 40px 32px 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: block;
      margin-bottom: 24px;
    }
    .brand {
      font-family: Gabarito, Inter, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #818181;
      text-transform: uppercase;
      margin: 0 0 12px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 1.54rem;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      color: #141414;
    }
    .lead {
      margin: 0 0 28px;
      font-size: 14px;
      line-height: 1.55;
      text-align: center;
      color: #666;
    }
    .lead a {
      color: #141414;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .lead a:hover { color: #474747; }
    form { width: 100%; }
    label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #474747;
    }
    input[type="password"] {
      width: 100%;
      height: 40px;
      padding: 0 12px;
      font-family: inherit;
      font-size: 14px;
      color: #141414;
      background: #fff;
      border: 1px solid #ebebeb;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="password"]::placeholder { color: #b3b3b3; }
    input[type="password"]:hover { border-color: #d6d6d6; }
    input[type="password"]:focus {
      border-color: #333;
      box-shadow: 0 0 0 3px rgba(20, 20, 20, 0.06);
    }
    .error {
      width: 100%;
      margin: 0 0 16px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.45;
      color: #d4544f;
      background: #fef2f2;
      border: 1px solid #f5c6c4;
      border-radius: 8px;
    }
    button[type="submit"] {
      width: 100%;
      height: 40px;
      margin-top: 16px;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: Gabarito, Inter, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      background: #000;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
    }
    button[type="submit"]:hover { color: #9e9e9e; }
    button[type="submit"]:active { background: #222; }
    button[type="submit"]:focus-visible {
      outline: 2px solid #333;
      outline-offset: 2px;
    }
    .perms {
      width: 100%;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(20, 20, 20, 0.08);
    }
    .perms-title {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #818181;
    }
    .perms ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .perms li {
      position: relative;
      padding-left: 16px;
      margin-bottom: 6px;
      font-size: 13px;
      line-height: 1.45;
      color: #666;
    }
    .perms li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 7px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #d6d6d6;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
      color: #999;
    }
    .footer a {
      color: #818181;
      text-decoration: none;
    }
    .footer a:hover { color: #141414; }
    .footer-sep { margin: 0 8px; color: #d6d6d6; }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <img
        class="logo"
        src="https://arxena.com/images/favicon/arxena-A-logo-PQ-HDR-rounded.png"
        alt="Arxena"
        width="48"
        height="48"
      />
      <p class="brand">Arxena MCP</p>
      <h1>Connect Arxena to your AI client</h1>
      <p class="lead">
        Paste an API key from
        <a href="https://app.arxena.com/settings/developers" target="_blank" rel="noopener noreferrer">Settings → Developers → API Keys</a>.
        This authorizes read/write access to your workspace recruitment data.
      </p>
      ${error ? `<div class="error" role="alert">${error}</div>` : ''}
      <form method="post" action="/oauth/consent">
        <input type="hidden" name="client_id" value="${clientId}" />
        <input type="hidden" name="redirect_uri" value="${redirectUri}" />
        <input type="hidden" name="state" value="${state}" />
        <input type="hidden" name="code_challenge" value="${codeChallenge}" />
        <input type="hidden" name="resource" value="${resource}" />
        <label for="api_token">API key token</label>
        <input
          id="api_token"
          name="api_token"
          type="password"
          required
          autocomplete="off"
          autofocus
          placeholder="Paste your workspace API key"
        />
        <button type="submit">Authorize</button>
      </form>
      <div class="perms">
        <p class="perms-title">This connection can</p>
        <ul>
          <li>Read candidates, jobs, and company data</li>
          <li>Create and update recruitment records</li>
          <li>Search org charts and people intelligence</li>
        </ul>
      </div>
    </div>
    <p class="footer">
      <a href="https://arxena.com/solutions/mcp-server" target="_blank" rel="noopener noreferrer">Setup guide</a>
      <span class="footer-sep">·</span>
      <a href="https://arxena.com/legal/privacy/mcp" target="_blank" rel="noopener noreferrer">Privacy</a>
    </p>
  </div>
</body>
</html>`;
};

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

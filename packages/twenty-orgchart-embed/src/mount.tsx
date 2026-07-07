import { createRoot, type Root } from 'react-dom/client';

import {
  extractOrgData,
  processOrgChartToNodeData,
  type OrgChartNodeData,
} from 'twenty-shared';

import { OrgChartDiagram } from 'twenty-orgchart';

import type { ArxenaOrgChartInlineInit } from './resolve';
import { fetchEmbedOrgChart, postEmbedMessage } from './resolve';

type MountState = {
  root: Root | null;
};

const mountStateByContainer = new WeakMap<HTMLElement, MountState>();

const resolveContainer = (
  container?: string | HTMLElement,
): HTMLElement | null => {
  if (!container) {
    return document.getElementById('arxena-orgchart');
  }
  if (typeof container === 'string') {
    return document.querySelector(container);
  }
  return container;
};

const LoadingView = ({ label }: { label: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#666',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
    }}
  >
    {label}
  </div>
);

const ErrorView = ({ message }: { message: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#b00020',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
      padding: 16,
      textAlign: 'center',
    }}
  >
    {message}
  </div>
);

const InlineOrgChartApp = ({
  companyName,
  nodeDataArray,
  onNodeClick,
}: {
  companyName: string;
  nodeDataArray: OrgChartNodeData[];
  onNodeClick?: (node: Record<string, unknown>) => void;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {companyName}
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <OrgChartDiagram
        nodeDataArray={nodeDataArray}
        onNodeClick={(node) => {
          onNodeClick?.(node as unknown as Record<string, unknown>);
          postEmbedMessage('node_click', {
            node: node as unknown as Record<string, unknown>,
          });
        }}
      />
    </div>
  </div>
);

const applyTheme = (
  target: HTMLElement,
  theme?: Record<string, string>,
): void => {
  if (!theme) {
    return;
  }
  for (const [key, value] of Object.entries(theme)) {
    target.style.setProperty(key, value);
  }
};

export const mount = async (
  config: ArxenaOrgChartInlineInit,
  baseUrl: string,
): Promise<void> => {
  const target = resolveContainer(config.container);
  if (!target) {
    console.error('[arxenaOrgChartInline] container not found');
    return;
  }

  const height = config.height ?? '600px';
  target.style.width = target.style.width || '100%';
  target.style.height = height;
  target.style.position = target.style.position || 'relative';
  applyTheme(target, config.theme);

  const existing = mountStateByContainer.get(target);
  if (existing?.root) {
    existing.root.unmount();
  }

  const root = createRoot(target);
  mountStateByContainer.set(target, { root });

  root.render(<LoadingView label="Loading org chart…" />);

  try {
    const resolved = await fetchEmbedOrgChart(config, baseUrl);
    if (resolved.status !== 'ok' || !resolved.result) {
      throw new Error('Invalid embed response');
    }

    const orgData = extractOrgData(resolved.result);
    const nodeDataArray = orgData ? processOrgChartToNodeData(orgData) : [];
    const companyName = resolved.companyName ?? 'Company';

    root.render(
      <InlineOrgChartApp
        companyName={companyName}
        nodeDataArray={nodeDataArray}
        onNodeClick={config.onNodeClick}
      />,
    );

    postEmbedMessage('ready', {
      companyId: resolved.companyId,
      companyName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load org chart';
    root.render(<ErrorView message={message} />);
    postEmbedMessage('error', { message });
  }
};

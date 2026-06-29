/**
 * Lightweight SSR loader for the interactive org-chart diagram area.
 * Rendered on the server so it appears on first paint before GoJS hydrates.
 */
export function OrgChartDiagramLoader() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes org-chart-loader-pulse {
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}
.org-chart-diagram-loader__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 3px;
  border-radius: 50%;
  background: #888;
  animation: org-chart-loader-pulse 1.2s ease-in-out infinite;
}
.org-chart-diagram-loader__dot:nth-of-type(2) { animation-delay: 0.15s; }
.org-chart-diagram-loader__dot:nth-of-type(3) { animation-delay: 0.3s; }
`,
        }}
      />
      <div
        className="org-chart-diagram-loader"
        role="status"
        aria-live="polite"
        aria-label="Loading org chart"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#f5f5f5',
          color: '#666',
          fontSize: 14,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div aria-hidden="true">
          <span className="org-chart-diagram-loader__dot" />
          <span className="org-chart-diagram-loader__dot" />
          <span className="org-chart-diagram-loader__dot" />
        </div>
        <span>Loading org chart…</span>
      </div>
    </>
  );
}

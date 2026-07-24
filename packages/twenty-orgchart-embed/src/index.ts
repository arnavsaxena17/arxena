import { mount } from './mount';

export type { ArxenaOrgChartInlineInit } from './resolve';
export { fetchEmbedOrgChart, postEmbedMessage } from './resolve';
export { mount };

declare global {
  interface Window {
    arxenaOrgChartInline?: {
      mount: typeof mount;
    };
  }
}

if (typeof window !== 'undefined') {
  window.arxenaOrgChartInline = {
    mount,
  };
}

import type { OrgChartEmbedMode } from '@/settings/developers/types/org-chart-embed/OrgChartEmbed';

export type BuildOrgChartEmbedSnippetInput = {
  embedKey: string;
  domain?: string;
  container?: string;
  height?: string;
  mode?: 'iframe' | 'inline';
  siteBaseUrl?: string;
};

export const buildOrgChartEmbedSnippet = (
  input: BuildOrgChartEmbedSnippetInput,
): string => {
  const siteBaseUrl = (
    input.siteBaseUrl ?? 'https://arxena.com'
  ).replace(/\/$/, '');
  const container = input.container ?? '#arxena-orgchart';
  const height = input.height ?? '600px';
  const mode = input.mode ?? 'iframe';
  const domain = input.domain ?? 'example.com';

  const initPayload = JSON.stringify(
    {
      embedKey: input.embedKey,
      domain,
      container,
      height,
      mode,
    },
    null,
    2,
  )
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');

  return `<!-- Arxena Org Chart -->
<div id="arxena-orgchart" style="width:100%;height:${height}"></div>
<script>
(function(A,r,x,e,n,a){
  A[a]=A[a]||function(){(A[a].q=A[a].q||[]).push(arguments)};
  n=r.getElementsByTagName(e)[0];
  x=r.createElement(e);
  x.async=1;x.src='${siteBaseUrl}/embed/orgchart.js';
  n.parentNode.insertBefore(x,n);
})(window,document,'script','script',null,'arxenaOrgChart');
arxenaOrgChart('init',
${initPayload}
);
</script>`;
};

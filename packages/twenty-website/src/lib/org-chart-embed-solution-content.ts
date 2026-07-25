export const ORG_CHART_EMBED_LOADER_URL = 'https://arxena.com/embed/orgchart.js';
export const ORG_CHART_EMBED_DOCS_PATH = '/solutions/org-chart-embed';
export const ARXENA_APP_DEVELOPERS_PATH = '/settings/developers';

export const ORG_CHART_EMBED_SNIPPET_EXAMPLE = `<!-- Arxena Org Chart -->
<div id="arxena-orgchart" style="width:100%;height:600px"></div>
<script>
(function(A,r,x,e,n,a){
  A[a]=A[a]||function(){(A[a].q=A[a].q||[]).push(arguments)};
  n=r.getElementsByTagName(e)[0];
  x=r.createElement(e);
  x.async=1;x.src='${ORG_CHART_EMBED_LOADER_URL}';
  n.parentNode.insertBefore(x,n);
})(window,document,'script','script',null,'arxenaOrgChart');
arxenaOrgChart('init', {
  embedKey: 'emb_your_key_here',
  domain: 'acme.com',
  container: '#arxena-orgchart',
  height: '600px',
  mode: 'iframe'
});
</script>`;

export const ORG_CHART_EMBED_SOLUTION_PAGE = {
  slug: 'org-chart-embed',
  title: 'Org chart embed',
  headline: 'Drop live org charts on any website',
  metaDescription:
    'Embed Arxena org charts on your careers page, investor site, or sales portal with a JavaScript snippet and origin-secured embed key.',
  lead: 'Give visitors an interactive view of company structure without leaving your site. Create an embed key in Developers settings, allow your domain, and paste one snippet.',
};

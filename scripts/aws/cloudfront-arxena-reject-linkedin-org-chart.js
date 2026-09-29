function handler(event) {
  var request = event.request;
  var uri = request.uri.toLowerCase();

  // LinkedIn host/URL is not a catalog company slug (see isRejectedOrgChartCompanySlug).
  // Real LinkedIn Inc chart is /org-chart/linkedin.
  if (
    uri.indexOf('/org-chart/linkedin.com') === 0 ||
    uri.indexOf('/org-chart/www.linkedin.com') === 0 ||
    uri.indexOf('/api/org-chart/linkedin.com') === 0 ||
    uri.indexOf('/api/org-chart/www.linkedin.com') === 0
  ) {
    return {
      statusCode: 400,
      statusDescription: 'Bad Request',
      headers: {
        'content-type': { value: 'application/json' },
        'cache-control': { value: 'no-store' },
      },
      body: '{"message":"Invalid company ID"}',
    };
  }

  return request;
}
